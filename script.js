// ===== Config =====
const API_BASE = 'https://skydeal-backend.onrender.com';
const PAGE_SIZE = 40; // keep a single definition

// ===== Global state =====
let outFlights = [];
let retFlights = [];
let outPage = 1;
let retPage = 1;
let outPages = 1;
let retPages = 1;
window.__selectedPaymentBanks = [];   // banks only, as strings
window.__paymentOptions = null;       // cache /payment-options
window.__paymentByTab = null;

// ===== Utilities =====
const qs = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const inr = n => `₹${Number(n).toLocaleString('en-IN')}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function sliceByPage(list, page) {
  const start = (page-1) * PAGE_SIZE;
  return list.slice(start, start + PAGE_SIZE);
}

// ===== Payment modal helpers =====
const TAB_KEYS = {
  'Credit Card': 'Credit Card',
  'Debit Card': 'Debit Card',
  'Net Banking': 'Net Banking',
  'UPI': 'UPI',
  'Wallet': 'Wallet',
  'EMI': 'EMI',
};

function groupOptionsByTab(payload) {
  const src = payload?.options ?? payload ?? {};
  const out = {
    'Credit Card': [],
    'Debit Card': [],
    'Net Banking': [],
    'UPI': [],
    'Wallet': [],
    'EMI': [],
  };
  const keyAliases = new Map([
    ['CreditCard', 'Credit Card'],
    ['Credit Cards', 'Credit Card'],
    ['credit', 'Credit Card'],
    ['DebitCard', 'Debit Card'],
    ['debit', 'Debit Card'],
    ['NetBanking', 'Net Banking'],
    ['netbanking', 'Net Banking'],
    ['upi', 'UPI'],
    ['wallets', 'Wallet'],
    ['emi', 'EMI'],
  ]);

  for (const [k, v] of Object.entries(src)) {
    let tab = TAB_KEYS[k] || keyAliases.get(k) || TAB_KEYS[k?.trim?.()] || null;
    if (!tab) continue;
    const arr = Array.isArray(v) ? v : [];
    for (const raw of arr) {
      const name = (typeof raw === 'string') ? raw.trim() : (raw?.bank || raw?.name || '').trim();
      if (name) out[tab].push({ name });
    }
  }

  for (const tab of Object.keys(out)) {
    const seen = new Set();
    out[tab] = out[tab].filter(({ name }) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }
  return out;
}

function renderPaymentList(tabKey, containerEl, selectedSet) {
  const list = window.__paymentByTab?.[tabKey] ?? [];
  containerEl.innerHTML = list.map(({ name }) => {
    const id = `pm_${tabKey}_${name.replace(/\s+/g, '_')}`;
    const checked = selectedSet.has(name) ? 'checked' : '';
    return `
      <label class="pm-row">
        <input type="checkbox" id="${id}" data-name="${name}" ${checked} />
        <span>${name}</span>
      </label>
    `;
  }).join('') || `<div class="pm-empty">No options</div>`;
}

// ===== Payment modal wiring =====
function closePaymentModal() {
  qs('#paymentModal').classList.remove('open');
}
async function openPaymentModal() {
  if (!window.__paymentOptions) {
    const res = await fetch(`${API_BASE}/payment-options`);
    window.__paymentOptions = await res.json();
    window.__paymentByTab = groupOptionsByTab(window.__paymentOptions);
  }

  const modal = qs('#paymentModal');
  const tabs = qsa('[data-tab]', modal);
  const listWrap = qs('.pm-list', modal);
  const doneBtn = qs('#pmDone', modal);
  const clearBtn = qs('#pmClear', modal);

  const selected = new Set(window.__selectedPaymentBanks || []);

  function activateTab(tabKey) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabKey));
    renderPaymentList(tabKey, listWrap, selected);
  }
  tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));

  listWrap.addEventListener('change', (e) => {
    const it = e.target.closest('input[type="checkbox"][data-name]');
    if (!it) return;
    const name = it.dataset.name;
    if (it.checked) selected.add(name);
    else selected.delete(name);
  });

  clearBtn.addEventListener('click', () => {
    selected.clear();
    const active = modal.querySelector('[data-tab].active')?.dataset.tab || 'Credit Card';
    renderPaymentList(active, listWrap, selected);
  });

  doneBtn.addEventListener('click', () => {
    window.__selectedPaymentBanks = Array.from(selected);
    const btn = qs('#openPaymentModalBtn');
    if (btn) {
      const n = selected.size;
      btn.textContent = n > 0 ? `Selected (${n})` : 'Select Payment Methods';
    }
    closePaymentModal();
  });

  qs('#pmClose').onclick = closePaymentModal;

  modal.classList.add('open');
  activateTab('Credit Card');
}

// ===== Breakdown modal =====
function openBreakdownModal(flight) {
  const m = qs('#breakdownModal');
  const hd = qs('#bdHeader');
  const body = qs('#bdBody');
  const why = qs('#bdWhy');

  const dep = flight.departureTime || flight.departure || '';
  const arr = flight.arrivalTime || flight.arrival || '';
  const base = flight.price ? inr(flight.price) : '-';
  hd.textContent = `${flight.airlineName || flight.airline || ''} • ${dep} → ${arr} • Base ${base}`;

  const rows = (flight.portalPrices || []).map(p => {
    const final = typeof p.finalPrice === 'number' ? inr(p.finalPrice) : (typeof p.finalPrice === 'string' ? `₹${p.finalPrice}` : '-');
    const src = p.source || '';
    const status = (src && src.includes('offer')) ? 'offer applied' : (src || '');
    return `<tr><td>${p.portal}</td><td>${final}</td><td>${src ? src.replace('+', '+') : ''} ${status ? '' : ''}</td></tr>`;
  }).join('');
  body.innerHTML = rows || '<tr><td colspan="3">No data</td></tr>';

  // Optional debug (if backend returns meta.offerDebug)
  why.textContent = JSON.stringify(window.__lastOfferDebug || {}, null, 2);

  m.classList.add('open');
}
function closeBreakdownModal() {
  qs('#breakdownModal').classList.remove('open');
}

// ===== Render cards =====
function renderFlightCard(flight) {
  const dep = flight.departureTime || flight.departure || '';
  const arr = flight.arrivalTime || flight.arrival || '';
  const stops = (flight.stops ?? flight.numStops ?? 0);
  const best = flight.bestDeal
    ? `Best: ${inr(flight.bestDeal.finalPrice)} on ${flight.bestDeal.portal}`
    : null;

  const btn = `<div class="actions"><button class="btn" data-breakdown>Prices &amp; breakdown</button></div>`;
  const bestLine = best ? `<div class="best">${best}</div>` : '';

  return `
    <div class="card" data-flight='${JSON.stringify(flight).replace(/'/g,"&#39;")}'>
      <div class="row">
        <div>
          <div class="airline">${flight.airlineName || flight.airline}</div>
          <div class="meta">${dep} → ${arr} • ${stops === 0 ? 'Non-stop' : (stops===1?'1 stop':`${stops} stops`)}</div>
        </div>
        <div class="right">
          ${bestLine}
          ${btn}
        </div>
      </div>
    </div>
  `;
}

function renderList(which) {
  if (which === 'out') {
    const el = qs('#outList');
    const pageList = sliceByPage(outFlights, outPage);
    el.innerHTML = pageList.map(renderFlightCard).join('');
    qs('#outPage').textContent = `Page ${outPage} / ${outPages}`;
  } else {
    const el = qs('#retList');
    const pageList = sliceByPage(retFlights, retPage);
    el.innerHTML = pageList.map(renderFlightCard).join('');
    qs('#retPage').textContent = `Page ${retPage} / ${retPages}`;
  }

  // bind breakdown buttons
  qsa('[data-breakdown]').forEach(btn => {
    btn.onclick = (e) => {
      const card = e.target.closest('.card');
      const flight = JSON.parse(card.getAttribute('data-flight'));
      openBreakdownModal(flight);
    };
  });
}

// ===== Search =====
async function doSearch() {
  const payload = {
    from: qs('#from').value.trim().toUpperCase(),
    to: qs('#to').value.trim().toUpperCase(),
    departureDate: qs('#departure').value,
    returnDate: (qs('input[name="tripType"]:checked')?.value === 'round-trip') ? qs('#return').value : undefined,
    tripType: qs('input[name="tripType"]:checked')?.value || 'one-way',
    passengers: Number(qs('#pax').value) || 1,
    travelClass: qs('#cabin').value || 'economy',
    paymentMethods: Array.from(window.__selectedPaymentBanks || []),
  };

  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  // keep offer debug for modal "why"
  window.__lastOfferDebug = data?.meta?.offerDebug || {};

  outFlights = Array.isArray(data?.outboundFlights) ? data.outboundFlights : [];
  retFlights = Array.isArray(data?.returnFlights) ? data.returnFlights : [];

  outPages = Math.max(1, Math.ceil(outFlights.length / PAGE_SIZE));
  retPages = Math.max(1, Math.ceil(retFlights.length / PAGE_SIZE));
  outPage = 1;
  retPage = 1;

  renderList('out');
  renderList('ret');
}

// ===== Wire up =====
window.addEventListener('DOMContentLoaded', () => {
  // Default dates: today/today+3
  const today = new Date();
  const plus3 = new Date(Date.now() + 3*86400000);
  const fmt = d => d.toISOString().slice(0,10);
  qs('#departure').value = fmt(today);
  qs('#return').value = fmt(plus3);

  // Buttons
  qs('#openPaymentModalBtn').addEventListener('click', openPaymentModal);
  qs('#pmClose').addEventListener('click', closePaymentModal);

  qs('#searchBtn').addEventListener('click', doSearch);

  // Breakdown modal close
  qs('#bdClose').onclick = closeBreakdownModal;
  qs('#bdCloseBtm').onclick = closeBreakdownModal;

  // Pagination
  qs('#outPrev').onclick = () => { outPage = clamp(outPage-1, 1, outPages); renderList('out'); };
  qs('#outNext').onclick = () => { outPage = clamp(outPage+1, 1, outPages); renderList('out'); };
  qs('#retPrev').onclick = () => { retPage = clamp(retPage-1, 1, retPages); renderList('ret'); };
  qs('#retNext').onclick = () => { retPage = clamp(retPage+1, 1, retPages); renderList('ret'); };
});
