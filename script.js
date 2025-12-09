// ======= CONFIG =======
const API_BASE = 'https://skydeal-backend.onrender.com';

// ======= STATE =======
const state = {
  selectedMethods: [],         // array of strings like ["HDFC Bank","ICICI Bank", ...]
  paymentOptions: null,        // fetched from /payment-options { options:{CreditCard:[...], ...} }
  pageSize: 12,
  outPage: 1,
  retPage: 1,
  outFlights: [],
  retFlights: [],
};

// ======= DOM HELPERS =======
const $ = (id) => document.getElementById(id);
const bySel = (sel) => document.querySelector(sel);
function fmtINR(n) { try { return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(Number(n)); } catch { return `₹${n}`; } }
function safeText(x){ return (x==null?'':String(x)); }
function ensureArray(x){ return Array.isArray(x)?x:[]; }

// Try to attach to either "openPaymentBtn" or the old button if it has data-role
const btnPayment = $('openPaymentBtn') || bySel('[data-role="open-payment"]') || bySel('#paymentBtn');
const btnSearch  = $('searchBtn') || bySel('#search');

// Inputs (keep your existing IDs)
const inpFrom    = $('from');
const inpTo      = $('to');
const inpDep     = $('departure');
const inpRet     = $('return');
const selPax     = $('passengers');
const selCabin   = $('cabin');
const rOneWay    = $('tripOneWay');
const rRoundTrip = $('tripRoundTrip');

const outList    = $('outboundList');
const retList    = $('returnList');

// Payment modal bits
const dlgPay       = $('paymentModal');
const payTabs      = $('paymentTabs');     // container with category tabs
const payList      = $('paymentList');     // container where we render checkboxes
const payDone      = $('paymentDone');
const payClear     = $('paymentClear');
const payClose     = $('paymentClose');
const payCount     = $('paymentCount');

// Price modal bits
const dlgPrice     = $('priceModal');
const priceClose   = $('priceClose');
const priceTitle   = $('priceTitle');
const priceTBody   = $('priceTableBody');
const priceWhy     = $('priceWhy');

// ======= PAYMENT OPTIONS =======
async function loadPaymentOptions() {
  if (state.paymentOptions) return state.paymentOptions;
  const res = await fetch(`${API_BASE}/payment-options`, { method:'GET' });
  const json = await res.json();
  state.paymentOptions = json; // { options: { CreditCard:[...], DebitCard:[...], ... } }
  return json;
}

function renderPaymentCategory(catName, items) {
  // items: array of strings (bank names)
  payList.innerHTML = '';
  const frag = document.createDocumentFragment();
  ensureArray(items).forEach((name, idx) => {
    const id = `pay_${catName}_${idx}`;
    const wrap = document.createElement('label');
    wrap.className = 'pay-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.value = name;
    cb.checked = state.selectedMethods.includes(name);
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!state.selectedMethods.includes(name)) state.selectedMethods.push(name);
      } else {
        state.selectedMethods = state.selectedMethods.filter(v => v !== name);
      }
      updatePaymentCount();
    });

    const span = document.createElement('span');
    span.textContent = name;

    wrap.appendChild(cb);
    wrap.appendChild(span);
    frag.appendChild(wrap);
  });
  payList.appendChild(frag);
}

function updatePaymentCount() {
  if (payCount) payCount.textContent = `Selected (${state.selectedMethods.length})`;
}

// Build tabs (Credit Card, Debit Card, Net Banking, UPI, Wallet, EMI)
function buildPaymentTabs(opts) {
  // opts.options = { CreditCard:[...], DebitCard:[...], NetBanking:[...], UPI:[...], Wallet:[...], EMI:[...] }
  if (!payTabs) return;
  payTabs.innerHTML = '';

  const cats = [
    ['Credit Card','CreditCard'],
    ['Debit Card','DebitCard'],
    ['Net Banking','NetBanking'],
    ['UPI','UPI'],
    ['Wallet','Wallet'],
    ['EMI','EMI']
  ];

  cats.forEach(([label, key], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill' + (i===0 ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      // toggle active
      [...payTabs.querySelectorAll('.pill')].forEach(p=>p.classList.remove('active'));
      b.classList.add('active');
      renderPaymentCategory(label, ensureArray(opts.options?.[key]));
    });
    payTabs.appendChild(b);
  });

  // initial render
  renderPaymentCategory('Credit Card', ensureArray(opts.options?.CreditCard));
  updatePaymentCount();
}

async function openPaymentModal() {
  try {
    await loadPaymentOptions();
    buildPaymentTabs(state.paymentOptions);
    dlgPay?.classList.add('open');
  } catch (e) {
    console.error('payment modal failed', e);
    alert('Could not load payment options.');
  }
}
function closePaymentModal(){ dlgPay?.classList.remove('open'); }
function clearPaymentSelection(){ state.selectedMethods = []; updatePaymentCount(); // re-render current tab to clear checks
  const active = payTabs?.querySelector('.pill.active');
  if (active) active.click();
}

// ======= SEARCH =======
function buildSearchBody() {
  const from = safeText(inpFrom?.value).trim().toUpperCase();
  const to   = safeText(inpTo?.value).trim().toUpperCase();
  const departureDate = safeText(inpDep?.value).trim();
  const returnDate    = safeText(inpRet?.value).trim();
  const adults = Number(selPax?.value || 1);
  const cabin  = safeText(selCabin?.value || 'Economy');

  const tripType = rOneWay?.checked ? 'one-way' : 'round-trip';

  return {
    from, to,
    departureDate,
    returnDate: tripType === 'round-trip' ? returnDate : '',
    tripType,
    passengers: adults,
    travelClass: cabin.toLowerCase(),
    paymentMethods: [...state.selectedMethods], // send only names; backend maps to offers
  };
}

async function doSearch() {
  // basic guard
  if (!inpFrom?.value || !inpTo?.value || !inpDep?.value) {
    alert('Please fill From, To, and Departure.');
    return;
  }

  const body = buildSearchBody();

  // reset paging
  state.outPage = 1;
  state.retPage = 1;

  // UI clear
  outList && (outList.innerHTML = '');
  retList && (retList.innerHTML = '');

  // call backend
  let res, json;
  try {
    res = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body),
    });
    json = await res.json();
  } catch (e) {
    console.error('search failed', e);
    alert('Search failed. Please try again.');
    return;
  }

  state.outFlights = ensureArray(json.outboundFlights);
  state.retFlights = ensureArray(json.returnFlights);

  // render first pages
  renderFlights();
}

function renderFlights() {
  renderList(outList, state.outFlights, state.outPage, 'Outbound');
  renderList(retList, state.retFlights, state.retPage, 'Return');
}

function paginate(arr, page, size) {
  const start = (page-1)*size;
  return arr.slice(start, start+size);
}

function renderList(container, flights, page, label) {
  if (!container) return;
  container.innerHTML = '';

  const pageItems = paginate(flights, page, state.pageSize);

  pageItems.forEach(f => {
    const card = document.createElement('div');
    card.className = 'flight-card';

    const title = document.createElement('div');
    // Simple title: Airline • times • stops
    const airline = safeText(f.airlineName || f.carrier || 'Carrier');
    const times = `${safeText(f.departureTime || '')} → ${safeText(f.arrivalTime || '')}`.replace(/^ → $/,'');
    const stops = (f.stops == null || Number(f.stops)===0) ? 'Non-stop' : `${f.stops} stop${Number(f.stops)>1?'s':''}`;
    title.className = 'flight-title';
    title.textContent = `${airline} • ${times || (safeText(f.flightNumber||'').trim())} • ${stops}`;

    const best = document.createElement('div');
    best.className = 'best-line';
    const bestDeal = f.bestDeal;
    if (bestDeal?.portal && bestDeal?.finalPrice != null) {
      best.innerHTML = `Best: <strong>${fmtINR(bestDeal.finalPrice)}</strong> on <strong>${bestDeal.portal}</strong><br/><span class="best-note">Best price after applicable offers (if any)</span>`;
    } else {
      best.textContent = `Best: ${fmtINR(f.price || f.basePrice || 0)}`;
    }

    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    btn.textContent = 'Prices & breakdown';
    btn.addEventListener('click', () => openPriceModal(f, label));

    card.appendChild(title);
    card.appendChild(best);
    card.appendChild(btn);
    container.appendChild(card);
  });

  // Footer pager (keep existing pager outside in your HTML)
}

// ======= PRICE MODAL =======
function openPriceModal(f, listLabel) {
  // Title: Airline + times + Base ₹X
  const airline = safeText(f.airlineName || f.carrier || 'Carrier');
  const times = `${safeText(f.departureTime || '')} → ${safeText(f.arrivalTime || '')}`.replace(/^ → $/,'');
  const base = f.price || f.basePrice;
  priceTitle.textContent = `${airline}${times ? ' • ' + times : ''} • Base ${fmtINR(base)}`;

  // table rows
  priceTBody.innerHTML = '';
  const rows = ensureArray(f.portalPrices).map(p => {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.textContent = p.portal;
    const td2 = document.createElement('td'); td2.textContent = fmtINR(p.finalPrice);
    const td3 = document.createElement('td'); td3.textContent = p.source || '';
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    return tr;
  });
  rows.forEach(r => priceTBody.appendChild(r));

  // why (from backend per-flight debug, if attached)
  // If your backend attaches a per-flight offerDebug, show it; else show empty object.
  priceWhy.textContent = JSON.stringify(f.offerWhy || {}, null, 2);

  dlgPrice?.classList.add('open');
}
function closePriceModal(){ dlgPrice?.classList.remove('open'); }

// ======= WIRE EVENTS =======
function wire() {
  // Payment modal buttons
  btnPayment?.addEventListener('click', openPaymentModal);
  payDone?.addEventListener('click', closePaymentModal);
  payClose?.addEventListener('click', closePaymentModal);
  payClear?.addEventListener('click', clearPaymentSelection);

  // Search
  btnSearch?.addEventListener('click', doSearch);

  // Price modal close
  priceClose?.addEventListener('click', closePriceModal);

  // One-way toggle to disable/enable return date
  rOneWay?.addEventListener('change', () => {
    if (rOneWay.checked) { if (inpRet) { inpRet.disabled = true; inpRet.value = ''; } }
  });
  rRoundTrip?.addEventListener('change', () => {
    if (rRoundTrip.checked) { if (inpRet) { inpRet.disabled = false; } }
  });
}

// ======= INIT =======
document.addEventListener('DOMContentLoaded', wire);
