// script.js — SkyDeal frontend (no layout change)

const API_BASE = 'https://skydeal-backend.onrender.com';

const els = {
  from: document.getElementById('from'),
  to: document.getElementById('to'),
  dep: document.getElementById('departure'),
  ret: document.getElementById('return'),
  pax: document.getElementById('passengers'),
  cabin: document.getElementById('cabin'),
  oneWay: document.getElementById('oneWay'),
  roundTrip: document.getElementById('roundTrip'),
  paymentBtn: document.getElementById('paymentBtn'),
  search: document.getElementById('searchBtn'),

  outList: document.getElementById('outboundList'),
  retList: document.getElementById('returnList'),

  outPrev: document.getElementById('outPrev'),
  outNext: document.getElementById('outNext'),
  outPage: document.getElementById('outPage'),
  retPrev: document.getElementById('retPrev'),
  retNext: document.getElementById('retNext'),
  retPage: document.getElementById('retPage'),

  // modal elements are queried on open
};

let selectedPayments = []; // plain strings (banks)
let outFlights = [];
let retFlights = [];
let outPageIndex = 0;
let retPageIndex = 0;
const PAGE_SIZE = 20;

// -------- Payment Modal
async function loadPaymentOptions() {
  const r = await fetch(`${API_BASE}/payment-options`);
  const j = await r.json();
  return j.options || {};
}

function openPaymentModal(options) {
  // expects a modal in HTML with id="paymentModal" and content containers per tab
  const modal = document.getElementById('paymentModal');
  const body = modal.querySelector('.pm-body');
  const doneBtn = modal.querySelector('.pm-done');
  const clearBtn = modal.querySelector('.pm-clear');

  // build simple checklists; reuse current styles
  body.innerHTML = '';
  const groups = ['CreditCard','DebitCard','NetBanking','UPI','Wallet','EMI'];
  const wrap = document.createElement('div');

  const tabs = document.createElement('div');
  tabs.className = 'pm-tabs';
  groups.forEach((g, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pm-tab' + (idx === 0 ? ' active':'');
    b.textContent = g.replace(/([A-Z])/g, ' $1').trim();
    b.dataset.tab = g;
    tabs.appendChild(b);
  });
  wrap.appendChild(tabs);

  const panes = document.createElement('div');
  panes.className = 'pm-panes';
  groups.forEach((g, idx) => {
    const pane = document.createElement('div');
    pane.className = 'pm-pane' + (idx === 0 ? ' show':'');
    (options[g] || []).forEach((label) => {
      const id = `pm-${g}-${label}`.replace(/\s+/g,'-');
      const row = document.createElement('label');
      row.className = 'pm-row';
      row.innerHTML = `
        <input type="checkbox" id="${id}">
        <span>${label}</span>
      `;
      const box = row.querySelector('input');
      box.checked = selectedPayments.includes(label);
      box.addEventListener('change', () => {
        if (box.checked) {
          if (!selectedPayments.includes(label)) selectedPayments.push(label);
        } else {
          selectedPayments = selectedPayments.filter(x => x !== label);
        }
      });
      pane.appendChild(row);
    });
    panes.appendChild(pane);
  });
  wrap.appendChild(panes);

  body.appendChild(wrap);

  // tabs behavior
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button.pm-tab');
    if (!btn) return;
    tabs.querySelectorAll('.pm-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    const idx = groups.indexOf(target);
    panes.querySelectorAll('.pm-pane').forEach((p, i) => {
      p.classList.toggle('show', i === idx);
    });
  });

  clearBtn.onclick = () => {
    selectedPayments = [];
    body.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  };
  doneBtn.onclick = () => {
    const c = document.getElementById('paymentBtnLabel');
    if (c) c.textContent = selectedPayments.length ? `Selected (${selectedPayments.length})` : 'Select Payment Methods';
    modal.close();
  };

  modal.showModal();
}

// -------- Search / Render
async function doSearch() {
  const payload = {
    from: els.from.value.trim(),
    to: els.to.value.trim(),
    departureDate: els.dep.value,
    returnDate: els.roundTrip.checked ? els.ret.value : undefined,
    tripType: els.roundTrip.checked ? 'round-trip':'one-way',
    passengers: Number(els.pax.value || 1),
    travelClass: (els.cabin.value || 'economy').toLowerCase(),
    paymentMethods: selectedPayments.slice(0),
  };

  const r = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  const j = await r.json();

  outFlights = Array.isArray(j.outboundFlights) ? j.outboundFlights : [];
  retFlights = Array.isArray(j.returnFlights) ? j.returnFlights : [];
  outPageIndex = 0;
  retPageIndex = 0;

  renderLists();
}

function fmtMoney(n) {
  const v = Number(n || 0);
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(v);
}

function buildCard(f) {
  const el = document.createElement('div');
  el.className = 'flight-card';

  const best = f.bestDeal || null;
  const bestLine = best ? `Best: ${fmtMoney(best.finalPrice)} on ${best.portal}` : '';
  const offerLine = (best && best.offerTag) ? `<div class="offer-line">Offer: ${best.offerTag}</div>` : '';

  el.innerHTML = `
    <div class="flight-main">
      <div class="airline">${f.airlineName} ${f.flightNumber ? '• '+f.flightNumber : ''}</div>
      <div class="sub">${f.departure && f.arrival ? `${f.departure} → ${f.arrival}` : ''} ${f.stops ? `• ${f.stops} stop${f.stops>1?'s':''}`:''}</div>
      <div class="best">${bestLine}</div>
      ${offerLine}
    </div>
    <div>
      <button class="btn-outline prices">Prices & breakdown</button>
    </div>
  `;

  el.querySelector('.prices').addEventListener('click', () => openPricesModal(f));
  return el;
}

function renderPage(list, container, pageIndex) {
  container.innerHTML = '';
  const start = pageIndex * PAGE_SIZE;
  const slice = list.slice(start, start + PAGE_SIZE);
  slice.forEach((f) => container.appendChild(buildCard(f)));
}

function renderLists() {
  renderPage(outFlights, els.outList, outPageIndex);
  renderPage(retFlights, els.retList, retPageIndex);

  const outPages = Math.max(1, Math.ceil(outFlights.length / PAGE_SIZE));
  const retPages = Math.max(1, Math.ceil(retFlights.length / PAGE_SIZE));

  els.outPage.textContent = `Page ${Math.min(outPageIndex+1, outPages)} / ${outPages}`;
  els.retPage.textContent = `Page ${Math.min(retPageIndex+1, retPages)} / ${retPages}`;

  els.outPrev.disabled = outPageIndex <= 0;
  els.outNext.disabled = outPageIndex >= outPages - 1;
  els.retPrev.disabled = retPageIndex <= 0;
  els.retNext.disabled = retPageIndex >= retPages - 1;
}

// -------- Prices modal
function openPricesModal(f) {
  const modal = document.getElementById('pricesModal');
  const title = modal.querySelector('.pm-title');
  const table = modal.querySelector('tbody');
  const why = modal.querySelector('.pm-why');

  title.textContent = `${f.airlineName} ${f.flightNumber ? '• '+f.flightNumber : ''}`;
  table.innerHTML = '';
  (f.portalPrices || []).forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.portal}</td>
      <td>${fmtMoney(p.finalPrice)}</td>
      <td>${p.source}${p.offerTag ? ` • <span class="applied">offer applied</span>`:''}</td>
    `;
    table.appendChild(tr);
  });

  // simple reasons list from f.offersUsed
  why.innerHTML = '';
  if (Array.isArray(f.offersUsed) && f.offersUsed.length) {
    const d = document.createElement('div');
    d.className = 'why-body';
    d.innerHTML = `<b>Why offers applied:</b><ul>${f.offersUsed.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    why.appendChild(d);
  }

  modal.showModal();
  modal.querySelector('.pm-close').onclick = () => modal.close();
}

// -------- Wire-up
els.paymentBtn.addEventListener('click', async () => {
  const opts = await loadPaymentOptions();
  openPaymentModal(opts);
});
els.search.addEventListener('click', doSearch);

// Pagination
els.outPrev.addEventListener('click', () => { if (outPageIndex>0) { outPageIndex--; renderLists(); }});
els.outNext.addEventListener('click', () => {
  const max = Math.max(1, Math.ceil(outFlights.length / PAGE_SIZE)) - 1;
  if (outPageIndex < max) { outPageIndex++; renderLists(); }
});
els.retPrev.addEventListener('click', () => { if (retPageIndex>0) { retPageIndex--; renderLists(); }});
els.retNext.addEventListener('click', () => {
  const max = Math.max(1, Math.ceil(retFlights.length / PAGE_SIZE)) - 1;
  if (retPageIndex < max) { retPageIndex++; renderLists(); }
});
