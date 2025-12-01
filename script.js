// script.js — minimal frontend logic (keeps your working UI)
// - Payment modal loads from /payment-options
// - On Search, POST /search with selected methods
// - Renders best price per flight + a "View prices" button to see portal breakdown

const API_BASE = "https://skydeal-backend.onrender.com";

const els = {
  from: document.getElementById("fromInput"),
  to: document.getElementById("toInput"),
  depart: document.getElementById("departDate"),
  ret: document.getElementById("returnDate"),
  pax: document.getElementById("paxSelect"),
  cabin: document.getElementById("cabinSelect"),
  tripOne: document.getElementById("tripOneWay"),
  tripRound: document.getElementById("tripRound"),
  searchBtn: document.getElementById("searchBtn"),
  outboundList: document.getElementById("outboundList"),
  returnList: document.getElementById("returnList"),
  pmBtn: document.getElementById("paymentSelectBtn"),
  pmBtnLabel: document.getElementById("paymentSelectBtnLabel"),
  pmOverlay: document.getElementById("paymentOverlay"),
  pmModal: document.getElementById("paymentModal"),
  pmTabs: document.querySelector(".pm-tabs"),
  pmLists: {
    CreditCard: document.getElementById("pm-list-credit"),
    DebitCard: document.getElementById("pm-list-debit"),
    Wallet: document.getElementById("pm-list-wallet"),
    UPI: document.getElementById("pm-list-upi"),
    NetBanking: document.getElementById("pm-list-netbanking"),
    EMI: document.getElementById("pm-list-emi")
  }
};

let paymentOptions = null;
let selectedLabels = []; // flat list of selected subtypes (banks/methods)

function setEmpty(el, msg="No flights") {
  el.classList.add("empty");
  el.textContent = msg;
}
function clearNode(el) {
  el.classList.remove("empty");
  el.innerHTML = "";
}

async function loadPaymentOptions() {
  const r = await fetch(`${API_BASE}/payment-options`).then(r=>r.json());
  paymentOptions = r.options || r?.data?.options || null;

  // populate lists
  for (const [bucket, listEl] of Object.entries(els.pmLists)) {
    listEl.innerHTML = "";
    const arr = paymentOptions?.[bucket] || [];
    if (!arr.length) {
      listEl.innerHTML = `<li class="pm-empty">No options</li>`;
      continue;
    }
    for (const label of arr) {
      const id = `pm-${bucket}-${label.replace(/\s+/g,"-")}`;
      const li = document.createElement("li");
      li.className = "pm-item";
      li.innerHTML = `
        <input type="checkbox" id="${id}" data-label="${label}">
        <label for="${id}">${label}</label>
      `;
      listEl.appendChild(li);
    }
  }
}

function openPM() {
  els.pmOverlay.classList.remove("hidden");
  els.pmModal.classList.remove("hidden");
}
function closePM() {
  els.pmOverlay.classList.add("hidden");
  els.pmModal.classList.add("hidden");
  // refresh selected labels summary
  const checked = Array.from(els.pmModal.querySelectorAll('input[type="checkbox"]:checked'))
    .map(i => i.dataset.label);
  selectedLabels = checked;
  els.pmBtnLabel.textContent = checked.length ? `${checked.length} method(s) selected` : "Select Payment Methods";
}
function switchTab(key) {
  document.querySelectorAll(".pm-tab").forEach(b=>b.classList.remove("pm-tab-active"));
  document.querySelector(`.pm-tab[data-pm-tab="${key}"]`)?.classList.add("pm-tab-active");
  document.querySelectorAll(".pm-panel").forEach(p=>p.classList.add("hidden"));
  document.querySelector(`[data-pm-panel="${key}"]`)?.classList.remove("hidden");
}

function cardForFlight(f) {
  // Use bestDeal if present
  const best = f.bestDeal;
  const bestLine = best ? `<div class="fc-price">🟢 ${best.label}</div>` : `<div class="fc-price">₹${f.price}</div>`;

  const div = document.createElement("div");
  div.className = "flight-card";
  div.innerHTML = `
    <div class="fc-title">${f.airlineName}</div>
    <div class="fc-time">${f.departure} → ${f.arrival} • ${f.stops ? (f.stops + " stop") : "Non-stop"}</div>
    ${bestLine}
    <button class="btn btn-sm" style="margin-top:8px" data-role="show-prices">View prices</button>
  `;

  // Hook for modal: show portalPrices
  div.querySelector('[data-role="show-prices"]').addEventListener("click", () => {
    const lines = (f.portalPrices || []).map(p => {
      const offer = p.offerInfo
        ? ` (offer: ${p.offerInfo.title || "—"}${p.offerInfo.couponRequired ? ", code required" : ""})`
        : "";
      return `${p.portal}: ₹${p.finalPrice}${offer}`;
    });
    alert(`Prices by portal:\n\n${lines.join("\n")}`);
  });

  return div;
}

async function doSearch() {
  const body = {
    from: (els.from.value || "BOM").toUpperCase().trim(),
    to: (els.to.value || "DEL").toUpperCase().trim(),
    departureDate: els.depart.value,
    returnDate: els.ret.value,
    passengers: Number(els.pax.value || 1),
    travelClass: els.cabin.value,
    tripType: els.tripRound.checked ? "round-trip" : "one-way",
    paymentMethods: selectedLabels // flat array of labels (banks/methods)
  };

  // guard dates
  if (!body.departureDate) {
    alert("Please select a departure date");
    return;
  }
  if (body.tripType === "round-trip" && !body.returnDate) {
    alert("Please select a return date");
    return;
  }

  els.searchBtn.disabled = true;

  const resp = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r=>r.json()).catch(()=>({ outboundFlights:[], returnFlights:[], error:"network"}));

  // render
  const out = resp.outboundFlights || [];
  const ret = resp.returnFlights || [];

  if (!out.length) setEmpty(els.outboundList, "No outbound flights");
  else {
    clearNode(els.outboundList);
    out.forEach(f => els.outboundList.appendChild(cardForFlight(f)));
  }

  if (body.tripType === "round-trip") {
    if (!ret.length) setEmpty(els.returnList, "No return flights");
    else {
      clearNode(els.returnList);
      ret.forEach(f => els.returnList.appendChild(cardForFlight(f)));
    }
  } else {
    setEmpty(els.returnList, "—");
  }

  els.searchBtn.disabled = false;
}

// ---------------- init ----------------
(function init() {
  // sensible defaults
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const dd = String(today.getDate()+1).padStart(2,"0");
  els.depart.value = `${yyyy}-${mm}-${dd}`;

  els.pmBtn.addEventListener("click", openPM);
  els.pmOverlay.addEventListener("click", closePM);
  document.getElementById("pmDoneBtn").addEventListener("click", closePM);
  document.getElementById("pmClearBtn").addEventListener("click", () => {
    els.pmModal.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
    selectedLabels = [];
    els.pmBtnLabel.textContent = "Select Payment Methods";
  });

  // tab switching
  document.querySelectorAll(".pm-tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.pmTab));
  });

  // show credit tab first
  switchTab("creditCard");

  // load options + wire search
  loadPaymentOptions().catch(()=>{});
  els.searchBtn.addEventListener("click", doSearch);
})();
