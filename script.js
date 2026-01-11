/* =========================
   SkyDeal Frontend — script.js (FULL)
   - Payment modal (Mongo-driven)
   - Search (FlightAPI backend)
   - Pagination
   - Portal comparison popup
   ========================= */

const BACKEND = "https://skydeal-backend.onrender.com";

// ---------- DOM (match your index.html ids) ----------
const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");
const departInput = document.getElementById("departInput");
const returnInput = document.getElementById("returnInput");
const paxSelect = document.getElementById("paxSelect");
const cabinSelect = document.getElementById("cabinSelect");
const oneWayRadio = document.getElementById("oneWay");
const roundTripRadio = document.getElementById("roundTrip");
const searchBtn = document.getElementById("searchBtn");

const outboundList = document.getElementById("outboundList");
const returnList = document.getElementById("returnList");

const outPrev = document.getElementById("outPrev");
const outNext = document.getElementById("outNext");
const outPage = document.getElementById("outPage");

const retPrev = document.getElementById("retPrev");
const retNext = document.getElementById("retNext");
const retPage = document.getElementById("retPage");

// Payment UI
const paymentBtn = document.getElementById("paymentBtn");
const pmCount = document.getElementById("pmCount");

const paymentModal = document.getElementById("paymentModal");
const pmClose = document.getElementById("pmClose");
const pmList = document.getElementById("pmList");
const pmClear = document.getElementById("pmClear");
const pmDone = document.getElementById("pmDone");

// Tabs container
const pmTabsContainer = document.querySelector(".pm-tabs");

// ---------- State ----------
let paymentOptions = {};
let activePaymentType = "Credit Card";

// ✅ Keep as objects: [{type,name}]
let selectedPaymentMethods = [];

let outboundAll = [];
let returnAll = [];
let lastSearchPayload = null;

const PAGE_SIZE = 6;
let outPageIdx = 1;
let retPageIdx = 1;

// ---------- Utils ----------
function toISO(d) {
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const t = new Date(d);
  return isNaN(t) ? "" : t.toISOString().slice(0, 10);
}

function safeText(v, def = "—") {
  const s = v == null ? "" : String(v);
  return s.trim() ? s : def;
}

function fmtTime(t) {
  if (!t) return "—";
  const s = String(t);
  if (s.includes("T")) return s.split("T")[1]?.slice(0, 5) || s;
  return s;
}

function displayFlightNumber(f) {
  const fc = (f?.flightCode || f?.flightIata || "").toString().trim();
  if (fc) return fc;

  let carrier = (f?.carrierCode || f?.airlineCode || f?.iataCode || "").toString().trim();

  if (!carrier) {
    const name = (f?.airlineName || "").toString().toLowerCase();
    const map = [
      { k: "indigo", c: "6E" },
      { k: "air india express", c: "IX" },
      { k: "air india", c: "AI" },
      { k: "akasa", c: "QP" },
      { k: "spicejet", c: "SG" },
      { k: "vistara", c: "UK" },
      { k: "go first", c: "G8" },
    ];
    const hit = map.find((x) => name.includes(x.k));
    if (hit) carrier = hit.c;
  }

  const num = (f?.flightNumber || "").toString().trim();
  if (carrier && num) return `${carrier} ${num}`;
  return num || "—";
}

function flightKey(f) {
  return [
    (f?.airlineName || "").toString().trim().toLowerCase(),
    displayFlightNumber(f),
    fmtTime(f?.departureTime),
    fmtTime(f?.arrivalTime),
    Number.isFinite(f?.price) ? Math.round(f.price) : ""
  ].join("|");
}

function money(n) {
  if (typeof n === "number" && !isNaN(n)) return `₹${Math.round(n)}`;
  const v = Number(String(n || "").replace(/[^\d.]/g, ""));
  if (!isNaN(v)) return `₹${Math.round(v)}`;
  return "₹0";
}

// ---------- OTA deep links ----------
function isoToDDMMYYYY(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function cabinToGoibibo(cabin) {
  const c = String(cabin || "economy").toLowerCase();
  if (c.includes("premium")) return "PE";
  if (c.includes("business")) return "B";
  if (c.includes("first")) return "F";
  return "E";
}

function cabinToMMT(cabin) {
  return cabinToGoibibo(cabin);
}

function normalizeCabinLabel(cabin) {
  const c = String(cabin || "economy").toLowerCase();
  if (c.includes("premium")) return "Premium_Economy";
  if (c.includes("business")) return "Business";
  if (c.includes("first")) return "First";
  return "Economy";
}

function cityMap(iata) {
  const x = String(iata || "").toUpperCase();
  const map = {
    BOM: "Mumbai",
    DEL: "Delhi",
    BLR: "Bengaluru",
    HYD: "Hyderabad",
    MAA: "Chennai",
    CCU: "Kolkata",
    PNQ: "Pune",
    GOI: "Goa",
    AMD: "Ahmedabad",
  };
  return map[x] || x;
}

function buildPortalSearchUrl(portal, payload) {
  if (!payload) return null;

  const from = (payload.from || "").trim().toUpperCase();
  const to = (payload.to || "").trim().toUpperCase();
  const depISO = payload.departureDate || "";
  const retISO = payload.returnDate || "";
  const tripType = payload.tripType || "one-way";
  const adults = Number(payload.passengers || 1) || 1;
  const cabinRaw = payload.travelClass || "economy";

  if (!from || !to || !depISO) return null;

  const depDDMMYYYY = isoToDDMMYYYY(depISO);
  const retDDMMYYYY = isoToDDMMYYYY(retISO);

  if (portal === "Goibibo") {
    const cabinClass = cabinToGoibibo(cabinRaw);
    if (tripType === "round-trip" && retDDMMYYYY) {
      return `https://www.goibibo.com/flight/search?itinerary=${from}-${to}-${depDDMMYYYY}_${to}-${from}-${retDDMMYYYY}&tripType=R&paxType=A-${adults}_C-0_I-0&intl=false&cabinClass=${cabinClass}&lang=eng`;
    }
    return `https://www.goibibo.com/flight/search?itinerary=${from}-${to}-${depDDMMYYYY}&tripType=O&paxType=A-${adults}_C-0_I-0&intl=false&cabinClass=${cabinClass}&lang=eng`;
  }

  if (portal === "MakeMyTrip") {
    const cabinClass = cabinToMMT(cabinRaw);
    if (tripType === "round-trip" && retDDMMYYYY) {
      return `https://www.makemytrip.com/flight/search?itinerary=${from}-${to}-${depDDMMYYYY}_${to}-${from}-${retDDMMYYYY}&tripType=R&paxType=A-${adults}_C-0_I-0&intl=false&cabinClass=${cabinClass}&lang=eng`;
    }
    return `https://www.makemytrip.com/flight/search?itinerary=${from}-${to}-${depDDMMYYYY}&tripType=O&paxType=A-${adults}_C-0_I-0&intl=false&cabinClass=${cabinClass}&lang=eng`;
  }

  if (portal === "Yatra") {
    const cabinLabel = normalizeCabinLabel(cabinRaw);
    const flight_depart_date = encodeURIComponent(depDDMMYYYY);
    return `https://flight.yatra.com/air-search-ui/dom2/trigger?flex=0&viewName=normal&source=fresco-flights&type=O&class=${encodeURIComponent(cabinLabel)}&ADT=${adults}&CHD=0&INF=0&noOfSegments=1&origin=${from}&originCountry=IN&destination=${to}&destinationCountry=IN&flight_depart_date=${flight_depart_date}&arrivalDate=`;
  }

  if (portal === "EaseMyTrip") {
    const fromCity = cityMap(from);
    const toCity = cityMap(to);
    const srch = `${from}-${fromCity}-India|${to}-${toCity}-India|${depDDMMYYYY}`;
    return `https://flight.easemytrip.com/FlightList/Index?srch=${encodeURIComponent(srch)}&px=${adults}-0-0&cbn=0&ar=undefined&isow=true&isdm=true&lang=en-us&CCODE=IN&curr=INR&apptype=B2C`;
  }

  if (portal === "Cleartrip") {
    const cabinLabel = normalizeCabinLabel(cabinRaw);
    const originText = `${from}%20-%20${encodeURIComponent(cityMap(from))},%20IN`;
    const destText = `${to}%20-%20${encodeURIComponent(cityMap(to))},%20IN`;
    return `https://www.cleartrip.com/flights/results?adults=${adults}&childs=0&infants=0&class=${encodeURIComponent(cabinLabel)}&depart_date=${encodeURIComponent(depDDMMYYYY)}&from=${from}&to=${to}&intl=n&origin=${originText}&destination=${destText}&return_date=&rnd_one=O&isCfw=false`;
  }

  return null;
}

function updatePaymentButtonLabel() {
  const n = selectedPaymentMethods.length;
  if (pmCount) pmCount.textContent = String(n);
  if (paymentBtn) paymentBtn.textContent = `Payment methods (${n})`;
}

/* =========================
   Offer line formatter + T&C modal
   ========================= */
function formatOfferLine(p) {
  if (!p.applied) {
    return `<div style="opacity:.65;font-size:13px;">No offer available</div>`;
  }

  const offerText = safeText(p.rawDiscount, "Offer available");
  const codeText = p.code ? ` • Code: ${safeText(p.code)}` : "";
  const hasTerms = p.terms && String(p.terms).trim().length > 0;

  const tncBtn = hasTerms
    ? ` • <button 
          class="tncBtn"
          data-portal="${safeText(p.portal)}"
          data-terms="${encodeURIComponent(String(p.terms))}"
          style="
            background:transparent;
            border:1px solid rgba(255,255,255,.25);
            color:#e5e7eb;
            border-radius:10px;
            padding:2px 8px;
            font-size:12px;
            cursor:pointer;
          "
        >T&C</button>`
    : "";

  return `
    <div style="opacity:.85;font-size:13px;">
      Offer: ${offerText}${codeText}
      ${p.paymentLabel ? `<div style="opacity:.85;margin-top:4px;">Payment: <b>${safeText(p.paymentLabel)}</b></div>` : ""}
      ${tncBtn}
    </div>
  `;
}

function openTncModal(title, terms) {
  let modal = document.getElementById("tncModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "tncModal";
    modal.className = "modal";
    modal.setAttribute("aria-hidden", "true");
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.background = "rgba(0,0,0,.55)";
    modal.style.display = "none";
    modal.style.zIndex = "10000";
    modal.innerHTML = `
      <div style="max-width:900px;margin:7vh auto;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;color:#e5e7eb;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div id="tncTitle" style="font-size:16px;font-weight:700;"></div>
          <button id="tncClose" style="background:transparent;border:0;color:#e5e7eb;font-size:20px;cursor:pointer;">×</button>
        </div>
        <div id="tncBody" style="margin-top:12px;white-space:pre-wrap;line-height:1.45;max-height:65vh;overflow:auto;opacity:.92;"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) closeTncModal();
    });
    modal.querySelector("#tncClose").addEventListener("click", closeTncModal);
  }

  modal.querySelector("#tncTitle").textContent = `${title} — Terms & Conditions`;
  modal.querySelector("#tncBody").textContent = terms || "No terms available.";

  modal.style.display = "block";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeTncModal() {
  const modal = document.getElementById("tncModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
}

// Delegated click handler for T&C buttons
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tncBtn");
  if (!btn) return;

  const terms = decodeURIComponent(btn.getAttribute("data-terms") || "");
  const portal = btn.getAttribute("data-portal") || "Offer";
  openTncModal(portal, terms);
});

// ---------- Payment Modal ----------
function openPaymentModal() {
  if (!paymentModal) return;
  paymentModal.setAttribute("aria-hidden", "false");
  paymentModal.classList.add("open");
  renderPaymentTabs();
  renderPaymentList();
}

function closePaymentModal() {
  if (!paymentModal) return;
  paymentModal.setAttribute("aria-hidden", "true");
  paymentModal.classList.remove("open");
}

function renderPaymentTabs() {
  if (!pmTabsContainer) return;

  const types = Object.keys(paymentOptions || {}).filter((k) => Array.isArray(paymentOptions[k]));
  const ordered = ["Credit Card", "Debit Card", "Net Banking", "UPI", "Wallet", "EMI"];
  const finalTypes = [
    ...ordered.filter((t) => types.includes(t)),
    ...types.filter((t) => !ordered.includes(t)),
  ];

  pmTabsContainer.innerHTML = finalTypes
    .map((t) => `<button data-tab="${t}" class="tab ${t === activePaymentType ? "active" : ""}">${t}</button>`)
    .join("");

  pmTabsContainer.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activePaymentType = btn.getAttribute("data-tab");
      pmTabsContainer.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderPaymentList();
    });
  });
}

function isSelected(type, name) {
  return selectedPaymentMethods.some(
    (x) => x.type === type && x.name.toLowerCase().trim() === name.toLowerCase().trim()
  );
}

function toggleSelected(type, name, checked) {
  const t = type;
  const n = name;

  if (checked) {
    if (!isSelected(t, n)) selectedPaymentMethods.push({ type: t, name: n });
  } else {
    selectedPaymentMethods = selectedPaymentMethods.filter(
      (x) => !(x.type === t && x.name.toLowerCase().trim() === n.toLowerCase().trim())
    );
  }
  updatePaymentButtonLabel();
}

function renderPaymentList() {
  if (!pmList) return;
  const type = activePaymentType;
  const raw = Array.isArray(paymentOptions?.[type]) ? paymentOptions[type] : [];
  const list = [...new Set(raw.map(x => String(x || "").trim()).filter(Boolean))];

  if (list.length === 0) {
    pmList.innerHTML = `<div class="empty">No options found for ${type}.</div>`;
    return;
  }

  pmList.innerHTML = list
    .map((name, idx) => {
      const id = `pm_${type}_${idx}`.replace(/\s+/g, "_");
      const checked = isSelected(type, name) ? "checked" : "";
      return `
        <label class="pm-item" for="${id}">
          <input id="${id}" type="checkbox" ${checked} />
          <span>${safeText(name)}</span>
        </label>
      `;
    })
    .join("");

  pmList.querySelectorAll("input[type=checkbox]").forEach((cb, idx) => {
    cb.addEventListener("change", (e) => {
      const name = list[idx];
      toggleSelected(type, name, e.target.checked);
    });
  });
}

function normalizePmNameForUI(name) {
  const s = (name ?? "").toString().trim().replace(/\s+/g, " ");
  if (!s) return "";
  const upper = s.toUpperCase();
  const acronyms = ["HDFC", "ICICI", "HSBC", "SBI", "RBL", "IDFC", "PNB", "BOB", "AXIS", "KOTAK", "YES", "AU"];
  for (const a of acronyms) {
    if (upper === a || upper.startsWith(a + " ")) return upper.replace(/\bBANK\b/i, "Bank");
  }
  return s
    .split(" ")
    .map(w => w.length <= 2 ? w.toUpperCase() : (w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function dedupePaymentOptions(options) {
  const out = {};
  for (const [type, arr] of Object.entries(options || {})) {
    const list = Array.isArray(arr) ? arr : [];
    const seen = new Set();
    const cleaned = [];

    for (const raw of list) {
      const name = normalizePmNameForUI(raw);
      const key = name.toLowerCase();
      if (!name) continue;
      if (name.length <= 2) continue;
      if (!seen.has(key)) {
        seen.add(key);
        cleaned.push(name);
      }
    }
    out[type] = cleaned;
  }
  return out;
}

async function loadPaymentOptions() {
  try {
    const res = await fetch(`${BACKEND}/payment-options`);
    const data = await res.json();
    paymentOptions = dedupePaymentOptions(data?.options || {});

    if (!paymentOptions[activePaymentType]) {
      const keys = Object.keys(paymentOptions);
      activePaymentType = keys[0] || "Credit Card";
    }
    renderPaymentTabs();
    updatePaymentButtonLabel();
  } catch (e) {
    console.error("[SkyDeal] payment-options failed", e);
    paymentOptions = {};
    updatePaymentButtonLabel();
  }
}

// ---------- Pagination ----------
function slicePage(items, pageIdx) {
  const start = (pageIdx - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

function totalPages(items) {
  return Math.max(1, Math.ceil((items.length || 0) / PAGE_SIZE));
}

function renderPager(which) {
  if (which === "out") {
    const tp = totalPages(outboundAll);
    if (outPage) outPage.textContent = String(outPageIdx);
    if (outPrev) outPrev.disabled = outPageIdx <= 1;
    if (outNext) outNext.disabled = outPageIdx >= tp;
  } else {
    const tp = totalPages(returnAll);
    if (retPage) retPage.textContent = String(retPageIdx);
    if (retPrev) retPrev.disabled = retPageIdx <= 1;
    if (retNext) retNext.disabled = retPageIdx >= tp;
  }
}

// ---------- Portal Modal ----------
function ensurePortalModal() {
  let modal = document.getElementById("portalCompareModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "portalCompareModal";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(0,0,0,.55)";
  modal.style.display = "none";
  modal.style.zIndex = "9999";
  modal.innerHTML = `
    <div style="max-width:720px;margin:7vh auto;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;color:#e5e7eb;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div style="font-size:16px;font-weight:700;">Portal price comparison</div>
        <button id="portalCompareClose" style="background:transparent;border:0;color:#e5e7eb;font-size:20px;cursor:pointer;">×</button>
      </div>
      <div id="portalCompareBody" style="margin-top:12px;"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
  modal.querySelector("#portalCompareClose").addEventListener("click", () => {
    modal.style.display = "none";
  });

  return modal;
}

function showPortalCompare(flight) {
  const modal = ensurePortalModal();
  const body = modal.querySelector("#portalCompareBody");

  const portalPrices = Array.isArray(flight?.portalPrices) ? flight.portalPrices : [];

  if (portalPrices.length === 0) {
    body.innerHTML = `<div style="opacity:.85;">No portal price data available.</div>`;
  } else {
    body.innerHTML = `
      <div style="opacity:.85;margin-bottom:10px;">
        ${safeText(flight.airlineName)} (${displayFlightNumber(flight)}) • ${fmtTime(flight.departureTime)} → ${fmtTime(flight.arrivalTime)}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${portalPrices
          .map((p) => {
            const href = buildPortalSearchUrl(p.portal, lastSearchPayload);

            const line1 = `<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
              <div style="font-weight:600;display:flex;gap:10px;align-items:center;">
                <span>${safeText(p.portal)}</span>
                ${
                  href
                    ? `<a href="${href}" target="_blank" rel="noopener noreferrer"
                        style="font-size:12px;font-weight:600;padding:4px 8px;border-radius:6px;background:#2563eb;color:#ffffff;text-decoration:none;line-height:1;">
                        Open
                      </a>`
                    : ""
                }
              </div>
              <div style="font-weight:700;">${money(p.finalPrice ?? p.basePrice ?? flight?.price)}</div>
            </div>`;

            const line2 = `<div>${formatOfferLine(p)}</div>`;
            return `<div style="padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:12px;">${line1}${line2}</div>`;
          })
          .join("")}
      </div>
    `;
  }

  modal.style.display = "block";
}

// ---------- Cards ----------
function flightCard(f) {
  const name = safeText(f.airlineName);
  const num = displayFlightNumber(f);
  const dep = fmtTime(f.departureTime);
  const arr = fmtTime(f.arrivalTime);
  const stops = Number.isFinite(f.stops) ? f.stops : 0;

  const best = f.bestDeal;

  const bestLine = best
    ? `<div class="best">
         Best: <b>${safeText(best.portal)}</b> • ${money(best.finalPrice)}
         ${best.rawDiscount ? `<div style="opacity:.9;margin-top:4px;">Offer: ${safeText(best.rawDiscount)}</div>` : ""}
         ${best.paymentLabel ? `<div style="opacity:.85;">Payment: <b>${safeText(best.paymentLabel)}</b></div>` : ""}
         ${best.code ? `<div style="opacity:.9;">Code: <b>${safeText(best.code)}</b></div>` : ""}
       </div>`
    : `<div class="best">Best: —</div>`;

  const key = flightKey(f);

  return `
    <div class="card" data-flightkey="${key}">
      <div class="row">
        <div class="air">
          <div>${name}</div>
          <div style="font-size:12px; opacity:0.8; margin-top:2px;">${num}</div>
        </div>
        <div class="times">${dep} → ${arr}</div>
        <div class="stops">${stops} stop(s)</div>
        <div class="price">${money(best?.finalPrice ?? f.price)}</div>
        <button class="infoBtn" title="Compare portal prices" style="margin-left:10px;">👁</button>
      </div>
      ${bestLine}
    </div>
  `;
}

function renderList(el, items) {
  if (!el) return;
  if (!Array.isArray(items) || items.length === 0) {
    el.innerHTML = `<div class="empty">No flights found for your search.</div>`;
    return;
  }
  el.innerHTML = items.map(flightCard).join("");

  el.querySelectorAll(".infoBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      const key = card?.getAttribute("data-flightkey");
      const all = [...(outboundAll || []), ...(returnAll || [])];
      const flight = all.find((x) => flightKey(x) === key);
      showPortalCompare(flight || null);
    });
  });
}

function renderOutbound() {
  const pageItems = slicePage(outboundAll, outPageIdx);
  renderList(outboundList, pageItems);
  renderPager("out");
}

function renderReturn() {
  const pageItems = slicePage(returnAll, retPageIdx);
  renderList(returnList, pageItems);
  renderPager("ret");
}

// ---------- Search ----------
function toggleReturn() {
  const show = !!roundTripRadio?.checked;
  if (!returnInput) return;
  returnInput.disabled = !show;
  returnInput.parentElement?.classList?.toggle("disabled", !show);
}

async function handleSearch(e) {
  e?.preventDefault?.();

  const payload = {
    from: safeText(fromInput?.value, "").trim().toUpperCase(),
    to: safeText(toInput?.value, "").trim().toUpperCase(),
    departureDate: toISO(departInput?.value || ""),
    returnDate: roundTripRadio?.checked ? toISO(returnInput?.value || "") : "",
    tripType: roundTripRadio?.checked ? "round-trip" : "one-way",
    passengers: Number(paxSelect?.value || 1),
    travelClass: cabinSelect?.value || "economy",
    paymentMethods: Array.isArray(selectedPaymentMethods) ? selectedPaymentMethods : [],
  };

  lastSearchPayload = payload;

  if (!payload.from || !payload.to || !payload.departureDate) {
    alert("Please enter From, To and Depart date.");
    return;
  }
  if (payload.tripType === "round-trip" && !payload.returnDate) {
    alert("Please enter Return date for round-trip.");
    return;
  }

  outboundList.innerHTML = `<div class="empty">Loading…</div>`;
  returnList.innerHTML = `<div class="empty">Loading…</div>`;

  outPageIdx = 1;
  retPageIdx = 1;

  try {
    const res = await fetch(`${BACKEND}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    console.log("[SkyDeal] /search meta", json?.meta);

    // ✅ NEW: log offer buckets so you can confirm portal buckets are non-zero immediately
    if (json?.meta?.offers?.byPortal) {
      console.log("[SkyDeal] offers.byPortal", json.meta.offers.byPortal, "unknown:", json?.meta?.offers?.unknownPortalCount);
    }

    if (!res.ok) {
      const msg = json?.meta?.error || `Backend error (${res.status})`;
      outboundAll = [];
      returnAll = [];
      outboundList.innerHTML = `<div class="empty" style="color:#ffb4b4;">${msg}</div>`;
      returnList.innerHTML = `<div class="empty" style="color:#ffb4b4;">${msg}</div>`;
      renderPager("out");
      renderPager("ret");
      return;
    }

    outboundAll = Array.isArray(json?.outboundFlights) ? json.outboundFlights : [];
    returnAll = Array.isArray(json?.returnFlights) ? json.returnFlights : [];

    renderOutbound();
    renderReturn();
  } catch (err) {
    console.error(err);
    outboundAll = [];
    returnAll = [];
    outboundList.innerHTML = `<div class="empty" style="color:#ffb4b4;">Failed to fetch flights (network error).</div>`;
    returnList.innerHTML = `<div class="empty" style="color:#ffb4b4;">Failed to fetch flights (network error).</div>`;
  }
}

// ---------- Wiring ----------
function wire() {
  searchBtn?.addEventListener("click", handleSearch);

  oneWayRadio?.addEventListener("change", toggleReturn);
  roundTripRadio?.addEventListener("change", toggleReturn);
  toggleReturn();

  outPrev?.addEventListener("click", () => {
    outPageIdx = Math.max(1, outPageIdx - 1);
    renderOutbound();
  });
  outNext?.addEventListener("click", () => {
    outPageIdx = Math.min(totalPages(outboundAll), outPageIdx + 1);
    renderOutbound();
  });

  retPrev?.addEventListener("click", () => {
    retPageIdx = Math.max(1, retPageIdx - 1);
    renderReturn();
  });
  retNext?.addEventListener("click", () => {
    retPageIdx = Math.min(totalPages(returnAll), retPageIdx + 1);
    renderReturn();
  });

  paymentBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openPaymentModal();
  });

  pmClose?.addEventListener("click", closePaymentModal);
  paymentModal?.addEventListener("click", (e) => {
    if (e.target === paymentModal) closePaymentModal();
  });

  pmClear?.addEventListener("click", () => {
    selectedPaymentMethods = [];
    updatePaymentButtonLabel();
    renderPaymentList();
  });

  pmDone?.addEventListener("click", () => {
    updatePaymentButtonLabel();
    closePaymentModal();
  });

  renderPager("out");
  renderPager("ret");
}

document.addEventListener("DOMContentLoaded", async () => {
  if (departInput && !departInput.value) departInput.value = "2026-01-15";
  if (returnInput && !returnInput.value) returnInput.value = "2026-01-22";

  await loadPaymentOptions();
  wire();
  updatePaymentButtonLabel();

  console.log("[SkyDeal] frontend ready");
});
