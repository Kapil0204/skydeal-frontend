(() => {
  // ---------------- CONFIG ----------------
  const API_BASE = 'https://skydeal-backend.onrender.com';

  // ---------------- DOM ----------------
  const els = {
    from: document.getElementById('from'),
    to: document.getElementById('to'),
    dep: document.getElementById('departure'),
    ret: document.getElementById('return'),
    pax: document.getElementById('passengers'),
    cabin: document.getElementById('cabin'),
    tripOne: document.getElementById('trip-oneway'),
    tripRound: document.getElementById('trip-round'),

    pmBtn: document.getElementById('openPaymentModal'),
    pmBadge: document.getElementById('paymentSelectedBadge'),

    search: document.getElementById('searchBtn'),

    outList: document.getElementById('outboundList'),
    retList: document.getElementById('returnList'),
    outPrev: document.getElementById('outPrev'),
    outNext: document.getElementById('outNext'),
    outPage: document.getElementById('outPage'),
    retPrev: document.getElementById('retPrev'),
    retNext: document.getElementById('retNext'),
    retPage: document.getElementById('retPage'),

    pmModal: document.getElementById('paymentsModal'),
    pmClose: document.getElementById('pmClose'),
    pmDone: document.getElementById('pmDone'),
    pmClear: document.getElementById('pmClear'),
    pmTabs: document.querySelectorAll('[data-pm-tab]'),
    pmLists: document.querySelectorAll('[data-pm-list]'),

    loadingBar: document.getElementById('loadingBar'),
  };

  // ---------------- STATE ----------------
  const state = {
    paymentSelections: {
      'Credit Card': new Set(),
      'Debit Card': new Set(),
      'Net Banking': new Set(),
      'UPI': new Set(),
      'Wallet': new Set(),
      'EMI': new Set(),
    },
    outFlights: [],
    retFlights: [],
    outPage: 1,
    retPage: 1,
    PAGE_SIZE: 10
  };

  // ---------------- HELPERS ----------------
  function showLoading(on) {
    if (els.loadingBar) els.loadingBar.style.opacity = on ? '1' : '0';
    els.search.disabled = !!on;
    els.search.textContent = on ? 'Searching…' : 'Search';
  }

  function flattenPaymentMethods() {
    const picked = [];
    Object.values(state.paymentSelections).forEach(set => set.forEach(b => picked.push(b)));
    return picked;
  }

  function updatePmBadge() {
    const n = flattenPaymentMethods().length;
    els.pmBadge.textContent = n ? `Selected (${n})` : 'Select Payment Methods';
  }

  function openModal(){ els.pmModal.classList.add('open'); els.pmModal.setAttribute('aria-hidden','false'); }
  function closeModal(){ els.pmModal.classList.remove('open'); els.pmModal.setAttribute('aria-hidden','true'); }

  function clearPayments() {
    Object.keys(state.paymentSelections).forEach(k => state.paymentSelections[k].clear());
    document.querySelectorAll('[data-pm-list] input[type=checkbox]').forEach(cb => cb.checked = false);
    updatePmBadge();
  }

  // ---------------- PAYMENT MODAL WIRES ----------------
  els.pmBtn.addEventListener('click', openModal);
  els.pmClose.addEventListener('click', closeModal);
  els.pmDone.addEventListener('click', () => { updatePmBadge(); closeModal(); });
  els.pmClear.addEventListener('click', clearPayments);

  els.pmTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.getAttribute('data-pm-tab');
      document.querySelectorAll('[data-pm-tab]').forEach(t => t.classList.toggle('active', t===tab));
      els.pmLists.forEach(list => {
        list.style.display = (list.getAttribute('data-pm-list') === key) ? 'block' : 'none';
      });
    });
  });

  // capture (un)checks
  els.pmLists.forEach(list => {
    list.addEventListener('change', (e) => {
      const type = list.getAttribute('data-pm-list');
      const bank = e.target.getAttribute('data-bank');
      if (!bank) return;
      if (e.target.checked) state.paymentSelections[type].add(bank);
      else state.paymentSelections[type].delete(bank);
    });
  });

  // ---------------- RENDER ----------------
  function emptyMessage(el, msg) {
    el.innerHTML = `<div class="empty">${msg}</div>`;
  }

  function renderSide(side) {
    const isOut = side === 'out';
    const list = isOut ? state.outFlights : state.retFlights;
    const listEl = isOut ? els.outList : els.retList;
    const page = isOut ? state.outPage : state.retPage;
    const prev = isOut ? els.outPrev : els.retPrev;
    const next = isOut ? els.outNext : els.retNext;
    const pageEl = isOut ? els.outPage : els.retPage;

    if (!list || list.length === 0) {
      listEl.innerHTML = '';
      emptyMessage(listEl, 'No flights found for your search.');
      pageEl.textContent = 'Page 1 / 1';
      prev.disabled = true; next.disabled = true;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(list.length / state.PAGE_SIZE));
    const start = (page - 1) * state.PAGE_SIZE;
    const end = Math.min(start + state.PAGE_SIZE, list.length);

    listEl.innerHTML = list.slice(start, end).map((f, i) => {
      const best = f.bestDeal ? `Best: ₹${(f.bestDeal.finalPrice||0).toLocaleString('en-IN')} on ${f.bestDeal.portal}` : '';
      const why  = f.bestDeal?.note || 'Best price after applicable offers (if any)';
      return `
        <div class="card">
          <div class="title">${f.title || `${f.airlineName||''} • ${f.carrierCode||''} ${f.flightNumber||''}`}</div>
          <div class="meta">${f.subTitle || f.stopsText || 'Non-stop'}</div>
          <div class="best">${best}</div>
          <div class="why">${why}</div>
          <button class="btn-outline" data-side="${side}" data-idx="${start+i}">Prices & breakdown</button>
        </div>
      `;
    }).join('');

    pageEl.textContent = `Page ${page} / ${totalPages}`;
    prev.disabled = page <= 1;
    next.disabled = page >= totalPages;

    listEl.querySelectorAll('[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        const arr = isOut ? state.outFlights : state.retFlights;
        const f = arr[idx];
        if (!f) return;

        const rows = (f.portalPrices||[]).map(p => `
          <tr><td>${p.portal}</td><td>₹${(p.finalPrice||0).toLocaleString('en-IN')}</td><td>${p.source||''}</td></tr>
        `).join('');
        const whyBlock = f.offerReasons ? `<details><summary>Why offers applied / skipped</summary><pre>${JSON.stringify(f.offerReasons,null,2)}</pre></details>` : '';

        const wrap = document.createElement('div');
        wrap.className = 'sheet-wrap';
        wrap.innerHTML = `
          <div class="sheet">
            <div class="sheet-head">
              <div class="sheet-title">Prices & breakdown</div>
              <button id="x-sheet" class="btn-icon">✕</button>
            </div>
            <div class="sheet-sub">${f.title || ''} • Base ₹${(f.base||0).toLocaleString('en-IN')}</div>
            <table class="tbl">
              <thead><tr><th>Portal</th><th>Final</th><th>Source</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            ${whyBlock}
            <div class="sheet-actions"><button id="closeSheet" class="btn">Close</button></div>
          </div>`;
        document.body.appendChild(wrap);
        wrap.querySelector('#x-sheet').onclick = () => wrap.remove();
        wrap.querySelector('#closeSheet').onclick = () => wrap.remove();
      });
    });
  }

  function renderBoth(){ renderSide('out'); renderSide('ret'); }

  // pagination
  els.outPrev.onclick = () => { if (state.outPage>1){ state.outPage--; renderSide('out'); } };
  els.outNext.onclick = () => {
    const total = Math.max(1, Math.ceil(state.outFlights.length/state.PAGE_SIZE));
    if (state.outPage<total){ state.outPage++; renderSide('out'); }
  };
  els.retPrev.onclick = () => { if (state.retPage>1){ state.retPage--; renderSide('ret'); } };
  els.retNext.onclick = () => {
    const total = Math.max(1, Math.ceil(state.retFlights.length/state.PAGE_SIZE));
    if (state.retPage<total){ state.retPage++; renderSide('ret'); }
  };

  // trip toggle
  function refreshTripControls(){
    const round = els.tripRound.checked;
    els.ret.disabled = !round;
  }
  els.tripOne.addEventListener('change', refreshTripControls);
  els.tripRound.addEventListener('change', refreshTripControls);
  refreshTripControls();

  // ---------------- SEARCH ----------------
  async function doSearch(){
    const payload = {
      from: (els.from.value||'').trim().toUpperCase(),
      to: (els.to.value||'').trim().toUpperCase(),
      departureDate: els.dep.value,
      returnDate: els.tripRound.checked ? els.ret.value : '',
      passengers: Number(els.pax.value||1),
      travelClass: (els.cabin.value||'economy').toLowerCase(),
      tripType: els.tripRound.checked ? 'round-trip' : 'one-way',
      paymentMethods: flattenPaymentMethods()
    };

    if (!payload.from || !payload.to || !payload.departureDate) {
      alert('Please fill From, To, and Departure.');
      return;
    }

    state.outPage = 1; state.retPage = 1;
    showLoading(true);

    try{
      const r = await fetch(`${API_BASE}/search`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await r.json();

      state.outFlights = Array.isArray(data?.outboundFlights) ? data.outboundFlights : [];
      state.retFlights = Array.isArray(data?.returnFlights) ? data.returnFlights : [];

      if (state.outFlights.length===0 && state.retFlights.length===0) {
        emptyMessage(els.outList,'No flights found for your search.');
        emptyMessage(els.retList,'No flights found for your search.');
      } else {
        renderBoth();
      }
    } catch(err){
      console.error('Search failed', err);
      emptyMessage(els.outList,'Failed to fetch flights.');
      emptyMessage(els.retList,'Failed to fetch flights.');
    } finally {
      showLoading(false);
    }
  }

  els.search.addEventListener('click', doSearch);

  // initial paint
  renderBoth();
})();
