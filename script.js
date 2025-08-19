// ====== CONFIG ======
const BACKEND_URL = "https://skydeal-backend.onrender.com/search";          // /search endpoint
const PAYMENT_OPTIONS_URL = "https://skydeal-backend.onrender.com/payment-options"; // NEW

// ====== UTIL ======
const qs  = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];
function fmtTime(v){ if(!v) return ""; if(/^\d{2}:\d{2}$/.test(v)) return v; const d=new Date(v); if(isNaN(d)) return ""; const hh=String(d.getHours()).padStart(2,"0"); const mm=String(d.getMinutes()).padStart(2,"0"); return `${hh}:${mm}`; }
function safeText(v,f=""){ if(v===null||v===undefined) return f; if(typeof v==="string" && v.trim()==="") return f; return v; }
function el(t,c,txt){ const e=document.createElement(t); if(c) e.className=c; if(txt!==undefined) e.textContent=txt; return e; }

// ====== PAYMENT SELECTOR (LEFT = TYPES, RIGHT = BANKS FROM BACKEND) ======
const PAYMENT_TYPES = ["Credit Card","Debit Card","EMI","NetBanking","Wallet","UPI"];
let selectedPayments = [];            // array of { type, bank }
let activeType = PAYMENT_TYPES[0];
let paymentMap = null;                // { type: string -> banks: string[] } from backend
let paymentMapLoading = null;         // Promise cache

function findPaymentTrigger(){
  return qs("#paymentBtn") ||
         qsa("button, [role='button']").find(b => /select\s*payment\s*methods/i.test((b.textContent||"").trim()));
}
function isSelected(type, bank){ return selectedPayments.some(x => x.type===type && x.bank===bank); }
function toggleSelection(type, bank, checked){
  const idx = selectedPayments.findIndex(x => x.type===type && x.bank===bank);
  if(checked && idx===-1) selectedPayments.push({ type, bank });
  if(!checked && idx>-1) selectedPayments.splice(idx, 1);
}
function countSelections(){ return selectedPayments.length; }
function updatePaymentButtonLabel(trigger){
  if(!trigger) return;
  const n = countSelections();
  trigger.textContent = n ? `${n} selected` : "Select Payment Methods";
}

async function loadPaymentMap(){
  if(paymentMap) return paymentMap;
  if(paymentMapLoading) return paymentMapLoading;
  paymentMapLoading = fetch(PAYMENT_OPTIONS_URL)
    .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => (paymentMap = j.options || {}))
    .catch(e => { console.error("Payment options fetch failed:", e); paymentMap = {}; return paymentMap; });
  return paymentMapLoading;
}

function positionMenuBelow(trigger, menu){
  const r = trigger.getBoundingClientRect();
  menu.style.left = `${Math.max(8, r.left + window.scrollX)}px`;
  menu.style.top  = `${r.bottom + 6 + window.scrollY}px`;
}

function renderBanksPane(col, type){
  col.innerHTML = "";
  const banks = (paymentMap && paymentMap[type]) ? paymentMap[type] : null;

  if(!banks) {
    // still loading OR fetch failed — show a tiny loader
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
      const trigger = findPaymentTrigger();
      updatePaymentButtonLabel(trigger);
    });
    row.append(cb, el("span","", `${bank} ${type}`));
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

  // LEFT: Payment Types
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

  // RIGHT: Banks (loaded dynamically)
  const bankCol = el("div");
  Object.assign(bankCol.style,{paddingLeft:"4px", maxHeight:"230px", overflow:"auto"});
  grid.appendChild(bankCol);

  // Render initial view
  renderBanksPane(bankCol, activeType);

  // Footer
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

  // Close handlers
  setTimeout(()=>{
    const outside = (e)=>{ if(!menu.contains(e.target) && e.target!==trigger) togglePaymentMenu(false, trigger); };
    const onEsc   = (e)=>{ if(e.key==="Escape") togglePaymentMenu(false, trigger); };
    menu._outside = outside; menu._esc = onEsc;
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", onEsc);
  },0);

  // Ensure data is loaded, then refresh right pane
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
  document.body.appendChild(modelEl);
  return modalEl;
}
function showModal(htmlBody, heading="Price Comparison"){ ensureModal(); qs("#skydealModalBody").innerHTML=htmlBody; qs("#skydealModalContent h3").textContent=heading; modalEl.style.display="flex"; }
function hideModal(){ if(modalEl) modalEl.style.display="none"; }

// ====== SORT CONTROLS ======
let currentSortKey = "price";
function renderSortControls(onChange){
  const host = qs("#filtersContainer"); if(!host) return;
  let wrap = qs("#skydealSortWrap");
  if(!wrap){
    wrap = el("div"); wrap.id="skydealSortWrap";
    Object.assign(wrap.style,{display:"flex",gap:"8px",alignItems:"center",margin:"8px 0 12px"});
    const label = el("span","", "Sort by:");
    const select = document.createElement("select"); select.id="skydealSortSelect";
    ["Price (asc)","Departure time (asc)"].forEach((opt,i)=>{ const o=el("option","",opt); o.value = i===0 ? "price" : "depTime"; select.appendChild(o); });
    select.addEventListener("change",(e)=>{ currentSortKey=e.target.value; if(typeof onChange==="function") onChange(currentSortKey); });
    host.innerHTML=""; host.appendChild(wrap); wrap.append(label, select);
  }
}

// ====== RENDERING ======
function sortFlights(flights,key){
  const copy=[...flights];
  if(key==="depTime") copy.sort((a,b)=> new Date(a.departureTime||a.departure||0) - new Date(b.departureTime||b.departure||0));
  else copy.sort((a,b)=> (a.price??Infinity) - (b.price??Infinity));
  return copy;
}

function renderFlightList(container, flights, sideLabel){
  container.innerHTML="";
  if(!flights || flights.length===0){
    const empty = el("div","",`No ${sideLabel} flights found.`); Object.assign(empty.style,{padding:"8px",opacity:"0.8"}); container.appendChild(empty); return;
  }
  const list = el("div"); Object.assign(list.style,{display:"grid",gap:"10px"});
  flights.forEach(f=>{
    const card = el("div","flight-card"); Object.assign(card.style,{border:"1px solid #e6e6e6",borderRadius:"10px",padding:"10px",cursor:"pointer"});
    const airlineName = safeText(f.airlineName||f.carrierName||f.airline||f.carrier||"","—");
    const flightNo    = safeText(f.flightNumber||f.number||"","");
    const dep         = fmtTime(f.departureTime||f.departure);
    const arr         = fmtTime(f.arrivalTime||f.arrival);
    const stops       = (f.stops!==undefined&&f.stops!==null)?f.stops:(f.numberOfStops!==undefined?f.numberOfStops:(f.itineraries?.[0]?.segments?.length?(f.itineraries[0].segments.length-1):0));
    const price       = (typeof f.price==="number")?f.price:(parseFloat(f.price?.total||f.price?.base)||NaN);

    const title = el("div",""); title.innerHTML = `<strong>${airlineName}${flightNo ? " " + flightNo : ""}</strong>`;
    const times = el("div","",`${dep} → ${arr}`);
    const meta  = el("div","",`Stops: ${isNaN(stops)?"—":stops}`);
    const cost  = el("div","", isNaN(price) ? "" : `₹${Math.round(price).toLocaleString("en-IN")}`);
    [title,times,meta,cost].forEach(e=> e.style.margin="2px 0");

    card.append(title, times, meta, cost);
    card.addEventListener("click", ()=>openComparisonModal({airlineName,flightNo,dep,arr,price}));
    list.appendChild(card);
  });
  container.appendChild(list);
}

function openComparisonModal({ airlineName, flightNo, dep, arr, price }){
  const portals = ["MakeMyTrip","Goibibo","Cleartrip","Yatra","EaseMyTrip"];
  const rows = portals.map(p=>{
    const finalPrice = isNaN(price) ? "—" : `₹${(Math.round(price)+100).toLocaleString("en-IN")}`;
    return `<div style="display:flex;justify-content:space-between;gap:8px;border:1px solid #eee;border-radius:8px;padding:8px;">
      <div><strong>${p}</strong><div style="font-size:12px;opacity:0.8;">${airlineName}${flightNo?" "+flightNo:""} • ${dep} → ${arr}</div></div>
      <div style="font-weight:600;">${finalPrice}</div>
    </div>`;
  }).join("");
  const body = `<div style="display:grid;gap:8px;">${rows}<div style="font-size:12px;opacity:.75;">(Simulated pricing: Amadeus fare + ₹100 per portal)</div></div>`;
  showModal(body, "Compare prices across portals");
}

// ====== MAIN ======
document.addEventListener("DOMContentLoaded", ()=>{
  const fromInput=qs("#from"), toInput=qs("#to"), depInput=qs("#departureDate"), retInput=qs("#returnDate");
  const returnGroup=qs("#returnDateGroup"), paxInput=qs("#passengers"), classInput=qs("#travelClass");
  const searchBtn=qs("#searchBtn"), outboundContainer=qs("#outboundContainer"), returnContainer=qs("#returnContainer");

  // Payment selector
  const paymentTrigger = findPaymentTrigger();
  if(paymentTrigger){
    paymentTrigger.style.cursor="pointer";
    paymentTrigger.addEventListener("click", async (e)=>{
      e.preventDefault();
      // Prime cache early so first paint shows quickly
      loadPaymentMap().finally(()=> togglePaymentMenu(true, paymentTrigger));
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

  // Search
  async function doSearch(){
    const from=fromInput?.value?.trim(), to=toInput?.value?.trim(), date=depInput?.value;
    const trip=(qs('input[name="tripType"]:checked')?.value)||"one-way";
    const ret=retInput?.value||"";
    if(!from||!to||!date){ alert("Please fill From, To, and Departure Date."); return; }

    const payload = {
      from, to, departureDate: date,
      returnDate: (trip==="round-trip" ? ret : ""),
      passengers: (paxInput?.value ? Number(paxInput.value) : 1) || 1,
      travelClass: (classInput?.value || "ECONOMY")
      // selectedPayments available for future: [{type, bank}, ...]
    };

    outboundContainer.innerHTML = "Loading…";
    if(returnContainer) returnContainer.innerHTML = "";

    try{
      const res = await fetch(BACKEND_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      if(!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();

      let outbound = data?.outboundFlights || data?.flights || [];
      let returns  = data?.returnFlights  || [];

      renderSortControls((key)=>{
        const s1 = sortFlights(outbound, key);
        renderFlightList(outboundContainer, s1, "outbound");
        if(retInput?.value && returns?.length){
          const s2 = sortFlights(returns, key);
          renderFlightList(returnContainer, s2, "return");
        }
      });

      const s1 = sortFlights(outbound, "price");
      renderFlightList(outboundContainer, s1, "outbound");

      if(retInput?.value && returns?.length){
        const s2 = sortFlights(returns, "price");
        renderFlightList(returnContainer, s2, "return");
      } else if(returnContainer){
        returnContainer.innerHTML = "";
      }
    }catch(err){
      console.error("Search error:", err);
      outboundContainer.innerHTML = "<div style='color:#b00020;'>Failed to fetch flights. Please try again.</div>";
      if(returnContainer) returnContainer.innerHTML = "";
    }
  }

  if(searchBtn) searchBtn.addEventListener("click", doSearch);
});
