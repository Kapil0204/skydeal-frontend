/* ==== SkyDeal - script.js (full file) ==== */

/* ---------- tiny helpers ---------- */
const API_BASE = 'https://skydeal-backend.onrender.com';
const qs  = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];
const on  = (el, ev, fn) => el && el.addEventListener(ev, fn);

const log = (...a) => console.log('[SkyDeal]', ...a);

/* ---------- DOM refs (match your current layout) ---------- */
const fromInput       = qs('#from');
const toInput         = qs('#to');
const departInput     = qs('#depart');
const returnInput     = qs('#return');
const paxSelect       = qs('#passengers');
const cabinSelect     = qs('#cabin');
const searchBtn       = qs('#searchBtn') || qs('button[data-role="search"]');

const tripOneRadio    = qs('#trip-oneway');
const tripRoundRadio  = qs('#trip-round');

const paymentBtn      = qs('#paymentBtn') || qs('#paymentMethodsBtn') || qs('button[data-role="payment"]');
const paymentBadge    = qs('#paymentSelectedCount'); // small (n) beside "Payment methods"
const paymentModal    = qs('#paymentModal');
const paymentTabsRow  = qs('#paymentTabs'); // container for 5 tabs
const paymentListBox  = qs('#paymentList'); // list that holds banks with checkboxes
const paymentDoneBtn  = qs('#btnPaymentDone');
const paymentClearBtn = qs('#btnPaymentClear');
const paymentCloseX   = qs('#btnPaymentClose');

const outList         = qs('#outboundList') || qs('#outboundResults');
const retList         = qs('#returnList')   || qs('#returnResults');

const outPageInfo     = qs('#outPageInfo');
const retPageInfo     = qs('#retPageInfo');

/* ---------- state ---------- */
const CategoryOrder = ['Credit Card', 'Debit Card', 'Net Banking', 'UPI', 'Wallet'];
let paymentOptions  = { 'Credit Card':[], 'Debit Card':[], 'Net Banking':[], 'UPI':[], 'Wallet':[] };
let selectedFilters = []; // array of {type, bank}

/* ---------- utils ---------- */
function toYMD(dmy) {
  // accepts 'dd/mm/yyyy' or 'yyyy-mm-dd'
  if (!dmy) return '';
  if (dmy.includes('-') && dmy.indexOf('-') === 4) return dmy; // already yyyy-mm-dd
  const [dd, mm, yyyy] = dmy.split('/');
  if (!dd || !mm || !yyyy) return '';
  return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
}

function cleanBankList(arr) {
  if (!Array.isArray(arr)) return [];
  const bad = /(not applicable|not\s+applicable|wallet\s*-\s*bonus|3rd party|gift card|pay ?pal)/i;
  const set = new Set();
  arr.forEach(x => {
    if (!x || typeof x !== 'string') return;
    const s = x.trim();
    if (!s || bad.test(s)) return;      // filter out T&C-like junk lines
    set.add(s);
  });
  return [...set].sort((a,b) => a.localeCompare(b));
}

function updatePaymentBadge() {
  if (!paymentBadge) return;
  paymentBadge.textContent = `(${selectedFilters.length})`;
}

/* ---------- Payment modal ---------- */
async function loadPaymentOptions() {
  try {
    const r = await fetch(`${API_BASE}/payment-options`);
    const data = await r.json();
    log('/payment-options', data);

    const opts = data?.options || {};
    paymentOptions = {
      'Credit Card' : cleanBankList(opts['Credit Card']),
      'Debit Card'  : cleanBankList(opts['Debit Card']),
      'Net Banking' : cleanBankList(opts['Net Banking']),
      'UPI'         : cleanBankList(opts['UPI']),
      'Wallet'      : cleanBankList(opts['Wallet']),
    };
  } catch (e) {
    console.error('Failed to load payment options', e);
    paymentOptions = { 'Credit Card':[], 'Debit Card':[], 'Net Banking':[], 'UPI':[], 'Wallet':[] };
  }
}

function openPaymentModal() {
  if (!paymentModal) return;
  paymentModal.style.display = 'grid';
  document.body.style.overflow = 'hidden';
  // default tab = credit card
  renderPaymentTab('Credit Card');
}

function closePaymentModal() {
  if (!paymentModal) return;
  paymentModal.style.display = 'none';
  document.body.style.overflow = '';
}

function isChecked(type, bank) {
  return selectedFilters.some(f => f.type === type && f.bank === bank);
}

function toggleSelection(type, bank, checked) {
  if (checked) {
    if (!isChecked(type, bank)) selectedFilters.push({ type, bank });
  } else {
    selectedFilters = selectedFilters.filter(f => !(f.type === type && f.bank === bank));
  }
  updatePaymentBadge();
}

function renderTabs() {
  if (!paymentTabsRow) return;
  paymentTabsRow.innerHTML = '';
  CategoryOrder.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip tab';
    btn.textContent = cat;
    on(btn, 'click', () => renderPaymentTab(cat));
    paymentTabsRow.appendChild(btn);
  });
}

function renderPaymentTab(category) {
  if (!paymentListBox) return;
  const banks = paymentOptions[category] || [];
  paymentListBox.innerHTML = '';

  if (banks.length === 0) {
    const p = document.createElement('p');
    p.className = 'text-dim';
    p.textContent = 'No options';
    paymentListBox.appendChild(p);
    return;
  }

  banks.forEach(bank => {
    const row = document.createElement('label');
    row.className = 'row bank';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isChecked(category, bank);
    on(cb, 'change', (e) => toggleSelection(category, bank, e.target.checked));

    const span = document.createElement('span');
    span.textContent = bank;

    row.appendChild(cb);
    row.appendChild(span);
    paymentListBox.appendChild(row);
  });
}

/* ---------- Search + render ---------- */
function currentTripType() {
  if (tripOneRadio && tripOneRadio.checked) return 'one-way';
  if (tripRoundRadio && tripRoundRadio.checked) return 'round-trip';
  // default to round-trip like your UI
  return 'round-trip';
}

async function doSearch() {
  // gather inputs
  const from = (fromInput?.value || '').trim().toUpperCase();
  const to   = (toInput?.value || '').trim().toUpperCase();
  const tripType = currentTripType();

  const departureDate = toYMD(departInput?.value || '');
  const returnDate    = tripType === 'round-trip' ? toYMD(returnInput?.value || '') : '';

  const passengers  = Number(paxSelect?.value || 1);
  const travelClass = (cabinSelect?.value || 'economy').toLowerCase();

  const body = {
    from, to, departureDate, returnDate, tripType, passengers, travelClass,
    paymentFilters: selectedFilters
  };

  log('/search payload', body);

  try {
    const r = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    log('/search meta', data?.meta);

    // Always handle gracefully
    const outs = Array.isArray(data?.outboundFlights) ? data.outboundFlights : [];
    const rets = Array.isArray(data?.returnFlights)   ? data.returnFlights   : [];

    renderFlights(outList, outs, 'Outbound');
    renderFlights(retList, rets, 'Return');

    if (outPageInfo) outPageInfo.textContent = 'Page 1 / 1';
    if (retPageInfo) retPageInfo.textContent = 'Page 1 / 1';

  } catch (e) {
    console.error('Search failed', e);
    renderFlights(outList, [], 'Outbound');
    renderFlights(retList, [], 'Return');
  }
}

function pick(val, ...keys) {
  // safe getter for nested API variability
  for (const k of keys) {
    if (val && val[k] != null) return val[k];
  }
  return undefined;
}

function renderFlights(container, items, label) {
  if (!container) return;
  container.innerHTML = '';

  if (!items || items.length === 0) {
    const div = document.createElement('div');
    div.className = 'empty';
    div.textContent = `No flights found for your search.`;
    container.appendChild(div);
    return;
  }

  items.forEach((it) => {
    // FlightAPI can vary; pull best-effort fields
    const airline = pick(it, 'airlineName', 'airline', 'carrierName') || 'Airline';
    const number  = pick(it, 'flightNumber', 'number', 'code') || '';
    const dep     = pick(it, 'departureTime', 'departure', 'depTime') || '';
    const arr     = pick(it, 'arrivalTime', 'arrival', 'arrTime') || '';
    const price   = pick(it, 'price', 'total', 'fare', 'amount');

    const card = document.createElement('div');
    card.className = 'flight-card';

    const title = document.createElement('div');
    title.className = 'flight-title';
    title.textContent = `${airline}${number ? ' • ' + number : ''}`;

    const times = document.createElement('div');
    times.className = 'flight-times';
    times.textContent = `${dep || '--:--'} → ${arr || '--:--'}`;

    const best = document.createElement('div');
    best.className = 'flight-best';
    if (typeof price === 'number') {
      best.textContent = `Base: ₹${price}`;
    } else if (typeof price === 'string') {
      best.textContent = `Base: ${price}`;
    } else {
      best.textContent = `Base: —`;
    }

    // You already show a “Prices & breakdown” button; keep DOM clean here
    const actions = document.createElement('div');
    actions.className = 'flight-actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline';
    btn.textContent = 'Prices & breakdown';
    // keep placeholder click (don’t change existing modal flow)
    on(btn, 'click', () => {
      alert('Portal pricing modal will open here (kept as-is).');
    });

    actions.appendChild(btn);

    card.appendChild(title);
    card.appendChild(times);
    card.appendChild(best);
    card.appendChild(actions);

    container.appendChild(card);
  });
}

/* ---------- wire up ---------- */
async function init() {
  // Render tabs skeleton once
  renderTabs();
  await loadPaymentOptions();
  updatePaymentBadge();

  // open modal
  on(paymentBtn, 'click', () => openPaymentModal());
  on(paymentCloseX, 'click', () => closePaymentModal());
  on(paymentDoneBtn, 'click', () => { closePaymentModal(); updatePaymentBadge(); });
  on(paymentClearBtn, 'click', () => {
    selectedFilters = [];
    updatePaymentBadge();
    // re-render current tab to uncheck all
    renderPaymentTab('Credit Card');
  });

  // close modal if user clicks backdrop
  on(paymentModal, 'click', (e) => {
    if (e.target === paymentModal) closePaymentModal();
  });

  // make tab buttons interactive even if layout changes their container
  if (paymentTabsRow) {
    // already wired in renderTabs()
  }

  // search
  on(searchBtn, 'click', doSearch);
}

document.addEventListener('DOMContentLoaded', init);

/* ===== End file ===== */
