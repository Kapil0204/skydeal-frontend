// ---- Configure your backend base URL here ----
const API_BASE = "https://skydeal-backend.onrender.com";

// DOM refs
const els = {
  from: document.getElementById("fromInput"),
  to: document.getElementById("toInput"),
  depart: document.getElementById("departDate"),
  ret: document.getElementById("returnDate"),
  tripOne: document.getElementById("tripOneWay"),
  tripRound: document.getElementById("tripRound"),
  returnField: document.getElementById("returnField"),
  pax: document.getElementById("paxSelect"),
  cabin: document.getElementById("cabinSelect"),
  searchBtn: document.getElementById("searchBtn"),
  pmBtn: document.getElementById("paymentSelectBtn"),
  pmBtnLabel: document.getElementById("paymentSelectBtnLabel"),
  pmOverlay: document.getElementById("paymentOverlay"),
  pmModal: document.getElementById("paymentModal"),
  pmTabs: document.querySelectorAll(".pm-tab"),
  pmPanels: document.querySelectorAll(".pm-panel"),
  pmLists: {
    CreditCard: document.getElementById("pm-list-credit"),
    DebitCard: document.getElementById("pm-list-debit"),
    NetBanking: document.getElementById("pm-list-netbanking"),
    UPI: document.getElementById("pm-list-upi"),
    Wallet: document.getElementById("pm-list-wallet"),
    EMI: document.getElementById("pm-list-emi"),
  },
  pmDone: document.getElementById("pmDoneBtn"),
  pmClear: document.getElementById("pmClearBtn"),
  outList: document.getElementById("outboundList"),
  retList: document.getElementById("returnList"),
  outPager: document.getElementById("outPager"),
  retPager: document.getElementById("retPager"),
  outPageLabel: document.getElementById("outPageLabel"),
  retPageLabel: document.getElementById("retPageLabel"),
  pricesOverlay: document.getElementById("pricesOverlay"),
  pricesModal: document.getElementById("pricesModal"),
  pricesBody: document.getElementById("pricesBody"),
  vpCloseBtn: document.getElementById("vpCloseBtn"),
};

let paymentOptions = null;
let selectedLabels = [];
let allOut = [];
let allRet = [];
const PAGE_SIZE = 40;
let outPage = 1;
let retPage = 1;

// ---------- helpers ----------
function setEmpty(el, msg = "No flights") {
  el.classList.add("empty");
  el.textContent = msg;
}
function clearNode(el) {
  el.classList.remove("empty");
  el.innerHTML = "";
}
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function fmtPrice(n) {
  const v = Number(n || 0);
  return isFinite(v) ? `₹${v.toLocaleString("en-IN")}` : "—";
}
function stopsText(n) {
  const s = Number(n || 0);
  return s <= 0 ? "Non-stop" : (s === 1 ? "1 stop" : `${s} stops`);
}
function showSpinner(btn, on) {
  if (!btn) return;
  if (on) {
    btn.classList.add("loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

// ---------- Payment modal ----------
async function loadPaymentOptions() {
  const r = await fetch(`${API_BASE}/payment-options`).then((x) => x.json());
  paymentOptions = r.options || r?.data?.options || {};

  const fill = (bucket, listEl) => {
    listEl.innerHTML = "";
    const arr = paymentOptions?.[bucket] || [];
    if (!arr.length) {
      listEl.innerHTML = `<li class="pm-empty">No options</li>`;
      return;
    }
    arr.forEach((label) => {
      const id = `pm-${bucket}-${label.replace(/\s+/g, "-")}`;
      const li = document.createElement("li");
      li.className = "pm-item";
      li.innerHTML = `
        <input type="checkbox" id="${id}" data-label="${label}">
        <label for="${id}">${label}</label>
      `;
      listEl.appendChild(li);
    });
  };

  fill("CreditCard", els.pmLists.CreditCard);
  fill("DebitCard", els.pmLists.DebitCard);
  fill("NetBanking", els.pmLists.NetBanking);
  fill("UPI", els.pmLists.UPI);
  fill("Wallet", els.pmLists.Wallet);
  fill("EMI", els.pmLists.EMI);
}

function openPM() {
  els.pmOverlay.classList.remove("hidden");
  els.pmModal.classList.remove("hidden");
}
function closePM() {
  // collect selection count
  const checked = Array.from(els.pmModal.querySelectorAll('input[type="checkbox"]:checked'))
    .map((i) => i.dataset.label);
  selectedLabels = checked;
  els.pmOverlay.classList.add("hidden");
  els.pmModal.classList.add("hidden");
  els.pmBtnLabel.textContent = checked.length
    ? `${checked.length} method(s) selected`
    : "Select Payment Methods";
}
function clearPM() {
  els.pmModal.querySelectorAll('input[type="checkbox"]').forEach((i) => (i.checked = false));
  selectedLabels = [];
  els.pmBtnLabel.textContent = "Select Payment Methods";
}
function switchTab(key) {
  els.pmTabs.forEach((b) => b.classList.remove("pm-tab-active"));
  document.querySelector(`.pm-tab[data-pm-tab="${key}"]`)?.classList.add("pm-tab-active");
  els.pmPanels.forEach((p) => p.classList.add("hidden"));
  document.querySelector(`.pm-panel[data-pm-panel="${key}"]`)?.classList.remove("hidden");
}

// ---------- Results rendering ----------
function cardForFlight(f) {
  const div = document.createElement("div");
  div.className = "flight-card";

  const airline = f.airlineName || "—";
  const flightNo = f.flightNumber || "";
  const time = `${f.departure || "--:--"} → ${f.arrival || "--:--"} • ${stopsText(f.stops)}`;

  let bestLine = `<div class="fc-price">${fmtPrice(f.price)}</div>`;
  if (f.bestDeal) {
    bestLine = `<div class="fc-best">Best: ${f.bestDeal.portal} — ${fmtPrice(f.bestDeal.finalPrice)}</div>`;
  }

  div.innerHTML = `
    <div>
      <div class="fc-title">${airline}${flightNo ? ` • ${flightNo}` : ""}</div>
      <div class="fc-time">${time}</div>
      <div class="fc-sub">${f.bestDeal ? "Based on selected payment methods" : "No offer applied"}</div>
    </div>
    <div class="fc-actions">
      ${bestLine}
      <button class="btn" data-role="show-prices">View prices</button>
    </div>
  `;

  // show prices modal
  div.querySelector('[data-role="show-prices"]').addEventListener("click", () => {
    const list = Array.isArray(f.portalPrices) ? f.portalPrices : [];
    els.pricesBody.innerHTML = list
      .map(
        (p) => `
        <div class="price-row">
          <div>${p.portal}</div>
          <div><strong>${fmtPrice(p.finalPrice)}</strong></div>
        </div>
      `
      )
      .join("");
    els.pricesOverlay.classList.remove("hidden");
    els.pricesModal.classList.remove("hidden");
  });

  return div;
}

function renderPaged(list, el, page, pageLabelEl) {
  if (!Array.isArray(list) || list.length === 0) {
    setEmpty(el, "No flights");
    pageLabelEl.textContent = "1";
    return;
  }
  const pages = chunk(list, PAGE_SIZE);
  const idx = Math.max(1, Math.min(page, pages.length)) - 1;
  clearNode(el);
  pages[idx].forEach((f) => el.appendChild(cardForFlight(f)));
  pageLabelEl.textContent = `${idx + 1}/${pages.length}`;
}

// ---------- Search ----------
async function doSearch() {
  const body = {
    from: (els.from.value || "BOM").toUpperCase().trim(),
    to: (els.to.value || "DEL").toUpperCase().trim(),
    departureDate: els.depart.value,
    returnDate: els.ret.value,
    passengers: Number(els.pax.value || 1),
    travelClass: els.cabin.value,
    tripType: els.tripRound.checked ? "round-trip" : "one-way",
    paymentMethods: selectedLabels,
  };

  if (!body.departureDate) { alert("Please select a departure date"); return; }
  if (body.tripType === "round-trip" && !body.returnDate) {
    alert("Please select a return date"); return;
  }

  // reset pages
  outPage = 1; retPage = 1;

  showSpinner(els.searchBtn, true);

  let resp;
  try {
    const r = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    resp = await r.json();
  } catch (e) {
    resp = { outboundFlights: [], returnFlights: [], error: "network" };
  } finally {
    showSpinner(els.searchBtn, false);
  }

  allOut = Array.isArray(resp.outboundFlights) ? resp.outboundFlights : [];
  allRet = Array.isArray(resp.returnFlights) ? resp.returnFlights : [];

  if (allOut.length === 0) setEmpty(els.outList, "No outbound flights");
  else renderPaged(allOut, els.outList, outPage, els.outPageLabel);

  if (body.tripType === "round-trip") {
    if (allRet.length === 0) setEmpty(els.retList, "No return flights");
    else renderPaged(allRet, els.retList, retPage, els.retPageLabel);
  } else {
    setEmpty(els.retList, "—");
    els.retPageLabel.textContent = "1";
  }
}

// ---------- init ----------
(function init() {
  // sensible defaults
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate() + 1).padStart(2, "0");
  els.depart.value = `${yyyy}-${mm}-${dd}`;

  // trip toggle
  const refreshTrip = () => {
    els.returnField.style.display = els.tripRound.checked ? "flex" : "none";
  };
  els.tripOne.addEventListener("change", refreshTrip);
  els.tripRound.addEventListener("change", refreshTrip);
  refreshTrip();

  // payment modal
  els.pmBtn.addEventListener("click", openPM);
  els.pmOverlay.addEventListener("click", closePM);
  els.pmDone.addEventListener("click", closePM);
  els.pmClear.addEventListener("click", clearPM);
  els.pmTabs.forEach((btn) =>
    btn.addEventListener("click", () => switchTab(btn.dataset.pmTab))
  );
  switchTab("creditCard");

  // prices modal
  els.pricesOverlay.addEventListener("click", () => {
    els.pricesOverlay.classList.add("hidden");
    els.pricesModal.classList.add("hidden");
  });
  els.vpCloseBtn.addEventListener("click", () => {
    els.pricesOverlay.classList.add("hidden");
    els.pricesModal.classList.add("hidden");
  });

  // pagination
  document.querySelectorAll(".pg-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const which = b.dataset.which;
      const dir = Number(b.dataset.dir);
      if (which === "out" && allOut.length) {
        const pages = Math.ceil(allOut.length / PAGE_SIZE);
        outPage = Math.max(1, Math.min(outPage + dir, pages));
        renderPaged(allOut, els.outList, outPage, els.outPageLabel);
      } else if (which === "ret" && allRet.length) {
        const pages = Math.ceil(allRet.length / PAGE_SIZE);
        retPage = Math.max(1, Math.min(retPage + dir, pages));
        renderPaged(allRet, els.retList, retPage, els.retPageLabel);
      }
    });
  });

  // load PMs and wire search
  loadPaymentOptions().catch(() => {});
  els.searchBtn.addEventListener("click", doSearch);
})();
