/* =========================
   SkyDeal Frontend — script.js (FULL)
   - Payment modal (Mongo-driven)
   - Search (FlightAPI backend)
   - Pagination
   - Optional sorting
   - Portal comparison popup
   ========================= */
import { AIRPORTS } from "./airports.js";
const BACKEND = "https://skydeal-backend.onrender.com";

const MASTER_PAYMENT_CATALOG = {
  "Credit Card": [
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "SBI",
    "HSBC",
    "Kotak Bank",
    "American Express",
    "IndusInd Bank",
    "IDFC First Bank",
    "AU Bank",
    "Yes Bank",
    "Federal Bank",
    "Bank of Baroda",
    "OneCard",
    "Other Credit Card"
  ],
  "Debit Card": [
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "SBI",
    "HSBC",
    "Kotak Bank",
    "IndusInd Bank",
    "IDFC First Bank",
    "AU Bank",
    "Yes Bank",
    "Federal Bank",
    "Bank of Baroda",
    "Other Debit Card"
  ],
  "Net Banking": [
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "SBI",
    "HSBC",
    "Kotak Bank",
    "IndusInd Bank",
    "IDFC First Bank",
    "AU Bank",
    "Yes Bank",
    "Federal Bank",
    "Bank of Baroda",
    "Other Net Banking"
  ],
  "UPI": [
    "Google Pay",
    "PhonePe",
    "Paytm UPI",
    "CRED",
    "BHIM",
    "Other UPI"
  ],
  "Wallet": [
    "Amazon Pay",
    "Paytm Wallet",
    "Mobikwik",
    "Freecharge",
    "Other Wallet"
  ],
  "EMI": [
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "SBI",
    "HSBC",
    "Kotak Bank",
    "IndusInd Bank",
    "IDFC First Bank",
    "AU Bank",
    "Yes Bank",
    "Federal Bank",
    "Bank of Baroda",
    "Other EMI"
  ]
};
const EMI_TENURE_OPTIONS = [3, 6, 9, 12, 18, 24];

const CARD_NETWORK_OPTIONS = [
  "Visa",
  "Mastercard",
  "RuPay",
  "American Express"
];

const CARD_TYPE_OPTIONS_BY_BANK = {
  "HDFC Bank": [
    "Infinia",
    "Diners Club",
    "Regalia",
    "Millennia",
    "Tata Neu",
    "Swiggy HDFC",
    "Other HDFC Card"
  ],
  "Axis Bank": [
    "Flipkart Axis",
    "Axis Vistara",
    "Axis Atlas",
    "Axis Ace",
    "Axis Neo",
    "Axis Rewards",
    "Other Axis Card"
  ],
  "ICICI Bank": [
    "Amazon Pay ICICI",
    "Coral",
    "Rubyx",
    "Sapphiro",
    "Emeralde",
    "Other ICICI Card"
  ],
  "SBI": [
    "SBI Cashback",
    "SimplyCLICK",
    "SimplySAVE",
    "Prime",
    "Elite",
    "Other SBI Card"
  ],
  "HSBC": [
    "HSBC Cashback",
    "HSBC TravelOne",
    "HSBC Premier",
    "Other HSBC Card"
  ],
  "Kotak Bank": [
    "Kotak White",
    "Myntra Kotak",
    "League",
    "Zen",
    "Other Kotak Card"
  ],
  "American Express": [
    "Membership Rewards",
    "SmartEarn",
    "Gold Card",
    "Platinum Travel",
    "Other Amex Card"
  ],
  "IndusInd Bank": [
    "Legend",
    "Tiger",
    "Pinnacle",
    "Other IndusInd Card"
  ],
  "IDFC First Bank": [
    "Select",
    "Wealth",
    "Classic",
    "Other IDFC First Card"
  ],
  "AU Bank": [
    "Altura",
    "Zenith",
    "Vetta",
    "Other AU Card"
  ],
  "Yes Bank": [
    "Prosperity",
    "Marquee",
    "Other Yes Bank Card"
  ],
  "Federal Bank": [
    "Imperio",
    "Scapia Federal",
    "Other Federal Card"
  ],
  "Bank of Baroda": [
    "BoB Premier",
    "BoB Eterna",
    "Other Bank of Baroda Card"
  ],
  "OneCard": [
    "OneCard"
  ],
  "Other Credit Card": [
    "Other Credit Card"
  ]
};

const DEBIT_CARD_TYPE_OPTIONS_BY_BANK = {
  "HDFC Bank": ["Classic", "Platinum", "EasyShop", "Signature", "Other HDFC Debit Card"],
  "ICICI Bank": ["Classic", "Platinum", "Coral", "Sapphiro", "Other ICICI Debit Card"],
  "Axis Bank": ["Classic", "EasyPay", "Priority", "Burgundy", "Other Axis Debit Card"],
  "SBI": ["Classic", "Global", "Platinum", "Signature", "Other SBI Debit Card"],
  "HSBC": ["Classic", "Platinum", "Other HSBC Debit Card"],
  "Kotak Bank": ["Classic", "811", "Platinum", "Other Kotak Debit Card"],
  "IndusInd Bank": ["Classic", "Signature", "Other IndusInd Debit Card"],
  "IDFC First Bank": ["Classic", "Platinum", "Other IDFC First Debit Card"],
  "AU Bank": ["Classic", "Platinum", "Other AU Debit Card"],
  "Yes Bank": ["Classic", "Platinum", "Other Yes Bank Debit Card"],
  "Federal Bank": ["Classic", "Visa Platinum", "Other Federal Debit Card"],
  "Bank of Baroda": ["Classic", "Platinum", "Other Bank of Baroda Debit Card"],
  "Other Debit Card": ["Other Debit Card"]
};

const CORPORATE_OPTIONS = [
  { label: "Personal", value: false },
  { label: "Corporate", value: true }
];

const UPI_PROVIDER_OPTIONS = [
  "Google Pay",
  "PhonePe",
  "Paytm UPI",
  "CRED",
  "BHIM",
  "Other UPI"
];

// ---------- DOM (match your index.html ids) ----------
const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");
const fromSuggestions = document.getElementById("fromSuggestions");
const toSuggestions = document.getElementById("toSuggestions");
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

// Sort selects
const sortSelectEls = document.querySelectorAll(".sort select");
const outSortSelect = sortSelectEls[0] || null;
const retSortSelect = sortSelectEls[1] || null;

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
// Payment details editor
let editingPaymentIndex = null;

// ---------- State ----------
let paymentOptions = {}; // { "Credit Card":[...], ... }
let activePaymentType = "Credit Card";

// ✅ Backward-compatible richer objects:
// { type, name, provider, network, cardFamily, cardVariant, isCorporate, tenureMonths }
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
function todayISO() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeText(v, def = "—") {
  const s = v == null ? "" : String(v);
  return s.trim() ? s : def;
}
function normalizeLocationText(v) {
  return String(v || "").trim().toLowerCase();
}

function searchLocations(query) {
  const q = normalizeLocationText(query);
  if (!q) return [];

  return AIRPORTS.filter((item) => {
    const hay = [
      item.code,
      item.city,
      item.name,
      ...(item.aliases || [])
    ].join(" ").toLowerCase();

    return hay.includes(q);
  })
  .sort((a, b) => {
    const aStarts = a.city.toLowerCase().startsWith(q);
    const bStarts = b.city.toLowerCase().startsWith(q);
    return bStarts - aStarts;
  })
  .slice(0, 8);
}

function resolveLocationToCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const upper = raw.toUpperCase();
  const exactCode = AIRPORTS.find((x) => x.code === upper);
  if (exactCode) return exactCode.code;

  const lowered = raw.toLowerCase();
  const exactAlias = AIRPORTS.find((x) =>
    [x.city, x.name, ...(x.aliases || [])]
      .filter(Boolean)
      .some((a) => String(a).toLowerCase() === lowered)
  );
  if (exactAlias) return exactAlias.code;

  const partial = searchLocations(raw)[0];
  return partial ? partial.code : upper;
}

function renderLocationSuggestions(inputEl, boxEl, query) {
  if (!boxEl) return;

  const results = searchLocations(query);

  if (!query.trim() || results.length === 0) {
    boxEl.innerHTML = "";
    boxEl.classList.remove("open");
    return;
  }

  boxEl.innerHTML = results.map((item) => `
    <div class="location-option" data-code="${item.code}" data-label="${item.city}">
      <div>
        <div class="location-option-main">${item.city} (${item.code})</div>
<div class="location-option-sub">${item.name}</div>
      </div>
      <div class="location-option-sub">${item.airport}</div>
    </div>
  `).join("");

  boxEl.classList.add("open");

  boxEl.querySelectorAll(".location-option").forEach((el) => {
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const code = el.getAttribute("data-code") || "";
      inputEl.value = code;
      boxEl.classList.remove("open");
      boxEl.innerHTML = "";
    });
  });
}

function wireLocationAutocomplete(inputEl, boxEl) {
  if (!inputEl || !boxEl) return;

  inputEl.addEventListener("input", () => {
    renderLocationSuggestions(inputEl, boxEl, inputEl.value);
  });

  inputEl.addEventListener("focus", () => {
    renderLocationSuggestions(inputEl, boxEl, inputEl.value);
  });

  inputEl.addEventListener("blur", () => {
    setTimeout(() => {
      boxEl.classList.remove("open");
    }, 150);
  });
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
    Number.isFinite(f?.price) ? Math.round(f.price) : "",
  ].join("|");
}

function money(n) {
  if (typeof n === "number" && !isNaN(n)) return `₹${Math.round(n)}`;
  const v = Number(String(n || "").replace(/[^\d.]/g, ""));
  if (!isNaN(v)) return `₹${Math.round(v)}`;
  return "₹0";
}
function getSavingsAmount(basePrice, finalPrice) {
  const b = Number(basePrice);
  const f = Number(finalPrice);
  if (!Number.isFinite(b) || !Number.isFinite(f)) return 0;
  return Math.max(0, Math.round(b - f));
}

function renderBestDealSummary(bestDeal) {
  if (!bestDeal || !bestDeal.applied) return "";

  const savings = getSavingsAmount(bestDeal.basePrice, bestDeal.finalPrice);
  const portal = safeText(bestDeal.portal || "Best portal");
  const finalPrice = money(bestDeal.finalPrice);
  const code = safeText(bestDeal.code || "");
  const payment = bestDeal.paymentLabel ? safeText(prettyPaymentLabel(bestDeal.paymentLabel)) : "";

  return `
    <div class="bestDealBanner">
      <div class="bestDealTopRow">
        <div class="bestDealTop">Best ${finalPrice}</div>
        <div class="bestDealPortal">on ${portal}</div>
      </div>
      ${savings > 0 ? `<div class="bestDealSave">Save ${money(savings)}</div>` : ""}
      ${(payment || code) ? `<div class="bestDealMeta">${payment}${payment && code ? " • " : ""}${code ? `Code: ${code}` : ""}</div>` : ""}
    </div>
  `;
}

function prettyPaymentLabel(label) {
  const s = String(label || "");
  // purely display: normalize emi/upi/wallet to uppercase tokens
  return s
    .replace(/\bemi\b/gi, "EMI")
    .replace(/\bupi\b/gi, "UPI")
    .replace(/\bnetbanking\b/gi, "NetBanking")
    .replace(/\bcreditcard\b/gi, "Credit Card")
    .replace(/\bdebitcard\b/gi, "Debit Card");
}
function getPortalCtaLabel(portal) {
  return `Book on ${safeText(portal)}`;
}

function getOtherOffersButtonLabel(portal) {
  return `More offers on ${safeText(portal)}`;
}

function getOtherOffersHideLabel(portal) {
  return `Hide offers on ${safeText(portal)}`;
}

function getInfoBadgeLabel(io) {
  const raw = String(io?.infoLabel || "").trim().toLowerCase();
  if (raw !== "specific card type required") return safeText(io?.infoLabel, "");

  const title = String(io?.title || "");
  const knownCards = [
    "Flipkart Axis",
    "Amazon Pay ICICI",
    "SBI Cashback",
    "Tata Neu",
    "Infinia",
    "Regalia",
    "Millennia",
    "Axis Atlas",
    "Axis Vistara",
    "Axis Ace",
    "Scapia Federal",
    "SimplyCLICK",
    "SimplySAVE"
  ];

  const found = knownCards.find((k) => title.toLowerCase().includes(k.toLowerCase()));
  return found ? `Needs ${found} credit card` : "Specific card required";
}

function getCompareButtonLabel() {
  return "Compare";
}

function getSortValue(selectEl) {
  const raw = String(selectEl?.value || "").trim().toLowerCase();

  if (!raw) return "price-asc";

  if (
    raw === "price-asc" ||
    raw.includes("cost") ||
    raw.includes("price")
  ) return "price-asc";

  if (
    raw === "departure-asc" ||
    raw.includes("departure")
  ) return "departure-asc";

  if (
    raw === "savings-desc" ||
    raw.includes("saving") ||
    raw.includes("save")
  ) return "savings-desc";

  return "price-asc";
}

function sortFlightsForDisplay(items, sortValue) {
  const arr = Array.isArray(items) ? [...items] : [];

  if (sortValue === "price-asc") {
    return arr.sort((a, b) => Number(a?.bestDeal?.finalPrice ?? a?.price ?? 0) - Number(b?.bestDeal?.finalPrice ?? b?.price ?? 0));
  }

  if (sortValue === "departure-asc") {
    return arr.sort((a, b) => String(a?.departureTime || "").localeCompare(String(b?.departureTime || "")));
  }

  if (sortValue === "savings-desc") {
    return arr.sort((a, b) => {
      const aSave = getSavingsAmount(a?.price, a?.bestDeal?.finalPrice ?? a?.price);
      const bSave = getSavingsAmount(b?.price, b?.bestDeal?.finalPrice ?? b?.price);
      return bSave - aSave;
    });
  }

  return arr;
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
    return `https://flight.yatra.com/air-search-ui/dom2/trigger?flex=0&viewName=normal&source=fresco-flights&type=O&class=${encodeURIComponent(
      cabinLabel
    )}&ADT=${adults}&CHD=0&INF=0&noOfSegments=1&origin=${from}&originCountry=IN&destination=${to}&destinationCountry=IN&flight_depart_date=${flight_depart_date}&arrivalDate=`;
  }

  if (portal === "EaseMyTrip") {
    const fromCity = cityMap(from);
    const toCity = cityMap(to);
    const srch = `${from}-${fromCity}-India|${to}-${toCity}-India|${depDDMMYYYY}`;
    return `https://flight.easemytrip.com/FlightList/Index?srch=${encodeURIComponent(
      srch
    )}&px=${adults}-0-0&cbn=0&ar=undefined&isow=true&isdm=true&lang=en-us&CCODE=IN&curr=INR&apptype=B2C`;
  }

  if (portal === "Cleartrip") {
    const cabinLabel = normalizeCabinLabel(cabinRaw);
    const originText = `${from}%20-%20${encodeURIComponent(cityMap(from))},%20IN`;
    const destText = `${to}%20-%20${encodeURIComponent(cityMap(to))},%20IN`;
    return `https://www.cleartrip.com/flights/results?adults=${adults}&childs=0&infants=0&class=${encodeURIComponent(
      cabinLabel
    )}&depart_date=${encodeURIComponent(depDDMMYYYY)}&from=${from}&to=${to}&intl=n&origin=${originText}&destination=${destText}&return_date=&rnd_one=O&isCfw=false`;
  }

  return null;
}
function buildSelectedPaymentMethod(type, name) {
  const obj = {
    type,
    name,
    provider: null,
    network: null,
    cardFamily: null,
    cardVariant: null,
    isCorporate: null,
    tenureMonths: null
  };

  if (type === "UPI") {
    obj.provider = name;
    obj.name = "UPI";
  }

  return obj;
}

function paymentMethodDisplayLabel(pm) {
  if (!pm) return "—";

  if (pm.type === "UPI") {
    return pm.provider || pm.name || "UPI";
  }

  return pm.name || "—";
}

function getCardTypeOptionsForPaymentMethod(pm) {
  if (!pm) return ["Other Card"];

  if (pm.type === "Credit Card") {
    return CARD_TYPE_OPTIONS_BY_BANK[pm.name] || ["Other Credit Card"];
  }

  if (pm.type === "Debit Card") {
    return DEBIT_CARD_TYPE_OPTIONS_BY_BANK[pm.name] || ["Other Debit Card"];
  }

  return ["Other Card"];
}

function paymentMethodDetailSummary(pm) {
  if (!pm) return "";

  const parts = [];

  if (pm.type === "EMI" && Number.isFinite(pm.tenureMonths)) {
    parts.push(`${pm.tenureMonths} months`);
  }

  if ((pm.type === "Credit Card" || pm.type === "Debit Card") && pm.network) {
    parts.push(pm.network);
  }

  if ((pm.type === "Credit Card" || pm.type === "Debit Card") && pm.cardFamily) {
    parts.push(pm.cardFamily);
  }

  if ((pm.type === "Credit Card" || pm.type === "Debit Card") && pm.isCorporate === true) {
    parts.push("Corporate");
  } else if ((pm.type === "Credit Card" || pm.type === "Debit Card") && pm.isCorporate === false) {
    parts.push("Personal");
  }

  if (pm.type === "UPI" && pm.provider) {
    parts.push(pm.provider);
  }

  return parts.join(" • ");
}

function renderSelectedPaymentMethodsSummary() {
  let host = document.getElementById("selectedPmSummary");

  if (!paymentBtn) return;

  if (!host) {
    host = document.createElement("div");
    host.id = "selectedPmSummary";
    host.style.marginTop = "8px";
    host.style.display = "flex";
    host.style.flexWrap = "wrap";
    host.style.gap = "8px";
    paymentBtn.insertAdjacentElement("afterend", host);
  }

  if (!Array.isArray(selectedPaymentMethods) || selectedPaymentMethods.length === 0) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = selectedPaymentMethods
        .map((pm, idx) => {
      const label = paymentMethodDisplayLabel(pm);
      const detail = paymentMethodDetailSummary(pm);
      const supportsOptionalDetails = ["Credit Card", "Debit Card", "EMI"].includes(pm.type);
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.04);">
          <div style="display:flex;flex-direction:column;line-height:1.1;">
            <span style="font-size:12px;font-weight:600;">${safeText(label)}</span>
            ${detail ? `<span style="font-size:11px;opacity:.75;">${safeText(detail)}</span>` : ""}
          </div>
          ${
            supportsOptionalDetails
              ? `
                <button
                  type="button"
                  class="pm-edit-btn"
                  data-pm-index="${idx}"
                  style="background:transparent;border:0;color:#93c5fd;cursor:pointer;font-size:12px;"
                >
                  ${detail ? "Edit optional details" : "Add optional details"}
                </button>
              `
              : ""
          }
        </div>
      `;
    })
    .join("");

  host.querySelectorAll(".pm-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-pm-index"));
      openPaymentDetailEditor(idx);
    });
  });
}

function ensurePaymentDetailModal() {
  let modal = document.getElementById("pmDetailModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "pmDetailModal";
  modal.className = "modal";
  modal.setAttribute("aria-hidden", "true");
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(0,0,0,.55)";
  modal.style.display = "none";
  modal.style.zIndex = "10001";

  modal.innerHTML = `
    <div style="max-width:520px;margin:8vh auto;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;color:#e5e7eb;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div id="pmDetailTitle" style="font-size:16px;font-weight:700;">Payment details</div>
        <button id="pmDetailClose" type="button" style="background:transparent;border:0;color:#e5e7eb;font-size:20px;cursor:pointer;">×</button>
      </div>

      <div id="pmDetailBody" style="margin-top:14px;"></div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
        <button id="pmDetailCancel" type="button" style="padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#e5e7eb;cursor:pointer;">Cancel</button>
        <button id="pmDetailSave" type="button" style="padding:8px 12px;border-radius:8px;border:0;background:#2563eb;color:#fff;cursor:pointer;">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    editingPaymentIndex = null;
  };

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector("#pmDetailClose").addEventListener("click", close);
  modal.querySelector("#pmDetailCancel").addEventListener("click", close);

  modal.querySelector("#pmDetailSave").addEventListener("click", () => {
    if (editingPaymentIndex == null) return;

    const pm = selectedPaymentMethods[editingPaymentIndex];
    if (!pm) return;

    if (pm.type === "EMI") {
      const tenureEl = document.getElementById("pmDetailTenure");
      pm.tenureMonths = tenureEl && tenureEl.value ? Number(tenureEl.value) : null;
    }

    if (pm.type === "UPI") {
      const providerEl = document.getElementById("pmDetailProvider");
      pm.provider = providerEl && providerEl.value ? providerEl.value : pm.provider || null;
      pm.name = "UPI";
    }

    if (pm.type === "Credit Card" || pm.type === "Debit Card") {
      const networkEl = document.getElementById("pmDetailNetwork");
      const cardTypeEl = document.getElementById("pmDetailCardType");
      const corpEl = document.getElementById("pmDetailCorporate");

      pm.network = networkEl && networkEl.value ? networkEl.value : null;
      pm.cardFamily = cardTypeEl && cardTypeEl.value ? cardTypeEl.value : null;

      if (corpEl && corpEl.value === "true") pm.isCorporate = true;
      else if (corpEl && corpEl.value === "false") pm.isCorporate = false;
      else pm.isCorporate = null;
    }

    renderSelectedPaymentMethodsSummary();
    updatePaymentButtonLabel();
    close();
  });

  return modal;
}

function openPaymentDetailEditor(index) {
  const pm = selectedPaymentMethods[index];
  if (!pm) return;

  editingPaymentIndex = index;

  const modal = ensurePaymentDetailModal();
  const titleEl = modal.querySelector("#pmDetailTitle");
  const bodyEl = modal.querySelector("#pmDetailBody");

  titleEl.textContent = `Details — ${paymentMethodDisplayLabel(pm)}`;

     if (pm.type === "EMI") {
    bodyEl.innerHTML = `
      <div style="opacity:.8;font-size:12px;margin-bottom:12px;">This is optional. Add it only if you want more accurate EMI offer matching.</div>

      <label style="display:block;font-size:13px;margin-bottom:8px;">EMI tenure</label>
      <select id="pmDetailTenure" style="width:100%;padding:10px;border-radius:8px;background:#111827;color:#e5e7eb;border:1px solid rgba(255,255,255,.12);">
        <option value="">Not specified</option>
        ${EMI_TENURE_OPTIONS.map((n) => `<option value="${n}" ${pm.tenureMonths === n ? "selected" : ""}>${n} months</option>`).join("")}
      </select>
    `;
  } else if (pm.type === "UPI") {
    bodyEl.innerHTML = `
      <div style="opacity:.8;font-size:12px;margin-bottom:12px;">This is optional. Add it only if you want more precise UPI-offer matching.</div>

      <label style="display:block;font-size:13px;margin-bottom:8px;">UPI provider</label>
      <select id="pmDetailProvider" style="width:100%;padding:10px;border-radius:8px;background:#111827;color:#e5e7eb;border:1px solid rgba(255,255,255,.12);">
        ${UPI_PROVIDER_OPTIONS.map((name) => `<option value="${name}" ${pm.provider === name || paymentMethodDisplayLabel(pm) === name ? "selected" : ""}>${name}</option>`).join("")}
      </select>
    `;
    } else if (pm.type === "Credit Card" || pm.type === "Debit Card") {
    const cardTypeOptions = getCardTypeOptionsForPaymentMethod(pm);

    bodyEl.innerHTML = `
      <div style="opacity:.8;font-size:12px;margin-bottom:12px;">All details below are optional.</div>

      <label style="display:block;font-size:13px;margin-bottom:8px;">Card network</label>
      <select id="pmDetailNetwork" style="width:100%;padding:10px;border-radius:8px;background:#111827;color:#e5e7eb;border:1px solid rgba(255,255,255,.12);margin-bottom:14px;">
        <option value="">Not specified</option>
        ${CARD_NETWORK_OPTIONS.map((name) => `<option value="${name}" ${pm.network === name ? "selected" : ""}>${name}</option>`).join("")}
      </select>

      <label style="display:block;font-size:13px;margin-bottom:8px;">Card type / card family</label>
      <select id="pmDetailCardType" style="width:100%;padding:10px;border-radius:8px;background:#111827;color:#e5e7eb;border:1px solid rgba(255,255,255,.12);margin-bottom:14px;">
        <option value="">Not specified</option>
        ${cardTypeOptions.map((name) => `<option value="${name}" ${pm.cardFamily === name ? "selected" : ""}>${name}</option>`).join("")}
      </select>

      <label style="display:block;font-size:13px;margin-bottom:8px;">Personal vs corporate</label>
      <select id="pmDetailCorporate" style="width:100%;padding:10px;border-radius:8px;background:#111827;color:#e5e7eb;border:1px solid rgba(255,255,255,.12);">
        <option value="" ${pm.isCorporate == null ? "selected" : ""}>Not specified</option>
        ${CORPORATE_OPTIONS.map((opt) => `<option value="${opt.value}" ${pm.isCorporate === opt.value ? "selected" : ""}>${opt.label}</option>`).join("")}
      </select>
    `;
  } else {
    bodyEl.innerHTML = `<div style="opacity:.8;">No extra details available for this payment method yet.</div>`;
  }

  modal.style.display = "block";
  modal.setAttribute("aria-hidden", "false");
}

function updatePaymentButtonLabel() {
  const n = selectedPaymentMethods.length;
  if (pmCount) pmCount.textContent = String(n);
  if (paymentBtn) paymentBtn.textContent = `Payment methods (${n})`;
  renderSelectedPaymentMethodsSummary();
}
function formatTermsForDisplay(terms) {
  if (!terms) return "";

  if (typeof terms === "string") {
    return terms.trim();
  }

  if (typeof terms === "object") {
    const parts = [];

    if (terms.raw && String(terms.raw).trim()) {
      parts.push(String(terms.raw).trim());
    }

    if (Array.isArray(terms.highlights) && terms.highlights.length) {
      parts.push("Highlights:\n- " + terms.highlights.join("\n- "));
    }

    if (Array.isArray(terms.exclusions) && terms.exclusions.length) {
      parts.push("Exclusions:\n- " + terms.exclusions.join("\n- "));
    }

    if (Array.isArray(terms.stepsToRedeem) && terms.stepsToRedeem.length) {
      parts.push("How to use:\n- " + terms.stepsToRedeem.join("\n- "));
    }

    if (Array.isArray(terms.paymentConditions) && terms.paymentConditions.length) {
      parts.push("Payment conditions:\n- " + terms.paymentConditions.join("\n- "));
    }

    if (Array.isArray(terms.routeOrAirlineRestrictions) && terms.routeOrAirlineRestrictions.length) {
      parts.push("Route / airline restrictions:\n- " + terms.routeOrAirlineRestrictions.join("\n- "));
    }

    if (Array.isArray(terms.bookingChannel) && terms.bookingChannel.length) {
      parts.push("Booking channels:\n- " + terms.bookingChannel.join("\n- "));
    }

    return cleanTermsText(parts.join("\n\n").trim());
  }

  return "";
}
function cleanTermsText(text) {
  if (!text) return "";

  let t = String(text);

  // -------------------------
  // Remove noisy references
  // -------------------------
  t = t.replace(/\btable above\b/gi, "");
  t = t.replace(/\baforementioned\b/gi, "");
  t = t.replace(/\bas mentioned\b/gi, "");
  t = t.replace(/\bas per table\b/gi, "");
  t = t.replace(/\bas per aforementioned table\b/gi, "");

  // -------------------------
  // Fix common broken phrases
  // -------------------------
  t = t.replace(/\bin the on\b/gi, "on");
  t = t.replace(/\bmust enter E\b/gi, "must enter the e-coupon");
  t = t.replace(/\bCoupon as per table in the E\b/gi, "coupon in the e-coupon");
  t = t.replace(/\bCoupon field\b/gi, "coupon field");
  t = t.replace(/\bMulti\s*•\s*City\b/gi, "Multi-City");
  t = t.replace(/\b3rd party\b/gi, "third-party");
  t = t.replace(/\bPay Pal\b/gi, "PayPal");
  t = t.replace(/\bGift card\b/gi, "gift card");
  t = t.replace(/\bnet banking\b/gi, "net banking");
  t = t.replace(/\bMy Wallet\b/gi, "My Wallet");
  t = t.replace(/\bcommercial cards\b/gi, "commercial cards");

  // -------------------------
  // Fix broken quoted phrases
  // -------------------------
  t = t.replace(/"Multi\s*City Flights"/gi, '"Multi-City Flights"');
  t = t.replace(/"Multi\s*City"/gi, '"Multi-City"');

  // -------------------------
  // Fix line-broken fragments
  // -------------------------
  t = t.replace(/([a-z])\s*\n\s*([a-z])/g, "$1 $2");
  t = t.replace(/([A-Za-z])\s*\n\s*-\s*/g, "$1\n• ");
  t = t.replace(/\n{3,}/g, "\n\n");

  // -------------------------
  // Normalize headings
  // -------------------------
  t = t.replace(/\bExclusions:\b/gi, "\n\nExclusions:");
  t = t.replace(/\bHow to use:\b/gi, "\n\nHow to use:");
  t = t.replace(/\bRoute ?\/ ?airline restrictions:\b/gi, "\n\nRoute / airline restrictions:");
  t = t.replace(/\bBooking channels:\b/gi, "\n\nBooking channels:");

  // -------------------------
  // Convert dash bullets to dots
  // -------------------------
  t = t.replace(/^\s*-\s*/gm, "• ");
  t = t.replace(/^\s*•\s*/gm, "• ");

  // -------------------------
  // Collapse ugly spaces
  // -------------------------
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/ \./g, ".");
  t = t.replace(/\s+,/g, ",");
  t = t.replace(/\s+:/g, ":");
  t = t.replace(/\(\s+/g, "(");
  t = t.replace(/\s+\)/g, ")");

  // -------------------------
  // Targeted sentence repairs
  // -------------------------
  t = t.replace(
    /Customers will get instant discount on HSBC Bank Credit Cards\./gi,
    "Customers will get an instant discount on HSBC Bank Credit Cards."
  );

  t = t.replace(
    /To avail the offer, customer must enter the e-coupon coupon in the e-coupon coupon field\./gi,
    "To avail the offer, the customer must enter the e-coupon in the coupon field."
  );

  t = t.replace(
    /The offer is not valid on "Multi-City Flights" made through the "Multi-City" tab on MakeMyTrip website\./gi,
    'The offer is not valid on "Multi-City Flights" made through the "Multi-City" tab on the MakeMyTrip website.'
  );

  // -------------------------
  // Final trim
  // -------------------------
  t = t.trim();

  return t;
}
/* =========================
   Offer line formatter + T&C modal
   ========================= */
function formatOfferLine(p) {
  if (!p.applied) {
    return `<div style="opacity:.65;font-size:13px;">No offer available</div>`;
  }

const offerText = safeText(p.rawDiscount, "Offer available");
const codeText = p.code
  ? ` • <button
        type="button"
        class="copyCouponBtn inlineCopyCouponBtn"
        data-code="${safeText(p.code)}"
        title="Copy coupon code"
      >Code: ${safeText(p.code)}</button>`
  : "";
const termsText = formatTermsForDisplay(p.terms);
const hasTerms = !!termsText;

const tncBtn = hasTerms
  ? ` • <button 
        type="button"
        class="tncBtn"
        data-portal="${safeText(p.portal)}"
        data-terms="${encodeURIComponent(termsText)}"
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

  const pay = p.paymentLabel ? prettyPaymentLabel(p.paymentLabel) : "";
  const showTypeLabel =
  p.offerTypeLabel &&
  String(p.offerTypeLabel).trim().toLowerCase() !== "payment offer";

const typeLine = showTypeLabel
  ? `<div style="opacity:.85;margin-top:4px;">Type: <b>${safeText(p.offerTypeLabel)}</b></div>`
  : "";
  const channelLine = p.channelLabel
    ? `<div style="opacity:.85;margin-top:4px;">Channel: <b>${safeText(p.channelLabel)}</b></div>`
    : "";

  return `
    <div style="opacity:.85;font-size:13px;">
      Offer: ${offerText}${codeText}
      ${pay ? `<div style="opacity:.85;margin-top:4px;">Payment: <b>${safeText(pay)}</b></div>` : ""}
      ${typeLine}
      ${channelLine}
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

// One global delegated click handler for all T&C buttons
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
  const finalTypes = [...ordered.filter((t) => types.includes(t)), ...types.filter((t) => !ordered.includes(t))];

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
  return selectedPaymentMethods.some((x) => x.type === type && x.name.toLowerCase().trim() === name.toLowerCase().trim());
}

function toggleSelected(type, name, checked) {
  const t = type;
  const n = name;

  if (checked) {
    if (!isSelected(t, n)) selectedPaymentMethods.push(buildSelectedPaymentMethod(t, n));
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
  const list = [...new Set(raw.map((x) => String(x || "").trim()).filter(Boolean))];

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

  const u = s.toUpperCase();

  if (u.includes("FLIPKART") && u.includes("AXIS")) return "Flipkart Axis Bank";
  if (u.includes("AMAZON") && u.includes("ICICI")) return "Amazon Pay ICICI Bank";

  if (u === "AXIS" || u === "AXIS BANK") return "Axis Bank";
  if (u === "HDFC" || u === "HDFC BANK") return "HDFC Bank";
  if (u === "ICICI" || u === "ICICI BANK") return "ICICI Bank";
  if (u === "HSBC" || u === "HSBC BANK" || u === "HSBC CREDIT") return "HSBC";
  if (u === "SBI" || u === "STATE BANK OF INDIA") return "SBI";
  if (u === "KOTAK" || u === "KOTAK BANK" || u === "KOTAK MAHINDRA BANK" || u === "KOTAK BANK LTD") return "Kotak Bank";
  if (u === "YES" || u === "YES BANK" || u === "YES BANK LTD") return "Yes Bank";
  if (u === "RBL" || u === "RBL BANK" || u === "RBL BANK LTD") return "RBL Bank";
  if (u === "FEDERAL" || u === "FEDERAL BANK" || u === "FEDERAL BANK LTD") return "Federal Bank";
  if (u === "IDFC FIRST" || u === "IDFC FIRST BANK" || u === "IDFC FIRST BANK LTD" || u === "IDFC") return "IDFC First Bank";
  if (u === "AU" || u === "AU BANK" || u === "AU SMALL FINANCE BANK" || u === "AU SMALL BANK") return "AU Bank";
  if (u === "BOB" || u === "BANK OF BARODA" || u === "BOBCARD" || u === "BOBCARD LTD") return "Bank of Baroda";
  if (u === "AMERICAN EXPRESS" || u === "AMEX") return "American Express";
  if (u === "ONE" || u === "ONECARD" || u === "ONE CARD") return "OneCard";
  if (u === "CENTRAL BANK OF INDIA") return "Central Bank of India";
  if (u === "CANARA BANK") return "Canara Bank";
  if (u === "J&K BANK" || u === "J AND K BANK") return "J&K Bank";
  if (u === "BANK OF INDIA") return "Bank of India";
  if (u === "DBS") return "DBS";
  if (u === "RUPAY") return "RuPay";

  return s
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
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

function mergeMasterCatalogWithBackend(backendOptions) {
  const merged = {};
  const allTypes = new Set([
    ...Object.keys(MASTER_PAYMENT_CATALOG || {}),
    ...Object.keys(backendOptions || {})
  ]);

  for (const type of allTypes) {
    const masterList = Array.isArray(MASTER_PAYMENT_CATALOG[type]) ? MASTER_PAYMENT_CATALOG[type] : [];
    const backendList = Array.isArray(backendOptions?.[type]) ? backendOptions[type] : [];

    const combined = [...masterList, ...backendList];
    const seen = new Set();
    let finalList = [];

    for (const raw of combined) {
      const name = normalizePmNameForUI(raw);
      const key = name.toLowerCase();

      if (!name) continue;
      if (!seen.has(key)) {
        seen.add(key);
        finalList.push(name);
      }
    }

    // ✅ NEW: alphabetical sorting (case-insensitive, clean UX)
    finalList.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    merged[type] = finalList;
  }

  return merged;
}

async function loadPaymentOptions() {
  try {
    const res = await fetch(`${BACKEND}/payment-options`);
    const text = await res.text();

    if (!res.ok) {
      console.error("payment-options failed:", res.status, text);
      throw new Error(`payment-options failed: ${res.status}`);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("payment-options returned non-JSON:", text);
      throw e;
    }

    const backendOptions = dedupePaymentOptions(data?.options || {});
    paymentOptions = mergeMasterCatalogWithBackend(backendOptions);

    for (const k of Object.keys(paymentOptions)) {
      const arr = Array.isArray(paymentOptions[k]) ? paymentOptions[k] : [];
      const seen = new Set();
      paymentOptions[k] = arr.filter((name) => {
        const norm = String(name || "").trim().toLowerCase();
        if (!norm) return false;
        if (seen.has(norm)) return false;
        seen.add(norm);
        return true;
      });
    }

    if (!paymentOptions[activePaymentType]) {
      const keys = Object.keys(paymentOptions);
      activePaymentType = keys[0] || "Credit Card";
    }

    renderPaymentTabs();
    updatePaymentButtonLabel();
  } catch (e) {
    console.error("[SkyDeal] payment-options failed", e);

    // Safe fallback: still show master catalog even if backend call fails
    paymentOptions = mergeMasterCatalogWithBackend({});
    renderPaymentTabs();
    updatePaymentButtonLabel();
  }
}

// ---------- Flight Results Rendering + Pagination ----------
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

function ensurePortalModal() {
  let modal = document.getElementById("portalCompareModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "portalCompareModal";
  modal.className = "modal";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(0,0,0,.55)";
  modal.style.display = "none";
  modal.style.zIndex = "9999";

  modal.innerHTML = `
    <div class="portalModalShell">
      <div class="portalModalCard">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div style="font-size:16px;font-weight:700;">Portal price comparison</div>
          <button id="portalCompareClose" type="button" style="background:transparent;border:0;color:#e5e7eb;font-size:20px;cursor:pointer;">×</button>
        </div>
        <div id="portalCompareBody" style="margin-top:12px;"></div>
      </div>
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
  const bestPortal = flight?.bestDeal?.portal || null;

  console.log("[SkyDeal] portalPrices for clicked flight:", portalPrices);

  if (portalPrices.length === 0) {
    body.innerHTML = `<div style="opacity:.85;">No portal price data available.</div>`;
  } else {
    body.innerHTML = `
      <div class="portalCompareFlightHead">
        ${safeText(flight.airlineName)} (${displayFlightNumber(flight)}) • ${fmtTime(flight.departureTime)} → ${fmtTime(flight.arrivalTime)}
      </div>

      <div class="portalCompareList">
        ${portalPrices
          .map((p) => {
            const href = buildPortalSearchUrl(p.portal, lastSearchPayload);
            const isBest = bestPortal && p.portal === bestPortal;

            const infoOffersHtml =
  Array.isArray(p.infoOffers) && p.infoOffers.length > 0
    ? (() => {
        const portalSlug = String(p.portal || "portal")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");

        const renderOfferCard = (io) => `
          <div class="otherOfferItem">
            <div class="otherOfferHead">
              <b>${safeText(io.title || io.couponCode || "Offer")}</b>
              ${io.infoLabel ? `<span class="otherOfferBadge">${safeText(getInfoBadgeLabel(io))}</span>` : ""}
            </div>
            ${io.paymentHint ? `<div class="otherOfferHint">${safeText(io.paymentHint)}</div>` : ""}
            ${io.rawDiscount ? `<div class="otherOfferDiscount">${safeText(io.rawDiscount)}</div>` : ""}
            <div class="otherOfferActions">
              ${
                io.couponCode
                  ? `
                    <button
                      type="button"
                      class="copyCouponBtn"
                      data-code="${safeText(io.couponCode, "")}"
                      title="Copy coupon code"
                    >
                      Copy code: ${safeText(io.couponCode)}
                    </button>
                  `
                  : ""
              }
              ${
                io.terms
                  ? `
                    <button
  type="button"
  class="tncBtn altTncBtn"
                      data-portal="${safeText(p.portal)}"
                      data-terms="${encodeURIComponent(formatTermsForDisplay(io.terms))}"
                    >
                      T&C
                    </button>
                  `
                  : ""
              }
            </div>
          </div>
        `;

        return `
          <div class="otherOffersInline">
            <button
              type="button"
              class="otherOffersInlineBtn"
              data-target="portal-other-offers-${portalSlug}"
              data-state="closed"
              data-show-label="${getOtherOffersButtonLabel(p.portal)}"
              data-hide-label="${getOtherOffersHideLabel(p.portal)}"
            >
              ${getOtherOffersButtonLabel(p.portal)}
            </button>

            <div id="portal-other-offers-${portalSlug}" class="otherOffersDrawer">
              <div class="otherOffersTitle">More offers on ${safeText(p.portal)}</div>
              <div class="otherOffersMore open">
                ${p.infoOffers.map(renderOfferCard).join("")}
              </div>
            </div>
          </div>
        `;
      })()
    : "";

            return `
              <div class="portalRow ${isBest ? "best" : ""}">
                <div class="portalHeader">
<div class="portalHeaderLeft">
  <div class="portalName">${safeText(p.portal)}</div>
  ${isBest ? `<span class="badge bestPriceBadge">Best price</span>` : ""}
  ${
    href
      ? `<a href="${href}" target="_blank" rel="noopener noreferrer" class="badge portalLinkBadge" style="text-decoration:none;">${getPortalCtaLabel(p.portal)}</a>`
      : ""
  }
</div>
                  <div class="portalPrice">${money(p.finalPrice ?? p.basePrice ?? flight?.price)}</div>
                </div>

                <div class="mainOffer">
                  ${formatOfferLine(p)}
                </div>

                ${infoOffersHtml}
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  modal.style.display = "block";

    body.querySelectorAll(".otherOffersInlineBtn").forEach((btn) => {
  btn.onclick = () => {
    const targetId = btn.getAttribute("data-target");
    const state = btn.getAttribute("data-state");
    const box = body.querySelector(`#${targetId}`);
    if (!box) return;

    const isClosed = state === "closed";
    box.classList.toggle("open", isClosed);
    btn.setAttribute("data-state", isClosed ? "open" : "closed");
    btn.textContent = isClosed
      ? (btn.getAttribute("data-hide-label") || "Hide more offers")
      : (btn.getAttribute("data-show-label") || "More offers");
  };
});

  body.querySelectorAll(".copyCouponBtn").forEach((btn) => {
    btn.onclick = async () => {
      const code = btn.getAttribute("data-code") || "";
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code);
        const oldText = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = oldText;
        }, 1200);
      } catch {
        const oldText = btn.textContent;
        btn.textContent = "Copy failed";
        setTimeout(() => {
          btn.textContent = oldText;
        }, 1200);
      }
    };
  });
}

function flightCard(f) {
  const name = safeText(f.airlineName);
  const num = displayFlightNumber(f);
  const dep = fmtTime(f.departureTime);
  const arr = fmtTime(f.arrivalTime);
  const stops = Number.isFinite(f.stops) ? f.stops : 0;

  const best = f.bestDeal;

    const bestLine = best
    ? renderBestDealSummary(best)
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
                <div class="price">${money(f.price)}</div>
        <button class="infoBtn" title="Compare portal prices" style="margin-left:10px;">${getCompareButtonLabel()}</button>
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
  const sorted = sortFlightsForDisplay(outboundAll, getSortValue(outSortSelect));
  const pageItems = slicePage(sorted, outPageIdx);
  renderList(outboundList, pageItems);
  renderPager("out");
}

function renderReturn() {
  const sorted = sortFlightsForDisplay(returnAll, getSortValue(retSortSelect));
  const pageItems = slicePage(sorted, retPageIdx);
  renderList(returnList, pageItems);
  renderPager("ret");
}

// ---------- Search ----------
function toggleReturn() {
  const show = !!roundTripRadio?.checked;
  if (!returnInput) return;

  const departVal = departInput?.value || todayISO();
  returnInput.disabled = !show;
  returnInput.parentElement?.classList?.toggle("disabled", !show);

  returnInput.min = departVal;

  if (show) {
    if (!returnInput.value || returnInput.value < departVal) {
      returnInput.value = addDaysISO(departVal, 7);
    }
  }
}

async function handleSearch(e) {
  e?.preventDefault?.();

  const payload = {
    from: resolveLocationToCode(safeText(fromInput?.value, "").trim()),
to: resolveLocationToCode(safeText(toInput?.value, "").trim()),
    departureDate: toISO(departInput?.value || ""),
    returnDate: roundTripRadio?.checked ? toISO(returnInput?.value || "") : "",
    tripType: roundTripRadio?.checked ? "round-trip" : "one-way",
    passengers: Number(paxSelect?.value || 1),
    travelClass: cabinSelect?.value || "economy",

    // ✅ send structured selections so backend can match bank/type correctly
    paymentMethods: Array.isArray(selectedPaymentMethods) ? selectedPaymentMethods : [],
  };

  lastSearchPayload = payload;
  console.log("[SkyDeal] payload.paymentMethods", payload.paymentMethods);

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

    if (!res.ok) {
      const msg = json?.meta?.error || `Backend error (${res.status})`;
      outboundAll = [];
      returnAll = [];
      outboundList.innerHTML = `<div class="empty" style="color:#ffb4b4;">${msg}</div>`;
      returnList.innerHTML = `<div class="empty" style="color:#ffb4b4;">${msg}</div>`;
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
departInput?.addEventListener("change", toggleReturn);
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
outSortSelect?.addEventListener("change", () => {
  outPageIdx = 1;
  renderOutbound();
});

retSortSelect?.addEventListener("change", () => {
  retPageIdx = 1;
  renderReturn();
});
  renderPager("out");
  renderPager("ret");
}

document.addEventListener("DOMContentLoaded", async () => {
  const today = todayISO();
const defaultReturn = addDaysISO(today, 7);

if (departInput) {
  departInput.min = today;
  if (!departInput.value) departInput.value = today;
}

if (returnInput) {
  returnInput.min = today;
  if (!returnInput.value) returnInput.value = defaultReturn;
}

  await loadPaymentOptions();
wire();
wireLocationAutocomplete(fromInput, fromSuggestions);
wireLocationAutocomplete(toInput, toSuggestions);
updatePaymentButtonLabel();

  console.log("[SkyDeal] frontend ready");
});

