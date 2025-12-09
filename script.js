<script>
(() => {
  // ---- CONFIG ----
  const API_BASE = 'https://skydeal-backend.onrender.com';

  // ---- DOM ----
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

    // modal
    pmModal: document.getElementById('paymentsModal'),
    pmClose: document.getElementById('pmClose'),
    pmDone: document.getElementById('pmDone'),
    pmClear: document.getElementById('pmClear'),
    pmTabs: document.querySelectorAll('[data-pm-tab]'),
    pmLists: document.querySelectorAll('[data-pm-list]'),

    // loading + empty
    loadingBar: document.getElementById('loadingBar'),
  };

  // ---- STATE ----
  const state = {
    paymentSelections: {
      'Credit Card': new Set(),
      'Debit Card': new Set(),
      'Net Banking': new Set(),
      'UPI': new Set(),
      'Wallet': new Set(),
      'EMI': new Set(),
    },
    // pagination
    outPage: 1, retPage: 1,
    PAGE_SIZE: 10,
    outFlights: [],
    retFlights: [],
  };

  // ---- Helpers ----
  function showLoading(on) {
    if (!els.loadingBar) return;
    els.loadingBar.style.opacity = on ? '1' : '0';
    els.search.disabled = !!on;
    els.search.textContent = on ? 'Searching…' : 'Search';
  }

  function flattenPaymentMethods() {
    // We send only bank names; the backend already knows types
    const picked = [];
    Object.values(state.paymentSelections).forEach(set => {
      set.forEach(b => picked.push(b));
    });
    return picked;
  }

  function updatePmBadge() {
    const count = flattenPaymentMethods().length;
    els.pmBadge.textContent = count > 0 ? `Selected (${count})` : 'Select Payment Methods';
  }

  function openModal()   { els.pmModal.classList.add('open'); }
  function closeModal()  { els.pmModal.classList.remove('open'); }

  function clearPayments() {
    Object.keys(state.paymentSelections).forEach(k => state.paymentSelections[k].clear());
    // uncheck all inputs
    document.querySelectorAll('[data-pm-list] input[type=checkbox]').forEach(cb => cb.checked = false);
    updatePmBadge();
  }

  // ---- Payment modal wiring (no layout change) ----
  els.pmBtn.addEventListener('click', () => openModal());
  els.pmClose.addEventListener('click', () => closeModal());
  els.pmDone.addEventListener('click', () => { updatePmBadge(); closeModal(); });
  els.pmClear.addEventListener('click', () => clearPayments());
  els.pmTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const k = tab.getAttribute('data-pm-tab');
      document.querySelectorAll('[data-pm-tab]').forEach(t => t.classList.toggle('active', t===tab));
      document.querySelectorAll('[data-pm-list]').forEach(list => {
        list.style.display = (list.getAttribute('data-pm-list') === k) ? 'block' : 'none';
      });
    });
  });
  // checkbox capture
  document.querySelectorAll('[data-pm-list]').forEach(list => {
    list.addEventListener('change', (e) => {
      const type = list.getAttribute('data-pm-list');
      const bank = e.target.getAttribute('data-bank');
      if (!bank) return;
      if (e.target.checked) state.paymentSelections[type].add(bank);
      else state.paymentSelections[type].delete(bank);
    });
  });

  // ---- Renderers (cards kept as you have them) ----
  function emptyMessage(side, msg) {
    const target = side === 'out' ? els.outList : els.retList;
    target.innerHTML = `<div class="empty">${msg}</div>`;
  }

  function renderFlightsSide(side) {
    const listEl = side === 'out' ? els.outList : els.retList;
    const pageEl = side === 'out' ? els.outPage : els.retPage;
    const prevEl = side === 'out' ? els.outPrev : els.retPrev;
    const nextEl = side === 'out' ? els.outNext : els.retNext;

    const flights = side === 'out' ? state.outFlights : state.retFlights;
    const page = side === 'out' ? state.outPage : state.retPage;

    if (!flights || flights.length === 0) {
      listEl.innerHTML = '';
      emptyMessage(side, 'No flights found for your search.');
      pageEl.textContent = 'Page 1 / 1';
      prevEl.disabled = true;
      nextEl.disabled = true;
      return;
    }

    const start = (page - 1) * state.PAGE_SIZE;
    const end = Math.min(start + state.PAGE_SIZE, flights.length);
    const totalPages = Math.max(1, Math.ceil(flights.length / state.PAGE_SIZE));

    listEl.innerHTML = flights.slice(start, end).map((f, idx) => {
      const i = start + idx;
      const best = f.bestDeal ? `Best: ₹${f.bestDeal.finalPrice.toLocaleString('en-IN')} on ${f.bestDeal.portal}` : '';
      const why = f.bestDeal && f.bestDeal.note ? f.bestDeal.note : 'Best price after applicable offers (if any)';
      return `
        <div class="card">
          <div class="title">${f.title || `${f.airlineName || ''} • ${f.carrierCode || ''} ${f.flightNumber || ''}`}</div>
          <div class="meta">${f.subTitle || `${f.stopsText || 'Non-stop'}`}</div>
          <div class="best">${best}</div>
          <div class="why">${why}</div>
          <button class="btn-outline" data-breakdown="${i}" data-side="${side}">Prices & breakdown</button>
        </div>
      `;
    }).join('');

    pageEl.textContent = `Page ${page} / ${totalPages}`;
    prevEl.disabled = page <= 1;
    nextEl.disabled = page >= totalPages;

    // wire breakdown buttons
    listEl.querySelectorAll('[data-breakdown]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-breakdown'));
        const s = btn.getAttribute('data-side');
        const list = s === 'out' ? state.outFlights : state.retFlights;
        const f = list[idx];
        if (!f) return;

        // very simple modal replacement kept from your version
        const rows = (f.portalPrices || []).map(p => `
          <tr><td>${p.portal}</td><td>₹${(p.finalPrice||0).toLocaleString('en-IN')}</td><td>${p.source||''}</td></tr>
        `).join('');
        const why = f.offerReasons ? `<details><summary>Why offers applied / skipped</summary><pre>${JSON.stringify(f.offerReasons, null, 2)}</pre></details>` : '';
        const html = `
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
            ${why}
            <div class="sheet-actions"><button id="closeSheet" class="btn">Close</button></div>
          </div>
        `;
        const wrap = document.createElement('div');
        wrap.className = 'sheet-wrap';
        wrap.innerHTML = html;
        document.body.appendChild(wrap);
        wrap.querySelector('#x-sheet').onclick = () => wrap.remove();
        wrap.querySelector('#closeSheet').onclick = () => wrap.remove();
      });
    });
  }

  function renderBoth() {
    renderFlightsSide('out');
    renderFlightsSide('ret');
  }

  // pagination buttons
  els.outPrev.onclick = () => { if (state.outPage > 1) { state.outPage--; renderFlightsSide('out'); } };
  els.outNext.onclick = () => {
    const total = Math.max(1, Math.ceil(state.outFlights.length / state.PAGE_SIZE));
    if (state.outPage < total) { state.outPage++; renderFlightsSide('out'); }
  };
  els.retPrev.onclick = () => { if (state.retPage > 1) { state.retPage--; renderFlightsSide('ret'); } };
  els.retNext.onclick = () => {
    const total = Math.max(1, Math.ceil(state.retFlights.length / state.PAGE_SIZE));
    if (state.retPage < total) { state.retPage++; renderFlightsSide('ret'); }
  };

  // ---- SEARCH ----
  async function doSearch() {
    const from = (els.from.value || '').trim().toUpperCase();
    const to = (els.to.value || '').trim().toUpperCase();
    const departureDate = els.dep.value;   // yyyy-mm-dd from <input type="date">
    const returnDate = els.tripRound.checked ? els.ret.value : '';
    const passengers = Number(els.pax.value || 1);
    const travelClass = (els.cabin.value || 'economy').toLowerCase();
    const tripType = els.tripRound.checked ? 'round-trip' : 'one-way';
    const paymentMethods = flattenPaymentMethods(); // array of selected

    if (!from || !to || !departureDate) {
      alert('Please fill From, To, and Departure.');
      return;
    }
    showLoading(true);
    state.outPage = 1; state.retPage = 1;

    const payload = { from, to, departureDate, returnDate, tripType, passengers, travelClass, paymentMethods };
    try {
      console.log('[SkyDeal] /search payload →', payload);
      const res = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      console.log('[SkyDeal] /search response meta →', json?.meta);

      // take flights (or [])
      state.outFlights = Array.isArray(json?.outboundFlights) ? json.outboundFlights : [];
      state.retFlights = Array.isArray(json?.returnFlights) ? json.returnFlights : [];

      if (state.outFlights.length === 0 && state.retFlights.length === 0) {
        emptyMessage('out', 'No flights found for your search.');
        emptyMessage('ret', 'No flights found for your search.');
      } else {
        renderBoth();
      }
    } catch (e) {
      console.error('Search failed', e);
      emptyMessage('out', 'Failed to fetch flights.');
      emptyMessage('ret', 'Failed to fetch flights.');
    } finally {
      showLoading(false);
    }
  }

  els.search.addEventListener('click', doSearch);

  // Trip toggle disables/enables return date only; no layout change.
  function refreshTripControls() {
    const round = els.tripRound.checked;
    els.ret.disabled = !round;
  }
  els.tripOne.addEventListener('change', refreshTripControls);
  els.tripRound.addEventListener('change', refreshTripControls);
  refreshTripControls();

  // initial render empty lists
  renderBoth();
})();
</script>
