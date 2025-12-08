// ---------- Config ----------
const API_BASE = "https://skydeal-backend.onrender.com";
const PAGE_SIZE = 40; // single declaration

// ---------- DOM ----------
const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");
const departDate = document.getElementById("departDate");
const returnDate = document.getElementById("returnDate");
const paxSelect = document.getElementById("paxSelect");
const cabinSelect = document.getElementById("cabinSelect");
const tripOneWay = document.getElementById("tripOneWay");
const tripRound = document.getElementById("tripRound");
const searchBtn = document.getElementById("searchBtn");

const outboundList = document.getElementById("outboundList");
const returnList = document.getElementById("returnList");

const paymentBtn = document.getElementById("paymentSelectBtn");
const paymentBtnLabel = document.getElementById("paymentSelectBtnLabel");
const overlay = document.getElementById("paymentOverlay");
const modal = document.getElementById("paymentModal");

// Tab UI inside modal
const tabEls = () => Array.from(document.querySelectorAll(".pm-tab"));
const panelEls = () => Array.from(document.querySelectorAll(".pm-panel"));

const lists = {
  credit: document.getElementById("pm-list-credit"),
  debit: document.getElementById("pm-list-debit"),
  netbanking: document.getElementById("pm-list-netbanking"),
  upi: document.getElementById("pm-list-upi"),
  wallet: document.getElementById("pm-list-wallet"),
  emi: document.getElementById("pm-list-emi"),
};

const pmClearBtn = document.getElementById("pmClearBtn");
const pmDoneBtn = document.getElementById("pmDoneBtn");

// ---------- State ----------
let paymentOptions = {
  CreditCard: [],
  DebitCard: [],
  NetBanking: [],
  UPI: [],
  Wallet: [],
  EMI: []
};

let selectedPayments = []; // array of strings like "HDFC Bank", "ICICI Bank"

// ---------- Helpers ----------
function formatINR(n) {
  if (n == null) return "—";
  const val = typeof n === "string" ? Number(n) : n;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
}

function openPaymentModal() {
  overlay.classList.remove("hidden");
  modal.classList.remove("hidden");
}

function closePaymentModal() {
  overlay.classList.add("hidden");
  modal.classList.add("hidden");
}

function setActiveTab(key) {
  tabEls().forEach(t => {
    const tabKey = t.getAttribute("data-pm-tab");
    t.classList.toggle("pm-tab-active", tabKey === key);
  });
  panelEls().forEach(p => {
    const panelKey = p.getAttribute("data-pm-panel");
    p.classList.toggle("hidden", panelKey !== key);
  });
}

function checkbox(name, isChecked) {
  const id = `pm-${name.replace(/\s+/g, "-").toLowerCase()}`;
  return `
    <li class="pm-item">
      <input id="${id}" type="checkbox" ${isChecked ? "checked" : ""} data-name="${name}" />
      <label for="${id}">${name}</label>
    </li>
  `;
}

function renderPaymentList(ul, names) {
  if (!names || !names.length) { ul.innerHTML = `<li class="pm-empty">No options</li>`; return; }
  ul.innerHTML = names
    .map(n => checkbox(n, selectedPayments.includes(n)))
    .join("");
}

function refreshPaymentLabels() {
  if (!selectedPayments.length) {
    paymentBtnLabel.textContent = "Select Payment Methods";
  } else if (selectedPayments.length <= 2) {
    paymentBtnLabel.textContent = selectedPayments.join(", ");
  } else {
    paymentBtnLabel.textContent = `${selectedPayments.slice(0,2).join(", ")} +${selectedPayments.length-2}`;
  }
}

function collectTripType() {
  return tripRound.checked ? "round-trip" : "one-way";
}

// ---------- Payment Options (fetch + modal) ----------
async function loadPaymentOptions() {
  try {
    const r = await fetch(`${API_BASE}/payment-options`);
    const data = await r.json();
    // Expecting shape like { options: { CreditCard: [..], DebitCard:[..], ... }, usedFallback: bool }
    paymentOptions = data.options || paymentOptions;

    // Deduplicate names in each list
    const dedup = arr => Array.from(new Set(arr || []));

    renderPaymentList(lists.credit, dedup(paymentOptions.CreditCard));
    renderPaymentList(lists.debit, dedup(paymentOptions.DebitCard));
    renderPaymentList(lists.netbanking, dedup(paymentOptions.NetBanking));
    renderPaymentList(lists.upi, dedup(paymentOptions.UPI));
    renderPaymentList(lists.wallet, dedup(paymentOptions.Wallet));
    renderPaymentList(lists.emi, dedup(paymentOptions.EMI));
  } catch (e) {
    // basic fallback
    renderPaymentList(lists.credit, ["HDFC Bank","ICICI Bank","Axis Bank"]);
    renderPaymentList(lists.debit, ["HDFC Bank","ICICI Bank","Axis Bank"]);
    renderPaymentList(lists.netbanking, ["HDFC Bank","ICICI Bank","Axis Bank"]);
    renderPaymentList(lists.upi, ["UPI"]);
    renderPaymentList(lists.wallet, ["Paytm","PhonePe"]);
    renderPaymentList(lists.emi, ["HDFC Bank","ICICI Bank"]);
    console.error("payment-options failed:", e);
  }
}

function wirePaymentModal() {
  paymentBtn.addEventListener("click", () => {
    openPaymentModal();
    setActiveTab("creditCard");
  });

  overlay.addEventListener("click", closePaymentModal);

  tabEls().forEach(t => {
    t.addEventListener("click", () => {
      setActiveTab(t.getAttribute("data-pm-tab"));
    });
  });

  // Delegate checkbox change for all lists
  modal.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el && el.matches('input[type="checkbox"][data-name]')) {
      const name = el.getAttribute("data-name");
      if (el.checked) {
        if (!selectedPayments.includes(name)) selectedPayments.push(name);
      } else {
        selectedPayments = selectedPayments.filter(x => x !== name);
      }
    }
  });

  pmClearBtn.addEventListener("click", () => {
    selectedPayments = [];
    // uncheck all
    modal.querySelectorAll('input[type="checkbox"][data-name]').forEach(c => (c.checked = false));
    refreshPaymentLabels();
  });

  pmDoneBtn.addEventListener("click", () => {
    refreshPaymentLabels();
    closePaymentModal();
  });
}

// ---------- Search + Render ----------
function flightCard(f) {
  const title = `${f.airlineName || "-"}${f.flightNumber ? " • " + f.flightNumber : ""}`;
  const times = `${f.departureTime || ""} → ${f.arrivalTime || ""} • ${f.stops || "Non-stop"}`;
  const best = f.bestDeal ? `Best: ${formatINR(f.bestDeal.finalPrice)} on ${f.bestDeal.portal}` : null;

  return `
    <div class="flight-card">
      <div class="fc-title">${title}</div>
      <div class="fc-time">${times}</div>
      ${best ? `<div class="fc-price">${best}</div>` : ``}
    </div>
  `;
}

function renderList(el, flights) {
  if (!flights || flights.length === 0) {
    el.innerHTML = `<div class="empty">No results</div>`;
    return;
  }
  // Show only first PAGE_SIZE (we can add pagination later)
  const subset = flights.slice(0, PAGE_SIZE);
  el.innerHTML = subset.map(flightCard).join("");
}

async function doSearch() {
  const body = {
    from: (fromInput.value || "").trim().toUpperCase(),
    to: (toInput.value || "").trim().toUpperCase(),
    departureDate: departDate.value || "",
    returnDate: returnDate.value || "",
    passengers: Number(paxSelect.value || 1),
    travelClass: (cabinSelect.value || "economy"),
    tripType: collectTripType(),
    paymentMethods: selectedPayments.slice(), // array of strings
  };

  // If one-way, drop returnDate
  if (body.tripType === "one-way") delete body.returnDate;

  searchBtn.disabled = true;
  searchBtn.textContent = "Searching…";

  try {
    const r = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();

    const out = Array.isArray(data.outboundFlights) ? data.outboundFlights : [];
    const ret = Array.isArray(data.returnFlights) ? data.returnFlights : [];

    renderList(outboundList, out);
    renderList(returnList, ret);
  } catch (e) {
    console.error("search failed:", e);
    outboundList.innerHTML = `<div class="empty">Search failed</div>`;
    returnList.innerHTML = `<div class="empty">Search failed</div>`;
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "Search";
  }
}

// ---------- Init ----------
(function init() {
  // sensible defaults for demo
  if (!fromInput.value) fromInput.value = "BOM";
  if (!toInput.value) toInput.value = "DEL";
  if (!departDate.value) {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    departDate.value = d.toISOString().slice(0,10);
  }
  if (!returnDate.value) {
    const d2 = new Date(departDate.value);
    d2.setDate(d2.getDate() + 3);
    returnDate.value = d2.toISOString().slice(0,10);
  }

  wirePaymentModal();
  loadPaymentOptions();

  // round-trip toggles return field enable/disable
  function updateTrip() {
    const isRound = tripRound.checked;
    returnDate.disabled = !isRound;
  }
  tripOneWay.addEventListener("change", updateTrip);
  tripRound.addEventListener("change", updateTrip);
  updateTrip();

  searchBtn.addEventListener("click", doSearch);
})();
