// script.js — SkyDeal frontend (stable modal + working search)

const API_BASE = "https://skydeal-backend.onrender.com";

// ------- Elements -------
const fromInput = document.querySelector('#from');        // id="from" input (BOM)
const toInput = document.querySelector('#to');            // id="to" input (DEL)
const depInput = document.querySelector('#departure');    // id="departure" (dd/mm/yyyy)
const retInput = document.querySelector('#return');       // id="return"     (dd/mm/yyyy)
const paxSelect = document.querySelector('#passengers');  // id="passengers"
const cabinSelect = document.querySelector('#cabin');     // id="cabin"  (Economy/Business/First/Premium_Economy)
const oneWayRadio = document.querySelector('#oneWay');    // id="oneWay"
const roundTripRadio = document.querySelector('#roundTrip');// id="roundTrip"

const searchBtn = document.querySelector('#searchBtn');   // id="searchBtn"

// Results
const outList = document.querySelector('#outboundList');  // id="outboundList"
const retList = document.querySelector('#returnList');    // id="returnList"

// Payment picker trigger (top-right)
const payBtn = document.querySelector('#paymentTrigger'); // id="paymentTrigger" (the chip/button at top-right showing "Select" or "N selected")

// Modal
const modal = document.querySelector('#paymentModal');    // id="paymentModal"
const modalTabs = document.querySelectorAll('.pm-tab');   // e.g., buttons with data-tab="creditCard" etc.
const modalBody = document.querySelector('#pmOptions');   // container where we render checkboxes
const modalDone = document.querySelector('#pmDone');      // Done button
const modalClear = document.querySelector('#pmClear');    // Clear button
const modalCloseArea = document.querySelector('#pmBackdrop'); // backdrop or close zone

// ------- State -------
const paymentState = {
  categories: { creditCard:[], debitCard:[], wallet:[], upi:[], netBanking:[], emi:[] },
  selected: new Set(),
  activeTab: 'creditCard'
};

// ------- Utils -------
function yyyymmddFromDDMMYYYY(ddmmyyyy) {
  // "03/12/2025" => "2025-12-03"
  const [dd, mm, yyyy] = (ddmmyyyy || "").split('/');
  if (!yyyy || !mm || !dd) return "";
  return `${yyyy}-${mm}-${dd}`;
}

function showMessage(container, text) {
  container.innerHTML = `<div class="msg">${text}</div>`;
}

function renderFlights(container, flights) {
  if (!flights || flights.length === 0) {
    showMessage(container, "No flights");
    return;
  }
  container.innerHTML = flights.map(f => `
    <div class="flight-card">
      <div class="airline">${f.airline || ""} ${f.flightNumber || ""}</div>
      <div class="times">${f.departure || ""} → ${f.arrival || ""}</div>
      <div class="meta">Stops: ${f.stops ?? 0}</div>
      <div class="price">₹${f.price ?? "-"}</div>
    </div>
  `).join("");
}

function updatePayBtnLabel() {
  const count = paymentState.selected.size;
  payBtn.textContent = count > 0 ? `${count} selected` : "Select";
}

// ------- Payment Modal -------
async function loadPaymentMethods() {
  try {
    const r = await fetch(`${API_BASE}/api/payment-methods`);
    const data = await r.json();
    paymentState.categories = data || paymentState.categories;
  } catch (e) {
    // hard fallback if even that failed
    paymentState.categories = {
      creditCard:[
        {key:"ICICI Bank Credit Card",label:"ICICI Bank Credit Card"},
        {key:"HDFC Bank Credit Card",label:"HDFC Bank Credit Card"},
        {key:"Axis Bank Credit Card",label:"Axis Bank Credit Card"},
        {key:"SBI Credit Card",label:"SBI Credit Card"}
      ],
      debitCard:[
        {key:"ICICI Bank Debit Card",label:"ICICI Bank Debit Card"},
        {key:"HDFC Bank Debit Card",label:"HDFC Bank Debit Card"},
        {key:"Axis Bank Debit Card",label:"Axis Bank Debit Card"}
      ],
      wallet:[
        {key:"Paytm Wallet",label:"Paytm Wallet"},
        {key:"PhonePe Wallet",label:"PhonePe Wallet"},
        {key:"Amazon Pay Wallet",label:"Amazon Pay Wallet"}
      ],
      upi:[{key:"UPI",label:"UPI"}],
      netBanking:[
        {key:"ICICI NetBanking",label:"ICICI NetBanking"},
        {key:"HDFC NetBanking",label:"HDFC NetBanking"},
        {key:"Axis NetBanking",label:"Axis NetBanking"}
      ],
      emi:[
        {key:"HDFC EMI",label:"HDFC EMI"},
        {key:"ICICI EMI",label:"ICICI EMI"}
      ]
    };
  }
}

function renderActiveTab() {
  const list = paymentState.categories[paymentState.activeTab] || [];
  if (!list.length) {
    modalBody.innerHTML = `<div class="empty">No options</div>`;
    return;
  }
  modalBody.innerHTML = list.map(opt => `
    <label class="pm-opt">
      <input type="checkbox" value="${opt.key.replace(/"/g,'&quot;')}" ${paymentState.selected.has(opt.key) ? 'checked':''}/>
      <span>${opt.label || opt.key}</span>
    </label>
  `).join("");
}

function openModal() {
  modal.classList.remove('hidden');
  renderActiveTab();
}
function closeModal() {
  modal.classList.add('hidden');
}

modalTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    modalTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    paymentState.activeTab = tab.dataset.tab;
    renderActiveTab();
  });
});

modalBody.addEventListener('change', (e) => {
  if (e.target && e.target.type === 'checkbox') {
    const key = e.target.value;
    if (e.target.checked) paymentState.selected.add(key);
    else paymentState.selected.delete(key);
  }
});

modalDone.addEventListener('click', () => {
  updatePayBtnLabel();
  closeModal();
});

modalClear.addEventListener('click', () => {
  paymentState.selected.clear();
  renderActiveTab();
  updatePayBtnLabel();
});

modalCloseArea?.addEventListener('click', (e) => {
  if (e.target === modalCloseArea) closeModal();
});

// ------- Search -------
async function doSearch() {
  // disable button to avoid double clicks
  searchBtn.disabled = true;
  showMessage(outList, "Searching…");
  showMessage(retList, "Searching…");

  try {
    const payload = {
      from: (fromInput.value || "BOM").toUpperCase(),
      to: (toInput.value || "DEL").toUpperCase(),
      departureDate: yyyymmddFromDDMMYYYY(depInput.value),
      returnDate: roundTripRadio.checked ? yyyymmddFromDDMMYYYY(retInput.value) : "",
      passengers: Number(paxSelect.value || "1"),
      travelClass: cabinSelect.value || "Economy",
      tripType: oneWayRadio.checked ? "one-way" : "round-trip",
      paymentMethods: Array.from(paymentState.selected)
    };

    const r = await fetch(`${API_BASE}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json();

    // Support both our mock structure and provider structure
    const outbound = data?.outbound || data?.outboundFlights || data?.flights || [];
    const inbound  = data?.return  || data?.returnFlights  || data?.returning || [];

    renderFlights(outList, outbound);
    renderFlights(retList, inbound);
  } catch (e) {
    showMessage(outList, "Error fetching flights");
    showMessage(retList, "Error fetching flights");
  } finally {
    searchBtn.disabled = false;
  }
}

// ------- Wire up -------
async function init() {
  // starting label
  updatePayBtnLabel();

  // load payment categories/options once
  await loadPaymentMethods();

  // open modal on click
  payBtn.addEventListener('click', openModal);

  // search
  searchBtn.addEventListener('click', doSearch);

  // one-way toggle hides/shows return field
  oneWayRadio.addEventListener('change', () => {
    if (oneWayRadio.checked) {
      retInput.parentElement.classList.add('hidden');
    }
  });
  roundTripRadio.addEventListener('change', () => {
    if (roundTripRadio.checked) {
      retInput.parentElement.classList.remove('hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
