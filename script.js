// script.js — SkyDeal frontend (stable modal + working search)

const API_BASE = "https://skydeal-backend.onrender.com";

// ------- Elements -------
const fromInput = document.querySelector('#from');        // id="from" input (BOM)
const toInput = document.querySelector('#to');            // id="to" input (DEL)
const depInput = document.querySelector('#departure');    // id="departure" (dd/mm/yyyy)
const retInput = document.querySelector/* ===== SkyDeal Frontend – Payment Methods + Search Wiring =====
   This file:
   - Renders the Payment Methods selector with tabs + sub-options
   - Keeps button label in sync: "Select Payment Methods" -> "X selected"
   - Fetches payment methods from backend; if empty, falls back to sensible defaults
   - Wires the Search button (no UX change; will show error in the list if backend fails)
*/

(() => {
  // ---------- CONFIG ----------
  const API_BASE = 'https://skydeal-backend.onrender.com';

  // ---------- DOM HOOKS ----------
  const btnPaymentOpen = document.getElementById('paymentSelectBtn');
  const paymentBadge = document.getElementById('paymentSelectBtnLabel');
  const modal = document.getElementById('paymentModal');
  const overlay = document.getElementById('paymentOverlay');
  const btnDone = document.getElementById('pmDoneBtn');
  const btnClear = document.getElementById('pmClearBtn');

  const tabButtons = document.querySelectorAll('[data-pm-tab]');
  const tabPanels = document.querySelectorAll('[data-pm-panel]');

  // Lists for each tab
  const lists = {
    creditCard: document.getElementById('pm-list-credit'),
    debitCard: document.getElementById('pm-list-debit'),
    wallet: document.getElementById('pm-list-wallet'),
    upi: document.getElementById('pm-list-upi'),
    netBanking: document.getElementById('pm-list-netbanking'),
    emi: document.getElementById('pm-list-emi')
  };

  // Search form hooks (kept minimal; IDs should exist in your HTML)
  const btnSearch = document.getElementById('searchBtn');
  const fromInput = document.getElementById('fromInput');
  const toInput = document.getElementById('toInput');
  const departInput = document.getElementById('departDate');
  const returnInput = document.getElementById('returnDate');
  const paxInput = document.getElementById('paxSelect');
  const cabinInput = document.getElementById('cabinSelect');
  const tripTypeOneWay = document.getElementById('tripOneWay');   // radio
  const tripTypeRound = document.getElementById('tripRound');     // radio
  const outboundList = document.getElementById('outboundList');
  const returnList = document.getElementById('returnList');

  // ---------- STATE ----------
  // Selected sub-options, e.g., "creditCard::ICICI Bank Credit Card"
  const selected = new Set();

  // Cached payment methods from backend/fallback
  let paymentData = {
    creditCard: [],
    debitCard: [],
    wallet: [],
    upi: [],
    netBanking: [],
    emi: []
  };

  // ---------- UTIL ----------
  function setButtonLabel() {
    const count = selected.size;
    paymentBadge.textContent = count > 0 ? `${count} selected` : 'Select Payment Methods';
  }

  function openModal() {
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
  }

  function clearSelections() {
    selected.clear();
    // Uncheck all checkboxes
    modal.querySelectorAll('input[type="checkbox"]').forEach(cb => (cb.checked = false));
    setButtonLabel();
  }

  function activateTab(key) {
    // Toggle active tab button
    tabButtons.forEach(btn => {
      const isActive = btn.getAttribute('data-pm-tab') === key;
      btn.classList.toggle('pm-tab-active', isActive);
    });
    // Toggle panel visibility
    tabPanels.forEach(panel => {
      const match = panel.getAttribute('data-pm-panel') === key;
      panel.classList.toggle('hidden', !match);
    });
  }

  function renderList(listEl, typeKey, items) {
    listEl.innerHTML = '';
    if (!items || !items.length) {
      const li = document.createElement('li');
      li.className = 'pm-empty';
      li.textContent = 'No options';
      listEl.appendChild(li);
      return;
    }

    items.forEach(label => {
      const value = `${typeKey}::${label}`;
      const li = document.createElement('li');
      li.className = 'pm-item';

      const id = `pm-${typeKey}-${label.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '')}`;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.value = value;
      cb.checked = selected.has(value);
      cb.addEventListener('change', (e) => {
        if (e.target.checked) selected.add(value);
        else selected.delete(value);
        setButtonLabel();
      });

      const lab = document.createElement('label');
      lab.setAttribute('for', id);
      lab.textContent = label;

      li.appendChild(cb);
      li.appendChild(lab);
      listEl.appendChild(li);
    });
  }

  function renderAllTabs() {
    renderList(lists.creditCard, 'creditCard', paymentData.creditCard);
    renderList(lists.debitCard, 'debitCard', paymentData.debitCard);
    renderList(lists.wallet, 'wallet', paymentData.wallet);
    renderList(lists.upi, 'upi', paymentData.upi);
    renderList(lists.netBanking, 'netBanking', paymentData.netBanking);
    renderList(lists.emi, 'emi', paymentData.emi);
  }

  async function loadPaymentMethods() {
    try {
      const res = await fetch(`${API_BASE}/api/payment-methods`, { cache: 'no-store' });
      const json = await res.json();

      // Normalize + fallback if empty
      const isEmpty =
        !json ||
        ['creditCard','debitCard','wallet','upi','netBanking','emi']
          .every(k => !json[k] || json[k].length === 0);

      if (isEmpty) {
        // Sensible fallback so UI always works
        paymentData = {
          creditCard: ['ICICI Bank Credit Card','HDFC Bank Credit Card','Axis Bank Credit Card','SBI Credit Card'],
          debitCard:  ['ICICI Bank Debit Card','HDFC Bank Debit Card','Axis Bank Debit Card','SBI Debit Card'],
          wallet:     ['Paytm Wallet','PhonePe Wallet','Amazon Pay Wallet'],
          upi:        ['UPI'],
          netBanking: ['ICICI NetBanking','HDFC NetBanking','Axis NetBanking','SBI NetBanking'],
          emi:        ['HDFC EMI','ICICI EMI','Axis EMI','SBI EMI']
        };
      } else {
        // Use backend (already in correct shape)
        paymentData = {
          creditCard: json.creditCard || [],
          debitCard: json.debitCard || [],
          wallet: json.wallet || [],
          upi: json.upi || [],
          netBanking: json.netBanking || [],
          emi: json.emi || []
        };
      }

      renderAllTabs();
      activateTab('creditCard'); // default tab
      setButtonLabel();
    } catch (e) {
      // Total failure -> hard fallback
      paymentData = {
        creditCard: ['ICICI Bank Credit Card','HDFC Bank Credit Card','Axis Bank Credit Card','SBI Credit Card'],
        debitCard:  ['ICICI Bank Debit Card','HDFC Bank Debit Card','Axis Bank Debit Card','SBI Debit Card'],
        wallet:     ['Paytm Wallet','PhonePe Wallet','Amazon Pay Wallet'],
        upi:        ['UPI'],
        netBanking: ['ICICI NetBanking','HDFC NetBanking','Axis NetBanking','SBI NetBanking'],
        emi:        ['HDFC EMI','ICICI EMI','Axis EMI','SBI EMI']
      };
      renderAllTabs();
      activateTab('creditCard');
      setButtonLabel();
    }
  }

  // ---------- SEARCH ----------
  function setListError(targetEl, msg) {
    targetEl.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = msg;
    targetEl.appendChild(p);
  }

  async function onSearchClick(e) {
    e.preventDefault();

    // Defensive checks so the button always "does something"
    const from = (fromInput && fromInput.value || '').trim().toUpperCase();
    const to = (toInput && toInput.value || '').trim().toUpperCase();
    const depart = (departInput && departInput.value || '').trim();
    const ret = (returnInput && returnInput.value || '').trim();
    const pax = (paxInput && paxInput.value) ? String(paxInput.value) : '1';
    const cabin = (cabinInput && cabinInput.value) ? cabinInput.value : 'Economy';
    const tripType = (tripTypeOneWay && tripTypeOneWay.checked) ? 'one-way' : 'round-trip';

    // Minimal UX feedback
    setListError(outboundList, 'Searching…');
    setListError(returnList, tripType === 'round-trip' ? 'Searching…' : '');

    try {
      const payload = {
        from, to,
        departureDate: depart,
        returnDate: tripType === 'round-trip' ? ret : '',
        passengers: Number(pax) || 1,
        travelClass: cabin,
        tripType,
        // pass selected payment methods if needed later
        paymentMethods: Array.from(selected)
      };

      const res = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        setListError(outboundList, 'Error fetching flights');
        setListError(returnList, tripType === 'round-trip' ? 'Error fetching flights' : '');
        return;
      }

      const data = await res.json();

      // Expecting { outbound: Flight[], inbound: Flight[] } – render very simply
      function renderFlights(target, flights) {
        target.innerHTML = '';
        if (!flights || !flights.length) {
          setListError(target, 'No flights');
          return;
        }
        flights.forEach(f => {
          const card = document.createElement('div');
          card.className = 'flight-card';
          card.innerHTML = `
            <div class="fc-title">${f.airline || f.flightName || 'Flight'}</div>
            <div class="fc-time">${f.departure || '--:--'} → ${f.arrival || '--:--'}</div>
            <div class="fc-price">${f.price ? `₹${f.price}` : ''}</div>
          `;
          target.appendChild(card);
        });
      }

      renderFlights(outboundList, data.outbound || []);
      if (tripType === 'round-trip') renderFlights(returnList, data.inbound || []);
      else returnList.innerHTML = '';
    } catch (err) {
      setListError(outboundList, 'Error fetching flights');
      setListError(returnList, tripType === 'round-trip' ? 'Error fetching flights' : '');
    }
  }

  // ---------- WIRING ----------
  function wire() {
    // Button label starts clean
    setButtonLabel();

    // Open/close
    btnPaymentOpen.addEventListener('click', openModal);
    overlay.addEventListener('click', closeModal);
    btnDone.addEventListener('click', () => { closeModal(); setButtonLabel(); });
    btnClear.addEventListener('click', clearSelections);

    // Tabs
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-pm-tab');
        activateTab(key);
      });
    });

    // Search
    if (btnSearch) btnSearch.addEventListener('click', onSearchClick);
  }

  // ---------- INIT ----------
  function init() {
    wire();
    loadPaymentMethods();
  }

  // Start
  document.addEventListener('DOMContentLoaded', init);
})();
'#return');       // id="return"     (dd/mm/yyyy)
const paxSelect = document.querySelector('#passengers');  // id="passengers"
const cabinSelect = document.querySelector('#cabin');     // id="cabin"  (Economy/Business/First/Premium_Economy)
const oneWayRadio = document.querySelector('#oneWay');    // id="oneWay"
const roundTripRadio = document.querySelector('#roundTrip');// id="roundTrip"

const searchBtn = document.querySelector('#searchBtn');   // id="searchBtn"

// Results
const outList = document.querySelector('#outboundList');  // id="outboundList"
const retList = document.querySelector('#returnList');    // id="returnList"

// Payment picker trigger (top-right)
const payBtn = document.querySelector('#paymentTrigger'); // id="paymentTrigger" (the chip/button at top-right showing "Select" or "N selected")

// Modal
const modal = document.querySelector('#paymentModal');    // id="paymentModal"
const modalTabs = document.querySelectorAll('.pm-tab');   // e.g., buttons with data-tab="creditCard" etc.
const modalBody = document.querySelector('#pmOptions');   // container where we render checkboxes
const modalDone = document.querySelector('#pmDone');      // Done button
const modalClear = document.querySelector('#pmClear');    // Clear button
const modalCloseArea = document.querySelector('#pmBackdrop'); // backdrop or close zone

// ------- State -------
const paymentState = {
  categories: { creditCard:[], debitCard:[], wallet:[], upi:[], netBanking:[], emi:[] },
  selected: new Set(),
  activeTab: 'creditCard'
};

// ------- Utils -------
function yyyymmddFromDDMMYYYY(ddmmyyyy) {
  // "03/12/2025" => "2025-12-03"
  const [dd, mm, yyyy] = (ddmmyyyy || "").split('/');
  if (!yyyy || !mm || !dd) return "";
  return `${yyyy}-${mm}-${dd}`;
}

function showMessage(container, text) {
  container.innerHTML = `<div class="msg">${text}</div>`;
}

function renderFlights(container, flights) {
  if (!flights || flights.length === 0) {
    showMessage(container, "No flights");
    return;
  }
  container.innerHTML = flights.map(f => `
    <div class="flight-card">
      <div class="airline">${f.airline || ""} ${f.flightNumber || ""}</div>
      <div class="times">${f.departure || ""} → ${f.arrival || ""}</div>
      <div class="meta">Stops: ${f.stops ?? 0}</div>
      <div class="price">₹${f.price ?? "-"}</div>
    </div>
  `).join("");
}

function updatePayBtnLabel() {
  const count = paymentState.selected.size;
  payBtn.textContent = count > 0 ? `${count} selected` : "Select";
}

// ------- Payment Modal -------
async function loadPaymentMethods() {
  try {
    const r = await fetch(`${API_BASE}/api/payment-methods`);
    const data = await r.json();
    paymentState.categories = data || paymentState.categories;
  } catch (e) {
    // hard fallback if even that failed
    paymentState.categories = {
      creditCard:[
        {key:"ICICI Bank Credit Card",label:"ICICI Bank Credit Card"},
        {key:"HDFC Bank Credit Card",label:"HDFC Bank Credit Card"},
        {key:"Axis Bank Credit Card",label:"Axis Bank Credit Card"},
        {key:"SBI Credit Card",label:"SBI Credit Card"}
      ],
      debitCard:[
        {key:"ICICI Bank Debit Card",label:"ICICI Bank Debit Card"},
        {key:"HDFC Bank Debit Card",label:"HDFC Bank Debit Card"},
        {key:"Axis Bank Debit Card",label:"Axis Bank Debit Card"}
      ],
      wallet:[
        {key:"Paytm Wallet",label:"Paytm Wallet"},
        {key:"PhonePe Wallet",label:"PhonePe Wallet"},
        {key:"Amazon Pay Wallet",label:"Amazon Pay Wallet"}
      ],
      upi:[{key:"UPI",label:"UPI"}],
      netBanking:[
        {key:"ICICI NetBanking",label:"ICICI NetBanking"},
        {key:"HDFC NetBanking",label:"HDFC NetBanking"},
        {key:"Axis NetBanking",label:"Axis NetBanking"}
      ],
      emi:[
        {key:"HDFC EMI",label:"HDFC EMI"},
        {key:"ICICI EMI",label:"ICICI EMI"}
      ]
    };
  }
}

function renderActiveTab() {
  const list = paymentState.categories[paymentState.activeTab] || [];
  if (!list.length) {
    modalBody.innerHTML = `<div class="empty">No options</div>`;
    return;
  }
  modalBody.innerHTML = list.map(opt => `
    <label class="pm-opt">
      <input type="checkbox" value="${opt.key.replace(/"/g,'&quot;')}" ${paymentState.selected.has(opt.key) ? 'checked':''}/>
      <span>${opt.label || opt.key}</span>
    </label>
  `).join("");
}

function openModal() {
  modal.classList.remove('hidden');
  renderActiveTab();
}
function closeModal() {
  modal.classList.add('hidden');
}

modalTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    modalTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    paymentState.activeTab = tab.dataset.tab;
    renderActiveTab();
  });
});

modalBody.addEventListener('change', (e) => {
  if (e.target && e.target.type === 'checkbox') {
    const key = e.target.value;
    if (e.target.checked) paymentState.selected.add(key);
    else paymentState.selected.delete(key);
  }
});

modalDone.addEventListener('click', () => {
  updatePayBtnLabel();
  closeModal();
});

modalClear.addEventListener('click', () => {
  paymentState.selected.clear();
  renderActiveTab();
  updatePayBtnLabel();
});

modalCloseArea?.addEventListener('click', (e) => {
  if (e.target === modalCloseArea) closeModal();
});

// ------- Search -------
async function doSearch() {
  // disable button to avoid double clicks
  searchBtn.disabled = true;
  showMessage(outList, "Searching…");
  showMessage(retList, "Searching…");

  try {
    const payload = {
      from: (fromInput.value || "BOM").toUpperCase(),
      to: (toInput.value || "DEL").toUpperCase(),
      departureDate: yyyymmddFromDDMMYYYY(depInput.value),
      returnDate: roundTripRadio.checked ? yyyymmddFromDDMMYYYY(retInput.value) : "",
      passengers: Number(paxSelect.value || "1"),
      travelClass: cabinSelect.value || "Economy",
      tripType: oneWayRadio.checked ? "one-way" : "round-trip",
      paymentMethods: Array.from(paymentState.selected)
    };

    const r = await fetch(`${API_BASE}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json();

    // Support both our mock structure and provider structure
    const outbound = data?.outbound || data?.outboundFlights || data?.flights || [];
    const inbound  = data?.return  || data?.returnFlights  || data?.returning || [];

    renderFlights(outList, outbound);
    renderFlights(retList, inbound);
  } catch (e) {
    showMessage(outList, "Error fetching flights");
    showMessage(retList, "Error fetching flights");
  } finally {
    searchBtn.disabled = false;
  }
}

// ------- Wire up -------
async function init() {
  // starting label
  updatePayBtnLabel();

  // load payment categories/options once
  await loadPaymentMethods();

  // open modal on click
  payBtn.addEventListener('click', openModal);

  // search
  searchBtn.addEventListener('click', doSearch);

  // one-way toggle hides/shows return field
  oneWayRadio.addEventListener('change', () => {
    if (oneWayRadio.checked) {
      retInput.parentElement.classList.add('hidden');
    }
  });
  roundTripRadio.addEventListener('change', () => {
    if (roundTripRadio.checked) {
      retInput.parentElement.classList.remove('hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
