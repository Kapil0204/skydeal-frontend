/******************************************************
 * SkyDeal Frontend — robust, ID-agnostic version
 * - Auto-detects form fields (from/to/dates/cabin/pax)
 * - Validates before calling backend
 * - Builds its own Payment Methods UI (button + modal)
 * - Works with backend:
 *     GET  /api/payment-methods
 *     POST /search
 ******************************************************/

const BACKEND = "https://skydeal-backend.onrender.com";

/* ---------------- Small DOM helpers ---------------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = (s='') => s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

/* ---------------- Detect UI containers -------------- */
const header = (() => {
  // Try to find the top search bar wrapper by proximity to title
  const h1 = $$("h1,h2").find(el => /SkyDeal/i.test(el.textContent));
  if (h1) {
    // likely parent contains the search form
    let p = h1.parentElement;
    for (let i=0;i<4 && p;i++) {
      const inputs = $$("input,select,button", p);
      if (inputs.length >= 4) return p;
      p = p.parentElement;
    }
  }
  // fallback: widest container with inputs near top
  const candidates = $$("div,section").filter(el => $$("input,select,button", el).length >= 4);
  return candidates[0] || document.body;
})();

/* -------------- Add Payment button holder ----------- */
const buttonBar = document.createElement("div");
buttonBar.style.display = "flex";
buttonBar.style.gap = "12px";
buttonBar.style.alignItems = "center";
buttonBar.style.marginTop = "10px";
header.appendChild(buttonBar);

/* ----------------- Results containers --------------- */
const outboundBox = document.querySelector("#outboundFlights") || createPanel("Outbound Flights");
const inboundBox  = document.querySelector("#returnFlights")   || createPanel("Return Flights");

function createPanel(title) {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "20px";
  wrap.innerHTML = `
    <div class="panel" style="background:#1b2430;border-radius:16px;padding:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="color:#e5edf5;font-weight:600">${esc(title)}</div>
        <select class="sortSel" style="background:#111826;color:#cbd5e1;border-radius:8px;padding:6px 8px;border:1px solid #2a3340">
          <option value="priceAsc">Sort: Price (asc)</option>
          <option value="priceDesc">Sort: Price (desc)</option>
          <option value="timeAsc">Sort: Time (asc)</option>
          <option value="timeDesc">Sort: Time (desc)</option>
        </select>
      </div>
      <div class="list" style="min-height:160px;border-radius:12px;background:#0f1722;display:flex;align-items:center;justify-content:center;color:#93a4b8;">
        No flights
      </div>
    </div>
  `;
  header.parentElement.appendChild(wrap);
  return wrap.querySelector(".panel");
}

/* -------------- “Search” button (existing or ours) -- */
const searchBtn = findSearchButton() || (() => {
  const btn = document.createElement("button");
  btn.textContent = "Search";
  btn.style.background = "#4a86ff";
  btn.style.color = "#fff";
  btn.style.border = "0";
  btn.style.padding = "10px 16px";
  btn.style.borderRadius = "10px";
  btn.style.fontWeight = "600";
  buttonBar.appendChild(btn);
  return btn;
})();

searchBtn.addEventListener("click", onSearch);

/* -------------- Payment Methods button + modal ------ */
const pmBtn = document.createElement("button");
pmBtn.textContent = "Select Payment Methods";
pmBtn.style.background = "#273142";
pmBtn.style.color = "#d3e1f0";
pmBtn.style.border = "1px solid #2f3a4e";
pmBtn.style.padding = "10px 16px";
pmBtn.style.borderRadius = "10px";
pmBtn.style.fontWeight = "600";
buttonBar.appendChild(pmBtn);

// Modal
const pmModal = document.createElement("div");
pmModal.style.position = "fixed";
pmModal.style.inset = "0";
pmModal.style.background = "rgba(0,0,0,0.45)";
pmModal.style.display = "none";
pmModal.style.zIndex = "9999";
pmModal.innerHTML = `
  <div style="max-width:780px;margin:80px auto;background:#101826;border-radius:16px;padding:16px;border:1px solid #2a3446;">
    <div style="display:flex;gap:8px;flex-wrap:wrap" id="pmTabs"></div>
    <div id="pmOptions" style="margin-top:12px;min-height:120px;border-top:1px solid #1e293b;padding-top:12px;color:#cbd5e1;"></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
      <button id="pmClear" style="background:#223046;border:1px solid #32425a;color:#c9d7eb;border-radius:10px;padding:8px 14px;">Clear</button>
      <button id="pmDone"  style="background:#4a86ff;border:0;color:#fff;border-radius:10px;padding:8px 14px;font-weight:600;">Done</button>
    </div>
  </div>
`;
document.body.appendChild(pmModal);

pmBtn.addEventListener("click", async () => {
  if (!paymentDataLoaded) await loadPaymentMethods();
  pmModal.style.display = "block";
});
pmModal.addEventListener("click", (e)=> { if (e.target === pmModal) pmModal.style.display = "none"; });
$("#pmDone", pmModal).addEventListener("click", ()=> pmModal.style.display = "none");
$("#pmClear", pmModal).addEventListener("click", ()=>{
  for (const k in selectedPayments) selectedPayments[k].clear();
  renderPMOptions(activePMTab);
  refreshPMLabel();
});

/* ---------------- Payment data state ---------------- */
let paymentDataLoaded = false;
const paymentBuckets = { creditCard:[], debitCard:[], wallet:[], upi:[], netBanking:[], emi:[] };
const selectedPayments = { creditCard:new Set(), debitCard:new Set(), wallet:new Set(), upi:new Set(), netBanking:new Set(), emi:new Set() };
let activePMTab = "creditCard";

async function loadPaymentMethods(){
  try{
    const r = await fetch(`${BACKEND}/api/payment-methods`, { cache: "no-store" });
    const j = await r.json();
    for(const k of Object.keys(paymentBuckets)){
      paymentBuckets[k] = Array.isArray(j[k]) ? j[k] : [];
    }
  }catch(e){
    console.error("payment-methods error", e);
    for(const k of Object.keys(paymentBuckets)) paymentBuckets[k] = [];
  }
  buildPMTabs();
  renderPMOptions(activePMTab);
  paymentDataLoaded = true;
}

function buildPMTabs(){
  const tabs = $("#pmTabs", pmModal);
  const groups = [
    {k:"creditCard",  label:"Credit Cards"},
    {k:"debitCard",   label:"Debit Cards"},
    {k:"wallet",      label:"Wallets"},
    {k:"upi",         label:"UPI"},
    {k:"netBanking",  label:"NetBanking"},
    {k:"emi",         label:"EMI"},
  ];
  tabs.innerHTML = groups.map(g => `
    <button data-k="${g.k}" class="pm-tab" style="
      background:${g.k===activePMTab ? "#223046" : "#152035"};
      border:1px solid #2f3a4e;color:#c9d7eb;border-radius:10px;padding:8px 12px;font-weight:600;
    ">${esc(g.label)}</button>
  `).join("");
  tabs.onclick = (e)=>{
    const btn = e.target.closest("button[data-k]");
    if (!btn) return;
    activePMTab = btn.dataset.k;
    buildPMTabs();
    renderPMOptions(activePMTab);
  };
}

function renderPMOptions(k){
  const host = $("#pmOptions", pmModal);
  const items = paymentBuckets[k] || [];
  if (!items.length) {
    host.innerHTML = `<div style="color:#94a3b8">No options</div>`;
    return;
  }
  host.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
      ${items.map(name => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#0b1220;border:1px solid #223046;border-radius:10px;">
          <input type="checkbox" data-k="${k}" data-name="${esc(name)}" ${selectedPayments[k].has(name) ? "checked":""}/>
          <span>${esc(name)}</span>
        </label>
      `).join("")}
    </div>
  `;
  host.onchange = (e)=>{
    const cb = e.target.closest('input[type="checkbox"][data-k]');
    if (!cb) return;
    const g = cb.dataset.k, n = cb.dataset.name;
    if (cb.checked) selectedPayments[g].add(n); else selectedPayments[g].delete(n);
    refreshPMLabel();
  };
  refreshPMLabel();
}

function refreshPMLabel(){
  let c = 0; for(const k in selectedPayments) c += selectedPayments[k].size;
  pmBtn.textContent = c ? `${c} selected` : "Select Payment Methods";
}

/* --------------- Flights state + render ------------- */
const flights = { outbound:[], inbound:[] };
const outList = $(".list", outboundBox);
const inList  = $(".list", inboundBox);
const outSort = $(".sortSel", outboundBox);
const inSort  = $(".sortSel", inboundBox);

outSort.addEventListener("change", ()=> renderFlights());
inSort.addEventListener("change", ()=> renderFlights());

function renderFlights(){
  const sortOne = (arr, key) => {
    const k = key || "priceAsc";
    const copy = [...arr];
    if (k.startsWith("price")) {
      copy.sort((a,b)=>(a.price||0)-(b.price||0));
      if (k.endsWith("Desc")) copy.reverse();
    } else {
      const toMin = (t)=> {
        const m = (t||"").match(/^(\d{1,2}):(\d{2})$/);
        return m ? (parseInt(m[1],10)*60+parseInt(m[2],10)) : 0;
      };
      copy.sort((a,b)=> toMin(a.departureTime)-toMin(b.departureTime));
      if (k.endsWith("Desc")) copy.reverse();
    }
    return copy;
  };

  const draw = (host, list) => {
    if (!list.length) { host.innerHTML = `<div style="color:#94a3b8">No flights</div>`; return; }
    host.innerHTML = list.map(f => `
      <div class="flight-card" style="cursor:pointer;border:1px solid #223046;background:#0b1220;border-radius:12px;padding:10px;margin:8px 10px;">
        <div style="display:flex;justify-content:space-between;color:#e5edf5;">
          <div>${esc(f.airline || "Flight")} <span style="color:#94a3b8">${esc(f.flightNumber||"")}</span></div>
          <div style="font-weight:700">${priceINR(f.price)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;color:#9fb0c4;margin-top:4px;">
          <div>${esc(f.departureTime||"")} → ${esc(f.arrivalTime||"")}</div>
          <div>${Number.isFinite(f.stops)? `${f.stops} stop${f.stops===1?"":"s"}`:""}</div>
        </div>
      </div>
    `).join("");
    $$(".flight-card", host).forEach(card=>{
      card.addEventListener("click", ()=> alert("Portal pricing popup — same flight on 5 OTAs (base + ₹100)."));
    });
  };

  draw(outList, sortOne(flights.outbound, outSort.value));
  draw(inList,  sortOne(flights.inbound,  inSort.value));
}

function priceINR(n){ if(!Number.isFinite(n)) return ""; return "₹"+Math.round(n).toLocaleString("en-IN"); }

/* --------------- Search: robust input read ---------- */
async function onSearch(){
  const vals = readFormValues();        // auto-detect form fields
  if (!vals.ok) { toast(vals.msg || "Please fill From, To and dates correctly."); return; }

  // optimistic UI
  outList.innerHTML = inList.innerHTML = `<div style="color:#94a3b8">Loading flights…</div>`;

  try {
    const r = await fetch(`${BACKEND}/search`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(vals.payload)
    });
    if (!r.ok) throw new Error("HTTP "+r.status);
    const j = await r.json();
    flights.outbound = Array.isArray(j.outbound)? j.outbound : [];
    flights.inbound  = Array.isArray(j.inbound)?  j.inbound  : [];
    renderFlights();
  } catch (e) {
    console.error("search failed", e);
    outList.innerHTML = inList.innerHTML = `<div style="color:#94a3b8">No flights (error fetching).</div>`;
  }
}

/* --------------- Search button finder --------------- */
function findSearchButton(){
  // prefer explicit “Search” button in header area
  const btns = $$("button", header).filter(b=>/search/i.test(b.textContent));
  return btns[0] || null;
}

/* --------------- Auto-detect form fields ------------- */
function readFormValues(){
  // 1) Collect candidates
  const inputs  = $$("input", header);
  const selects = $$("select", header);

  // From/To: prefer inputs with 3-letter values (IATA) or placeholders
  const isIATA = v => /^[A-Za-z]{3}$/.test((v||"").trim());
  let from = (inputs.find(i => isIATA(i.value)) || inputs.find(i => isIATA(i.placeholder)))?.value?.trim().toUpperCase() ||
             (inputs.find(i => /from/i.test(i.name||i.id||""))?.value||"").toUpperCase();
  let to   = (inputs.slice().reverse().find(i => isIATA(i.value)) || inputs.slice().reverse().find(i => isIATA(i.placeholder)))?.value?.trim().toUpperCase() ||
             (inputs.find(i => /to/i.test(i.name||i.id||""))?.value||"").toUpperCase();

  // Dates: dd/mm/yyyy → yyyy-mm-dd
  const isDmy = v => /^\d{2}\/\d{2}\/\d{4}$/.test(v||"");
  const toISO = s => isDmy(s) ? `${s.slice(6,10)}-${s.slice(3,5)}-${s.slice(0,2)}` : s;

  const dateFields = inputs.filter(i => isDmy(i.value) || /date/i.test(i.type||i.id||i.name||""));
  let dep = dateFields[0]?.value || "";
  let ret = dateFields[1]?.value || "";

  // If not found, try any text inputs with dmy-looking value
  if (!isDmy(dep)) dep = (inputs.find(i => isDmy(i.value))||{}).value || dep;
  if (!isDmy(ret)) ret = (inputs.filter(i => isDmy(i.value))[1]||{}).value || ret;

  const departureDate = toISO(dep);
  const returnDate    = toISO(ret);

  // Passengers: pick first select with numeric options, else default 1
  let passengers = parseInt((selects.find(s => /\d/.test(s.value))||{}).value || "1", 10);
  if (!Number.isFinite(passengers) || passengers<1) passengers = 1;

  // Cabin: pick select that contains Economy/Business/First/Premium
  const cabinSel = selects.find(s=>{
    const txt = (s.textContent||"") + " " + (s.value||"");
    return /(economy|business|first|premium)/i.test(txt);
  });
  let travelClass = (cabinSel?.value || "Economy").trim();

  // TripType: if we can detect a “One Way” radio, use it; else infer by returnDate presence
  let tripType = "round-trip";
  const radios = $$('input[type="radio"]', header);
  const one = radios.find(r => /one.?way/i.test(r.id||r.name||"")) || radios.find(r=>/one.?way/i.test(r.nextElementSibling?.textContent||""));
  if (one && one.checked) tripType = "one-way";
  if (!isDmy(ret)) tripType = "one-way";

  // Validate critical fields
  const missing = [];
  if (!isIATA(from)) missing.push("From (IATA)");
  if (!isIATA(to)) missing.push("To (IATA)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) missing.push("Departure date");
  if (tripType==="round-trip" && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) missing.push("Return date");

  if (missing.length) return { ok:false, msg:`Please fill: ${missing.join(", ")}` };

  return {
    ok: true,
    payload: { from, to, departureDate, returnDate, passengers, travelClass, tripType }
  };
}

/* --------------- Toast helper ----------------------- */
function toast(msg){
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.position = "fixed";
  t.style.left = "50%";
  t.style.top = "24px";
  t.style.transform = "translateX(-50%)";
  t.style.background = "#1f2a3c";
  t.style.color = "#e6eef7";
  t.style.padding = "10px 16px";
  t.style.border = "1px solid #2f3a4e";
  t.style.borderRadius = "10px";
  t.style.zIndex = "99999";
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 2300);
}
