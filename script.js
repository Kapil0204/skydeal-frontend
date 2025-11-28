/************ CONFIG ************/
const BACKEND_URL = "https://skydeal-backend.onrender.com/search";
const PAYMENT_OPTIONS_URL = "https://skydeal-backend.onrender.com/payment-options";

/************ UTILS ************/
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

function fmtINR(n){
  const v = Number(n||0);
  return v.toLocaleString("en-IN",{maximumFractionDigits:2, minimumFractionDigits:0});
}
function pad2(n){ return String(n).padStart(2,"0"); }
function hhmm(str){ // "11:05" etc
  const m = /^(\d{2}):(\d{2})$/.exec(str||"");
  return m ? {h:Number(m[1]), m:Number(m[2])} : null;
}
function timeBucket(t){
  const m = hhmm(t); if(!m) return "";
  const h = m.h;
  if (h>=5 && h<11) return "morning";
  if (h>=11 && h<17) return "afternoon";
  if (h>=17 && h<21) return "evening";
  return "night";
}

/************ PAYMENT DROPDOWN ************/
const paymentState = { all: [], selected: new Set(), open:false };

async function loadPaymentOptions(){
  try{
    const res = await fetch(PAYMENT_OPTIONS_URL);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (Array.isArray(data.options)?data.options:[]);
    paymentState.all = arr.length ? arr : null;
  }catch(e){ paymentState.all = null; }

  if(!paymentState.all){
    paymentState.all = [
      "ICICI Bank Credit Card","HDFC Bank Credit Card","Axis Bank Credit Card","SBI Credit Card",
      "UPI","NetBanking"
    ];
  }
}

function renderPaymentMenu(){
  const body = $("#paymentMenuBody");
  body.innerHTML = "";
  paymentState.all.forEach(label=>{
    const id = "pay_" + label.toLowerCase().replace(/\W+/g,'_');
    const row = document.createElement("label");
    row.style.display="flex"; row.style.alignItems="center"; row.style.gap="10px"; row.style.cursor="pointer";

    const cb = document.createElement("input");
    cb.type="checkbox"; cb.id=id; cb.value=label; cb.checked=paymentState.selected.has(label);
    cb.addEventListener("change",(e)=>{
      if(e.target.checked) paymentState.selected.add(label);
      else paymentState.selected.delete(label);
      updatePaymentBtn();
    });

    const span = document.createElement("span"); span.textContent = label;
    row.appendChild(cb); row.appendChild(span);
    body.appendChild(row);
  });
}
function updatePaymentBtn(){
  const btn = $("#paymentDropdownBtn");
  const n = paymentState.selected.size;
  btn.textContent = n ? `${n} selected ▾` : "Select Payment Methods ▾";
}
function openPay(){ if(paymentState.open) return; renderPaymentMenu(); $("#paymentMenu").style.display="block"; paymentState.open=true; }
function closePay(){ if(!paymentState.open) return; $("#paymentMenu").style.display="none"; paymentState.open=false; }
function togglePay(){ paymentState.open ? closePay() : openPay(); }
function getSelectedPaymentMethods(){ return Array.from(paymentState.selected); }

/************ STATE ************/
let OUT = [];   // mapped outbound
let RET = [];   // mapped return

/************ MAPPING ************/
/* We expect backend to return:
  { outboundFlights: [{airlineName, flightNumber, departure, arrival, price, stops, carrierCode, stopCodes, portalPrices:[...] }], returnFlights: [...] }
*/
function mapForFilters(list){
  const airlines = [...new Set(list.map(f=>f.airlineName).filter(Boolean))].sort();
  return {airlines};
}

/************ RENDER ************/
function flightCard(f){
  const best = (f.portalPrices||[]).reduce((acc,p)=>{
    if (p.finalPrice==null) return acc;
    return (!acc || Number(p.finalPrice)<Number(acc.finalPrice)) ? p : acc;
  }, null);

  return `
  <div class="card" data-airline="${f.airlineName||''}" data-depart="${f.departure||''}" data-arrive="${f.arrival||''}" data-price="${Number(f.price||0)}">
    <div>
      <div class="title">${f.airlineName||'Airline'} <span class="muted">#${f.flightNumber||''}</span></div>
      <div class="muted">Stops: ${Number(f.stops||0)}</div>
    </div>
    <div>
      <div><strong>${f.departure||'--:--'}</strong></div>
      <div class="muted">Departs</div>
    </div>
    <div>
      <div><strong>${f.arrival||'--:--'}</strong></div>
      <div class="muted">Arrives</div>
    </div>
    <div>
      <div class="price">₹${fmtINR(f.price||0)}</div>
      <div class="muted">Base fare</div>
    </div>
    <div>
      ${best ? `<span class="badge best">Best: ${best.portal} · ₹${fmtINR(best.finalPrice)}</span>` : `<span class="badge">No offer</span>`}
    </div>
    <div class="compare">
      <button class="btn light js-compare">Compare</button>
    </div>
  </div>`;
}

function renderList(whereEl, list){
  whereEl.innerHTML = list.map(flightCard).join("") || `<div class="muted">No flights</div>`;
  // wire compare buttons
  $$(".js-compare", whereEl).forEach((btn,idx)=>{
    btn.addEventListener("click", ()=>showModal(list[idx]));
  });
}

function fillAirlineSelect(selEl, airlines){
  const old = selEl.value || "";
  selEl.innerHTML = `<option value="">All Airlines</option>` + airlines.map(a=>`<option value="${a}">${a}</option>`).join("");
  selEl.value = old;
}

/************ FILTERS ************/
function applyFiltersAndSort(list, {airlineSel, timeSel, sortSel}){
  let arr = [...list];
  const airline = airlineSel.value;
  const time = timeSel.value;
  if (airline) arr = arr.filter(f=>f.airlineName===airline);
  if (time)   arr = arr.filter(f=> timeBucket(f.departure)===time );

  switch (sortSel.value){
    case "price":  arr.sort((a,b)=>Number(a.price)-Number(b.price)); break;
    case "depart": arr.sort((a,b)=> (a.departure||"").localeCompare(b.departure||"")); break;
    case "arrive": arr.sort((a,b)=> (a.arrival||"").localeCompare(b.arrival||"")); break;
  }
  return arr;
}

function wireFilterGroup(prefix, list, renderTarget){
  const airlineSel = $(`#${prefix}AirlineFilter`);
  const timeSel    = $(`#${prefix}TimeFilter`);
  const sortSel    = $(`#${prefix}Sort`);

  const run = ()=> {
    const filtered = applyFiltersAndSort(list(), {airlineSel,timeSel,sortSel});
    renderList(renderTarget, filtered);
  };

  airlineSel.onchange = timeSel.onchange = sortSel.onchange = run;
  run();
}

/************ MODAL ************/
function showModal(f){
  $("#modalTitle").textContent = `${f.airlineName||'Airline'} ${f.flightNumber||''} — price comparison`;
  const body = $("#modalBody");
  const rows = (f.portalPrices||[]).map(p=>{
    const haveOffer = !!p.appliedOffer;
    const offerBits = haveOffer ? `
        <div class="pill">${p.appliedOffer.title||''}</div>
        ${p.appliedOffer.couponCode ? `<div class="pill">Code: ${p.appliedOffer.couponCode}</div>`:''}
      ` : `<div class="pill">No offer</div>`;
    return `
      <div class="modal-row">
        <div class="portal">${p.portal||'-'}</div>
        <div>Base: ₹${fmtINR(p.basePrice||0)}</div>
        <div>With markup: ₹${fmtINR(p.markedUpPrice||0)}</div>
        <div><strong>Final: ₹${fmtINR(p.finalPrice||p.markedUpPrice||p.basePrice||0)}</strong></div>
        <div class="go" title="Go to portal (demo)">
          🡥
        </div>
        <div style="grid-column: 1 / -1; display:flex; gap:6px; margin-top:6px;">${offerBits}</div>
      </div>
    `;
  }).join("");
  body.innerHTML = rows || `<div class="muted">No portal pricing available</div>`;

  $("#modalBackdrop").hidden = false;
  $("#priceModal").hidden = false;

  // dummy click for go buttons
  $$(".modal-row .go", body).forEach(el=>{
    el.addEventListener("click", ()=> alert("Demo: would open OTA portal in new tab."));
  });
}

function closeModal(){
  $("#modalBackdrop").hidden = true;
  $("#priceModal").hidden = true;
}

/************ SEARCH ************/
async function doSearch(){
  const from = $("#from").value.trim().toUpperCase();
  const to = $("#to").value.trim().toUpperCase();
  const departureDate = $("#departDate").value;
  const returnDate = $("#returnDate").value;
  const tripType = $$("input[name='tripType']:checked")[0]?.value || "one-way";
  const passengers = Number($("#passengers").value||1);
  const travelClass = $("#travelClass").value;

  if (!from || !to || !departureDate){
    alert("Please enter From, To and Departure Date");
    return;
  }

  const payload = {
    from, to, departureDate,
    returnDate: tripType==="round-trip" ? returnDate : null,
    tripType,
    passengers,
    travelClass,
    paymentMethods: getSelectedPaymentMethods()
  };

  $("#searchBtn").disabled = true;
  $("#searchBtn").textContent = "Searching…";
  try{
    const res = await fetch(BACKEND_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error("Search failed");
    const data = await res.json();

    OUT = Array.isArray(data.outboundFlights) ? data.outboundFlights : [];
    RET = Array.isArray(data.returnFlights) ? data.returnFlights : [];

    // populate airline filter lists
    const outMap = mapForFilters(OUT);
    const retMap = mapForFilters(RET);
    fillAirlineSelect($("#outAirlineFilter"), outMap.airlines);
    fillAirlineSelect($("#retAirlineFilter"), retMap.airlines);

    // wire and render groups
    wireFilterGroup("out", ()=>OUT, $("#outResults"));
    wireFilterGroup("ret", ()=>RET, $("#retResults"));
  }catch(e){
    alert("Search failed. Please try again.");
    console.error(e);
  }finally{
    $("#searchBtn").disabled = false;
    $("#searchBtn").textContent = "Search";
  }
}

/************ INIT ************/
(async function init(){
  // default demo values to speed testing
  $("#from").value = "BOM";
  $("#to").value = "DEL";
  const today = new Date();
  const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate()+4);
  const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate()+6);
  $("#departDate").value = `${d1.getFullYear()}-${pad2(d1.getMonth()+1)}-${pad2(d1.getDate())}`;
  $("#returnDate").value = `${d2.getFullYear()}-${pad2(d2.getMonth()+1)}-${pad2(d2.getDate())}`;

  await loadPaymentOptions();
  updatePaymentBtn();

  // dropdown events
  $("#paymentDropdownBtn").addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); togglePay(); });
  $("#paymentApply").addEventListener("click", ()=> closePay());
  $("#paymentClear").addEventListener("click", ()=>{ paymentState.selected.clear(); updatePaymentBtn(); renderPaymentMenu(); });
  document.addEventListener("click", (e)=>{ if(!$("#paymentDropdown").contains(e.target)) closePay(); });
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closePay(); });

  // modal
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", closeModal);

  // search
  $("#searchBtn").addEventListener("click", doSearch);
})();
