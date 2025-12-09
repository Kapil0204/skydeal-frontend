// ===== Config =====
const API_BASE = 'https://skydeal-backend.onrender.com';
const PAGE_SIZE = 10; // keep <= your current visual density

// ===== Global state (front-end only) =====
const state = {
  outbound: [],
  outboundPage: 1,
  return: [],
  returnPage: 1,
  meta: null,
};

window.selectedPaymentMethods = []; // set by modal

// ===== Utilities =====
const inrFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
function formatINR(n) { return inrFmt.format(Number(n || 0)); }

function el(id){ return document.getElementById(id); }

function paginate(list, page) {
  const start = (page - 1) * PAGE_SIZE;
  return list.slice(start, start + PAGE_SIZE);
}

function setPageLabels() {
  const outPages = Math.max(1, Math.ceil(state.outbound.length / PAGE_SIZE));
  const retPages = Math.max(1, Math.ceil(state.return.length / PAGE_SIZE));
  el('outboundPageLabel').textContent = `Page ${state.outboundPage} / ${outPages}`;
  el('returnPageLabel').textContent   = `Page ${state.returnPage} / ${retPages}`;
}

// ===== Rendering =====
function flightTitle(f) {
  if (f.airlineName && f.flightNumber && f.departureTime && f.arrivalTime) {
    return `${f.airlineName} • ${f.flightNumber}  •  ${f.departureTime} → ${f.arrivalTime}`;
  }
  if (f.title) return f.title;
  return `${f.airlineName || 'Flight'}${f.flightNumber ? ' • ' + f.flightNumber : ''}`;
}

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

// ===== Modals =====
function openModal(id){
  const m = el(id);
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden','false');
}
function closeModal(id){
  const m = el(id);
  m.classList.add('hidden');
  m.setAttribute('aria-hidden','true');
}

// Payment Methods modal
async function loadPaymentOptions() {
  try {
    const r = await fetch(`${API_BASE}/payment-options`, { method: 'GET' });
    const json = await r.json();
    return json?.options || {};
  } catch {
    return {
      'Credit Card': ['Axis Bank','Federal Bank','HDFC Bank','ICICI Bank','Kotak Bank','RBL Bank','Yes Bank'],
      'Debit Card': ['Axis Bank','HDFC Bank','ICICI Bank'],
      'Net Banking': ['HDFC Bank','ICICI Bank','SBI'],
      'UPI': ['UPI'],
      'Wallet': ['Paytm Wallet','Mobikwik'],
      'EMI': ['HDFC Bank','Axis Bank','Yes Bank'],
    };
  }
}

async function showPaymentModal() {
  const container = el('paymentOptionsContainer');
  container.innerHTML = '<div class="small muted">Loading…</div>';

  const opts = await loadPaymentOptions();

  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => t.classList.remove('active'));
  tabs[0].classList.add('active');

  const renderRows = (cat) => {
    container.innerHTML = '';
    const list = opts[cat] || [];
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
    const currentTab = document.querySelector('.tab.active')?.dataset.tab;
    const others = window.selectedPaymentMethods.filter(x => !(opts[currentTab]||[]).includes(x));
    window.selectedPaymentMethods = Array.from(new Set([...others, ...picked]));
    closeModal('paymentsModal');
  };

  openModal('paymentsModal');
}

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
async function doSearch({ from, to, departureDate, returnDate, tripType, passengers, travelClass, paymentMethods }) {
  const body = {
    from, to,
    departureDate,
    returnDate: tripType === 'round-trip' ? (returnDate || '') : '',
    tripType,
    passengers,
    travelClass,
    paymentMethods
  };

  const r = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    alert('Search failed. Please try again.');
    return;
  }

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

    if (!from || !to || !departureDate) {
      alert('Please fill From, To, and Departure.');
      return;
    }

    await doSearch({
      from,to,departureDate,returnDate,tripType,passengers,travelClass,
      paymentMethods: window.selectedPaymentMethods
    });
  });

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
}); // end DOMContentLoaded
