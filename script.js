/* SkyDeal – script.js (stable)
   - Search payload normalized
   - Payment modal left untouched (no template changes)
   - Robust selectors + safe defaults
*/

(() => {
  const API_BASE = 'https://skydeal-backend.onrender.com';

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function toISO(d) {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // yyyy-mm-dd
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // dd/mm/yyyy
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  function getTripType() {
    // Prefer radio by name, fallback to specific ids
    const checked = $('input[name="tripType"]:checked');
    const raw = (checked?.value || '').toLowerCase();
    if (raw === 'one' || raw === 'oneway' || raw === 'one-way') return 'one-way';
    if (raw === 'round' || raw === 'roundtrip' || raw === 'round-trip') return 'round-trip';
    if ($('#roundTrip')?.checked) return 'round-trip';
    return 'one-way';
  }

  function ensureDateInputs() {
    // Prefill with known-good dates if empty so UI == working curl
    const depart = $('#departInput');
    const ret = $('#returnInput');
    if (depart && !depart.value) depart.value = '17/12/2025';
    if (ret && !ret.value) ret.value = '27/12/2025';
  }

  function badge(text) {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.display = 'inline-block';
    span.style.fontSize = '12px';
    span.style.padding = '2px 6px';
    span.style.border = '1px solid #eee';
    span.style.borderRadius = '10px';
    span.style.marginLeft = '8px';
    return span;
  }

  function clearContainer(el) {
    if (!el) return;
    el.innerHTML = '';
    const skeleton = document.createElement('div');
    skeleton.style.color = '#9aa3ab';
    skeleton.style.border = '1px dashed #e9edf2';
    skeleton.style.borderRadius = '10px';
    skeleton.style.padding = '14px';
    skeleton.textContent = 'No flights found for your search.';
    el.appendChild(skeleton);
  }

  function renderFlights(list, into) {
    if (!into) return;
    into.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      clearContainer(into);
      return;
    }

    list.forEach((f) => {
      const card = document.createElement('div');
      card.style.border = '1px solid #eef2f6';
      card.style.borderRadius = '14px';
      card.style.padding = '14px';
      card.style.marginBottom = '12px';
      card.style.display = 'grid';
      card.style.gridTemplateColumns = '1fr auto';
      card.style.gap = '10px';
      card.style.alignItems = 'center';
      card.style.background = '#fff';

      const left = document.createElement('div');
      const right = document.createElement('div');
      right.style.textAlign = 'right';

      const airline = document.createElement('div');
      airline.style.fontWeight = '600';
      airline.textContent = f.airlineName || f.flightName || '—';

      const line2 = document.createElement('div');
      line2.style.color = '#6b7785';
      line2.style.fontSize = '13px';
      const dep = f.departureTime || f.departure || 'undefined';
      const arr = f.arrivalTime || f.arrival || 'undefined';
      const stops = typeof f.stops === 'number'
        ? `${f.stops} stop(s)`
        : (f.stopsText || '0 stop(s)');
      line2.textContent = `${dep} → ${arr} · ${stops}`;

      left.appendChild(airline);
      left.appendChild(line2);

      const price = document.createElement('div');
      price.style.fontWeight = '700';
      price.style.fontSize = '16px';
      price.textContent = f.price != null ? `₹${f.price}` : '₹0';

      const best = document.createElement('div');
      best.style.color = '#8a94a3';
      best.style.fontSize = '12px';
      best.textContent = f.bestDeal ? `Best: ${f.bestDeal.portal} — ${f.bestDeal.offer}` : 'Best: —';

      right.appendChild(price);
      right.appendChild(best);

      card.appendChild(left);
      card.appendChild(right);

      into.appendChild(card);
    });
  }

  // ---------- payment (DO NOT CHANGE STRUCTURE) ----------
  function wirePaymentOpen() {
    const openBtn =
      $('#paymentBtn') ||
      $('[data-payment-button]') ||
      // last resort: button whose text includes "Payment"
      Array.from(document.querySelectorAll('button')).find(b =>
        (b.textContent || '').toLowerCase().includes('payment')
      );

    const modal = $('#paymentModal'); // trust your existing modal

    if (!openBtn) return console.log('[SkyDeal] payment: no open button found (skip)');
    if (!modal)   return console.log('[SkyDeal] payment: #paymentModal not found (skip)');

    // Fetch options once and cache on modal element
    openBtn.addEventListener('click', async () => {
      if (!modal.dataset.loaded) {
        try {
          const res = await fetch(`${API_BASE}/payment-options`);
          const data = await res.json();
          console.log('[SkyDeal] /payment-options', data);
          // Expect your existing code to render inside the modal.
          // We simply stash the options so your own script can read them.
          modal.dataset.loaded = '1';
          modal._options = data;
        } catch (e) {
          console.warn('[SkyDeal] payment options fetch failed', e);
        }
      }
      // Open (assuming your HTML controls visibility via a class)
      modal.style.display = 'grid';
    });
  }

  // ---------- search ----------
  async function doSearch() {
    const fromInput = $('#fromInput');
    const toInput = $('#toInput');
    const departInput = $('#departInput');
    const returnInput = $('#returnInput');
    const passengersSelect = $('#passengersSelect');
    const cabinSelect = $('#cabinSelect');

    const outboundBox = $('#outboundList');
    const returnBox = $('#returnList');

    const tripType = getTripType();

    const depISO = toISO(departInput?.value || '');
    const retISO = toISO(returnInput?.value || '');

    const payload = {
      from: (fromInput?.value || '').trim() || 'BOM',
      to: (toInput?.value || '').trim() || 'DEL',
      departureDate: depISO || '2025-12-17',
      returnDate: tripType === 'one-way' ? '' : (retISO || '2025-12-27'),
      tripType,
      passengers: Number(passengersSelect?.value || 1),
      travelClass: (cabinSelect?.value || 'economy').toLowerCase(),
      // NOTE: if you collect selected payment filters, include them as:
      // paymentFilters: window.__selectedPaymentFilters || []
    };

    console.log('[SkyDeal] FIRE → /search payload', payload);

    try {
      const res = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      const meta = json?.meta || {};
      console.log('[SkyDeal] /search meta ←', meta);

      if (meta.outStatus === 200) {
        renderFlights(json.outboundFlights || [], outboundBox);
      } else {
        clearContainer(outboundBox);
      }

      // Return leg only when trip is round-trip (backend might return empty for one-way)
      if (payload.tripType === 'round-trip' && meta.retStatus === 200) {
        renderFlights(json.returnFlights || [], returnBox);
      } else {
        clearContainer(returnBox);
      }
    } catch (e) {
      console.error('[SkyDeal] search failed', e);
      clearContainer($('#outboundList'));
      clearContainer($('#returnList'));
    }
  }

  function wireSearch() {
    const searchBtn = $('#searchBtn') ||
      Array.from(document.querySelectorAll('button')).find(b =>
        (b.textContent || '').trim().toLowerCase() === 'search'
      );

    if (!searchBtn) {
      console.warn('[SkyDeal] search: no button found to bind');
      return;
    }

    searchBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      doSearch();
    });

    // Enter key on inputs triggers search
    ['#fromInput', '#toInput', '#departInput', '#returnInput'].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSearch();
        }
      });
    });

    console.log('[SkyDeal] bound search handler(s)');
  }

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    ensureDateInputs();      // prefill known-good dates
    wirePaymentOpen();       // do not rebuild modal, just wire the open
    wireSearch();

    // Optional: kick a first, predictable search so you see data immediately
    // doSearch();

    console.log('[SkyDeal] frontend ready (bindings set)');
  });
})();
