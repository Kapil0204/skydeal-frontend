/* SkyDeal – script.js (SEARCH-ONLY; leaves payment modal untouched) */

(() => {
  const API_BASE = 'https://skydeal-backend.onrender.com';

  // ---------- helpers ----------
  const $  = (sel, root = document) => root.querySelector(sel);

  function toISO(d) {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;       // yyyy-mm-dd
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);  // dd/mm/yyyy
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  }

  function getTripType() {
    const r = document.querySelector('input[name="tripType"]:checked');
    const v = (r?.value || '').toLowerCase();
    if (v === 'round-trip' || v === 'roundtrip' || v === 'round') return 'round-trip';
    return 'one-way';
  }

  function clearAndEmpty(into, msg = 'No flights found for your search.') {
    if (!into) return;
    into.innerHTML = '';
    const box = document.createElement('div');
    box.style.color = '#9aa3ab';
    box.style.border = '1px dashed #e9edf2';
    box.style.borderRadius = '10px';
    box.style.padding = '14px';
    box.textContent = msg;
    into.appendChild(box);
  }

  function renderFlights(list, into) {
    if (!into) return;
    into.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      clearAndEmpty(into);
      return;
    }
    list.forEach(f => {
      const card = document.createElement('div');
      card.style.border = '1px solid #eef2f6';
      card.style.borderRadius = '14px';
      card.style.padding = '14px';
      card.style.marginBottom = '12px';
      card.style.display = 'grid';
      card.style.gridTemplateColumns = '1fr auto';
      card.style.gap = '10px';
      const left = document.createElement('div');
      const right = document.createElement('div');
      right.style.textAlign = 'right';

      const airline = document.createElement('div');
      airline.style.fontWeight = '600';
      airline.textContent = f.airlineName || f.flightName || '—';

      const meta = document.createElement('div');
      meta.style.color = '#6b7785';
      meta.style.fontSize = '13px';
      const dep = f.departureTime || f.departure || '—';
      const arr = f.arrivalTime   || f.arrival   || '—';
      const stops = (typeof f.stops === 'number') ? `${f.stops} stop(s)` : (f.stopsText || '0 stop(s)');
      meta.textContent = `${dep} → ${arr} · ${stops}`;

      left.appendChild(airline);
      left.appendChild(meta);

      const price = document.createElement('div');
      price.style.fontWeight = '700';
      price.style.fontSize = '16px';
      price.textContent = (f.price != null) ? `₹${f.price}` : '₹0';

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

  async function doSearch() {
    const fromInput = $('#fromInput');
    const toInput = $('#toInput');
    const departInput = $('#departInput');
    const returnInput = $('#returnInput');
    const paxSelect = $('#passengersSelect');
    const cabinSelect = $('#cabinSelect');

    const outboundBox = $('#outboundList');
    const returnBox   = $('#returnList');

    const tripType = getTripType();
    const depISO = toISO(departInput?.value || '');
    const retISO = toISO(returnInput?.value || '');

    const payload = {
      from: (fromInput?.value || 'BOM').trim(),
      to:   (toInput?.value   || 'DEL').trim(),
      departureDate: depISO || '2025-12-17',
      returnDate: tripType === 'round-trip' ? (retISO || '2025-12-27') : '',
      tripType,
      passengers: Number(paxSelect?.value || 1),
      travelClass: (cabinSelect?.value || 'economy').toLowerCase()
    };

    console.log('[SkyDeal] /search → payload', payload);

    try {
      const res = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      const meta = json?.meta || {};
      console.log('[SkyDeal] /search ← meta', meta);

      if (meta.outStatus === 200) renderFlights(json.outboundFlights || [], outboundBox);
      else                        clearAndEmpty(outboundBox);

      if (payload.tripType === 'round-trip') {
        if (meta.retStatus === 200) renderFlights(json.returnFlights || [], returnBox);
        else                        clearAndEmpty(returnBox);
      } else {
        clearAndEmpty(returnBox, '—');
      }
    } catch (e) {
      console.error('[SkyDeal] search failed', e);
      clearAndEmpty($('#outboundList'));
      clearAndEmpty($('#returnList'));
    }
  }

  function wireSearch() {
    const btn = $('#searchBtn') ||
      Array.from(document.querySelectorAll('button'))
        .find(b => (b.textContent || '').trim().toLowerCase() === 'search');

    if (!btn) {
      console.warn('[SkyDeal] search: button not found');
      return;
    }
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      doSearch();
    });

    ['#fromInput','#toInput','#departInput','#returnInput'].forEach(id => {
      const el = $(id); if (!el) return;
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
      });
    });

    console.log('[SkyDeal] bound search handler(s)');
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Prefill “known good” test so UI = your working curl
    const d = $('#departInput'); if (d && !d.value) d.value = '17/12/2025';
    const r = $('#returnInput'); if (r && !r.value) r.value = '27/12/2025';
    wireSearch();
    console.log('[SkyDeal] frontend ready (search only; payment untouched)');
  });
})();
