// ----- CONFIG -----
const API_BASE = 'https://skydeal-backend.onrender.com';

// ----- DOM -----
const els = {
  from:   document.getElementById('from'),
  to:     document.getElementById('to'),
  depart: document.getElementById('depart'),
  ret:    document.getElementById('return'),
  pax:    document.getElementById('pax'),
  cabin:  document.getElementById('cabin'),
  btnSearch: document.getElementById('btnSearch'),
  outList: document.getElementById('outList'),
  retList: document.getElementById('retList'),
  pageOut: document.getElementById('pageOut'),
  pageRet: document.getElementById('pageRet'),
  btnPayment: document.getElementById('btnPayment'),
  pmCount: document.getElementById('pmCount'),
  // modal
  modal: document.getElementById('paymentModal'),
  modalClose: document.getElementById('modalClose'),
  pillRow: document.getElementById('pillRow'),
  bankList: document.getElementById('bankList'),
  clearSel: document.getElementById('clearSel'),
  applySel: document.getElementById('applySel'),
};

let paymentData = { categories: [], banksByCat: {} };
let picked = {};    // { "Credit Card": Set(['HDFC Bank', ...]), ... }
let activeCat = 'Credit Card';

// ---------- Helpers ----------
const noiseRegex = /(offer is not applicable|payments (made|not applicable)|wallet|gift\s*card|pay\s*pal)/i;

function cleanList(arr) {
  const seen = new Set();
  return arr
    .filter(s => s && typeof s === 'string' && !noiseRegex.test(s))
    .map(s =>
      s
        .replace(/\b ltd\b/i,' LTD')
        .replace(/\b idfc\b/i,'IDFC')
        .replace(/\b hsbc bank\b/i,'HSBC Bank')
        .replace(/\b hdfc\b/i,'HDFC')
        .trim()
    )
    .filter(s => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a,b)=>a.localeCompare(b));
}

function renderBanks(cat){
  activeCat = cat;
  [...els.pillRow.querySelectorAll('.pill')].forEach(p=>{
    p.classList.toggle('active', p.dataset.cat===cat);
  });
  const sel = picked[cat] ?? new Set();
  const banks = paymentData.banksByCat[cat] ?? [];
  els.bankList.innerHTML = banks.map(name=>{
    const id = `b-${cat}-${name}`.replace(/\s+/g,'_');
    const checked = sel.has(name) ? 'checked' : '';
    return `
      <label class="bank">
        <input type="checkbox" id="${id}" data-cat="${cat}" data-name="${name}" ${checked}>
        <span>${name}</span>
      </label>`;
  }).join('') || `<div class="note">No options</div>`;
}

function openModal(){
  els.modal.setAttribute('aria-hidden','false');
}
function closeModal(){
  els.modal.setAttribute('aria-hidden','true');
}

// ---------- Payment modal ----------
async function fetchPaymentOptions(){
  const res = await fetch(`${API_BASE}/payment-options`, {cache:'no-store'});
  const json = await res.json();
  const options = json.options || {};

  const cats = ['Credit Card','Debit Card','Net Banking','UPI','Wallet'];
  paymentData.categories = cats;
  paymentData.banksByCat = {};
  cats.forEach(cat=>{
    paymentData.banksByCat[cat] = cleanList(options[cat] || []);
  });

  // init picked structure
  cats.forEach(cat => { if (!picked[cat]) picked[cat] = new Set(); });

  // render pills
  els.pillRow.innerHTML = cats.map((c,i)=>`<button class="pill ${i===0?'active':''}" data-cat="${c}">${c}</button>`).join('');
  renderBanks(activeCat);
}

function updateChipCount(){
  const total = Object.values(picked).reduce((n,set)=> n + (set?.size||0), 0);
  els.pmCount.textContent = `Selected (${total})`;
}

function wireModal(){
  // open
  els.btnPayment.addEventListener('click', ()=> openModal());
  // close
  els.modalClose.addEventListener('click', closeModal);
  els.modal.addEventListener('click', (e)=>{ if(e.target===els.modal) closeModal(); });

  // pill click
  els.pillRow.addEventListener('click', (e)=>{
    const b = e.target.closest('.pill'); if(!b) return;
    renderBanks(b.dataset.cat);
  });

  // checkbox change
  els.bankList.addEventListener('change', (e)=>{
    const cb = e.target;
    if (cb && cb.matches('input[type="checkbox"]')) {
      const {cat,name} = cb.dataset;
      const set = picked[cat] ?? (picked[cat] = new Set());
      cb.checked ? set.add(name) : set.delete(name);
      updateChipCount();
    }
  });

  // clear / apply
  els.clearSel.addEventListener('click', ()=>{
    Object.keys(picked).forEach(k => picked[k]?.clear());
    renderBanks(activeCat);
    updateChipCount();
  });
  els.applySel.addEventListener('click', ()=>{
    closeModal();
    updateChipCount();
  });
}

// ---------- Results render ----------
function renderFlights(div, flights){
  if (!flights || flights.length===0){
    div.innerHTML = `<div class="item"><div class="note">No flights found for your search.</div></div>`;
    return;
  }
  div.innerHTML = flights.map(f=>{
    const line = `${f.airlineName || f.airline || 'Flight'} • ${f.flightNumber || ''}`;
    const times = `${f.departure || f.depTime || ''} → ${f.arrival || f.arrTime || ''}`;
    const price = f.price ? new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(f.price) : '';
    const best = f.bestDeal?.portal ? `Best: ${new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(f.bestDeal.finalPrice)} on ${f.bestDeal.portal}` : (f.bestDeal?.note || '');
    return `
      <div class="item">
        <h4>${line}</h4>
        <div class="meta">${times}</div>
        <div class="meta">${price}</div>
        ${best ? `<div class="best">${best}</div>`:''}
      </div>`;
  }).join('');
}

// ---------- Search ----------
async function doSearch(){
  const body = {
    from: els.from.value.trim().toUpperCase(),
    to:   els.to.value.trim().toUpperCase(),
    departureDate: els.depart.value,
    returnDate:    els.ret.value,
    tripType: document.querySelector('input[name="trip"]:checked')?.value || 'round-trip',
    passengers: Number(els.pax.value || 1),
    travelClass: els.cabin.value || 'economy',
    paymentFilters: []
  };

  // flatten picked to filters the backend expects
  for (const cat of Object.keys(picked)){
    for (const bank of picked[cat]){
      body.paymentFilters.push({type: cat, bank});
    }
  }

  els.outList.innerHTML = `<div class="item"><div class="note">Searching…</div></div>`;
  els.retList.innerHTML = `<div class="item"><div class="note">Searching…</div></div>`;

  try{
    const res = await fetch(`${API_BASE}/search`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const data = await res.json();

    // Fail-safe handling (404/500 etc.)
    if (data?.meta?.outStatus !== 200 && (!data?.outboundFlights || data.outboundFlights.length===0)) {
      console.warn('[SkyDeal] /search meta', data?.meta);
      renderFlights(els.outList, []);
      renderFlights(els.retList,   []);
      return;
    }

    renderFlights(els.outList, data.outboundFlights || []);
    renderFlights(els.retList,  data.returnFlights   || []);

  }catch(err){
    console.error(err);
    renderFlights(els.outList, []);
    renderFlights(els.retList, []);
  }
}

// ---------- Init ----------
(function init(){
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const d1 = new Date(today); d1.setDate(d1.getDate()+3);
  const d2 = new Date(today); d2.setDate(d2.getDate()+13);
  els.depart.value = fmt(d1);
  els.ret.value    = fmt(d2);

  wireModal();
  fetchPaymentOptions().catch(console.error);
  updateChipCount();

  els.btnSearch.addEventListener('click', doSearch);
})();
