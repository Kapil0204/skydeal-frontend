// ===============================
// SkyDeal FRONTEND (stable binding + payment modal)
// ===============================
const API_BASE = "https://skydeal-backend.onrender.com";

// ---------- tiny helpers ----------
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const txt = (v) => (v ?? '').toString();

function toISO(dstr) {
  // accepts "yyyy-mm-dd" (already OK) OR "dd/mm/yyyy" -> "yyyy-mm-dd"
  if (!dstr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dstr)) return dstr;
  const m = dstr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [_, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

// robust getters for inputs (survive markup tweaks)
const fromInput        = $('#fromInput')        || $('#from')        || $('input[name="from"]');
const toInput          = $('#toInput')          || $('#to')          || $('input[name="to"]');
const departInput      = $('#departInput')      || $('#depart')      || $('input[name="depart"]');
const returnInput      = $('#returnInput')      || $('#return')      || $('input[name="return"]');
const passengersSelect = $('#passengersSelect') || $('#passengers')  || $('select[name="passengers"]');
const cabinSelect      = $('#cabinSelect')      || $('#cabin')       || $('select[name="cabin"]');

const outboundMount = $('#outboundResults') || $('.outbound-results');
const returnMount   = $('#returnResults')   || $('.return-results');

// Trip type radio (fallback safe)
function getTripType() {
  const r = $('input[name="tripType"]:checked');
  if (r?.value) return r.value; // 'one-way' | 'round-trip'
  // fallback: if only one radio present or no radios, default round-trip UI
  return ($('#roundTrip')?.checked ? 'round-trip' : ($('#oneWay')?.checked ? 'one-way' : 'round-trip'));
}

// =====================================
// Payment options (badge + simple modal)
// =====================================
let paymentOptions = null;         // { usedFallback, options:{ Credit Card:[...], ... } }
let paymentFilters = [];           // [{type:'Credit Card', bank:'HDFC Bank'}, ...]

function paymentBtnEl() {
  // tolerate different markups
  return $('#paymentBtn') || $$('button, [role="button"]').find(
    el => /payment methods/i.test(el.textContent || '')
  );
}

function updatePaymentBadge() {
  const btn = paymentBtnEl();
  if (!btn) return;
  const count = paymentFilters.length;
  // set to "Payment methods (N)"
  const base = (btn.dataset.baseLabel || 'Payment methods');
  btn.dataset.baseLabel = base;
  btn.textContent = `${base} (${count})`;
}

function buildModal() {
  let modal = $('#paymentModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.style.cssText = `
      position: fixed; inset: 0; display:none; align-items:center; justify-content:center; z-index: 9999;
      background: rgba(0,0,0,0.4);
    `;
    modal.innerHTML = `
      <div style="width:720px; max-width:90vw; background:#fff; border-radius:12px; padding:16px;">
        <div style="display:flex; gap:8px; margin-bottom:12px;" id="payTabs"></div>
        <div id="payList" style="max-height:55vh; overflow:auto; border:1px solid #eee; border-radius:8px; padding:8px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
          <button id="payClear" class="btn-secondary">Clear</button>
          <button id="payDone"  class="btn-primary">Done</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  return modal;
}

function openPaymentModal() {
  if (!paymentOptions) return;
  const modal = buildModal();
  const tabs  = $('#payTabs', modal);
  const list  = $('#payList', modal);

  const types = Object.keys(paymentOptions.options || {});
  tabs.innerHTML = '';
  list.innerHTML = '';

  let active = types[0] || 'Credit Card';

  function renderTabs() {
    tabs.innerHTML = '';
    for (const t of types) {
      const b = document.createElement('button');
      b.textContent = t;
      b.className = 'tab ' + (t === active ? 'active' : '');
      b.style.cssText = `padding:6px 10px; border:1px solid #ddd; border-radius:20px; background:${t===active?'#111':'#f6f6f6'}; color:${t===active?'#fff':'#111'}`;
      b.addEventListener('click', () => { active = t; renderTabs(); renderList(); });
      tabs.appendChild(b);
    }
  }

  function renderList() {
    list.innerHTML = '';
    const banks = paymentOptions.options[active] || [];
    for (const bank of banks) {
      const id = `pf-${active}-${bank}`.replace(/[^\w-]/g,'_');
      const row = document.createElement('label');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px;';
      row.innerHTML = `
        <input type="checkbox" id="${id}">
        <span>${bank}</span>
      `;
      const chk = $('input', row);
      chk.checked = paymentFilters.some(f => f.type === active && f.bank === bank);
      chk.addEventListener('change', () => {
        if (chk.checked) {
          // avoid adding policy rows like "Payments not applicable..."
          if (!/wallet|not applicable|paypal|gift\s*card/i.test(bank)) {
            paymentFilters.push({ type: active, bank });
          }
        } else {
          paymentFilters = paymentFilters.filter(f => !(f.type === active && f.bank === bank));
        }
        updatePaymentBadge();
      });
      list.appendChild(row);
    }
  }

  renderTabs();
  renderList();

  $('#payClear', modal).onclick = () => { paymentFilters = []; updatePaymentBadge(); renderList(); };
  $('#payDone',  modal).onclick = () => { modal.style.display = 'none'; };

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
    card.className = 'flight-card';
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
    from:         txt(fromInput?.value),
    to:           txt(toInput?.value),
    departureDate: toISO(txt(departInput?.value)),
    returnDate:    toISO(txt(returnInput?.value)),
    tripType:     getTripType(),
    passengers:   Number(txt(passengersSelect?.value) || 1),
    travelClass:  (txt(cabinSelect?.value) || 'economy'),
    // carry the user-selected filters to backend (non-breaking; backend can ignore if not needed)
    paymentFilters
  };

  // sanity: if round trip but no return date, keep payload but backend will ignore/handle
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

    // meta.outStatus/retStatus can be 404 when upstream has no results (we still render gracefully)
    renderFlights(data.outboundFlights || [], outboundMount);
    renderFlights(data.returnFlights   || [], returnMount);
  } catch (e) {
    console.error('Search failed', e);
    if (outboundMount) outboundMount.innerHTML = 'Error loading flights.';
    if (returnMount)   returnMount.innerHTML   = '';
  }
}
window.doSearch = doSearch; // handy for manual firing in console

// =======================
// Unkillable event wiring
// =======================
const SEARCH_SELECTORS = [
  '#searchBtn',
  'button#search',
  'button[type="submit"]',
  'input[type="submit"]',
  'button[data-role="search"]',
  'button',
  '[role="button"]'
];
function looksLikeSearch(el) {
  if (!el) return false;
  const t = (el.textContent || el.value || '').trim().toLowerCase();
  return t === 'search';
}
function bindSearch(root=document) {
  let bound = 0;
  for (const sel of SEARCH_SELECTORS) {
    for (const el of $$(sel, root)) {
      if (!looksLikeSearch(el)) continue;
      if (el.dataset.skydealBound === '1') continue;
      el.addEventListener('click', doSearch);
      el.dataset.skydealBound = '1';
      bound++;
    }
  }
  if (bound) console.log(`[SkyDeal] bound ${bound} Search handler(s)`);
}
function bindPayment() {
  const btn = paymentBtnEl();
  if (btn && !btn.dataset.skydealPayBound) {
    btn.addEventListener('click', (e) => { e.preventDefault(); openPaymentModal(); });
    btn.dataset.skydealPayBound = '1';
  }
}

// Observe for re-renders and keep handlers alive
const mo = new MutationObserver(() => { bindSearch(document); bindPayment(); });
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[SkyDeal] frontend ready; wiring…');
  bindSearch(document);
  bindPayment();
  mo.observe(document.body, { subtree: true, childList: true });
  setInterval(() => { bindSearch(document); bindPayment(); }, 1200); // watchdog
  await loadPaymentOptions(); // badge + modal data
});
