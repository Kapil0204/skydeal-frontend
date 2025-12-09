// ---------------- Config & State ----------------
const API_BASE = 'https://skydeal-backend.onrender.com';
const PAGE_SIZE = 10;

const state = {
  outbound: [],
  outboundPage: 1,
  return: [],
  returnPage: 1,
  meta: null
};
window.selectedPaymentMethods = [];

// ---------------- Utils ----------------
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const el = id => document.getElementById(id);
const formatINR = n => INR.format(Number(n || 0));
const paginate = (arr, page) => arr.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE);

function setPageLabels(){
  const outPages = Math.max(1, Math.ceil(state.outbound.length / PAGE_SIZE));
  const retPages = Math.max(1, Math.ceil(state.return.length / PAGE_SIZE));
  el('outboundPageLabel').textContent = `Page ${state.outboundPage} / ${outPages}`;
  el('returnPageLabel').textContent   = `Page ${state.returnPage} / ${retPages}`;
}

function flightTitle(f){
  if (f.airlineName && f.flightNumber && f.departureTime && f.arrivalTime) {
    return `${f.airlineName} • ${f.flightNumber}  •  ${f.departureTime} → ${f.arrivalTime}`;
  }
  if (f.title) return f.title;
  return `${f.airlineName || 'Flight'}${f.flightNumber ? ' • ' + f.flightNumber : ''}`;
}

// ---------------- Rendering ----------------
function renderList(which){
  const listEl = el(which === 'out' ? 'outboundList' : 'returnList');
  const page   = which === 'out' ? state.outboundPage : state.returnPage;
  const rows   = which === 'out' ? state.outbound : state.return;

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const view  = paginate(rows, Math.min(page, pages));
  listEl.innerHTML = '';

  view.forEach((f, idx) => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const best = f.bestDeal
      ? `Best: ${formatINR(f.bestDeal.finalPrice)} on ${f.bestDeal.portal}`
      : 'Best price after applicable offers (if any)';

    card.innerHTML = `
      <p class="result-title">${flightTitle(f)}</p>
      <p class="result-sub">${f.stops === 0 ? 'Non-stop' : (f.stops ? `${f.stops} stop${f.stops>1?'s':''}` : '')}</p>
      <p class="best">${best}</p>
      <div class="row-actions">
        <button class="btn" data-which="${which}" data-idx="${idx}">Prices &amp; breakdown</button>
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

function renderAll(){ renderList('out'); renderList('ret'); }

// ---------------- Modal helpers ----------------
function openModal(id){
  const m = el(id);
  m.classList.remove('hidden');
  m.removeAttribute('aria-hidden');
  const focusable = m.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable) focusable.focus();
}
function closeModal(id){
  const m = el(id);
  m.classList.add('hidden');
  m.setAttribute('aria-hidden','true');
  if (id === 'paymentsModal') el('openPaymentsBtn')?.focus();
}

// ---------------- Payment options ----------------
function collectStrings(val, out){
  if (!val) return;
  const t = typeof val;
  if (t === 'string' || t === 'number') {
    const s = String(val).trim();
    if (s) out.push(s);
    return;
  }
  if (Array.isArray(val)) { val.forEach(v => collectStrings(v, out)); return; }
  if (t === 'object') {
    ['name','bank','title','label'].forEach(k => { if (val[k]) collectStrings(val[k], out); });
    Object.values(val).forEach(v => collectStrings(v, out));
  }
}

function normalizeCategories(raw){
  const want = ['Credit Card','Debit Card','Net Banking','UPI','Wallet','EMI'];
  const keyVariants = (k) => [
    k, k.replace(' ',''),
    k.toLowerCase(), k.toUpperCase(),
    k.replace(' ','').toLowerCase(), k.replace(' ','').toUpperCase()
  ];
  const buckets = Object.fromEntries(want.map(k => [k, []]));
  const addItems = (bucket, val) => {
    const temp = [];
    collectStrings(val, temp);
    const cleaned = temp.map(s => s.trim()).filter(Boolean);
    buckets[bucket].push(...cleaned);
  };
  want.forEach(cat => {
    const variants = keyVariants(cat);
    for (const v of variants) {
      if (raw && raw[v]) addItems(cat, raw[v]);
      if (raw?.options && raw.options[v]) addItems(cat, raw.options[v]);
    }
  });
  const scanObj = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const lk = k.toLowerCase();
      if (lk.includes('credit')) addItems('Credit Card', v);
      else if (lk.includes('debit')) addItems('Debit Card', v);
      else if (lk.includes('net') && lk.includes('bank')) addItems('Net Banking', v);
      else if (lk.includes('wallet')) addItems('Wallet', v);
      else if (lk.includes('upi')) addItems('UPI', v);
      else if (lk.includes('emi')) addItems('EMI', v);
      if (typeof v === 'object') scanObj(v);
    }
  };
  scanObj(raw);
  for (const cat of want) {
    const uniq = Array.from(new Set(buckets[cat])).filter(Boolean).sort((a,b)=>a.localeCompare(b));
    buckets[cat] = uniq;
  }
  return buckets;
}

async function fetchPaymentOptions(){
  try{
    const r = await fetch(`${API_BASE}/payment-options`, { method: 'GET', mode:'cors' });
    const json = await r.json();
    return normalizeCategories(json);
  }catch(e){
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

async function openPayments(){
  const container = el('paymentOptionsContainer');
  container.innerHTML = '<div class="muted">Loading…</div>';

  const data = await fetchPaymentOptions();

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[data-tab="Credit Card"]').classList.add('active');

  const render = (cat) => {
    container.innerHTML = '';
    const items = data[cat] || [];
    if (!items.length) {
      container.innerHTML = `<div class="muted">No options</div>`;
      return;
    }
    items.forEach(name => {
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

  render('Credit Card');

  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      render(tab.dataset.tab);
    };
  });

  el('clearPaymentsBtn').onclick = () => {
    window.selectedPaymentMethods = [];
    container.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
    updatePaymentsButtonLabel();
  };

  el('donePaymentsBtn').onclick = () => {
    // gather all checked across the visible tab only; keep existing from other tabs
    const boxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const picked = Array.from(boxes).map(b => b.nextElementSibling.textContent.trim());
    window.selectedPaymentMethods = Array.from(new Set([...(window.selectedPaymentMethods||[]), ...picked]));
    updatePaymentsButtonLabel();
    closeModal('paymentsModal');
  };

  openModal('paymentsModal');
}

function updatePaymentsButtonLabel(){
  const n = (window.selectedPaymentMethods || []).length;
  el('openPaymentsBtn').textContent = n ? `Selected (${n})` : 'Select Payment Methods';
}

// ---------------- Prices modal ----------------
function openPricesModal(item, debug){
  el('pricesTitle').textContent = `${flightTitle(item)}  •  Base ${formatINR(item.price || item.basePrice || 0)}`;
  const body = el('pricesTableBody');
  body.innerHTML = '';
  (item.portalPrices || []).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.portal}</td><td>${formatINR(p.finalPrice)}</td><td>${p.source}</td>`;
    body.appendChild(tr);
  });
  el('offerReasons').textContent = JSON.stringify(debug || {}, null, 2);
  openModal('pricesModal');
}

// ---------------- Search ----------------
async function doSearch(payload){
  // 35s hard timeout to avoid stuck button
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 35000);

  try {
    const r = await fetch(`${API_BASE}/search`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      mode: 'cors',
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    if (!r.ok) {
      const text = await r.text().catch(()=> '');
      throw new Error(`HTTP ${r.status} ${r.statusText} — ${text}`);
    }
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function onSearch(){
  const btn = el('searchBtn');
  const prevHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Searching…';

  try{
    const from = el('from').value.trim().toUpperCase();
    const to   = el('to').value.trim().toUpperCase();
    const departureDate = el('departure').value;   // yyyy-mm-dd
    const returnDate    = el('return').value;      // yyyy-mm-dd
    const passengers    = parseInt(el('passengers').value || '1', 10);
    const travelClass   = (el('cabin').value || 'economy').toLowerCase();
    const tripType      = el('tripRound').checked ? 'round-trip' : 'one-way';

    if (!from || !to || !departureDate) {
      alert('Please fill From, To, and Departure.');
      return;
    }

    const payload = {
      from, to, departureDate,
      returnDate: tripType === 'round-trip' ? (returnDate || '') : '',
      tripType, passengers, travelClass,
      paymentMethods: window.selectedPaymentMethods || []
    };

    console.log('[SkyDeal] /search payload →', payload);

    const json = await doSearch(payload);
    console.log('[SkyDeal] /search response meta →', json?.meta);

    state.meta = json.meta || null;
    state.outbound = Array.isArray(json.outboundFlights) ? json.outboundFlights : [];
    state.return   = Array.isArray(json.returnFlights)   ? json.returnFlights   : [];
    state.outboundPage = 1;
    state.returnPage   = 1;

    renderAll();
  }catch(err){
    console.error('[SkyDeal] search error:', err);
    alert(`Search failed.\n\n${err.message || err}`);
  }finally{
    btn.disabled = false;
    btn.innerHTML = prevHtml || 'Search';
  }
}

// ---------------- Wire up ----------------
document.addEventListener('DOMContentLoaded', () => {
  el('openPaymentsBtn').addEventListener('click', (e)=>{ e.preventDefault(); openPayments(); });
  el('closePaymentsBtn').addEventListener('click', ()=> closeModal('paymentsModal'));

  el('closePricesBtn').addEventListener('click', ()=> closeModal('pricesModal'));
  el('closePricesBtn2').addEventListener('click', ()=> closeModal('pricesModal'));

  el('searchBtn').addEventListener('click', (e)=>{ e.preventDefault(); onSearch(); });

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
  updatePaymentsButtonLabel();
});
