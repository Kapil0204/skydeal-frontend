// ---------- CONFIG ----------
const BACKEND = 'https://skydeal-backend.onrender.com';
const PAGE_SIZE = 40; // as per your requirement

// ---------- STATE ----------
let pmState = {
  tab: 'credit',
  selected: new Set(), // values to send to backend (bank names etc.)
};

let pages = {
  out: { page: 1, total: 1, data: [] },
  ret: { page: 1, total: 1, data: [] },
};

// Payment options per tab (deduped lists – keep small & clean)
const PM_OPTIONS = {
  credit: ['Axis Bank','Federal Bank','HDFC Bank','HSBC Bank','ICICI Bank','IDFC First Bank','Kotak Bank','RBL Bank','Yes Bank','AU Bank'],
  debit:  ['Axis Bank','HDFC Bank','ICICI Bank','Kotak Bank','RBL Bank','Yes Bank','AU Bank'],
  netbanking: ['HDFC Bank','ICICI Bank','Axis Bank','Kotak Bank','SBI'],
  upi: ['UPI'],
  wallet: ['PhonePe','Paytm','Amazon Pay'],
  emi: ['Axis Bank','HDFC Bank','Kotak Bank','RBL Bank','Yes Bank'],
};

// ---------- DOM HELPERS ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function openModal(id){ const m = $(id); if (m) m.classList.add('open'); }
function closeModal(id){ const m = $(id); if (m) m.classList.remove('open'); }

document.addEventListener('DOMContentLoaded', () => {
  // Bind buttons safely
  $('#paymentBtn')?.addEventListener('click', () => {
    renderPmList(pmState.tab);
    openModal('#paymentModal');
  });
  $('#paymentClose')?.addEventListener('click', () => closeModal('#paymentModal'));
  $('#pmDone')?.addEventListener('click', applyPmSelection);
  $('#pmClear')?.addEventListener('click', clearPmSelection);

  // PM tabs
  $$('#pmTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#pmTabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      pmState.tab = tab.dataset.tab;
      renderPmList(pmState.tab);
    });
  });

  // Prices modal closers
  $('#priceClose')?.addEventListener('click', () => closeModal('#priceModal'));
  $('#priceClose2')?.addEventListener('click', () => closeModal('#priceModal'));

  // Search
  $('#searchBtn')?.addEventListener('click', handleSearch);

  // Pagers
  $('#outPrev')?.addEventListener('click', () => changePage('out', -1));
  $('#outNext')?.addEventListener('click', () => changePage('out', 1));
  $('#retPrev')?.addEventListener('click', () => changePage('ret', -1));
  $('#retNext')?.addEventListener('click', () => changePage('ret', 1));
});

// ---------- Payment modal ----------
function renderPmList(tab){
  const list = $('#pmList');
  if (!list) return;
  list.innerHTML = '';
  const opts = PM_OPTIONS[tab] || [];
  for (const name of opts){
    const id = `pm_${tab}_${name.replace(/\s+/g,'_')}`;
    const checked = pmState.selected.has(name);
    const row = document.createElement('label');
    row.className = 'pm-item';
    row.innerHTML = `
      <input type="checkbox" id="${id}" ${checked?'checked':''} />
      <span>${name}</span>
    `;
    row.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) pmState.selected.add(name);
      else pmState.selected.delete(name);
    });
    list.appendChild(row);
  }
}

function applyPmSelection(){
  // Update button text
  const btn = $('#paymentBtn');
  if (btn){
    const arr = Array.from(pmState.selected);
    btn.textContent = arr.length ? `Selected (${arr.length})` : 'Select Payment Methods';
  }
  closeModal('#paymentModal');
}
function clearPmSelection(){
  pmState.selected.clear();
  renderPmList(pmState.tab);
}

// ---------- Search ----------
async function handleSearch(){
  // Collect form values
  const from = $('#fromInput')?.value?.trim() || 'BOM';
  const to = $('#toInput')?.value?.trim() || 'DEL';
  const dep = $('#depInput')?.value || '';
  const ret = $('#retInput')?.value || '';
  const pax = Number($('#paxInput')?.value || 1);
  const cabin = $('#cabinSelect')?.value || 'economy';
  const tripType = $('#tripRound')?.checked ? 'round-trip' : 'one-way';
  const paymentMethods = Array.from(pmState.selected);

  // Call backend
  const payload = {
    from, to,
    departureDate: dep,
    returnDate: tripType === 'round-trip' ? ret : '',
    tripType,
    passengers: pax,
    travelClass: cabin,
    paymentMethods
  };

  const res = await fetch(`${BACKEND}/search`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  }).catch(()=>null);

  if (!res) return;
  const json = await res.json();

  // Store data for pagination
  pages.out.data = Array.isArray(json.outboundFlights) ? json.outboundFlights : [];
  pages.ret.data = Array.isArray(json.returnFlights) ? json.returnFlights : [];
  pages.out.page = 1; pages.ret.page = 1;
  pages.out.total = Math.max(1, Math.ceil(pages.out.data.length / PAGE_SIZE));
  pages.ret.total = Math.max(1, Math.ceil(pages.ret.data.length / PAGE_SIZE));

  renderPage('out');
  renderPage('ret');

  // Update page labels
  $('#outPageLabel').textContent = `Page ${pages.out.page} / ${pages.out.total}`;
  $('#retPageLabel').textContent = `Page ${pages.ret.page} / ${pages.ret.total}`;
}

function changePage(kind, delta){
  const state = kind === 'out' ? pages.out : pages.ret;
  const label = kind === 'out' ? $('#outPageLabel') : $('#retPageLabel');
  if (!state.total) return;
  const next = Math.min(Math.max(state.page + delta, 1), state.total);
  if (next === state.page) return;
  state.page = next;
  renderPage(kind);
  label.textContent = `Page ${state.page} / ${state.total}`;
}

function renderPage(kind){
  const state = kind === 'out' ? pages.out : pages.ret;
  const listEl = kind === 'out' ? $('#outboundList') : $('#returnList');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!state.data.length) return;

  const start = (state.page - 1) * PAGE_SIZE;
  const slice = state.data.slice(start, start + PAGE_SIZE);

  slice.forEach(f => listEl.appendChild(renderFlightCard(f)));
}

function renderFlightCard(f){
  const div = document.createElement('div');
  div.className = 'card';

  const title = `${f.airlineName || ''} • ${f.flightNumber || f.airlineName || ''}`.trim();
  const legs = f.stops === 0 || f.nonStop ? 'Non-stop' : (f.stops ? `${f.stops} stop` : '');
  const times = f.departureTime && f.arrivalTime ? `${f.departureTime} → ${f.arrivalTime}` : '';
  const base = f.price ? Number(f.price) : null;

  // green "Best:" label + note line
  let bestLine = '';
  if (f.bestDeal && f.bestDeal.portal && f.bestDeal.finalPrice != null) {
    bestLine = `Best: ₹${formatINR(f.bestDeal.finalPrice)} on ${f.bestDeal.portal}`;
  } else if (base != null) {
    bestLine = `Base: ₹${formatINR(base)}`;
  }

  const appliedNote = f.bestDeal?.note ? `<div class="card-note">${f.bestDeal.note}</div>` : '';

  div.innerHTML = `
    <p class="card-title">${escapeHtml(title)}</p>
    <p class="card-sub">${escapeHtml(times)} ${times && legs ? ' • ' : ''}${escapeHtml(legs)}</p>
    <p class="card-best">${bestLine}</p>
    ${appliedNote}
    <div class="card-actions">
      <button class="btn" data-role="show-breakdown">Prices &amp; breakdown</button>
    </div>
  `;

  div.querySelector('[data-role="show-breakdown"]').addEventListener('click', () => {
    openBreakdownModal(f);
  });

  return div;
}

function openBreakdownModal(f){
  $('#priceMeta').textContent =
    `${f.airlineName || ''} • ${f.flightNumber || ''}  ${f.departureTime || ''} → ${f.arrivalTime || ''}  • Base ₹${formatINR(Number(f.price)||0)}`;

  const rows = $('#priceRows');
  rows.innerHTML = '';
  const ports = Array.isArray(f.portalPrices) ? f.portalPrices : [];
  ports.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(p.portal || '-')}</td>
      <td>₹${formatINR(Number(p.finalPrice)||0)}</td>
      <td>${escapeHtml(p.source || '')}${p.offerApplied ? ' <span style="color:#16a34a;">offer applied</span>' : ''}</td>
    `;
    rows.appendChild(tr);
  });

  const debug = f.offerDebug || {};
  $('#whyText').textContent = JSON.stringify(debug, null, 2);

  openModal('#priceModal');
}

// ---------- Utils ----------
function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function formatINR(n){ try{ return n.toLocaleString('en-IN'); }catch{ return String(n) } }
