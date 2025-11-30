/* ---------- SkyDeal Frontend Controller (defensive bindings) ---------- */
/* Backend on Render */
const BACKEND = "https://skydeal-backend.onrender.com";

/* ---------- Utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const textEq = (el, s) => el && el.textContent.trim().toLowerCase() === s.toLowerCase();
const containsText = (el, s) => el && el.textContent.toLowerCase().includes(s.toLowerCase());
const fmt = (n) => new Intl.NumberFormat("en-IN").format(n || 0);
const sanitize = (s) => String(s || "").replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));

/* Try multiple selectors and fallbacks (by visible text) */
function findSearchButton() {
  const candidates = [
    "#searchBtn", "#search-button", "#search", "button#search",
    'button[data-role="search"]', '.controls button[type="button"]',
    '.controls button[type="submit"]'
  ];
  for (const sel of candidates) {
    const el = $(sel);
    if (el) return el;
  }
  // fallback: first button whose text is "Search"
  const btn = $$("button").find(b => textEq(b, "search"));
  return btn || null;
}
function findPaymentTrigger() {
  const candidates = [
    "#paymentBtn", "#paymentTrigger", '[data-role="payment-trigger"]',
    ".payment-trigger", ".payment-methods-trigger",
    // In your screenshots, the pill at top-right shows “2 selected”
    // so try any button/div with the word "selected"
    "button", ".badge", ".chip", ".pill", ".selector"
  ];
  for (const sel of candidates) {
    const nodes = $$(sel);
    const hit = nodes.find(n => containsText(n, "selected") || containsText(n, "payment"));
    if (hit) return hit;
  }
  return null;
}

/* Resolve common inputs no matter what they’re named */
function pickInput(possibleSelectors, fallback = null) {
  for (const sel of possibleSelectors) {
    const el = $(sel);
    if (el) return el;
  }
  return fallback;
}

const els = {
  from:       pickInput(["#from", "#origin", "[name=from]", "[name=origin]"]),
  to:         pickInput(["#to", "#destination", "[name=to]", "[name=destination]"]),
  departure:  pickInput(["#departureDate", "#depart", "[name=departureDate]", "[name=departure]"]),
  ret:        pickInput(["#returnDate", "#return", "[name=returnDate]", "[name=return]"]),
  pax:        pickInput(["#passengers", "#pax", "[name=passengers]"]),
  cabin:      pickInput(["#travelClass", "#cabin", "[name=travelClass]"]),
  oneWay:     pickInput(["#tripOneWay", "[name=tripType][value='one-way']"]),
  roundTrip:  pickInput(["#tripRound", "[name=tripType][value='round-trip']"]),
  outList:    pickInput(["#outboundList", "#outbound", ".outbound-results"]),
  inList:     pickInput(["#returnList", "#inbound", ".return-results"]),
};

/* wipe results */
function setInfo(target, msg) {
  if (!target) return;
  target.innerHTML = `<div class="muted">${sanitize(msg)}</div>`;
}
function setError(target, msg) {
  if (!target) return;
  target.innerHTML = `<div class="error">${sanitize(msg)}</div>`;
}

/* ---------- Payment Methods (tabs + options) ---------- */
const PM_TABS = [
  { key: "creditCard", label: "Credit Cards" },
  { key: "debitCard",  label: "Debit Cards" },
  { key: "wallet",     label: "Wallets" },
  { key: "upi",        label: "UPI" },
  { key: "netBanking", label: "NetBanking" },
  { key: "emi",        label: "EMI" },
];

let pmState = { selected: { creditCard:[], debitCard:[], wallet:[], upi:[], netBanking:[], emi:[] } };
let pmGroups = null;

async function fetchPaymentMethods() {
  try {
    const r = await fetch(`${BACKEND}/api/payment-methods`, { mode: "cors" });
    pmGroups = await r.json();
    // Defensive: ensure arrays exist
    for (const t of PM_TABS) if (!Array.isArray(pmGroups[t.key])) pmGroups[t.key] = [];
  } catch (e) {
    console.error("payment-methods fetch error", e);
    pmGroups = { creditCard:[], debitCard:[], wallet:[], upi:[], netBanking:[], emi:[] };
  }
  updatePaymentBadge();
}

/* Update top-right badge text (avoid “2 selected” default) */
function updatePaymentBadge() {
  const trigger = findPaymentTrigger();
  if (!trigger) return;
  const count = Object.values(pmState.selected).reduce((acc, arr) => acc + arr.length, 0);
  const label = count ? `${count} selected` : "Select";
  // Show a stable label without breaking your existing styling
  if (trigger.querySelector(".selected-count")) {
    trigger.querySelector(".selected-count").textContent = label;
  } else {
    trigger.textContent = label;
  }
}

/* Optional: render in your existing modal if you have containers */
function renderPaymentUI() {
  const tabsWrap  = document.getElementById("paymentTabs");
  const listWrap  = document.getElementById("paymentOptions");
  if (!tabsWrap || !listWrap) return; // your modal might be custom; safe-exit

  tabsWrap.innerHTML = PM_TABS.map((t, i) =>
    `<button class="pm-tab ${i===0?"active":""}" data-key="${t.key}">${t.label}</button>`
  ).join("");

  tabsWrap.querySelectorAll(".pm-tab").forEach(btn=>{
    btn.addEventListener("click", () => {
      tabsWrap.querySelectorAll(".pm-tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      paintList(btn.dataset.key);
    });
  });

  paintList(PM_TABS[0].key);

  function paintList(key){
    const list = pmGroups[key] || [];
    if (!list.length) {
      listWrap.innerHTML = `<div class="muted">No options</div>`;
      return;
    }
    listWrap.innerHTML = list.map(name=>{
      const checked = (pmState.selected[key]||[]).includes(name) ? "checked" : "";
      const id = `pm-${key}-${btoa(name).replace(/=/g,"")}`;
      return `<label class="pm-item">
        <input type="checkbox" id="${id}" data-key="${key}" data-name="${name}" ${checked}/>
        <span>${sanitize(name)}</span>
      </label>`;
    }).join("");

    listWrap.querySelectorAll("input[type=checkbox]").forEach(cb=>{
      cb.addEventListener("change", ()=>{
        const k = cb.dataset.key, n = cb.dataset.name;
        if (!pmState.selected[k]) pmState.selected[k] = [];
        if (cb.checked) {
          if (!pmState.selected[k].includes(n)) pmState.selected[k].push(n);
        } else {
          pmState.selected[k] = pmState.selected[k].filter(x => x!==n);
        }
        updatePaymentBadge();
      });
    });
  }
}

/* ---------- Search ---------- */
async function doSearch() {
  const from = (els.from?.value || "").trim().toUpperCase();
  const to   = (els.to?.value   || "").trim().toUpperCase();
  const departureDate = (els.departure?.value || "").trim();
  const returnDate    = (els.ret?.value       || "").trim();
  const passengers    = parseInt(els.pax?.value || "1", 10) || 1;
  // FlightAPI expects “Economy | Business | First | Premium_Economy”
  let travelClass = (els.cabin?.value || "Economy").trim();
  if (travelClass.toLowerCase() === "premium economy") travelClass = "Premium_Economy";

  // Decide tripType by radio if present; else infer by empty returnDate
  let tripType = "round-trip";
  if (els.oneWay?.checked) tripType = "one-way";
  if (els.roundTrip?.checked) tripType = "round-trip";
  if (!returnDate) tripType = "one-way";

  setInfo(els.outList, "Searching…");
  setInfo(els.inList,   "Searching…");

  try {
    const r = await fetch(`${BACKEND}/search`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      mode: "cors",
      body: JSON.stringify({ from, to, departureDate, returnDate, passengers, travelClass, tripType })
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("search HTTP error", r.status, t);
      setError(els.outList, "Error fetching flights");
      setError(els.inList,  "Error fetching flights");
      return;
    }
    const data = await r.json();
    renderResults(data);
  } catch (e) {
    console.error("search fetch error", e);
    setError(els.outList, "Error fetching flights");
    setError(els.inList,  "Error fetching flights");
  }
}

function renderResults(data) {
  const outs = Array.isArray(data?.outbound) ? data.outbound : [];
  const ins  = Array.isArray(data?.inbound)  ? data.inbound  : [];

  if (!els.outList) return;
  if (!outs.length) {
    setInfo(els.outList, "No flights");
  } else {
    els.outList.innerHTML = outs.map(cardHTML).join("");
  }

  if (els.inList) {
    if (!ins.length) setInfo(els.inList, "No flights");
    else els.inList.innerHTML = ins.map(cardHTML).join("");
  }
}

function cardHTML(f) {
  return `<div class="flight-card">
    <div class="flight-hdr">
      <span class="airline">${sanitize(f.airline)}</span>
      <span class="no">${sanitize(f.flightNumber || "")}</span>
    </div>
    <div class="flight-times">
      <span>${sanitize(f.departureTime || "")}</span>
      <span>→</span>
      <span>${sanitize(f.arrivalTime || "")}</span>
    </div>
    <div class="flight-meta">
      <span class="stops">${(f.stops||0) ? `${f.stops} stop` : "Non-stop"}</span>
      <span class="price">₹ ${fmt(f.price || 0)}</span>
    </div>
  </div>`;
}

/* ---------- Wiring (defensive) ---------- */
function wire() {
  // Search button (defensive)
  const searchBtn = findSearchButton();
  if (searchBtn) {
    searchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      doSearch();
    });
    // ensure pointer cursor if CSS missing
    searchBtn.style.cursor = "pointer";
  } else {
    console.warn("Search button not found — check selector fallbacks in script.js");
  }

  // Payment trigger (defensive)
  const payBtn = findPaymentTrigger();
  if (payBtn) {
    // Reset label from any leftover “2 selected” to “Select” at boot
    updatePaymentBadge();
    payBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!pmGroups) await fetchPaymentMethods();
      renderPaymentUI(); // if those containers exist, they’ll get filled
      // If you use a custom modal, your existing click already opens it.
      // We only ensure data is ready so content isn’t empty.
    });
    payBtn.style.cursor = "pointer";
  } else {
    console.warn("Payment trigger not found — script will still fetch groups on load.");
  }

  // Preload payment groups once so tabs always have data
  fetchPaymentMethods();
}

/* Boot */
document.addEventListener("DOMContentLoaded", () => {
  // Safety: if required containers aren’t present, create simple ones
  if (!els.outList) {
    const stub = document.createElement("div");
    stub.id = "outboundList";
    document.body.appendChild(stub);
    els.outList = stub;
  }
  if (!els.inList) {
    const stub = document.createElement("div");
    stub.id = "returnList";
    document.body.appendChild(stub);
    els.inList = stub;
  }
  wire();
});
