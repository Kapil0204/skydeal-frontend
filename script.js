/* =========================
   SkyDeal Frontend — script.js
   NO fallbacks for payment modal (uses your openPaymentModal())
   ========================= */

const BACKEND = 'https://skydeal-backend.onrender.com';

/* -------- DOM -------- */
const fromInput        = document.getElementById('from');
const toInput          = document.getElementById('to');
const departInput      = document.getElementById('departDate');
const returnInput      = document.getElementById('returnDate');
const passengersSelect = document.getElementById('passengers');
const cabinSelect      = document.getElementById('cabin');
const oneWayRadio      = document.getElementById('oneWay');
const roundTripRadio   = document.getElementById('roundTrip');
const searchBtn        = document.getElementById('searchBtn');

const outboundWrap     = document.getElementById('outboundResults');
const returnWrap       = document.getElementById('returnResults');

const paymentBtn       = document.getElementById('paymentBtn');   // your button
const paymentBadge     = document.getElementById('paymentBadge'); // small count (optional)

/* -------- utils -------- */
function toISO(d) {
  if (!d) return '';
  // already yyyy-mm-dd (type="date" input)
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  // dd/mm/yyyy -> yyyy-mm-dd
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const dt = new Date(d);
  return isNaN(dt) ? '' : dt.toISOString().slice(0, 10);
}

const fmt = (v, def = '—') => (v ?? def);

/* -------- results -------- */
function clearResults() {
  if (outboundWrap) outboundWrap.innerHTML = `<div class="empty">No flights found for your search.</div>`;
  if (returnWrap)   returnWrap.innerHTML   = `<div class="empty">No flights found for your search.</div>`;
}

function flightCard(f) {
  const name  = fmt(f.airlineName || f.carrier || f.flightName, '—');
  const dep   = fmt(f.departureTime || f.departure, '—');
  const arr   = fmt(f.arrivalTime   || f.arrival, '—');
  const stops = Number(f.stops || 0);
  const price = typeof f.price === 'number' ? `₹${f.price}` : (f.price || '₹0');
  const best  = f.bestDeal ? `${f.bestDeal.portal} · ${f.bestDeal.offer} · ${f.bestDeal.code}` : '—';

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

function renderList(target, flights) {
  if (!target) return;
  if (!Array.isArray(flights) || flights.length === 0) {
    target.innerHTML = `<div class="empty">No flights found for your search.</div>`;
    return;
  }
  target.innerHTML = flights.map(flightCard).join('');
}

/* -------- payment (warm only; NO modal changes) -------- */
async function warmPaymentOptions() {
  try {
    const res = await fetch(`${BACKEND}/payment-options`);
    const data = await res.json();
    console.log('[SkyDeal] /payment-options', { usedFallback: data.usedFallback, options: data.options });

    if (paymentBadge && data && data.options) {
      // show number of groups available (purely cosmetic)
      const groups = data.options;
      const n = Object.values(groups).filter(v => (Array.isArray(v) ? v.length : !!v)).length;
      paymentBadge.textContent = `(${n})`;
    }
  } catch (e) {
    console.log('[SkyDeal] payment warm failed:', e.message);
  }
}

/* -------- search -------- */
async function handleSearch(ev) {
  ev?.preventDefault?.();

  const payload = {
    from:        (fromInput?.value || '').trim().toUpperCase(),
    to:          (toInput?.value || '').trim().toUpperCase(),
    departureDate: toISO(departInput?.value || ''),
    returnDate:    roundTripRadio?.checked ? toISO(returnInput?.value || '') : '',
    tripType:      roundTripRadio?.checked ? 'round-trip' : 'one-way',
    passengers:    Number(passengersSelect?.value || 1),
    travelClass:   (cabinSelect?.value || 'economy').toLowerCase()
  };

  if (!payload.from || !payload.to || !payload.departureDate) {
    alert('Please enter From, To and a valid Depart date.');
    return;
  }
  if (payload.tripType === 'round-trip' && !payload.returnDate) {
    alert('Please choose a Return date for round-trip.');
    return;
  }

  console.log('[SkyDeal] FIRE → /search payload', payload);
  clearResults();

  try {
    const res  = await fetch(`${BACKEND}/search`, {
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

/* -------- wiring -------- */
function wireBindings() {
  // search
  if (searchBtn) searchBtn.addEventListener('click', handleSearch);

  // enter to search
  [fromInput, toInput, departInput, returnInput].forEach((el) => {
    if (!el) return;
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(e); });
  });

  // toggle return date field display only (no logic change)
  const toggleReturn = () => {
    if (!returnInput || !roundTripRadio) return;
    const show = !!roundTripRadio.checked;
    returnInput.disabled = !show;
    returnInput.parentElement?.classList?.toggle('disabled', !show);
  };
  oneWayRadio?.addEventListener('change', toggleReturn);
  roundTripRadio?.addEventListener('change', toggleReturn);
  toggleReturn();

  // PAYMENT BUTTON — call YOUR existing modal function only.
  if (paymentBtn) {
    paymentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.openPaymentModal === 'function') {
        window.openPaymentModal(); // your implementation
      } else {
        console.warn('[SkyDeal] openPaymentModal() not found (no fallback used).');
      }
    });
  }

  console.log('[SkyDeal] frontend ready (bindings set)');
}

/* -------- boot -------- */
document.addEventListener('DOMContentLoaded', () => {
  // If your inputs are type="date", they require yyyy-mm-dd; set only if blank
  if (departInput && !departInput.value) departInput.value = '2025-12-17';
  if (returnInput && !returnInput.value) returnInput.value = '2025-12-27';

  wireBindings();
  warmPaymentOptions(); // does not modify your modal/selection logic
});
