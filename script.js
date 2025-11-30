/* SkyDeal frontend – full script
   - Talks to deployed backend
   - Loads payment options with logging
   - Performs search and renders outbound + return
   - Adds ₹250 markup per portal using carrier-price
*/

const BACKEND = 'https://skydeal-backend.onrender.com';

// ------- UI refs -------
const fromInput      = document.getElementById('fromInput');
const toInput        = document.getElementById('toInput');
const departDate     = document.getElementById('departDate');
const returnDate     = document.getElementById('returnDate');
const paxSelect      = document.getElementById('paxSelect');
const cabinSelect    = document.getElementById('cabinSelect');
const tripOneWay     = document.getElementById('tripOneWay');
const tripRound      = document.getElementById('tripRound');
const searchBtn      = document.getElementById('searchBtn');

const outboundList   = document.getElementById('outboundList');
const returnList     = document.getElementById('returnList');

// Payment modal bits
const paymentBtn     = document.getElementById('paymentSelectBtn');
const paymentLabel   = document.getElementById('paymentSelectBtnLabel');
const overlay        = document.getElementById('paymentOverlay');
const modal          = document.getElementById('paymentModal');

const tabButtons = Array.from(document.querySelectorAll('.pm-tab'));
const panels = {
  creditCard:   document.getElementById('pm-list-credit'),
  debitCard:    document.getElementById('pm-list-debit'),
  wallet:       document.getElementById('pm-list-wallet'),
  upi:          document.getElementById('pm-list-upi'),
  netBanking:   document.getElementById('pm-list-netbanking'),
  emi:          document.getElementById('pm-list-emi')
};
const clearBtn = document.getElementById('pmClearBtn');
const doneBtn  = document.getElementById('pmDoneBtn');

// ------- state -------
let paymentOptions = null;     // backend /payment-options result
let selectedPayments = [];     // [{bank, type}, ...]

// ------- helpers -------
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }
function setEmpty(el, text='No flights'){
  el.innerHTML = `<div class="empty">${text}</div>`;
}

function fmtRu(x){ return `₹${(+x).toLocaleString('en-IN')}`; }

function activeTripType(){
  return tripRound.checked ? 'round-trip' : 'one-way';
}

function pickedPaymentsLabel(){
  if (!selectedPayments.length) return 'Select Payment Methods';
  if (selectedPayments.length === 1) {
    return `${selectedPayments[0].bank} (${selectedPayments[0].type})`;
  }
  return `${selectedPayments.length} selected`;
}

// Normalize backend keys -> panel keys
function normalizeKey(k){
  switch (k) {
    case 'CreditCard': return 'creditCard';
    case 'DebitCard' : return 'debitCard';
    case 'Wallet'    : return 'wallet';
    case 'UPI'       : return 'upi';
    case 'NetBanking': return 'netBanking';
    case 'EMI'       : return 'emi';
    default: return k;
  }
}

function humanizePanelKey(k){
  return ({
    creditCard:'Credit Cards',
    debitCard:'Debit Cards',
    wallet:'Wallets',
    upi:'UPI',
    netBanking:'NetBanking',
    emi:'EMI'
  })[k] || k;
}

// ------- payment modal -------
paymentBtn.addEventListener('click', async () => {
  try {
    show(overlay); show(modal);

    // fetch once per page-load
    if (!paymentOptions) {
      const r = await fetch(`${BACKEND}/payment-options`, { credentials: 'omit' });
      const data = await r.json();
      paymentOptions = data?.options || {};
      console.log('Loaded payment-options', paymentOptions); // <-- LOOK HERE
      buildPaymentLists(paymentOptions);
    }
    updatePaymentPanelVisibility('creditCard');
  } catch (e) {
    console.error('Error loading payment-options', e);
    Object.values(panels).forEach(p => setEmpty(p, 'Failed to load options'));
  }
});

overlay.addEventListener('click', () => { hide(overlay); hide(modal); });

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('pm-tab-active'));
    btn.classList.add('pm-tab-active');
    updatePaymentPanelVisibility(btn.dataset.pmTab);
  });
});

clearBtn.addEventListener('click', () => {
  selectedPayments = [];
  paymentLabel.textContent = pickedPaymentsLabel();
  // uncheck all
  modal.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; });
});

doneBtn.addEventListener('click', () => {
  paymentLabel.textContent = pickedPaymentsLabel();
  hide(overlay); hide(modal);
});

function updatePaymentPanelVisibility(activeKey){
  Object.entries(panels).forEach(([key, ul]) => {
    if (key === activeKey) ul.classList.remove('hidden'); else ul.classList.add('hidden');
  });
  // If empty, show placeholder
  const list = panels[activeKey];
  if (!list.children.length) {
    setEmpty(list, 'No options available.');
  }
}

function buildPaymentLists(opts){
  // opts: { CreditCard:[banks...], DebitCard:[...], ... }
  Object.entries(opts).forEach(([rawKey, arr]) => {
    const key = normalizeKey(rawKey);
    const list = panels[key];
    if (!list) return;
    list.innerHTML = '';
    if (!Array.isArray(arr) || arr.length === 0) {
      setEmpty(list, 'No options available.');
      return;
    }
    arr.forEach((bank, i) => {
      const id = `cb-${key}-${i}`;
      const li = document.createElement('li');
      li.className = 'pm-item';
      li.innerHTML = `
        <input id="${id}" type="checkbox">
        <label for="${id}">${bank}</label>
      `;
      const cb = li.querySelector('input');
      cb.addEventListener('change', () => {
        const type = humanizePanelKey(key).replace(' ', '').toLowerCase().includes('debit') ? 'debit'
                   : humanizePanelKey(key).toLowerCase().includes('credit') ? 'credit'
                   : humanizePanelKey(key).toLowerCase();
        if (cb.checked) {
          selectedPayments.push({ bank: String(bank), type });
        } else {
          selectedPayments = selectedPayments.filter(p => !(p.bank === bank && p.type === type));
        }
      });
      list.appendChild(li);
    });
  });
}

// ------- search -------
searchBtn.addEventListener('click', async () => {
  const query = {
    from: (fromInput.value || 'BOM').trim().toUpperCase(),
    to:   (toInput.value   || 'DEL').trim().toUpperCase(),
    departureDate: departDate.value,
    returnDate:    returnDate.value,
    passengers:    Number(paxSelect.value) || 1,
    travelClass:   (cabinSelect.value || 'Economy'),
    tripType:      activeTripType(),
    paymentMethods: selectedPayments
  };

  // UX: empty lists
  setEmpty(outboundList, 'Searching…');
  setEmpty(returnList,   query.tripType === 'round-trip' ? 'Searching…' : 'No flights');

  try {
    const r = await fetch(`${BACKEND}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });
    const data = await r.json();
    console.log('search response', data); // <-- WATCH THIS

    renderFlights(outboundList, data.outboundFlights || []);
    if (query.tripType === 'round-trip') {
      renderFlights(returnList, data.returnFlights || []);
    } else {
      setEmpty(returnList, 'No flights');
    }
  } catch (e) {
    console.error('search failed', e);
    setEmpty(outboundList, 'Search failed'); setEmpty(returnList, 'Search failed');
  }
});

function portalRows(base){
  const portals = ['MakeMyTrip','Goibibo','EaseMyTrip','Yatra','Cleartrip'];
  return portals.map(p => {
    const final = (Number(base)||0) + 250;
    return { portal:p, basePrice:Number(base)||0, finalPrice:final, source:'carrier+markup' };
  });
}

function renderFlights(targetEl, flights){
  if (!flights || flights.length === 0) {
    setEmpty(targetEl, 'No flights');
    return;
  }
  targetEl.innerHTML = '';
  flights.forEach(f => {
    const card = document.createElement('div');
    card.className = 'flight-card';
    const portals = portalRows(f.price);
    const portalHtml = portals.map(pp =>
      `<div>• ${pp.portal}: ${fmtRu(pp.finalPrice)} <span style="opacity:.75">(₹250 markup)</span></div>`
    ).join('');
    const stops = (f.stops ?? 0);
    card.innerHTML = `
      <div class="fc-title">${f.airlineName} ${f.flightNumber || ''}</div>
      <div class="fc-time">${f.departure} → ${f.arrival} · Stops: ${stops}</div>
      <div class="fc-price">${fmtRu(f.price)}</div>
      <details style="margin-top:6px">
        <summary>Portal prices (+₹250 markup)</summary>
        <div style="margin-top:6px">${portalHtml}</div>
      </details>
    `;
    targetEl.appendChild(card);
  });
}

// ------- sensible defaults -------
(function initDefaults(){
  // default dates: today+2 and +4
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  function dstr(d){
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  const d1 = new Date(today); d1.setDate(d1.getDate()+2);
  const d2 = new Date(today); d2.setDate(d2.getDate()+4);
  if (!departDate.value) departDate.value = dstr(d1);
  if (!returnDate.value) returnDate.value = dstr(d2);
  paymentLabel.textContent = pickedPaymentsLabel();
})();
