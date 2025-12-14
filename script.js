// ===============================
// SkyDeal FRONTEND (stable; modal-safe)
// ===============================
const API_BASE = "https://skydeal-backend.onrender.com";

// ---------- helpers ----------
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const txt = (v) => (v ?? '').toString();

function toISO(dstr) {
  if (!dstr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dstr)) return dstr;
  const m = dstr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// inputs (robust selectors)
const fromInput        = $('#fromInput')        || $('#from')        || $('input[name="from"]');
const toInput          = $('#toInput')          || $('#to')          || $('input[name="to"]');
const departInput      = $('#departInput')      || $('#depart')      || $('input[name="depart"]');
const returnInput      = $('#returnInput')      || $('#return')      || $('input[name="return"]');
const passengersSelect = $('#passengersSelect') || $('#passengers')  || $('select[name="passengers"]');
const cabinSelect      = $('#cabinSelect')      || $('#cabin')       || $('select[name="cabin"]');

const outboundMount = $('#outboundResults') || $('.outbound-results') || $('#outbound');
const returnMount   = $('#returnResults')   || $('.return-results')   || $('#return');

function getTripType() {
  const r = $('input[name="tripType"]:checked');
  if (r?.value) return r.value;
  return ($('#roundTrip')?.checked ? 'round-trip' : ($('#oneWay')?.checked ? 'one-way' : 'round-trip'));
}

// ======================
// Payment options / UI
// ======================
let paymentOptions = null;
let paymentFilters = []; // [{type:'Credit Card', bank:'HDFC Bank'}]

function paymentBtnEl() {
  return $('#paymentBtn') || $$('button,[role="button"]').find(el => /payment methods/i.test(el.textContent||''));
}

function updatePaymentBadge() {
  const btn = paymentBtnEl();
  if (!btn) return;
  const base = btn.dataset.baseLabel || 'Payment methods';
  btn.dataset.baseLabel = base;
  btn.textContent = `${base} (${paymentFilters.length})`;
}

// Build modal with DOM nodes (no innerHTML) so queries never fail
function ensurePaymentModal() {
  let modal = $('#paymentModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.style.cssText = `
      position:fixed; inset:0; display:none; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.45); z-index:9999;
    `;
    const shell = document.createElement('div');
    shell.className = 'shell';
    shell.style.cssText = 'width:720px; max-width:90vw; background:#fff; border-radius:12px; padding:16px;';
    modal.appendChild(shell);

    // tabs
    const tabs = document.createElement('div');
    tabs.id = 'payTabs';
    tabs.style.cssText = 'display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;';
    shell.appendChild(tabs);

    // list
    const list = document.createElement('div');
    list.id = 'payList';
    list.style.cssText = 'max-height:55vh; overflow:auto; border:1px solid #eee; border-radius:8px; padding:8px;';
    shell.appendChild(list);

    // actions
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; margin-top:12px;';
    const clearBtn = document.createElement('button');
    clearBtn.id = 'payClear';
    clearBtn.textContent = 'Clear';
    const doneBtn = document.createElement('button');
    doneBtn.id = 'payDone';
    doneBtn.textContent = 'Done';
    actions.append(clearBtn, doneBtn);
    shell.appendChild(actions);

    document.body.appendChild(modal);
  }
  return modal;
}

function openPaymentModal() {
  if (!paymentOptions) return;
  const modal = ensurePaymentModal();
  const tabs  = $('#payTabs', modal);
  const list  = $('#payList', modal);
  const btnClear = $('#payClear', modal);
  const btnDone  = $('#payDone',  modal);

  if (!tabs || !list || !btnClear || !btnDone) {
    console.warn('Payment modal skeleton missing — rebuilding');
    modal.remove();
    return openPaymentModal();
  }

  const types = Object.keys(paymentOptions.options || {});
  let active = types[0] || 'Credit Card';

  function renderTabs() {
    tabs.replaceChildren();
    for (const t of types) {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.cssText = `
        padding:6px 10px; border:1px solid #ddd; border-radius:20px;
        background:${t===active?'#111':'#f6f6f6'}; color:${t===active?'#fff':'#111'};
      `;
      b.addEventListener('click', () => { active = t; renderTabs(); renderList(); });
      tabs.appendChild(b);
    }
  }
  function renderList() {
    list.replaceChildren();
    const banks = paymentOptions.options[active] || [];
    for (const bank of banks) {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px;';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      const span = document.createElement('span');
      span.textContent = bank;
      row.append(chk, span);

      chk.checked = paymentFilters.some(f => f.type===active && f.bank===bank);
      chk.addEventListener('change', () => {
        if (chk.checked) {
          if (!/wallet|not applicable|paypal|gift\s*card/i.test(bank)) {
            paymentFilters.push({ type: active, bank });
          }
        } else {
          paymentFilters = paymentFilters.filter(f => !(f.type===active && f.bank===bank));
        }
        updatePaymentBadge();
      });
      list.appendChild(row);
    }
  }

  btnClear.onclick = () => { paymentFilters = []; updatePaymentBadge(); renderList(); };
  btnDone.onclick  = () => { modal.style.display = 'none'; };

  renderTabs();
  renderList();
  modal.style.display = 'flex';
}

async function loadPaymentOptions() {
  try {
    const res = await fetch(`${API_BASE}/payment-options`);
    const data = await res.json();
    paymentOptions = data;
    updatePaymentBadge();
    console.log('[SkyDeal] /payment-options', data);
  } catch (e) {
    console.warn('payment-options failed', e);
  }
}

// ========================
// Flights: search + render
// ========================
function renderFlights(list, mount) {
  if (!mount) return;
  if (!Array.isArray(list) || list.length === 0) {
    mount.innerHTML = `<div class="no-flights">No flights found for your search.</div>`;
    return;
  }
  mount.innerHTML = '';
  for (const f of list) {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid #eee; border-radius:10px; padding:10px; margin:10px 0;';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between;">
        <div><strong>${txt(f.airlineName)||'-'}</strong> ${txt(f.flightNumber)||''}</div>
        <div style="font-weight:600">₹${txt(f.price)||'0'}</div>
      </div>
      <div>${txt(f.departureTime)||'--'} → ${txt(f.arrivalTime)||'--'} · ${(f.stops ?? 0)} stop(s)</div>
      <div style="color:#666">Best: ${f.bestDeal?.portal ? `${f.bestDeal.portal} · ${f.bestDeal.offer} · ${f.bestDeal.code}` : '—'}</div>
    `;
    mount.appendChild(card);
  }
}

async function doSearch(ev) {
  if (ev?.preventDefault) ev.preventDefault();

  const payload = {
    from: txt(fromInput?.value),
    to: txt(toInput?.value),
    departureDate: toISO(txt(departInput?.value)),
    returnDate: toISO(txt(returnInput?.value)),
    tripType: getTripType(),
    passengers: Number(txt(passengersSelect?.value) || 1),
    travelClass: (txt(cabinSelect?.value) || 'economy'),
    paymentFilters
  };
  console.log('[SkyDeal] FIRE /search payload →', payload);

  if (outboundMount) outboundMount.innerHTML = 'Loading flights...';
  if (returnMount)   returnMount.innerHTML   = '';

  try {
    const res  = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('[SkyDeal] /search meta →', data?.meta);

    renderFlights(data.outboundFlights || [], outboundMount);
    renderFlights(data.returnFlights   || [], returnMount);
  } catch (e) {
    console.error('Search failed', e);
    if (outboundMount) outboundMount.innerHTML = 'Error loading flights.';
    if (returnMount)   returnMount.innerHTML   = '';
  }
}
window.doSearch = doSearch;

// =======================
// Unkillable bindings
// =======================
const SEARCH_SELECTORS = [
  '#searchBtn','button#search','button[type="submit"]','input[type="submit"]','button[data-role="search"]','button','[role="button"]'
];
function looksLikeSearch(el){ const t=(el.textContent||el.value||'').trim().toLowerCase(); return t==='search'; }
function bindSearch(root=document){
  let n=0;
  for(const sel of SEARCH_SELECTORS){
    for(const el of $$(sel, root)){
      if(!looksLikeSearch(el)) continue;
      if(el.dataset.skydealBound==='1') continue;
      el.addEventListener('click', doSearch);
      el.dataset.skydealBound='1'; n++;
    }
  }
  if(n) console.log(`[SkyDeal] bound ${n} Search handler(s)`);
}
function bindPayment(){
  const btn = paymentBtnEl();
  if(btn && !btn.dataset.skydealPayBound){
    btn.addEventListener('click', (e)=>{ e.preventDefault(); openPaymentModal(); });
    btn.dataset.skydealPayBound='1';
  }
}

const mo = new MutationObserver(()=>{ bindSearch(document); bindPayment(); });

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[SkyDeal] frontend ready; wiring…');
  bindSearch(document);
  bindPayment();
  mo.observe(document.body, { subtree:true, childList:true });
  setInterval(()=>{ bindSearch(document); bindPayment(); }, 1200);
  await loadPaymentOptions();
});
