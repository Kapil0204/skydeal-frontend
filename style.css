// ======= CONFIG =======
const API_BASE = 'https://skydeal-backend.onrender.com';

// ======= STATE =======
const state = {
  selectedMethods: [],
  paymentOptions: null,
  pageSize: 12,
  outPage: 1,
  retPage: 1,
  outFlights: [],
  retFlights: [],
};

// ======= DOM =======
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelector(sel);

const inpFrom  = $('from');
const inpTo    = $('to');
const inpDep   = $('departure');
const inpRet   = $('return');
const selPax   = $('passengers');
const selCabin = $('cabin');
const r1       = $('tripOneWay');
const r2       = $('tripRoundTrip');

const btnSearch   = $('searchBtn');
const btnPayOpen  = $('openPaymentBtn');

const outList     = $('outboundList');
const retList     = $('returnList');
const outPrev     = $('outPrev');
const outNext     = $('outNext');
const outPageText = $('outPageText');
const retPrev     = $('retPrev');
const retNext     = $('retNext');
const retPageText = $('retPageText');

// Payment modal
const payModal  = $('paymentModal');
const payClose  = $('paymentClose');
const payTabs   = $('paymentTabs');
const payList   = $('paymentList');
const payDone   = $('paymentDone');
const payClear  = $('paymentClear');
const payCount  = $('paymentCount');

// Price modal
const priceModal  = $('priceModal');
const priceClose  = $('priceClose');
const priceTitle  = $('priceTitle');
const priceTBody  = $('priceTableBody');
const priceWhy    = $('priceWhy');

// ======= UTIL =======
function fmtINR(n){ try{return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n))}catch{return `₹${n}`}}
function ensureArray(x){ return Array.isArray(x)?x:[]; }
function setOpen(el,open){ if(!el) return; open? el.classList.add('open') : el.classList.remove('open'); }
function todayYYYYMMDD(){ const d=new Date(); return d.toISOString().slice(0,10); }

// ======= PAYMENT =======
async function loadPaymentOptions(){
  if(state.paymentOptions) return state.paymentOptions;
  const r = await fetch(`${API_BASE}/payment-options`);
  const j = await r.json();
  state.paymentOptions = j; // { options: { CreditCard:[...], DebitCard:[...], NetBanking:[...], UPI:[...], Wallet:[...], EMI:[...] } }
  return j;
}

function renderPaymentCategory(label, list){
  payList.innerHTML = '';
  const frag = document.createDocumentFragment();
  ensureArray(list).forEach((name, i)=>{
    const row = document.createElement('label');
    row.className = 'pay-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = name;
    cb.checked = state.selectedMethods.includes(name);
    cb.addEventListener('change',()=>{
      if(cb.checked){ if(!state.selectedMethods.includes(name)) state.selectedMethods.push(name); }
      else { state.selectedMethods = state.selectedMethods.filter(v=>v!==name); }
      updatePayCount();
    });

    const span = document.createElement('span');
    span.textContent = name;

    row.appendChild(cb); row.appendChild(span);
    frag.appendChild(row);
  });
  payList.appendChild(frag);
}

function updatePayCount(){ payCount.textContent = `Selected (${state.selectedMethods.length})`; }

function buildPayTabs(opts){
  const cats = [
    ['Credit Card','CreditCard'],
    ['Debit Card','DebitCard'],
    ['Net Banking','NetBanking'],
    ['UPI','UPI'],
    ['Wallet','Wallet'],
    ['EMI','EMI'],
  ];

  payTabs.innerHTML = '';
  cats.forEach(([label,key], idx)=>{
    const b = document.createElement('button');
    b.type='button';
    b.className = 'pill' + (idx===0?' active':'');
    b.textContent = label;
    b.addEventListener('click',()=>{
      [...payTabs.querySelectorAll('.pill')].forEach(p=>p.classList.remove('active'));
      b.classList.add('active');
      renderPaymentCategory(label, opts.options?.[key]||[]);
    });
    payTabs.appendChild(b);
  });

  renderPaymentCategory('Credit Card', opts.options?.CreditCard||[]);
  updatePayCount();
}

async function openPay(){
  const opts = await loadPaymentOptions();
  buildPayTabs(opts);
  setOpen(payModal,true);
}
function closePay(){ setOpen(payModal,false); }
function clearPay(){
  state.selectedMethods = [];
  updatePayCount();
  const active = payTabs.querySelector('.pill.active'); if(active) active.click();
}

// ======= SEARCH =======
function buildBody(){
  const tripType = r1.checked ? 'one-way' : 'round-trip';
  return {
    from: (inpFrom.value||'').trim().toUpperCase(),
    to: (inpTo.value||'').trim().toUpperCase(),
    departureDate: inpDep.value,
    returnDate: tripType==='round-trip' ? inpRet.value : '',
    tripType,
    passengers: Number(selPax.value||1),
    travelClass: (selCabin.value||'Economy').toLowerCase(),
    paymentMethods: [...state.selectedMethods],
  };
}

async function doSearch(){
  const b = buildBody();
  if(!b.from || !b.to || !b.departureDate){
    alert('Please fill From, To, and Departure.');
    return;
  }

  outList.innerHTML = ''; retList.innerHTML = '';
  state.outPage = 1; state.retPage = 1;

  let json;
  try{
    const r = await fetch(`${API_BASE}/search`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(b)
    });
    json = await r.json();
  }catch(e){
    console.error(e); alert('Search failed.'); return;
  }

  state.outFlights = ensureArray(json.outboundFlights);
  state.retFlights = ensureArray(json.returnFlights);
  renderFlights();
}

function paginate(arr, page, size){ const s=(page-1)*size; return arr.slice(s,s+size); }
function renderFlights(){
  renderList(outList, state.outFlights, state.outPage, outPageText);
  renderList(retList, state.retFlights, state.retPage, retPageText);
}
function renderList(container, flights, page, pageLabelEl){
  container.innerHTML = '';
  const items = paginate(flights, page, state.pageSize);

  items.forEach(f=>{
    const card = document.createElement('div');
    card.className='flight-card';

    const t = document.createElement('div');
    t.className='flight-title';
    const airline = f.airlineName || f.carrier || 'Carrier';
    const times = `${f.departureTime||''} → ${f.arrivalTime||''}`.replace(/^ → $/,'');
    const stops = (f.stops==null || Number(f.stops)===0) ? 'Non-stop' : `${f.stops} stop${Number(f.stops)>1?'s':''}`;
    t.textContent = `${airline}${times?` • ${times}`:''} • ${stops}`;

    const best = document.createElement('div');
    best.className='best-line';
    if(f.bestDeal?.portal && f.bestDeal?.finalPrice!=null){
      best.innerHTML = `Best: <strong>${fmtINR(f.bestDeal.finalPrice)}</strong> on <strong>${f.bestDeal.portal}</strong><br><span class="best-note">Best price after applicable offers (if any)</span>`;
    } else {
      best.textContent = `Best: ${fmtINR(f.price || f.basePrice || 0)}`;
    }

    const btn = document.createElement('button');
    btn.className='btn-secondary';
    btn.textContent='Prices & breakdown';
    btn.addEventListener('click',()=>openPrice(f));

    card.appendChild(t); card.appendChild(best); card.appendChild(btn);
    container.appendChild(card);
  });

  const totalPages = Math.max(1, Math.ceil(flights.length / state.pageSize));
  pageLabelEl.textContent = `Page ${page} / ${totalPages}`;
}

// ======= PRICE MODAL =======
function openPrice(f){
  const airline = f.airlineName || f.carrier || 'Carrier';
  const times = `${f.departureTime||''} → ${f.arrivalTime||''}`.replace(/^ → $/,'');
  const base = f.price || f.basePrice;
  priceTitle.textContent = `${airline}${times?` • ${times}`:''} • Base ${fmtINR(base)}`;

  priceTBody.innerHTML='';
  ensureArray(f.portalPrices).forEach(p=>{
    const tr=document.createElement('tr');
    const td1=document.createElement('td'); td1.textContent=p.portal;
    const td2=document.createElement('td'); td2.textContent=fmtINR(p.finalPrice);
    const td3=document.createElement('td'); td3.textContent=p.source||'';
    tr.append(td1,td2,td3);
    priceTBody.appendChild(tr);
  });

  // if backend attaches per-flight explanation to `offerWhy`, show it; else empty object
  priceWhy.textContent = JSON.stringify(f.offerWhy || {}, null, 2);

  setOpen(priceModal,true);
}
function closePrice(){ setOpen(priceModal,false); }

// ======= PAGERS =======
outPrev.addEventListener('click',()=>{ if(state.outPage>1){ state.outPage--; renderFlights(); }});
outNext.addEventListener('click',()=>{ const max=Math.max(1,Math.ceil(state.outFlights.length/state.pageSize)); if(state.outPage<max){ state.outPage++; renderFlights(); }});
retPrev.addEventListener('click',()=>{ if(state.retPage>1){ state.retPage--; renderFlights(); }});
retNext.addEventListener('click',()=>{ const max=Math.max(1,Math.ceil(state.retFlights.length/state.pageSize)); if(state.retPage<max){ state.retPage++; renderFlights(); }});

// ======= WIRE =======
document.addEventListener('DOMContentLoaded',()=>{
  // set default dates so validation passes
  if(!inpDep.value){ inpDep.value = todayYYYYMMDD(); }
  if(!inpRet.value){ inpRet.value = todayYYYYMMDD(); }

  btnPayOpen.addEventListener('click', openPay);
  payClose.addEventListener('click', closePay);
  payDone.addEventListener('click', closePay);
  payClear.addEventListener('click', clearPay);

  btnSearch.addEventListener('click', doSearch);

  priceClose.addEventListener('click', closePrice);

  r1.addEventListener('change',()=>{ inpRet.disabled = r1.checked; if(r1.checked) inpRet.value=''; });
  r2.addEventListener('change',()=>{ inpRet.disabled = !r2.checked; });
});
