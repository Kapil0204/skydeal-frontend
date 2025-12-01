// ===== CONFIG =====
const API_BASE = "https://skydeal-backend.onrender.com";
const MARKUP_PER_PORTAL = 250; // ₹250 markup

// ===== UTIL =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const showToast = (msg) => {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add("hidden"), 4000);
};
const iso = (v) => (v ? String(v).trim() : "");

// Normalizes keys like "Credit Card", "CreditCard", "credit", "Credit Cards" -> "credit"
const normKey = (k) => String(k || "")
  .toLowerCase()
  .replace(/\s+/g, "")
  .replace(/cards?$/, "")
  .replace(/netbanking|netbank$/, "netbanking");

// ===== STATE =====
let paymentOptions = {
  credit: [], debit: [], wallet: [], upi: [], netbanking: [], emi: []
};
let selectedPayments = []; // [{type:'credit', bank:'HDFC'}...]

// ===== ELEMENTS =====
const els = {
  from: $("#fromInput"),
  to: $("#toInput"),
  dep: $("#departDate"),
  ret: $("#returnDate"),
  pax: $("#paxSelect"),
  cabin: $("#cabinSelect"),
  rOne: $("#tripOneWay"),
  rRound: $("#tripRound"),
  out: $("#outboundList"),
  retList: $("#returnList"),
  searchBtn: $("#searchBtn"),
  payBtn: $("#paymentSelectBtn"),
  payBtnLabel: $("#paymentSelectBtnLabel"),
  overlay: $("#paymentOverlay"),
  modal: $("#paymentModal"),
  tabs: $$(".pm-tab"),
  lists: {
    credit: $("#pm-list-credit"),
    debit: $("#pm-list-debit"),
    wallet: $("#pm-list-wallet"),
    upi: $("#pm-list-upi"),
    netbanking: $("#pm-list-netbanking"),
    emi: $("#pm-list-emi"),
  },
  btnDone: $("#pmDoneBtn"),
  btnClear: $("#pmClearBtn"),
  toast: $("#toast"),
};

// ===== PAYMENT MODAL =====
function openModal() {
  els.overlay.classList.remove("hidden");
  els.modal.classList.remove("hidden");
}
function closeModal() {
  els.overlay.classList.add("hidden");
  els.modal.classList.add("hidden");
}
function showTab(key) {
  els.tabs.forEach(b => b.classList.toggle("pm-tab-active", b.dataset.pmTab === key));
  Object.entries(els.lists).forEach(([k, ul]) => {
    if (k === key) ul.classList.remove("hidden"); else ul.classList.add("hidden");
  });
}

// Fill the modal lists
function renderPaymentLists() {
  console.debug("[payment] render lists with", paymentOptions);
  const cols = [
    ["credit", els.lists.credit],
    ["debit", els.lists.debit],
    ["wallet", els.lists.wallet],
    ["upi", els.lists.upi],
    ["netbanking", els.lists.netbanking],
    ["emi", els.lists.emi],
  ];
  cols.forEach(([key, ul]) => {
    ul.innerHTML = "";
    const items = paymentOptions[key] || [];
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "pm-empty";
      li.textContent = "No options available.";
      ul.appendChild(li);
      return;
    }
    items.forEach(name => {
      const li = document.createElement("li");
      li.className = "pm-item";
      const id = `pm-${key}-${name.replace(/\s+/g, "_")}`;
      li.innerHTML = `
        <input type="checkbox" id="${id}" data-type="${key}" data-bank="${name}">
        <label for="${id}">${name}</label>
      `;
      ul.appendChild(li);
    });
  });

  // Restore checked
  selectedPayments.forEach(sel => {
    const id = `pm-${sel.type}-${sel.bank.replace(/\s+/g, "_")}`;
    const el = document.getElementById(id);
    if (el) el.checked = true;
  });
}

function setBtnCount() {
  const n = selectedPayments.length;
  els.payBtnLabel.textContent = n ? `Payment Methods (${n})` : "Select Payment Methods";
}

// ===== FETCHers =====
async function loadPaymentOptions() {
  try {
    console.debug("[payment] fetching", `${API_BASE}/payment-options`);
    const res = await fetch(`${API_BASE}/payment-options`, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.debug("[payment] raw payload", data);

    // Accept both shapes:
    // 1) { options: { Credit Card:[...], UPI:[...] } }
    // 2) { options: { CreditCard:[...], NetBanking:[...] } }
    // 3) { options: { credit:[...], upi:[...] } }
    const src = (data && data.options) ? data.options : {};
    const out = { credit:[], debit:[], wallet:[], upi:[], netbanking:[], emi:[] };

    Object.entries(src).forEach(([k, arr]) => {
      const nk = normKey(k); // normalize key
      if (nk.includes("credit")) out.credit = arr || [];
      else if (nk.includes("debit")) out.debit = arr || [];
      else if (nk.includes("wallet")) out.wallet = arr || [];
      else if (nk.includes("upi")) out.upi = arr || [];
      else if (nk.includes("netbank")) out.netbanking = arr || [];
      else if (nk.includes("emi")) out.emi = arr || [];
    });

    paymentOptions = out;
    renderPaymentLists();
  } catch (e) {
    console.error("[payment] load error", e);
    showToast("Could not load payment methods.");
    paymentOptions = { credit:[], debit:[], wallet:[], upi:[], netbanking:[], emi:[] };
    renderPaymentLists();
  }
}

// ===== SEARCH =====
function flightCard(f) {
  const portals = (f.portalPrices || []).map(p =>
    `<div>• ${p.portal}: ₹${p.finalPrice} <span style="opacity:.7">(${p.source})</span></div>`
  ).join("");
  return `
    <div class="flight-card">
      <div class="fc-title">${f.airlineName} ${f.flightNumber}</div>
      <div class="fc-time">${f.departure} → ${f.arrival} • Stops: ${f.stops ?? 0}</div>
      <div class="fc-price">₹${f.price}</div>
      ${portals ? `<details><summary>Portal prices (+₹${MARKUP_PER_PORTAL} markup)</summary>${portals}</details>` : ""}
    </div>`;
}

function renderResults(outbound, ret) {
  if (!outbound?.length) els.out.innerHTML = `<div class="empty">No flights</div>`;
  else els.out.innerHTML = outbound.map(flightCard).join("");

  if (!ret?.length) els.retList.innerHTML = `<div class="empty">No flights</div>`;
  else els.retList.innerHTML = ret.map(flightCard).join("");
}

async function doSearch() {
  const tripType = els.rOne.checked ? "one-way" : "round-trip";

  const payload = {
    from: iso(els.from.value || "BOM").toUpperCase(),
    to: iso(els.to.value || "DEL").toUpperCase(),
    departureDate: iso(els.dep.value),
    returnDate: tripType === "round-trip" ? iso(els.ret.value) : "",
    passengers: Number(els.pax.value || 1),
    travelClass: iso(els.cabin.value || "Economy"),
    tripType,
    paymentMethods: selectedPayments.map(p => ({ bank: p.bank, type: p.type }))
  };

  // Guardrails
  if (!payload.departureDate) { showToast("Pick a departure date."); return; }
  if (tripType === "round-trip" && !payload.returnDate) { showToast("Pick a return date."); return; }

  console.debug("[search] payload", payload);
  renderResults([], []); // clear

  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "cors"
    });

    const json = await res.json().catch(() => ({}));
    console.debug("[search] response", res.status, json);

    // meta.reason surfaces backend hints like "no-key", "timeout", "no-itineraries"
    if (!res.ok) {
      showToast(`Search failed (HTTP ${res.status})`);
      return;
    }
    if (json.error) {
      showToast(`Search error: ${json.error}`);
      return;
    }
    if (json.meta?.reason) {
      showToast(`No flights found (${json.meta.reason})`);
    }

    renderResults(json.outboundFlights || [], json.returnFlights || []);
  } catch (e) {
    console.error("[search] error", e);
    showToast("Search failed (network).");
  }
}

// ===== WIRING =====
function readSelectionsFromUI() {
  selectedPayments = [];
  Object.values(els.lists).forEach(ul => {
    ul.querySelectorAll("input[type=checkbox]").forEach(chk => {
      if (chk.checked) selectedPayments.push({ type: chk.dataset.type, bank: chk.dataset.bank });
    });
  });
}
function clearSelections() {
  selectedPayments = [];
  Object.values(els.lists).forEach(ul => ul.querySelectorAll("input[type=checkbox]").forEach(ch => ch.checked = false));
  setBtnCount();
}

function init() {
  // modal open/close
  els.payBtn.addEventListener("click", openModal);
  els.overlay.addEventListener("click", closeModal);
  els.btnClear.addEventListener("click", () => { clearSelections(); renderPaymentLists(); });
  els.btnDone.addEventListener("click", () => { readSelectionsFromUI(); setBtnCount(); closeModal(); });

  // tabs
  els.tabs.forEach(btn => {
    btn.addEventListener("click", () => showTab(btn.getAttribute("data-pm-tab")));
  });

  // trip toggles
  els.rOne.addEventListener("change", () => {
    if (els.rOne.checked) els.ret.closest(".field").style.opacity = .45;
  });
  els.rRound.addEventListener("change", () => {
    if (els.rRound.checked) els.ret.closest(".field").style.opacity = 1;
  });

  // search
  els.searchBtn.addEventListener("click", doSearch);

  // init
  loadPaymentOptions().then(() => {
    renderPaymentLists();
  });
  setBtnCount();
  if (els.rOne.checked) els.ret.closest(".field").style.opacity = .45;
}
document.addEventListener("DOMContentLoaded", init);
