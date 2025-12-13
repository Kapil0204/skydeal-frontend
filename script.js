// script.js — keep your existing HTML/CSS unchanged

const API_BASE = "https://skydeal-backend.onrender.com";

const els = {
  openPayBtn: document.getElementById("openPaymentModal"),   // your "Payment methods" button
  payModal: document.getElementById("paymentModal"),
  payTabs: document.getElementById("paymentTabs"),            // the 5 chips container
  payList: document.getElementById("paymentList"),            // banks list area
  payDone: document.getElementById("payDone"),
  payClear: document.getElementById("payClear"),
  selectedCount: document.getElementById("selectedCount"),    // badge (x)
  searchBtn: document.getElementById("searchBtn"),
  outWrap: document.getElementById("outboundWrap"),
  retWrap: document.getElementById("returnWrap"),
  from: document.getElementById("from"),
  to: document.getElementById("to"),
  depart: document.getElementById("depart"),
  ret: document.getElementById("return"),
  pax: document.getElementById("passengers"),
  cabin: document.getElementById("cabin"),
  tripRound: document.getElementById("tripRound"),
  tripOne: document.getElementById("tripOne")
};

const STATE = {
  options: { "Credit Card": [], "Debit Card": [], "Net Banking": [], "UPI": [], "Wallet": [] },
  activeTab: "Credit Card",
  picked: new Set() // stores "type||bank"
};

function keyOf(type, bank) { return `${type}||${bank}`; }

function renderTabs() {
  if (!els.payTabs) return;
  els.payTabs.innerHTML = "";
  ["Credit Card","Debit Card","Net Banking","UPI","Wallet"].forEach(type => {
    const btn = document.createElement("button");
    btn.className = "chip" + (STATE.activeTab === type ? " chip--active" : "");
    btn.textContent = type;
    btn.onclick = () => { STATE.activeTab = type; renderTabs(); renderBankList(); };
    els.payTabs.appendChild(btn);
  });
}

function renderBankList() {
  if (!els.payList) return;
  const banks = STATE.options[STATE.activeTab] || [];
  els.payList.innerHTML = "";
  if (banks.length === 0) {
    els.payList.innerHTML = `<div class="muted">No options</div>`;
    return;
  }
  banks.forEach(bank => {
    const row = document.createElement("label");
    row.className = "pm-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = STATE.picked.has(keyOf(STATE.activeTab, bank));
    cb.onchange = () => {
      const k = keyOf(STATE.activeTab, bank);
      if (cb.checked) STATE.picked.add(k); else STATE.picked.delete(k);
      renderSelectedCount();
    };
    row.appendChild(cb);
    row.appendChild(document.createTextNode(" " + bank));
    els.payList.appendChild(row);
  });
}

function renderSelectedCount() {
  if (!els.selectedCount) return;
  els.selectedCount.textContent = `(${STATE.picked.size})`;
}

async function fetchPaymentOptions() {
  const r = await fetch(`${API_BASE}/payment-options`);
  const j = await r.json();
  STATE.options = j.options || STATE.options;
  renderTabs(); renderBankList(); renderSelectedCount();
}

function selectedPaymentFilters() {
  // Convert picked set to [{type, bank}]
  const arr = [];
  for (const k of STATE.picked) {
    const [type, bank] = k.split("||");
    arr.push({ type, bank });
  }
  return arr;
}

function flightCard(f) {
  const best = f.bestDeal || { portal: null, finalPrice: f.price, note: "No eligible offer" };
  const bestLine = best.portal
    ? `Best: ₹${best.finalPrice.toLocaleString()} on ${best.portal}`
    : best.note;

  return `
    <div class="flight-card">
      <div class="f-title">
        <strong>${f.airlineName || ""}</strong> • ${f.flightNumber || ""}
      </div>
      <div class="f-time">
        ${f.depart || ""} → ${f.arrive || ""} • ${f.stops === 0 ? "Non-stop" : `${f.stops} stop(s)`}
      </div>
      <div class="f-price">Base: ₹${(f.price||0).toLocaleString()}</div>
      <div class="f-best">${bestLine}</div>
    </div>
  `;
}

function renderResults(out, ret) {
  els.outWrap.innerHTML = out.length ? out.map(f => flightCard(f)).join("") : `<div class="muted">No flights found for your search.</div>`;
  els.retWrap.innerHTML = ret.length ? ret.map(f => flightCard(f)).join("") : `<div class="muted">No flights found for your search.</div>`;
}

async function doSearch() {
  els.outWrap.innerHTML = `<div class="muted">Searching…</div>`;
  els.retWrap.innerHTML = `<div class="muted">Searching…</div>`;

  const tripType = els.tripRound?.checked ? "round-trip" : "one-way";
  const body = {
    from: els.from.value.trim().toUpperCase(),
    to: els.to.value.trim().toUpperCase(),
    departureDate: els.depart.value,   // dd/mm/yyyy or yyyy-mm-dd (backend template expects yyyy-mm-dd)
    returnDate: els.ret.value,
    tripType,
    passengers: Number(els.pax.value || 1),
    travelClass: els.cabin.value || "economy",
    paymentFilters: selectedPaymentFilters()
  };

  // Normalize dd/mm/yyyy → yyyy-mm-dd for backend (FlightAPI template)
  const norm = d => d.includes("/") ? d.split("/").reverse().join("-") : d;
  body.departureDate = norm(body.departureDate);
  if (tripType === "round-trip" && body.returnDate) body.returnDate = norm(body.returnDate);

  try {
    const r = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    console.log("[SkyDeal] /search meta -->", j.meta);
    renderResults(j.outboundFlights || [], j.returnFlights || []);
  } catch (e) {
    console.error("search failed", e);
    els.outWrap.innerHTML = `<div class="muted">Failed to fetch flights.</div>`;
    els.retWrap.innerHTML = `<div class="muted">Failed to fetch flights.</div>`;
  }
}

// ---- wireup ----
if (els.openPayBtn && els.payModal) {
  els.openPayBtn.addEventListener("click", () => {
    els.payModal.style.display = "grid";
  });
}
if (els.payDone) {
  els.payDone.addEventListener("click", () => {
    els.payModal.style.display = "none";
  });
}
if (els.payClear) {
  els.payClear.addEventListener("click", () => {
    STATE.picked.clear(); renderBankList(); renderSelectedCount();
  });
}
if (els.searchBtn) {
  els.searchBtn.addEventListener("click", doSearch);
}

// init
fetchPaymentOptions();
