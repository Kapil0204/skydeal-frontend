// script.js — SkyDeal FE with prices modal + pagination + carrier mixing
const API_BASE = "https://skydeal-backend.onrender.com";

// ---------- els ----------
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
  sortSelect: document.getElementById("sortSelect"),
  resultSummary: document.getElementById("resultSummary"),

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
    EMI: document.getElementById("pm-list-emi"),
  },

  // pager
  pager: document.getElementById("paginationControls"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  pageInfo: document.getElementById("pageInfo"),

  // prices modal
  prOverlay: document.getElementById("pricesOverlay"),
  prModal: document.getElementById("pricesModal"),
  prTitle: document.getElementById("pricesTitle"),
  prCloseX: document.getElementById("pricesCloseX"),
  prCloseBtn: document.getElementById("pricesCloseBtn"),
  flightSummary: document.getElementById("flightSummary"),
  portalTbody: document.getElementById("portalTbody"),
  reasonPre: document.getElementById("reasonPre"),
};

let paymentOptions = null;
let selectedLabels = []; // chosen banks/method tags (flat)
let lastMeta = null;

// pagination state
const PAGE_SIZE = 40;
let outAll = [];   // all outbound results (raw from API, decorated)
let outPaged = []; // current page subset
let outPage = 1;   // current page index (1-based)
let outPages = 1;
// === paging state ===
const PAGE_SIZE = 40;
let state = {
  pageOut: 1,
  pageRet: 1,
  outSorted: [],
  retSorted: []
};


function setEmpty(el, msg="No flights") {
  el.classList.add("empty");
  el.textContent = msg;
}
function clearNode(el) {
  el.classList.remove("empty");
  el.innerHTML = "";
}
function paginate(arr, page, size) {
  const start = (page - 1) * size;
  return arr.slice(start, start + size);
}

function renderPagedList(listEl, arr, pageLabelEl, page, total, side) {
  clearNode(listEl);
  paginate(arr, page, PAGE_SIZE).forEach(f => listEl.appendChild(cardForFlight(f)));
  if (pageLabelEl) pageLabelEl.textContent = `Page ${page} / ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`;
  // next/prev buttons: expected elements with data-role
  const prevBtn = document.querySelector(`[data-role="prev-${side}"]`);
  const nextBtn = document.querySelector(`[data-role="next-${side}"]`);
  if (prevBtn) prevBtn.disabled = page <= 1;
  if (nextBtn) nextBtn.disabled = page >= Math.ceil(total / PAGE_SIZE);
}


// ---- payment options ----
async function loadPaymentOptions() {
  const r = await fetch(`${API_BASE}/payment-options`).then(r=>r.json());
  paymentOptions = r.options || r?.data?.options || null;

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
function openPM() { els.pmOverlay.classList.remove("hidden"); els.pmModal.classList.remove("hidden"); }
function closePM() {
  els.pmOverlay.classList.add("hidden"); els.pmModal.classList.add("hidden");
  const checked = Array.from(els.pmModal.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.dataset.label);
  selectedLabels = checked;
  els.pmBtnLabel.textContent = checked.length ? `${checked.length} method(s) selected` : "Select Payment Methods";
}
function switchTab(key) {
  document.querySelectorAll(".pm-tab").forEach(b=>b.classList.remove("pm-tab-active"));
  document.querySelector(`.pm-tab[data-pm-tab="${key}"]`)?.classList.add("pm-tab-active");
  document.querySelectorAll(".pm-panel").forEach(p=>p.classList.add("hidden"));
  document.querySelector(`[data-pm-panel="${key}"]`)?.classList.remove("hidden");
}

// ---- prices modal ----
function openPrices() { els.prOverlay.classList.remove("hidden"); els.prModal.classList.remove("hidden"); }
function closePrices() { els.prOverlay.classList.add("hidden"); els.prModal.classList.add("hidden"); }

function renderPricesModal(flight) {
  els.prTitle.textContent = "Prices & breakdown";
  els.flightSummary.textContent = `${flight.airlineName} • ${flight.departure} → ${flight.arrival} • ${flight.stops ? (flight.stops + " stop") : "Non-stop"} • Base ₹${flight.price}`;

  // table
  els.portalTbody.innerHTML = "";
  (flight.portalPrices || []).forEach(p => {
    // If no discount applied, final = base+markup, src = carrier+markup
    const td = document.createElement("tr");
    const label = p.source === "carrier+markup" ? `<span class="tag-none">no eligible offer</span>` : `<span class="tag-ok">offer applied</span>`;
    td.innerHTML = `
      <td>${p.portal}</td>
      <td>₹${p.finalPrice}</td>
      <td>${p.source} ${label}</td>
    `;
    els.portalTbody.appendChild(td);
  });

  // reason/debug (global to the search)
  if (lastMeta?.offerDebug) {
    els.reasonPre.textContent = JSON.stringify(lastMeta.offerDebug, null, 2);
  } else {
    els.reasonPre.textContent = "—";
  }

  openPrices();
}

// ---- cards ----
function cardForFlight(f) {
  const div = document.createElement("div");
  div.className = "flight-card";

  let priceLine = "";
  if (f.bestDeal) {
    priceLine = `<div class="fc-price">Best: ₹${f.bestDeal.finalPrice} on ${f.bestDeal.portal}</div>`;
  } else {
    priceLine = `<div class="fc-price">₹${f.price}</div>`;
  }

  div.innerHTML = `
    <div class="fc-title">${f.airlineName} • ${f.flightNumber || ""}</div>
    <div class="fc-time">${f.departure} → ${f.arrival} • ${f.stops ? (f.stops + " stop") : "Non-stop"}</div>
    ${priceLine}
    <button class="btn" style="margin-top:8px" data-role="show-prices">Prices & breakdown</button>
  `;
  div.querySelector('[data-role="show-prices"]').addEventListener("click", () => renderPricesModal(f));
  return div;
}

// ---------- sorting/mix/paging ----------
function timeToNum(t) {
  // "HH:MM" -> integer minutes
  const m = String(t||"").match(/^(\d{2}):(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1],10)*60 + parseInt(m[2],10);
}
function sortFlights(list, mode="cheapest") {
  const arr = [...list];
  if (mode === "cheapest") {
    arr.sort((a,b) => Number(a.bestDeal?.finalPrice || a.price) - Number(b.bestDeal?.finalPrice || b.price));
  } else if (mode === "depart") {
    arr.sort((a,b) => timeToNum(a.departure) - timeToNum(b.departure));
  }
  // put non-stop first (stable partition)
  const nonstop = arr.filter(x => (x.stops||0) === 0);
  const stops   = arr.filter(x => (x.stops||0) > 0);
  return nonstop.concat(stops);
}

// Round-robin by carriers to keep a healthy mix, while keeping order
function mixCarriers(list, maxPerCarrier = 12) {
  const groups = new Map();
  for (const f of list) {
    const k = (f.airlineName || "Other").toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    if (groups.get(k).length < maxPerCarrier) groups.get(k).push(f);
  }
  // round-robin
  const keys = Array.from(groups.keys());
  const mixed = [];
  let added = true;
  while (added) {
    added = false;
    for (const k of keys) {
      const g = groups.get(k);
      if (g && g.length) {
        mixed.push(g.shift());
        added = true;
      }
    }
  }
  // append any leftovers (if any group exceeded maxPerCarrier; not expected here)
  return mixed.length ? mixed : list;
}

function paginate(list, page=1, size=40) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p-1)*size;
  const end = Math.min(total, start+size);
  return { page:p, pages, slice:list.slice(start,end), total };
}

function updatePagerUI(pg) {
  if (!pg || pg.pages <= 1) {
    els.pager.classList.add("hidden");
    return;
  }
  els.pager.classList.remove("hidden");
  els.pageInfo.textContent = `Page ${pg.page} / ${pg.pages}`;
  els.prevPage.disabled = (pg.page <= 1);
  els.nextPage.disabled = (pg.page >= pg.pages);
}

// --------- render pipelines ----------
function renderOutbound(list) {
  // Sort cheapest first
state.outSorted = [...out].sort((a,b) => (Number(a.bestDeal?.finalPrice || a.price) - Number(b.bestDeal?.finalPrice || b.price)));
state.pageOut = 1;

const outPageLabel = document.getElementById("outPageLabel"); // add a span in HTML near the pager
if (!state.outSorted.length) setEmpty(els.outboundList, "No outbound flights");
else renderPagedList(els.outboundList, state.outSorted, outPageLabel, state.pageOut, state.outSorted.length, "out");

function renderReturn(list) {
  if (!list.length) { setEmpty(els.returnList, "No return flights"); return; }
  clearNode(els.returnList);
  list.forEach(f => els.returnList.appendChild(cardForFlight(f)));
}

function computeAndRenderPages(all) {
  // sort -> mix -> paginate
  const mode = els.sortSelect.value || "cheapest";
  const sorted = sortFlights(all, mode);
  const mixed  = mixCarriers(sorted, 12);
  const pg = paginate(mixed, outPage, PAGE_SIZE);

  outPages = pg.pages;
  outPaged = pg.slice;
  updatePagerUI(pg);
  renderOutbound(outPaged);

  els.resultSummary.textContent = `Showing ${pg.slice.length} of ${pg.total} outbound results`;
}

// ---------- search ----------
async function doSearch() {
  const body = {
    from: (els.from.value || "BOM").toUpperCase().trim(),
    to: (els.to.value || "DEL").toUpperCase().trim(),
    departureDate: els.depart.value,
    returnDate: els.ret.value,
    passengers: Number(els.pax.value || 1),
    travelClass: els.cabin.value,
    tripType: els.tripRound.checked ? "round-trip" : "one-way",
    paymentMethods: selectedLabels
  };

  // guards
  if (!body.departureDate) { alert("Please select a departure date"); return; }
  if (body.tripType === "round-trip" && !body.returnDate) { alert("Please select a return date"); return; }

  els.searchBtn.disabled = true;

  const resp = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r=>r.json()).catch(()=>({ outboundFlights:[], returnFlights:[], error:"network"}));

  lastMeta = resp.meta || null;

  const out = Array.isArray(resp.outboundFlights) ? resp.outboundFlights : [];
  const ret = Array.isArray(resp.returnFlights) ? resp.returnFlights : [];
  // compute pages for outbound
  outAll = out;
  outPage = 1;
  computeAndRenderPages(outAll);

  // return list (no paging for now; can add later)
  if (body.tripType === "round-trip") {
  state.retSorted = [...ret].sort((a,b) => (Number(a.bestDeal?.finalPrice || a.price) - Number(b.bestDeal?.finalPrice || b.price)));
  state.pageRet = 1;

  const retPageLabel = document.getElementById("retPageLabel"); // add a span in HTML near the pager
  if (!state.retSorted.length) setEmpty(els.returnList, "No return flights");
  else renderPagedList(els.returnList, state.retSorted, retPageLabel, state.pageRet, state.retSorted.length, "ret");
} else {
  state.retSorted = [];
  setEmpty(els.returnList, "—");
}


// ---------- init ----------
(function init() {
  // sensible defaults
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const dd = String(today.getDate()+1).padStart(2,"0");
  els.depart.value = `${yyyy}-${mm}-${dd}`;

  // payment modal
  els.pmBtn.addEventListener("click", openPM);
  els.pmOverlay.addEventListener("click", closePM);
  document.getElementById("pmDoneBtn").addEventListener("click", closePM);
  document.getElementById("pmClearBtn").addEventListener("click", () => {
    els.pmModal.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
    selectedLabels = [];
    els.pmBtnLabel.textContent = "Select Payment Methods";
  });
  document.getElementById("pmCloseX").addEventListener("click", closePM);
  document.querySelectorAll(".pm-tab").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.pmTab)));
  switchTab("creditCard");

  // prices modal
  els.prCloseX.addEventListener("click", closePrices);
  els.prCloseBtn.addEventListener("click", closePrices);
  els.prOverlay.addEventListener("click", closePrices);

  // sort/pager
  els.sortSelect.addEventListener("change", () => {
    if (!outAll.length) return;
    outPage = 1;
    computeAndRenderPages(outAll);
  });
  els.prevPage.addEventListener("click", () => {
    if (outPage > 1) { outPage--; computeAndRenderPages(outAll); }
  });
  els.nextPage.addEventListener("click", () => {
    if (outPage < outPages) { outPage++; computeAndRenderPages(outAll); }
  });

  // load & search
  loadPaymentOptions().catch(()=>{});
  els.searchBtn.addEventListener("click", doSearch);
  // Expect buttons in HTML with data-role="prev-out", "next-out", "prev-ret", "next-ret"
const wirePager = (side) => {
  const prev = document.querySelector(`[data-role="prev-${side}"]`);
  const next = document.querySelector(`[data-role="next-${side}"]`);
  const label = document.getElementById(side === "out" ? "outPageLabel" : "retPageLabel");
  const listEl = side === "out" ? els.outboundList : els.returnList;
  const arr = () => (side === "out" ? state.outSorted : state.retSorted);
  const pageRef = () => (side === "out" ? "pageOut" : "pageRet");

  if (prev) prev.addEventListener("click", () => {
    if (state[pageRef()] > 1) {
      state[pageRef()]--;
      renderPagedList(listEl, arr(), label, state[pageRef()], arr().length, side);
    }
  });
  if (next) next.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(arr().length / PAGE_SIZE));
    if (state[pageRef()] < totalPages) {
      state[pageRef()]++;
      renderPagedList(listEl, arr(), label, state[pageRef()], arr().length, side);
    }
  });
};

wirePager("out");
wirePager("ret");

  
})();
