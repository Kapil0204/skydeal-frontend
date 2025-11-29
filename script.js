/*******************************
 * SkyDeal Frontend – script.js
 * FlightAPI + EC2 Mongo (payment methods)
 *******************************/

/* ====== CONFIG: UPDATE ONLY THESE IF NEEDED ====== */
const BACKEND_BASE = "https://skydeal-backend.onrender.com";

/* Map to your existing DOM ids/classes once, below */
const SEL = {
  from:            "#fromInput",
  to:              "#toInput",
  depart:          "#departureDate",
  ret:             "#returnDate",
  pax:             "#passengers",
  cabin:           "#travelClass",
  oneWay:          "#oneWay",
  roundTrip:       "#roundTrip",
  searchBtn:       "#searchBtn",

  // results
  outboundWrap:    "#outboundList",
  returnWrap:      "#returnList",
  outboundSort:    "#outboundSort",
  returnSort:      "#returnSort",

  // payment modal trigger and UI
  pmOpenBtn:       "#paymentSelectBtn",
  pmModal:         "#paymentModal",
  pmTabs:          "#pmTabs",
  pmOptions:       "#pmOptions",
  pmDone:          "#pmDone",
  pmClear:         "#pmClear",
};

// If your HTML uses different ids, quickly alias them here without changing HTML.
// (These defaults try to match your previous builds.)
ensureAlias("#from", SEL.from);
ensureAlias("#to", SEL.to);
ensureAlias("#depDate", SEL.depart);
ensureAlias("#retDate", SEL.ret);
ensureAlias("#pax", SEL.pax);
ensureAlias("#cabin", SEL.cabin);
ensureAlias("#tripOneWay", SEL.oneWay);
ensureAlias("#tripRound", SEL.roundTrip);
ensureAlias("#search", SEL.searchBtn);
ensureAlias("#outboundFlights", SEL.outboundWrap);
ensureAlias("#returnFlights", SEL.returnWrap);
ensureAlias("#outSort", SEL.outboundSort);
ensureAlias("#inSort", SEL.returnSort);
ensureAlias("#pmBtn", SEL.pmOpenBtn);
ensureAlias("#pm", SEL.pmModal);
ensureAlias("#pmTabsWrap", SEL.pmTabs);
ensureAlias("#pmOpts", SEL.pmOptions);
ensureAlias("#pmOk", SEL.pmDone);
ensureAlias("#pmClr", SEL.pmClear);

/* ====== UTIL ====== */
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
function ensureAlias(existingSel, targetSel){
  const node = document.querySelector(existingSel);
  if (node && !document.querySelector(targetSel)) node.id = targetSel.replace("#","");
}
function fmtYMD(dmy) {
  // UI shows dd/mm/yyyy – convert to yyyy-mm-dd
  if (!dmy) return "";
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return dmy; // already ISO?
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function showMsg(container, text) {
  container.innerHTML = `<div class="text-slate-400 p-4">${text}</div>`;
}
function priceStr(n) {
  if (!Number.isFinite(n)) return "";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/* ====== STATE ====== */
const state = {
  paymentMethods: {
    creditCard: [],
    debitCard: [],
    wallet: [],
    upi: [],
    netBanking: [],
    emi: []
  },
  selectedPayments: {
    creditCard: new Set(),
    debitCard: new Set(),
    wallet: new Set(),
    upi: new Set(),
    netBanking: new Set(),
    emi: new Set()
  },
  flights: { outbound: [], inbound: [] }
};

/* ====== INIT ====== */
document.addEventListener("DOMContentLoaded", async () => {
  wireTripToggle();
  wireSorters();
  wireSearch();
  await loadPaymentMethods();       // fills modal options
  wirePaymentModal();               // open/close + selections
});

/* ====== PAYMENT METHODS ====== */
async function loadPaymentMethods() {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/payment-methods`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Defensive: normalize expected buckets even if backend returned empty
    const buckets = ["creditCard","debitCard","wallet","upi","netBanking","emi"];
    for (const b of buckets) state.paymentMethods[b] = Array.isArray(data[b]) ? data[b] : [];

    buildPaymentTabsAndOptions();
  } catch (err) {
    console.error("payment-methods fetch failed:", err);
    // Still render empty tabs so UI doesn’t look broken
    buildPaymentTabsAndOptions();
  }
}

function buildPaymentTabsAndOptions() {
  const tabsWrap = $(SEL.pmTabs);
  const optsWrap = $(SEL.pmOptions);
  if (!tabsWrap || !optsWrap) return;

  const groups = [
    { key: "creditCard",  label: "Credit Cards"  },
    { key: "debitCard",   label: "Debit Cards"   },
    { key: "wallet",      label: "Wallets"       },
    { key: "upi",         label: "UPI"           },
    { key: "netBanking",  label: "NetBanking"    },
    { key: "emi",         label: "EMI"           }
  ];

  tabsWrap.innerHTML = groups.map((g,i)=>`
    <button class="pm-tab ${i===0?"active":""}" data-pm="${g.key}">${g.label}</button>
  `).join("");

  tabsWrap.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-pm]");
    if (!btn) return;
    $all(".pm-tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    renderPMOptions(btn.dataset.pm);
  });

  // First tab
  renderPMOptions(groups[0].key);
}

function renderPMOptions(groupKey) {
  const optsWrap = $(SEL.pmOptions);
  const items = state.paymentMethods[groupKey] || [];

  if (!items.length) {
    optsWrap.innerHTML = `<div class="text-slate-400 px-4 py-6">No options</div>`;
    return;
  }

  const selectedSet = state.selectedPayments[groupKey] || new Set();

  optsWrap.innerHTML = `
    <div class="pm-grid">
      ${items.map((name, idx)=>`
        <label class="pm-opt">
          <input type="checkbox" data-group="${groupKey}" data-name="${escapeHtml(name)}" ${selectedSet.has(name)?"checked":""}/>
          <span>${escapeHtml(name)}</span>
        </label>
      `).join("")}
    </div>
  `;

  optsWrap.onchange = (e)=>{
    const cb = e.target.closest('input[type="checkbox"][data-group]');
    if (!cb) return;
    const g = cb.dataset.group;
    const n = cb.dataset.name;
    if (!state.selectedPayments[g]) state.selectedPayments[g] = new Set();
    cb.checked ? state.selectedPayments[g].add(n) : state.selectedPayments[g].delete(n);
    refreshPMButtonLabel();
  };

  refreshPMButtonLabel();
}

function wirePaymentModal() {
  const openBtn = $(SEL.pmOpenBtn);
  const modal = $(SEL.pmModal);
  const done = $(SEL.pmDone);
  const clear = $(SEL.pmClear);
  if (!openBtn || !modal) return;

  openBtn.addEventListener("click", ()=> modal.classList.add("open"));
  done && done.addEventListener("click", ()=> modal.classList.remove("open"));
  clear && clear.addEventListener("click", ()=>{
    for (const k in state.selectedPayments) state.selectedPayments[k].clear();
    renderPMOptions($(".pm-tab.active")?.dataset.pm || "creditCard");
  });

  // click outside to close
  modal.addEventListener("click", (e)=>{
    if (e.target === modal) modal.classList.remove("open");
  });
}

function refreshPMButtonLabel() {
  const btn = $(SEL.pmOpenBtn);
  if (!btn) return;
  let count = 0;
  for (const k in state.selectedPayments) count += state.selectedPayments[k].size;
  btn.textContent = count ? `${count} selected` : "Select Payment Methods";
}

function escapeHtml(s){ return (s??"").replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }

/* ====== TRIP TYPE ====== */
function wireTripToggle() {
  const one = $(SEL.oneWay), round = $(SEL.roundTrip), ret = $(SEL.ret);
  if (!one || !round || !ret) return;
  const sync = ()=> { ret.closest(".ret-wrap")?.classList.toggle("hidden", one.checked); };
  one.addEventListener("change", sync);
  round.addEventListener("change", sync);
  sync();
}

/* ====== SEARCH & RENDER ====== */
function wireSearch() {
  const btn = $(SEL.searchBtn);
  if (!btn) return;
  btn.addEventListener("click", onSearch);
}

async function onSearch() {
  const from = $(SEL.from)?.value?.trim().toUpperCase();
  const to = $(SEL.to)?.value?.trim().toUpperCase();
  const departureDate = fmtYMD($(SEL.depart)?.value?.trim());
  const returnDate = fmtYMD($(SEL.ret)?.value?.trim());
  const passengers = Number($(SEL.pax)?.value || 1);
  const travelClass = $(SEL.cabin)?.value || "Economy";
  const tripType = $(SEL.roundTrip)?.checked ? "round-trip" : "one-way";

  const outC = $(SEL.outboundWrap), inC = $(SEL.returnWrap);
  if (outC) showMsg(outC, "Loading flights…");
  if (inC) showMsg(inC, "Loading flights…");

  try {
    const res = await fetch(`${BACKEND_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ from, to, departureDate, returnDate, passengers, travelClass, tripType })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.flights = {
      outbound: Array.isArray(data.outbound) ? data.outbound : [],
      inbound:  Array.isArray(data.inbound)  ? data.inbound  : []
    };

    renderFlights();
  } catch (err) {
    console.error("search failed:", err);
    if (outC) showMsg(outC, "No flights (error fetching).");
    if (inC) showMsg(inC, "No flights (error fetching).");
  }
}

function wireSorters() {
  const outS = $(SEL.outboundSort);
  const inS  = $(SEL.returnSort);
  outS && outS.addEventListener("change", renderFlights);
  inS  && inS.addEventListener("change", renderFlights);
}

function renderFlights() {
  const outC = $(SEL.outboundWrap);
  const inC  = $(SEL.returnWrap);
  if (!outC || !inC) return;

  const out = [...state.flights.outbound];
  const inn = [...state.flights.inbound];

  sortFlights(out, $(SEL.outboundSort)?.value || "priceAsc");
  sortFlights(inn, $(SEL.returnSort)?.value || "priceAsc");

  outC.innerHTML = out.length ? out.map(cardHTML).join("") : `<div class="text-slate-400 p-4">No flights</div>`;
  inC.innerHTML  = inn.length ? inn.map(cardHTML).join("") : `<div class="text-slate-400 p-4">No flights</div>`;

  // attach click → show price modal (placeholder for your existing popup)
  $all(`${SEL.outboundWrap} .flight-card, ${SEL.returnWrap} .flight-card`).forEach(el=>{
    el.addEventListener("click", ()=>{
      alert("Portal pricing popup goes here (same flight across 5 OTAs, base + ₹100).");
    });
  });
}

function sortFlights(list, mode) {
  const key = (mode||"priceAsc").toLowerCase();
  if (key.includes("price")) {
    list.sort((a,b)=> (a.price||0) - (b.price||0));
    if (key.includes("desc")) list.reverse();
  } else {
    // time sort by departureTime "HH:MM"
    list.sort((a,b)=> toMin(a.departureTime) - toMin(b.departureTime));
    if (key.includes("desc")) list.reverse();
  }
}
function toMin(hhmm) {
  const m = (hhmm||"").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1],10)*60 + parseInt(m[2],10);
}

function cardHTML(f) {
  const airline = escapeHtml(f.airline||"Flight");
  const fn = escapeHtml(f.flightNumber||"");
  const dep = escapeHtml(f.departureTime||"");
  const arr = escapeHtml(f.arrivalTime||"");
  const price = priceStr(f.price);
  const stops = Number.isFinite(f.stops)? `${f.stops} stop${f.stops===1?"":"s"}` : "";

  return `
    <div class="flight-card cursor-pointer rounded-xl p-4 bg-[#202833] hover:bg-[#233042] transition">
      <div class="flex items-center justify-between">
        <div class="text-slate-100 font-medium">${airline} <span class="text-slate-400">${fn}</span></div>
        <div class="text-slate-100 font-semibold">${price}</div>
      </div>
      <div class="mt-2 flex items-center justify-between text-slate-300">
        <div>${dep} → ${arr}</div>
        <div class="text-sm">${stops}</div>
      </div>
    </div>
  `;
}
