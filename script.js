/* =========================
   SkyDeal Frontend – script.js
   (Safe full file: search fixed; payment modal untouched)
   ========================= */

/** ====== CONFIG ====== **/
const BACKEND = 'https://skydeal-backend.onrender.com';

/** ====== DOM HOOKS (IDs must exist in HTML) ====== **/
const fromInput         = document.getElementById('from');
const toInput           = document.getElementById('to');
const departInput       = document.getElementById('departDate');
const returnInput       = document.getElementById('returnDate');
const passengersSelect  = document.getElementById('passengers');
const cabinSelect       = document.getElementById('cabin');
const oneWayRadio       = document.getElementById('oneWay');
const roundTripRadio    = document.getElementById('roundTrip');
const searchBtn         = document.getElementById('searchBtn');

const outboundWrap      = document.getElementById('outboundResults');
const returnWrap        = document.getElementById('returnResults');

const paymentBtn        = document.getElementById('paymentBtn');      // your existing button
const paymentBadge      = document.getElementById('paymentBadge');    // optional tiny (n) inside button

/** ====== UTIL ====== **/
function toISO(d) {
  if (!d) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // already yyyy-mm-dd
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const dt = new Date(d);
  return isNaN(dt) ? '' : dt.toISOString().slice(0, 10);
}

function fmt(s, def = '—') {
  return s ?? def;
}

function clearResults() {
  if (outboundWrap) outboundWrap.innerHTML = `<div class="empty">No flights found for your search.</div>`;
  if (returnWrap)   returnWrap.innerHTML   = `<div class="empty">No flights found for your search.</div>`;
}

/** ====== RENDER ====== **/
function flightCard(f) {
  const name   = fmt(f.airlineName || f.carrier || f.flightName, '—');
  const price  = typeof f.price === 'number' ? `₹${f.price}` : (f.price || '₹0');
  const dep    = fmt(f.departureTime || f.departure || '—');
  const arr    = fmt(f.arrivalTime   || f.arrival   || '—');
  const stops  = (Number(f.stops) || 0);
  const best   = f.bestDeal ? `${f.bestDeal.portal} · ${f.bestDeal.offer} · ${f.bestDeal.code}` : '—';

  return `
    <div class="card">
      <div class="row">
        <div class="air">${name}</div>
        <div class="times">${dep} → ${arr}</div>
        <div class="stops">${stops} stop(s)</div>
        <div class="price">${price}</div>
      </div>
      <div class="best">Best: ${best}</div>
    </div>
  `;
}

function renderList(targetEl, flights = []) {
  if (!targetEl) return;
  if (!Array.isArray(flights) || flights.length === 0) {
    targetEl.innerHTML = `<div class="empty">No flights found for your search.</div>`;
    return;
  }
  targetEl.innerHTML = flights.map(flightCard).join('');
}

/** ====== PAYMENT (SAFE WARM ONLY; MODAL UNTOUCHED) ====== **/
async function warmPaymentOptions() {
  try {
    const res = await fetch(`${BACKEND}/payment-options`);
    const data = await res.json();
    window.__paymentOptions = data; // cache for whoever needs it
    console.log('[SkyDeal] /payment-options', { usedFallback: data.usedFallback, options: data.options });

    // update tiny badge if present (does NOT change your modal code)
    if (paymentBadge && data && data.options) {
      const groups = data.options;
      const nonEmptyGroups = Object.values(groups).filter(v => Array.isArray(v) ? v.length : !!v);
      paymentBadge.textContent = `(${nonEmptyGroups.length})`;
    }
  } catch (e) {
    console.log('[SkyDeal] payment warm failed:', e.message);
  }
}

/** ====== SEARCH ====== **/
async function handleSearch(ev) {
  ev?.preventDefault?.();

  const payload = {
    from: (fromInput?.value || '').trim().toUpperCase(),
    to: (toInput?.value || '').trim().toUpperCase(),
    departureDate: toISO(departInput?.value || ''),
    returnDate: roundTripRadio?.checked ? toISO(returnInput?.value || '') : '',
    tripType: roundTripRadio?.checked ? 'round-trip' : 'one-way',
    passengers: Number(passengersSelect?.value || 1),
    travelClass: (cabinSelect?.value || 'economy').toLowerCase()
  };

  // basic validation
  if (!payload.from || !payload.to || !payload.departureDate) {
    alert('Please enter From, To and a valid Depart date.');
    return;
  }
  if (payload.tripType === 'round-trip' && !payload.returnDate) {
    alert('Please select a valid Return date for round-trip.');
    return;
  }

  console.log('[SkyDeal] FIRE → /search payload', payload);
  clearResults();

  try {
    const res = await fetch(`${BACKEND}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    console.log('[SkyDeal] /search meta', json?.meta);

    // Draw results
    renderList(outboundWrap, json?.outboundFlights || []);
    renderList(returnWrap,   json?.returnFlights   || []);

  } catch (e) {
    console.error('[SkyDeal] search failed:', e);
    clearResults();
  }
}

/** ====== WIRING ====== **/
function wireBindings() {
  // search button
  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearch);
  }

  // allow Enter key on key fields
  [fromInput, toInput, departInput, returnInput].forEach(el => {
    if (!el) return;
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch(e);
    });
  });

  // one-way vs round-trip UI nicety
  if (oneWayRadio && returnInput) {
    const toggleReturn = () => {
      const show = !!(roundTripRadio && roundTripRadio.checked);
      returnInput.disabled = !show;
      returnInput.parentElement?.classList?.toggle('disabled', !show);
    };
    oneWayRadio.addEventListener('change', toggleReturn);
    roundTripRadio?.addEventListener('change', toggleReturn);
    toggleReturn();
  }

  console.log('[SkyDeal] frontend ready (bindings set)');
}

/** ====== STARTUP ====== **/
document.addEventListener('DOMContentLoaded', () => {
  // Use ISO defaults so the browser is happy and backend receives good dates
  if (departInput && !departInput.value) departInput.value = '2025-12-17';
  if (returnInput && !returnInput.value) returnInput.value = '2025-12-27';

  wireBindings();

  // Warm payment count badge ONLY (does not modify your modal logic)
  warmPaymentOptions();
});

/* ====== NOTE ======
 * Your existing payment selection modal code (open/close, checkboxes, DONE/CLEAR)
 * stays exactly as you have it. This file does NOT define or override it.
 * If your HTML uses different element IDs, either:
 *  - adjust the const selectors at the top, or
 *  - add matching IDs in your markup.
 * =================== */
