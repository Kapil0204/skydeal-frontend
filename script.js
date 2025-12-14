// ===============================
// SkyDeal - FRONTEND SCRIPT (resilient bindings)
// ===============================
const API_BASE = "https://skydeal-backend.onrender.com";

// ---------- tiny helpers ----------
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const getVal = el => (el && typeof el.value === "string") ? el.value.trim() : "";

// find element by common ids/selectors, else null
function getEl(ids=[], sels=[]) {
  for (const id of ids)  { const el = document.getElementById(id); if (el) return el; }
  for (const s of sels)  { const el = $(s); if (el) return el; }
  return null;
}

// derive tripType robustly
function getTripType() {
  const checked = $('input[name="tripType"]:checked');
  if (checked && checked.value) return checked.value; // 'one-way' or 'round-trip'
  const one   = getEl(['oneWayRadio'],  ['#oneWayRadio']);
  const round = getEl(['roundTripRadio'], ['#roundTripRadio']);
  if (round?.checked) return 'round-trip';
  if (one?.checked)   return 'one-way';
  return 'round-trip';
}

// ---------- bind UI (very permissive) ----------
const fromInput        = getEl(['fromInput'],   ['#from','input[name="from"]']);
const toInput          = getEl(['toInput'],     ['#to','input[name="to"]']);
const departInput      = getEl(['departInput'], ['#depart','input[name="depart"]','input[type="date"]']);
const returnInput      = getEl(['returnInput'], ['#return','input[name="return"]','input[type="date"]']);
const passengersSelect = getEl(['passengersSelect'], ['#passengers','select[name="passengers"]']);
const cabinSelect      = getEl(['cabinSelect'], ['#cabin','select[name="cabin"]']);

// 1) prefer an explicit id
let searchBtn = getEl(['searchBtn'], ['#searchBtn','button#search','button[data-role="search"]']);
// 2) otherwise, grab a button whose text is “Search”
if (!searchBtn) {
  searchBtn = $$('button').find(b => (b.textContent||'').trim().toLowerCase() === 'search');
}
// 3) fall back to the first submit button if present
if (!searchBtn) searchBtn = $('button[type="submit"]');

const searchForm = getEl(['searchForm'], ['form#searchForm','form']);

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
    card.innerHTML = `
      <div class="flight-row">
        <strong>${f.airlineName ?? '-'}</strong>
        <span>${f.flightNumber ?? ''}</span>
      </div>
      <div class="flight-row">
        ${f.departureTime ?? '--'} → ${f.arrivalTime ?? '--'} · ${(f.stops ?? 0)} stop(s)
      </div>
      <div class="flight-price">₹${f.price ?? 0}</div>
    `;
    mount.appendChild(card);
  }
}

const outboundMount = getEl(['outboundResults'], ['#outboundResults','.outbound-results']);
const returnMount   = getEl(['returnResults'],   ['#returnResults','.return-results']);

async function doSearch(ev) {
  if (ev?.preventDefault) ev.preventDefault();

  const payload = {
    from:         getVal(fromInput),
    to:           getVal(toInput),
    departureDate:getVal(departInput),
    returnDate:   getVal(returnInput),
    tripType:     getTripType(),
    passengers:   Number(getVal(passengersSelect) || 1),
    travelClass:  (getVal(cabinSelect) || 'economy')
  };

  console.log('[SkyDeal] /search payload →', payload);

  if (outboundMount) outboundMount.innerHTML = 'Loading flights...';
  if (returnMount)   returnMount.innerHTML   = '';

  try {
    const res  = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('[SkyDeal] /search response →', data?.meta);

    renderFlights(data.outboundFlights || [], outboundMount);
    renderFlights(data.returnFlights   || [], returnMount);
  } catch (e) {
    console.error('Search failed', e);
    if (outboundMount) outboundMount.innerHTML = 'Error loading flights.';
    if (returnMount)   returnMount.innerHTML   = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // bind once we’re sure DOM is ready
  if (searchForm)  searchForm.addEventListener('submit', doSearch);
  if (searchBtn)   searchBtn.addEventListener('click', doSearch);
  console.log('[SkyDeal] frontend ready; wired searchBtn =', !!searchBtn, 'wired form =', !!searchForm);
});
