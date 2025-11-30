<!-- script.js -->
<script>
(() => {
  // ==== CONFIG ====
  const API_BASE = 'https://skydeal-backend.onrender.com';

  // Tabs -> backend category keys
  const TAB_TO_API = {
    creditCard:  'CreditCard',
    debitCard:   'DebitCard',
    wallet:      'Wallet',
    upi:         'UPI',
    netBanking:  'NetBanking',
    emi:         'EMI',
  };

  // DOM
  const els = {
    from:        document.getElementById('fromInput'),
    to:          document.getElementById('toInput'),
    depart:      document.getElementById('departDate'),
    ret:         document.getElementById('returnDate'),
    pax:         document.getElementById('paxSelect'),
    cabin:       document.getElementById('cabinSelect'),
    oneWay:      document.getElementById('tripOneWay'),
    round:       document.getElementById('tripRound'),
    searchBtn:   document.getElementById('searchBtn'),
    outList:     document.getElementById('outboundList'),
    retList:     document.getElementById('returnList'),
    pmBtn:       document.getElementById('paymentSelectBtn'),
    pmBtnLabel:  document.getElementById('paymentSelectBtnLabel'),
    pmOverlay:   document.getElementById('paymentOverlay'),
    pmModal:     document.getElementById('paymentModal'),
    pmTabs:      document.querySelectorAll('.pm-tab'),
    pmPanels:    {
      creditCard:  document.getElementById('pm-list-credit'),
      debitCard:   document.getElementById('pm-list-debit'),
      wallet:      document.getElementById('pm-list-wallet'),
      upi:         document.getElementById('pm-list-upi'),
      netBanking:  document.getElementById('pm-list-netbanking'),
      emi:         document.getElementById('pm-list-emi'),
    },
    pmClear:     document.getElementById('pmClearBtn'),
    pmDone:      document.getElementById('pmDoneBtn'),
  };

  // State
  const state = {
    options: { CreditCard:[], DebitCard:[], Wallet:[], UPI:[], NetBanking:[], EMI:[] },
    selected: { CreditCard:[], DebitCard:[], Wallet:[], UPI:[], NetBanking:[], EMI:[] },
    activeTab: 'creditCard'
  };

  // ===== Utilities =====
  const noCache = () => ({
    // Bust CDN/browser caches aggressively
    cache: 'no-store',
    headers: { 'Pragma':'no-cache', 'Cache-Control': 'no-cache' }
  });

  const fmtINR = n => '₹' + Number(n).toLocaleString('en-IN');

  const setListEmpty = (ul, txt='No options available.') => {
    ul.innerHTML = `<li class="pm-empty">${txt}</li>`;
  };

  const checkboxRow = (label, checked) => `
    <li class="pm-item">
      <input type="checkbox" ${checked ? 'checked':''} />
      <span>${label}</span>
    </li>
  `;

  // ===== Payment Modal =====
  function openPM() {
    els.pmOverlay.classList.remove('hidden');
    els.pmModal.classList.remove('hidden');
  }
  function closePM() {
    els.pmOverlay.classList.add('hidden');
    els.pmModal.classList.add('hidden');
  }

  function renderPMTab(tabKey) {
    state.activeTab = tabKey;
    els.pmTabs.forEach(t => {
      t.classList.toggle('pm-tab-active', t.dataset.pmTab === tabKey);
    });

    const apiKey = TAB_TO_API[tabKey]; // e.g., 'CreditCard'
    const list = state.options[apiKey] || [];
    const panelEl = els.pmPanels[tabKey];

    if (!list || list.length === 0) {
      setListEmpty(panelEl);
      return;
    }

    // build rows with selection
    const chosen = new Set(state.selected[apiKey] || []);
    panelEl.innerHTML = list.map(name => checkboxRow(name, chosen.has(name))).join('');

    // add handlers
    panelEl.querySelectorAll('input[type="checkbox"]').forEach((cb, idx) => {
      const name = list[idx];
      cb.addEventListener('change', () => {
        const arr = state.selected[apiKey] || [];
        const pos = arr.indexOf(name);
        if (cb.checked && pos === -1) arr.push(name);
        if (!cb.checked && pos !== -1) arr.splice(pos,1);
        state.selected[apiKey] = arr;
        refreshPMButtonLabel();
      });
    });
  }

  function refreshPMButtonLabel() {
    const total =
      state.selected.CreditCard.length +
      state.selected.DebitCard.length +
      state.selected.Wallet.length +
      state.selected.UPI.length +
      state.selected.NetBanking.length +
      state.selected.EMI.length;

    els.pmBtnLabel.textContent = total ? `${total} selected` : 'Select Payment Methods';
  }

  async function loadPaymentOptions() {
    // Always bust cache with a timestamp
    const url = `${API_BASE}/payment-options?t=${Date.now()}`;
    const res = await fetch(url, noCache());
    const json = await res.json();

    // Normalize keys strictly to what backend returns
    const opt = json?.options || {};
    state.options = {
      CreditCard:  Array.isArray(opt.CreditCard)  ? opt.CreditCard  : [],
      DebitCard:   Array.isArray(opt.DebitCard)   ? opt.DebitCard   : [],
      Wallet:      Array.isArray(opt.Wallet)      ? opt.Wallet      : [],
      UPI:         Array.isArray(opt.UPI)         ? opt.UPI         : [],
      NetBanking:  Array.isArray(opt.NetBanking)  ? opt.NetBanking  : [],
      EMI:         Array.isArray(opt.EMI)         ? opt.EMI         : [],
    };

    // Render the active tab
    Object.values(els.pmPanels).forEach(ul => setListEmpty(ul)); // default
    renderPMTab(state.activeTab);
  }

  // Tab click
  els.pmTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.pmTab;
      // hide others
      Object.entries(els.pmPanels).forEach(([k,ul]) => {
        ul.classList.toggle('hidden', k !== tab);
      });
      renderPMTab(tab);
    });
  });

  els.pmBtn.addEventListener('click', async () => {
    openPM();
    await loadPaymentOptions();
  });
  els.pmOverlay.addEventListener('click', closePM);
  els.pmDone.addEventListener('click', closePM);
  els.pmClear.addEventListener('click', () => {
    Object.keys(state.selected).forEach(k => state.selected[k] = []);
    refreshPMButtonLabel();
    renderPMTab(state.activeTab);
  });

  // ===== Search =====
  function getTripType() {
    return els.oneWay.checked ? 'one-way' : 'round-trip';
  }

  function collectPaymentSelections() {
    // Flatten selection into {bank,type}
    const map = {
      CreditCard:  'credit',
      DebitCard:   'debit',
      Wallet:      'wallet',
      UPI:         'upi',
      NetBanking:  'netbanking',
      EMI:         'emi',
    };
    const out = [];
    for (const [cat, arr] of Object.entries(state.selected)) {
      const type = map[cat];
      arr.forEach(bank => out.push({ bank, type }));
    }
    return out;
  }

  function renderFlights(listEl, flights) {
    if (!flights || !flights.length) {
      listEl.classList.add('empty');
      listEl.textContent = 'No flights';
      return;
    }
    listEl.classList.remove('empty');
    listEl.innerHTML = flights.map(f => {
      const portals = (f.portalPrices || []).map(p =>
        `<div>• ${p.portal}: ${fmtINR(p.finalPrice)} <small>(${p.source})</small></div>`
      ).join('');
      return `
        <div class="flight-card">
          <div class="fc-title">${f.airlineName} ${f.flightNumber}</div>
          <div class="fc-time">${f.departure} → ${f.arrival} • Stops: ${f.stops ?? 0}</div>
          <div class="fc-price">${fmtINR(f.price)}</div>
          <details style="margin-top:6px"><summary>Portal prices (+₹250 markup)</summary>${portals||'<div>—</div>'}</details>
        </div>
      `;
    }).join('');
  }

  async function runSearch() {
    const body = {
      from: (els.from.value || 'BOM').toUpperCase().trim(),
      to:   (els.to.value   || 'DEL').toUpperCase().trim(),
      departureDate: els.depart.value,
      returnDate:    els.ret.value,
      passengers:    Number(els.pax.value || 1),
      travelClass:   (els.cabin.value || 'Economy').toLowerCase(), // << normalize
      tripType:      getTripType(),
      paymentMethods: collectPaymentSelections()
    };

    // if one-way, blank out returnDate
    if (body.tripType === 'one-way') body.returnDate = '';

    els.searchBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/search?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...noCache().headers },
        cache: 'no-store',
        body: JSON.stringify(body)
      });

      const data = await res.json();
      // data: { outboundFlights, returnFlights, meta? }
      renderFlights(els.outList, data.outboundFlights || []);
      renderFlights(els.retList, data.returnFlights || []);
    } catch (e) {
      // On error: show empty and a tiny hint in console
      console.error('search failed:', e);
      renderFlights(els.outList, []);
      renderFlights(els.retList, []);
    } finally {
      els.searchBtn.disabled = false;
    }
  }

  els.searchBtn.addEventListener('click', runSearch);

  // ===== Initial defaults =====
  // Today + 2 and +4 dates just as sensible defaults
  const pad = n => String(n).padStart(2,'0');
  const d = new Date();
  const d1 = new Date(d.getFullYear(), d.getMonth(), d.getDate()+2);
  const d2 = new Date(d.getFullYear(), d.getMonth(), d.getDate()+4);
  const toISO = x => `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`;
  els.depart.value = els.depart.value || toISO(d1);
  els.ret.value    = els.ret.value    || toISO(d2);
})();
</script>
