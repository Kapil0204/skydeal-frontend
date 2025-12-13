// ----- CONFIG -----
const BACKEND = "https://skydeal-backend.onrender.com";

// state
const state = {
  paymentBuckets: {
    "Credit Card": [],
    "Debit Card": [],
    "Net Banking": [],
    UPI: [],
    Wallet: [],
  },
  selected: [], // [{type:'Credit Card', bank:'HDFC Bank'}]
  activeType: "Credit Card",
};

// --- utils ---
function ddmmyyyyToISO(s) {
  if (!s) return "";
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return s; // assume already ISO
  const [_, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function el(q) { return document.querySelector(q); }
function ce(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

// --- Payment modal rendering ---
const pmBtn = el("#pmBtn");
const pmCount = el("#pmCount");
const modal = el("#paymentModal");
const pmClose = el("#pmClose");
const pmTabs = el("#pmTabs");
const pmBanks = el("#pmBanks");
const pmClear = el("#pmClear");
const pmDone = el("#pmDone");

function openModal() { modal.setAttribute("aria-hidden", "false"); }
function closeModal() { modal.setAttribute("aria-hidden", "true"); }

function renderTabs() {
  pmTabs.innerHTML = "";
  Object.keys(state.paymentBuckets).forEach((t) => {
    const chip = ce("div", "tab" + (state.activeType === t ? " active" : ""));
    chip.textContent = t;
    chip.onclick = () => { state.activeType = t; renderTabs(); renderBanks(); };
    pmTabs.appendChild(chip);
  });
}

function isChecked(type, bank) {
  return state.selected.some((x) => x.type === type && x.bank === bank);
}

function renderBanks() {
  pmBanks.innerHTML = "";
  const type = state.activeType;
  const banks = state.paymentBuckets[type] || [];
  if (!banks.length) {
    const p = ce("div"); p.style.color="#6b7280"; p.style.padding="10px"; p.textContent="No options"; pmBanks.appendChild(p);
    return;
  }
  banks.forEach((name) => {
    const row = ce("label", "bank");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isChecked(type, name);
    cb.onchange = () => {
      if (cb.checked) {
        state.selected.push({ type, bank: name });
      } else {
        state.selected = state.selected.filter((x) => !(x.type === type && x.bank === name));
      }
      pmCount.textContent = `(${state.selected.length})`;
    };
    const span = ce("span"); span.textContent = name;
    row.append(cb, span);
    pmBanks.appendChild(row);
  });
}

async function fetchPaymentOptions() {
  const r = await fetch(`${BACKEND}/payment-options`);
  if (!r.ok) throw new Error("payment-options failed");
  const data = await r.json();
  state.paymentBuckets = data.options || state.paymentBuckets;
  // keep exactly five buckets; dedupe already done by backend
  renderTabs(); renderBanks();
}

// modal buttons
pmBtn.onclick = () => openModal();
pmClose.onclick = () => closeModal();
pmClear.onclick = () => { state.selected = []; pmCount.textContent = "(0)"; renderBanks(); };
pmDone.onclick = () => closeModal();
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

// --- Search ---
const btnSearch = el("#searchBtn");
const outBox = el("#outbound");
const retBox = el("#return");

function cardHTML(f) {
  const name = f.airlineName || "Airline";
  const time = `${f.departure} → ${f.arrival}`;
  const stops = f.stops === 0 ? "Non-stop" : `${f.stops} stop${f.stops>1?"s":""}`;
  const best = f.bestDeal ? `Best: ₹${f.bestDeal.finalPrice} on ${f.bestDeal.portal}` : "";
  return `
    <div class="card">
      <div>
        <div><strong>${name}</strong></div>
        <div class="meta">${time} • ${stops}</div>
        <div class="best">${best}</div>
      </div>
      <div>
        <button class="btn">Prices & breakdown</button>
      </div>
    </div>
  `;
}

async function doSearch() {
  outBox.innerHTML = '<div class="meta">Searching…</div>';
  retBox.innerHTML = '<div class="meta">Searching…</div>';

  const payload = {
    from: el("#from").value.trim().toUpperCase(),
    to: el("#to").value.trim().toUpperCase(),
    departureDate: ddmmyyyyToISO(el("#depart").value.trim()),
    returnDate: ddmmyyyyToISO(el("#ret").value.trim()),
    passengers: Number(el("#pax").value || 1),
    travelClass: el("#cabin").value || "economy",
    tripType: (document.querySelector('input[name="trip"]:checked')?.value) || "round-trip",
    paymentFilters: state.selected.slice(), // [{type, bank}]
  };

  if (payload.tripType === "one-way") payload.returnDate = "";

  try {
    const r = await fetch(`${BACKEND}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    console.log("[SkyDeal] /search meta", data?.meta);

    const outs = data?.outboundFlights || [];
    const rets = data?.returnFlights || [];

    outBox.innerHTML = outs.length ? outs.map(cardHTML).join("") : '<div class="meta">No flights found for your search.</div>';
    retBox.innerHTML = payload.tripType === "round-trip"
      ? (rets.length ? rets.map(cardHTML).join("") : '<div class="meta">No flights found for your search.</div>')
      : '<div class="meta">—</div>';

  } catch (e) {
    outBox.innerHTML = '<div class="meta">Failed to fetch flights.</div>';
    retBox.innerHTML = '<div class="meta">Failed to fetch flights.</div>';
    console.error(e);
  }
}

// init
fetchPaymentOptions().catch(console.error);
btnSearch.onclick = doSearch;

// Prefill today/today+2 in dd/mm/yyyy to avoid empty inputs
(function presetDates(){
  const d = new Date();
  const r = new Date(d.getTime() + 2*86400000);
  const fmt = (x) => String(x.getDate()).padStart(2,"0") + "/" + String(x.getMonth()+1).padStart(2,"0") + "/" + x.getFullYear();
  el("#depart").value = fmt(d);
  el("#ret").value = fmt(r);
})();
