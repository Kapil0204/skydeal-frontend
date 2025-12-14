/* =========================
   SkyDeal Frontend – script.js
   (Search fixed; payment modal opener fallback only)
   ========================= */

/** ====== CONFIG ====== **/
const BACKEND = 'https://skydeal-backend.onrender.com';

/** ====== DOM HOOKS ====== **/
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

const paymentBtn        = document.getElementById('paymentBtn');      // your button
const paymentBadge      = document.getElementById('paymentBadge');    // optional tiny (n)
const paymentModal      = document.getElementById('paymentModal');    // your existing modal root (if present)

/** ====== UTIL ====== **/
function toISO(d) {
  if (!d) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // yyyy-mm-dd already
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const dt = new Date(d);
  return isNaN(dt) ? '' : dt.toISOString().slice(0, 10);
}

function fmt(s, def = '—') { return s ?? def; }

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

/** ====== PAYMENT (warm only + SAFE open/close fallback) ====== **/
async function warmPaymentOptions() {
  try {
    const res = await fetch(`${BACKEND}/payment-options`);
    const data = await res.json();
    window.__paymentOptions = data; // cache
    console.log('[SkyDeal] /payment-options', { usedFallback: data.usedFallback, options: data.options });

    // tiny badge update if present
    if (paymentBadge && data && data.options) {
      const groups = data.options;
      const nonEmptyGroups = Object.values(groups).filter(v => Array.isArray(v) ? v.length : !!v);
      paymentBadge.textContent = `(${nonEmptyGroups.length})`;
    }
  } catch (e) {
    console.log('[SkyDeal] payment warm failed:', e.message);
  }
}

// Fallback open/close only if your global modal functions don’t exist.
// This does NOT change your modal’s internal logic/content.
function openPaymentModalFallback() {
  if (!paymentModal) return;
  paymentModal.setAttribute('aria-hidden', 'false');
  paymentModal.style.display = 'grid';
}
function closePaymentModalFallback() {
  if (!paymentModal) return;
  paymentModal.setAttribute('aria-hidden', 'true');
  paymentModal.style.display = 'none';
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
  if (searchBtn) searchBtn.addEventListener('click', handleSearch);

  // Enter key triggers search
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

  // Payment button: prefer your own global opener if it exists; otherwise fallback
  if (paymentBtn) {
    paymentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.openPaymentModal === 'function') {
        window.openPaymentModal();               // your original code (if present)
      } else {
        openPaymentModalFallback();              // safe fallback
      }
    });
  }

  // Provide a generic close fallback for any element with [data-close="payment"]
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.closest && t.closest('[data-close="payment"]')) {
      e.preventDefault();
      if (typeof window.closePaymentModal === 'function') {
        window.closePaymentModal();
      } else {
        closePaymentModalFallback();
      }
    }
  });

  console.log('[SkyDeal] frontend ready (bindings set)');
}

/** ====== STARTUP ====== **/
document.addEventListener('DOMContentLoaded', () => {
  // Use ISO defaults (backend expects yyyy-mm-dd)
  if (departInput && !departInput.value) departInput.value = '2025-12-17';
  if (returnInput && !returnInput.value) returnInput.value = '2025-12-27';

  wireBindings();
  warmPaymentOptions(); // only warms & updates badge; modal logic untouched
});
