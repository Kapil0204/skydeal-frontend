/* ===== config ===== */
const API_BASE = 'https://skydeal-backend.onrender.com';

/* ===== DOM ===== */
const els = {
  from:          document.getElementById('fromInput'),
  to:            document.getElementById('toInput'),
  depart:        document.getElementById('departInput'),
  ret:           document.getElementById('returnInput'),
  pax:           document.getElementById('paxSelect'),
  cabin:         document.getElementById('cabinSelect'),
  oneWay:        document.getElementById('oneWay'),
  roundTrip:     document.getElementById('roundTrip'),
  search:        document.getElementById('searchBtn'),
  pmBtn:         document.getElementById('paymentBtn'),
  pmCount:       document.getElementById('pmCount'),
  outList:       document.getElementById('outboundList'),
  retList:       document.getElementById('returnList'),
  outPage:       document.getElementById('outPage'),
  retPage:       document.getElementById('retPage'),
  outPrev:       document.getElementById('outPrev'),
  outNext:       document.getElementById('outNext'),
  retPrev:       document.getElementById('retPrev'),
  retNext:       document.getElementById('retNext'),
  modal:         document.getElementById('paymentModal'),
  pmClose:       document.getElementById('pmClose'),
  pmTabs:        document.querySelectorAll('.pm-tabs .tab'),
  pmList:        document.getElementById('pmList'),
  pmDone:        document.getElementById('pmDone'),
  pmClear:       document.getElementById('pmClear')
};

/* ===== State ===== */
let paymentOptions = { usedFallback:false, options: { 'Credit Card':[], 'Debit Card':[], 'Net Banking':[], 'UPI':[], 'Wallet':[] } };
let selectedFilters = []; // [{type:'Credit Card',bank:'HDFC Bank'}, ...]
let activeTab = 'Credit Card';

let outFlights = []; let retFlights = [];
let outPage = 1, retPage = 1, pageSize = 10;

/* ===== Helpers ===== */
const fmt = (n) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
const iso = (d) => d ? d.split('/').reverse().join('-') : ''; // supports dd/mm/yyyy also

function toggleModal(show){
  els.modal.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (show) els.pmBtn.blur();
}

function renderPaymentList(){
  const list = paymentOptions.options[activeTab] || [];
  els.pmList.innerHTML = '';
  if (!list.length){
    const div = document.createElement('div');
    div.className = 'pm-item';
    div.textContent = 'No options';
    els.pmList.appendChild(div);
    return;
  }
  list.forEach(bank => {
    const id = `${activeTab}__${bank}`;
    const row = document.createElement('label');
    row.className = 'pm-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.id = id;

    const checked = selectedFilters.some(f => f.type === activeTab && f.bank === bank);
    cb.checked = checked;

    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!selectedFilters.some(f => f.type === activeTab && f.bank === bank)){
          selectedFilters.push({ type: activeTab, bank });
        }
      } else {
        selectedFilters = selectedFilters.filter(f => !(f.type === activeTab && f.bank === bank));
      }
      els.pmCount.textContent = selectedFilters.length;
    });

    const span = document.createElement('span');
    span.textContent = bank;

    row.appendChild(cb); row.appendChild(span);
    els.pmList.appendChild(row);
  });
}

function bindTabs(){
  els.pmTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      els.pmTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      renderPaymentList();
    });
  });
}

/* ===== Fetch Payment Options ===== */
async function loadPaymentOptions() {
  try{
    const res = await fetch(`${API_BASE}/payment-options`);
    const data = await res.json();
    // clean out any "sentences" accidentally parsed as options
    for (const k of Object.keys(data.options || {})) {
      data.options[k] = (data.options[k] || []).filter(x =>
        typeof x === 'string' &&
        x.length <= 40 &&
        !/not applicable|wallet|gift\s*card|3rd party|paypal/i.test(x)
      );
    }
    paymentOptions = data;
    console.log('[SkyDeal] /payment-options', paymentOptions);
    renderPaymentList();
  }catch(err){
    console.error('payment-options failed', err);
    paymentOptions = { usedFallback:true, options:{'Credit Card':[],'Debit Card':[],'Net Banking':[],'UPI':[],'Wallet':[]} };
    renderPaymentList();
  }
}

/* ===== Search & Render ===== */
function showEmpty(){
  els.outList.classList.add('empty');
  els.retList.classList.add('empty');
  els.outList.textContent = 'No flights found for your search.';
  els.retList.textContent = 'No flights found for your search.';
  els.outPrev.disabled = els.outNext.disabled = true;
  els.retPrev.disabled = els.retNext.disabled = true;
  els.outPage.textContent = '1'; els.retPage.textContent = '1';
}
function slicePage(list, page){
  const start = (page-1)*pageSize; return list.slice(start, start+pageSize);
}
function renderFlights(){
  // Outbound
  if (!outFlights.length){ els.outList.innerHTML=''; showEmpty(); return; }
  els.outList.classList.remove('empty');
  els.outList.innerHTML = '';
  slicePage(outFlights, outPage).forEach(f => {
    const card = document.createElement('div'); card.className='card';
    const left = document.createElement('div');
    left.innerHTML = `
      <div><strong>${f.airlineName || f.airline || '—'}</strong> • ${f.flightNumber || ''}</div>
      <div class="meta">${f.from} ${f.departureTime || ''} → ${f.to} ${f.arrivalTime || ''} • ${f.stops ?? 0} stop(s)</div>
      <div class="meta">Best: ${f.bestDeal?.portal ? `${fmt(f.bestDeal.finalPrice)} on ${f.bestDeal.portal}` : '—'}</div>`;
    const right = document.createElement('div');
    right.innerHTML = `<div class="price">${fmt(f.price || f.total || f.basePrice || 0)}</div>`;
    card.appendChild(left); card.appendChild(right);
    els.outList.appendChild(card);
  });
  els.outPrev.disabled = outPage<=1;
  els.outNext.disabled = outPage*pageSize >= outFlights.length;
  els.outPage.textContent = String(outPage);

  // Return
  els.retList.innerHTML = '';
  if (retFlights.length){
    els.retList.classList.remove('empty');
    slicePage(retFlights, retPage).forEach(f => {
      const card = document.createElement('div'); card.className='card';
      const left = document.createElement('div');
      left.innerHTML = `
        <div><strong>${f.airlineName || f.airline || '—'}</strong> • ${f.flightNumber || ''}</div>
        <div class="meta">${f.from} ${f.departureTime || ''} → ${f.to} ${f.arrivalTime || ''} • ${f.stops ?? 0} stop(s)</div>
        <div class="meta">Best: ${f.bestDeal?.portal ? `${fmt(f.bestDeal.finalPrice)} on ${f.bestDeal.portal}` : '—'}</div>`;
      const right = document.createElement('div');
      right.innerHTML = `<div class="price">${fmt(f.price || f.total || f.basePrice || 0)}</div>`;
      card.appendChild(left); card.appendChild(right);
      els.retList.appendChild(card);
    });
    els.retPrev.disabled = retPage<=1;
    els.retNext.disabled = retPage*pageSize >= retFlights.length;
    els.retPage.textContent = String(retPage);
  } else {
    els.retList.classList.add('empty');
    els.retList.textContent = 'No flights found for your search.';
    els.retPrev.disabled = els.retNext.disabled = true;
    els.retPage.textContent = '1';
  }
}

async function doSearch(){
  outPage = retPage = 1;
  els.outList.innerHTML = els.retList.innerHTML = '';
  els.outList.classList.add('empty'); els.outList.textContent = 'Searching...';
  els.retList.classList.add('empty'); els.retList.textContent = 'Searching...';

  const payload = {
    from: (els.from.value || 'BOM').trim().toUpperCase(),
    to:   (els.to.value   || 'DEL').trim().toUpperCase(),
    departureDate: els.depart.value.includes('/') ? iso(els.depart.value) : els.depart.value,
    returnDate:    els.roundTrip.checked ? (els.ret.value.includes('/') ? iso(els.ret.value) : els.ret.value) : '',
    tripType: els.roundTrip.checked ? 'round-trip' : 'one-way',
    passengers: Number(els.pax.value || 1),
    travelClass: (els.cabin.value || 'economy'),
    paymentFilters: selectedFilters     // <- important
  };

  try{
    const res = await fetch(`${API_BASE}/search`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('[SkyDeal] /search meta', data.meta);

    if (data.meta?.outStatus === 404 && (data.outboundFlights||[]).length===0){
      showEmpty();
      return;
    }

    outFlights = data.outboundFlights || [];
    retFlights = data.returnFlights   || [];
    renderFlights();
  }catch(err){
    console.error('Search failed', err);
    showEmpty();
  }
}

/* ===== Wire Up ===== */
document.addEventListener('DOMContentLoaded', () => {
  // Payment modal open
  els.pmBtn.addEventListener('click', () => {
    toggleModal(true);
    // ensure content is there
    renderPaymentList();
  });

  // Close modal
  els.pmClose.addEventListener('click', () => toggleModal(false));
  els.pmDone.addEventListener('click', () => toggleModal(false));
  els.pmClear.addEventListener('click', () => {
    selectedFilters = [];
    els.pmCount.textContent = '0';
    renderPaymentList();
  });

  bindTabs();
  loadPaymentOptions();

  // Trip type toggles return input enable
  function syncTrip(){
    const rt = els.roundTrip.checked;
    els.ret.disabled = !rt;
    if (!rt){ els.ret.value = ''; }
  }
  els.oneWay.addEventListener('change', syncTrip);
  els.roundTrip.addEventListener('change', syncTrip);
  syncTrip();

  // Pagination
  els.outPrev.addEventListener('click', () => { if(outPage>1){ outPage--; renderFlights(); }});
  els.outNext.addEventListener('click', () => { if(outPage*pageSize<outFlights.length){ outPage++; renderFlights(); }});
  els.retPrev.addEventListener('click', () => { if(retPage>1){ retPage--; renderFlights(); }});
  els.retNext.addEventListener('click', () => { if(retPage*pageSize<retFlights.length){ retPage++; renderFlights(); }});

  // Search
  els.search.addEventListener('click', doSearch);
});
