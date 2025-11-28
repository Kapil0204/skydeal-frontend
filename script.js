// ====== CONFIG ======
const BACKEND_URL = "https://skydeal-backend.onrender.com/search";
const PAYMENT_OPTIONS_URL = "https://skydeal-backend.onrender.com/payment-options";

// ====== UTIL ======
const qs  = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];
function fmtTime(v){ if(!v) return ""; if(/^\d{2}:\d{2}$/.test(v)) return v; const d=new Date(v); if(isNaN(d)) return ""; const hh=String(d.getHours()).padStart(2,"0"); const mm=String(d.getMinutes()).padStart(2,"0"); return `${hh}:${mm}`; }
function safeText(v,f=""){ if(v===null||v===undefined) return f; if(typeof v==="string" && v.trim()==="") return f; return v; }
function el(t,c,txt){ const e=document.createElement(t); if(c) e.className=c; if(txt!==undefined) e.textContent=txt; return e; }
function formatINR(n){ const v=Number(n); return Number.isFinite(v)?`₹${Math.round(v).toLocaleString("en-IN")}`:"—"; }
function toISOFromInput(str){
  if(!str) return "";
  const s=String(str).trim();
  const m1=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(m1){ const[,dd,mm,yyyy]=m1; return `${yyyy}-${mm}-${dd}`; }
  const m2=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(m2) return s;
  const d=new Date(s); return isNaN(d)?"":d.toISOString().slice(0,10);
}
function timeToMinutes(t){ if(!t||!/\d{2}:\d{2}/.test(t)) return Number.POSITIVE_INFINITY; const [h,m]=t.split(":").map(Number); return h*60+m; }

// ---------- Airline display normalizer (enhanced) ----------
const CARRIER_NAMES = {
  "6E":"IndiGo","AI":"Air India","IX":"Air India Express","I5":"AIX Connect","QP":"Akasa Air","SG":"SpiceJet","UK":"Vistara","G8":"Go First",
  "EK":"Emirates","QR":"Qatar Airways","EY":"Etihad","SQ":"Singapore Airlines","TG":"Thai Airways","WY":"Oman Air","UL":"SriLankan","MH":"Malaysia Airlines"
};
const looksInvalid = (s) => !s || /^-?\d+$/.test(String(s)) || String(s).startsWith("-");

function parseFlightNo(str){
  if(!str) return null;
  const m = String(str).trim().match(/^([A-Z0-9]{2})\s*-?\s*(\d{1,4})$/i);
  return m ? { code:m[1].toUpperCase(), num:m[2] } : null;
}

function firstSegment(obj){
  const seg = obj?.itineraries?.[0]?.segments?.[0] ?? (Array.isArray(obj?.segments) ? obj.segments[0] : null);
  return seg || null;
}

function pickFirstValid(arr, type){
  for(const v of arr){
    if(!v) continue;
    const s = String(v).trim();
    if(type === "code"){
      if(/^[A-Z0-9]{2}$/.test(s)) return s.toUpperCase();
    }else if(type === "num"){
      const m = parseFlightNo(s);
      if(m) return {code:m.code, num:m.num};
      if(/^\d{1,4}$/.test(s)) return {code:null, num:s};
    }
  }
  return null;
}

function normalizeAirlineDisplay(f){
  // Prefer a clean pair from the first segment
  const seg = firstSegment(f);

  const codeFromSeg = pickFirstValid([
    seg?.marketingCarrierCode, seg?.carrierCode, seg?.operatingCarrierCode,
    seg?.airline, seg?.airlineCode
  ], "code");

  const numFromSeg = pickFirstValid([
    seg?.marketingFlightNumber, seg?.flightNumber, seg?.number
  ], "num");

  // Top-level fallbacks
  const codeTop = pickFirstValid([
    f?.carrierCode, f?.marketingCarrierCode, f?.operatingCarrierCode, f?.airlineCode, parseFlightNo(f?.flightNumber)?.code
  ], "code");

  const numTop = pickFirstValid([
    f?.flightNumber, f?.number
  ], "num");

  // Combine best candidates
  let code = (numFromSeg?.code) || codeFromSeg || codeTop || null;
  let num  = (numFromSeg?.num)  || (numTop?.num) || null;

  if(!code && parseFlightNo(f?.flightNumber)) {
    const p = parseFlightNo(f.flightNumber); code=p.code; num=p.num;
  }
  // Build final printable values
  let flightNo = (code && num) ? `${code} ${num}` : (code ? code : (num || "—"));

  // Airline name
  let airlineName = (f.airlineName||f.carrierName||f.airline||f.carrier||"").trim();
  if(looksInvalid(airlineName)){
    if(code) airlineName = CARRIER_NAMES[code] || code;
  }
  if(!airlineName) airlineName = code || "—";
  if(looksInvalid(flightNo)) flightNo = code || "—";

  return { airlineName, flightNo, carrierCode: code };
}
// ---------- end normalizer ----------

// ====== PAYMENT SELECTOR ======
const PAYMENT_TYPES = ["Credit Card","Debit Card","EMI","NetBanking","Wallet","UPI"];
let selectedPayments = [];            // [{ type, bank }]
let activeType = PAYMENT_TYPES[0];
let paymentMap = null;                // { type -> [banks] }
let paymentMapLoading = null;
let paymentLoadError = null;

function findPaymentTrigger(){
  return qs("#paymentBtn") ||
         qsa("button, [role='button']").find(b => /select\s*payment\s*methods|selected\s*\d*/i.test((b.textContent||"").trim()));
}
function isSelected(type, bank){ return selectedPayments.some(x => x.type===type && x.bank===bank); }
function toggleSelection(type, bank, checked){
  const idx = selectedPayments.findIndex(x => x.type===type && x.bank===bank);
  if(checked && idx===-1) selectedPayments.push({ type, bank });
  if(!checked && idx>-1) selectedPayments.splice(idx, 1);
}
function countSelections(){ return selectedPayments.length; }
function updatePaymentButtonLabel(trigger){
  const n = countSelections();
  if (trigger) trigger.textContent = n ? `${n} selected` : "Select Payment Methods";
}

async function loadPaymentMap(){
  if(paymentMap) return paymentMap;
  if(paymentMapLoading) return paymentMapLoading;
  paymentLoadError = null;
  paymentMapLoading = fetch(PAYMENT_OPTIONS_URL, { mode: "cors" })
    .then(r => { if(!r.ok) throw new Error(`${r.status}`); return r.json(); })
    .then(j => { paymentMap = j.options || {}; return paymentMap; })
    .catch(e => { console.error("Payment options fetch failed:", e); paymentLoadError = e; paymentMap = null; return null; })
    .finally(()=> { paymentMapLoading = null; });
  return paymentMapLoading;
}

function positionMenuBelow(trigger, menu){
  const r = trigger.getBoundingClientRect();
  menu.style.left = `${Math.max(8, r.left + window.scrollX)}px`;
  menu.style.top  = `${r.bottom + 6 + window.scrollY}px`;
}

function renderBanksPane(col, type){
  col.innerHTML = "";
  if (paymentLoadError) {
    const box = el("div");
    box.innerHTML = `<div style="opacity:.75; margin-bottom:6px;">Couldn’t load payment options (network/CORS).</div>`;
    const btn = el("button","", "Retry");
    Object.assign(btn.style,{padding:"6px 10px",border:"1px solid #e5e7eb",borderRadius:"8px",background:"#fff",cursor:"pointer"});
    btn.addEventListener("click", ()=>{
      col.innerHTML = "Loading…";
      loadPaymentMap().then(()=> renderBanksPane(col, type));
    });
    box.appendChild(btn);
    col.appendChild(box);
    return;
  }

  const banks = (paymentMap && paymentMap[type]) ? paymentMap[type] : null;

  if(!paymentMap && !paymentLoadError){
    const msg = el("div","", "Loading…");
    Object.assign(msg.style,{opacity:.8, padding:"6px 2px"});
    col.appendChild(msg);
    return;
  }

  if(Array.isArray(banks) && banks.length === 0){
    const none = el("div","", "No offers for this method");
    Object.assign(none.style,{opacity:.75, padding:"6px 2px"});
    col.appendChild(none);
    return;
  }

  banks.forEach(bank=>{
    const row = el("label");
    Object.assign(row.style,{display:"flex",gap:"8px",alignItems:"center",padding:"6px 4px",cursor:"pointer"});
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isSelected(type, bank);
    cb.addEventListener("change", ()=>{
      toggleSelection(type, bank, cb.checked);
      updatePaymentButtonLabel(findPaymentTrigger());
    });
    row.append(cb, el("span","", bank));
    col.appendChild(row);
  });
}

function buildTypeBankMenu(trigger){
  const menu = document.createElement("div");
  menu.id = "skydealPaymentMenu";
  Object.assign(menu.style,{
    position:"absolute", background:"#fff", border:"1px solid #e5e7eb", borderRadius:"12px",
    boxShadow:"0 10px 30px rgba(0,0,0,.14)", padding:"12px", zIndex:99999, minWidth:"520px"
  });

  const title = el("div","", "Select Payment Methods");
  Object.assign(title.style,{fontWeight:"600", marginBottom:"8px"});
  menu.appendChild(title);

  const grid = el("div");
  Object.assign(grid.style,{display:"grid", gridTemplateColumns:"1.2fr 2fr", gap:"12px", minHeight:"190px"});
  menu.appendChild(grid);

  const typeCol = el("div");
  Object.assign(typeCol.style,{borderRight:"1px solid #eee", paddingRight:"8px", maxHeight:"230px", overflow:"auto"});
  PAYMENT_TYPES.forEach(t=>{
    const item = el("div","", t);
    Object.assign(item.style,{
      padding:"6px 8px", borderRadius:"8px", cursor:"pointer",
      background:(t===activeType)?"#f1f5f9":"transparent", fontWeight:(t===activeType)?"600":"500"
    });
    item.addEventListener("click", ()=>{
      activeType = t;
      renderBanksPane(bankCol, t);
      [...typeCol.children].forEach(ch=>{
        ch.style.background = (ch.textContent===t) ? "#f1f5f9" : "transparent";
        ch.style.fontWeight = (ch.textContent===t) ? "600" : "500";
      });
    });
    typeCol.appendChild(item);
  });
  grid.appendChild(typeCol);

  const bankCol = el("div");
  Object.assign(bankCol.style,{paddingLeft:"4px", maxHeight:"230px", overflow:"auto"});
  grid.appendChild(bankCol);

  renderBanksPane(bankCol, activeType);

  const footer = el("div");
  Object.assign(footer.style,{display:"flex",justifyContent:"space-between",gap:"8px",marginTop:"10px"});

  const clearBtn = el("button","", "Clear");
  Object.assign(clearBtn.style,{padding:"6px 10px",border:"1px solid #e5e7eb",borderRadius:"8px",background:"#fff",cursor:"pointer"});
  clearBtn.addEventListener("click", ()=>{
    selectedPayments = [];
    renderBanksPane(bankCol, activeType);
    updatePaymentButtonLabel(trigger);
  });

  const doneBtn = el("button","", "Done");
  Object.assign(doneBtn.style,{padding:"6px 12px",border:"1px solid #2563eb",borderRadius:"8px",background:"#2563eb",color:"#fff",cursor:"pointer"});
  doneBtn.addEventListener("click", ()=>togglePaymentMenu(false, trigger));

  footer.append(clearBtn, doneBtn);
  menu.appendChild(footer);

  document.body.appendChild(menu);
  positionMenuBelow(trigger, menu);

  setTimeout(()=>{
    const outside = (e)=>{ if(!menu.contains(e.target) && e.target!==trigger) togglePaymentMenu(false, trigger); };
    const onEsc   = (e)=>{ if(e.key==="Escape") togglePaymentMenu(false, trigger); };
    menu._outside = outside; menu._esc = onEsc;
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", onEsc);
  },0);

  loadPaymentMap().then(()=> renderBanksPane(bankCol, activeType)).catch(()=>{});
  return menu;
}

function togglePaymentMenu(show, trigger){
  let menu = qs("#skydealPaymentMenu");
  if(show){
    if(menu){ positionMenuBelow(trigger, menu); menu.style.display="block"; return; }
    buildTypeBankMenu(trigger);
  } else {
    if(menu){
      menu.style.display="none";
      document.removeEventListener("mousedown", menu._outside || (()=>{}));
      document.removeEventListener("keydown", menu._esc || (()=>{}));
      menu.remove();
    }
  }
}

// ====== MODAL (Comparison) ======
let modalEl=null;
function ensureModal(){
  if(modalEl) return modalEl;
  modalEl = document.createElement("div");
  modalEl.id = "skydealModal";
  Object.assign(modalEl.style,{position:"fixed",inset:"0",background:"rgba(0,0,0,0.35)",display:"none",alignItems:"center",justifyContent:"center",zIndex:"9999"});
  const content = el("div"); content.id="skydealModalContent";
  Object.assign(content.style,{background:"#fff",borderRadius:"12px",padding:"16px",maxWidth:"560px",width:"92%",boxShadow:"0 10px 30px rgba(0,0,0,0.15)"});
  const header = el("div"); Object.assign(header.style,{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"});
  const title  = el("h3","", "Price Comparison"); Object.assign(title.style,{margin:0,fontSize:"18px"});
  const close  = el("button","", "×"); Object.assign(close.style,{fontSize:"20px",lineHeight:"20px",border:"none",background:"transparent",cursor:"pointer"}); close.addEventListener("click", hideModal);
  header.append(title, close);
  const body = el("div"); body.id="skydealModalBody"; Object.assign(body.style,{display:"grid",gap:"8px"});
  content.append(header, body);
  modalEl.appendChild(content);
  modalEl.addEventListener("click",(e)=>{ if(e.target===modalEl) hideModal(); });
  document.body.appendChild(modalEl);
  return modalEl;
}
function showModal(htmlBody, heading="Price Comparison"){ ensureModal(); qs("#skydealModalBody").innerHTML=htmlBody; qs("#skydealModalContent h3").textContent=heading; modalEl.style.display="flex"; }
function hideModal(){ if(modalEl) modalEl.style.display="none"; }

// ====== SORT/FILTER CONTROLS (per-side) ======
const controlState = {
  outbound: { sortKey: "price", airline: "ALL", nonstop: false },
  return:   { sortKey: "price", airline: "ALL", nonstop: false },
};

function buildControlsBar(sideKey, flights, onChange){
  const bar = el("div");
  Object.assign(bar.style,{
    display:"flex", gap:"6px", alignItems:"center", margin:"6px 0 8px", flexWrap:"wrap",
    fontSize:"12px"
  });

  // Sort
  bar.appendChild(el("span","", "Sort:"));
  const sortSel = document.createElement("select");
  ["Price","Departure time","Arrival time"].forEach((label,i)=>{
    const opt = el("option","", label);
    opt.value = i===0?"price":(i===1?"depTime":"arrTime");
    sortSel.appendChild(opt);
  });
  Object.assign(sortSel.style,{fontSize:"12px",padding:"2px 6px"});
  sortSel.value = controlState[sideKey].sortKey;
  sortSel.addEventListener("change",(e)=>{ controlState[sideKey].sortKey = e.target.value; onChange(); });
  bar.appendChild(sortSel);

  // Airline filter
  bar.appendChild(el("span","", "Airline:"));
  const airlineSel = document.createElement("select");
  const airlines = Array.from(new Set((flights||[]).map(f=> normalizeAirlineDisplay(f).airlineName).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  airlineSel.appendChild(el("option","", "All"));
  airlineSel.firstChild.value = "ALL";
  airlines.forEach(a=>{ const o=el("option","",a); o.value=a; airlineSel.appendChild(o); });
  Object.assign(airlineSel.style,{fontSize:"12px",padding:"2px 6px"});
  airlineSel.value = controlState[sideKey].airline;
  airlineSel.addEventListener("change",(e)=>{ controlState[sideKey].airline = e.target.value; onChange(); });
  bar.appendChild(airlineSel);

  // Non-stop toggle
  const nsWrap = el("label");
  Object.assign(nsWrap.style,{display:"flex",alignItems:"center",gap:"4px",marginLeft:"6px",fontSize:"12px"});
  const nsCb = document.createElement("input");
  nsCb.type="checkbox"; nsCb.checked = controlState[sideKey].nonstop;
  nsCb.addEventListener("change",()=>{ controlState[sideKey].nonstop = nsCb.checked; onChange(); });
  nsWrap.append(nsCb, el("span","", "Non-stop"));
  bar.appendChild(nsWrap);

  return bar;
}

function sortAndFilterFlights(flights, state){
  let out = Array.isArray(flights)? [...flights] : [];

  if(state.airline && state.airline!=="ALL"){
    out = out.filter(f => (normalizeAirlineDisplay(f).airlineName||"") === state.airline);
  }
  if(state.nonstop){
    out = out.filter(f => Number(f.stops) === 0);
  }

  if(state.sortKey==="depTime"){
    out.sort((a,b)=> timeToMinutes(a.departure||a.departureTime) - timeToMinutes(b.departure||b.departureTime));
  } else if(state.sortKey==="arrTime"){
    out.sort((a,b)=> timeToMinutes(a.arrival||a.arrivalTime) - timeToMinutes(b.arrival||b.arrivalTime));
  } else {
    out.sort((a,b)=> (Number(a.price)??Infinity) - (Number(b.price)??Infinity)); // default price
  }
  return out;
}

// ====== BEST DEAL ======
function getBestDeal(portalPrices){
  if (!Array.isArray(portalPrices) || portalPrices.length===0) return null;
  const valid = portalPrices.filter(p => Number.isFinite(Number(p.finalPrice)));
  if (!valid.length) return null;
  return valid.reduce((best,p)=> Number(p.finalPrice) < Number(best.finalPrice) ? p : best);
}

// ====== RENDERING ======
function renderFlightList(container, flights, sideLabel){
  container.innerHTML="";
  if(!flights || flights.length===0){
    const empty = el("div","",`No ${sideLabel} flights found.`); Object.assign(empty.style,{padding:"8px",opacity:"0.8"}); container.appendChild(empty); return;
  }
  const list = el("div"); Object.assign(list.style,{display:"grid",gap:"10px"});
  flights.forEach(f=>{
    const card = el("div","flight-card"); Object.assign(card.style,{border:"1px solid #e6e6e6",borderRadius:"10px",padding:"10px"});

    const { airlineName, flightNo } = normalizeAirlineDisplay(f);

    const dep         = fmtTime(f.departureTime||f.departure);
    const arr         = fmtTime(f.arrivalTime||f.arrival);
    const stopsCount  = (f.stops!==undefined&&f.stops!==null)?f.stops:(f.itineraries?.[0]?.segments?.length?(f.itineraries[0].segments.length-1):0);
    const stopCodes   = Array.isArray(f.stopCodes)? f.stopCodes : [];
    const basePrice   = parseFloat(f.price?.total||f.price?.base||f.price);
    const best        = getBestDeal(f.portalPrices);

    const stopsText = isNaN(stopsCount) ? "—" : (stopsCount > 0 ? `${stopsCount} (${stopCodes.join(", ") || "—"})` : "0");

    const top = el("div");
    top.innerHTML = `<strong>${airlineName}${flightNo ? " " + flightNo : ""}</strong>
                     <div>${dep} → ${arr}</div>
                     <div>Stops: ${stopsText}</div>`;

    const bestLine = el("div");
    Object.assign(bestLine.style,{display:"flex",alignItems:"center",gap:"8px",marginTop:"6px",flexWrap:"wrap",fontSize:"12px"});
    if (best) {
      const pm = best.appliedOffer?.paymentMethodLabel ? ` • ${best.appliedOffer.paymentMethodLabel}` : "";
      bestLine.innerHTML =
        `<span style="font-weight:600;">Best on ${best.portal}: ${formatINR(best.finalPrice)}</span>` +
        `<span style="opacity:.8;">(was ${formatINR(basePrice)})${pm}</span>`;
    } else if (Number.isFinite(basePrice)) {
      bestLine.innerHTML = `<span style="font-weight:600;">Base fare: ${formatINR(basePrice)}</span>`;
    }

    const infoBtn = el("button","", "i");
    Object.assign(infoBtn.style,{marginLeft:"auto",border:"1px solid #e5e7eb",borderRadius:"6px",padding:"2px 8px",cursor:"pointer",fontSize:"12px"});
    infoBtn.addEventListener("click", ()=>openComparisonModal(f, {
      airlineName, flightNo, dep, arr, price: basePrice
    }));

    const lineWrap = el("div"); Object.assign(lineWrap.style,{display:"flex",alignItems:"center",gap:"8px"});
    lineWrap.append(bestLine, infoBtn);

    card.append(top, lineWrap);
    list.appendChild(card);
  });
  container.appendChild(list);
}

function openComparisonModal(flight, basics){
  const portals = Array.isArray(flight.portalPrices) && flight.portalPrices.length
    ? flight.portalPrices.map(p => ({
        name: p.portal,
        final: Number(p.finalPrice),
        base: Number(p.basePrice),
        discountApplied: p.discountApplied || 0,
        appliedOffer: p.appliedOffer || null
      }))
    : ["MakeMyTrip","Goibibo","Cleartrip","Yatra","EaseMyTrip"].map(name => ({
        name,
        final: isNaN(basics.price) ? NaN : Math.round(basics.price) + 100,
        base: basics.price,
        discountApplied: 0,
        appliedOffer: null
      }));

  const rows = portals.map(p=>{
    const priceStr = isNaN(p.final) ? "—" : formatINR(p.final);
    const note = p.appliedOffer?.couponCode
      ? `<div style="font-size:12px;opacity:.75;">Code: ${p.appliedOffer.couponCode} • ${p.appliedOffer.paymentMethodLabel || ""}</div>`
      : "";
    return `<div style="display:flex;justify-content:space-between;gap:8px;border:1px solid #eee;border-radius:8px;padding:8px;">
      <div>
        <strong>${p.name}</strong>
        <div style="font-size:12px;opacity:0.8;">${basics.airlineName}${basics.flightNo?" "+basics.flightNo:""} • ${basics.dep} → ${basics.arr}</div>
        ${note}
      </div>
      <div style="font-weight:600;">${priceStr}</div>
    </div>`;
  }).join("");

  const body = `<div style="display:grid;gap:8px;">${rows}${flight.portalPrices ? "" : `<div style="font-size:12px;opacity:.75;">(Fallback demo: Amadeus fare + ₹100 per portal)</div>`}</div>`;
  showModal(body, "Compare prices across portals");
}

// ====== MAIN ======
document.addEventListener("DOMContentLoaded", ()=>{
  const fromInput=qs("#from"), toInput=qs("#to"), depInput=qs("#departureDate"), retInput=qs("#returnDate");
  const returnGroup=qs("#returnDateGroup"), paxInput=qs("#passengers"), classInput=qs("#travelClass");
  const outboundContainer=qs("#outboundContainer"), returnContainer=qs("#returnContainer");

  // Payment selector
  const paymentTrigger = findPaymentTrigger();
  if (paymentTrigger) {
    paymentTrigger.style.cursor = "pointer";
    paymentTrigger.addEventListener("click", async (e) => {
      e.preventDefault();
      await loadPaymentMap();
      togglePaymentMenu(true, paymentTrigger);
    });
    updatePaymentButtonLabel(paymentTrigger);
  }

  // Trip type toggle
  const tripRadios = qsa('input[name="tripType"]');
  function applyTripTypeUI(){
    const v = (qs('input[name="tripType"]:checked')?.value) || "one-way";
    if(v==="round-trip"){ if(returnGroup) returnGroup.style.display="block"; }
    else { if(returnGroup) returnGroup.style.display="none"; if(retInput) retInput.value=""; }
  }
  tripRadios.forEach(r=>r.addEventListener("change", applyTripTypeUI));
  applyTripTypeUI();

  // --- Search wiring ---
  const searchBtn =
    qs("#searchBtn") ||
    qsa("button,input[type='submit']").find(b => /search/i.test(b?.textContent || b?.value || ""));
  const searchForm = searchBtn ? searchBtn.closest("form") : qs("form");

  async function doSearchWrapper(e){ if (e) e.preventDefault(); await doSearch(); }
  if (searchBtn)  searchBtn.addEventListener("click",  doSearchWrapper);
  if (searchForm) searchForm.addEventListener("submit", doSearchWrapper);
  ["#from","#to","#departureDate","#returnDate","#passengers","#travelClass"].forEach(sel=>{
    const elx = qs(sel); if (elx) elx.addEventListener("keydown", (ev)=>{ if (ev.key === "Enter") doSearchWrapper(ev); });
  });

  function ensureControlsMount(container, id){
    let existing = document.getElementById(id);
    if (existing) existing.remove();
    const mount = el("div"); mount.id = id;
    container.parentNode.insertBefore(mount, container); // place just above results
    return mount;
  }

  function rerenderSide(sideKey, allFlights){
    const state = controlState[sideKey];
    const container = sideKey==="outbound" ? outboundContainer : returnContainer;
    const sorted = sortAndFilterFlights(allFlights, state);
    renderFlightList(container, sorted, sideKey);
  }

  async function doSearch(){
    const from=fromInput?.value?.trim(), to=toInput?.value?.trim();
    const dateISO = toISOFromInput(depInput?.value);
    const trip=(qs('input[name="tripType"]:checked')?.value)||"one-way";
    const retISO  = toISOFromInput(retInput?.value || "");
    if(!from||!to||!dateISO){ alert("Please fill From, To, and Departure Date."); return; }

    const payload = {
      from: (from || "").trim().toUpperCase(),
      to:   (to   || "").trim().toUpperCase(),
      departureDate: dateISO,
      returnDate: (trip==="round-trip" && retISO) ? retISO : null,
      passengers: (paxInput?.value ? Number(paxInput.value) : 1) || 1,
      travelClass: (classInput?.value || "ECONOMY"),
      paymentMethods: selectedPayments.map(x => ({ type: x.type, bank: x.bank }))
    };
    console.log("Payload being sent:", payload);

    outboundContainer.innerHTML = "Loading…";
    if(returnContainer) returnContainer.innerHTML = "";

    try{
      const res = await fetch(BACKEND_URL, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      if(!res.ok){
        const text = await res.text();
        console.error("Search failed. HTTP", res.status, "Body:", text);
        throw new Error(`Request failed: ${res.status}`);
      }
      const data = await res.json();

      let outbound = data?.outboundFlights || data?.flights || [];
      let returns  = data?.returnFlights  || [];

      // default state (sort by price by default)
      controlState.outbound = { sortKey:"price", airline:"ALL", nonstop:false };
      controlState.return   = { sortKey:"price", airline:"ALL", nonstop:false };

      const outMount = ensureControlsMount(outboundContainer, "outboundControls");
      const outBar = buildControlsBar("outbound", outbound, ()=>rerenderSide("outbound", outbound));
      outMount.appendChild(outBar);
      rerenderSide("outbound", outbound); // initial render: price sort

      if (retISO && returns?.length && returnContainer){
        const retMount = ensureControlsMount(returnContainer, "returnControls");
        const retBar = buildControlsBar("return", returns, ()=>rerenderSide("return", returns));
        retMount.appendChild(retBar);
        rerenderSide("return", returns);
      } else if(returnContainer){
        const old = document.getElementById("returnControls"); if(old) old.remove();
        returnContainer.innerHTML = "";
      }
    }catch(err){
      console.error("Search error:", err, "Payload sent:", payload);
      outboundContainer.innerHTML = "<div style='color:#b00020;'>Failed to fetch flights. Please try again.</div>";
      if(returnContainer) returnContainer.innerHTML = "";
    }
  }
});
