// ===== Config =====
const API_BASE = 'https://skydeal-backend.onrender.com'; // your Render backend

// ===== State =====
const selectedMethods = new Set();
let currentTab = 'Credit Card';

// ===== Elements =====
const el = (id) => document.getElementById(id);
const fromEl = el('from');
const toEl = el('to');
const depEl = el('departure');
const retEl = el('return');
const paxEl = el('passengers');
const cabinEl = el('cabin');
const tripRadios = () => document.querySelector('input[name="tripType"]:checked');

const searchBtn = el('searchBtn');
const outList = el('outboundList');
const retList = el('returnList');

const pmBtn = el('paymentsBtn');
const pmBadge = el('paymentsBadge');
const pmModal = el('paymentsModal');
const pmClose = el('pmClose');
const pmDone = el('pmDone');
const pmClear = el('pmClear');
const pmTabs = document.querySelectorAll('.pm-tabs .tab');
const pmList = el('pmList');

// ===== Utilities =====
function setListMessage(listId, msg) {
  const target = el(listId);
  if (!target) return;
  target.innerHTML = msg ? `<div class="empty">${msg}</div>` : '';
}
function clearList(id) { setListMessage(id, ''); }

function setLoading(on) {
  if (!searchBtn) return;
  searchBtn.disabled = on;
  searchBtn.textContent = on ? 'Searching…' : 'Search';
}

function updateBadge() {
  const n = selectedMethods.size;
  pmBadge.textContent = n ? `Selected (${n})` : '';
  pmBadge.setAttribute('aria-hidden', n ? 'false' : 'true');
}

function optionRow(key, label) {
  const id = `pm_${key}`;
  const checked = selectedMethods.has(label) ? 'checked' : '';
  return `
    <div class="pm-row">
      <label for="${id}">
        <input id="${id}" type="checkbox" data-value="${label}" ${checked}/>
        <span>${label}</span>
      </label>
    </div>`;
}

// Simple catalog; your backend decides applicability at /search
const CATALOG = {
  'Credit Card': ['HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Yes Bank', 'Kotak Bank', 'RBL Bank', 'Federal Bank', 'SBI Card', 'HSBC Bank', 'AU Bank'],
  'Debit Card':  ['HDFC Bank', 'ICICI Bank', 'Axis Bank', 'SBI', 'Kotak Bank'],
  'Net Banking': ['HDFC Bank', 'ICICI Bank', 'Axis Bank', 'SBI', 'Kotak Bank'],
  'UPI':         ['UPI'],
  'Wallet':      ['Paytm Wallet', 'Amazon Pay'],
  'EMI':         ['HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Yes Bank', 'RBL Bank', 'Federal Bank'],
};

function renderPmList(tab) {
  const items = CATALOG[tab] || [];
  pmList.innerHTML = items.length
    ? items.map((name, i) => optionRow(`${tab}_${i}`, name)).join('')
    : `<div class="empty">No options</div>`;

  // wire up
  pmList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const v = e.target.dataset.value;
      if (!v) return;
      if (e.target.checked) selectedMethods.add(v);
      else selectedMethods.delete(v);
      updateBadge();
    });
  });
}

function setActiveTab(btn) {
  pmTabs.forEach(t => t.classList.toggle('active', t === btn));
  currentTab = btn.dataset.tab;
  renderPmList(currentTab);
}

// ===== Payments modal wiring =====
pmBtn.addEventListener('click', () => {
  pmModal.setAttribute('aria-hidden', 'false');
  renderPmList(currentTab);
});
pmClose.addEventListener('click', () => {
  pmModal.setAttribute('aria-hidden', 'true');
});
pmDone.addEventListener('click', () => {
  pmModal.setAttribute('aria-hidden', 'true');
});
pmClear.addEventListener('click', () => {
  selectedMethods.clear();
  renderPmList(currentTab);
  updateBadge();
});
pmTabs.forEach(btn => btn.addEventListener('click', () => setActiveTab(btn)));
updateBadge(); // initial

// ===== Rendering flights (kept minimal; no layout change) =====
function renderFlights(listId, flights) {
  const list = el(listId);
  if (!list) return;
  if (!Array.isArray(flights) || flights.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = flights.map(f => {
    const title = f.title || `${f.airlineName || 'Airline'} • ${f.flightNumber || ''}`.trim();
    const sub = f.sub || `${(f.stops === 0 || f.nonStop) ? 'Non-stop' : (f.stops ? `${f.stops} stop` : '')}`;
    const best = f.bestDeal ? `Best: ₹${f.bestDeal.finalPrice?.toLocaleString?.('en-IN') || f.bestDeal.finalPrice} on ${f.bestDeal.portal}` : '';
    return `
      <div class="card">
        <div class="title">${title}</div>
        <div class="sub">${sub}</div>
        <div class="row">
          <div class="muted">${best || ''}</div>
          <button class="btn light" data-prices='${JSON.stringify(f.portalPrices || [])}'>Prices & breakdown</button>
        </div>
      </div>
    `;
  }).join('');

  // wire "Prices & breakdown" (simple alert for now to avoid UI changes)
  list.querySelectorAll('button[data-prices]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prices = JSON.parse(btn.dataset.prices || '[]');
      const text = prices.map(p => `${p.portal}: ₹${p.finalPrice} (${p.source})`).join('\n') || 'No data';
      alert(text);
    });
  });
}

// ===== Search handler (robust, with loading state & clear messages) =====
async function doSearch() {
  const from = fromEl.value.trim();
  const to = toEl.value.trim();
  const departureDate = depEl.value;
  const returnDate = retEl.value;
  const passengers = Number(paxEl.value || 1);
  const travelClass = cabinEl.value || 'economy';
  const tripType = tripRadios()?.value || 'round-trip';

  if (!from || !to || !departureDate) {
    alert('Please fill From, To, and Departure.');
    return;
  }

  setLoading(true);
  setListMessage('outboundList', 'Loading…');
  if (tripType === 'round-trip') setListMessage('returnList', 'Loading…'); else clearList('returnList');

  const payload = {
    from, to, departureDate,
    returnDate: tripType === 'round-trip' ? returnDate : '',
    tripType, passengers, travelClass,
    paymentMethods: Array.from(selectedMethods)
  };
  console.log('[SkyDeal] /search payload →', payload);

  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors',
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Search failed: ${res.status}`);

    const data = await res.json();
    console.log('[SkyDeal] /search response meta ←', {
      source: data?.meta?.source,
      outStatus: res.status, outCount: data?.outboundFlights?.length ?? 0,
      retStatus: res.status, retCount: data?.returnFlights?.length ?? 0,
    });

    renderFlights('outboundList', data.outboundFlights || []);
    if (tripType === 'round-trip') renderFlights('returnList', data.returnFlights || []);
    if ((data.outboundFlights || []).length === 0) setListMessage('outboundList', 'No flights found for your search.');
    if (tripType === 'round-trip' && (data.returnFlights || []).length === 0) setListMessage('returnList', 'No flights found for your search.');
  } catch (err) {
    console.error(err);
    setListMessage('outboundList', 'Failed to fetch flights.');
    if (tripType === 'round-trip') setListMessage('returnList', 'Failed to fetch flights.');
  } finally {
    setLoading(false);
  }
}

searchBtn.addEventListener('click', doSearch);

// ===== Defaults to help quick testing =====
(function initializeDates() {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  const r = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4);
  const toISO = (dt) => dt.toISOString().slice(0,10);
  depEl.value ||= toISO(d);
  retEl.value ||= toISO(r);
})();
