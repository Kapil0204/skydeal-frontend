/******************************
 * SKYDEAL FRONTEND – DO NOT CHANGE LAYOUT
 * Only logic restored: backend search + tabbed payment selector (live from Mongo)
 ******************************/

/* ========= CONFIG (same names as before) ========= */
const BACKEND_URL = "https://skydeal-backend.onrender.com/search";
const PAYMENT_OPTIONS_URL = "https://skydeal-backend.onrender.com/payment-options";

/* ========= SELECTORS (adjust ONLY if your IDs differ) ========= */
const els = {
  from:        document.querySelector('#from'),
  to:          document.querySelector('#to'),
  departDate:  document.querySelector('#departDate'),
  returnDate:  document.querySelector('#returnDate'),
  pax:         document.querySelector('#passengers'),
  cabin:       document.querySelector('#cabin'),           // Economy / Business etc
  oneWay:      document.querySelector('#oneWay'),
  roundTrip:   document.querySelector('#roundTrip'),
  searchBtn:   document.querySelector('#searchBtn'),

  // Payment selector button + popover container we already had
  paymentBtn:  document.querySelector('#paymentBtn'),
  pmPopover:   document.querySelector('#paymentPopover'),  // the floating panel/div
  pmTabs:      document.querySelector('#pmTabs'),          // the tab buttons container
  pmLists:     document.querySelector('#pmLists'),         // area where lists render
  pmDone:      document.querySelector('#pmDone'),
  pmClear:     document.querySelector('#pmClear'),

  // Results (existing two columns)
  outboundWrap: document.querySelector('#outboundResults'),
  returnWrap:   document.querySelector('#returnResults'),

  // Optional filters you already had—leave wired if present (safe to be null)
  outAirlineFilter: document.querySelector('#outAirlineFilter'),
  outTimeFilter:    document.querySelector('#outTimeFilter'),
  retAirlineFilter: document.querySelector('#retAirlineFilter'),
  retTimeFilter:    document.querySelector('#retTimeFilter'),
  sortSelect:       document.querySelector('#sortSelect')
};

/* ========= STATE ========= */
const state = {
  paymentCatalog: {
    // will be filled live from backend:
    // { creditCard: [{label, key}], debitCard:[], wallets:[], netBanking:[], upi:[] }
  },
  selectedPayments: new Set(), // store keys like "credit|ICICI Bank Credit Card"
  lastSearch: null,
};

/* ========= UTIL ========= */
const fmtINR = n => Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const val = (el, d="") => (el && el.value || d).trim().toUpperCase ? (el.value || d).trim().toUpperCase() : (el?.value || d);

function readTripType() {
  if (els.roundTrip && els.roundTrip.checked) return 'round-trip';
  return 'one-way';
}

function formatTime(hhmm) {
  // accepts "11:00" or ISO, returns "11:00"
  if (!hhmm) return "--:--";
  if (/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const d = new Date(hhmm);
  if (isNaN(d)) return "--:--";
  return d.toTimeString().slice(0,5);
}

/* ========= PAYMENT OPTIONS (TABBED) ========= */
const TABS = [
  { key: 'creditCard',  label: 'Credit Card' },
  { key: 'debitCard',   label: 'Debit Card' },
  { key: 'wallets',     label: 'Wallets' },
  { key: 'netBanking',  label: 'NetBanking' },
  { key: 'upi',         label: 'UPI' },
];

async function loadPaymentOptions() {
  try {
    const r = await fetch(PAYMENT_OPTIONS_URL);
    if (!r.ok) throw new Error('Failed to load payment options');
    const data = await r.json();
    // Expecting shape: { creditCard:[{label,key}], debitCard:[], wallets:[], netBanking:[], upi:[] }
    state.paymentCatalog = data || {};
    buildPaymentTabs();
  } catch (e) {
    console.error('Payment options error:', e);
    // Fallback minimal catalog so the UI still works
    state.paymentCatalog = {
      creditCard: [
        { label: 'ICICI Bank Credit Card', key: 'credit|ICICI' },
        { label: 'HDFC Bank Credit Card',  key: 'credit|HDFC'  },
        { label: 'Axis Bank Credit Card',  key: 'credit|AXIS'  },
        { label: 'SBI Credit Card',        key: 'credit|SBI'   },
      ],
      debitCard: [],
      wallets: [],
      netBanking: [],
      upi: []
    };
    buildPaymentTabs();
  }
}

function buildPaymentTabs() {
  if (!els.pmTabs || !els.pmLists) return; // if your markup doesn’t include popover yet
  els.pmTabs.innerHTML = '';
  els.pmLists.innerHTML = '';

  // Tabs
  TABS.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pm-tab' + (i===0 ? ' active':'');
    b.textContent = t.label;
    b.dataset.tab = t.key;
    b.addEventListener('click', () => switchTab(t.key));
    els.pmTabs.appendChild(b);
  });

  // Lists (one per tab)
  TABS.forEach((t, i) => {
    const listWrap = document.createElement('div');
    listWrap.className = 'pm-list' + (i===0 ? '' : ' hidden');
    listWrap.dataset.for = t.key;

    const items = state.paymentCatalog[t.key] || [];
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'pm-empty';
      p.textContent = 'No options';
      listWrap.appendChild(p);
    } else {
      items.forEach(({ label, key }) => {
        // Normalize keys if backend doesn’t provide them
        const k = key || `${t.key}|${label}`;
        const row = document.createElement('label');
        row.className = 'pm-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = state.selectedPayments.has(k);
        cb.addEventListener('change', () => {
          if (cb.checked) state.selectedPayments.add(k);
          else state.selectedPayments.delete(k);
          updatePaymentBtnLabel();
        });

        const span = document.createElement('span');
        span.textContent = label;

        row.appendChild(cb);
        row.appendChild(span);
        row.dataset.key = k;
        listWrap.appendChild(row);
      });
    }
    els.pmLists.appendChild(listWrap);
  });

  updatePaymentBtnLabel();
}

function switchTab(key) {
  // buttons
  els.pmTabs.querySelectorAll('.pm-tab').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab===key);
  });
  // lists
  els.pmLists.querySelectorAll('.pm-list').forEach(w=>{
    w.classList.toggle('hidden', w.dataset.for!==key);
  });
}

function updatePaymentBtnLabel() {
  if (!els.paymentBtn) return;
  const count = state.selectedPayments.size;
  els.paymentBtn.querySelector('.pm-label')?.remove();

  const span = document.createElement('span');
  span.className = 'pm-label';
  span.textContent = count ? `${count} selected` : 'Select Payment Methods';
  els.paymentBtn.appendChild(span);
}

/* popover open/close */
function togglePaymentPopover(show) {
  if (!els.pmPopover || !els.paymentBtn) return;
  const visible = show ?? els.pmPopover.classList.contains('hidden');
  els.pmPopover.classList.toggle('hidden', !visible);
  if (visible) positionPopover();
}
function positionPopover() {
  // simple anchor below the button
  const r = els.paymentBtn.getBoundingClientRect();
  Object.assign(els.pmPopover.style, {
    position: 'absolute',
    left: `${r.left}px`,
    top: `${r.bottom + 8}px`
  });
}
document.addEventListener('click', (e)=>{
  if (!els.pmPopover || els.pmPopover.classList.contains('hidden')) return;
  const within = e.target===els.pmPopover || els.pmPopover.contains(e.target) || e.target===els.paymentBtn || els.paymentBtn.contains(e.target);
  if (!within) togglePaymentPopover(false);
});

/* ========= SEARCH ========= */
function getSelectedPaymentLabels() {
  // Pass selected payments to backend as labels if needed later; currently backend applies offers automatically
  return Array.from(state.selectedPayments);
}

async function doSearch() {
  // Read fields without altering layout
  const from = els.from?.value?.trim().toUpperCase() || '';
  const to = els.to?.value?.trim().toUpperCase() || '';
  const departureDate = els.departDate?.value || '';
  const returnDate = els.returnDate?.value || '';
  const tripType = readTripType();
  const passengers = Math.max(1, parseInt(els.pax?.value || '1', 10));
  const travelClass = (els.cabin?.value || 'ECONOMY').toUpperCase();

  if (!from || !to || !departureDate) {
    renderEmptyResults('Please enter From, To and Departure date.');
    return;
  }

  // Build payload—this matches the backend you just deployed
  const payload = {
    from, to, departureDate, passengers, travelClass, tripType
  };
  if (tripType === 'round-trip' && returnDate) payload.returnDate = returnDate;

  // (Optional) send selected payment method keys if you want to use them later on the backend
  payload.paymentMethods = getSelectedPaymentLabels();

  try {
    setLoading(true);
    const r = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(`Search failed (${r.status})`);
    const data = await r.json();
    state.lastSearch = data;
    renderResults(data);
  } catch (e) {
    console.error('Search error:', e);
    renderEmptyResults('No flights found.');
  } finally {
    setLoading(false);
  }
}

/* ========= RENDER ========= */
function clearNode(n){
  if (!n) return; while(n.firstChild) n.removeChild(n.firstChild);
}
function renderEmptyResults(msg){
  clearNode(els.outboundWrap);
  clearNode(els.returnWrap);
  if (els.outboundWrap) {
    const p=document.createElement('p'); p.className='muted'; p.textContent=msg||'No flights';
    els.outboundWrap.appendChild(p);
  }
  if (els.returnWrap) {
    const p=document.createElement('p'); p.className='muted'; p.textContent=msg||'No flights';
    els.returnWrap.appendChild(p);
  }
}

function renderResults(data){
  const out = Array.isArray(data?.outboundFlights) ? data.outboundFlights : [];
  const ret = Array.isArray(data?.returnFlights) ? data.returnFlights : [];

  renderList(els.outboundWrap, out);
  renderList(els.returnWrap, ret);
}

function renderList(container, list){
  if (!container) return;
  clearNode(container);
  if (!list.length){
    const p=document.createElement('p'); p.className='muted'; p.textContent='No flights';
    container.appendChild(p);
    return;
  }
  list.forEach(f=>{
    // f is already marked up by backend: airlineName, flightNumber, departure, arrival, price, portalPrices[]
    const card = document.createElement('div');
    card.className = 'flight-card';

    const header = document.createElement('div');
    header.className = 'fc-head';
    header.textContent = `${f.airlineName || 'Airline'} ${f.flightNumber || ''}`.trim();

    const times = document.createElement('div');
    times.className = 'fc-times';
    times.textContent = `${formatTime(f.departure)} → ${formatTime(f.arrival)}`;

    const price = document.createElement('div');
    price.className = 'fc-price';
    price.textContent = fmtINR(f.price || 0);

    // Best portal (already computed by backend incl. +₹250 & offers)
    const portals = Array.isArray(f.portalPrices) ? f.portalPrices : [];
    const best = portals.slice().sort((a,b)=>(a.finalPrice??1e15)-(b.finalPrice??1e15))[0];

    const deal = document.createElement('div');
    deal.className = 'fc-deal';
    if (best) {
      const line = [];
      line.push(best.portal);
      line.push(`→ ${fmtINR(best.finalPrice)}`);
      if (best.appliedOffer) {
        const o = best.appliedOffer;
        // backend sends normalized fields; show compact note
        const note = [];
        if (o.couponCode) note.push(o.couponCode);
        if (o.discountPercent) note.push(`${o.discountPercent}%`);
        if (o.maxDiscountAmount) note.push(`cap ${fmtINR(o.maxDiscountAmount)}`);
        deal.textContent = `${line.join(' ')}  •  ${note.join(' | ')}`;
      } else {
        deal.textContent = line.join(' ');
      }
    } else {
      deal.textContent = '—';
    }

    card.appendChild(header);
    card.appendChild(times);
    card.appendChild(price);
    card.appendChild(deal);
    container.appendChild(card);
  });
}

function setLoading(on){
  document.body.classList.toggle('loading', !!on);
}

/* ========= WIRE UP ========= */
function wireEvents(){
  // Search
  els.searchBtn && els.searchBtn.addEventListener('click', doSearch);

  // Trip toggle hide/show return date (no layout change)
  if (els.oneWay && els.returnDate) {
    els.oneWay.addEventListener('change', () => {
      els.returnDate.closest('.return-date-wrap')?.classList.toggle('hidden', true);
    });
  }
  if (els.roundTrip && els.returnDate) {
    els.roundTrip.addEventListener('change', () => {
      els.returnDate.closest('.return-date-wrap')?.classList.toggle('hidden', false);
    });
  }

  // Payment popover
  if (els.paymentBtn) {
    els.paymentBtn.addEventListener('click', () => togglePaymentPopover());
  }
  els.pmDone && els.pmDone.addEventListener('click', ()=> togglePaymentPopover(false));
  els.pmClear && els.pmClear.addEventListener('click', ()=>{
    state.selectedPayments.clear();
    // uncheck all
    els.pmLists?.querySelectorAll('input[type="checkbox"]')?.forEach(cb=>cb.checked=false);
    updatePaymentBtnLabel();
  });

  // (Optional) filters you already had
  [els.outAirlineFilter, els.outTimeFilter, els.retAirlineFilter, els.retTimeFilter, els.sortSelect]
    .filter(Boolean)
    .forEach(el => el.addEventListener('change', ()=> {
      // keep it simple: re-render from lastSearch; your existing CSS/HTML stays as-is
      if (state.lastSearch) renderResults(state.lastSearch);
    }));
}

/* ========= INIT ========= */
(function init(){
  wireEvents();
  loadPaymentOptions(); // build the tabbed selector from Mongo
  // default: show return date if round trip is on
  if (els.roundTrip?.checked && els.returnDate){
    els.returnDate.closest('.return-date-wrap')?.classList.remove('hidden');
  }
})();
