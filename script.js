/* =========================
   SkyDeal Frontend — script.js
   Works with your current index.html IDs
   - loads payment options from backend (Mongo-driven)
   - payment modal: tabs + multi-select + count
   - search: FlightAPI backend + offers applied
   - eye button: portal comparison modal
   ========================= */

const BACKEND = "https://skydeal-backend.onrender.com";

// --------------------
// DOM
// --------------------
const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");
const departInput = document.getElementById("departInput");
const returnInput = document.getElementById("returnInput");
const paxSelect = document.getElementById("paxSelect");
const cabinSelect = document.getElementById("cabinSelect");
const oneWayRadio = document.getElementById("oneWay");
const roundTripRadio = document.getElementById("roundTrip");
const searchBtn = document.getElementById("searchBtn");

const outboundList = document.getElementById("outboundList");
const returnList = document.getElementById("returnList");

const outPrev = document.getElementById("outPrev");
const outNext = document.getElementById("outNext");
const outPage = document.getElementById("outPage");
const outPages = document.getElementById("outPages");

const retPrev = document.getElementById("retPrev");
const retNext = document.getElementById("retNext");
const retPage = document.getElementById("retPage");
const retPages = document.getElementById("retPages");

const outSort = document.getElementById("outSort");
const retSort = document.getElementById("retSort");

// Payment modal
const paymentBtn = document.getElementById("paymentBtn");
const pmCount = document.getElementById("pmCount");
const paymentModal = document.getElementById("paymentModal");
const pmTabs = document.getElementById("pmTabs");
const pmList = document.getElementById("pmList");
const pmClose = document.getElementById("pmClose");
const pmClear = document.getElementById("pmClear");
const pmDone = document.getElementById("pmDone");

// Price modal
const priceModal = document.getElementById("priceModal");
const priceBody = document.getElementById("priceBody");
const priceClose = document.getElementById("priceClose");

// --------------------
// Utils
// --------------------
function toISO(d) {
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const m = String(d).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const dt = new Date(d);
  return isNaN(dt) ? "" : dt.toISOString().slice(0, 10);
}

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "₹0";
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function safeText(x, def = "—") {
  const s = (x ?? "").toString().trim();
  return s ? s : def;
}

// --------------------
// State
// --------------------
let paymentOptions = null;              // { "Credit Card":[...], ... }
let activePayType = "Credit Card";
let selectedPayments = new Set();       // key: `${type}::${name}`

let outboundAll = [];
let returnAll = [];
const PAGE_SIZE = 7;

const paging = {
  out: { page: 1 },
  ret: { page: 1 }
};

// --------------------
// Payment Options / Modal
// --------------------
async function loadPaymentOptions() {
  const res = await fetch(`${BACKEND}/payment-options`, { cache: "no-store" });
  if (!res.ok) throw new Error(`payment-options failed (${res.status})`);
  const data = await res.json();
  if (!data || !data.options) throw new Error("payment-options returned no options");
  paymentOptions = data.options;

  // pick first tab that has data (or default)
  const keys = Object.keys(paymentOptions);
  const preferred = ["Credit Card","Debit Card","UPI","EMI","Net Banking","Wallet"];
  activePayType = preferred.find(k => keys.includes(k)) || keys[0] || "Credit Card";

  renderPaymentTabs();
  renderPaymentList();
  updatePaymentCountUI();
}

function renderPaymentTabs() {
  if (!pmTabs) return;

  const types = ["Credit Card","Debit Card","EMI","Net Banking","UPI","Wallet"]
    .filter(t => paymentOptions && Object.prototype.hasOwnProperty.call(paymentOptions, t));

  pmTabs.innerHTML = types.map(t => {
    const cls = t === activePayType ? "tab active" : "tab";
    return `<button class="${cls}" data-type="${t}">${t}</button>`;
  }).join("");

  pmTabs.querySelectorAll("button[data-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      activePayType = btn.getAttribute("data-type");
      renderPaymentTabs();
      renderPaymentList();
    });
  });
}

function renderPaymentList() {
  if (!pmList) return;

  const items = (paymentOptions && paymentOptions[activePayType]) ? paymentOptions[activePayType] : [];
  if (!items || items.length === 0) {
    pmList.innerHTML = `<div class="empty">No options found under ${activePayType}.</div>`;
    return;
  }

  pmList.innerHTML = items.map(name => {
    const key = `${activePayType}::${name}`;
    const checked = selectedPayments.has(key) ? "checked" : "";
    return `
      <label class="pm-item">
        <input type="checkbox" data-key="${key}" ${checked} />
        <span>${name}</span>
      </label>
    `;
  }).join("");

  pmList.querySelectorAll("input[type='checkbox'][data-key]").forEach(cb => {
    cb.addEventListener("change", () => {
      const key = cb.getAttribute("data-key");
      if (cb.checked) selectedPayments.add(key);
      else selectedPayments.delete(key);
      updatePaymentCountUI();
    });
  });
}

function updatePaymentCountUI() {
  if (pmCount) pmCount.textContent = String(selectedPayments.size);
}

function openModal(modalEl) {
  modalEl.classList.add("open");
  modalEl.setAttribute("aria-hidden", "false");
}

function closeModal(modalEl) {
  modalEl.classList.remove("open");
  modalEl.setAttribute("aria-hidden", "true");
}

function getSelectedPaymentsAsPayload() {
  // convert Set("Credit Card::ICICI Bank") -> [{type:"Credit Card", name:"ICICI Bank"}, ...]
  return Array.from(selectedPayments).map(k => {
    const [type, name] = k.split("::");
    return { type, name };
  });
}

// --------------------
// Sorting + Pagination
// --------------------
function parseTimeToMinutes(t) {
  // expects "HH:MM" or similar
  const s = safeText(t, "");
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 99999;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return (hh * 60) + mm;
}

function sortFlights(list, mode) {
  const arr = list.slice();
  if (mode === "depAsc") {
    arr.sort((a, b) => parseTimeToMinutes(a.departureTime) - parseTimeToMinutes(b.departureTime));
    return arr;
  }
  // default priceAsc (by bestDeal finalPrice if present else base price)
  arr.sort((a, b) => {
    const ap = Number(a?.bestDeal?.finalPrice ?? a.price ?? 0);
    const bp = Number(b?.bestDeal?.finalPrice ?? b.price ?? 0);
    return ap - bp;
  });
  return arr;
}

function pageSlice(list, page) {
  const p = Math.max(1, page);
  const start = (p - 1) * PAGE_SIZE;
  return list.slice(start, start + PAGE_SIZE);
}

function calcPages(list) {
  return Math.max(1, Math.ceil((list.length || 0) / PAGE_SIZE));
}

// --------------------
// Render flights
// --------------------
function flightCard(f, direction) {
  const airline = safeText(f.airlineName);
  const fn = safeText(f.flightNumber);
  const dep = safeText(f.departureTime);
  const arr = safeText(f.arrivalTime);
  const stops = Number.isFinite(Number(f.stops)) ? Number(f.stops) : 0;

  const bestPortal = f.bestDeal?.portal ? f.bestDeal.portal : "—";
  const bestPrice = f.bestDeal?.finalPrice != null ? money(f.bestDeal.finalPrice) : money(f.price);
  const offerText = safeText(f.bestDeal?.offerText, "");
  const code = safeText(f.bestDeal?.code, "");

  const offerLine = offerText
    ? `${offerText}${code && code !== "—" ? ` · Code: ${code}` : ""}`
    : "—";

  const payload = encodeURIComponent(JSON.stringify(f.portalPrices || []));
  return `
    <div class="card">
      <div class="row">
        <div class="air">${airline} <span class="badge">${fn}</span></div>
        <div class="times">${dep} → ${arr}</div>
        <div class="stops">${stops} stop(s)</div>
        <div class="price">${bestPrice}</div>
        <button class="eye" data-direction="${direction}" data-portals="${payload}" title="Compare portal prices">👁</button>
      </div>
      <div class="best">
        Best on <b>${bestPortal}</b> · Offer: ${offerLine}
      </div>
    </div>
  `;
}

function renderDirection(direction) {
  const isOut = direction === "out";
  const listEl = isOut ? outboundList : returnList;
  const sortEl = isOut ? outSort : retSort;
  const prevBtn = isOut ? outPrev : retPrev;
  const nextBtn = isOut ? outNext : retNext;
  const pageEl = isOut ? outPage : retPage;
  const pagesEl = isOut ? outPages : retPages;

  const full = isOut ? outboundAll : returnAll;
  const pageState = isOut ? paging.out : paging.ret;

  if (!Array.isArray(full) || full.length === 0) {
    listEl.innerHTML = `<div class="empty">No flights found for your search.</div>`;
    sortEl.disabled = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    pageEl.textContent = "1";
    pagesEl.textContent = "1";
    return;
  }

  sortEl.disabled = false;
  const sorted = sortFlights(full, sortEl.value);

  const totalPages = calcPages(sorted);
  if (pageState.page > totalPages) pageState.page = totalPages;

  const slice = pageSlice(sorted, pageState.page);

  listEl.innerHTML = slice.map(f => flightCard(f, direction)).join("");

  // wire eye buttons
  listEl.querySelectorAll(".eye").forEach(btn => {
    btn.addEventListener("click", () => {
      const portals = JSON.parse(decodeURIComponent(btn.getAttribute("data-portals") || "[]"));
      openPriceModal(portals);
    });
  });

  pageEl.textContent = String(pageState.page);
  pagesEl.textContent = String(totalPages);

  prevBtn.disabled = pageState.page <= 1;
  nextBtn.disabled = pageState.page >= totalPages;
}

// --------------------
// Price comparison modal
// --------------------
function openPriceModal(portalPrices) {
  const rows = Array.isArray(portalPrices) ? portalPrices : [];

  if (rows.length === 0) {
    priceBody.innerHTML = `<div class="empty">No portal price data available for this flight.</div>`;
    openModal(priceModal);
    return;
  }

  const sorted = rows.slice().sort((a, b) => (a.finalPrice ?? 0) - (b.finalPrice ?? 0));
  const bestPortal = sorted[0]?.portal || "";

  priceBody.innerHTML = `
    <table class="price-table">
      <thead>
        <tr>
          <th>Portal</th>
          <th>Base</th>
          <th>Savings</th>
          <th>Final</th>
          <th>Offer</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(r => {
          const offer = r.offer;
          const offerTxt = offer
            ? `${safeText(offer.offerText, "")}${offer.code ? ` · Code: ${offer.code}` : ""}`
            : "—";

          const portalLabel = r.portal === bestPortal
            ? `${r.portal} <span class="badge">Best</span>`
            : r.portal;

          return `
            <tr>
              <td>${portalLabel}</td>
              <td>${money(r.basePrice)}</td>
              <td>${money(r.savings)}</td>
              <td><b>${money(r.finalPrice)}</b></td>
              <td>${offerTxt}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  openModal(priceModal);
}

// --------------------
// Search
// --------------------
function validateSearch(payload) {
  if (!payload.from || !payload.to || !payload.departureDate) return "Please enter From, To and a valid Depart date.";
  if (payload.tripType === "round-trip" && !payload.returnDate) return "Please choose a Return date for round-trip.";
  if (selectedPayments.size === 0) return "Please select at least one payment method before searching.";
  return "";
}

async function handleSearch(ev) {
  ev?.preventDefault?.();

  const payload = {
    from: (fromInput?.value || "").trim().toUpperCase(),
    to: (toInput?.value || "").trim().toUpperCase(),
    departureDate: toISO(departInput?.value || ""),
    returnDate: roundTripRadio?.checked ? toISO(returnInput?.value || "") : "",
    tripType: roundTripRadio?.checked ? "round-trip" : "one-way",
    passengers: Number(paxSelect?.value || 1),
    travelClass: (cabinSelect?.value || "economy"),
    paymentMethods: getSelectedPaymentsAsPayload()
  };

  const err = validateSearch(payload);
  if (err) {
    alert(err);
    return;
  }

  // reset view
  outboundAll = [];
  returnAll = [];
  paging.out.page = 1;
  paging.ret.page = 1;

  outboundList.innerHTML = `<div class="empty">Loading flights…</div>`;
  returnList.innerHTML = `<div class="empty">Loading flights…</div>`;

  try {
    const res = await fetch(`${BACKEND}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    console.log("[SkyDeal] /search meta", json?.meta);

    outboundAll = Array.isArray(json?.outboundFlights) ? json.outboundFlights : [];
    returnAll = Array.isArray(json?.returnFlights) ? json.returnFlights : [];

    renderDirection("out");
    renderDirection("ret");
  } catch (e) {
    console.error("[SkyDeal] search failed", e);
    outboundList.innerHTML = `<div class="empty">Search failed. Check backend logs and try again.</div>`;
    returnList.innerHTML = `<div class="empty">Search failed. Check backend logs and try again.</div>`;
  }
}

// --------------------
// Wiring
// --------------------
function toggleReturnField() {
  const show = !!roundTripRadio?.checked;
  returnInput.disabled = !show;
  returnInput.parentElement?.classList?.toggle("disabled", !show);
}

function wire() {
  // Defaults
  if (departInput && !departInput.value) departInput.value = toISO(new Date());
  if (returnInput && !returnInput.value) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    returnInput.value = toISO(d);
  }

  toggleReturnField();
  oneWayRadio?.addEventListener("change", toggleReturnField);
  roundTripRadio?.addEventListener("change", toggleReturnField);

  // Payment button opens modal
  paymentBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      if (!paymentOptions) await loadPaymentOptions();
      openModal(paymentModal);
    } catch (err) {
      console.error(err);
      alert("Failed to load payment methods from backend. Check /payment-options.");
    }
  });

  pmClose?.addEventListener("click", () => closeModal(paymentModal));
  pmDone?.addEventListener("click", () => closeModal(paymentModal));
  pmClear?.addEventListener("click", () => {
    selectedPayments.clear();
    renderPaymentList();
    updatePaymentCountUI();
  });

  // close modal if click outside content
  paymentModal?.addEventListener("click", (e) => {
    if (e.target === paymentModal) closeModal(paymentModal);
  });

  // Search
  searchBtn?.addEventListener("click", handleSearch);

  // Sort changes
  outSort?.addEventListener("change", () => { paging.out.page = 1; renderDirection("out"); });
  retSort?.addEventListener("change", () => { paging.ret.page = 1; renderDirection("ret"); });

  // Paging
  outPrev?.addEventListener("click", () => { paging.out.page = Math.max(1, paging.out.page - 1); renderDirection("out"); });
  outNext?.addEventListener("click", () => { paging.out.page = paging.out.page + 1; renderDirection("out"); });
  retPrev?.addEventListener("click", () => { paging.ret.page = Math.max(1, paging.ret.page - 1); renderDirection("ret"); });
  retNext?.addEventListener("click", () => { paging.ret.page = paging.ret.page + 1; renderDirection("ret"); });

  // Price modal close
  priceClose?.addEventListener("click", () => closeModal(priceModal));
  priceModal?.addEventListener("click", (e) => {
    if (e.target === priceModal) closeModal(priceModal);
  });

  console.log("[SkyDeal] frontend ready");
}

document.addEventListener("DOMContentLoaded", wire);
