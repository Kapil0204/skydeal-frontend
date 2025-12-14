// ===============================
// SkyDeal FRONTEND (fail-proof bindings)
// ===============================
const API_BASE = "https://skydeal-backend.onrender.com";

// ---------- helpers ----------
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const getVal = el => (el && typeof el.value === "string") ? el.value.trim() : "";

function getEl(ids=[], sels=[]) {
  for (const id of ids)  { const el = document.getElementById(id); if (el) return el; }
  for (const s of sels)  { const el = $(s); if (el) return el; }
  return null;
}

function getTripType() {
  const checked = $('input[name="tripType"]:checked');
  if (checked?.value) return checked.value;               // 'one-way' | 'round-trip'
  const one   = getEl(['oneWayRadio'],  ['#oneWayRadio']);
  const round = getEl(['roundTripRadio'], ['#roundTripRadio']);
  if (round?.checked) return 'round-trip';
  if (one?.checked)   return 'one-way';
  return 'round-trip';
}

// Inputs (robust selectors)
const fromInput        = getEl(['fromInput'],   ['#from','input[name="from"]']);
const toInput          = getEl(['toInput'],     ['#to','input[name="to"]']);
const departInput      = getEl(['departInput'], ['#depart','input[name="depart"]','input[type="date"]']);
const returnInput      = getEl(['returnInput'], ['#return','input[name="return"]','input[type="date"]']);
const passengersSelect = getEl(['passengersSelect'], ['#passengers','select[name="passengers"]']);
const cabinSelect      = getEl(['cabinSelect'], ['#cabin','select[name="cabin"]']);

const outboundMount = getEl(['outboundResults'], ['#outboundResults','.outbound-results']);
const returnMount   = getEl(['returnResults'],   ['#returnResults','.return-results']);

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

  console.log('[SkyDeal] FIRE search with payload →', payload);

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
window.doSearch = doSearch; // manual trigger if needed

// ---------- binding that never dies ----------
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
  if (el.matches?.('#searchBtn, button#search, button[type="submit"], input[type="submit"], button[data-role="search"]')) return true;
  const t = (el.textContent || el.value || '').trim().toLowerCase();
  return t === 'search';
}

function bindSearchButtons(root=document) {
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

// initial wire & form submit support
function wireInitial() {
  bindSearchButtons(document);
  const form = $('form#searchForm') || $('form');
  if (form && !form.dataset.skydealFormBound) {
    form.addEventListener('submit', doSearch);
    form.dataset.skydealFormBound = '1';
  }
  console.log('[SkyDeal] frontend ready (bindings set)');
}

// MutationObserver to catch re-renders
const mo = new MutationObserver((muts) => {
  for (const m of muts) {
    if (m.type === 'childList' && (m.addedNodes?.length || m.removedNodes?.length)) {
      bindSearchButtons(document);
    }
  }
});
document.addEventListener('DOMContentLoaded', () => {
  wireInitial();
  mo.observe(document.body, { childList: true, subtree: true });
});

// Watchdog in case frameworks swap nodes silently
setInterval(() => bindSearchButtons(document), 1200);

// --- Optional: hit Enter in any input to search ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
    e.preventDefault();
    doSearch(e);
  }
});
