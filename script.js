<!-- make sure this is the only script loaded on the page -->
<script>
/** *************** CONFIG *************** */
const BACKEND = "https://skydeal-backend.onrender.com"; // Render URL
/* IDs expected in your HTML (already present in your UI)
   - from (input), to (input)
   - departureDate (input[type=date-like]), returnDate (input[type=date-like])
   - passengers (select/input number), travelClass (select: Economy/Business/First/Premium_Economy)
   - radio tripType: #tripOneWay and #tripRound (values one-way / round-trip)
   - #searchBtn
   - results containers: #outboundList, #returnList
   - payment selector button: #paymentBtn and a modal with:
        #paymentTabs (container for tab buttons)
        #paymentOptions (container to render options list)
        #paymentDone, #paymentClear
*/
const els = {
  from: document.getElementById("from"),
  to: document.getElementById("to"),
  departureDate: document.getElementById("departureDate"),
  returnDate: document.getElementById("returnDate"),
  passengers: document.getElementById("passengers"),
  travelClass: document.getElementById("travelClass"),
  tripOneWay: document.getElementById("tripOneWay"),
  tripRound: document.getElementById("tripRound"),
  searchBtn: document.getElementById("searchBtn"),
  outboundList: document.getElementById("outboundList"),
  returnList: document.getElementById("returnList"),
  // payment modal
  paymentBtn: document.getElementById("paymentBtn"),
  paymentTabs: document.getElementById("paymentTabs"),
  paymentOptions: document.getElementById("paymentOptions"),
  paymentDone: document.getElementById("paymentDone"),
  paymentClear: document.getElementById("paymentClear"),
};

function val(el, def="") { return (el && el.value != null) ? String(el.value).trim() : def; }
function isChecked(el) { return !!(el && el.checked); }
function setHTML(node, html){ if(node) node.innerHTML = html; }
function showError(container, msg){ setHTML(container, `<div class="error">${msg}</div>`); }
function fmt(n){ return new Intl.NumberFormat("en-IN").format(n||0); }

/** *************** PAYMENT METHODS *************** */
const PM_TABS = [
  { key: "creditCard",   label: "Credit Cards" },
  { key: "debitCard",    label: "Debit Cards" },
  { key: "wallet",       label: "Wallets" },
  { key: "upi",          label: "UPI" },
  { key: "netBanking",   label: "NetBanking" },
  { key: "emi",          label: "EMI" },
];

let selectedPayments = { creditCard: [], debitCard: [], wallet: [], upi: [], netBanking: [], emi: [] };
let fetchedPaymentGroups = null;

async function loadPaymentMethods() {
  try {
    const r = await fetch(`${BACKEND}/api/payment-methods`, { mode: "cors" });
    const json = await r.json();
    fetchedPaymentGroups = json;
    renderPaymentTabs(json);
  } catch (e) {
    console.error("payment-methods fetch error", e);
    fetchedPaymentGroups = { creditCard: [], debitCard: [], wallet: [], upi: [], netBanking: [], emi: [] };
    renderPaymentTabs(fetchedPaymentGroups);
  }
}

function renderPaymentTabs(groups) {
  if (!els.paymentTabs || !els.paymentOptions) return;

  // tabs
  els.paymentTabs.innerHTML = PM_TABS.map((t, i) =>
    `<button class="pm-tab ${i===0?"active":""}" data-key="${t.key}">${t.label}</button>`
  ).join("");

  // listeners
  els.paymentTabs.querySelectorAll(".pm-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      els.paymentTabs.querySelectorAll(".pm-tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      renderPaymentList(btn.dataset.key);
    });
  });

  // first tab
  renderPaymentList(PM_TABS[0].key);
}

function renderPaymentList(key) {
  if (!els.paymentOptions || !fetchedPaymentGroups) return;
  const list = fetchedPaymentGroups[key] || [];
  if (!list.length) {
    els.paymentOptions.innerHTML = `<div class="muted">No options</div>`;
    return;
  }
  els.paymentOptions.innerHTML = list.map(name => {
    const checked = (selectedPayments[key]||[]).includes(name) ? "checked" : "";
    const id = `pm-${key}-${btoa(name).replace(/=/g,"")}`;
    return `<label class="pm-item">
      <input type="checkbox" id="${id}" data-key="${key}" data-name="${name}" ${checked}/>
      <span>${name}</span>
    </label>`;
  }).join("");

  els.paymentOptions.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", () => {
      const k = cb.dataset.key, n = cb.dataset.name;
      if (!selectedPayments[k]) selectedPayments[k] = [];
      if (cb.checked) {
        if (!selectedPayments[k].includes(n)) selectedPayments[k].push(n);
      } else {
        selectedPayments[k] = selectedPayments[k].filter(x => x !== n);
      }
    });
  });
}

if (els.paymentBtn) {
  els.paymentBtn.addEventListener("click", () => {
    // Your UI should open the modal here; we only ensure data is present
    if (!fetchedPaymentGroups) loadPaymentMethods();
  });
}
if (els.paymentClear) els.paymentClear.addEventListener("click", () => {
  selectedPayments = { creditCard: [], debitCard: [], wallet: [], upi: [], netBanking: [], emi: [] };
  // re-render current tab
  const active = document.querySelector(".pm-tab.active");
  if (active) renderPaymentList(active.dataset.key);
});
if (els.paymentDone) els.paymentDone.addEventListener("click", () => {
  // close modal in your UI (no-op here)
});

/** *************** SEARCH *************** */
async function doSearch() {
  // read inputs
  const from = val(els.from).toUpperCase();
  const to = val(els.to).toUpperCase();
  const departureDate = val(els.departureDate);
  const returnDate = val(els.returnDate);
  const passengers = parseInt(val(els.passengers, "1"), 10) || 1;
  const travelClass = val(els.travelClass) || "Economy";
  const tripType = isChecked(els.tripOneWay) ? "one-way" : "round-trip";

  // UI reset
  setHTML(els.outboundList, `<div class="muted">Searching...</div>`);
  setHTML(els.returnList, `<div class="muted">Searching...</div>`);

  try {
    const r = await fetch(`${BACKEND}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      mode: "cors",
      body: JSON.stringify({ from, to, departureDate, returnDate, passengers, travelClass, tripType })
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("search HTTP error", r.status, t);
      showError(els.outboundList, "Error fetching flights");
      showError(els.returnList, "Error fetching flights");
      return;
    }

    const data = await r.json();
    renderResults(data);
  } catch (e) {
    console.error("search fetch error", e);
    showError(els.outboundList, "Error fetching flights");
    showError(els.returnList, "Error fetching flights");
  }
}

function renderResults(data) {
  const outs = Array.isArray(data?.outbound) ? data.outbound : [];
  const ins  = Array.isArray(data?.inbound)  ? data.inbound  : [];

  if (!outs.length) setHTML(els.outboundList, `<div class="muted">No flights</div>`);
  else {
    els.outboundList.innerHTML = outs.map(cardHTML).join("");
  }

  if (!ins.length) setHTML(els.returnList, `<div class="muted">No flights</div>`);
  else {
    els.returnList.innerHTML = ins.map(cardHTML).join("");
  }
}

function cardHTML(f) {
  return `<div class="flight-card">
    <div class="flight-hdr">
      <span class="airline">${sanitize(f.airline)}</span>
      <span class="no">${sanitize(f.flightNumber||"")}</span>
    </div>
    <div class="flight-times">
      <span>${sanitize(f.departureTime||"")}</span>
      <span>→</span>
      <span>${sanitize(f.arrivalTime||"")}</span>
    </div>
    <div class="flight-price">₹ ${fmt(f.price||0)}</div>
    <div class="flight-stops">${(f.stops||0) ? `${f.stops} stop` : "Non-stop"}</div>
  </div>`;
}
function sanitize(s){ return String(s||"").replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); }

/** *************** HOOK UP *************** */
if (els.searchBtn) els.searchBtn.addEventListener("click", doSearch);

// First load: fetch payment methods once so tabs are ready
loadPaymentMethods();
</script>
