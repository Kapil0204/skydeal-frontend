/***** CONFIG *****/
const BACKEND_URL = "https://skydeal-backend.onrender.com/search";
const PAYMENT_OPTIONS_URL = "https://skydeal-backend.onrender.com/payment-options";

/***** STATE *****/
const state = {
  paymentOptions: null,     // fetched from /payment-options
  selectedPayments: new Set(),
  lastSearchParams: null,
  raw: { outbound: [], ret: [] },
};

/***** UTILS *****/
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => root.querySelectorAll(sel);

function fmtINR(n){ const v = Number(n||0); return isFinite(v) ? v.toLocaleString("en-IN",{maximumFractionDigits:2}) : "--"; }
function pad2(n){ return String(n).padStart(2,"0"); }
function toTimeStr(isoLike){ // supports "11:00" or "2025-12-15T11:00"
  if(!isoLike) return "--:--";
  if(/^\d{2}:\d{2}$/.test(isoLike)) return isoLike;
  const d = new Date(isoLike);
  if(isNaN(d)) return "--:--";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function minutesFromHHMM(hhmm){ if(!/^\d{2}:\d{2}$/.test(hhmm)) return Number.POSITIVE_INFINITY; const [h,m]=hhmm.split(":").map(Number); return h*60+m; }
function inBucket(hhmm, bucket){
  if(!bucket) return true;
  const t = minutesFromHHMM(hhmm);
  if(bucket==="morning") return t>=300 && t<720;
  if(bucket==="afternoon") return t>=720 && t<1020;
  if(bucket==="evening") return t>=1020 && t<1320;
  if(bucket==="night") return (t>=1320 && t<1440) || t<300;
  return true;
}
function normalizeIata(v){ return (v||"").trim().toUpperCase().slice(0,3); }

/***** PAYMENT METHODS POPOVER *****/
function buildPaymentTabs(data){
  const tabs = [];
  if(data.creditCards?.length) tabs.push(["creditCards","Credit Cards"]);
  if(data.debitCards?.length)  tabs.push(["debitCards","Debit Cards"]);
  if(data.wallets?.length)     tabs.push(["wallets","Wallets"]);
  if(data.upi?.length)         tabs.push(["upi","UPI"]);
  if(data.netbanking?.length)  tabs.push(["netbanking","NetBanking"]);
  return tabs;
}

function renderPaymentPopover(){
  const pop = $("#paymentPopover");
  const tabsWrap = $("#pmTabs");
  const lists = $("#pmLists");
  tabsWrap.innerHTML = "";
  lists.innerHTML = "";

  const data = state.paymentOptions || {};
  const tabs = buildPaymentTabs(data);

  if(!tabs.length){
    lists.innerHTML = `<div class="pm-group"><em>No payment options found.</em></div>`;
    return;
  }

  tabs.forEach(([key, label], i) => {
    const t = document.createElement("button");
    t.className = `tab ${i===0?"active":""}`;
    t.dataset.key = key;
    t.textContent = label;
    tabsWrap.appendChild(t);

    const group = document.createElement("div");
    group.className = `pm-group`;
    group.dataset.key = key;
    group.style.display = i===0 ? "block" : "none";

    const list = data[key] || [];
    list.forEach(opt => {
      const id = `${key}:${opt.value || opt.label || opt}`;
      const title = opt.label || String(opt);
      const row = document.createElement("label");
      row.className = "pm-item";
      row.innerHTML = `
        <input type="checkbox" value="${id}">
        <span>${title}</span>
      `;
      const cb = row.querySelector("input");
      if(state.selectedPayments.has(id)) cb.checked = true;
      group.appendChild(row);
    });

    lists.appendChild(group);
  });
}

function togglePaymentPopover(force){
  const pop = $("#paymentPopover");
  const btn = $("#paymentBtn");
  if(force === true){ pop.classList.remove("hidden"); positionPopover(btn, pop); return; }
  if(force === false){ pop.classList.add("hidden"); return; }
  pop.classList.toggle("hidden");
  if(!pop.classList.contains("hidden")) positionPopover(btn, pop);
}

function positionPopover(anchor, pop){
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${r.bottom + window.scrollY + 8}px`;
  pop.style.left = `${Math.min(r.left + window.scrollX, window.innerWidth-460)}px`;
}

function updatePaymentBtnLabel(){
  const count = state.selectedPayments.size;
  $("#paymentBtn").textContent = count ? `${count} selected ▾` : "Select Payment Methods ▾";
}

/***** RENDER RESULTS *****/
function airlineSet(list){
  const s = new Set(list.map(x=>x.airlineName).filter(Boolean));
  return ["All Airlines", ...Array.from(s).sort()];
}
function applyFilters(list, type){
  const airlineSel = $(`#${type}Airline`).value || "";
  const bucketSel  = $(`#${type}Time`).value || "";
  let out = list.slice();
  if(airlineSel && airlineSel!=="All Airlines") out = out.filter(x => x.airlineName===airlineSel);
  if(bucketSel) out = out.filter(x => inBucket(x.departure, bucketSel));

  const sortSel = $(`#${type}Sort`).value;
  if(sortSel==="price_asc") out.sort((a,b)=>Number(a.price)-Number(b.price));
  if(sortSel==="price_desc") out.sort((a,b)=>Number(b.price)-Number(a.price));
  if(sortSel==="dep_asc") out.sort((a,b)=>minutesFromHHMM(a.departure)-minutesFromHHMM(b.departure));
  if(sortSel==="dep_desc") out.sort((a,b)=>minutesFromHHMM(b.departure)-minutesFromHHMM(a.departure));
  return out;
}

function renderResults(type, list){
  const box = type==="out" ? $("#outboundResults") : $("#returnResults");
  box.innerHTML = "";
  if(!list.length){ box.innerHTML = `<div class="badge">No flights</div>`; return; }

  const airlines = airlineSet(list);
  const sel = $(`#${type==="out"?"out":"ret"}Airline`);
  sel.innerHTML = airlines.map(a => `<option value="${a}">${a}</option>`).join("");

  applyFilters(list, type==="out"?"out":"ret").forEach((f, idx) => {
    const node = document.createElement("div");
    node.className = "card";
    node.innerHTML = `
      <div class="meta">
        <span class="badge">${f.airlineName || "Airline"}</span>
        <span class="badge">#${f.flightNumber || "--"}</span>
        <span>${f.departure} → ${f.arrival}</span>
        <span class="badge">${f.stops ? `${f.stops} stop` : "Nonstop"}</span>
      </div>
      <div class="cta">
        <div class="price">₹ ${fmtINR(f.price)}</div>
        <button class="btn ghost compareBtn" data-type="${type}" data-idx="${idx}">Compare Prices</button>
      </div>
    `;
    box.appendChild(node);
  });
}

/***** MODAL *****/
function showPricesModal(title, portalPrices){
  $("#modalTitle").textContent = title;
  const body = $("#modalBody");
  body.innerHTML = portalPrices.map(p => {
    const deal = p.appliedOffer ? `
      <div class="offer">${p.appliedOffer.title}${p.appliedOffer.couponCode ? ` · Code: ${p.appliedOffer.couponCode}`:""}</div>` : "";
    return `
      <div class="price-row">
        <div>
          <div><strong>${p.portal}</strong></div>
          ${deal}
        </div>
        <div class="final">₹ ${fmtINR(p.finalPrice)}</div>
      </div>`;
  }).join("");
  $("#modal").classList.remove("hidden");
}
function closeModal(){ $("#modal").classList.add("hidden"); }

/***** SEARCH *****/
async function doSearch(){
  const from = normalizeIata($("#from").value);
  const to = normalizeIata($("#to").value);
  const departureDate = $("#depart").value;
  const returnDate = $("#return").value || null;
  const tripType = $("#roundTrip").checked ? "round-trip" : "one-way";
  const passengers = Math.max(1, Number($("#pax").value||1));
  const travelClass = $("#cabin").value || "ECONOMY";

  if(!from || !to || !departureDate){
    alert("Please enter From, To and Departure date.");
    return;
  }

  const payload = { from, to, departureDate, returnDate, tripType, passengers, travelClass };

  $("#outboundResults").innerHTML = `<div class="badge">Loading…</div>`;
  $("#returnResults").innerHTML = `<div class="badge">Loading…</div>`;

  try{
    const r = await fetch(BACKEND_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    state.lastSearchParams = payload;
    state.raw.outbound = Array.isArray(data.outboundFlights) ? data.outboundFlights : [];
    state.raw.ret      = Array.isArray(data.returnFlights) ? data.returnFlights : [];

    // render
    renderResults("out", state.raw.outbound);
    renderResults("ret", state.raw.ret);
  }catch(e){
    console.error("Search failed:", e);
    $("#outboundResults").innerHTML = `<div class="badge">No flights</div>`;
    $("#returnResults").innerHTML = `<div class="badge">No flights</div>`;
  }
}

/***** INIT *****/
async function loadPaymentOptions(){
  try{
    const r = await fetch(PAYMENT_OPTIONS_URL);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    state.paymentOptions = await r.json();
  }catch(e){
    console.warn("Payment options fetch failed; falling back to defaults.", e);
    // fallback minimal groups
    state.paymentOptions = {
      creditCards: [
        {label:"ICICI Bank Credit Card", value:"credit:ICICI"},
        {label:"HDFC Bank Credit Card", value:"credit:HDFC"},
        {label:"Axis Bank Credit Card", value:"credit:AXIS"},
        {label:"SBI Credit Card", value:"credit:SBI"},
      ],
      debitCards: [],
      wallets: [],
      upi: [{label:"UPI", value:"upi:any"}],
      netbanking: [{label:"NetBanking", value:"nb:any"}]
    };
  }
  renderPaymentPopover();
  updatePaymentBtnLabel();
}

function wireEvents(){
  // Ensure return date toggles with trip type
  const toggleReturn = () => {
    const rt = $("#roundTrip").checked;
    $("#return").disabled = !rt;
    $("#return").parentElement?.classList?.toggle?.("disabled", !rt);
  };
  $("#oneWay").addEventListener("change", toggleReturn);
  $("#roundTrip").addEventListener("change", toggleReturn);
  toggleReturn();

  // Buttons
  $("#paymentBtn").addEventListener("click", () => togglePaymentPopover());
  $("#pmDone").addEventListener("click", () => { togglePaymentPopover(false); updatePaymentBtnLabel(); });
  $("#pmClear").addEventListener("click", () => {
    state.selectedPayments.clear();
    $$("#pmLists input[type=checkbox]").forEach(cb => cb.checked = false);
    updatePaymentBtnLabel();
  });
  $("#searchBtn").addEventListener("click", doSearch);

  // Tabs switching
  $("#pmTabs").addEventListener("click", (e)=>{
    const tab = e.target.closest(".tab");
    if(!tab) return;
    $$(".tab").forEach(x=>x.classList.remove("active"));
    tab.classList.add("active");
    const key = tab.dataset.key;
    $$("#pmLists .pm-group").forEach(g => g.style.display = (g.dataset.key===key) ? "block" : "none");
  });

  // Checkbox selections
  $("#pmLists").addEventListener("change", (e)=>{
    const cb = e.target;
    if(cb && cb.matches("input[type=checkbox]")){
      if(cb.checked) state.selectedPayments.add(cb.value);
      else state.selectedPayments.delete(cb.value);
      updatePaymentBtnLabel();
    }
  });

  // Compare prices modal (event delegation)
  document.addEventListener("click", (e)=>{
    const c = e.target.closest(".compareBtn");
    if(c){
      const type = c.dataset.type; const idx = Number(c.dataset.idx);
      const list = type==="out" ? applyFilters(state.raw.outbound, "out") : applyFilters(state.raw.ret, "ret");
      const f = list[idx]; if(!f) return;
      showPricesModal(`${f.airlineName || "Flight"} · ${f.departure} → ${f.arrival}`, f.portalPrices||[]);
    }
  });
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e)=>{ if(e.target.id==="modal") closeModal(); });

  // Filters re-render
  ["outAirline","outTime","outSort"].forEach(id => {
    $(`#${id}`).addEventListener("change", () => renderResults("out", state.raw.outbound));
  });
  ["retAirline","retTime","retSort"].forEach(id => {
    $(`#${id}`).addEventListener("change", () => renderResults("ret", state.raw.ret));
  });

  // Close popover on outside click
  document.addEventListener("click", (e)=>{
    const pop = $("#paymentPopover");
    if(pop.classList.contains("hidden")) return;
    if(!e.target.closest("#paymentPopover") && !e.target.closest("#paymentBtn")){
      togglePaymentPopover(false);
    }
  });

  // Position popover on resize/scroll
  window.addEventListener("resize", ()=>{ if(!$("#paymentPopover").classList.contains("hidden")) positionPopover($("#paymentBtn"), $("#paymentPopover")); });
  window.addEventListener("scroll", ()=>{ if(!$("#paymentPopover").classList.contains("hidden")) positionPopover($("#paymentBtn"), $("#paymentPopover")); });
}

async function init(){
  // sensible defaults for today/today+2
  const today = new Date();
  const toISO = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  $("#depart").value = toISO(today);
  const ret = new Date(today); ret.setDate(today.getDate()+2);
  $("#return").value = toISO(ret);

  await loadPaymentOptions();
  wireEvents();
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", init);
}else{
  init();
}
