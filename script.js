<!-- Make sure this is included at the end of <body> or with defer -->
<script>
(() => {
  // ========= CONFIG =========
  const BACKEND = 'https://skydeal-backend.onrender.com';
  const MARKUP_AMOUNT = 250; // already applied by backend, we still label it

  // ========= ELEMENTS =========
  const els = {
    // search form
    from: document.getElementById('from'),
    to: document.getElementById('to'),
    depart: document.getElementById('departureDate'),
    ret: document.getElementById('returnDate'),
    tripType: document.getElementById('tripType'),      // 'one-way' | 'round-trip'
    travelClass: document.getElementById('travelClass'),// 'economy'|'business'...
    passengers: document.getElementById('passengers'),
    searchBtn: document.getElementById('searchBtn'),

    // results
    outboundWrap: document.getElementById('outboundResults'),
    returnWrap: document.getElementById('returnResults'),

    // payment picker
    paymentBtn: document.getElementById('paymentBtn'),  // main button "Select Payment Methods"
    paymentCount: document.getElementById('paymentCount'), // small badge text
    pmModal: document.getElementById('paymentModal'),
    pmClose: document.getElementById('pmClose'),
    typeList: document.getElementById('pmTypeList'),    // left column (types)
    subtypeList: document.getElementById('pmSubtypeList'),// right column (banks under that type)
    clearSel: document.getElementById('pmClear'),
    applySel: document.getElementById('pmApply'),
  };

  // Fail fast if some IDs aren’t present (prevents silent break)
  for (const [k, v] of Object.entries(els)) {
    if (!v) console.warn('Missing element for', k);
  }

  // ========= STATE =========
  let paymentOptions = { CreditCard:[], DebitCard:[], EMI:[], NetBanking:[], Wallet:[], UPI:[] };
  let selectedPayments = []; // array of {bank, type}
  let currentType = null;    // which type tab is active in the modal

  // ========= HELPERS =========
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function normTypeKey(x) {
    const s = (x||'').toLowerCase();
    if (s.includes('credit')) return 'credit';
    if (s.includes('debit')) return 'debit';
    if (s.includes('emi')) return 'emi';
    if (s.includes('net')) return 'netbanking';
    if (s.includes('wallet')) return 'wallet';
    if (s.includes('upi')) return 'upi';
    return null;
  }
  function uiToApiType(ui) {
    // UI headings -> API type
    const m = {
      'Credit Card':'credit',
      'Debit Card':'debit',
      'EMI':'emi',
      'NetBanking':'netbanking',
      'Wallet':'wallet',
      'UPI':'upi'
    };
    return m[ui] || null;
  }
  function apiToUiType(api) {
    const m = {
      credit: 'Credit Card',
      debit: 'Debit Card',
      emi: 'EMI',
      netbanking: 'NetBanking',
      wallet: 'Wallet',
      upi: 'UPI'
    };
    return m[api] || api;
  }

  function setPaymentCount() {
    if (els.paymentCount) {
      els.paymentCount.textContent = selectedPayments.length ? `${selectedPayments.length} selected` : 'None';
    }
    if (els.paymentBtn) {
      els.paymentBtn.textContent = selectedPayments.length ? `Payment Methods • ${selectedPayments.length} selected` : 'Select Payment Methods';
    }
  }

  function openModal() {
    if (!els.pmModal) return;
    els.pmModal.style.display = 'block';
    els.pmModal.removeAttribute('aria-hidden');
  }
  function closeModal() {
    if (!els.pmModal) return;
    els.pmModal.style.display = 'none';
    els.pmModal.setAttribute('aria-hidden','true');
  }

  function renderTypeTabs() {
    if (!els.typeList) return;
    els.typeList.innerHTML = '';
    const types = Object.keys(paymentOptions); // ['CreditCard','DebitCard',...]
    // We want display labels consistent (Credit Card etc.)
    const displayOrder = ['CreditCard','DebitCard','EMI','NetBanking','Wallet','UPI'];
    for (const key of displayOrder) {
      if (!(key in paymentOptions)) continue;
      const count = paymentOptions[key]?.length || 0;
      const btn = document.createElement('button');
      btn.className = `pm-type ${currentType===key ? 'active':''}`;
      btn.textContent = `${key.replace(/Card$/,' Card')} (${count})`;
      btn.dataset.type = key;
      btn.onclick = () => {
        currentType = key;
        renderTypeTabs();
        renderSubtypeList();
      };
      els.typeList.appendChild(btn);
    }
    if (!currentType) {
      currentType = displayOrder.find(t => (paymentOptions[t]||[]).length) || 'CreditCard';
    }
  }

  function isSelected(bank, uiType) {
    const typeApi = uiToApiType(uiType);
    return selectedPayments.some(p => p.bank === bank && p.type === typeApi);
  }

  function toggleSelect(bank, uiType) {
    const typeApi = uiToApiType(uiType);
    const idx = selectedPayments.findIndex(p => p.bank === bank && p.type === typeApi);
    if (idx >= 0) selectedPayments.splice(idx,1);
    else selectedPayments.push({ bank, type: typeApi });
    renderSubtypeList();
    setPaymentCount();
  }

  function renderSubtypeList() {
    if (!els.subtypeList) return;
    els.subtypeList.innerHTML = '';
    const uiType = currentType || 'CreditCard';
    const banks = paymentOptions[uiType] || [];
    if (!banks.length) {
      const p = document.createElement('p');
      p.className = 'pm-empty';
      p.textContent = 'No options available for this type.';
      els.subtypeList.appendChild(p);
      return;
    }
    banks.forEach(bank => {
      const row = document.createElement('label');
      row.className = 'pm-bank';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = isSelected(bank, uiType);
      cb.onchange = () => toggleSelect(bank, uiType);
      const span = document.createElement('span');
      span.textContent = bank;
      row.appendChild(cb);
      row.appendChild(span);
      els.subtypeList.appendChild(row);
    });
  }

  function card(html) {
    const div = document.createElement('div');
    div.className = 'flight-card';
    div.innerHTML = html;
    return div;
  }

  function renderFlights(list, mount) {
    if (!mount) return;
    mount.innerHTML = '';
    if (!Array.isArray(list) || !list.length) {
      mount.textContent = 'No flights found.';
      return;
    }
    list.forEach(f => {
      const portals = (f.portalPrices || []).map(p => {
        const price = p.finalPrice ?? p.basePrice ?? 0;
        return `<li><strong>${p.portal}</strong> — ₹${price} <small>(${p.source || 'carrier+markup'})</small></li>`;
      }).join('');
      const html = `
        <div class="fc-row">
          <div class="fc-main">
            <div class="fc-airline">${f.airlineName || ''} <span class="fc-fn">${f.flightNumber || ''}</span></div>
            <div class="fc-times"><span>${f.departure}</span> → <span>${f.arrival}</span> • Stops: ${f.stops}</div>
          </div>
          <div class="fc-price">₹${f.price}</div>
        </div>
        <details class="fc-portals">
          <summary>Portal prices (+₹${MARKUP_AMOUNT} markup)</summary>
          <ul>${portals}</ul>
        </details>
      `;
      mount.appendChild(card(html));
    });
  }

  async function fetchJSON(url, opts={}) {
    const res = await fetch(url, opts);
    // /payment-options might double-write; keep first JSON chunk
    const text = await res.text();
    // Try to parse the first valid JSON in the string
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const chunk = (firstBrace >= 0 && lastBrace >= 0) ? text.slice(firstBrace, lastBrace+1) : text;
    try { return JSON.parse(chunk); }
    catch { throw new Error('Bad JSON from ' + url + ' :: ' + chunk.slice(0,200)); }
  }

  async function loadPaymentOptions() {
    try {
      const data = await fetchJSON(`${BACKEND}/payment-options`, { method:'GET' });
      // Normalize keys to our UI buckets
      const norm = { CreditCard:[], DebitCard:[], EMI:[], NetBanking:[], Wallet:[], UPI:[] };
      const src = data?.options || {};
      // Keys might be like "CreditCard" or "Credit Card" — map both.
      const mapKey = (k) => {
        const s = (k||'').toLowerCase().replace(/\s+/g,'');
        if (s.includes('credit')) return 'CreditCard';
        if (s.includes('debit')) return 'DebitCard';
        if (s.includes('net')) return 'NetBanking';
        if (s.includes('wallet')) return 'Wallet';
        if (s.includes('upi')) return 'UPI';
        if (s.includes('emi')) return 'EMI';
        return null;
      };
      Object.keys(src).forEach(k => {
        const bucket = mapKey(k);
        if (!bucket) return;
        const arr = Array.isArray(src[k]) ? src[k] : [];
        norm[bucket] = [...new Set(arr)].sort((a,b)=>a.localeCompare(b));
      });
      paymentOptions = norm;
    } catch (e) {
      console.error('loadPaymentOptions failed:', e);
      paymentOptions = { CreditCard:[], DebitCard:[], EMI:[], NetBanking:[], Wallet:[], UPI:[] };
    }
    renderTypeTabs();
    renderSubtypeList();
    setPaymentCount();
  }

  async function doSearch() {
    // Build request payload
    const body = {
      from: (els.from?.value||'').trim().toUpperCase(),
      to: (els.to?.value||'').trim().toUpperCase(),
      departureDate: (els.depart?.value||'').trim(),
      returnDate: (els.tripType?.value === 'round-trip') ? (els.ret?.value||'').trim() : '',
      passengers: Number(els.passengers?.value||1),
      travelClass: (els.travelClass?.value||'economy').trim(),
      tripType: els.tripType?.value || 'one-way',
      paymentMethods: selectedPayments // [{bank:"HDFC Bank", type:"credit"}, ...]
    };
    // basic guard
    if (!body.from || !body.to || !body.departureDate) {
      alert('Please fill From, To and Departure Date.');
      return;
    }

    try {
      els.searchBtn && (els.searchBtn.disabled = true);
      const data = await fetchJSON(`${BACKEND}/search`, {
        method:'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });
      // Could be meta or error
      renderFlights(data?.outboundFlights || [], els.outboundWrap);
      renderFlights(data?.returnFlights || [], els.returnWrap);
    } catch (e) {
      console.error('Search failed:', e);
      if (els.outboundWrap) els.outboundWrap.textContent = 'Search failed. Check console.';
      if (els.returnWrap) els.returnWrap.textContent = '';
    } finally {
      els.searchBtn && (els.searchBtn.disabled = false);
    }
  }

  // ========= WIRE UI =========
  if (els.paymentBtn) {
    els.paymentBtn.addEventListener('click', () => {
      openModal();
    });
  }
  if (els.pmClose) els.pmClose.onclick = closeModal;
  if (els.clearSel) els.clearSel.onclick = () => {
    selectedPayments = [];
    setPaymentCount();
    renderSubtypeList();
  };
  if (els.applySel) els.applySel.onclick = () => {
    setPaymentCount();
    closeModal();
  };

  if (els.searchBtn) els.searchBtn.addEventListener('click', doSearch);

  // Hide return date when one-way is chosen (optional if your HTML already handles)
  if (els.tripType && els.ret) {
    const toggleRet = () => {
      const show = els.tripType.value === 'round-trip';
      els.ret.closest('.field')?.classList.toggle('hidden', !show);
    };
    els.tripType.addEventListener('change', toggleRet);
    toggleRet();
  }

  // ========= INIT =========
  loadPaymentOptions(); // load Mongo-driven payment options into modal
  setPaymentCount();
})();
</script>
