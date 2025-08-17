// ====== CONFIG ======
const BACKEND_URL = "https://skydeal-backend.onrender.com/search"; // Your Render backend /search

// EXPECTED HTML IDs / names (match these if possible):
// Inputs: #from, #to, #departureDate, #returnDate, #passengers, #travelClass
// Trip type radios: name="tripType" values: "one-way" | "round-trip"
// Return date wrapper: #returnDateGroup
// Button: #searchBtn
// Results: #outboundContainer, #returnContainer
// Filters host: #filtersContainer

// ====== UTIL ======
const qs  = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];
function fmtTime(isoOrHM){ if(!isoOrHM)return""; if(/^\d{2}:\d{2}$/.test(isoOrHM))return isoOrHM; const d=new Date(isoOrHM); if(isNaN(d))return""; const hh=String(d.getHours()).padStart(2,"0"); const mm=String(d.getMinutes()).padStart(2,"0"); return `${hh}:${mm}`;}
function safeText(v,f=""){ if(v===null||v===undefined)return f; if(typeof v==="string"&&v.trim()==="")return f; return v;}
function createEl(tag, className, text){ const el=document.createElement(tag); if(className)el.className=className; if(text!==undefined)el.textContent=text; return el;}

// ====== PAYMENT METHODS POPOVER ======
const PAYMENT_OPTIONS = ["ICICI Bank","HDFC Bank","Axis Bank","SBI","Kotak"];
let selectedPaymentMethods = [];

function findPaymentTrigger(){
  // Tries #paymentBtn first; falls back to any button whose text matches
  return qs("#paymentBtn") ||
         qsa("button, [role='button']").find(b => /select\s*payment\s*methods/i.test(b.textContent || ""));
}

function buildPaymentMenu(trigger){
  const menu = document.createElement("div");
  Object.assign(menu.style,{
    position:"absolute", background:"#fff", border:"1px solid #e5e7eb", borderRadius:"10px",
    boxShadow:"0 10px 30px rgba(0,0,0,.12)", padding:"10px", zIndex:99999, minWidth:"220px"
  });
  menu.id = "skydealPaymentMenu";

  const title = createEl("div","", "Select Payment Methods");
  Object.assign(title.style,{fontWeight:"600", marginBottom:"6px"});
  menu.appendChild(title);

  PAYMENT_OPTIONS.forEach(opt=>{
    const row = createEl("label");
    Object.assign(row.style,{display:"flex",gap:"8px",alignItems:"center",padding:"4px 2px",cursor:"pointer"});
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = opt;
    cb.checked = selectedPaymentMethods.includes(opt);
    cb.addEventListener("change",()=>{
      if(cb.checked && !selectedPaymentMethods.includes(opt)) selectedPaymentMethods.push(opt);
      if(!cb.checked) selectedPaymentMethods = selectedPaymentMethods.filter(x=>x!==opt);
      updatePaymentButtonLabel(trigger);
    });
    const span = createEl("span","",opt);
    row.append(cb, span);
    menu.appendChild(row);
  });

  const done = createEl("button","", "Done");
  Object.assign(done.style,{marginTop:"8px",padding:"6px 10px",border:"1px solid #e5e7eb",borderRadius:"8px",cursor:"pointer",background:"#f8fafc"});
  done.addEventListener("click",()=>togglePaymentMenu(false, trigger));
  menu.appendChild(done);

  document.body.appendChild(menu);
  positionMenuBelow(trigger, menu);
  setTimeout(()=>{
    const outside = (e)=>{ if(!menu.contains(e.target) && e.target!==trigger) togglePaymentMenu(false, trigger); };
    const onEsc = (e)=>{ if(e.key==="Escape") togglePaymentMenu(false, trigger); };
    menu._outside = outside; menu._esc = onEsc;
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", onEsc);
  },0);
  return menu;
}

function positionMenuBelow(trigger, menu){
  const r = trigger.getBoundingClientRect();
  menu.style.left = `${Math.max(8, r.left + window.scrollX)}px`;
  menu.style.top  = `${r.bottom + 6 + window.scrollY}px`;
}

function togglePaymentMenu(show, trigger){
  let menu = qs("#skydealPaymentMenu");
  if(show){
    if(menu){ positionMenuBelow(trigger, menu); menu.style.display="block"; return; }
    menu = buildPaymentMenu(trigger);
  } else {
    if(menu){
      menu.style.display="none";
      document.removeEventListener("mousedown", menu._outside || (()=>{}));
      document.removeEventListener("keydown", menu._esc || (()=>{}));
      menu.remove();
    }
  }
}

function updatePaymentButtonLabel(trigger){
  if(!trigger) return;
  if(selectedPaymentMethods.length === 0){
    trigger.textContent = "Select Payment Methods";
  } else {
    trigger.textContent = `${selectedPaymentMethods.length} selected`;
  }
}

// ====== MODAL ======
let modalEl=null;
function ensureModal(){ if(modalEl) return modalEl; modalEl=document.createElement("div"); modalEl.id="skydealModal";
  Object.assign(modalEl.style,{position:"fixed",inset:"0",background:"rgba(0,0,0,0.35)",display:"none",alignItems:"center",justifyContent:"center",zIndex:"9999"});
  const content=document.createElement("div"); content.id="skydealModalContent";
  Object.assign(content.style,{background:"#fff",borderRadius:"12px",padding:"16px",maxWidth:"560px",width:"92%",boxShadow:"0 10px 30px rgba(0,0,0,0.15)"});
  const header=createEl("div"); Object.assign(header.style,{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"});
  const title=createEl("h3","", "Price Comparison"); Object.assign(title.style,{margin:0,fontSize:"18px"});
  const closeBtn=createEl("button","", "×"); Object.assign(closeBtn.style,{fontSize:"20px",lineHeight:"20px",border:"none",background:"transparent",cursor:"pointer"}); closeBtn.addEventListener("click", hideModal);
  header.append(title, closeBtn);
  const body=createEl("div"); body.id="skydealModalBody"; Object.assign(body.style,{display:"grid",gap:"8px"});
  content.append(header, body); modalEl.appendChild(content);
  modalEl.addEventListener("click",(e)=>{ if(e.target===modalEl) hideModal(); });
  document.body.appendChild(modalEl); return modalEl; }
function showModal(htmlBody, heading="Price Comparison"){ ensureModal(); qs("#skydealModalBody").innerHTML=htmlBody; qs("#skydealModalContent h3").textContent=heading; modalEl.style.display="flex";}
function hideModal(){ if(modalEl) modalEl.style.display="none"; }

// ====== SORT CONTROLS ======
let currentSortKey="price";
function renderSortControls(onChange){
  const host=qs("#filtersContainer"); if(!host) return;
  let wrap=qs("#skydealSortWrap");
  if(!wrap){
    wrap=createEl("div"); wrap.id="skydealSortWrap";
    Object.assign(wrap.style,{display:"flex",gap:"8px",alignItems:"center",margin:"8px 0 12px"});
    const label=createEl("span","", "Sort by:");
    const select=document.createElement("select"); select.id="skydealSortSelect";
    ["Price (asc)","Departure time (asc)"].forEach((opt,i)=>{ const o=createEl("option","",opt); o.value=i===0?"price":"depTime"; select.appendChild(o); });
    select.addEventListener("change",(e)=>{ currentSortKey=e.target.value; if(typeof onChange==="function") onChange(currentSortKey); });
    host.innerHTML=""; host.appendChild(wrap); wrap.append(label, select);
  }
}

// ====== RENDERING ======
function sortFlights(flights,key){
  const copy=[...flights];
  if(key==="depTime"){ copy.sort((a,b)=> new Date(a.departureTime||a.departure||0) - new Date(b.departureTime||b.departure||0)); }
  else { copy.sort((a,b)=> (a.price??Infinity) - (b.price??Infinity)); }
  return copy;
}

function renderFlightList(container, flights, sideLabel){
  container.innerHTML="";
  if(!flights || flights.length===0){
    const empty=createEl("div","",`No ${sideLabel} flights found.`); Object.assign(empty.style,{padding:"8px",opacity:"0.8"}); container.appendChild(empty); return;
  }
  const list=createEl("div"); Object.assign(list.style,{display:"grid",gap:"10px"});
  flights.forEach((f)=>{
    const card=createEl("div","flight-card"); Object.assign(card.style,{border:"1px solid #e6e6e6",borderRadius:"10px",padding:"10px",cursor:"pointer"});
    const airlineName=safeText(f.airlineName||f.carrierName||f.airline||f.carrier||"","—");
    const flightNo=safeText(f.flightNumber||f.number||"","");
    const dep=fmtTime(f.departureTime||f.departure);
    const arr=fmtTime(f.arrivalTime||f.arrival);
    const stops=(f.stops!==undefined&&f.stops!==null)?f.stops:(f.numberOfStops!==undefined?f.numberOfStops:(f.itineraries?.[0]?.segments?.length?(f.itineraries[0].segments.length-1):0));
    const price=(typeof f.price==="number")?f.price:(parseFloat(f.price?.total||f.price?.base)||NaN);
    const title=createEl("div",""); title.innerHTML=`<strong>${airlineName}${flightNo?" "+flightNo:""}</strong>`;
    const times=createEl("div","",`${dep} → ${arr}`);
    const meta=createEl("div","",`Stops: ${isNaN(stops)?"—":stops}`);
    const cost=createEl("div","", isNaN(price)?"":`₹${Math.round(price).toLocaleString("en-IN")}`);
    [title,times,meta,cost].forEach(el=>{ el.style.margin="2px 0";});
    card.append(title,times,meta,cost);
    card.addEventListener("click",()=>openComparisonModal({airlineName,flightNo,dep,arr,price}));
    list.appendChild(card);
  });
  container.appendChild(list);
}

function openComparisonModal({airlineName,flightNo,dep,arr,price}){
  const portals=["MakeMyTrip","Goibibo","Cleartrip","Yatra","EaseMyTrip"];
  const rows=portals.map(p=>{
    const finalPrice=isNaN(price)?"—":`₹${(Math.round(price)+100).toLocaleString("en-IN")}`;
    return `<div style="display:flex;justify-content:space-between;gap:8px;border:1px solid #eee;border-radius:8px;padding:8px;">
      <div><strong>${p}</strong><div style="font-size:12px;opacity:0.8;">${airlineName}${flightNo?" "+flightNo:""} • ${dep} → ${arr}</div></div>
      <div style="font-weight:600;">${finalPrice}</div>
    </div>`;
  }).join("");
  const body=`<div style="display:grid;gap:8px;">${rows}<div style="font-size:12px;opacity:.75;">(Simulated pricing: Amadeus fare + ₹100 per portal)</div></div>`;
  showModal(body,"Compare prices across portals");
}

// ====== MAIN ======
document.addEventListener("DOMContentLoaded",()=>{
  const fromInput=qs("#from"), toInput=qs("#to"), depInput=qs("#departureDate"), retInput=qs("#returnDate");
  const returnGroup=qs("#returnDateGroup"), paxInput=qs("#passengers"), classInput=qs("#travelClass");
  const searchBtn=qs("#searchBtn"), outboundContainer=qs("#outboundContainer"), returnContainer=qs("#returnContainer");

  // Payment menu wiring
  const paymentTrigger = findPaymentTrigger();
  if(paymentTrigger){
    paymentTrigger.style.cursor="pointer";
    paymentTrigger.addEventListener("click",(e)=>{
      e.preventDefault();
      togglePaymentMenu(true, paymentTrigger);
    });
    updatePaymentButtonLabel(paymentTrigger);
  }

  // Trip type toggle
  const tripTypeRadios=qsa('input[name="tripType"]');
  function applyTripTypeUI(){
    const value=(qs('input[name="tripType"]:checked')?.value)||"one-way";
    if(value==="round-trip"){ if(returnGroup) returnGroup.style.display="block"; }
    else { if(returnGroup) returnGroup.style.display="none"; if(retInput) retInput.value=""; }
  }
  tripTypeRadios.forEach(r=>r.addEventListener("change", applyTripTypeUI));
  applyTripTypeUI();

  async function doSearch(){
    const from=fromInput?.value?.trim(), to=toInput?.value?.trim(), date=depInput?.value;
    const trip=(qs('input[name="tripType"]:checked')?.value)||"one-way";
    const ret=retInput?.value||"";
    if(!from||!to||!date){ alert("Please fill From, To, and Departure Date."); return; }

    const payload={
      from, to, departureDate:date,
      returnDate:(trip==="round-trip"?ret:""),
      passengers:(paxInput?.value?Number(paxInput.value):1)||1,
      travelClass:(classInput?.value||"ECONOMY")
      // NOTE: selectedPaymentMethods available here if you want to send later
    };

    outboundContainer.innerHTML="Loading…"; if(returnContainer) returnContainer.innerHTML="";
    try{
      const res=await fetch(BACKEND_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data=await res.json();
      let outbound=data?.outboundFlights||data?.flights||[];
      let returns=data?.returnFlights||[];

      renderSortControls((key)=>{
        const s1=sortFlights(outbound,key); renderFlightList(outboundContainer,s1,"outbound");
        if(retInput?.value && returns?.length){ const s2=sortFlights(returns,key); renderFlightList(returnContainer,s2,"return"); }
      });

      const s1=sortFlights(outbound,currentSortKey); renderFlightList(outboundContainer,s1,"outbound");
      if(retInput?.value && returns?.length){ const s2=sortFlights(returns,currentSortKey); renderFlightList(returnContainer,s2,"return"); }
      else if(returnContainer){ returnContainer.innerHTML=""; }
    }catch(err){
      console.error("Search error:", err);
      outboundContainer.innerHTML="<div style='color:#b00020;'>Failed to fetch flights. Please try again.</div>";
      if(returnContainer) returnContainer.innerHTML="";
    }
  }

  if(searchBtn) searchBtn.addEventListener("click", doSearch);
});
