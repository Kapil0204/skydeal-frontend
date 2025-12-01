/* SkyDeal Frontend – externalized to avoid inline <script> parsing issues */

(function () {
  var API = document.body.getAttribute('data-api') || location.origin;
  var CARRIER_MARKUP = 250;

  // Elements
  var els = {
    from: document.getElementById('fromInput'),
    to: document.getElementById('toInput'),
    dep: document.getElementById('departDate'),
    ret: document.getElementById('returnDate'),
    pax: document.getElementById('paxSelect'),
    cabin: document.getElementById('cabinSelect'),
    one: document.getElementById('tripOneWay'),
    rtrip: document.getElementById('tripRound'),
    search: document.getElementById('searchBtn'),
    outbound: document.getElementById('outboundList'),
    retlist: document.getElementById('returnList'),
    payBtn: document.getElementById('paymentSelectBtn'),
    payLabel: document.getElementById('paymentSelectBtnLabel'),
    overlay: document.getElementById('paymentOverlay'),
    modal: document.getElementById('paymentModal'),
    tabs: Array.prototype.slice.call(document.querySelectorAll('.pm-tab')),
    panels: Array.prototype.slice.call(document.querySelectorAll('.pm-panel')),
    pmClear: document.getElementById('pmClearBtn'),
    pmDone: document.getElementById('pmDoneBtn'),
    pmCredit: document.getElementById('pm-list-credit'),
    pmDebit: document.getElementById('pm-list-debit'),
    pmWallet: document.getElementById('pm-list-wallet'),
    pmUPI: document.getElementById('pm-list-upi'),
    pmNet: document.getElementById('pm-list-net'),
    pmEMI: document.getElementById('pm-list-emi'),
    diagBtn: document.getElementById('diagBtn'),
    diagOut: document.getElementById('diagOut')
  };

  // State
  var paymentOptions = null;
  var selectedPayments = [];

  // Utils
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }

  function fmtINR(n) {
    try { return new Intl.NumberFormat('en-IN').format(Number(n || 0)); }
    catch (e) { return String(n); }
  }

  function openModal() {
    els.overlay.classList.remove('hidden');
    els.modal.classList.remove('hidden');
  }
  function closeModal() {
    els.overlay.classList.add('hidden');
    els.modal.classList.add('hidden');
  }

  function showTab(key) {
    els.tabs.forEach(function (b) {
      b.classList.toggle('pm-tab-active', b.getAttribute('data-pm-tab') === key);
    });
    els.panels.forEach(function (p) {
      p.classList.toggle('hidden', p.getAttribute('data-pm-panel') !== key);
    });
  }

  function setBtnCount() {
    els.payLabel.textContent = selectedPayments.length ? (selectedPayments.length + ' selected') : 'Select Payment Methods';
  }

  function renderList(ul, arr, typeKey) {
    ul.innerHTML = '';
    if (!arr || !arr.length) {
      var li = document.createElement('li');
      li.className = 'pm-empty';
      li.textContent = 'No options available.';
      ul.appendChild(li);
      return;
    }
    arr.forEach(function (v) {
      var li = document.createElement('li');
      li.className = 'pm-item';
      var id = (typeKey + '-' + v).replace(/\s+/g, '_');
      li.innerHTML = '<input type="checkbox" id="' + id + '"><label for="' + id + '">' + v + '</label>';
      var cb = li.querySelector('input');
      cb.checked = selectedPayments.some(function (p) { return p.type === typeKey && p.value === v; });
      cb.addEventListener('change', function () {
        if (cb.checked) selectedPayments.push({ type: typeKey, value: v });
        else selectedPayments = selectedPayments.filter(function (p) { return !(p.type === typeKey && p.value === v); });
        setBtnCount();
      });
      ul.appendChild(li);
    });
  }

  function renderPaymentLists() {
    if (!paymentOptions) return;
    renderList(els.pmCredit, paymentOptions.CreditCard, 'CreditCard');
    renderList(els.pmDebit, paymentOptions.DebitCard, 'DebitCard');
    renderList(els.pmWallet, paymentOptions.Wallet, 'Wallet');
    renderList(els.pmUPI, paymentOptions.UPI, 'UPI');
    renderList(els.pmNet, paymentOptions.NetBanking, 'NetBanking');
    renderList(els.pmEMI, paymentOptions.EMI, 'EMI');
  }

  function fetchJSON(url, opts) {
    if (!opts) opts = {};
    return fetch(url, Object.assign({ cache: 'no-store' }, opts))
      .then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (ct.indexOf('application/json') === -1) {
          return r.text().then(function (txt) {
            throw new Error('Non-JSON response (' + r.status + '): ' + txt.slice(0, 200));
          });
        }
        return r.json();
      });
  }

  function loadPaymentOptions() {
    return fetchJSON(API + '/payment-options').then(function (j) {
      if (j && j.options) paymentOptions = j.options;
      if (!paymentOptions || Object.keys(paymentOptions).length === 0 ||
          Object.values(paymentOptions).every(function (a) { return !a || a.length === 0; })) {
        paymentOptions = {
          CreditCard: ['Hdfc Bank','Icici Bank','Axis Bank','Kotak'],
          DebitCard:  ['Hdfc Bank','Icici Bank'],
          Wallet:     ['Amazon Pay','Paytm'],
          UPI:        ['PhonePe','Google Pay','Mobikwik'],
          NetBanking: ['Icici Bank','Hdfc Bank'],
          EMI:        ['Hdfc Bank EMI']
        };
      }
      renderPaymentLists();
    }).catch(function () {
      paymentOptions = {
        UPI: ['Mobikwik'],
        CreditCard: [], DebitCard: [], Wallet: [], NetBanking: [], EMI: []
      };
      renderPaymentLists();
      toast('Could not load payment methods');
    });
  }

  function buildPayload() {
    var tripType = els.one.checked ? 'one-way' : 'round-trip';
    return {
      from: (els.from.value || 'BOM').toUpperCase(),
      to: (els.to.value || 'DEL').toUpperCase(),
      departureDate: els.dep.value,
      returnDate: tripType === 'round-trip' ? els.ret.value : '',
      passengers: Number(els.pax.value || 1),
      travelClass: (els.cabin.value || 'Economy').toLowerCase(),
      tripType: tripType,
      paymentMethods: selectedPayments.map(function (p) { return { bank: p.value, type: p.type }; })
    };
  }

  function renderFlights(where, list) {
    if (!list || !list.length) { where.className = 'empty'; where.textContent = 'No flights'; return; }
    where.className = ''; where.innerHTML = '';
    list.forEach(function (f) {
      var portals = (f.portalPrices || []).map(function (p) { return p.portal + ': ₹' + fmtINR(p.finalPrice); }).join(' • ');
      var card = document.createElement('div');
      card.className = 'flight-card';
      card.innerHTML =
        '<div class="fc-title">' + (f.airlineName || '') + ' ' + (f.flightNumber || '') + '</div>' +
        '<div class="fc-time">' + (f.departure || '') + ' → ' + (f.arrival || '') + ' • Stops: ' + (f.stops || 0) + '</div>' +
        '<div class="fc-price">₹' + fmtINR(Number(f.price || 0)) + '</div>' +
        '<div style="margin-top:6px;opacity:.9">▶ Portal prices (+₹' + CARRIER_MARKUP + ' markup): ' + (portals || '—') + '</div>';
      where.appendChild(card);
    });
  }

  function doSearch() {
    var payload = buildPayload();
    fetchJSON(API + '/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (j) {
      if (j && j.meta && j.meta.reason) toast('No flights found (' + j.meta.reason + ')');
      renderFlights(els.outbound, j.outboundFlights || []);
      renderFlights(els.retlist, j.returnFlights || []);
    }).catch(function (e) {
      toast('Search failed: ' + e.message);
    });
  }

  function runDiagnostics() {
    els.diagOut.classList.remove('hidden');
    var lines = [];
    function push(h, v) {
      lines.push('\n=== ' + h + ' ===\n' + (typeof v === 'string' ? v : JSON.stringify(v, null, 2)));
    }
    push('API Base', API);

    fetchJSON(API + '/health').then(function (h) {
      push('GET /health', h);
      return fetchJSON(API + '/payment-options');
    }).then(function (p) {
      push('GET /payment-options', p);
      return fetchJSON(API + '/debug-flightapi?dry=1', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          from:'BOM', to:'DEL',
          departureDate: els.dep.value,
          returnDate: els.ret.value,
          passengers:1, travelClass:'economy', tripType:'round-trip'
        })
      });
    }).then(function (d) {
      push('POST /debug-flightapi?dry=1', d);
      els.diagOut.textContent = lines.join('\n');
    }).catch(function (e) {
      push('Diagnostics error', String(e));
      els.diagOut.textContent = lines.join('\n');
    });
  }

  // Init
  (function init() {
    // default dates
    var today = new Date();
    function pad(n){return String(n).padStart(2,'0');}
    function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
    var d1 = new Date(today); d1.setDate(d1.getDate()+8);
    var d2 = new Date(today); d2.setDate(d2.getDate()+11);
    if (!els.dep.value) els.dep.value = iso(d1);
    if (!els.ret.value) els.ret.value = iso(d2);

    els.payBtn.addEventListener('click', function () {
      openModal();
      loadPaymentOptions().then(function(){ setBtnCount(); showTab('CreditCard'); });
    });
    els.overlay.addEventListener('click', closeModal);
    els.pmDone.addEventListener('click', function(){ setBtnCount(); closeModal(); });
    els.pmClear.addEventListener('click', function(){ selectedPayments=[]; setBtnCount(); renderPaymentLists(); });

    els.tabs.forEach(function(btn){ btn.addEventListener('click', function(){ showTab(btn.getAttribute('data-pm-tab')); }); });
    els.one.addEventListener('change', function(){ if (els.one.checked) els.ret.closest('.field').style.opacity = .45; });
    els.rtrip.addEventListener('change', function(){ if (els.rtrip.checked) els.ret.closest('.field').style.opacity = 1; });
    els.search.addEventListener('click', doSearch);
    els.diagBtn.addEventListener('click', runDiagnostics);

    if (els.one.checked) els.ret.closest('.field').style.opacity = .45;
  })();
})();
