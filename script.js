/* ===== SkyDeal Frontend Logic ===== */

const API_BASE = 'https://skydeal-backend.onrender.com'; // change if your backend URL differs

// DOM
const btnSearch = document.getElementById('searchBtn');
const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const departDate = document.getElementById('departDate');
const returnDate = document.getElementById('returnDate');
const paxSelect = document.getElementById('paxSelect');
const cabinSelect = document.getElementById('cabinSelect');
const tripOneWay = document.getElementById('tripOneWay');
const tripRound = document.getElementById('tripRound');

const outboundList = document.getElementById('outboundList');
const returnList = document.getElementById('returnList');

// Payment UI
const paymentSelectBtn = document.getElementById('paymentSelectBtn');
const paymentSelectBtnLabel = document.getElementById('paymentSelectBtnLabel');
const paymentOverlay = document.getElementById('paymentOverlay');
const paymentModal = document.getElementById('paymentModal');
const pmTabs = document.querySelectorAll('.pm-tab');
const pmPanels = document.querySelectorAll('[data-pm-panel]');
const pmDoneBtn = document.getElementById('pmDoneBtn');
const pmClearBtn = document.getElementById('pmClearBtn');

// Internal state
let paymentData = {
  creditCard: [],
  debitCard: [],
  wallet: [],
  upi: [],
  netBanking: [],
  emi: [],
};
let selectedPayments = new Set(); // strings like "creditCard:ICICI Bank Credit Card"

// ---------- Helpers ----------
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

function setButtonCount() {
  const n = selectedPayments.size;
  paymentSelectBtnLabel.textContent = n > 0 ? `${n} selected` : 'Select Payment Methods';
}

function activeTabName() {
  const active = document.querySelector('.pm-tab.pm-tab-active');
  return active ? active.getAttribute('data-pm-tab') : 'creditCard';
}

function renderPanel(name) {
  const mapId = {
    creditCard: 'pm-list-credit',
    debitCard: 'pm-list-debit',
    wallet: 'pm-list-wallet',
    upi: 'pm-list-upi',
    netBanking: 'pm-list-netbanking',
    emi: 'pm-list-emi',
  };
  const listEl = document.getElementById(mapId[name]);
  listEl.innerHTML = '';

  const items = paymentData[name] || [];
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'pm-empty';
    empty.textContent = 'No options';
    listEl.appendChild(empty);
    return;
  }

  items.forEach(label => {
    const key = `${name}:${label}`;
    const li = document.createElement('li');
    li.className = 'pm-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selectedPayments.has(key);
    cb.addEventListener('change', () => {
      if (cb.checked) selectedPayments.add(key);
      else selectedPayments.delete(key);
      setButtonCount();
    });

    const span = document.createElement('span');
    span.textContent = label;

    li.appendChild(cb);
    li.appendChild(span);
    listEl.appendChild(li);
  });
}

function switchTab(name) {
  pmTabs.forEach(t => t.classList.toggle('pm-tab-active', t.dataset.pmTab === name));
  pmPanels.forEach(p => p.classList.toggle('hidden', p.dataset.pmPanel !== name));
  renderPanel(name);
}

function openPaymentModal() {
  show(paymentOverlay);
  show(paymentModal);
  // ensure the currently active tab is rendered
  renderPanel(activeTabName());
}

function closePaymentModal() {
  hide(paymentOverlay);
  hide(paymentModal);
}

// ---------- Fetch payment methods ----------
async function loadPaymentMethods() {
  try {
    const res = await fetch(`${API_BASE}/api/payment-methods`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Expected shape:
    // { creditCard:[], debitCard:[], wallet:[], upi:[], netBanking:[], emi:[] }
    paymentData = {
      creditCard: data.creditCard || [],
      debitCard: data.debitCard || [],
      wallet: data.wallet || [],
      upi: data.upi || [],
      netBanking: data.netBanking || [],
      emi: data.emi || [],
    };

    // Render the default (creditCard) once after load
    renderPanel('creditCard');
  } catch (e) {
    // fall back to empty lists; UI will show "No options"
    paymentData = { creditCard: [], debitCard: [], wallet: [], upi: [], netBanking: [], emi: [] };
    renderPanel('creditCard');
    console.warn('payment-methods fetch failed:', e.message);
  }
}

// ---------- Search ----------
function setListMessage(el, msg) {
  el.innerHTML = `<div class="empty">${msg}</div>`;
}

async function searchFlights() {
  // guard
  const from = (fromInput.value || '').trim().toUpperCase();
  const to = (toInput.value || '').trim().toUpperCase();
  const dep = departDate.value;
  const ret = returnDate.value;
  const pax = parseInt(paxSelect.value || '1', 10);
  const cabin = cabinSelect.value;
  const roundTrip = tripRound.checked;

  if (!from || !to || !dep || (roundTrip && !ret)) {
    setListMessage(outboundList, 'Please fill route and dates.');
    setListMessage(returnList, 'Please fill route and dates.');
    return;
  }

  setListMessage(outboundList, 'Searching…');
  setListMessage(returnList, roundTrip ? 'Searching…' : 'No flights');

  try {
    const res = await fetch(`${API_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to,
        departureDate: dep,
        returnDate: roundTrip ? ret : '',
        passengers: pax,
        cabinClass: cabin,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const out = Array.isArray(data.outbound) ? data.outbound : [];
    const retf = Array.isArray(data.return) ? data.return : [];

    renderFlights(outboundList, out);
    if (roundTrip) renderFlights(returnList, retf);
    else setListMessage(returnList, 'No flights');
  } catch (e) {
    setListMessage(outboundList, 'Error fetching flights');
    setListMessage(returnList, 'Error fetching flights');
    console.warn('search error:', e.message);
  }
}

function renderFlights(container, flights) {
  if (!flights.length) {
    setListMessage(container, 'No flights');
    return;
  }
  container.innerHTML = '';
  flights.forEach(f => {
    const card = document.createElement('div');
    card.className = 'flight-card';
    const t1 = document.createElement('div');
    t1.className = 'fc-title';
    t1.textContent = f.name || f.airline || 'Flight';

    const t2 = document.createElement('div');
    t2.className = 'fc-time';
    t2.textContent = `${f.departure || '--:--'} → ${f.arrival || '--:--'}`;

    const t3 = document.createElement('div');
    t3.className = 'fc-price';
    if (typeof f.price === 'number') t3.textContent = `₹${f.price}`;
    else t3.textContent = f.price || '';

    card.appendChild(t1);
    card.appendChild(t2);
    card.appendChild(t3);
    container.appendChild(card);
  });
}

// ---------- Wire up ----------
document.addEventListener('DOMContentLoaded', () => {
  // Init button count label
  setButtonCount();

  // Load payment data (non-blocking)
  loadPaymentMethods();

  // Payment modal triggers
  paymentSelectBtn.addEventListener('click', openPaymentModal);
  paymentOverlay.addEventListener('click', closePaymentModal);
  pmDoneBtn.addEventListener('click', closePaymentModal);

  pmClearBtn.addEventListener('click', () => {
    selectedPayments.clear();
    // uncheck all visible checkboxes
    document.querySelectorAll('.pm-item input[type="checkbox"]').forEach(cb => (cb.checked = false));
    setButtonCount();
  });

  // Tabs
  pmTabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.pmTab));
  });

  // ESC to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !paymentModal.classList.contains('hidden')) closePaymentModal();
  });

  // Search
  btnSearch.addEventListener('click', searchFlights);
});
