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

// No explicit "country" field exists on AIRPORTS entries (see airports.js -
// a worldwide dataset with no country property), so domestic-vs-
// international is determined by an explicit IATA code list instead of
// guessing from name/city text. Merges the original 37-airport curated
// list (airports.js lines 2-38) with skydeal-backend's INDIAN_IATA_AIRPORTS
// set (index.js) so codes present in only one of the two are still covered.
const INDIAN_IATA_CODES = new Set([
  "DEL","BOM","BLR","MAA","HYD","CCU","PNQ","AMD","GOI","GOX","COK","TRV",
  "IXC","JAI","LKO","PAT","RPR","NAG","IXR","IXB","BDQ","STV","IDR","BHO",
  "CJB","TRZ","IXM","TIR","VTZ","VGA","GAU","IMF","IXZ","SXR","IXJ","DED",
  "IXD","ATQ","BBI","BHU","CCJ","DMU","GOP","GWL","HBX","IXA","IXE","IXG",
  "IXL","IXS","IXU","JDH","JGA","JLR","JRG","JSA","IXY","JGB","KNU","MYQ",
  "RJA","SAG","SLV","SXV","UDR","VNS","PNY","AGX","DIB","SHL","AIP","NDC",
  "RDP","JRH","TEZ","TCR","COH","DHM","KUU","LEH","SBI","BEP","HJR","JLG",
  "AJL","IXK","ISK","NMI"
]);

// A few popular Indian cities shown by default when a From/To box is
// clicked/focused with nothing typed yet - matches MMT's "recent
// searches" panel, except SkyDeal has no search history to draw on, so
// this is a fixed shortlist instead.
const POPULAR_CITY_CODES = ["BOM", "DEL", "BLR", "MAA"];

/**
 * fetch() with a client-side safety-net timeout.
 *
 * The backend can legitimately take up to ~40s in the worst case (FlightAPI
 * retries), so the default here (60s) is deliberately LONGER than that — it
 * only fires on a genuine hang (dead connection, proxy that never responds),
 * never on a slow-but-working search. On abort it throws an Error whose
 * message contains "timed out", which renderSearchErrorState already handles.
 * A caller-supplied signal is not expected on any current call site.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

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
    "MobiKwik",
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

function openNativeDatePicker(input) {
  if (!input || input.disabled) return;
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch (err) {
      // Ignore - e.g. not triggered by a user gesture, or unsupported browser.
    }
  }
}

departInput?.addEventListener("click", () => openNativeDatePicker(departInput));
returnInput?.addEventListener("click", () => openNativeDatePicker(returnInput));

function syncReturnDateVisualState() {
  if (!returnInput) return;

  const wrap =
    returnInput.closest(".field") ||
    returnInput.closest(".form-field") ||
    returnInput.closest("label") ||
    returnInput.parentElement;

  const isRoundTrip = !!roundTripRadio?.checked;
  const isFocused = document.activeElement === returnInput;
  // Keep Return visually muted by default. It becomes normal only when round-trip is active or the field is focused.
  const isActive = isRoundTrip || isFocused;
  const isDimmed = !isActive;

  document.body.classList.toggle("sky-return-date-dimmed", isDimmed);
  document.body.classList.toggle("sky-return-date-active", isActive);

  if (wrap) {
    wrap.classList.toggle("return-date-dimmed", isDimmed);
    wrap.classList.toggle("return-date-active", isActive);
  }

  returnInput.classList.toggle("return-date-input-dimmed", isDimmed);
  returnInput.classList.toggle("return-date-input-active", isActive);
}

function activateRoundTripFromReturnDate() {
  if (roundTripRadio && !roundTripRadio.checked) {
    roundTripRadio.checked = true;
    const oneWayRadio = document.getElementById("oneWay");
    if (oneWayRadio) oneWayRadio.checked = false;
  }
  syncReturnDateVisualState();
}

const searchBtn = document.getElementById("searchBtn");

const outboundList = document.getElementById("outboundList");
const returnList = document.getElementById("returnList");

returnInput?.addEventListener("focus", activateRoundTripFromReturnDate);
returnInput?.addEventListener("click", activateRoundTripFromReturnDate);
returnInput?.addEventListener("change", () => {
  activateRoundTripFromReturnDate();
  syncReturnDateVisualState();
});
roundTripRadio?.addEventListener("change", syncReturnDateVisualState);
document.getElementById("oneWay")?.addEventListener("change", syncReturnDateVisualState);
setTimeout(syncReturnDateVisualState, 0);


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
let paymentOfferCounts = {}; // { "Credit Card": { "HDFC Bank": 3, ... }, ... } — how many live offers back each entry
let activePaymentType = "Credit Card";
let includeEmiOffers = false;

// ✅ Backward-compatible richer objects:
// { type, name, provider, network, cardFamily, cardVariant, isCorporate, tenureMonths }
let selectedPaymentMethods = [];

let outboundAll = [];
let returnAll = [];
let lastSearchPayload = null;

// Phase 1 intelligent payment guide state.
let paymentGuideState = "idle"; // idle | loading | ready | error
let paymentSuggestions = [];
const dismissedSuggestionKeys = new Set(); // cleared only on a brand-new search

// Phase 3 - timing insights from the same /payment-suggestions response
// (at most one "urgent" + one "future", see backend PAYMENT_TIMING_CONFIG).
// Rendered as a small, separate section - never replaces the Phase 1/2
// suggestion/optimised/success states above it.
let paymentTimingInsights = [];

// After the user accepts a suggestion, the automatic recommendation loop
// stops (no auto re-fetch) until they explicitly click "Check for more
// options" - see applyPaymentSuggestion/renderPaymentGuideCard.
let guideAwaitingManualRecheck = false;
let guideAcceptedNote = null; // { heading, message, previousBestPrice, newBestPrice, flightsImproved } - transient success banner
let guideAcceptedNoteTimer = null;

// Phase 2 - the backend's own summary from the most recent
// /payment-suggestions response (selectedPaymentMethodCount,
// matchedOfferCount, isOptimised), used to enrich the "already optimised"
// state. Backend-authoritative; not recomputed client-side.
let lastGuideSummary = null;
let lastGuideCurrentBestPrice = null;
// meta.truncated from /payment-suggestions - true when the backend's
// candidate-evaluation loop hit its time budget before testing every
// candidate. When this is true and nothing cleared the savings bar,
// the "already optimised" claim would be dishonest (the check never
// actually finished) - renderGuideOptimisedHtml() softens its copy
// accordingly instead of asserting a confident conclusion.
let lastGuideTruncated = false;

// Phase 2 - a small running summary of this search's guide activity
// (item 10). Reset on every new search; updated as suggestions are
// accepted or the user manually re-checks. Not fully surfaced in the UI
// yet (today's States only need per-event data), kept so future states
// can show session-wide totals without new plumbing.
let guideSearchSummary = null;

function resetGuideSearchSummary(initialBestPrice) {
  guideSearchSummary = {
    initialBestPrice,
    currentBestPrice: initialBestPrice,
    totalSavingAchieved: 0,
    methodsAddedViaGuide: [],
    flightsImprovedTotal: 0,
    manuallyCheckedForMore: false
  };
}

// Round-trip manual selection state.
// This is frontend-only for now; backend comparison will be connected in the next step.
let selectedOutboundFlight = null;
let selectedReturnFlight = null;
let selectedTripComparison = null;
let selectedTripComparisonError = "";
let selectedTripComparisonKey = "";
let selectedTripCompareLoading = false;

let activeFilters = {
  nonStop: false,
  bestOffer: false,
  timeSlots: [],
  airlines: []
};

const PAGE_SIZE = 20;

let outPageIdx = 1;
let retPageIdx = 1;

// Which leg is showing in the mobile round-trip tab toggle ("out" | "ret").
let mobileRoundTripActiveLeg = "out";

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
    // Domestic (Indian) results outrank international ones outright, even
    // if an international city name happens to match the typed text more
    // literally (e.g. typing "BOM" should surface Mumbai before "Bom Jesus
    // Da Lapa") - only within the same domestic/international group does
    // an exact city-prefix match break the tie.
    const aIndia = INDIAN_IATA_CODES.has(String(a.code || "").toUpperCase());
    const bIndia = INDIAN_IATA_CODES.has(String(b.code || "").toUpperCase());
    if (aIndia !== bIndia) return aIndia ? -1 : 1;

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

function cityNameForCode(code) {
  const upper = String(code || "").trim().toUpperCase();
  if (!upper) return "";
  const match = AIRPORTS.find((x) => x.code === upper);
  return match?.city || upper;
}

function popularCitySuggestions() {
  return POPULAR_CITY_CODES
    .map((code) => AIRPORTS.find((a) => a.code === code))
    .filter(Boolean);
}

function renderLocationSuggestions(inputEl, boxEl, query) {
  if (!boxEl) return;

  // Nothing typed yet: show a small default shortlist (MMT shows recent
  // searches here; SkyDeal has no search history to draw on, so a fixed
  // popular-cities list stands in for it) instead of an empty dropdown.
  const results = query.trim() ? searchLocations(query) : popularCitySuggestions();

  if (results.length === 0) {
    boxEl.innerHTML = "";
    boxEl.classList.remove("open");
    return;
  }

  boxEl.innerHTML = results.map((item) => {
    const city = safeText(item.city || item.code || "");
    const code = safeText(item.code || "");
    const airportName = safeText(item.name || "");

    return `
      <div class="location-option" data-code="${code}" data-label="${city}">
        <div>
          <div class="location-option-main">${city} (${code})</div>
          ${airportName ? `<div class="location-option-sub">${airportName}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

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

// One-click "Popular routes" pills shown on the pre-search empty state -
// fills From/To and runs the search immediately, same as MMT's "recent
// searches" quick-pick behavior, since SkyDeal has no search history of
// its own to show instead.
function wirePopularRoutes() {
  document.querySelectorAll(".popular-route-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const from = btn.getAttribute("data-from") || "";
      const to = btn.getAttribute("data-to") || "";
      if (!from || !to || !fromInput || !toInput) return;

      fromInput.value = from;
      toInput.value = to;
      handleSearch();
    });
  });
}

function fmtTime(t) {
  if (!t) return "—";
  const s = String(t);
  if (s.includes("T")) return s.split("T")[1]?.slice(0, 5) || s;
  return s;
}

const AIRLINE_CODE_MAP = [
  // Indian domestic carriers
  { k: "indigo", c: "6E" },
  { k: "air india express", c: "IX" },
  { k: "air india", c: "AI" },
  { k: "akasa", c: "QP" },
  { k: "spicejet", c: "SG" },
  { k: "vistara", c: "UK" },
  { k: "go first", c: "G8" },
  // International carriers - needed so a mixed-carrier (interline) itinerary's
  // later segments get a proper "CODE NUM" too, not just the first (Indian)
  // leg. See CURRENT_BUGS.md item O.
  { k: "cathay pacific", c: "CX" },
  { k: "qatar airways", c: "QR" },
  { k: "american airlines", c: "AA" },
  { k: "emirates", c: "EK" },
  { k: "etihad", c: "EY" },
  { k: "british airways", c: "BA" },
  { k: "lufthansa", c: "LH" },
  { k: "air france", c: "AF" },
  { k: "klm", c: "KL" },
  { k: "swiss", c: "LX" },
  { k: "turkish airlines", c: "TK" },
  { k: "singapore airlines", c: "SQ" },
  { k: "thai airways", c: "TG" },
  { k: "united airlines", c: "UA" },
  { k: "delta", c: "DL" },
  { k: "virgin atlantic", c: "VS" },
  { k: "finnair", c: "AY" },
  { k: "saudia", c: "SV" },
  { k: "egyptair", c: "MS" },
  { k: "gulf air", c: "GF" },
  { k: "ita airways", c: "AZ" },
  { k: "jetblue", c: "B6" },
  { k: "icelandair", c: "FI" },
  { k: "scandinavian", c: "SK" },
  { k: "condor", c: "DE" },
  { k: "all nippon", c: "NH" },
  { k: "japan airlines", c: "JL" },
  { k: "nepal airlines", c: "RA" },
  { k: "oman air", c: "WY" },
  { k: "kuwait airways", c: "KU" },
  { k: "srilankan", c: "UL" },
  { k: "malaysia airlines", c: "MH" },
  { k: "china eastern", c: "MU" },
  { k: "china southern", c: "CZ" },
  { k: "air canada", c: "AC" },
  { k: "korean air", c: "KE" },
  { k: "asiana", c: "OZ" },
  { k: "hong kong airlines", c: "HX" },
  { k: "vietnam airlines", c: "VN" },
  { k: "philippine airlines", c: "PR" },
  { k: "garuda indonesia", c: "GA" },
  { k: "qantas", c: "QF" },
  { k: "air new zealand", c: "NZ" },
  { k: "south african airways", c: "SA" },
  { k: "kenya airways", c: "KQ" },
  { k: "ethiopian airlines", c: "ET" },
  { k: "royal jordanian", c: "RJ" },
  { k: "flynas", c: "XY" },
  { k: "flydubai", c: "FZ" },
  { k: "air arabia", c: "G9" },
  { k: "wizz air", c: "W6" },
  { k: "ryanair", c: "FR" },
  { k: "easyjet", c: "U2" },
];

function codeForAirlineName(name) {
  const n = String(name || "").toLowerCase();
  const hit = AIRLINE_CODE_MAP.find((x) => n.includes(x.k));
  return hit ? hit.c : "";
}

function displayFlightNumber(f) {
  const fc = (f?.flightCode || f?.flightIata || "").toString().trim();
  if (fc) return fc;

  // Any connecting (1+ stop) itinerary should show every segment's own
  // "CODE NUM" (e.g. "6E 911/6E 211"), not just the first leg's - this
  // applies whether it's the same carrier throughout or a genuine
  // multi-carrier connection. segmentAirlineNames is index-aligned with
  // allFlightNumbers (one entry PER SEGMENT, not deduped like
  // allAirlineNames) so a repeated carrier across segments still lines up
  // correctly.
  if (Array.isArray(f?.segmentAirlineNames) && Array.isArray(f?.allFlightNumbers) && f.allFlightNumbers.length > 1) {
    const parts = f.allFlightNumbers.map((num, i) => {
      const airline = f.segmentAirlineNames[i];
      const code = codeForAirlineName(airline);
      return code ? `${code} ${num}` : String(num);
    });
    if (parts.length > 0) return parts.join("/");
  }

  let carrier = (f?.carrierCode || f?.airlineCode || f?.iataCode || "").toString().trim();

  if (!carrier) {
    carrier = codeForAirlineName(f?.airlineName);
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

function renderBestDealSummary(bestDeal, context = "default", isSelected = false) {
  const isRoundTripLeg = context === "round-trip-leg";
  const radioHtml = isRoundTripLeg
    ? `<span class="selectTripRadio${isSelected ? " is-selected" : ""}" aria-hidden="true"></span>`
    : "";

  if (!bestDeal || !bestDeal.applied) {
    return `
      <div class="bestDealBanner">
        <div class="bestDealTopRow">
          <div class="bestDealTop">No extra discount for this flight</div>
          ${radioHtml}
        </div>
        <div class="bestDealMeta">
          ${
            isRoundTripLeg
              ? "Select both flights to compare the full round-trip booking price."
              : "Compare portals to see base prices and other available offers."
          }
        </div>
      </div>
    `;
  }

  const savings = getSavingsAmount(bestDeal.basePrice, bestDeal.finalPrice);
  const portal = safeText(bestDeal.portal || "Best portal");
  const finalPrice = money(bestDeal.finalPrice);
  const basePrice = money(bestDeal.basePrice);
  const code = bestDeal.code ? safeText(bestDeal.code) : "";
  const payment = getOfferAwarePaymentLabel(bestDeal);
  const type = bestDeal.offerTypeLabel ? safeText(bestDeal.offerTypeLabel) : "";
  const showType = type && type.toLowerCase() !== "payment offer";
  const showCouponChip = !isRoundTripLeg;
  const portalLine = `Best price on ${portal}`;

  return `
    <div class="bestDealBanner">
      <div class="bestDealTopRow">
        <div>
          <div class="bestDealTop">${finalPrice}</div>
          <div class="bestDealPortal">${portalLine}</div>
        </div>
        ${savings > 0 ? `<div class="bestDealSave">Save ${money(savings)}</div>` : ""}
        ${radioHtml}
      </div>

      <div class="bestDealMeta">
        Base ${basePrice}
        ${savings > 0 ? ` • Save ${money(savings)}` : ""}
        ${payment ? ` • ${payment}` : ""}
        ${showType ? ` • ${type}` : ""}
        ${isRoundTripLeg ? " • Estimated for this flight" : ""}
      </div>

      ${
        code && showCouponChip
          ? `
            <div class="bestDealCouponRow">
              <span>Coupon</span>
              <button
                type="button"
                class="bestDealCouponChip"
                data-code="${code}"
                title="Copy coupon code"
              >
                <strong>${code}</strong>
                <small>Copy</small>
              </button>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function prettyPaymentLabel(label) {
  const s = String(label || "");
  // Purely display: normalize payment tokens.
  return s
    .replace(/\bemi\b/gi, "EMI")
    .replace(/\bupi\b/gi, "UPI")
    .replace(/\bnetbanking\b/gi, "Net Banking")
    .replace(/\bnet banking\b/gi, "Net Banking")
    .replace(/\bcreditcard\b/gi, "Credit Card")
    .replace(/\bcredit card\b/gi, "Credit Card")
    .replace(/\bdebitcard\b/gi, "Debit Card")
    .replace(/\bdebit card\b/gi, "Debit Card")
    .replace(/\s*•\s*/g, " • ")
    .trim();
}

function getOfferAwarePaymentLabel(item = {}) {
  const baseLabel = prettyPaymentLabel(item.paymentLabel || "");
  if (!baseLabel) return "";

  const context = [
    item.offerTypeLabel,
    item.title,
    item.offerTitle,
    item.rawDiscount,
    item.code,
    item.couponCode
  ]
    .filter(Boolean)
    .join(" ");

  const looksLikeEmiOffer = /\bEMI\b/i.test(context);

  if (!looksLikeEmiOffer || /\bEMI\b/i.test(baseLabel)) {
    return baseLabel;
  }

  // Some backend rows can carry card-derived labels while the actual offer is EMI.
  // For display only, show EMI when the applied coupon/offer text is clearly EMI.
  if (/\bCredit Card\b/i.test(baseLabel)) {
    return baseLabel.replace(/\bCredit Card\b/i, "EMI");
  }

  return `${baseLabel} • EMI`;
}

function getPortalCtaLabel(portal) {
  return `Book with ${safeText(portal)}`;
}

function getOtherOffersButtonLabel(portal, count = 0) {
  return count > 0
    ? `More offers on ${safeText(portal)} (${count})`
    : `More offers on ${safeText(portal)}`;
}

function getOtherOffersHideLabel(portal, count = 0) {
  return count > 0
    ? `Hide offers on ${safeText(portal)} (${count})`
    : `Hide offers on ${safeText(portal)}`;
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
  if (!selectEl) return "price-asc";

  const selectedText =
    selectEl.options && selectEl.selectedIndex >= 0
      ? String(selectEl.options[selectEl.selectedIndex]?.textContent || "")
      : "";

  const raw = String(selectEl.value || selectedText || "").trim().toLowerCase();

  if (!raw) return "price-asc";

  if (
    raw === "price-asc" ||
    raw.includes("cost") ||
    raw.includes("price") ||
    raw.includes("low")
  ) return "price-asc";

  if (
    raw === "departure-asc" ||
    raw.includes("departure") ||
    raw.includes("early")
  ) return "departure-asc";

  if (
    raw === "savings-desc" ||
    raw.includes("saving") ||
    raw.includes("save")
  ) return "savings-desc";

  return "price-asc";
}
function getDepartureHour(flight) {
  const t = fmtTime(flight?.departureTime);
  const h = Number(String(t || "").slice(0, 2));
  return Number.isFinite(h) ? h : null;
}

function flightMatchesTimeSlots(flight, slots) {
  if (!Array.isArray(slots) || slots.length === 0) return true;

  const hour = getDepartureHour(flight);
  if (hour == null) return true;

  return slots.some((slot) => {
    const [start, end] = String(slot).split("-").map(Number);
    return hour >= start && hour < end;
  });
}

function applyFlightFilters(items) {
  const list = Array.isArray(items) ? [...items] : [];

  return list.filter((flight) => {
    if (activeFilters.nonStop && Number(flight?.stops || 0) !== 0) return false;

    if (activeFilters.bestOffer && !flight?.bestDeal?.applied) return false;

    if (
      Array.isArray(activeFilters.airlines) &&
      activeFilters.airlines.length > 0 &&
      !activeFilters.airlines.includes(String(flight?.airlineName || ""))
    ) {
      return false;
    }

    if (!flightMatchesTimeSlots(flight, activeFilters.timeSlots)) return false;

    return true;
  });
}

function getAvailableAirlines() {
  const all = [...(outboundAll || []), ...(returnAll || [])];
  return [...new Set(all.map((f) => String(f?.airlineName || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function renderAirlineFilters() {
  const host = document.getElementById("airlineFilters");
  if (!host) return;

  const airlines = getAvailableAirlines();

  if (airlines.length === 0) {
    host.innerHTML = `<div class="filter-placeholder">Search once to see available airlines.</div>`;
    return;
  }

  host.innerHTML = airlines.map((name) => `
    <label class="filter-option">
      <input type="checkbox" class="airline-filter" value="${safeText(name)}" ${
        activeFilters.airlines.includes(name) ? "checked" : ""
      } />
      <span>${safeText(name)}</span>
    </label>
  `).join("");

  host.querySelectorAll(".airline-filter").forEach((cb) => {
    cb.addEventListener("change", () => {
      activeFilters.airlines = [...host.querySelectorAll(".airline-filter:checked")]
        .map((x) => x.value);

      outPageIdx = 1;
      retPageIdx = 1;
      renderOutbound();
      renderReturn();
    });
  });
}

function wireFilters() {
  const nonStop = document.getElementById("filterNonStop");
  const bestOffer = document.getElementById("filterBestOffer");
  const clearBtn = document.querySelector(".clear-filter-btn");

  nonStop?.addEventListener("change", () => {
    activeFilters.nonStop = !!nonStop.checked;
    outPageIdx = 1;
    retPageIdx = 1;
    renderOutbound();
    renderReturn();
  });

  bestOffer?.addEventListener("change", () => {
    activeFilters.bestOffer = !!bestOffer.checked;
    outPageIdx = 1;
    retPageIdx = 1;
    renderOutbound();
    renderReturn();
  });

  document.querySelectorAll(".time-filter").forEach((cb) => {
    cb.addEventListener("change", () => {
      activeFilters.timeSlots = [...document.querySelectorAll(".time-filter:checked")]
        .map((x) => x.value);

      outPageIdx = 1;
      retPageIdx = 1;
      renderOutbound();
      renderReturn();
    });
  });

  clearBtn?.addEventListener("click", () => {
    activeFilters = {
      nonStop: false,
      bestOffer: false,
      timeSlots: [],
      airlines: []
    };

    document.querySelectorAll(".filter-panel input[type='checkbox']").forEach((cb) => {
      cb.checked = false;
    });

    outPageIdx = 1;
    retPageIdx = 1;
    renderAirlineFilters();
    renderOutbound();
    renderReturn();
  });

  // The mobile drawer (body.mobile-filter-drawer-open, see style.css)
  // covers the whole results view with no other way back out - filters
  // already apply live via the change listeners above, so both of
  // these just need to close the drawer.
  document.querySelector(".filter-drawer-close")?.addEventListener("click", () => {
    document.body.classList.remove("mobile-filter-drawer-open");
  });

  document.querySelector(".filter-drawer-apply")?.addEventListener("click", () => {
    document.body.classList.remove("mobile-filter-drawer-open");
  });
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

function skydealPortalAirportMeta(iata) {
  const code = String(iata || "").toUpperCase();

  const map = {
    BOM: { emt: "Mumbai-India", cleartrip: "Mumbai, IN", plain: "Mumbai" },
    DEL: { emt: "Delhi-India", cleartrip: "New Delhi, IN", plain: "New Delhi" },
    BLR: { emt: "Bangalore-India", cleartrip: "Bangalore, IN", plain: "Bangalore" },
    HYD: { emt: "Hyderabad-India", cleartrip: "Hyderabad, IN", plain: "Hyderabad" },
    MAA: { emt: "Chennai-India", cleartrip: "Chennai, IN", plain: "Chennai" },
    CCU: { emt: "Kolkata-India", cleartrip: "Kolkata, IN", plain: "Kolkata" },
    PNQ: { emt: "Pune-India", cleartrip: "Pune, IN", plain: "Pune" },
    GOI: { emt: "Goa-India", cleartrip: "Goa, IN", plain: "Goa" },
    AMD: { emt: "Ahmedabad-India", cleartrip: "Ahmedabad, IN", plain: "Ahmedabad" },
    COK: { emt: "Kochi-India", cleartrip: "Kochi, IN", plain: "Kochi" },
    JAI: { emt: "Jaipur-India", cleartrip: "Jaipur, IN", plain: "Jaipur" },
    LKO: { emt: "Lucknow-India", cleartrip: "Lucknow, IN", plain: "Lucknow" },
    IXC: { emt: "Chandigarh-India", cleartrip: "Chandigarh, IN", plain: "Chandigarh" },
    BBI: { emt: "Bhubaneswar-India", cleartrip: "Bhubaneswar, IN", plain: "Bhubaneswar" },
    GAU: { emt: "Guwahati-India", cleartrip: "Guwahati, IN", plain: "Guwahati" },
    TRV: { emt: "Thiruvananthapuram-India", cleartrip: "Thiruvananthapuram, IN", plain: "Thiruvananthapuram" },
    IXB: { emt: "Bagdogra-India", cleartrip: "Bagdogra, IN", plain: "Bagdogra" },
    PAT: { emt: "Patna-India", cleartrip: "Patna, IN", plain: "Patna" },
    IDR: { emt: "Indore-India", cleartrip: "Indore, IN", plain: "Indore" },
    NAG: { emt: "Nagpur-India", cleartrip: "Nagpur, IN", plain: "Nagpur" }
  };

  return map[code] || { emt: `${code}-India`, cleartrip: `${code}, IN`, plain: code };
}

function skydealCompactYmd(dateValue) {
  if (!dateValue) return "";

  const d = new Date(dateValue);

  if (Number.isNaN(d.getTime())) {
    const parts = String(dateValue).split("-");
    if (parts.length === 3) return `${parts[0]}${parts[1]}${parts[2]}`;
    return "";
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}${mm}${dd}`;
}

function buildSkyDealPortalRoundTripUrl(portalName, payload = {}) {
  const portal = String(portalName || "").toLowerCase();

  const from = String(payload?.from || lastSearchPayload?.from || fromInput?.value || "").toUpperCase();
  const to = String(payload?.to || lastSearchPayload?.to || toInput?.value || "").toUpperCase();

  const depart =
    payload?.departureDate ||
    payload?.departDate ||
    lastSearchPayload?.departureDate ||
    departInput?.value ||
    "";

  const ret =
    payload?.returnDate ||
    payload?.retDate ||
    lastSearchPayload?.returnDate ||
    returnInput?.value ||
    "";

  const adults = Number(payload?.passengers || payload?.adults || lastSearchPayload?.passengers || passengerInput?.value || 1) || 1;

  const departDmy = formatDateForMmtUrl(depart);
  const retDmy = formatDateForMmtUrl(ret);
  const departYmd = skydealCompactYmd(depart);
  const retYmd = skydealCompactYmd(ret);

  const fromMeta = skydealPortalAirportMeta(from);
  const toMeta = skydealPortalAirportMeta(to);

  const hasRoundTrip = from && to && departDmy && retDmy;

  let url = "";

  if (portal.includes("makemytrip")) {
    if (hasRoundTrip) {
      url = `https://www.makemytrip.com/flight/search?tripType=R&itinerary=${encodeURIComponent(`${from}-${to}-${departDmy}_${to}-${from}-${retDmy}`)}&paxType=${encodeURIComponent(`A-${adults}_C-0_I-0`)}&cabinClass=E`;
    } else {
      url = "https://www.makemytrip.com/flights/";
    }
  } else if (portal.includes("goibibo")) {
    if (from && to && departYmd && retYmd) {
      url = `https://www.goibibo.com/flights/air-${from}-${to}-${departYmd}-${retYmd}-${adults}-0-0-E-D/`;
    } else {
      url = "https://www.goibibo.com/flights/";
    }
  } else if (portal.includes("yatra")) {
    if (hasRoundTrip) {
      const params = new URLSearchParams({
        flex: "0",
        viewName: "normal",
        source: "fresco-flights",
        type: "R",
        class: "Economy",
        ADT: String(adults),
        CHD: "0",
        INF: "0",
        noOfSegments: "2",
        origin: from,
        originCountry: "IN",
        destination: to,
        destinationCountry: "IN",
        flight_depart_date: departDmy,
        arrivalDate: retDmy
      });

      url = `https://flight.yatra.com/air-search-ui/dom2/trigger?${params.toString()}`;
    } else {
      url = "https://www.yatra.com/flights";
    }
  } else if (portal.includes("easemytrip")) {
    if (hasRoundTrip) {
      const params = new URLSearchParams({
        srch: `${from}-${fromMeta.emt}|${to}-${toMeta.emt}|${departDmy}-${retDmy}`,
        px: `${adults}-0-0`,
        cbn: "0",
        ar: "undefined",
        isow: "false",
        isdm: "true",
        lang: "en-us",
        IsDoubleSeat: "false",
        CCODE: "IN",
        curr: "INR",
        apptype: "B2C"
      });

      url = `https://www.easemytrip.com/flight-search/listing?${params.toString()}`;
    } else {
      url = "https://www.easemytrip.com/flights.html";
    }
  } else if (portal.includes("cleartrip")) {
    if (hasRoundTrip) {
      const params = new URLSearchParams({
        adults: String(adults),
        childs: "0",
        infants: "0",
        class: "Economy",
        depart_date: departDmy,
        from,
        to,
        intl: "n",
        origin: `${from} - ${fromMeta.cleartrip}`,
        destination: `${to} - ${toMeta.cleartrip}`,
        sft: "",
        sd: String(Date.now()),
        rnd_one: "R",
        isCfw: "false",
        isFF: "false",
        sourceCountry: fromMeta.plain,
        destinationCountry: toMeta.plain,
        return_date: retDmy,
        nonStop: ""
      });

      url = `https://www.cleartrip.com/flights/results?${params.toString()}`;
    } else {
      url = "https://www.cleartrip.com/flights";
    }
  }

  console.log("[SkyDeal portal URL]", {
    portal: portalName,
    from,
    to,
    depart,
    returnDate: ret,
    url
  });

  return url;
}

function buildPortalSearchUrl(portal, payload) {
  return buildSkyDealPortalRoundTripUrl(portal, payload || lastSearchPayload || {});
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
function buildSearchPaymentMethods() {
  const selected = Array.isArray(selectedPaymentMethods) ? selectedPaymentMethods : [];
  const out = [...selected];

  if (includeEmiOffers) {
    const selectedCreditCards = selected.filter((pm) => pm?.type === "Credit Card");

    for (const cc of selectedCreditCards) {
      const alreadyHasEmi = out.some(
        (pm) =>
          pm?.type === "EMI" &&
          String(pm?.name || "").toLowerCase().trim() === String(cc?.name || "").toLowerCase().trim()
      );

      if (!alreadyHasEmi) {
        out.push({
          type: "EMI",
          name: cc.name,
          provider: null,
          network: cc.network || null,
          cardFamily: cc.cardFamily || null,
          cardVariant: cc.cardVariant || null,
          isCorporate: cc.isCorporate ?? null,
          tenureMonths: null
        });
      }
    }
  }

  return out;
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

function ensurePaymentEducationNudge() {
  const searchCard = document.querySelector(".search-card");
  const pmToggle = document.getElementById("paymentBtn");
  if (!searchCard || !pmToggle) return;

  if (localStorage.getItem("skydealPaymentNudgeDismissed") === "true") {
    const old = document.getElementById("skyPaymentNudge");
    if (old) old.remove();
    return;
  }

  let nudge = document.getElementById("skyPaymentNudge");
  if (!nudge) {
    nudge = document.createElement("div");
    nudge.id = "skyPaymentNudge";
    nudge.className = "sky-payment-nudge";
    pmToggle.insertAdjacentElement("afterend", nudge);
  }

  nudge.innerHTML = `
    <div>
      <strong>Heads up:</strong> your final price can change depending on how you pay.
      Add your cards or UPI apps to see your real price.
    </div>
    <button type="button" aria-label="Dismiss payment tip">×</button>
  `;

  nudge.querySelector("button")?.addEventListener("click", () => {
    localStorage.setItem("skydealPaymentNudgeDismissed", "true");
    nudge.remove();
  });
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
        <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:999px;background:#ffffff;">
          <div style="display:flex;flex-direction:column;line-height:1.1;">
            <span style="font-size:12px;font-weight:600;color:#101828;">${safeText(label)}</span>
            ${detail ? `<span style="font-size:11px;opacity:.75;color:#667085;">${safeText(detail)}</span>` : ""}
          </div>
          ${
            supportsOptionalDetails
              ? `
                <button
                  type="button"
                  class="pm-edit-btn"
                  data-pm-index="${idx}"
                  style="background:transparent;border:0;color:#5b20df;cursor:pointer;font-size:12px;"
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
    <div style="max-width:520px;margin:8vh auto;background:#11111f;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;color:#f8fafc;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div id="pmDetailTitle" style="font-size:16px;font-weight:700;">Payment details</div>
        <button id="pmDetailClose" type="button" style="background:transparent;border:0;color:#f8fafc;font-size:20px;cursor:pointer;">×</button>
      </div>

      <div id="pmDetailBody" style="margin-top:14px;"></div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
        <button id="pmDetailCancel" type="button" style="padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#f8fafc;cursor:pointer;">Cancel</button>
        <button id="pmDetailSave" type="button" style="padding:8px 12px;border-radius:8px;border:0;background:#8b5cf6;color:#fff;cursor:pointer;">Save</button>
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
      <select id="pmDetailTenure" style="width:100%;padding:10px;border-radius:8px;background:#17172a;color:#f8fafc;border:1px solid rgba(255,255,255,.12);">
        <option value="">Not specified</option>
        ${EMI_TENURE_OPTIONS.map((n) => `<option value="${n}" ${pm.tenureMonths === n ? "selected" : ""}>${n} months</option>`).join("")}
      </select>
    `;
  } else if (pm.type === "UPI") {
    bodyEl.innerHTML = `
      <div style="opacity:.8;font-size:12px;margin-bottom:12px;">This is optional. Add it only if you want more precise UPI-offer matching.</div>

      <label style="display:block;font-size:13px;margin-bottom:8px;">UPI provider</label>
      <select id="pmDetailProvider" style="width:100%;padding:10px;border-radius:8px;background:#17172a;color:#f8fafc;border:1px solid rgba(255,255,255,.12);">
        ${UPI_PROVIDER_OPTIONS.map((name) => `<option value="${name}" ${pm.provider === name || paymentMethodDisplayLabel(pm) === name ? "selected" : ""}>${name}</option>`).join("")}
      </select>
    `;
    } else if (pm.type === "Credit Card" || pm.type === "Debit Card") {
    const cardTypeOptions = getCardTypeOptionsForPaymentMethod(pm);

    bodyEl.innerHTML = `
      <div style="opacity:.8;font-size:12px;margin-bottom:12px;">All details below are optional.</div>

      <label style="display:block;font-size:13px;margin-bottom:8px;">Card network</label>
      <select id="pmDetailNetwork" style="width:100%;padding:10px;border-radius:8px;background:#17172a;color:#f8fafc;border:1px solid rgba(255,255,255,.12);margin-bottom:14px;">
        <option value="">Not specified</option>
        ${CARD_NETWORK_OPTIONS.map((name) => `<option value="${name}" ${pm.network === name ? "selected" : ""}>${name}</option>`).join("")}
      </select>

      <label style="display:block;font-size:13px;margin-bottom:8px;">Card type / card family</label>
      <select id="pmDetailCardType" style="width:100%;padding:10px;border-radius:8px;background:#17172a;color:#f8fafc;border:1px solid rgba(255,255,255,.12);margin-bottom:14px;">
        <option value="">Not specified</option>
        ${cardTypeOptions.map((name) => `<option value="${name}" ${pm.cardFamily === name ? "selected" : ""}>${name}</option>`).join("")}
      </select>

      <label style="display:block;font-size:13px;margin-bottom:8px;">Personal vs corporate</label>
      <select id="pmDetailCorporate" style="width:100%;padding:10px;border-radius:8px;background:#17172a;color:#f8fafc;border:1px solid rgba(255,255,255,.12);">
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
  if (paymentBtn) {
    const base = n === 0 ? "Add how you pay" : `${n} payment method${n === 1 ? "" : "s"} added`;
    paymentBtn.textContent = includeEmiOffers ? `${base} + EMI offers` : base;
  }
  renderSelectedPaymentMethodsSummary();
  ensurePaymentEducationNudge();
  renderPaymentProfileCard();
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
  return `
    <div style="opacity:.72;font-size:13px;">
      No discount available with your selected payment method.
    </div>
  `;
}

const offerText = safeText(p.rawDiscount, "Offer available");
const savings = getSavingsAmount(p.basePrice, p.finalPrice);
const codeText = p.code
  ? `<button
        type="button"
        class="copyCouponBtn inlineCopyCouponBtn"
        data-code="${safeText(p.code)}"
        title="Copy coupon code"
      >${safeText(p.code)}</button>`
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
          color:#f8fafc;
          border-radius:10px;
          padding:2px 8px;
          font-size:12px;
          cursor:pointer;
        "
      >T&C</button>`
  : "";

  const pay = getOfferAwarePaymentLabel(p);
  const showTypeLabel =
  p.offerTypeLabel &&
  String(p.offerTypeLabel).trim().toLowerCase() !== "payment offer";

  const typeSpan = showTypeLabel
    ? `<span>${safeText(p.offerTypeLabel)}</span>`
    : "";

  return `
    <div style="opacity:.9;font-size:13px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;opacity:.7;margin-bottom:4px;">Applied offer</div>
      <div>${offerText}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;">
        ${savings > 0 ? `<span style="color:#86efac;font-weight:800;">You save ${money(savings)}</span>` : ""}
        ${codeText ? `<span>Coupon: ${codeText}</span>` : ""}
        ${pay ? `<span>Payment: <b>${safeText(pay)}</b></span>` : ""}
        ${typeSpan}
      </div>
      ${tncBtn ? `<div style="margin-top:8px;">${tncBtn.replace(/^\s*•\s*/, "")}</div>` : ""}
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
      <div style="max-width:900px;margin:7vh auto;background:#11111f;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;color:#f8fafc;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div id="tncTitle" style="font-size:16px;font-weight:700;"></div>
          <button id="tncClose" style="background:transparent;border:0;color:#f8fafc;font-size:20px;cursor:pointer;">×</button>
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

function normalizePaymentTabLabel(label) {
  const raw = String(label || "").trim();
  const compact = raw.toLowerCase().replace(/[\s_-]+/g, "");

  if (compact === "creditcard") return "Credit Card";
  if (compact === "debitcard") return "Debit Card";
  if (compact === "netbanking") return "Net Banking";
  if (compact === "upi") return "UPI";
  if (compact === "wallet") return "Wallet";
  if (compact === "emi") return "EMI";

  return raw;
}

function cleanupPaymentTabsDom() {
  if (!pmTabsContainer) return;

  const allowed = ["Credit Card", "Debit Card", "Net Banking", "UPI", "Wallet"];
  const seen = new Set();

  pmTabsContainer.querySelectorAll(".tab").forEach((btn) => {
    const normalized = normalizePaymentTabLabel(btn.textContent || btn.getAttribute("data-tab"));

    if (!allowed.includes(normalized) || seen.has(normalized)) {
      btn.remove();
      return;
    }

    seen.add(normalized);
    btn.textContent = normalized;
    btn.setAttribute("data-tab", normalized);
    btn.classList.toggle("active", normalized === normalizePaymentTabLabel(activePaymentType));
  });
}

function renderPaymentTabs() {
  if (!pmTabsContainer) return;

  const types = Object.keys(paymentOptions || {}).filter((k) => Array.isArray(paymentOptions[k]));
  const ordered = ["Credit Card", "Debit Card", "Net Banking", "UPI", "Wallet"];
  const finalTypes = [
    ...ordered.filter((t) => types.includes(t)),
    ...types.filter((t) => !ordered.includes(t) && t !== "EMI")
  ];

  const tabsHtml = finalTypes
    .map((t) => `<button data-tab="${t}" class="tab ${t === activePaymentType ? "active" : ""}">${t}</button>`)
    .join("");

  const unlockCount = computeEmiUnlockCount();
  const showHint = activePaymentType === "Credit Card" && !includeEmiOffers && unlockCount > 0;
  const emiHintHtml = showHint
    ? `<div class="emiUnlockHint">Turn on EMI to unlock ${unlockCount} more offer${unlockCount === 1 ? "" : "s"}</div>`
    : "";

  const emiToggleHtml = `
    <div class="emiToggleWrap ${showHint ? "has-hint" : ""}">
      <div class="emiToggleRow">
        <span class="emiToggleText">Show EMI offers</span>
        <button
          id="includeEmiOffersToggle"
          type="button"
          class="emiToggle ${includeEmiOffers ? "active" : ""}"
          aria-pressed="${includeEmiOffers ? "true" : "false"}"
        >
          <span class="emiToggleKnob"></span>
        </button>
        <span class="emiToggleState ${includeEmiOffers ? "active" : ""}">
          ${includeEmiOffers ? "ON" : "OFF"}
        </span>
      </div>
      ${emiHintHtml}
    </div>
  `;

  pmTabsContainer.innerHTML = tabsHtml + emiToggleHtml;
  cleanupPaymentTabsDom();

  pmTabsContainer.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activePaymentType = normalizePaymentTabLabel(btn.getAttribute("data-tab"));
      renderPaymentTabs();
      renderPaymentList();
    });
  });
}

// How many EMI-bucket offers exist for banks currently shown on the Credit
// Card tab but not yet counted there (i.e. only reachable by turning the
// EMI toggle on). Recomputed from the same live offerCounts data used for
// the badges, so it updates automatically whenever offer data refreshes.
function computeEmiUnlockCount() {
  const ccList = Array.isArray(paymentOptions?.["Credit Card"]) ? paymentOptions["Credit Card"] : [];
  let total = 0;
  for (const name of ccList) {
    const key = String(name).toLowerCase();
    total += paymentOfferCounts?.EMI?.[key] || 0;
  }
  return total;
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
      const key = String(name).toLowerCase();
      const baseCount = paymentOfferCounts?.[type]?.[key] || 0;
      // On Credit Card, selecting a card with the EMI toggle on also tries
      // that same card's EMI offers during search (see buildSearchPaymentMethods),
      // so the badge should reflect that combined total once the toggle is on.
      const emiCount = (type === "Credit Card" && includeEmiOffers)
        ? (paymentOfferCounts?.EMI?.[key] || 0)
        : 0;
      const offerCount = baseCount + emiCount;
      const badge = offerCount > 0
        ? `<span class="pm-offer-badge">${offerCount} offer${offerCount === 1 ? "" : "s"}</span>`
        : "";
      return `
        <label class="pm-item" for="${id}">
          <input id="${id}" type="checkbox" ${checked} />
          <span>${safeText(name)}</span>
          ${badge}
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
  if (u === "DBS" || u === "DBS BANK") return "DBS Bank";
  if (u === "RUPAY") return "RuPay";
  if (u === "INDUSIND" || u === "INDUSIND BANK") return "IndusInd Bank";
  if (u === "BHIM" || u === "BHIM UPI") return "BHIM";
  if (u === "PHONEPE") return "PhonePe";
  if (u === "PAYTM" || u === "PAYTM UPI") return "Paytm UPI";
  if (u === "PAYTM WALLET") return "Paytm Wallet";
  if (u === "CRED") return "CRED";
  if (u === "GOOGLE PAY" || u === "GPAY") return "Google Pay";
  if (u === "MOBIKWIK") return "MobiKwik";
  if (u === "FREECHARGE") return "Freecharge";
  if (u === "AMAZON PAY") return "Amazon Pay";
  if (u === "UPI" || u === "OTHER UPI") return u === "UPI" ? "UPI" : "Other UPI";
  if (u === "EMI" || u === "OTHER EMI") return u === "EMI" ? "EMI" : "Other EMI";

  const ACRONYMS = new Set(["UPI", "EMI", "CRED", "SBI", "DBS", "HSBC", "AU", "IDFC", "BOB", "RBL", "IDBI", "J&K"]);
  return s
    .split(" ")
    .map((w) => {
      if (w.length <= 2) return w.toUpperCase();
      if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase();
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    })
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
    const res = await fetchWithTimeout(`${BACKEND}/payment-options`, {}, 30000);
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
    paymentOfferCounts = normalizeOfferCounts(data?.offerCounts || {});

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
    paymentOfferCounts = {};
    renderPaymentTabs();
    updatePaymentButtonLabel();
  }
}

// Re-keys raw backend bank names to the same normalized display name
// renderPaymentList() shows, summing counts when multiple raw spellings
// (e.g. "HDFC" / "HDFC Bank") collapse into one displayed entry.
function normalizeOfferCounts(rawOfferCounts) {
  const out = {};
  for (const [type, bankCounts] of Object.entries(rawOfferCounts || {})) {
    const normalized = {};
    for (const [rawBank, count] of Object.entries(bankCounts || {})) {
      const displayName = normalizePmNameForUI(rawBank);
      if (!displayName) continue;
      const key = displayName.toLowerCase();
      normalized[key] = (normalized[key] || 0) + (Number(count) || 0);
    }
    out[type] = normalized;
  }
  return out;
}

// The 5 UI-facing payment tabs (matches renderPaymentTabs' canonical list).
// paymentOfferCounts also carries legacy camelCase duplicate keys
// (CreditCard/DebitCard/NetBanking) pointing at the exact same underlying
// counts as their spaced equivalents - summing only these 5 avoids
// double-counting the same offers twice.
const OFFER_COUNT_CANONICAL_TYPES = ["Credit Card", "Debit Card", "Net Banking", "UPI", "Wallet"];

function computeTotalLiveOfferCount() {
  let total = 0;
  for (const type of OFFER_COUNT_CANONICAL_TYPES) {
    const bankCounts = paymentOfferCounts?.[type] || {};
    total += Object.values(bankCounts).reduce((sum, c) => sum + (Number(c) || 0), 0);
  }
  return total;
}

// Fills the pre-search left panel (where Filters normally lives) with a
// simple, quiet payment-profile status card instead of the Filters
// checkboxes that have nothing to filter yet. Status line and footer
// count are both dynamic (selectedPaymentMethods.length and
// paymentOfferCounts respectively) - reuses data already fetched by
// loadPaymentOptions() on page load, no new backend call. Called both on
// initial load and every time updatePaymentButtonLabel() runs, so it
// stays in sync live as the user adds/removes payment methods, not just
// once at page load.
function renderPaymentProfileCard() {
  const statusEl = document.getElementById("paymentProfileStatus");
  const footerEl = document.getElementById("paymentProfileFooter");
  const btnEl = document.getElementById("paymentProfileBtn");
  if (!statusEl && !footerEl && !btnEl) return;

  const n = Array.isArray(selectedPaymentMethods) ? selectedPaymentMethods.length : 0;
  if (statusEl) {
    statusEl.textContent = n === 0 ? "No payment methods added" : `${n} payment method${n === 1 ? "" : "s"} added`;
  }

  const total = computeTotalLiveOfferCount();
  if (footerEl) {
    footerEl.textContent = total > 0 ? `${total} payment offer${total === 1 ? "" : "s"} active today` : "";
  }

  if (btnEl && !btnEl.dataset.wired) {
    btnEl.dataset.wired = "1";
    btnEl.addEventListener("click", () => openPaymentModal());
  }
}

// ---------- Phase 1: Intelligent payment guide ----------

// Reuses the same "pre-search" flag setResultsPreSearch() already manages -
// no new search-state tracking is introduced.
function hasActiveSearchResults() {
  const resultsSection = document.querySelector(".pro-results") || document.querySelector(".results");
  return !!resultsSection && !resultsSection.classList.contains("pre-search");
}

function suggestionKey(s) {
  const pm = s?.paymentMethod || {};
  return `${pm.type || ""}|${pm.name || ""}|${pm.tenureMonths ?? ""}`.toLowerCase();
}

function visiblePaymentSuggestions() {
  return paymentSuggestions.filter((s) => !dismissedSuggestionKeys.has(suggestionKey(s)));
}

// Cheapest-known-price snapshot per flight, mirroring the backend's own
// bestFinalPriceOf() so the /payment-suggestions request carries the exact
// baseline the backend will trust (nothing has changed since /search produced it).
function tripFlightForGuideRequest(f) {
  return { price: f.price, airlineName: f.airlineName, bestDeal: f.bestDeal || null };
}

function tripFlightForRepriceRequest(f) {
  return { price: f.price, airlineName: f.airlineName };
}

async function fetchPaymentSuggestions() {
  if (!hasActiveSearchResults() || !lastSearchPayload) return;

  paymentGuideState = "loading";
  renderPaymentGuideCard();

  try {
    const body = {
      from: lastSearchPayload.from,
      to: lastSearchPayload.to,
      travelClass: lastSearchPayload.travelClass,
      tripType: lastSearchPayload.tripType,
      passengers: lastSearchPayload.passengers,
      selectedPaymentMethods,
      outboundFlights: outboundAll.map(tripFlightForGuideRequest),
      returnFlights: returnAll.map(tripFlightForGuideRequest),
      // Phase 3: used only to bound the timing-insight lookahead horizon
      // and check travel-period eligibility - never for pricing itself.
      outboundTravelDate: lastSearchPayload.departureDate || null,
      returnTravelDate: lastSearchPayload.returnDate || null,
    };

    const res = await fetchWithTimeout(`${BACKEND}/payment-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 30000);

    if (!res.ok) throw new Error(`payment-suggestions failed: ${res.status}`);

    const json = await res.json();
    paymentSuggestions = Array.isArray(json?.suggestions) ? json.suggestions : [];
    paymentTimingInsights = Array.isArray(json?.timingInsights) ? json.timingInsights : [];
    lastGuideSummary = json?.summary || null;
    lastGuideCurrentBestPrice = Number.isFinite(json?.currentBestPrice) ? json.currentBestPrice : null;
    lastGuideTruncated = json?.meta?.truncated === true;

    if (!guideSearchSummary && lastGuideCurrentBestPrice != null) {
      resetGuideSearchSummary(lastGuideCurrentBestPrice);
    } else if (guideSearchSummary && lastGuideCurrentBestPrice != null) {
      guideSearchSummary.currentBestPrice = lastGuideCurrentBestPrice;
    }

    paymentGuideState = "ready";
  } catch (e) {
    console.error("[SkyDeal] payment-suggestions failed", e);
    paymentSuggestions = [];
    paymentTimingInsights = [];
    paymentGuideState = "error";
    lastGuideTruncated = false;
  }

  renderPaymentGuideCard();
}

// Applies to every rendered card regardless of screen size (desktop's
// two-column layout and mobile's single-column list both use the same
// .card/.price markup), so this covers both views with one query.
function setFlightPricesLoading(isLoading) {
  document.querySelectorAll(".card[data-flightkey] .price").forEach((priceEl) => {
    priceEl.classList.toggle("price-loading", isLoading);
  });
}

// Core reprice step, shared by the guide's own "Add" action and the
// normal payment modal's Done/Clear actions - reprices already-loaded
// flights in place (no /search call), updates the visible cards, and
// briefly flashes the prices that changed. Does NOT touch the
// recommendation guide itself - callers decide whether to refresh it.
async function repriceAndRenderFlights() {
  if (!hasActiveSearchResults() || !lastSearchPayload) return;

  setFlightPricesLoading(true);

  try {
    const body = {
      from: lastSearchPayload.from,
      to: lastSearchPayload.to,
      travelClass: lastSearchPayload.travelClass,
      tripType: lastSearchPayload.tripType,
      passengers: lastSearchPayload.passengers,
      selectedPaymentMethods,
      outboundFlights: outboundAll.map(tripFlightForRepriceRequest),
      returnFlights: returnAll.map(tripFlightForRepriceRequest),
    };

    const res = await fetchWithTimeout(`${BACKEND}/reprice-flights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 30000);

    if (!res.ok) throw new Error(`reprice-flights failed: ${res.status}`);

    const json = await res.json();
    const repricedOutbound = Array.isArray(json?.outboundFlights) ? json.outboundFlights : [];
    const repricedReturn = Array.isArray(json?.returnFlights) ? json.returnFlights : [];

    // flightKey() is derived from airline/flight-number/times/base-price -
    // none of which change during a reprice - so it stays stable and can
    // be computed before mutating each flight's portalPrices/bestDeal.
    const changedFlightKeys = new Set();

    outboundAll.forEach((f, i) => {
      const r = repricedOutbound[i];
      if (!r) return;
      const key = flightKey(f);
      const oldFinal = f?.bestDeal?.applied ? f.bestDeal.finalPrice : f.price;
      f.portalPrices = r.portalPrices || [];
      f.bestDeal = r.bestDeal || null;
      const newFinal = f?.bestDeal?.applied ? f.bestDeal.finalPrice : f.price;
      if (newFinal !== oldFinal) changedFlightKeys.add(key);
    });

    returnAll.forEach((f, i) => {
      const r = repricedReturn[i];
      if (!r) return;
      const key = flightKey(f);
      const oldFinal = f?.bestDeal?.applied ? f.bestDeal.finalPrice : f.price;
      f.portalPrices = r.portalPrices || [];
      f.bestDeal = r.bestDeal || null;
      const newFinal = f?.bestDeal?.applied ? f.bestDeal.finalPrice : f.price;
      if (newFinal !== oldFinal) changedFlightKeys.add(key);
    });

    renderOutbound();
    renderReturn();
    flashUpdatedPrices(changedFlightKeys);
  } catch (e) {
    console.error("[SkyDeal] reprice-flights failed", e);
    // renderOutbound()/renderReturn() above (which would otherwise clear
    // the loading spinner via their full re-render) never ran on this
    // path, so the spinner needs an explicit clear back to the
    // still-valid, unchanged prices.
    setFlightPricesLoading(false);
  }
}

// Used by the normal payment modal's Done/Clear actions only. Re-entering
// the modal is treated as a deliberate new engagement, so it resumes the
// normal auto-refreshing guide (unlike accepting a guide suggestion
// directly, which intentionally stops the auto-loop - see
// applyPaymentSuggestion).
async function syncPaymentMethodsPostSearch() {
  guideAwaitingManualRecheck = false;
  await repriceAndRenderFlights();
  await fetchPaymentSuggestions();
}

// Reuses the data-flightkey attribute flightCard() already sets on every
// card - no new DOM hooks needed to know which cards to flash.
function flashUpdatedPrices(changedFlightKeys) {
  if (!changedFlightKeys || changedFlightKeys.size === 0) return;
  requestAnimationFrame(() => {
    document.querySelectorAll(".card[data-flightkey]").forEach((cardEl) => {
      const key = cardEl.dataset.flightkey;
      if (!key || !changedFlightKeys.has(key)) return;
      const priceEl = cardEl.querySelector(".price");
      if (!priceEl) return;
      priceEl.classList.add("price-updated");
      setTimeout(() => priceEl.classList.remove("price-updated"), 1200);
    });
  });
}

// Accepting a suggestion directly (as opposed to going through the normal
// payment modal) intentionally stops the automatic recommendation loop:
// reprice and update prices, show a one-time success note, and require an
// explicit "Check for more options" click before running another
// suggestion calculation - see renderPaymentGuideCard/wireGuideCheckMoreButton.
async function applyPaymentSuggestion(suggestion) {
  const pm = suggestion?.paymentMethod;
  if (!pm) return;

  const already = selectedPaymentMethods.some(
    (existing) =>
      String(existing?.type || "").toLowerCase() === String(pm.type || "").toLowerCase() &&
      String(existing?.name || "").toLowerCase() === String(pm.name || "").toLowerCase() &&
      (existing?.tenureMonths ?? null) === (pm.tenureMonths ?? null)
  );

  if (!already) selectedPaymentMethods.push({ ...pm });

  updatePaymentButtonLabel();

  const shortLabel = String(suggestion.primaryActionLabel || "").replace(/^Add\s+/i, "") || paymentMethodDisplayLabel(pm);
  const flightsImproved = Number.isFinite(suggestion.affectedFlights)
    ? suggestion.affectedFlights
    : (suggestion.affectedOutboundFlights || 0) + (suggestion.affectedReturnFlights || 0);
  const previousBestPrice = suggestion.newBestPrice + suggestion.additionalSaving;

  guideAwaitingManualRecheck = true;
  guideAcceptedNote = {
    heading: "Your prices are updated",
    message: `Adding ${shortLabel} lowered your best final price by ₹${suggestion.additionalSaving}${
      flightsImproved > 0 ? ` and improved ${flightsImproved} flight option${flightsImproved === 1 ? "" : "s"}` : ""
    }.`,
    previousBestPrice,
    newBestPrice: suggestion.newBestPrice,
    additionalSaving: suggestion.additionalSaving,
    flightsImproved
  };
  paymentSuggestions = [];

  if (guideSearchSummary) {
    guideSearchSummary.totalSavingAchieved += suggestion.additionalSaving || 0;
    guideSearchSummary.methodsAddedViaGuide.push(shortLabel);
    guideSearchSummary.flightsImprovedTotal += flightsImproved;
    guideSearchSummary.currentBestPrice = suggestion.newBestPrice;
  }

  if (guideAcceptedNoteTimer) clearTimeout(guideAcceptedNoteTimer);
  guideAcceptedNoteTimer = setTimeout(() => {
    guideAcceptedNote = null;
    guideAcceptedNoteTimer = null;
    renderPaymentGuideCard();
  }, 4000);

  renderPaymentGuideCard();
  await repriceAndRenderFlights();
}

function dismissPaymentSuggestion(suggestion) {
  dismissedSuggestionKeys.add(suggestionKey(suggestion));
  renderPaymentGuideCard();
}

function renderGuideLoadingHtml() {
  return `
    <div class="payment-guide-loading">
      <div class="payment-guide-skeleton"></div>
      <div class="payment-guide-loading-title">Checking for a better way to pay…</div>
      <div class="payment-guide-loading-sub">We're testing your selected payment methods against available offers.</div>
    </div>
  `;
}

// Phase 2 - "already optimised" is backed by the backend's own summary
// (current best price / selected-method count / matched-offer count) for
// this exact loaded search, never a claim about the wider live catalog.
function renderGuideOptimisedHtml() {
  const summaryLine = lastGuideSummary
    ? `
      <div class="payment-guide-optimised-facts">
        ${lastGuideCurrentBestPrice != null ? `<span>Best final price: ₹${lastGuideCurrentBestPrice}</span>` : ""}
        <span>${lastGuideSummary.selectedPaymentMethodCount} payment method${lastGuideSummary.selectedPaymentMethodCount === 1 ? "" : "s"} selected</span>
        ${Number.isFinite(lastGuideSummary.matchedOfferCount) ? `<span>${lastGuideSummary.matchedOfferCount} offer${lastGuideSummary.matchedOfferCount === 1 ? "" : "s"} matched</span>` : ""}
      </div>
    `
    : "";

  // The backend's candidate loop hit its time budget before testing
  // every option (meta.truncated) - claiming "already optimised" here
  // would be asserting a conclusion the check never actually reached.
  // Say so honestly and offer a retry instead.
  if (lastGuideTruncated) {
    return `
      <div class="payment-guide-optimised">
        <div class="payment-guide-optimised-title">We couldn't finish checking in time</div>
        <div class="payment-guide-optimised-sub">We checked what we could before timing out, but didn't get through every option - there may still be a better way to pay.</div>
        ${summaryLine}
        <button type="button" class="payment-guide-check-more-btn">Check again</button>
      </div>
    `;
  }

  return `
    <div class="payment-guide-optimised">
      <div class="payment-guide-optimised-title">You're already well optimised</div>
      <div class="payment-guide-optimised-sub">We didn't find another realistic payment method that lowers your current best final price.</div>
      ${summaryLine}
    </div>
  `;
}

function renderGuideErrorHtml() {
  return `<div class="payment-guide-error-note">We couldn't check for additional savings right now.</div>`;
}

function renderGuideSuggestionCardHtml(s, idx) {
  const labelBadge = s.label ? `<div class="payment-guide-label-badge">${s.label}</div>` : "";
  return `
    <div class="payment-guide-suggestion">
      ${labelBadge}
      <div class="payment-guide-suggestion-heading">${s.heading || ""}</div>
      <div class="payment-guide-suggestion-message">${s.message || ""}</div>
      <div class="payment-guide-suggestion-actions">
        <button type="button" class="payment-guide-add-btn" data-suggestion-idx="${idx}">${s.primaryActionLabel || "Add"}</button>
        <button type="button" class="payment-guide-dismiss-btn" data-suggestion-idx="${idx}">Not applicable to me</button>
      </div>
    </div>
  `;
}

function renderGuideSuggestionsHtml(visible) {
  if (visible.length === 1) {
    return renderGuideSuggestionCardHtml(visible[0], 0);
  }
  return `
    <div class="payment-guide-multi-heading">More ways to lower your price</div>
    ${visible.map((s, i) => renderGuideSuggestionCardHtml(s, i)).join("")}
  `;
}

function renderGuideAcceptedHtml() {
  let notePart = "";

  if (guideAcceptedNote) {
    const priceLine =
      guideAcceptedNote.previousBestPrice != null && guideAcceptedNote.newBestPrice != null
        ? `<div class="payment-guide-success-prices">₹${guideAcceptedNote.previousBestPrice} → ₹${guideAcceptedNote.newBestPrice}</div>`
        : "";

    notePart = `
      <div class="payment-guide-success-heading">${guideAcceptedNote.heading}</div>
      <div class="payment-guide-success-message">${guideAcceptedNote.message}</div>
      ${priceLine}
    `;
  } else {
    // Once the transient success note fades (see applyPaymentSuggestion's
    // 4s timer), this is the resting state until the user explicitly
    // checks again - give it quiet framing instead of a bare button.
    notePart = `
      <div class="payment-guide-success-heading">You're on a good price right now</div>
      <div class="payment-guide-success-message payment-guide-resting-message">Want us to check for other ways to pay?</div>
    `;
  }

  return `
    ${notePart}
    <button type="button" class="payment-guide-check-more-btn">Check for more options</button>
  `;
}

function wireGuideCheckMoreButton(host) {
  const btn = host.querySelector(".payment-guide-check-more-btn");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";

  btn.addEventListener("click", () => {
    if (guideAcceptedNoteTimer) {
      clearTimeout(guideAcceptedNoteTimer);
      guideAcceptedNoteTimer = null;
    }
    guideAwaitingManualRecheck = false;
    guideAcceptedNote = null;
    if (guideSearchSummary) guideSearchSummary.manuallyCheckedForMore = true;
    fetchPaymentSuggestions();
  });
}

function wireGuideSuggestionButtons(host, visible) {
  if (host.dataset.wired) return;
  host.dataset.wired = "1";

  host.addEventListener("click", (e) => {
    const addBtn = e.target.closest(".payment-guide-add-btn");
    const dismissBtn = e.target.closest(".payment-guide-dismiss-btn");
    if (!addBtn && !dismissBtn) return;

    const idx = Number((addBtn || dismissBtn).dataset.suggestionIdx);
    const current = visiblePaymentSuggestions();
    const suggestion = current[idx];
    if (!suggestion) return;

    if (addBtn) applyPaymentSuggestion(suggestion);
    else dismissPaymentSuggestion(suggestion);
  });
}

// Thin wrapper so every render path also keeps the mobile frozen banner's
// hero line in sync, regardless of which early-return branch below fires.
function renderPaymentGuideCard() {
  renderPaymentGuideCardInner();
  updatePriceIntelFrozenBannerText();
}

function renderPaymentGuideCardInner() {
  const container = document.querySelector(".offers-panel-content");
  const dynamicHost = document.getElementById("paymentGuideDynamic");
  if (!container || !dynamicHost) return;

  if (!hasActiveSearchResults()) {
    container.classList.remove("guide-replacing");
    dynamicHost.innerHTML = "";
    renderTimingInsights();
    return;
  }

  // Timing insights render into their own container regardless of which
  // Phase 1/2 state is showing above - a separate, secondary section,
  // never replacing the primary suggestion/optimised/success/error state.
  renderTimingInsights();

  if (guideAwaitingManualRecheck) {
    container.classList.add("guide-replacing");
    dynamicHost.innerHTML = renderGuideAcceptedHtml();
    wireGuideCheckMoreButton(dynamicHost);
    return;
  }

  if (paymentGuideState === "loading") {
    container.classList.add("guide-replacing");
    dynamicHost.innerHTML = renderGuideLoadingHtml();
    return;
  }

  if (paymentGuideState === "error") {
    container.classList.remove("guide-replacing");
    dynamicHost.innerHTML = renderGuideErrorHtml();
    return;
  }

  if (paymentGuideState === "ready") {
    const visible = visiblePaymentSuggestions();

    if (visible.length === 0) {
      container.classList.add("guide-replacing");
      dynamicHost.innerHTML = renderGuideOptimisedHtml();
      wireGuideCheckMoreButton(dynamicHost);
      return;
    }

    container.classList.add("guide-replacing");
    dynamicHost.innerHTML = renderGuideSuggestionsHtml(visible);
    wireGuideSuggestionButtons(dynamicHost, visible);
    return;
  }

  container.classList.remove("guide-replacing");
  dynamicHost.innerHTML = "";
}

// Phase 3 - a small, separate, informational section (no add/dismiss
// actions - these are read-only "when" signals, not new suggestions to
// accept). Never shown pre-search; empty when the backend has nothing to
// say (no timing opportunity is not an error and gets no messaging at all).
function renderTimingInsightCardHtml(insight) {
  const labelBadge = insight.label ? `<div class="payment-timing-label-badge">${insight.label}</div>` : "";
  const disclaimerPart = insight.disclaimer
    ? `<div class="payment-timing-disclaimer">${insight.disclaimer}</div>`
    : "";

  return `
    <div class="payment-timing-insight">
      ${labelBadge}
      <div class="payment-timing-heading">${insight.heading || ""}</div>
      <div class="payment-timing-message">${insight.message || ""}</div>
      ${disclaimerPart}
    </div>
  `;
}

function renderTimingInsights() {
  const host = document.getElementById("paymentTimingDynamic");
  if (!host) return;

  if (!hasActiveSearchResults() || !Array.isArray(paymentTimingInsights) || paymentTimingInsights.length === 0) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = paymentTimingInsights.map(renderTimingInsightCardHtml).join("");
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
      <div class="portalModalCard portalModalCardV2">
        <div class="portalModalTop">
          <div>
            <div class="portalModalEyebrow">Portal comparison</div>
            <div class="portalModalTitle">Same flight, different final prices</div>
            <div class="portalModalSubtitle">We check each portal against your selected payment options.</div>
          </div>
          <button id="portalCompareClose" type="button" class="portalModalCloseBtn" aria-label="Close portal comparison">×</button>
        </div>
        <div id="portalCompareBody" class="portalCompareBodyV2"></div>
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

  const portalPricesRaw = Array.isArray(flight?.portalPrices) ? flight.portalPrices : [];
const bestPortal = flight?.bestDeal?.portal || null;

const portalPrices = [...portalPricesRaw].sort((a, b) => {
  const aPrice = Number(a?.finalPrice ?? a?.basePrice ?? Infinity);
  const bPrice = Number(b?.finalPrice ?? b?.basePrice ?? Infinity);
  return aPrice - bPrice;
});

  console.log("[SkyDeal] portalPrices for clicked flight:", portalPrices);

  if (portalPrices.length === 0) {
    body.innerHTML = `<div class="portalModalEmpty">No portal-wise price data available for this flight.</div>`;
  } else {
    body.innerHTML = `
      <div class="portalCompareFlightHead portalCompareFlightHeadV2">
        <span>${safeText(flight.displayAirlineName || flight.airlineName)} ${displayFlightNumber(flight)}</span>
        <strong>${fmtTime(flight.departureTime)} → ${fmtTime(flight.arrivalTime)}</strong>
      </div>

      <div class="portalCompareList">
        ${portalPrices
          .map((p) => {
            const href = buildPortalSearchUrl(p.portal, lastSearchPayload);
            const isBest = bestPortal && p.portal === bestPortal;
             const portalSavings = getSavingsAmount(p.basePrice, p.finalPrice);

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
             data-show-label="${getOtherOffersButtonLabel(p.portal, p.infoOffers.length)}"
data-hide-label="${getOtherOffersHideLabel(p.portal, p.infoOffers.length)}"
>
  ${getOtherOffersButtonLabel(p.portal, p.infoOffers.length)}
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
   ${isBest ? `<span class="badge bestPriceBadge">Best option</span>` : ""}
  </div>

  <div class="portalHeaderRight">
    <div class="portalPrice">
  <div>${money(p.finalPrice ?? p.basePrice ?? flight?.price)}</div>
  ${
    portalSavings > 0
      ? `<div style="font-size:12px;opacity:.75;text-decoration:line-through;">${money(p.basePrice)}</div>
         <div style="font-size:12px;color:#86efac;">Save ${money(portalSavings)}</div>`
      : ""
  }
</div>
    ${
      href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer" class="badge portalLinkBadge portalLinkBelowPrice" style="text-decoration:none;">${getPortalCtaLabel(p.portal)}</a>`
        : ""
    }
  </div>
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

function getAirlineLogoUrl(airlineName) {
  const n = String(airlineName || "").toLowerCase();

  if (n.includes("indigo")) return "assets/airlines/indigo.png";
  if (n.includes("air india express")) return "assets/airlines/air-india-express.png";
  if (n.includes("air india")) return "assets/airlines/air-india.png";
  if (n.includes("akasa")) return "assets/airlines/akasa.png";
  if (n.includes("spicejet")) return "assets/airlines/spicejet.png";
  if (n.includes("vistara")) return "assets/airlines/vistara.png";

  return "";
}

function getAirlineInitials(airlineName) {
  const n = String(airlineName || "").trim();

  if (/indigo/i.test(n)) return "6E";
  if (/air india express/i.test(n)) return "IX";
  if (/air india/i.test(n)) return "AI";
  if (/akasa/i.test(n)) return "QP";
  if (/spicejet/i.test(n)) return "SG";
  if (/vistara/i.test(n)) return "UK";

  return n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase() || "✈";
}

const SKY_LOADING_STEPS = [
  "Checking live fares",
  "Comparing portal prices",
  "Matching payment offers",
  "Applying eligible offers",
  "Calculating final payable price"
];

let skyLoadingTextTimer = null;
let skyLoadingTextIndex = 0;
let skyLoadingSlowHintTimer = null;

function stopSkyLoadingTextRotation() {
  if (skyLoadingTextTimer) {
    clearInterval(skyLoadingTextTimer);
    skyLoadingTextTimer = null;
  }
  if (skyLoadingSlowHintTimer) {
    clearTimeout(skyLoadingSlowHintTimer);
    skyLoadingSlowHintTimer = null;
  }
}

// After ~12s of loading, reassure the user a slow search is still running.
// Guarded: only acts on a loading card that is still on screen, so it is a
// no-op once results (or an error) have replaced it.
function showSkyLoadingSlowHint() {
  const cards = document.querySelectorAll(".sky-search-loading-card");
  cards.forEach((card) => {
    if (card.querySelector(".sky-loading-slow-hint")) return;
    const hint = document.createElement("div");
    hint.className = "sky-search-state-subtitle sky-loading-slow-hint";
    hint.textContent = "Still working — live fares can take a few extra seconds.";
    card.appendChild(hint);
  });
}

function updateSkyLoadingText() {
  const nodes = document.querySelectorAll(".sky-loading-active-text");
  if (!nodes.length) return;

  const text = SKY_LOADING_STEPS[skyLoadingTextIndex % SKY_LOADING_STEPS.length];
  nodes.forEach((node) => {
    node.textContent = text;
  });

  skyLoadingTextIndex += 1;
}

function startSkyLoadingTextRotation() {
  stopSkyLoadingTextRotation();
  skyLoadingTextIndex = 0;
  updateSkyLoadingText();
  skyLoadingTextTimer = setInterval(updateSkyLoadingText, 1400);
  skyLoadingSlowHintTimer = setTimeout(showSkyLoadingSlowHint, 12000);
}

function emptyStateHtml(type = "default") {
  if (type === "return-hidden") {
    return `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 14 4 9l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10a6 6 0 0 1 6 6v1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="empty-title">Return flights are off for one-way trips</div>
        <div class="empty-copy">Switch to round-trip when you want SkyDeal to compare departure and return flights together.</div>
      </div>
    `;
  }

  if (type === "loading") {
    return `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
        <div class="empty-title">Comparing final prices</div>
        <div class="empty-copy">We check fares, portals, and payment offers before showing your price.</div>
        <div class="sky-loading-steps" aria-live="polite">
          <span class="sky-loading-active-text">Checking live fares</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="empty-state">
      <div class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2.5 1.5V22l4-1 4 1v-1.5L13 19v-5.5l8 2.5Z" fill="currentColor"/></svg></div>
      <div class="empty-title">Search to compare real flight prices</div>
      <div class="empty-copy">Flight prices change depending on the portal and payment method you use. Enter your route to see live fares and your final price on each.</div>
    </div>
  `;
}

function isRoundTripModeActive() {
  return !!roundTripRadio?.checked || lastSearchPayload?.tripType === "round-trip";
}

function hasRoundTripResultsReady() {
  return (
    isRoundTripModeActive() &&
    Array.isArray(outboundAll) &&
    outboundAll.length > 0 &&
    Array.isArray(returnAll) &&
    returnAll.length > 0
  );
}

function getRouteArrowForSearchState() {
  return isRoundTripModeActive() ? "↔" : "→";
}

function isSameSelectedFlight(a, b) {
  if (!a || !b) return false;
  return flightKey(a) === flightKey(b);
}

function selectedTripDateLabel(direction = "out") {
  const dateValue =
    direction === "ret"
      ? (lastSearchPayload?.returnDate || returnInput?.value || "")
      : (lastSearchPayload?.departureDate || departInput?.value || "");

  if (!dateValue) return "";

  const d = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });
}

function selectedFlightSummary(f, direction = "out") {
  if (!f) return "Not selected yet";

  const date = selectedTripDateLabel(direction);
  const datePrefix = date ? `${date} · ` : "";

  return `${datePrefix}${safeText(f.displayAirlineName || f.airlineName)} ${displayFlightNumber(f)} · ${fmtTime(f.departureTime)} → ${fmtTime(f.arrivalTime)} · ${money(f.price)}`;
}

function ensureSelectedTripPanel() {
  let panel = document.getElementById("selectedTripPanel");
  if (panel) return panel;

  const results = document.querySelector(".results");
  if (!results) return null;

  panel = document.createElement("section");
  panel.id = "selectedTripPanel";
  panel.style.display = "none";
  panel.style.position = "fixed";
  panel.style.left = "50%";
  panel.style.bottom = "18px";
  panel.style.transform = "translateX(-50%)";
  panel.style.width = "min(1120px, calc(100vw - 28px))";
  panel.style.padding = "16px 18px";
  panel.style.border = "1px solid rgba(168,85,247,0.34)";
  panel.style.borderRadius = "24px";
  panel.style.background = "linear-gradient(135deg, rgba(16,24,40,0.98), rgba(88,28,135,0.98))";
  panel.style.backdropFilter = "blur(18px)";
  panel.style.boxShadow = "0 22px 60px rgba(17,24,39,0.34), 0 0 0 1px rgba(255,255,255,0.06) inset";
  panel.style.zIndex = "120";
  panel.style.color = "#ffffff";

  document.body.appendChild(panel);
  return panel;
}

function scrollAfterTripSelection(direction) {
  // Keep round-trip page stable. Do not auto-scroll or shift horizontally.
  return;
}

function getSelectedTripComparisonKey() {
  if (!selectedOutboundFlight || !selectedReturnFlight || !lastSearchPayload) return "";

  return [
    lastSearchPayload.from || "",
    lastSearchPayload.to || "",
    lastSearchPayload.passengers || 1,
    lastSearchPayload.travelClass || "economy",
    flightKey(selectedOutboundFlight),
    flightKey(selectedReturnFlight),
    JSON.stringify(buildSearchPaymentMethods())
  ].join("|");
}

function getBestTripPortalInfo() {
  const comparison = selectedTripComparison;
  if (!comparison) return null;

  const portalPrices = Array.isArray(comparison.portalPrices)
    ? comparison.portalPrices
    : [];

  const bestFromBackend = comparison.bestDeal || null;

  const bestFromPortals = portalPrices
    .filter((p) => Number.isFinite(Number(p.finalPrice)))
    .sort((a, b) => Number(a.finalPrice) - Number(b.finalPrice))[0] || null;

  const best = bestFromBackend || bestFromPortals;
  if (!best) return null;

  const matchingPortal = portalPrices.find(
    (p) => (p.portal || "").toLowerCase() === (best.portal || "").toLowerCase()
  );

  const baseTotal = Number(
    comparison.baseTotal ||
    best.basePrice ||
    matchingPortal?.basePrice ||
    0
  );

  const finalPrice = Number(
    best.finalPrice ||
    matchingPortal?.finalPrice ||
    baseTotal ||
    0
  );

  const savings = Math.max(
    0,
    Number(best.actualDiscount || matchingPortal?.actualDiscount || baseTotal - finalPrice || 0)
  );

  return {
    portal: best.portal || matchingPortal?.portal || "Best portal",
    finalPrice,
    baseTotal,
    savings,
    code: best.code || best.couponCode || matchingPortal?.code || matchingPortal?.couponCode || "",
    paymentLabel: best.paymentLabel || matchingPortal?.paymentLabel || "",
    offerTitle: best.title || best.offerTitle || matchingPortal?.title || matchingPortal?.offerTitle || "",
    rawDiscount: best.rawDiscount || matchingPortal?.rawDiscount || "",
    appliedDiscountText: best.appliedDiscountText || matchingPortal?.appliedDiscountText || "",
    explain: best.explain || matchingPortal?.explain || "",
    bookingUrl:
      best.bookingUrl ||
      best.url ||
      matchingPortal?.bookingUrl ||
      matchingPortal?.url ||
      matchingPortal?.deepLink ||
      matchingPortal?.redirectUrl ||
      ""
  };
}

function formatDateForMmtUrl(dateValue) {
  if (!dateValue) return "";

  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) {
    const parts = String(dateValue).split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return "";
  }

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}/${mm}/${yyyy}`;
}

function formatDateYYYYMMDDCompact(dateValue) {
  if (!dateValue) return "";

  const d = new Date(dateValue);

  if (Number.isNaN(d.getTime())) {
    const parts = String(dateValue).split("-");
    if (parts.length === 3) {
      return `${parts[0]}${parts[1]}${parts[2]}`;
    }
    return "";
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}${mm}${dd}`;
}

function airportCityMeta(iata) {
  const code = String(iata || "").toUpperCase();

  const map = {
    BOM: { emt: "Mumbai-India", cleartrip: "Mumbai, IN" },
    DEL: { emt: "Delhi-India", cleartrip: "New Delhi, IN" },
    BLR: { emt: "Bangalore-India", cleartrip: "Bangalore, IN" },
    HYD: { emt: "Hyderabad-India", cleartrip: "Hyderabad, IN" },
    MAA: { emt: "Chennai-India", cleartrip: "Chennai, IN" },
    CCU: { emt: "Kolkata-India", cleartrip: "Kolkata, IN" },
    PNQ: { emt: "Pune-India", cleartrip: "Pune, IN" },
    GOI: { emt: "Goa-India", cleartrip: "Goa, IN" },
    AMD: { emt: "Ahmedabad-India", cleartrip: "Ahmedabad, IN" },
    COK: { emt: "Kochi-India", cleartrip: "Kochi, IN" },
    JAI: { emt: "Jaipur-India", cleartrip: "Jaipur, IN" },
    LKO: { emt: "Lucknow-India", cleartrip: "Lucknow, IN" },
    IXC: { emt: "Chandigarh-India", cleartrip: "Chandigarh, IN" },
    BBI: { emt: "Bhubaneswar-India", cleartrip: "Bhubaneswar, IN" },
    GAU: { emt: "Guwahati-India", cleartrip: "Guwahati, IN" },
    TRV: { emt: "Thiruvananthapuram-India", cleartrip: "Thiruvananthapuram, IN" },
    IXB: { emt: "Bagdogra-India", cleartrip: "Bagdogra, IN" },
    PAT: { emt: "Patna-India", cleartrip: "Patna, IN" },
    IDR: { emt: "Indore-India", cleartrip: "Indore, IN" },
    NAG: { emt: "Nagpur-India", cleartrip: "Nagpur, IN" }
  };

  return map[code] || { emt: `${code}-India`, cleartrip: `${code}, IN` };
}


function airportPlainCity(iata) {
  const code = String(iata || "").toUpperCase();

  const map = {
    BOM: "Mumbai",
    DEL: "New Delhi",
    BLR: "Bangalore",
    HYD: "Hyderabad",
    MAA: "Chennai",
    CCU: "Kolkata",
    PNQ: "Pune",
    GOI: "Goa",
    AMD: "Ahmedabad",
    COK: "Kochi",
    JAI: "Jaipur",
    LKO: "Lucknow",
    IXC: "Chandigarh",
    BBI: "Bhubaneswar",
    GAU: "Guwahati",
    TRV: "Thiruvananthapuram",
    IXB: "Bagdogra",
    PAT: "Patna",
    IDR: "Indore",
    NAG: "Nagpur"
  };

  return map[code] || code;
}


function buildPortalBookingUrl(portalName) {
  return buildSkyDealPortalRoundTripUrl(portalName, lastSearchPayload || {});
}

function bookSelectedRoundTripBestPortal() {
  const bestInfo = getBestTripPortalInfo();
  if (!bestInfo) return;

  const url = bestInfo.bookingUrl || buildPortalBookingUrl(bestInfo.portal);

  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  compareSelectedRoundTrip();
}

function formatTripBestSummary() {
  if (!selectedOutboundFlight || !selectedReturnFlight) {
    return "";
  }

  if (selectedTripCompareLoading) {
    return `
      <div class="sky-trip-best-card sky-trip-best-pro is-loading">
        <div class="trip-rec-head">
          <div>
            <div class="trip-rec-eyebrow">Checking offers</div>
            <div class="trip-rec-title">Finding the best option for your selected flights...</div>
          </div>
        </div>
      </div>
    `;
  }

  if (selectedTripComparisonError) {
    return `
      <div class="sky-trip-best-card sky-trip-best-pro is-warning">
        <div class="trip-rec-head">
          <div>
            <div class="trip-rec-eyebrow">Offer check failed</div>
            <div class="trip-rec-title">${selectedTripComparisonError}</div>
          </div>
        </div>
      </div>
    `;
  }

  const bestInfo = getBestTripPortalInfo();

  if (!bestInfo) {
    return `
      <div class="sky-trip-best-card sky-trip-best-pro is-loading">
        <div class="trip-rec-head">
          <div>
            <div class="trip-rec-eyebrow">Checking offers</div>
            <div class="trip-rec-title">Comparing portal-wise prices...</div>
          </div>
        </div>
      </div>
    `;
  }

  const offerTitle = bestInfo.offerTitle || bestInfo.rawDiscount || "Best available payment offer";
  const paymentText = getOfferAwarePaymentLabel(bestInfo) || "Selected payment method";
  const saveText = bestInfo.savings > 0 ? `You save ${money(bestInfo.savings)}` : "No discount applied";
  const bestPortalText = bestInfo.portal ? `Best price on ${bestInfo.portal}` : "Best price for selected flights";

  return `
    <div class="sky-trip-best-card sky-trip-best-pro is-ready">
      <div class="trip-rec-head">
        <div>
          <div class="trip-rec-eyebrow">Recommended option</div>
          <div class="trip-rec-title">${bestInfo.portal}</div>
        </div>
        <div class="trip-rec-portal">${bestInfo.portal}</div>
      </div>

      <div class="trip-rec-body">
        <div class="trip-rec-price-block">
          <div class="trip-rec-price">${money(bestInfo.finalPrice)}</div>
          <div class="trip-rec-base">Base fare <s>${money(bestInfo.baseTotal)}</s></div>
          ${
            bestInfo.savings > 0
              ? `<div class="trip-rec-save-inline">Save ${money(bestInfo.savings)}</div>`
              : ""
          }
        </div>

        <div class="trip-rec-offer">
          <div class="trip-rec-section-label">${bestPortalText}</div>
          <div class="trip-rec-offer-title">${offerTitle}</div>

          <div class="trip-rec-meta">
            <span style="color:#86efac;font-weight:800;">${saveText}</span>
            <span>•</span>
            <span>${paymentText}</span>
          </div>

          <div class="trip-rec-coupon-row">
            <span class="trip-rec-coupon-label">Coupon</span>
            ${
              bestInfo.code
                ? `
                  <span class="trip-rec-coupon-code">${bestInfo.code}</span>
                  <button type="button" class="copyTripCouponBtn" data-code="${bestInfo.code}">Copy</button>
                `
                : `<span class="trip-rec-no-code">No coupon required</span>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}


function formatCompactTripBestSummary() {
  const comparison = selectedTripComparison;
  const bestInfo = getBestTripPortalInfo();

  if (selectedTripCompareLoading) {
    return `
      <div class="sky-trip-compact-summary is-loading">
        <div class="sky-trip-compact-main">
          <div class="sky-trip-compact-eyebrow">Checking offers</div>
          <div class="sky-trip-compact-title">Comparing portal-wise prices...</div>
          <div class="sky-trip-compact-sub">Checking fares and payment offers for your selected flights.</div>
        </div>
      </div>
    `;
  }

  if (selectedTripComparisonError) {
    return `
      <div class="sky-trip-compact-summary is-error">
        <div class="sky-trip-compact-main">
          <div class="sky-trip-compact-eyebrow">Couldn’t compare portals</div>
          <div class="sky-trip-compact-title">${selectedTripComparisonError}</div>
          <div class="sky-trip-compact-sub">You can try again or compare individual flight options.</div>
        </div>
      </div>
    `;
  }

  if (!comparison || !bestInfo) {
    return `
      <div class="sky-trip-compact-summary is-loading">
        <div class="sky-trip-compact-main">
          <div class="sky-trip-compact-eyebrow">Checking offers</div>
          <div class="sky-trip-compact-title">Calculating selected trip price...</div>
          <div class="sky-trip-compact-sub">We’ll show the best portal once both flights are checked.</div>
        </div>
      </div>
    `;
  }

  const offerTitle = bestInfo.offerTitle || bestInfo.rawDiscount || "Matching payment offer applied";
  const paymentText = getOfferAwarePaymentLabel(bestInfo) || "Selected payment option";
  const coupon = bestInfo.code || "";
  const saveText = bestInfo.savings > 0 ? `Save ${money(bestInfo.savings)}` : "No discount applied";

  return `
    <div class="sky-trip-compact-summary">
      <div class="sky-trip-compact-price">
        <div class="sky-trip-compact-price-label">Best price</div>
        <div class="sky-trip-compact-price-value">${money(bestInfo.finalPrice)}</div>
        <div class="sky-trip-compact-base">Base fare <s>${money(bestInfo.baseTotal)}</s></div>
      </div>

      <div class="sky-trip-compact-main">
        <div class="sky-trip-compact-eyebrow">Best price on ${safeText(bestInfo.portal)}</div>
        <div class="sky-trip-compact-title">${offerTitle}</div>
        <div class="sky-trip-compact-sub">
          <span class="sky-trip-save-pill">${saveText}</span>
          <span>${paymentText}</span>
        </div>

        ${
          coupon
            ? `
              <div class="sky-trip-compact-coupon">
                <span>Coupon</span>
                <strong>${safeText(coupon)}</strong>
                <button type="button" class="copyTripCouponBtn" data-code="${safeText(coupon)}">Copy</button>
              </div>
            `
            : ""
        }
      </div>
    </div>
  `;
}

async function refreshSelectedTripComparison() {
  if (!selectedOutboundFlight || !selectedReturnFlight || !lastSearchPayload) {
    selectedTripComparison = null;
    selectedTripComparisonError = "";
    selectedTripComparisonKey = "";
    selectedTripCompareLoading = false;
    renderSelectedTripPanel();
    return;
  }

  const key = getSelectedTripComparisonKey();

  if (selectedTripComparisonKey === key && selectedTripComparison) {
    return;
  }

  selectedTripComparisonKey = key;
  selectedTripComparison = null;
  selectedTripComparisonError = "";
  if (selectedTripComparison && selectedTripComparisonKey === getSelectedTripComparisonKey()) {
    const comparison = selectedTripComparison;
    const comparisonFlight = {
      airlineName: "Selected trip",
      flightNumber: `${displayFlightNumber(selectedOutboundFlight)} / ${displayFlightNumber(selectedReturnFlight)}`,
      departureTime: selectedOutboundFlight.departureTime,
      arrivalTime: selectedReturnFlight.arrivalTime,
      stops: Number(selectedOutboundFlight.stops || 0) + Number(selectedReturnFlight.stops || 0),
      price: comparison.baseTotal,
      bestDeal: comparison.bestDeal || null,
      portalPrices: comparison.portalPrices || [],
      tripComparison: comparison
    };

    showPortalCompare(comparisonFlight);
    return;
  }

  selectedTripCompareLoading = true;
  renderSelectedTripPanel();

  try {
    const payload = {
      from: lastSearchPayload.from,
      to: lastSearchPayload.to,
      tripType: "round-trip",
      adults: lastSearchPayload.adults || lastSearchPayload.passengers || 1,
      passengers: lastSearchPayload.passengers || lastSearchPayload.adults || 1,
      travelClass: lastSearchPayload.travelClass || "economy",
      paymentMethods: buildSearchPaymentMethods(),
      includeGenericDisplayOffers: true,
      outboundFlight: slimFlightForTripCompare(selectedOutboundFlight),
      returnFlight: slimFlightForTripCompare(selectedReturnFlight)
    };

    const compareUrl = `${BACKEND}/compare-selected-trip`;
    const res = await fetchWithTimeout(compareUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, 60000);

    const rawText = await res.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error("[SkyDeal] compare-selected-trip returned non-JSON", {
        url: compareUrl,
        status: res.status,
        contentType: res.headers.get("content-type"),
        preview: rawText.slice(0, 500)
      });
      throw new Error(`Trip comparison failed with HTTP ${res.status}`);
    }

    if (!res.ok || data?.meta?.error) {
      throw new Error(data?.meta?.error || `Trip comparison failed with HTTP ${res.status}`);
    }

    if (!data?.tripComparison || !Array.isArray(data.tripComparison.portalPrices)) {
      throw new Error("No full-trip comparison returned.");
    }

    selectedTripComparison = data.tripComparison;
    selectedTripComparisonError = "";
  } catch (err) {
    selectedTripComparison = null;
    selectedTripComparisonError = err?.message || "Could not calculate full-trip price.";
  } finally {
    selectedTripCompareLoading = false;
    renderSelectedTripPanel();
  }
}

function selectedTripRouteLabel(direction) {
  const from = lastSearchPayload?.from || fromInput?.value || "";
  const to = lastSearchPayload?.to || toInput?.value || "";

  if (!from || !to) {
    return direction === "ret" ? "Return flight" : "Departure flight";
  }

  return direction === "ret" ? `${to} → ${from}` : `${from} → ${to}`;
}

function ensureMobileResultsApp() {
  const resultsSection = document.querySelector(".pro-results") || document.querySelector(".results");
  if (!resultsSection) return null;

  let app = document.getElementById("mobileResultsApp");
  if (app) return app;

  app = document.createElement("section");
  app.id = "mobileResultsApp";
  app.className = "mobile-results-app";
  app.setAttribute("aria-label", "Mobile flight results");

  app.innerHTML = `
    <div class="mobile-results-shell">
      <div class="mobile-results-placeholder">
        Mobile results will appear here.
      </div>
    </div>
  `;

  resultsSection.parentNode.insertBefore(app, resultsSection.nextSibling);
  return app;
}

function renderMobileResultsApp() {
  ensureMobileResultsApp();
}

function isSkyDealMobileView() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function scrollToReturnFlightsOnMobile() {
  if (!isSkyDealMobileView()) return;

  const returnPanel = document.getElementById("returnResultsPanel");
  if (!returnPanel) return;

  setTimeout(() => {
    returnPanel.scrollIntoView({
      behavior: "instant",
      block: "start"
    });
  }, 250);
}

function findMobileFilterCheckboxByText(matchText) {
  const wanted = String(matchText || "").toLowerCase();
  const labels = Array.from(document.querySelectorAll(".filter-card label, .filter-panel label"));

  for (const label of labels) {
    const labelText = (label.textContent || "").toLowerCase();
    if (!labelText.includes(wanted)) continue;

    const input = label.querySelector("input[type='checkbox']");
    if (input) return input;
  }

  return null;
}

function toggleMobileQuickFilter(matchText) {
  const input = findMobileFilterCheckboxByText(matchText);
  if (!input) return;

  input.checked = !input.checked;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function ensureMobileQuickFilters() {
  const results = document.querySelector(".pro-results") || document.querySelector(".results");
  const workspace = document.querySelector(".flights-workspace");

  if (!results || !workspace) return null;

  let bar = document.getElementById("mobileQuickFilters");
  if (bar) return bar;

  bar = document.createElement("div");
  bar.id = "mobileQuickFilters";
  bar.className = "mobile-quick-filters";

  bar.innerHTML = `
    <button type="button" class="mobile-chip mobile-chip-sort">Sorted by<br><b>Cheapest</b></button>
    <button type="button" class="mobile-chip" data-mobile-filter="Non-stop">Non-stop</button>
    <button type="button" class="mobile-chip" data-mobile-filter="Best offer">Best offer</button>
    <button type="button" class="mobile-chip mobile-chip-filter">Filter</button>
  `;

  workspace.parentNode.insertBefore(bar, workspace);

  bar.querySelectorAll("[data-mobile-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleMobileQuickFilter(btn.getAttribute("data-mobile-filter"));
      btn.classList.toggle("is-active");
    });
  });

  bar.querySelector(".mobile-chip-filter")?.addEventListener("click", () => {
    document.body.classList.toggle("mobile-filter-drawer-open");
  });

  return bar;
}

function renderMobileQuickFilters() {
  ensureMobileQuickFilters();
}

// Mirrors whichever headline renderPaymentGuideCard() is currently
// showing inside the full card, condensed to one line, for the frozen
// mobile banner below - reuses the same state, never a second source
// of truth for what the guide is currently saying.
function getPriceIntelHeroLine() {
  if (!hasActiveSearchResults()) {
    const n = Array.isArray(selectedPaymentMethods) ? selectedPaymentMethods.length : 0;
    return n === 0
      ? "Add how you pay to see your best final price"
      : "We'll check your payment methods against today's live offers";
  }

  if (guideAwaitingManualRecheck) {
    return guideAcceptedNote?.heading || "You're on a good price right now";
  }

  if (paymentGuideState === "loading") {
    return "Checking for a better way to pay…";
  }

  if (paymentGuideState === "error") {
    return "We couldn't check for additional savings right now";
  }

  if (paymentGuideState === "ready") {
    const visible = visiblePaymentSuggestions();
    return visible.length === 0
      ? "You're already well optimised"
      : (visible[0]?.heading || "You could save more on this trip");
  }

  return "Price intelligence";
}

function ensureMobilePriceIntelFrozenBanner() {
  let banner = document.getElementById("priceIntelFrozenBanner");
  if (banner) return banner;

  banner = document.createElement("div");
  banner.id = "priceIntelFrozenBanner";
  banner.className = "price-intel-frozen-banner";
  banner.innerHTML = `
    <span class="price-intel-frozen-dot"></span>
    <div class="price-intel-frozen-text">
      <div class="price-intel-frozen-eyebrow">Price intelligence</div>
      <div class="price-intel-frozen-line" id="priceIntelFrozenLine"></div>
    </div>
    <svg class="price-intel-frozen-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 5V15M10 15L5 10M10 15L15 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
  `;
  banner.addEventListener("click", () => {
    const card = document.querySelector(".smart-guide-card");
    // "smooth" silently no-op'd here (and at every other scrollIntoView
    // call site in this file - all since switched to "instant" too,
    // see style.css's overflow-x notes for the root cause that made
    // body a phantom, never-scrolling position:sticky/scroll target).
    card?.scrollIntoView({ behavior: "instant", block: "start" });
  });

  document.body.appendChild(banner);
  return banner;
}

function updatePriceIntelFrozenBannerText() {
  const line = document.getElementById("priceIntelFrozenLine");
  if (line) line.textContent = getPriceIntelHeroLine();
}

// The banner anchors to a small fixed offset from the real viewport top
// rather than to .mobile-search-summary's height - that bar declares
// position:sticky but doesn't actually stay pinned while scrolling (a
// separate, pre-existing bug, confirmed on the live site too), so
// depending on it would have positioned this banner over mid-page
// content once scrolled instead of near the top. --pi-banner-top stays
// a plain CSS constant (see style.css) rather than a computed value.
const PRICE_INTEL_BANNER_TOP_OFFSET = 10;

// Originally an IntersectionObserver watching the sentinel, but that
// consistently failed to fire on slow/deliberate scrolls while working
// on fast flicks - mobile Chrome/Safari gradually resize the layout
// viewport as the URL bar collapses over the course of a slow scroll
// (vs. an almost-instant snap on a fast one), and the observer's
// geometry appears to get recomputed against that moving target
// unreliably. A plain scroll-listener + getBoundingClientRect check,
// rAF-throttled, doesn't depend on the same viewport-resize timing and
// is the classic, dependable mechanism for this exact "sticky past X"
// pattern.
function checkPriceIntelScrollFreeze() {
  if (!isSkyDealMobileView()) return;

  const sentinel = document.getElementById("priceIntelSentinel");
  const banner = document.getElementById("priceIntelFrozenBanner");
  if (!sentinel || !banner) return;

  const pastTop = sentinel.getBoundingClientRect().top < PRICE_INTEL_BANNER_TOP_OFFSET;
  banner.classList.toggle("is-visible", pastTop);
  if (pastTop) updatePriceIntelFrozenBannerText();
}

let priceIntelScrollTicking = false;
function schedulePriceIntelScrollCheck() {
  if (priceIntelScrollTicking) return;
  priceIntelScrollTicking = true;
  requestAnimationFrame(() => {
    priceIntelScrollTicking = false;
    checkPriceIntelScrollFreeze();
  });
}

window.addEventListener("scroll", schedulePriceIntelScrollCheck, { passive: true });

// Price intelligence lives inside .filter-panel in the markup (so desktop
// keeps its existing two-box left column), but on mobile .filter-panel is
// hidden entirely and only reappears inside the Filters drawer - which
// made the guide invisible on mobile. Here we physically relocate the
// card to sit in the normal results flow (above the flight list) on
// mobile, and move it back into the filter panel above Filters on
// desktop/tablet, so each breakpoint gets its native layout rather than
// one compromising for the other. On mobile it also grows a 1px sentinel
// right after itself, checked on scroll (see checkPriceIntelScrollFreeze
// above), so a frozen one-line "hero banner" version can take over once
// the full card has scrolled out of view.
function ensureMobilePriceIntelPlacement() {
  const card = document.querySelector(".smart-guide-card");
  const proResults = document.querySelector(".pro-results") || document.querySelector(".results");
  const workspace = document.querySelector(".flights-workspace");
  if (!card || !proResults || !workspace) return;

  let sentinel = document.getElementById("priceIntelSentinel");
  if (!sentinel) {
    sentinel = document.createElement("div");
    sentinel.id = "priceIntelSentinel";
    sentinel.className = "price-intel-sentinel";
  }

  if (isSkyDealMobileView()) {
    // Reassert both nodes' order unconditionally rather than only when a
    // stale equality check trips - the anchor (mobileQuickFilters, when
    // present) can appear on some renders and not others depending on
    // search state, and a guard keyed off the old anchor could reinsert
    // just the card and momentarily invert card/sentinel order. Plain
    // insertBefore calls are safe to repeat even when nothing needs to
    // move.
    const anchor = document.getElementById("mobileQuickFilters") || workspace;
    proResults.insertBefore(card, anchor);
    proResults.insertBefore(sentinel, anchor);
    ensureMobilePriceIntelFrozenBanner();
    checkPriceIntelScrollFreeze();
    return;
  }

  sentinel.remove();
  const banner = document.getElementById("priceIntelFrozenBanner");
  if (banner) banner.classList.remove("is-visible");

  const filterPanel = document.querySelector(".filter-panel");
  const filterCard = document.querySelector(".filter-card");
  if (filterPanel && card.parentElement !== filterPanel) {
    filterPanel.insertBefore(card, filterCard || filterPanel.firstChild);
  }
}

// Mobile Chrome/Safari fire resize events when the URL bar hides/shows
// mid-scroll, not just on a genuine breakpoint change - only re-run
// placement when isSkyDealMobileView()'s actual result flips, so normal
// scrolling on a real phone doesn't repeatedly touch the DOM/observer.
let lastKnownMobilePriceIntelView = null;
window.addEventListener("resize", () => {
  const nowMobile = isSkyDealMobileView();
  if (lastKnownMobilePriceIntelView === nowMobile) return;
  lastKnownMobilePriceIntelView = nowMobile;
  ensureMobilePriceIntelPlacement();
}, { passive: true });

function setMobileReturnFocusAfterOutbound() {
  if (!isSkyDealMobileView()) return;

  document.body.classList.add("mobile-return-focus");
  mobileRoundTripActiveLeg = "ret";

  const returnPanel = document.getElementById("returnResultsPanel");
  if (!returnPanel) return;

  setTimeout(() => {
    returnPanel.scrollIntoView({
      behavior: "instant",
      block: "start"
    });
  }, 220);
}

function ensureMobileRoundTripTabs() {
  const workspace = document.querySelector(".flights-workspace");
  if (!workspace) return null;

  let bar = document.getElementById("mobileRoundTripTabs");
  if (bar) return bar;

  bar = document.createElement("div");
  bar.id = "mobileRoundTripTabs";
  bar.className = "mobile-rt-tabs";
  bar.innerHTML = `
    <button type="button" class="mobile-rt-tab-btn" data-leg="out">Departure</button>
    <button type="button" class="mobile-rt-tab-btn" data-leg="ret">Return</button>
  `;

  workspace.parentNode.insertBefore(bar, workspace);

  bar.querySelectorAll(".mobile-rt-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      mobileRoundTripActiveLeg = btn.getAttribute("data-leg") === "ret" ? "ret" : "out";
      updateMobileRoundTripTabs();
      bar.scrollIntoView({ behavior: "instant", block: "start" });
    });
  });

  return bar;
}

function updateMobileRoundTripTabs() {
  const ready = isSkyDealMobileView() && hasRoundTripResultsReady();
  const outPanel = document.getElementById("outboundResultsPanel");
  const retPanel = document.getElementById("returnResultsPanel");

  document.body.classList.toggle("mobile-rt-tabs-on", ready);

  if (!ready) {
    outPanel?.classList.remove("mobile-tab-hidden");
    retPanel?.classList.remove("mobile-tab-hidden");
    return;
  }

  const bar = ensureMobileRoundTripTabs();
  if (!bar) return;

  bar.querySelectorAll(".mobile-rt-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-leg") === mobileRoundTripActiveLeg);
  });

  outPanel?.classList.toggle("mobile-tab-hidden", mobileRoundTripActiveLeg !== "out");
  retPanel?.classList.toggle("mobile-tab-hidden", mobileRoundTripActiveLeg !== "ret");
}

function tagMobileSearchFieldWrappers() {
  const card = document.querySelector(".search-card");
  if (!card) return;

  card.classList.add("mobile-compact-search-card");

  const fieldSelectors = [
    "#from",
    "#to",
    "#departureDate",
    "#returnDate",
    "#passengers",
    "#travelClass",
    "#fromInput",
    "#toInput",
    "#departInput",
    "#returnInput",
    "#passengerInput",
    "#cabinInput"
  ];

  fieldSelectors.forEach((selector) => {
    const el = document.querySelector(selector);
    if (!el) return;

    const wrapper =
      el.closest("label") ||
      el.closest(".field") ||
      el.closest(".form-field") ||
      el.closest(".input-field") ||
      el.closest(".search-field") ||
      el.parentElement;

    if (wrapper && wrapper !== card) {
      wrapper.classList.add("mobile-search-field");
    }
  });

  const fullWidthNodes = [
    document.querySelector(".trip-toggle"),
    document.querySelector("#selectedPmSummary"),
    document.querySelector("#searchBtn"),
    document.querySelector(".payment-methods-section")
  ].filter(Boolean);

  fullWidthNodes.forEach((node) => {
    node.classList.add("mobile-search-full");
  });

  const searchBtn = document.querySelector("#searchBtn");
  if (searchBtn?.parentElement && searchBtn.parentElement !== card) {
    searchBtn.parentElement.classList.add("mobile-search-full");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  tagMobileSearchFieldWrappers();
});

setTimeout(tagMobileSearchFieldWrappers, 0);

function formatMobileSummaryDate(dateValue) {
  if (!dateValue) return "";

  const raw = String(dateValue || "");
  const parts = raw.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return raw;
}

function ensureMobileSearchSummary() {
  const results = document.querySelector(".pro-results") || document.querySelector(".results");
  if (!results) return null;

  let summary = document.getElementById("mobileSearchSummary");
  if (summary) return summary;

  summary = document.createElement("div");
  summary.id = "mobileSearchSummary";
  summary.className = "mobile-search-summary";

  results.parentNode.insertBefore(summary, results);

  return summary;
}

function renderMobileSearchSummary() {
  const summary = ensureMobileSearchSummary();
  if (!summary) return;

  const from = String(lastSearchPayload?.from || fromInput?.value || "From").toUpperCase();
  const to = String(lastSearchPayload?.to || toInput?.value || "To").toUpperCase();

  const depart = formatMobileSummaryDate(lastSearchPayload?.departureDate || departInput?.value || "");
  const ret = formatMobileSummaryDate(lastSearchPayload?.returnDate || returnInput?.value || "");

  const passengers = Number(lastSearchPayload?.passengers || passengerInput?.value || 1) || 1;
  const cabin = lastSearchPayload?.travelClass || cabinInput?.value || "Economy";

  const isRound = isRoundTripModeActive();
  const dateText = isRound && ret ? `${depart} - ${ret}` : depart;

  summary.innerHTML = `
    <div class="mobile-search-summary-left">
      <div class="mobile-search-route">${safeText(from)} ${getRouteArrowForSearchState()} ${safeText(to)}</div>
      <div class="mobile-search-meta">${safeText(dateText)} · ${passengers} Adult${passengers > 1 ? "s" : ""} · ${safeText(cabin)}</div>
    </div>
    <button type="button" id="mobileEditSearchBtn" class="mobile-edit-search-btn">Edit</button>
  `;

  summary.querySelector("#mobileEditSearchBtn")?.addEventListener("click", () => {
    document.body.classList.remove("mobile-results-mode");
    const searchCard = document.querySelector(".search-card");
    if (searchCard) {
      searchCard.scrollIntoView({ behavior: "instant", block: "start" });
    }
  });
}

function enterMobileResultsMode() {
  if (!isSkyDealMobileView()) return;

  renderMobileSearchSummary();
  document.body.classList.add("mobile-results-mode");

  const summary = document.getElementById("mobileSearchSummary");
  if (summary) {
    setTimeout(() => {
      summary.scrollIntoView({ behavior: "instant", block: "start" });
    }, 150);
  }
}

function bindMobileSearchModeEvents() {
  const searchBtn = document.getElementById("searchBtn");
  if (!searchBtn || searchBtn.dataset.mobileModeBound === "true") return;

  searchBtn.dataset.mobileModeBound = "true";

  searchBtn.addEventListener("click", () => {
    if (!isSkyDealMobileView()) return;

    setTimeout(() => {
      renderMobileSearchSummary();
      document.body.classList.add("mobile-results-mode");

      const summary = document.getElementById("mobileSearchSummary");
      if (summary) {
        summary.scrollIntoView({ behavior: "instant", block: "start" });
      }
    }, 80);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindMobileSearchModeEvents();
});

setTimeout(bindMobileSearchModeEvents, 0);

function removeStandaloneSearchError() {
  const existing = document.getElementById("skySearchStandaloneError");
  if (existing) existing.remove();

  const proResults = document.querySelector(".pro-results");
  if (proResults) proResults.style.removeProperty("display");
}

function renderSearchLoadingState(message = "Comparing final prices") {
  document.body.classList.remove("search-error-mode");
  removeStandaloneSearchError();
  const outHost = document.getElementById("outboundCards") || document.getElementById("outCards");
  const retHost = document.getElementById("returnCards") || document.getElementById("retCards");

  const loadingHtml = `
    <div class="sky-search-state-card sky-search-loading-card">
      <div class="sky-spinner" aria-hidden="true"></div>
      <div class="sky-search-state-title">${safeText(message)}</div>
      <div class="sky-search-state-subtitle">
        We check fares, portals, and payment offers before showing your price.
      </div>
      <div class="sky-loading-steps" aria-live="polite">
        <span class="sky-loading-active-text">Checking live fares</span>
      </div>
    </div>
  `;

  if (outHost) outHost.innerHTML = loadingHtml;

  if (retHost && isRoundTripModeActive()) {
    retHost.innerHTML = loadingHtml;
  }

  renderPager("out");
  renderPager("ret");
  startSkyLoadingTextRotation();
}

function renderSearchErrorState(errorMessage = "We couldn’t load live flights.") {
  stopSkyLoadingTextRotation();
  document.body.classList.add("search-error-mode");
  const outHost =
    (typeof outboundList !== "undefined" && outboundList) ||
    document.getElementById("outboundCards") ||
    document.getElementById("outCards");

  const retHost =
    (typeof returnList !== "undefined" && returnList) ||
    document.getElementById("returnCards") ||
    document.getElementById("retCards");

  const rawErrorText = String(errorMessage || "");
  const lowerErrorText = rawErrorText.toLowerCase();

  const cleanMessage =
    lowerErrorText.includes("failed to fetch") ||
    lowerErrorText.includes("network error") ||
    lowerErrorText.includes("flightapi") ||
    lowerErrorText.includes("timed out")
      ? "We couldn’t load live flights"
      : rawErrorText || "We couldn’t load live flights";

  const errorHtml = `
    <div class="sky-search-state-card sky-search-error-card">
      <div class="sky-error-icon" aria-hidden="true">!</div>
      <div class="sky-search-state-title">${safeText(cleanMessage)}</div>
      <div class="sky-search-state-subtitle">
        Please try again in a few seconds. Your route and payment selections are still saved.
      </div>
      <div class="sky-search-state-actions">
        <button type="button" class="sky-state-primary-btn" id="retrySearchBtn">Try again</button>
        <button type="button" class="sky-state-secondary-btn" id="editSearchFromErrorBtn">Edit search</button>
      </div>
    </div>
  `;

  if (outHost) outHost.innerHTML = "";
  if (retHost) retHost.innerHTML = "";

  const proResults = document.querySelector(".pro-results");
  if (proResults) proResults.style.display = "none";

  let standalone = document.getElementById("skySearchStandaloneError");
  if (!standalone) {
    standalone = document.createElement("section");
    standalone.id = "skySearchStandaloneError";
    standalone.className = "sky-standalone-error-wrap";

    const searchCard = document.querySelector(".search-card");
    if (searchCard && searchCard.parentNode) {
      searchCard.insertAdjacentElement("afterend", standalone);
    } else {
      document.body.appendChild(standalone);
    }
  }

  standalone.innerHTML = errorHtml;

  standalone.querySelector("#retrySearchBtn")?.addEventListener("click", () => {
    const btn = document.getElementById("searchBtn");
    if (btn) btn.click();
  });

  standalone.querySelector("#editSearchFromErrorBtn")?.addEventListener("click", () => {
    document.body.classList.remove("mobile-results-mode");
    const searchCard = document.querySelector(".search-card");
    if (searchCard) searchCard.scrollIntoView({ behavior: "instant", block: "start" });
  });

  renderPager("out");
  renderPager("ret");
}

function setSearchButtonLoading(isLoading) {
  const btn = document.getElementById("searchBtn");
  if (!btn) return;

  if (isLoading) {
    btn.dataset.originalText = btn.textContent || btn.dataset.originalText || "Search";
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.innerHTML = `<span class="sky-btn-spinner" aria-hidden="true"></span><span>Checking prices...</span>`;
  } else {
    btn.disabled = false;
    btn.classList.remove("is-loading");
    btn.textContent = btn.dataset.originalText || "Search";
  }
}

function fixMobilePreSearchLayers() {
  const dateSelectors = [
    "#departureDate",
    "#returnDate",
    "#departInput",
    "#returnInput",
    "input[name='departureDate']",
    "input[name='returnDate']",
    "input[type='date']"
  ];

  const seen = new Set();

  dateSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((input) => {
      if (!input || seen.has(input)) return;
      seen.add(input);

      const wrapper =
        input.closest(".mobile-search-field") ||
        input.closest("label") ||
        input.closest(".field") ||
        input.closest(".form-field") ||
        input.parentElement;

      if (!wrapper) return;

      wrapper.classList.add("sky-mobile-date-wrap");
      input.classList.add("sky-mobile-date-input");

      if (!wrapper.querySelector(".sky-mobile-date-icon")) {
        const icon = document.createElement("span");
        icon.className = "sky-mobile-date-icon";
        icon.textContent = "📅";
        icon.setAttribute("aria-hidden", "true");
        wrapper.appendChild(icon);
      }
    });
  });

  document.querySelectorAll(".location-option").forEach((option) => {
    const dropdown = option.parentElement;
    if (!dropdown) return;
    dropdown.classList.add("sky-mobile-location-dropdown");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  fixMobilePreSearchLayers();
});

document.addEventListener("input", () => {
  if (typeof isSkyDealMobileView === "function" && !isSkyDealMobileView()) return;
  setTimeout(fixMobilePreSearchLayers, 0);
}, true);

document.addEventListener("focusin", () => {
  if (typeof isSkyDealMobileView === "function" && !isSkyDealMobileView()) return;
  setTimeout(fixMobilePreSearchLayers, 0);
}, true);

setTimeout(fixMobilePreSearchLayers, 0);

// The Filters sidebar has nothing to filter until a search actually
// returns real flights - showing it beforehand (or after a no-results/
// error search) reads as broken rather than just empty, so it stays
// hidden via the "pre-search" class until there's something to filter.
function setResultsPreSearch(isPreSearch) {
  const resultsSection = document.querySelector(".pro-results") || document.querySelector(".results");
  resultsSection?.classList.toggle("pre-search", isPreSearch);
}

function renderSearchNoResultsState(details = {}) {
  document.body.classList.remove("search-error-mode");
  const outHost = document.getElementById("outboundList") || document.getElementById("outboundCards") || document.getElementById("outCards");
  const retHost = document.getElementById("returnList") || document.getElementById("returnCards") || document.getElementById("retCards");

  const tripType = details.tripType || lastSearchPayload?.tripType || "one-way";
  const isRound = tripType === "round-trip";

  let title = "No flights found for this search";
  let subtitle = "Try changing your date, route, or filters and search again.";

  if (isRound && details.missingOutbound && details.missingReturn) {
    title = "No round-trip flights found";
    subtitle = "We could not find departure or return flights for these dates.";
  } else if (isRound && details.missingOutbound) {
    title = "No departure flights found";
    subtitle = "Try changing the departure date or route.";
  } else if (isRound && details.missingReturn) {
    title = "No return flights found";
    subtitle = "Try changing the return date or route.";
  }

  // Some flights existed for this route/date, but only as separate tickets
  // across two different airlines with no protection if a connection is
  // missed - we deliberately don't show those as a regular flight (see
  // CURRENT_BUGS.md item O follow-up). Tell the user that plainly instead
  // of a generic "no flights" message that reads like the route has
  // nothing at all.
  const onlyUnverifiedOptions =
    (details.missingOutbound && details.outOnlyUnverifiedOptions) ||
    (details.missingReturn && details.retOnlyUnverifiedOptions);

  if (onlyUnverifiedOptions) {
    title = "No single-airline options found";
    subtitle =
      "We found flights for this route, but only as separate tickets on different airlines with no guaranteed connection between them - so we're not showing them as a regular flight. Try a nearby date, or check airline/travel sites directly for combo fares.";
  }

  const noResultsHtml = `
    <div class="sky-search-state-card sky-search-no-results-card">
      <div class="sky-no-results-icon" aria-hidden="true">⌕</div>
      <div class="sky-search-state-title">${safeText(title)}</div>
      <div class="sky-search-state-subtitle">${safeText(subtitle)}</div>
      <div class="sky-search-state-actions">
        <button type="button" class="sky-state-primary-btn" id="editSearchFromNoResultsBtn">Edit search</button>
        <button type="button" class="sky-state-secondary-btn" id="retryNoResultsBtn">Try again</button>
      </div>
    </div>
  `;

  if (outHost) outHost.innerHTML = noResultsHtml;
  if (retHost) retHost.innerHTML = "";

  document.getElementById("editSearchFromNoResultsBtn")?.addEventListener("click", () => {
    document.body.classList.remove("mobile-results-mode");
    const searchCard = document.querySelector(".search-card");
    if (searchCard) searchCard.scrollIntoView({ behavior: "instant", block: "start" });
  });

  document.getElementById("retryNoResultsBtn")?.addEventListener("click", () => {
    const btn = document.getElementById("searchBtn");
    if (btn) btn.click();
  });

  renderPager("out");
  renderPager("ret");
}

function normalizeRawSearchErrorUI() {
  const hosts = [
    document.getElementById("outboundCards"),
    document.getElementById("outCards"),
    document.getElementById("returnCards"),
    document.getElementById("retCards")
  ].filter(Boolean);

  const hasRawError = hosts.some((host) => {
    const txt = (host.textContent || "").toLowerCase();
    return (
      txt.includes("failed to fetch flights") ||
      txt.includes("network error") ||
      txt.includes("flightapi request failed") ||
      txt.includes("flightapi request timed out")
    );
  });

  if (!hasRawError) return;

  renderSearchErrorState("We couldn’t load live flights.");
}

function installSearchErrorUiGuard() {
  if (window.__skySearchErrorUiGuardInstalled) return;
  window.__skySearchErrorUiGuardInstalled = true;

  const observer = new MutationObserver(() => {
    window.clearTimeout(window.__skySearchErrorUiGuardTimer);
    window.__skySearchErrorUiGuardTimer = window.setTimeout(normalizeRawSearchErrorUI, 30);
  });

  const targets = [
    document.getElementById("outboundCards"),
    document.getElementById("outCards"),
    document.getElementById("returnCards"),
    document.getElementById("retCards"),
    document.body
  ].filter(Boolean);

  targets.forEach((target) => {
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
  });

  normalizeRawSearchErrorUI();
}

document.addEventListener("DOMContentLoaded", () => {
  installSearchErrorUiGuard();
});

setTimeout(installSearchErrorUiGuard, 0);

function syncReturnDateAutoRoundTrip() {
  if (!returnInput || !roundTripRadio) return;

  // Keep return date tappable even when user is currently in one-way mode.
  // If user interacts with return date, switch to round-trip automatically.
  returnInput.disabled = false;
  returnInput.parentElement?.classList?.remove("disabled");
  returnInput.classList.add("sky-return-date-auto-trip");

  const activateRoundTrip = () => {
    if (!roundTripRadio.checked) {
      roundTripRadio.checked = true;
      if (oneWayRadio) oneWayRadio.checked = false;
      if (typeof toggleReturn === "function") toggleReturn();
    }
  };

  if (!returnInput.dataset.skyAutoRoundTripInstalled) {
    returnInput.dataset.skyAutoRoundTripInstalled = "true";

    ["pointerdown", "mousedown", "touchstart", "focus", "click", "change"].forEach((evt) => {
      returnInput.addEventListener(evt, activateRoundTrip, { passive: true });
    });

    returnInput.parentElement?.addEventListener("click", activateRoundTrip, true);
  }
}

function decoratePaymentTabsForMobile() {
  const modal = document.getElementById("paymentModal");
  if (!modal) return;

  const possibleTabRows = Array.from(
    modal.querySelectorAll(".tabs, .pm-tabs, .payment-tabs, [role='tablist'], .tab-row, .modal-tabs")
  );

  possibleTabRows.forEach((row) => {
    const text = (row.textContent || "").toLowerCase();
    if (!text.includes("credit") && !text.includes("debit") && !text.includes("emi")) return;

    row.classList.add("sky-payment-tabs-mobile");

    const buttons = Array.from(row.querySelectorAll("button, .tab, [role='tab'], label, div"));
    buttons.forEach((btn) => {
      const label = (btn.textContent || "").trim().toLowerCase();
      if (!label) return;
      if (label.includes("emi")) btn.classList.add("sky-payment-tab-emi");
    });

    if (!row.parentElement?.querySelector(".sky-payment-tabs-hint")) {
      const hint = document.createElement("div");
      hint.className = "sky-payment-tabs-hint";
      hint.innerHTML = `<span>Swipe for more payment types</span><span aria-hidden="true">→</span>`;
      row.parentElement?.insertBefore(hint, row.nextSibling);
    }
  });
}

function updateSelectedTripMobileClasses() {
  const hasOut = typeof selectedOutboundFlight !== "undefined" && !!selectedOutboundFlight;
  const hasRet = typeof selectedReturnFlight !== "undefined" && !!selectedReturnFlight;
  const isRound = typeof roundTripRadio !== "undefined" && !!roundTripRadio?.checked;

  document.body.classList.toggle("sky-mobile-has-outbound", isRound && hasOut);
  document.body.classList.toggle("sky-mobile-has-return", isRound && hasRet);
  document.body.classList.toggle("sky-mobile-focus-return", isRound && hasOut && !hasRet);
  document.body.classList.toggle("sky-mobile-focus-outbound", isRound && hasRet && !hasOut);
  document.body.classList.toggle("sky-mobile-trip-complete", isRound && hasOut && hasRet);
}

function ensureSelectedTripFade() {
  let fade = document.getElementById("selectedTripFade");
  if (fade) return fade;

  fade = document.createElement("div");
  fade.id = "selectedTripFade";
  document.body.appendChild(fade);
  return fade;
}

function updateSelectedTripFade() {
  const panel = document.getElementById("selectedTripPanel");
  const fade = ensureSelectedTripFade();

  if (!panel || panel.style.display === "none" || !isSkyDealMobileView()) {
    fade.style.display = "none";
    return;
  }

  const rect = panel.getBoundingClientRect();
  const fadeHeight = 56;

  fade.style.display = "block";
  fade.style.position = "fixed";
  fade.style.left = "0";
  fade.style.right = "0";
  fade.style.top = `${rect.top - fadeHeight}px`;
  fade.style.height = `${fadeHeight}px`;
  fade.style.pointerEvents = "none";
  fade.style.zIndex = "998";
  fade.style.background = "linear-gradient(to bottom, rgba(248,250,252,0), rgba(248,250,252,0.95))";
}

function installMobileUxPolish() {
  syncReturnDateAutoRoundTrip();
  decoratePaymentTabsForMobile();
  updateSelectedTripMobileClasses();
  updateSelectedTripFade();
}

document.addEventListener("DOMContentLoaded", () => {
  installMobileUxPolish();
});

// Closes a tap-opened stop tooltip (see .stopsHoverable click handler
// in renderList) when tapping anywhere else on the page.
document.addEventListener("click", (event) => {
  if (event.target.closest(".stopsHoverable")) return;
  document.querySelectorAll(".stopsHoverable.tooltip-open").forEach((el) => {
    el.classList.remove("tooltip-open");
  });
});

document.addEventListener("click", () => {
  setTimeout(installMobileUxPolish, 0);
}, true);

document.addEventListener("change", () => {
  setTimeout(installMobileUxPolish, 0);
}, true);

document.addEventListener("input", () => {
  setTimeout(installMobileUxPolish, 0);
}, true);

setInterval(installMobileUxPolish, 700);

function renderSelectedTripPanel() {
  const panel = ensureSelectedTripPanel();
  if (!panel) return;

  if (!isRoundTripModeActive()) {
    panel.style.display = "none";
    updateSelectedTripFade();
    return;
  }

  if (!selectedOutboundFlight && !selectedReturnFlight) {
    panel.style.display = "none";
    updateSelectedTripFade();
    return;
  }

  const ready = !!selectedOutboundFlight && !!selectedReturnFlight;
  const bestTripPortalInfo = ready ? getBestTripPortalInfo() : null;

  panel.style.display = "block";
  panel.innerHTML = `
    <div class="sky-trip-bar">
      <div class="sky-trip-bar-left">
        <div class="sky-trip-bar-title-row">
          <div class="sky-trip-bar-kicker">Selected trip</div>
          <div class="sky-trip-bar-status">
            ${ready ? "Best price calculated for the flights you selected." : "Select one departure and one return flight."}
          </div>
        </div>

        <div class="sky-trip-leg-grid">
          <div class="sky-trip-leg ${selectedOutboundFlight ? "is-selected" : "is-empty"}">
            <div class="sky-trip-leg-label">${selectedTripRouteLabel("out")}</div>
            <div class="sky-trip-leg-main">${selectedFlightSummary(selectedOutboundFlight, "out")}</div>
          </div>

          <div class="sky-trip-leg ${selectedReturnFlight ? "is-selected" : "is-empty"}">
            <div class="sky-trip-leg-label">${selectedTripRouteLabel("ret")}</div>
            <div class="sky-trip-leg-main">${selectedFlightSummary(selectedReturnFlight, "ret")}</div>
          </div>
        </div>

        ${ready ? formatCompactTripBestSummary() : ""}
      </div>

      <div class="sky-trip-bar-actions">
        ${
          ready
            ? `
              <button
                type="button"
                id="bookSelectedTripBtn"
                class="btn-primary sky-trip-book-btn"
                ${selectedTripCompareLoading ? "disabled" : ""}
              >
                ${
                  selectedTripCompareLoading
                    ? "Checking..."
                    : `Book with ${bestTripPortalInfo?.portal || "portal"}`
                }
              </button>

              <button
                type="button"
                id="compareSelectedTripBtn"
                class="sky-trip-compare-btn"
                ${selectedTripCompareLoading ? "disabled" : ""}
              >
                Compare all portals
              </button>
            `
            : ""
        }

        <button type="button" id="clearSelectedTripBtn" class="btn-ghost sky-trip-clear-btn">
          Clear
        </button>
      </div>
    </div>
  `;

  panel.querySelector("#clearSelectedTripBtn")?.addEventListener("click", () => {
    selectedOutboundFlight = null;
    selectedReturnFlight = null;
    document.body.classList.remove("mobile-return-focus");
    selectedTripCompareLoading = false;
    selectedTripComparison = null;
    selectedTripComparisonError = "";
    selectedTripComparisonKey = "";
    renderOutbound();
    renderReturn();
    renderSelectedTripPanel();
    renderMobileQuickFilters();
    enterMobileResultsMode();
    renderMobileResultsApp();
  });

  panel.querySelector("#bookSelectedTripBtn")?.addEventListener("click", () => {
    bookSelectedRoundTripBestPortal();
  });

  panel.querySelectorAll(".copyTripCouponBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const code = btn.getAttribute("data-code") || "";
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 1200);
      } catch (err) {
        alert(`Coupon code: ${code}`);
      }
    });
  });

  panel.querySelector("#compareSelectedTripBtn")?.addEventListener("click", () => {
    compareSelectedRoundTrip();
  });

  updateSelectedTripFade();
}

function slimFlightForTripCompare(f) {
  if (!f) return null;

  return {
    airlineName: f.airlineName || null,
    flightNumber: f.flightNumber || null,
    departureTime: f.departureTime || null,
    arrivalTime: f.arrivalTime || null,
    stops: Number(f.stops || 0),
    price: Number(f.price || f.basePrice || 0)
  };
}

async function compareSelectedRoundTrip() {
  if (!selectedOutboundFlight || !selectedReturnFlight) {
    alert("Please select both departure and return flights first.");
    return;
  }

  if (!lastSearchPayload) {
    alert("Please run a flight search first.");
    return;
  }

  selectedTripCompareLoading = true;
  renderSelectedTripPanel();

  try {
    const payload = {
      from: lastSearchPayload.from,
      to: lastSearchPayload.to,
      tripType: "round-trip",
      adults: lastSearchPayload.adults || lastSearchPayload.passengers || 1,
      passengers: lastSearchPayload.passengers || lastSearchPayload.adults || 1,
      travelClass: lastSearchPayload.travelClass || "economy",
      paymentMethods: buildSearchPaymentMethods(),
      includeGenericDisplayOffers: true,
      outboundFlight: slimFlightForTripCompare(selectedOutboundFlight),
      returnFlight: slimFlightForTripCompare(selectedReturnFlight)
    };

    const compareUrl = `${BACKEND}/compare-selected-trip`;
    const res = await fetchWithTimeout(compareUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, 60000);

    const rawText = await res.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error("[SkyDeal] compare-selected-trip returned non-JSON", {
        url: compareUrl,
        status: res.status,
        contentType: res.headers.get("content-type"),
        preview: rawText.slice(0, 500)
      });

      throw new Error(`Trip comparison returned non-JSON from backend. HTTP ${res.status}. Check console for response preview.`);
    }

    if (!res.ok || data?.meta?.error) {
      throw new Error(data?.meta?.error || `Trip comparison failed with HTTP ${res.status}`);
    }

    const comparison = data?.tripComparison;

    if (!comparison || !Array.isArray(comparison.portalPrices)) {
      throw new Error("Trip comparison response did not include portal prices.");
    }

    const comparisonFlight = {
      airlineName: "Selected trip",
      flightNumber: `${displayFlightNumber(selectedOutboundFlight)} / ${displayFlightNumber(selectedReturnFlight)}`,
      departureTime: selectedOutboundFlight.departureTime,
      arrivalTime: selectedReturnFlight.arrivalTime,
      stops: Number(selectedOutboundFlight.stops || 0) + Number(selectedReturnFlight.stops || 0),
      price: comparison.baseTotal,
      bestDeal: comparison.bestDeal || null,
      portalPrices: comparison.portalPrices || [],
      tripComparison: comparison
    };

    showPortalCompare(comparisonFlight);
  } catch (err) {
    alert(err?.message || "Could not compare this selected trip.");
  } finally {
    selectedTripCompareLoading = false;
    renderSelectedTripPanel();
  }
}

function formatLayoverDuration(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m < 0) return "";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0 && mm > 0) return `${h}h ${mm}m`;
  if (h > 0) return `${h}h`;
  return `${mm}m`;
}

function totalFlightDurationMinutes(f) {
  if (!f?.departureTime || !f?.arrivalTime) return null;
  const dep = new Date(f.departureTime).getTime();
  const arr = new Date(f.arrivalTime).getTime();
  if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr < dep) return null;
  return Math.round((arr - dep) / 60000);
}

// MMT-style: a short line with one dot per stop (no dots for non-stop).
function stopsLineHtml(stops) {
  const dots = Array.from({ length: stops }, () => `<span class="stopDot"></span>`).join("");
  return `<div class="flightStopsLine">${dots}</div>`;
}

// Lives in the card's grid row next to price, stacked MMT-style: total
// flight duration on top, a line with one dot per stop below that, then
// "N stop(s) via City[, City]" (or "Non-stop") at the bottom. Short city
// name only (e.g. "New Delhi" not "Delhi Indira Gandhi International" -
// resolved backend-side via the airport's parent place). Hover shows each
// stop's own "{duration} layover | {City}" line. No terminal/plane-change
// claim - checked FlightAPI's full schema and it has no terminal data
// anywhere; "plane change" is technically inferable (different flight
// number per segment) but true for ~98% of all connections in a live
// sample, so it would say "yes" almost every time while still
// occasionally being wrong - not worth the false precision.
function stopsBadgeHtml(f) {
  const stops = Number.isFinite(f.stops) ? f.stops : 0;
  const durationMinutes = totalFlightDurationMinutes(f);
  const durationHtml = durationMinutes != null
    ? `<div class="flightDuration">${formatLayoverDuration(durationMinutes)}</div>`
    : "";

  const layovers = Array.isArray(f?.layovers) ? f.layovers : [];
  if (stops === 0 || layovers.length === 0) {
    return `
      <div class="stops">
        ${durationHtml}
        ${stopsLineHtml(0)}
        <div>Non-stop</div>
      </div>
    `;
  }

  const cityNames = layovers.map((lo) => safeText(lo?.cityName || lo?.airportName || lo?.airportCode || "Unknown"));
  const cityList = cityNames.length > 1
    ? `${cityNames.slice(0, -1).join(", ")} and ${cityNames[cityNames.length - 1]}`
    : cityNames[0];
  const stopsCountLabel = `${stops} stop${stops > 1 ? "s" : ""}`;
  const viaLabel = `${stopsCountLabel}<span class="stopsViaCities"> via ${cityList}</span>`;

  const tooltipLines = layovers
    .map((lo, i) => {
      const dur = formatLayoverDuration(lo?.durationMinutes);
      return dur ? `${dur} layover | ${cityNames[i]}` : cityNames[i];
    })
    .join("<br/>");

  return `
    <div class="stops">
      ${durationHtml}
      <div class="stopsHoverable">
        ${stopsLineHtml(stops)}
        <div class="stopsViaLine">${viaLabel}</div>
        <div class="stopsTooltip">${tooltipLines}</div>
      </div>
    </div>
  `;
}

function flightCard(f, direction = "out") {
  const name = safeText(f.displayAirlineName || f.airlineName);
  const num = displayFlightNumber(f);
  const dep = fmtTime(f.departureTime);
  const arr = fmtTime(f.arrivalTime);

  const best = f.bestDeal;
  const cardFinalPrice = best?.applied ? best.finalPrice : f.price;
  const cardSavings = best?.applied ? getSavingsAmount(best.basePrice, best.finalPrice) : 0;

  const key = flightKey(f);
  const isRoundTrip = isRoundTripModeActive();
  const selectedForDirection = direction === "ret" ? selectedReturnFlight : selectedOutboundFlight;
  const isSelectedForDirection = isSameSelectedFlight(f, selectedForDirection);

  const bestLine = best
    ? renderBestDealSummary(best, isRoundTrip ? "round-trip-leg" : "default", isSelectedForDirection)
    : `<div class="best">${
        isRoundTrip
          ? "Select both flights to compare the full round-trip booking price."
          : "Compare portals to find the best payable price."
      }${
        isRoundTrip
          ? `<span class="selectTripRadio${isSelectedForDirection ? " is-selected" : ""}" aria-hidden="true"></span>`
          : ""
      }</div>`;

  const oneWayBestPortal = !isRoundTrip && best?.portal ? safeText(best.portal) : "";
  const oneWayActions = !isRoundTrip && oneWayBestPortal
    ? `
      <div class="oneWayCardActions">
        <button type="button" class="oneWayBookPortalBtn" data-portal="${oneWayBestPortal}">
          ${getPortalCtaLabel(oneWayBestPortal)}
        </button>
        <button type="button" class="oneWayCompareBtn">Compare portals</button>
      </div>
    `
    : "";

  return `
    <div class="card ${isSelectedForDirection ? "selected-trip-card" : ""}" data-flightkey="${key}" data-direction="${direction}">
      <div class="row">
        <div class="air">
          ${
  getAirlineLogoUrl(name)
    ? `<img class="airline-logo-img" src="${getAirlineLogoUrl(name)}" alt="${name} logo" onerror="this.outerHTML='<div class=&quot;airline-logo logo-default&quot;>${getAirlineInitials(name)}</div>';" />`
    : `<div class="airline-logo logo-default">${getAirlineInitials(name)}</div>`
}
          <div>
            <div class="airline-name">${name}</div>
            <div class="flight-number">${num}</div>
          </div>
        </div>

        <div class="timeStopsRow">
          <div class="times">${dep} → ${arr}</div>
          ${stopsBadgeHtml(f)}
        </div>

        <div class="price">
          <div>${money(cardFinalPrice)}</div>
          ${
            cardSavings > 0
              ? `<div style="font-size:12px;opacity:.65;text-decoration:line-through;">${money(f.price)}</div>`
              : ""
          }
        </div>


      </div>

      ${bestLine}
      ${oneWayActions}
    </div>
  `;
}

function renderList(el, items, direction = "out") {
  if (!el) return;
  if (!Array.isArray(items) || items.length === 0) {
    el.innerHTML = emptyStateHtml("default");
    return;
  }

  el.innerHTML = items.map((f) => flightCard(f, direction)).join("");

  el.querySelectorAll(".card:has(.selectTripRadio)").forEach((card) => {
    card.classList.add("card-selectable");
    card.addEventListener("click", () => {
      const key = card.getAttribute("data-flightkey");
      const dir = card.getAttribute("data-direction") || direction;

      const source = dir === "ret" ? returnAll : outboundAll;
      const flight = source.find((x) => flightKey(x) === key);

      if (!flight) return;

      if (dir === "ret") {
        selectedReturnFlight = flight;
      } else {
        selectedOutboundFlight = flight;
        setMobileReturnFocusAfterOutbound();
      }

      selectedTripComparison = null;
      selectedTripComparisonError = "";
      selectedTripComparisonKey = "";

      renderOutbound();
      renderReturn();
      renderSelectedTripPanel();

      if (selectedOutboundFlight && selectedReturnFlight) {
        refreshSelectedTripComparison();
      }

      scrollAfterTripSelection(dir);
    });
  });

  // :hover-only (see style.css .stopsHoverable:hover .stopsTooltip)
  // never opens on a real touchscreen - this gives mobile a tap
  // equivalent. stopPropagation so tapping the stop count doesn't
  // also select the card in round-trip mode.
  el.querySelectorAll(".stopsHoverable").forEach((hoverable) => {
    hoverable.addEventListener("click", (event) => {
      event.stopPropagation();
      const wasOpen = hoverable.classList.contains("tooltip-open");
      document.querySelectorAll(".stopsHoverable.tooltip-open").forEach((other) => {
        other.classList.remove("tooltip-open");
      });
      hoverable.classList.toggle("tooltip-open", !wasOpen);
    });
  });

  el.querySelectorAll(".bestDealCouponChip, .oneWayCopyCodeBtn").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const code = btn.getAttribute("data-code") || "";
      if (!code) return;

      const small = btn.querySelector("small");
      const originalText = small ? small.textContent : btn.textContent;

      try {
        await navigator.clipboard.writeText(code);
        if (small) {
          small.textContent = "Copied";
        } else {
          btn.textContent = "Copied";
        }

        setTimeout(() => {
          if (small) {
            small.textContent = "Copy";
          } else {
            btn.textContent = originalText || "Copy code";
          }
        }, 1400);
      } catch {
        alert(`Coupon code: ${code}`);
      }
    });
  });

  el.querySelectorAll(".oneWayBookPortalBtn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = btn.closest(".card");
      const key = card?.getAttribute("data-flightkey");
      const portal = btn.getAttribute("data-portal") || "";

      const all = [...(outboundAll || []), ...(returnAll || [])];
      const flight = all.find((x) => flightKey(x) === key);
      if (!flight || !portal) return;

      const href = buildPortalSearchUrl(portal, lastSearchPayload);
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        showPortalCompare(flight);
      }
    });
  });

  el.querySelectorAll(".oneWayCompareBtn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = btn.closest(".card");
      const key = card?.getAttribute("data-flightkey");

      const all = [...(outboundAll || []), ...(returnAll || [])];
      const flight = all.find((x) => flightKey(x) === key);

      showPortalCompare(flight || null);
    });
  });

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

// Heading text is keyed off the SAME "pre-search" signal that already
// gates the Filters/offers-panel swap and the sort/pagination visibility
// (setResultsPreSearch) - so a no-results or error search correctly falls
// back to the pre-search copy too, not just the initial page load.
function updateFlightSectionHeadings() {
  const resultsSection = document.querySelector(".pro-results") || document.querySelector(".results");
  const hasRealResults = !!resultsSection && !resultsSection.classList.contains("pre-search");

  ensureMobilePriceIntelPlacement();

  const from = resolveLocationToCode(safeText(fromInput?.value, "").trim());
  const to = resolveLocationToCode(safeText(toInput?.value, "").trim());

  const outboundTitle = document.querySelector("#outboundResultsPanel .col-head h3");
  const outboundSubtitle = document.querySelector("#outboundResultsPanel .col-head .section-subtitle");
  const outboundRouteDate = document.getElementById("outRouteDateLabel");
  const returnTitle = document.querySelector("#returnResultsPanel .col-head h3");
  const returnSubtitle = document.querySelector("#returnResultsPanel .col-head .section-subtitle");
  const returnRouteDate = document.getElementById("retRouteDateLabel");

  if (!hasRealResults || !from || !to) {
    if (outboundTitle) outboundTitle.textContent = "The flight stays the same. The final price may not.";
    if (outboundSubtitle) outboundSubtitle.textContent = "Search a route to see the best final payable price available with your payment methods.";
    if (outboundRouteDate) outboundRouteDate.textContent = "";
    if (returnTitle) returnTitle.textContent = "Return flights";
    if (returnSubtitle) returnSubtitle.textContent = "Shown only for round trips";
    if (returnRouteDate) returnRouteDate.textContent = "";
    return;
  }

  const shouldSplitRoundTrip = typeof hasRoundTripResultsReady === "function" && hasRoundTripResultsReady();
  const isRoundTrip = isRoundTripModeActive();
  const outDateLabel = selectedTripDateLabel("out");
  const retDateLabel = selectedTripDateLabel("ret");
  const fromCity = cityNameForCode(from);
  const toCity = cityNameForCode(to);

  if (outboundTitle) outboundTitle.textContent = "Your final price options";
  if (outboundSubtitle) outboundSubtitle.textContent = "Based on your selected payment methods";
  if (outboundRouteDate) {
    const routeLabel = isRoundTrip && !shouldSplitRoundTrip ? `${fromCity} ↔ ${toCity}` : `${fromCity} → ${toCity}`;
    outboundRouteDate.textContent = outDateLabel ? `${routeLabel} · ${outDateLabel}` : routeLabel;
  }

  if (returnTitle) returnTitle.textContent = "Your final price options";
  if (returnSubtitle) returnSubtitle.textContent = "Based on your selected payment methods";
  if (returnRouteDate) {
    const routeLabel = `${toCity} → ${fromCity}`;
    returnRouteDate.textContent = retDateLabel ? `${routeLabel} · ${retDateLabel}` : routeLabel;
  }
}

function renderOutbound() {
  document.body.classList.remove("search-error-mode");
  updateFlightSectionHeadings();
  const filtered = applyFlightFilters(outboundAll);
  const sorted = sortFlightsForDisplay(filtered, getSortValue(outSortSelect));
  const pageItems = slicePage(sorted, outPageIdx);
  renderList(outboundList, pageItems, "out");
  renderSelectedTripPanel();
  renderPager("out");
  updateMobileRoundTripTabs();
}
function renderReturn() {
  updateFlightSectionHeadings();
  const returnPanel = document.getElementById("returnResultsPanel");
  const flightsWorkspace = document.querySelector(".flights-workspace");
  const resultsSection = document.querySelector(".pro-results") || document.querySelector(".results");
  const shouldSplitRoundTrip = hasRoundTripResultsReady();

  resultsSection?.classList.toggle("round-trip-results-mode", shouldSplitRoundTrip);

  if (!shouldSplitRoundTrip) {
    returnPanel?.classList.add("is-hidden");
    flightsWorkspace?.classList.add("one-way");
    if (returnList) returnList.innerHTML = emptyStateHtml("return-hidden");
    renderPager("ret");
    updateMobileRoundTripTabs();
    return;
  }

  returnPanel?.classList.remove("is-hidden");
  flightsWorkspace?.classList.remove("one-way");

  const filtered = applyFlightFilters(returnAll);
  const sorted = sortFlightsForDisplay(filtered, getSortValue(retSortSelect));
  const pageItems = slicePage(sorted, retPageIdx);
  renderList(returnList, pageItems, "ret");
  renderSelectedTripPanel();
  renderPager("ret");
  updateMobileRoundTripTabs();
}

function toggleReturn() {
  updateFlightSectionHeadings();
  const show = !!roundTripRadio?.checked;
  const returnPanel = document.getElementById("returnResultsPanel");
  const flightsWorkspace = document.querySelector(".flights-workspace");
  const resultsSection = document.querySelector(".pro-results") || document.querySelector(".results");

  resultsSection?.classList.toggle("round-trip-results-mode", hasRoundTripResultsReady());

  if (!returnInput) return;

  const departVal = departInput?.value || todayISO();
  returnInput.disabled = !show;
  returnInput.parentElement?.classList?.toggle("disabled", !show);

  const shouldSplitRoundTrip = hasRoundTripResultsReady();
  returnPanel?.classList.toggle("is-hidden", !shouldSplitRoundTrip);
  flightsWorkspace?.classList.toggle("one-way", !shouldSplitRoundTrip);

  returnInput.min = departVal;

  if (show) {
    if (!returnInput.value || returnInput.value < departVal) {
      returnInput.value = addDaysISO(departVal, 7);
    }
  } else {
    selectedOutboundFlight = null;
    selectedReturnFlight = null;
    renderSelectedTripPanel();

    if (returnList) {
      returnList.innerHTML = emptyStateHtml("return-hidden");
    }
  }
}

async function handleSearch(e) {
  setSearchButtonLoading(true);
  renderSearchLoadingState();

  tagMobileSearchFieldWrappers();
  e?.preventDefault?.();

  const payload = {
    from: resolveLocationToCode(safeText(fromInput?.value, "").trim()),
to: resolveLocationToCode(safeText(toInput?.value, "").trim()),
    departureDate: toISO(departInput?.value || ""),
    returnDate: roundTripRadio?.checked ? toISO(returnInput?.value || "") : "",
    tripType: roundTripRadio?.checked ? "round-trip" : "one-way",
    passengers: Number(paxSelect?.value || 1),
    travelClass: cabinSelect?.value || "economy",

    // ✅ enable backend checkout/generic offer display layer
    includeGenericDisplayOffers: true,

    // ✅ send structured selections so backend can match bank/type correctly
    paymentMethods: buildSearchPaymentMethods(),
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

  if (
    payload.tripType === "round-trip" &&
    payload.departureDate &&
    payload.returnDate &&
    payload.returnDate < payload.departureDate
  ) {
    alert("Return date cannot be before departure date.");
    return;
  }

   outboundList.innerHTML = emptyStateHtml("loading");

  const returnPanel = document.getElementById("returnResultsPanel");
  const flightsWorkspace = document.querySelector(".flights-workspace");
  const resultsSection = document.querySelector(".pro-results") || document.querySelector(".results");

  resultsSection?.classList.remove("round-trip-results-mode");
  returnPanel?.classList.add("is-hidden");
  flightsWorkspace?.classList.add("one-way");

  if (returnList) {
    returnList.innerHTML = emptyStateHtml("return-hidden");
  }

  outPageIdx = 1;
  retPageIdx = 1;
  selectedOutboundFlight = null;
  selectedReturnFlight = null;
  mobileRoundTripActiveLeg = "out";
  renderSelectedTripPanel();

  try {
    const res = await fetchWithTimeout(`${BACKEND}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 60000);

    const json = await res.json();
    console.log("[SkyDeal] /search meta", json?.meta);

    if (!res.ok) {
      const msg = json?.meta?.error || json?.error || `Backend error (${res.status})`;
      outboundAll = [];
      returnAll = [];
      selectedOutboundFlight = null;
      selectedReturnFlight = null;
      selectedTripComparison = null;
      renderSelectedTripPanel();
      renderSearchErrorState(msg);
      renderMobileQuickFilters();
      enterMobileResultsMode();
      return;
    }

       outboundAll = Array.isArray(json?.outboundFlights) ? json.outboundFlights : [];
    returnAll = Array.isArray(json?.returnFlights) ? json.returnFlights : [];

    const missingOutbound = outboundAll.length === 0;
    const missingReturn = payload.tripType === "round-trip" && returnAll.length === 0;

    if (missingOutbound || missingReturn) {
      // FlightAPI can return real itineraries for a route/date that all get
      // excluded because none had a verified single-airline price (e.g. the
      // only "options" were separate tickets across two different airlines,
      // sold by a global aggregator, not any of our 5 target OTAs, with no
      // missed-connection protection). That's a different, more specific
      // situation than "FlightAPI simply has nothing for this route/date" -
      // see CURRENT_BUGS.md item O follow-up.
      const outRule = json?.meta?.outCarrierPriceRule;
      const retRule = json?.meta?.retCarrierPriceRule;
      const outOnlyUnverifiedOptions =
        missingOutbound && Number(outRule?.flightApiItineraries || 0) > 0 && Number(outRule?.keptWithCarrierPrice || 0) === 0;
      const retOnlyUnverifiedOptions =
        missingReturn && Number(retRule?.flightApiItineraries || 0) > 0 && Number(retRule?.keptWithCarrierPrice || 0) === 0;

      activeFilters.airlines = [];
      renderAirlineFilters();
      setResultsPreSearch(true);
      updateFlightSectionHeadings();
      renderSearchNoResultsState({
        tripType: payload.tripType,
        missingOutbound,
        missingReturn,
        outOnlyUnverifiedOptions,
        retOnlyUnverifiedOptions
      });
      return;
    }

    activeFilters.airlines = [];
    renderAirlineFilters();
    setResultsPreSearch(false);

    renderOutbound();
    renderReturn();
    // The error/catch paths below already render this; the normal
    // success path never did, leaving the mobile quick-filter chip row
    // (Non-stop/Best offer/Filter) unreachable after an ordinary
    // successful search - the only path a mobile user actually takes
    // most of the time.
    renderMobileQuickFilters();

    dismissedSuggestionKeys.clear();
    paymentSuggestions = [];
    paymentTimingInsights = [];
    guideAwaitingManualRecheck = false;
    guideAcceptedNote = null;
    lastGuideSummary = null;
    lastGuideCurrentBestPrice = null;
    lastGuideTruncated = false;
    guideSearchSummary = null;
    if (guideAcceptedNoteTimer) {
      clearTimeout(guideAcceptedNoteTimer);
      guideAcceptedNoteTimer = null;
    }
    fetchPaymentSuggestions();
  } catch (err) {
    console.error("[SkyDeal] search failed", err);

    outboundAll = [];
    returnAll = [];
    selectedOutboundFlight = null;
    selectedReturnFlight = null;
    selectedTripComparison = null;

    setResultsPreSearch(true);
    updateFlightSectionHeadings();
    renderSearchErrorState(err?.message || "We couldn’t load live flights.");
    renderMobileQuickFilters();
    enterMobileResultsMode();
    return;
  }

  finally {
    setSearchButtonLoading(false);
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
   pmTabsContainer?.addEventListener("click", (e) => {
  const toggle = e.target.closest("#includeEmiOffersToggle");
  if (!toggle) return;

  e.preventDefault();
  e.stopPropagation();

  includeEmiOffers = !includeEmiOffers;
  renderPaymentTabs();
  renderPaymentList();
  updatePaymentButtonLabel();
});

  pmClose?.addEventListener("click", closePaymentModal);
  paymentModal?.addEventListener("click", (e) => {
    if (e.target === paymentModal) closePaymentModal();
  });

  pmClear?.addEventListener("click", () => {
    selectedPaymentMethods = [];
    updatePaymentButtonLabel();
    renderPaymentList();
    // Clearing all payment methods is a "major payment-profile change"
    // (Phase 2 item 9) - give the user a clean dismissal slate rather
    // than keeping suggestions hidden from a now-irrelevant prior state.
    dismissedSuggestionKeys.clear();
    syncPaymentMethodsPostSearch();
  });

  pmDone?.addEventListener("click", () => {
    updatePaymentButtonLabel();
    closePaymentModal();
    syncPaymentMethodsPostSearch();
  });
outSortSelect?.addEventListener("change", () => {
  outPageIdx = 1;
  console.log("[SkyDeal] outbound sort changed:", getSortValue(outSortSelect));
  renderOutbound();
});

retSortSelect?.addEventListener("change", () => {
  retPageIdx = 1;
  console.log("[SkyDeal] return sort changed:", getSortValue(retSortSelect));
  renderReturn();
});
   wireFilters();
  renderAirlineFilters();

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
renderPaymentProfileCard();
ensureMobilePriceIntelPlacement();
wire();
wireLocationAutocomplete(fromInput, fromSuggestions);
wireLocationAutocomplete(toInput, toSuggestions);
wirePopularRoutes();
updatePaymentButtonLabel();

  console.log("[SkyDeal] frontend ready");
});


setTimeout(ensurePaymentEducationNudge, 0);
