/* SkyDeal frontend — robust version with clear logs & visible errors */
const log = (...a) => console.log("[SkyDeal]", ...a);
const BASE_URL = (window.SKYDEAL_CONFIG && window.SKYDEAL_CONFIG.BASE_URL) || "https://skydeal-backend.onrender.com";

const els = {
  from:      null, to: null, depart: null, ret: null, pax: null, cabin: null,
  one: null, round: null,
  btnSearch: null, payBtn: null, payLabel: null,
  outList: null, retList: null,
  overlay: null, modal: null, tabs: null, lists: null, btnDone: null, btnClear: null,
  banner: null
};

let selectedPayments = []; // {bank, type}
let paymentOptions = null;

/* helpers */
function showBanner(msg, isError=true){
  els.banner.textContent = msg;
  els.banner.classList.remove("hidden");
  els.banner.style.background = isError ? "#b4232a" : "#2563eb";
  setTimeout(()=>els.banner.classList.add("hidden"), 6000);
}
function byId(id){ return document.getElementById(id); }
function fmtINR(n){ return "₹" + Number(n).toLocaleString("en-IN"); }
function airlineNameFromCarrierCode(code){
  const map = {
    "32213": "IndiGo",
    "32672": "Air India",
    "31826": "SpiceJet",
    "32103": "Vistara",
    "32377": "Akasa Air",
    "32845": "Air India Express"
  };
  return map[String(code).replace(/\D/g,"")] || "Airline";
}

function renderFlights(target, list){
  if(!list || list.length===0){
    target.classList.add("empty");
    target.innerHTML = "No flights";
    return;
  }
  target.classList.remove("empty");
  target.innerHTML = list.map(f=>{
    const price = fmtINR(f.price || f.basePrice || 0);
    const title = `${f.airlineName || airlineNameFromCarrierCode(f.carrierCode)} ${f.flightNumber||""}`.trim();
    const portalInfo = (f.portalPrices && f.portalPrices.length)
      ? `<div class="fc-note">▶ Portal prices (+₹250 markup)</div>` : "";
    return `
      <div class="flight-card">
        <div class="fc-title">${title}</div>
        <div class="fc-time">${f.departure} → ${f.arrival} • Stops: ${f.stops ?? 0}</div>
        <div class="fc-price">${price}</div>
        ${portalInfo}
      </div>
    `;
  }).join("");
}

function setBtnCount(){
  const count = selectedPayments.length;
  els.payLabel.textContent = count ? `Payment Methods (${count})` : "Select Payment Methods";
}

function showTab(key){
  els.tabs.forEach(btn=>btn.classList.toggle("pm-tab-active", btn.getAttribute("data-pm-tab")===key));
  els.lists.forEach(list=>{
    const active = list.getAttribute("data-pm-panel")===key;
    list.classList.toggle("hidden", !active);
  });
}

function closeModal(){ els.overlay.classList.add("hidden"); els.modal.classList.add("hidden"); }
function openModal(){
  els.overlay.classList.remove("hidden");
  els.modal.classList.remove("hidden");
  // default to first tab
  showTab("creditCard");
}

function renderPaymentLists(){
  const kinds = [
    { key:"CreditCard",  el: byId("pm-list-credit"),      type:"credit" },
    { key:"DebitCard",   el: byId("pm-list-debit"),       type:"debit" },
    { key:"Wallet",      el: byId("pm-list-wallet"),      type:"wallet" },
    { key:"UPI",         el: byId("pm-list-upi"),         type:"upi" },
    { key:"NetBanking",  el: byId("pm-list-netbanking"),  type:"netbanking" },
    { key:"EMI",         el: byId("pm-list-emi"),         type:"emi" }
  ];
  kinds.forEach(({key,el,type})=>{
    const items = (paymentOptions && paymentOptions[key]) || [];
    if(!items || items.length===0){
      el.innerHTML = `<div class="pm-empty">No options available.</div>`;
      return;
    }
    el.innerHTML = items.map(name=>{
      const id = `${type}-${name}`.toLowerCase().replace(/\s+/g,'-');
      const checked = selectedPayments.some(p=>p.bank===name && p.type===type) ? 'checked' : '';
      return `
        <li class="pm-item">
          <input type="checkbox" id="${id}" data-bank="${name}" data-type="${type}" ${checked}/>
          <label for="${id}">${name}</label>
        </li>`;
    }).join("");
    // bind change
    el.querySelectorAll("input[type=checkbox]").forEach(chk=>{
      chk.addEventListener("change", e=>{
        const bank = e.target.getAttribute("data-bank");
        const type = e.target.getAttribute("data-type");
        if(e.target.checked){
          selectedPayments.push({bank,type});
        }else{
          selectedPayments = selectedPayments.filter(p=>!(p.bank===bank && p.type===type));
        }
        setBtnCount();
      });
    });
  });
}

async function fetchJSON(path, bodyObj){
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), 20000);
  const opt = bodyObj ? {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(bodyObj),
    signal: controller.signal
  } : { method:"GET", signal: controller.signal };
  try{
    const res = await fetch(url, opt);
    clearTimeout(t);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }catch(e){
    clearTimeout(t);
    throw e;
  }
}

async function loadPaymentOptions(){
  log("Loading payment options from", BASE_URL);
  try{
    const data = await fetchJSON("/payment-options");
    log("payment-options", data);
    paymentOptions = data.options || data; // handle {options:{...}} or plain
    renderPaymentLists();
  }catch(err){
    log("payment-options ERROR", err);
    showBanner("Could not load payment methods (check backend /payment-options).");
    paymentOptions = {CreditCard:[], DebitCard:[], Wallet:[], UPI:[], NetBanking:[], EMI:[]};
    renderPaymentLists();
  }
}

async function doSearch(){
  const from = els.from.value.trim().toUpperCase();
  const to   = els.to.value.trim().toUpperCase();
  const departureDate = els.depart.value;
  const returnDate    = els.round.checked ? els.ret.value : "";
  const passengers    = Number(els.pax.value||1);
  const travelClass   = els.cabin.value;
  const tripType      = els.round.checked ? "round-trip" : "one-way";

  if(!from || !to || !departureDate){
    showBanner("Please fill From, To, and Departure date.");
    return;
  }
  if(tripType==="round-trip" && !returnDate){
    showBanner("Please select a Return date (Round Trip).");
    return;
  }

  const payload = { from, to, departureDate, returnDate, passengers, travelClass, tripType, paymentMethods: selectedPayments };
  log("search payload", payload);

  els.btnSearch.disabled = true;
  try{
    const resp = await fetchJSON("/search", payload);
    log("search response", resp);
    els.outList && renderFlights(els.outList, resp.outboundFlights || []);
    els.retList && renderFlights(els.retList, resp.returnFlights   || []);
    if((resp.outboundFlights||[]).length===0 && (resp.returnFlights||[]).length===0){
      const reason = (resp.meta && resp.meta.reason) || "no results";
      showBanner(`No flights found (${reason})`, false);
    }
  }catch(err){
    log("search ERROR", err);
    showBanner("Search failed. Check backend /search logs.");
  }finally{
    els.btnSearch.disabled = false;
  }
}

/* Init after DOM is ready */
document.addEventListener("DOMContentLoaded", ()=>{
  // map elements
  els.from  = byId("fromInput");
  els.to    = byId("toInput");
  els.depart= byId("departDate");
  els.ret   = byId("returnDate");
  els.pax   = byId("paxSelect");
  els.cabin = byId("cabinSelect");
  els.one   = byId("tripOneWay");
  els.round = byId("tripRound");
  els.btnSearch = byId("searchBtn");
  els.payBtn   = byId("paymentSelectBtn");
  els.payLabel = byId("paymentSelectBtnLabel");
  els.outList  = byId("outboundList");
  els.retList  = byId("returnList");
  els.overlay  = byId("paymentOverlay");
  els.modal    = byId("paymentModal");
  els.btnDone  = byId("pmDoneBtn");
  els.btnClear = byId("pmClearBtn");
  els.tabs     = Array.from(document.querySelectorAll(".pm-tab"));
  els.lists    = Array.from(document.querySelectorAll(".pm-panel"));
  els.banner   = byId("banner");

  // bind
  els.payBtn.addEventListener("click", openModal);
  els.overlay.addEventListener("click", closeModal);
  els.btnDone.addEventListener("click", ()=>{ setBtnCount(); closeModal(); });
  els.btnClear.addEventListener("click", ()=>{
    selectedPayments = [];
    setBtnCount();
    renderPaymentLists();
  });
  els.tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const key = btn.getAttribute("data-pm-tab");
      showTab(key);
    });
  });
  els.one.addEventListener("change", ()=>{
    if(els.one.checked){ els.ret.closest(".field").style.opacity=.45; }
  });
  els.round.addEventListener("change", ()=>{
    if(els.round.checked){ els.ret.closest(".field").style.opacity=1; }
  });
  els.btnSearch.addEventListener("click", doSearch);

  // defaults
  setBtnCount();
  if(els.one.checked) els.ret.closest(".field").style.opacity=.45;

  // kick off
  loadPaymentOptions();
  log("BOOT ok. BASE_URL:", BASE_URL);
});
