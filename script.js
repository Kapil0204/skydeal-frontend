/* CONFIG */
const API_BASE = "https://skydeal-backend.onrender.com";

/* STATE */
const STATE = {
  options: { "Credit Card":[], "Debit Card":[], "Net Banking":[], "UPI":[], "Wallet":[] },
  currentType: "Credit Card",
  picked: new Set(), // stores `${type}::${bank}`
};

/* HELPERS */
const $ = (sel,root=document)=>root.querySelector(sel);
const $$ = (sel,root=document)=>[...root.querySelectorAll(sel)];
const keyOf = (type, bank)=>`${type}::${bank}`;
const parseKey = k => { const i=k.indexOf("::"); return [k.slice(0,i), k.slice(i+2)]; };
const byText = (a,b)=>a.localeCompare(b);

/* ELEMENTS */
const els = {
  from: $("#from"),
  to: $("#to"),
  depart: $("#depart"),
  ret: $("#return"),
  pax: $("#passengers"),
  cabin: $("#cabin"),
  one: $("#tripOne"),
  round: $("#tripRound"),

  search: $("#searchBtn"),
  out: $("#outboundWrap"),
  retWrap: $("#returnWrap"),

  payBtn: $("#openPaymentModal"),
  payModal: $("#paymentModal"),
  closePay: $("#closePayment"),
  tabs: $("#paymentTabs"),
  list: $("#paymentList"),
  empty: $("#noOptions"),
  clear: $("#payClear"),
  done: $("#payDone"),
  selCount: $("#selectedCount"),
};

/* INIT — sensible defaults */
(() => {
  // simple dd/mm/yyyy -> yyyy-mm-dd helper not needed; we use date inputs
  const today = new Date();
  const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate()+3);
  const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate()+13);
  const toISO = d => d.toISOString().slice(0,10);

  els.from.value = els.from.value || "BOM";
  els.to.value = els.to.value || "DEL";
  els.depart.value = els.depart.value || toISO(d1);
  els.ret.value = els.ret.value || toISO(d2);
})();

/* PAYMENT OPTIONS */
async function fetchPaymentOptions(){
  try{
    const r = await fetch(`${API_BASE}/payment-options`, {credentials:"omit"});
    const data = await r.json();
    // normalize & dedupe banks
    const base = { "Credit Card":[], "Debit Card":[], "Net Banking":[], "UPI":[], "Wallet":[] };
    const opts = data?.options || {};
    for(const type of Object.keys(base)){
      const banks = (opts[type]||[]).map(b => String(b).trim()).filter(Boolean);
      const set = new Set(banks.map(x => x.replace(/\s+/g," ").trim()));
      base[type] = [...set].sort(byText);
    }
    STATE.options = base;
    renderBankList();
    renderSelectedCount();
  }catch(err){
    console.error("[payment-options] failed:", err);
    // show empty state but keep UI responsive
    STATE.options = { "Credit Card":[], "Debit Card":[], "Net Banking":[], "UPI":[], "Wallet":[] };
    renderBankList();
  }
}

function renderBankList(){
  const banks = STATE.options[STATE.currentType] || [];
  els.list.innerHTML = "";
  if(!banks.length){
    els.empty.style.display = "block";
    return;
  }
  els.empty.style.display = "none";
  const frag = document.createDocumentFragment();
  banks.forEach(bank => {
    const li = document.createElement("li");
    li.className = "bank-item";
    const id = `cb-${STATE.currentType}-${bank}`.replace(/\s+/g,"_");
    const k = keyOf(STATE.currentType, bank);
    li.innerHTML = `
      <input id="${id}" type="checkbox" ${STATE.picked.has(k) ? "checked":""}/>
      <label for="${id}">${bank}</label>
    `;
    li.querySelector("input").addEventListener("change", (e)=>{
      if(e.target.checked) STATE.picked.add(k);
      else STATE.picked.delete(k);
      renderSelectedCount();
    });
    frag.appendChild(li);
  });
  els.list.appendChild(frag);
}

function renderSelectedCount(){
  els.selCount.textContent = String(STATE.picked.size);
}

/* MODAL BEHAVIOR */
els.payBtn.addEventListener("click", ()=>{
  els.payModal.style.display = "grid";
  els.payModal.removeAttribute("aria-hidden");
});
els.closePay.addEventListener("click", ()=>{
  els.payModal.style.display = "none";
  els.payModal.setAttribute("aria-hidden","true");
});
els.done.addEventListener("click", ()=>{
  els.payModal.style.display = "none";
  els.payModal.setAttribute("aria-hidden","true");
});
els.clear.addEventListener("click", ()=>{
  STATE.picked.clear();
  renderBankList();
  renderSelectedCount();
});
els.tabs.addEventListener("click", (e)=>{
  const btn = e.target.closest(".tab");
  if(!btn) return;
  $$(".tab", els.tabs).forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  STATE.currentType = btn.dataset.type;
  renderBankList();
});

/* SEARCH */
els.search.addEventListener("click", doSearch);

function buildPaymentFilters(){
  const arr = [];
  for(const k of STATE.picked){
    const [type, bank] = parseKey(k);
    arr.push({ type, bank });
  }
  return arr;
}

function emptyCards(){
  els.out.innerHTML = `<div class="muted">No flights found for your search.</div>`;
  els.retWrap.innerHTML = `<div class="muted">No flights found for your search.</div>`;
}

function renderFlights(container, flights){
  if(!flights?.length){ container.innerHTML = `<div class="muted">No flights found for your search.</div>`; return; }
  const frag = document.createDocumentFragment();
  flights.forEach(f=>{
    const card = document.createElement("div");
    card.className = "card";
    const best = f.bestDeal && f.bestDeal.portal ? `
      <div class="best">Best: ₹${Number(f.bestDeal.finalPrice).toLocaleString("en-IN")} on ${f.bestDeal.portal}</div>
      <div class="note">${f.bestDeal.note ? f.bestDeal.note : "Best price after applicable offers (if any)"}</div>
    ` : `<div class="note">No eligible offer</div>`;
    card.innerHTML = `
      <div>
        <div class="air">${f.airlineName || f.airline || "Flight"}</div>
        <div class="times">${f.departure || f.departTime || ""} — ${f.arrival || f.arriveTime || ""} • ${f.flightNumber || ""}</div>
        ${best}
      </div>
      <div class="pill">₹${Number(f.price || f.basePrice || 0).toLocaleString("en-IN")}</div>
    `;
    frag.appendChild(card);
  });
  container.innerHTML = "";
  container.appendChild(frag);
}

async function doSearch(){
  const payload = {
    from: els.from.value.trim().toUpperCase(),
    to: els.to.value.trim().toUpperCase(),
    departureDate: els.depart.value,
    returnDate: els.ret.value,
    passengers: Number(els.pax.value || 1),
    travelClass: els.cabin.value || "economy",
    tripType: els.round.checked ? "round-trip" : "one-way",
    paymentFilters: buildPaymentFilters()
  };

  // Basic guard: if one-way, ignore returnDate
  if(payload.tripType === "one-way") payload.returnDate = "";

  emptyCards();

  try{
    const r = await fetch(`${API_BASE}/search`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json();

    // Defensive: only render when lists exist
    renderFlights(els.out, data?.outboundFlights || []);
    renderFlights(els.retWrap, payload.tripType === "round-trip" ? (data?.returnFlights || []) : []);

    // Console meta for quick diagnosis
    console.log("[SkyDeal] /search meta -->", data?.meta || data);
  }catch(err){
    console.error("Search failed", err);
    emptyCards();
  }
}

/* START */
fetchPaymentOptions();
