// script.js — FULL FILE
const API_BASE = "https://skydeal-backend.onrender.com";

const el = {
  from: document.getElementById("from"),
  to: document.getElementById("to"),
  depart: document.getElementById("depart"),
  ret: document.getElementById("return"),
  pax: document.getElementById("passengers"),
  cabin: document.getElementById("cabin"),
  oneway: document.getElementById("oneway"),
  roundtrip: document.getElementById("roundtrip"),
  btnSearch: document.getElementById("btn-search"),
  outWrap: document.getElementById("outbound"),
  retWrap: document.getElementById("return-wrap"),
  payBtn: document.getElementById("payment-btn"),
  payBadge: document.getElementById("payment-badge"),

  modal: document.getElementById("pay-modal"),
  modalClose: document.getElementById("pay-close"),
  chipRow: document.getElementById("pay-chips"),
  listWrap: document.getElementById("pay-list"),
  clearBtn: document.getElementById("pay-clear"),
  doneBtn: document.getElementById("pay-done"),
};

const state = {
  payOptions: { "Credit Card":[], "Debit Card":[], "Net Banking":[], "UPI":[], "Wallet":[] },
  paySelected: new Set(),     // banks selected by user
  payActiveTab: "Credit Card",
};

function rs(x){ return typeof x==="number" ? x.toLocaleString("en-IN") : x; }
function inr(n){ return "₹" + rs(n); }

function show(elm){ elm.classList.remove("hidden"); }
function hide(elm){ elm.classList.add("hidden"); }

async function fetchPaymentOptions() {
  const r = await fetch(`${API_BASE}/payment-options`);
  if (!r.ok) throw new Error("payment-options failed");
  const j = await r.json();
  state.payOptions = j.options || state.payOptions;
  renderPayChips();
  renderPayList();
}

function renderPayChips() {
  const cats = Object.keys(state.payOptions);
  el.chipRow.innerHTML = "";
  cats.forEach(cat=>{
    const b = document.createElement("button");
    b.className = "chip" + (state.payActiveTab===cat?" chip--active":"");
    b.textContent = cat;
    b.addEventListener("click", ()=>{ state.payActiveTab = cat; renderPayChips(); renderPayList(); });
    el.chipRow.appendChild(b);
  });
}

function renderPayList() {
  const banks = state.payOptions[state.payActiveTab] || [];
  el.listWrap.innerHTML = "";
  if (!banks.length) {
    el.listWrap.innerHTML = `<div class="muted">No options</div>`;
    return;
  }
  banks.forEach((name)=>{
    const id = `pay-${name.replace(/\s+/g,"-")}`;
    const row = document.createElement("label");
    row.className = "pay-row";
    row.innerHTML = `
      <input type="checkbox" id="${id}" ${state.paySelected.has(name)?"checked":""}/>
      <span>${name}</span>
    `;
    row.querySelector("input").addEventListener("change",(ev)=>{
      if (ev.target.checked) state.paySelected.add(name);
      else state.paySelected.delete(name);
      el.payBadge.textContent = `(${state.paySelected.size})`;
    });
    el.listWrap.appendChild(row);
  });
}

function openPayModal(){ show(el.modal); }
function closePayModal(){ hide(el.modal); }

el.payBtn?.addEventListener("click", openPayModal);
el.modalClose?.addEventListener("click", closePayModal);
el.clearBtn?.addEventListener("click", ()=>{
  state.paySelected.clear();
  el.payBadge.textContent = "(0)";
  renderPayList();
});
el.doneBtn?.addEventListener("click", closePayModal);

function flightCardHTML(f) {
  const best = f.bestDeal || { finalPrice: f.price, note: "No eligible offer", portal: "—" };
  const bestLine = (best.note === "No eligible offer")
    ? `<div class="muted">Best price on OTA: ${inr(best.finalPrice)}</div>`
    : `<div class="best">Best: ${inr(best.finalPrice)} on ${best.portal}</div>`;

  return `
  <div class="card">
    <div class="title">${f.airlineName || "Flight"} • ${f.id || ""}</div>
    <div class="meta">${f.depTime || ""} → ${f.arrTime || ""} • ${f.stops || "—"}</div>
    ${bestLine}
    <button class="btn-outline sm" data-id="${f.id}">Prices & breakdown</button>
  </div>`;
}

function renderResults(outbound, returns){
  el.outWrap.innerHTML = outbound.length ? outbound.map(flightCardHTML).join("") : `<div class="muted">No flights found for your search.</div>`;
  el.retWrap.innerHTML = returns.length ? returns.map(flightCardHTML).join("") : `<div class="muted">No flights found for your search.</div>`;
}

async function doSearch() {
  try {
    el.btnSearch.disabled = true;

    const payload = {
      from: el.from.value.trim(),
      to: el.to.value.trim(),
      departureDate: el.depart.value,
      returnDate: el.ret.value,
      tripType: el.roundtrip.checked ? "round-trip":"one-way",
      passengers: Number(el.pax.value||1),
      travelClass: String(el.cabin.value||"economy").toLowerCase(),
      paymentMethods: Array.from(state.paySelected)
    };

    const r = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!r.ok) throw new Error(`/search ${r.status}`);
    const j = await r.json();
    renderResults(j.outboundFlights || [], j.returnFlights || []);
    console.log("[SkyDeal] /search meta", j.meta);
  } catch (e) {
    console.error(e);
    renderResults([], []);
  } finally {
    el.btnSearch.disabled = false;
  }
}

el.btnSearch?.addEventListener("click", doSearch);

// initial boot
fetchPaymentOptions().catch(console.error);
