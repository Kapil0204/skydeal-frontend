// ==== CONFIG ====
const BACKEND_BASE = (window.SKYDEAL_API_BASE || "https://skydeal-backend.onrender.com").replace(/\/+$/,'');
// endpoints we use:
//  - GET  /api/payment-methods         -> grouped payment methods from Mongo
//  - POST /search                      -> real flights (Amadeus) {from,to,departureDate,returnDate,passengers,travelClass,tripType}

// ==== DOM HOOKS ====
const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const departInput = document.getElementById('departInput');
const returnInput = document.getElementById('returnInput');
const passengersInput = document.getElementById('passengersInput');
const cabinInput = document.getElementById('cabinInput');
const searchBtn = document.getElementById('searchBtn');

const outboundList = document.getElementById('outboundList');
const returnList   = document.getElementById('returnList');

const paymentTrigger = document.getElementById('paymentTrigger');
const paymentModal = document.getElementById('paymentModal');
const pmLists = document.getElementById('pmLists');
const donePM = document.getElementById('donePM');
const clearPM = document.getElementById('clearPM');

const portalModal = document.getElementById('portalModal');
const portalBody  = document.getElementById('portalBody');
const portalTitle = document.getElementById('portalTitle');
document.getElementById('closePortal').onclick = () => hideModal(portalModal);

// Trip toggle behavior
const tripRadios = Array.from(document.querySelectorAll('input[name="trip"]'));
function currentTrip(){ return (tripRadios.find(r=>r.checked)?.value) || 'round-trip'; }
function syncTripUI(){
  const rt = currentTrip()==='round-trip';
  returnInput.disabled = !rt;
  returnInput.parentElement?.classList?.toggle?.('disabled', !rt);
}
tripRadios.forEach(r=>r.addEventListener('change', syncTripUI));
syncTripUI();

// ===== PAYMENT METHODS (from Mongo) =====
let allPayment = {
  creditCard: [], debitCard: [], wallet: [], upi: [], netBanking: [], emi: []
};
let selectedPayment = new Set(); // store "type::name" keys for stable dedupe

function keyFor(type, name){ return `${type}::${name}`; }
function labelForKey(k){ return k.split('::')[1]; }

async function loadPaymentMethods(){
  try {
    const res = await fetch(`${BACKEND_BASE}/api/payment-methods`, {credentials:'omit'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // normalize categories we support
    ['creditCard','debitCard','wallet','upi','netBanking','emi'].forEach(t=>{
      allPayment[t] = Array.isArray(data[t]) ? data[t] : [];
    });
    renderPaymentModal('creditCard'); // default tab
  } catch (e){
    console.error('Failed to load payment methods:', e);
    // fallback: minimal hardcoded if API down
    allPayment.creditCard = ['ICICI Bank Credit Card','HDFC Bank Credit Card','Axis Bank Credit Card','SBI Credit Card'];
    renderPaymentModal('creditCard');
  }
}

function renderPaymentModal(activeTab){
  // tabs activation
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.tab===activeTab);
    btn.onclick = () => renderPaymentModal(btn.dataset.tab);
  });

  // list
  const names = allPayment[activeTab] || [];
  pmLists.innerHTML = `
    <div class="pm-group">
      ${names.map(n=>{
        const k = keyFor(activeTab, n);
        const checked = selectedPayment.has(k) ? 'checked' : '';
        return `
          <label class="pm-item">
            <input type="checkbox" data-k="${k}" ${checked}/>
            <span>${n}</span>
          </label>`;
      }).join('') || `<div class="fmeta">No options</div>`}
    </div>
  `;

  pmLists.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    cb.onchange = (e)=>{
      const k = e.target.dataset.k;
      if (e.target.checked) selectedPayment.add(k);
      else selectedPayment.delete(k);
      updatePaymentTriggerLabel();
    };
  });
}

function updatePaymentTriggerLabel(){
  const count = selectedPayment.size;
  paymentTrigger.textContent = count ? `${count} selected ▾` : `Select payment methods ▾`;
}

paymentTrigger.onclick = () => showModal(paymentModal);
donePM.onclick = () => hideModal(paymentModal);
clearPM.onclick = () => { selectedPayment.clear(); updatePaymentTriggerLabel(); renderPaymentModal(document.querySelector('.tab.active')?.dataset.tab || 'creditCard'); };

function showModal(m){ m.classList.remove('hidden'); m.setAttribute('aria-hidden','false'); }
function hideModal(m){ m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); }

// ===== FLIGHT SEARCH =====
searchBtn.onclick = async () => {
  await doSearch();
};

async function doSearch(){
  // quick guards
  const from = fromInput.value.trim().toUpperCase();
  const to   = toInput.value.trim().toUpperCase();
  const dep  = departInput.value;
  const ret  = returnInput.value;
  const tripType = currentTrip();

  if (!from || !to || !dep){
    alert('Please fill From, To and Departure date.');
    return;
  }
  if (tripType === 'round-trip' && !ret){
    alert('Please select a Return date for round-trip.');
    return;
  }

  // render loading placeholders
  outboundList.innerHTML = `<div class="fmeta">Loading outbound flights…</div>`;
  returnList.innerHTML   = `<div class="fmeta">Loading return flights…</div>`;

  try{
    const body = {
      from, to,
      departureDate: dep,
      returnDate: tripType==='round-trip' ? ret : '',
      passengers: Number(passengersInput.value || 1),
      travelClass: cabinInput.value || 'Economy',
      tripType
    };

    const res = await fetch(`${BACKEND_BASE}/search`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
    if(!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = await res.json();

    // Expecting: { outbound: [], inbound: [] } or { outboundFlights, returnFlights }
    const outbound = data.outbound || data.outboundFlights || [];
    const inbound  = data.inbound  || data.returnFlights   || [];
    renderFlights(outboundList, outbound, `${from} → ${to}`);
    renderFlights(returnList, inbound, `${to} → ${from}`);
  }catch(e){
    console.error(e);
    outboundList.innerHTML = `<div class="fmeta">No flights (error fetching).</div>`;
    returnList.innerHTML   = `<div class="fmeta">No flights (error fetching).</div>`;
  }
}

function renderFlights(target, flights, routeTitle){
  if(!flights || !flights.length){
    target.innerHTML = `<div class="fmeta">No flights</div>`;
    return;
  }
  target.innerHTML = flights.map(f=>{
    const name = f.airline || f.flightName || 'Flight';
    const flightNo = f.flightNumber || '';
    const dep = f.departureTime || f.departure || '';
    const arr = f.arrivalTime || f.arrival || '';
    const stops = (f.stops==null)? '' : `${f.stops} stop${f.stops===1?'':'s'}`;
    const price = f.price || f.total || f.basePrice || f.bestDeal?.price || '—';

    // click = show simulated portal prices (+₹100 per portal)
    const cardId = cryptoRandomId();
    setTimeout(()=>{
      const btn = document.getElementById(cardId);
      if(btn) btn.onclick = () => openPortalPricing({name, flightNo, dep, arr, base: Number(price)||0});
    },0);

    return `
      <div class="flight-card">
        <div class="flight-main">
          <div>
            <div class="fname">${name}${flightNo?` ${flightNo}`:''}</div>
            <div class="fmeta">${dep} → ${arr} ${stops?`• ${stops}`:''}</div>
          </div>
        </div>
        <div class="flight-main">
          <div class="price">₹${price}</div>
          <button id="${cardId}" class="i-btn" title="Portal prices">i</button>
        </div>
      </div>
    `;
  }).join('');
}

function openPortalPricing({name, flightNo, dep, arr, base}){
  portalTitle.textContent = `${name} ${flightNo || ''} — ${dep} → ${arr}`;
  const portals = ['MakeMyTrip','Goibibo','Cleartrip','Yatra','EaseMyTrip'];
  portalBody.innerHTML = portals.map(p=>{
    const simulated = (Number(base)||0) + 100; // per requirement
    return `
      <div class="flight-card">
        <div class="flight-main">
          <div class="fname">${p}</div>
          <div class="fmeta">Simulated price</div>
        </div>
        <div class="price">₹${simulated}</div>
      </div>
    `;
  }).join('');
  showModal(portalModal);
}

function cryptoRandomId(){
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2);
}

// ===== INIT =====
(function init(){
  // default dates today/today+2
  const today = new Date();
  const plus2 = new Date(Date.now()+2*86400000);
  departInput.value = today.toISOString().slice(0,10);
  returnInput.value = plus2.toISOString().slice(0,10);

  loadPaymentMethods();
})();
