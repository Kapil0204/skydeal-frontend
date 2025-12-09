// ===== Config =====
const API_BASE = 'https://skydeal-backend.onrender.com';
const PAGE_SIZE = 10; // unchanged

// ===== Global state =====
const state = {
  outbound: [],
  outboundPage: 1,
  return: [],
  returnPage: 1,
  meta: null,
};
window.selectedPaymentMethods = [];

// ===== Utils =====
const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const formatINR = n => inrFmt.format(Number(n || 0));
const el = id => document.getElementById(id);
const paginate = (list, page) => list.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE);

function setPageLabels() {
  const outPages = Math.max(1, Math.ceil(state.outbound.length / PAGE_SIZE));
  const retPages = Math.max(1, Math.ceil(state.return.length / PAGE_SIZE));
  el('outboundPageLabel').textContent = `Page ${state.outboundPage} / ${outPages}`;
  el('returnPageLabel').textContent   = `Page ${state.returnPage} / ${retPages}`;
}

function flightTitle(f) {
  if (f.airlineName && f.flightNumber && f.departureTime && f.arrivalTime) {
    return `${f.airlineName} • ${f.flightNumber}  •  ${f.departureTime} → ${f.arrivalTime}`;
  }
  if (f.title) return f.title;
  return `${f.airlineName || 'Flight'}${f.flightNumber ? ' • ' + f.flightNumber : ''}`;
}

// ===== Rendering =====
function renderList(which) {
  const listEl  = el(which === 'out' ? 'outboundList' : 'returnList');
  const page    = which === 'out' ? state.outboundPage : state.returnPage;
  const flights = which === 'out' ? state.outbound    : state.return;

  const pages   = Math.max(1, Math.ceil(flights.length / PAGE_SIZE));
  const slice   = paginate(flights, Math.min(page, pages));
  listEl.innerHTML = '';

  slice.forEach((f, idx) => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const best = f.bestDeal
      ? `Best: ${formatINR(f.bestDeal.finalPrice)} on ${f.bestDeal.portal}`
      : 'Best price after applicable offers (if any)';

    card.innerHTML = `
      <p class="result-title">${flightTitle(f)}</p>
      <p class="result-sub">${f.stops ? (f.stops === 0 ? 'Non-stop' : `${f.stops} stop${f.stops>1?'s':''}`) : ' '}</p>
      <p class="best">${best}</p>
      <div class="row-actions">
        <button class="btn" data-idx="${idx}" data-which="${which}">Prices &amp; breakdown</button>
      </div>
    `;

    card.querySelector('button').addEventListener('click', (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      const w = e.currentTarget.dataset.which;
      const item = (w === 'out'
        ? paginate(state.outbound, state.outboundPage)
        : paginate(state.return, state.returnPage))[i];
      openPricesModal(item, state.meta?.offerDebug || {});
    });

    listEl.appendChild(card);
  });

  setPageLabels();
}

function renderAll() {
  renderList('out');
  renderList('ret');
}

// ===== Simple modal helpers =====
function openModal(id){
  const m = el(id);
  m.classList.remove('hidden');
  m.removeAttribute('aria-hidden');         // fix ARIA warning
  // Move focus to first actionable element if available
  const btn = m.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (btn) btn.focus();
}
function closeModal(id){
  const m = el(id);
  m.classList.add('hidden');
  m.setAttribute('aria-hidden','true');
  // Return focus to the opener if present
  if (id === 'paymentsModal') { el('openPaymentsBtn')?.focus(); }
  if (id === 'pricesModal')   { /* focus not critical here */ }
}

// ===== Payment Options =====
function normalizeCategories(raw) {
  // Accept both "CreditCard" and "Credit Card" style keys
  const map = new Map();
  const put = (key, arr) => {
    if (!arr || !Array.isArray(arr)) return;
    const prev = map.get(key) || [];
    map.set(key, prev.concat(arr));
  };
  // Known keys (multiple spellings)
  put('Credit Card', raw['Credit Card'] || raw['CreditCard']);
  put('Debit Card',  raw['Debit Card']  || raw['DebitCard']);
  put('Net Banking', raw['Net Banking'] || raw['NetBanking']);
  put('UPI',         raw['UPI']);
  put('Wallet',      raw['Wallet']);
  put('EMI',         raw['EMI']);

  // If backend returned a generic "options" object with those keys
  // already inside, flatten it.
  ['Credit Card','Debit Card','Net Banking','UPI','Wallet','EMI'].forEach(k => {
    if (!map.get(k) && raw?.options && raw.options[k]) put(k, raw.options[k]);
  });

  // Fallback if API returned top-level "options" only
  if (map.size === 0 && raw?.options) {
    Object.entries(raw.options).forEach(([k,v]) => put(k, v));
  }

  // Normalize item names (string or object) and dedupe+sort
  const normName = (x) => {
    if (typeof x === 'string') return x.trim();
    if (x && typeof x === 'object') {
      return (x.name || x.bank || x.title || '').toString().trim();
    }
    return '';
  };

  const out = {};
  for (const [k, arr] of map.entries()) {
    const cleaned = Array.from(
      new Set(
        (arr || []).map(normName).filter(Boolean)
      )
    ).sort((a,b) => a.localeCompare(b));
    if (cleaned.length) out[k] = cleaned;
  }
  return out;
}

async function loadPaymentOptions() {
  try {
    const r = await fetch(`${API_BASE}/payment-options`, { method: 'GET' });
    const json = await r.json();
    return normalizeCategories(json);
  } catch {
    // Safe, static fallback
    return {
      'Credit Card': ['Axis Bank','Federal Bank','HDFC Bank','ICICI Bank','Kotak Bank','RBL Bank','Yes Bank'],
      'Debit Card':  ['Axis Bank','HDFC Bank','ICICI Bank'],
      'Net Banking': ['HDFC Bank','ICICI Bank','SBI'],
      'UPI':         ['UPI'],
      'Wallet':      ['Paytm Wallet','Mobikwik'],
      'EMI':         ['HDFC Bank','Axis Bank','Yes Bank']
    };
  }
}

async function showPaymentModal() {
  const container = el('paymentOptionsContainer');
  container.innerHTML = '<div class="small muted">Loading…</div>';

  const opts = await loadPaymentOptions();

  // Activate first tab
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => t.classList.remove('active'));
  tabs[0]?.classList.add('active');

  const renderRows = (cat) => {
    container.innerHTML = '';
    const list = opts[cat] || [];
    if (!list.length) {
      container.innerHTML = `<div class="small muted">No options</div>`;
      return;
    }
    list.forEach(name => {
      const id = `opt-${cat}-${name}`.replace(/\s+/g,'-');
      const row = document.createElement('div');
      row.className = 'option-row';
      row.innerHTML = `
        <input type="checkbox" id="${id}">
        <label for="${id}">${name}</label>
        <div class="small muted">${cat}</div>
      `;
      if (window.selectedPaymentMethods.includes(name)) {
        row.querySelector('input').checked = true;
      }
      container.appendChild(row);
    });
  };

  renderRows('Credit Card');

  document.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRows(btn.dataset.tab);
    };
  });

  el('clearPaymentsBtn').onclick = () => {
    window.selectedPaymentMethods = [];
    container.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
  };
  el('donePaymentsBtn').onclick = () => {
    const checked = container.querySelectorAll('input[type="checkbox"]:checked');
    const picked  = Array.from(checked).map(c => c.nextElementSibling.textContent.trim());

    // Keep selections from other tabs
    const currentTab = document.querySelector('.tab.active')?.dataset.tab;
    const allKnown = Object.values(opts).flat();
    const others = window.selectedPaymentMethods.filter(x => !allKnown.includes(x) || !(opts[currentTab]||[]).includes(x));

    window.selectedPaymentMethods = Array.from(new Set([...others, ...picked]));
    closeModal('paymentsModal');
  };

  openModal('paymentsModal');
}

// ===== Prices modal =====
function openPricesModal(item, debug) {
  el('pricesTitle').textContent =
    `${flightTitle(item)}  •  Base ${formatINR(item.price || item.basePrice || 0)}`;
  const tb = el('pricesTableBody');
  tb.innerHTML = '';
  (item.portalPrices || []).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.portal}</td><td>${formatINR(p.finalPrice)}</td><td>${p.source}</td>`;
    tb.appendChild(tr);
  });
  el('offerReasons').textContent = JSON.stringify(debug || {}, null, 2);
  openModal('pricesModal');
}

// ===== Search =====
async function doSearch(payload) {
  const r = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) { alert('Search failed. Please try again.'); return; }
  const json = await r.json();

  state.meta = json.meta || null;
  state.outbound = Array.isArray(json.outboundFlights) ? json.outboundFlights : [];
  state.return   = Array.isArray(json.returnFlights)   ? json.returnFlights   : [];
  state.outboundPage = 1;
  state.returnPage   = 1;
  renderAll();
}

// ===== Wireup =====
document.addEventListener('DOMContentLoaded', () => {
  // Buttons
  el('openPaymentsBtn').addEventListener('click', (e) => { e.preventDefault(); showPaymentModal(); });
  el('closePaymentsBtn').addEventListener('click', () => closeModal('paymentsModal'));
  el('closePricesBtn').addEventListener('click', () => closeModal('pricesModal'));
  el('closePricesBtn2').addEventListener('click', () => closeModal('pricesModal'));

  el('searchBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    const from = el('from').value.trim();
    const to   = el('to').value.trim();
    const departureDate = el('departure').value;
    const returnDate    = el('return').value;
    const passengers    = parseInt(el('passengers').value || '1', 10);
    const travelClass   = (el('cabin').value || 'economy').toLowerCase();
    const tripType      = el('tripRound').checked ? 'round-trip' : 'one-way';
    if (!from || !to || !departureDate) { alert('Please fill From, To, and Departure.'); return; }
    await doSearch({
      from, to, departureDate,
      returnDate: tripType === 'round-trip' ? (returnDate || '') : '',
      tripType, passengers, travelClass,
      paymentMethods: window.selectedPaymentMethods
    });
  });

  // Pagination
  el('outboundPrev').onclick = () => { if (state.outboundPage > 1) { state.outboundPage--; renderList('out'); } };
  el('outboundNext').onclick = () => {
    const pages = Math.max(1, Math.ceil(state.outbound.length / PAGE_SIZE));
    if (state.outboundPage < pages) { state.outboundPage++; renderList('out'); }
  };
  el('returnPrev').onclick = () => { if (state.returnPage > 1) { state.returnPage--; renderList('ret'); } };
  el('returnNext').onclick = () => {
    const pages = Math.max(1, Math.ceil(state.return.length / PAGE_SIZE));
    if (state.returnPage < pages) { state.returnPage++; renderList('ret'); }
  };

  setPageLabels();
});
