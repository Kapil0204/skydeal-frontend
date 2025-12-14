// ===============================
// SkyDeal - FRONTEND SCRIPT (safe, ID-agnostic)
// ===============================

const API_BASE = "https://skydeal-backend.onrender.com";

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function getEl(possibleIds = [], fallbacks = []) {
  for (const id of possibleIds) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  for (const sel of fallbacks) {
    const el = $(sel);
    if (el) return el;
  }
  return null;
}

function getTripType() {
  // Prefer radio name=tripType (values 'one-way'/'round-trip')
  const checked = $('input[name="tripType"]:checked');
  if (checked && checked.value) return checked.value;

  // Otherwise infer from IDs if present
  const one = getEl(['oneWayRadio'], ['#oneWayRadio']);
  const round = getEl(['roundTripRadio'], ['#roundTripRadio']);
  if (round && round.checked) return 'round-trip';
  if (one && one.checked) return 'one-way';

  // Default (you’ve been using round-trip commonly)
  return 'round-trip';
}

function textOr(el) { return el ? el.value?.trim() : ''; }

// ---------- Grab UI elements (robust) ----------
const fromInput          = getEl(['fromInput'], ['input#from', 'input[name="from"]']);
const toInput            = getEl(['toInput'], ['input#to', 'input[name="to"]']);
const departInput        = getEl(['departInput'], ['input#depart', 'input[name="depart"]']);
const returnInput        = getEl(['returnInput'], ['input#return', 'input[name="return"]']);
const passengersSelect   = getEl(['passengersSelect'], ['select#passengers', 'select[name="passengers"]']);
const cabinSelect        = getEl(['cabinSelect'], ['select#cabin', 'select[name="cabin"]']);

const searchBtn          = getEl(['searchBtn'], ['#searchBtn', 'button#search', 'button[type="submit"]']);
const outboundResults    = getEl(['outboundResults'], ['#outboundResults', '.outbound-results']);
const returnResults      = getEl(['returnResults'], ['#returnResults', '.return-results']);

// If your page wraps the form in <form id="searchForm">, prevent a full reload:
const searchForm         = getEl(['searchForm'], ['form#searchForm', 'form']);

// ---------- Rendering ----------
function renderFlights(flights, container) {
  if (!container) return;
  if (!Array.isArray(flights) || flights.length === 0) {
    container.innerHTML = `<div class="no-flights">No flights found for your search.</div>`;
    return;
  }

  container.innerHTML = '';
  flights.forEach(f => {
    const card = document.createElement('div');
    card.className = 'flight-card';
    card.innerHTML = `
      <div class="flight-row">
        <strong>${f.airlineName ?? '-'}</strong>
        <span>${f.flightNumber ?? ''}</span>
      </div>
      <div class="flight-row">
        ${f.departureTime ?? '--'} → ${f.arrivalTime ?? '--'}
        · ${(f.stops ?? 0)} stop(s)
      </div>
      <div class="flight-price">₹${f.price ?? 0}</div>
    `;
    container.appendChild(card);
  });
}

// ---------- Search handler ----------
async function doSearch(ev) {
  if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();

  // Build payload from UI (dates may be dd/mm/yyyy or yyyy-mm-dd, backend handles both)
  const payload = {
    from: textOr(fromInput),
    to: textOr(toInput),
    departureDate: textOr(departInput),
    returnDate: textOr(returnInput),
    tripType: getTripType(),
    passengers: Number(textOr(passengersSelect) || 1),
    travelClass: textOr(cabinSelect) || 'economy'
  };

  console.log('[SkyDeal] /search payload →', payload);

  if (outboundResults) outboundResults.innerHTML = 'Loading flights...';
  if (returnResults) returnResults.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('[SkyDeal] /search response →', data);

    renderFlights(data.outboundFlights || [], outboundResults);
    renderFlights(data.returnFlights || [], returnResults);
  } catch (err) {
    console.error('Search failed', err);
    if (outboundResults) outboundResults.innerHTML = 'Error loading flights.';
    if (returnResults) returnResults.innerHTML = '';
  }
}

// ---------- Wire up events safely ----------
document.addEventListener('DOMContentLoaded', () => {
  // Prefer form submit if present
  if (searchForm) {
    searchForm.addEventListener('submit', doSearch);
  }
  if (searchBtn) {
    searchBtn.addEventListener('click', doSearch);
  }

  // Tiny UX: if inputs already filled (like your BOM/DEL + dates), auto-enable button
  // (No auto-search to avoid accidental API calls.)
  console.log('[SkyDeal] frontend ready');
});
