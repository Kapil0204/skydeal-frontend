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

// GA4 custom events for the real product funnel (search -> payment method
// added -> book click), not just pageviews - launch checklist item 2. Guarded
// since gtag may not exist yet (script tag still loading, or blocked by an
// ad-blocker) - a tracking miss should never be able to break the app.
function trackEvent(name, params = {}) {
  if (typeof gtag === "function") gtag("event", name, params);
}

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

// A bank/app only ever appears here if it's currently selectable - this
// list is merged with whatever the backend's live-offer-based catalog
// returns (mergeMasterCatalogWithBackend()), so a bank with genuinely
// ZERO current offers (any bank's offers can lapse for a day or more,
// e.g. a booking-day-restricted coupon, or one that expired and hasn't
// been replaced yet) simply disappears from the picker entirely - a
// cardholder whose bank happens to be between offers sees no sign we
// support them at all, not "no live offer today." Founder, 2026-08-17:
// "if their credit cards are not listed at all, they'll not come back to
// the app again... we have to show all the major credit cards." First
// hit exactly this way 2026-08-04 (PNB/Standard Chartered/Canara/DBS
// added then) and again 2026-08-17 when RBL Bank's one live Ixigo offer
// (IXRBL) expired mid-session and RBL vanished from the list entirely.
// This list should stay aligned with the full bank set this app already
// recognizes elsewhere (normalizePmNameForUI below, and the backend's
// own normalizeBankName/normalizeBankDisplayName) - if the system
// already treats a bank as real enough to normalize its display name,
// it should be selectable here regardless of today's live-offer count.
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
    // Added 2026-08-04: these banks already have real, live offers in our
    // data (PNB Luxura, Standard Chartered's EaseMyTrip co-branded card,
    // Canara Bank, DBS) but weren't selectable here - a cardholder could
    // only pick "Other", which never matches a bank-specific offer, so
    // these offers were effectively unreachable by their own cardholders.
    "Punjab National Bank",
    "Standard Chartered Bank",
    "Canara Bank",
    "DBS Bank",
    // Added 2026-08-17 (see comment above the catalog): RBL Bank is the
    // bank that surfaced this whole gap - a real, major private-sector
    // card issuer, just between live offers when it disappeared. IDBI
    // Bank and J&K Bank confirmed via a live diff against the backend's
    // catalog (both had a currently-live offer that also wasn't
    // selectable here). Central Bank of India and Bank of India added
    // for consistency with the system's own recognized bank set
    // (normalizePmNameForUI below) even without a currently-live offer
    // to prove it, per the founder's "show all the major banks" direction.
    "RBL Bank",
    "IDBI Bank",
    "J&K Bank",
    "Central Bank of India",
    "Bank of India",
    "Other"
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
    // Added 2026-08-17: RBL Bank (major issuer) and J&K Bank (confirmed
    // via live diff - had a currently-live debit-card offer that wasn't
    // selectable here) - see comment above the catalog.
    "RBL Bank",
    "J&K Bank",
    // Added 2026-08-17, later: brought this category to full parity with
    // Credit Card's bank set (founder: "did we fix this just for RBL or
    // in general for all?" - answer was "partial," so closing the rest
    // properly rather than leaving it live-diff-dependent again).
    // American Express/OneCard deliberately excluded - neither is a
    // deposit-taking bank, so a debit card from either isn't a real
    // product to offer as an option.
    "Punjab National Bank",
    "Standard Chartered Bank",
    "Canara Bank",
    "DBS Bank",
    "Central Bank of India",
    "Bank of India",
    "Other"
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
    // Added 2026-08-17: RBL Bank, for consistency with Credit/Debit Card
    // above - see comment above the catalog.
    "RBL Bank",
    // Added 2026-08-17, later: full parity pass (see Debit Card comment
    // above) - same reasoning, American Express/OneCard excluded (not
    // deposit-taking banks, no net banking product to offer).
    "Punjab National Bank",
    "Standard Chartered Bank",
    "Canara Bank",
    "DBS Bank",
    "J&K Bank",
    "Central Bank of India",
    "Bank of India",
    "Other"
  ],
  "UPI": [
    "Google Pay",
    "PhonePe",
    "Paytm UPI",
    "CRED",
    "BHIM",
    // Added 2026-08-17: confirmed via live diff - MobiKwik has a
    // currently-live UPI-type offer (separate from its existing Wallet
    // entry below) that wasn't selectable here.
    "MobiKwik",
    "Other"
  ],
  "Wallet": [
    "Amazon Pay",
    "Paytm Wallet",
    "MobiKwik",
    "Freecharge",
    "Other"
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
    "Punjab National Bank",
    "Canara Bank",
    "DBS Bank",
    // Added 2026-08-17: American Express and OneCard confirmed via live
    // diff (both had a currently-live EMI offer that wasn't selectable
    // here); RBL Bank for consistency with Credit Card above.
    "American Express",
    "OneCard",
    "RBL Bank",
    // Added 2026-08-17, later: full parity pass (see Debit Card comment
    // above) - EMI is credit-card-linked, so this mirrors Credit Card's
    // now-complete bank set exactly, unlike Debit/Net Banking where
    // Amex/OneCard were deliberately excluded.
    "Standard Chartered Bank",
    "J&K Bank",
    "Central Bank of India",
    "Bank of India",
    "Other"
  ]
};
const EMI_TENURE_OPTIONS = [3, 6, 9, 12, 18, 24];

const CARD_NETWORK_OPTIONS = [
  "Visa",
  "Mastercard",
  "RuPay",
  "American Express"
];

// Per-bank network restriction, only where genuinely fixed (not just "usually
// issues X") - American Express is a closed-loop network in India: it issues
// its own cards directly and doesn't license Visa/Mastercard/RuPay the way
// other issuers do, so those three were never real choices for an Amex
// selection. Deliberately not extending this to other banks (HDFC, SBI,
// etc.) - which specific network a given card comes in varies product by
// product, not bank-wide, so a bank-level restriction there would risk
// being confidently wrong rather than just permissive.
const NETWORK_OPTIONS_BY_BANK = {
  "American Express": ["American Express"]
};

const CARD_TYPE_OPTIONS_BY_BANK = {
  "HDFC Bank": [
    "Infinia",
    "Diners Club",
    "Regalia Gold",
    "Regalia",
    "Millennia",
    "MoneyBack+",
    "Freedom",
    "Tata Neu",
    "Swiggy HDFC",
    "Marriott Bonvoy HDFC",
    "IndianOil HDFC",
    "6E Rewards (IndiGo)",
    "Other HDFC Card"
  ],
  "Axis Bank": [
    "Flipkart Axis",
    "Axis Magnus",
    "Axis Reserve",
    "Axis Vistara",
    "Axis Atlas",
    "Axis Ace",
    "Axis Neo",
    "Axis Select",
    "Axis MyZone",
    "Axis Rewards",
    "Other Axis Card"
  ],
  "ICICI Bank": [
    "Amazon Pay ICICI",
    "MMT-ICICI",
    "Emeralde",
    "Sapphiro",
    "Rubyx",
    "Coral",
    "Other ICICI Card"
  ],
  "SBI": [
    "SBI Cashback",
    "SimplyCLICK",
    "SimplySAVE",
    "Aurum",
    "Prime",
    "Elite",
    "IRCTC SBI",
    "BPCL SBI",
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
    "Kotak Royale",
    "Kotak 811",
    "League",
    "Zen",
    "Other Kotak Card"
  ],
  "American Express": [
    "Membership Rewards",
    "SmartEarn",
    "Gold Card",
    "Platinum Travel",
    "Platinum Reserve",
    "Other Amex Card"
  ],
  "IndusInd Bank": [
    "Legend",
    "Pinnacle",
    "Tiger",
    "Avios",
    "EazyDiner",
    "Other IndusInd Card"
  ],
  "IDFC First Bank": [
    "Select",
    "Wealth",
    "Millennia",
    "Mayura",
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
    "First Preferred",
    "Private",
    "Other Yes Bank Card"
  ],
  "Federal Bank": [
    "Scapia Federal",
    "Imperio",
    "Celesta",
    "Other Federal Card"
  ],
  "Bank of Baroda": [
    "BoB Premier",
    "BoB Eterna",
    "BoB Select",
    "Other Bank of Baroda Card"
  ],
  "OneCard": [
    "OneCard"
  ],
  // Added 2026-08-04 alongside the corresponding bank-picker additions above -
  // these banks already have real, live offers restricted to a named card
  // (PNB Luxura, Standard Chartered's EaseMyTrip co-branded card).
  "Punjab National Bank": [
    "PNB Luxura",
    "Other PNB Card"
  ],
  "Standard Chartered Bank": [
    "EaseMyTrip Credit Card",
    "Other Standard Chartered Card"
  ],
  "Canara Bank": [
    "Other Canara Bank Card"
  ],
  "DBS Bank": [
    "Other DBS Card"
  ],
  // Added 2026-08-17, alongside the bank-picker completion pass above -
  // same gap, same root cause: a bank missing here silently offered only
  // "Other" with no way to name the actual card. RBL Bank is a major
  // issuer with several well-known named products, listed the same way
  // as other major banks above. IDBI Bank/J&K Bank/Central Bank of
  // India/Bank of India deliberately get "Other X Card" only, matching
  // the existing Canara Bank/DBS Bank precedent just above - low
  // confidence in specific current product names for these smaller/
  // regional issuers, and a wrong guessed name is worse than an honest
  // "Other."
  "RBL Bank": [
    "RBL World Safari",
    "RBL Icon",
    "RBL Insignia",
    "RBL Play",
    "RBL ShopRite",
    "Other RBL Card"
  ],
  "IDBI Bank": [
    "Other IDBI Bank Card"
  ],
  "J&K Bank": [
    "Other J&K Bank Card"
  ],
  "Central Bank of India": [
    "Other Central Bank of India Card"
  ],
  "Bank of India": [
    "Other Bank of India Card"
  ],
  "Other": [
    "Other"
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
  // Added 2026-08-17, same gap/reasoning as CARD_TYPE_OPTIONS_BY_BANK
  // above - debit card tiers are far more standardized across Indian
  // banks than credit cards, so the same generic Classic/Platinum
  // pattern already used for AU Bank/Yes Bank/Federal Bank above is a
  // safe, realistic default for these too, not a guess specific to each.
  "RBL Bank": ["Classic", "Platinum", "Other RBL Debit Card"],
  "IDBI Bank": ["Classic", "Platinum", "Other IDBI Bank Debit Card"],
  "J&K Bank": ["Classic", "Platinum", "Other J&K Bank Debit Card"],
  "Central Bank of India": ["Classic", "Platinum", "Other Central Bank of India Debit Card"],
  "Bank of India": ["Classic", "Platinum", "Other Bank of India Debit Card"],
  "Punjab National Bank": ["Classic", "Platinum", "Other PNB Debit Card"],
  "Standard Chartered Bank": ["Classic", "Platinum", "Other Standard Chartered Debit Card"],
  "Canara Bank": ["Classic", "Platinum", "Other Canara Bank Debit Card"],
  "DBS Bank": ["Classic", "Platinum", "Other DBS Debit Card"],
  "Other": ["Other"]
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
const paxField = document.getElementById("paxField");
const paxTriggerBtn = document.getElementById("paxTriggerBtn");
const paxTriggerLabel = document.getElementById("paxTriggerLabel");
const paxPanel = document.getElementById("paxPanel");
const paxPanelNote = document.getElementById("paxPanelNote");
const paxDoneBtn = document.getElementById("paxDoneBtn");
const paxAdultsCount = document.getElementById("paxAdultsCount");
const paxChildrenCount = document.getElementById("paxChildrenCount");
const paxInfantsCount = document.getElementById("paxInfantsCount");
const cabinSelect = document.getElementById("cabinSelect");

// Adults/Children/Infants state - replaces the old flat #paxSelect dropdown.
// Caps: adults 1-9, children 0-8, infants 0..adults (max 1 lap infant per
// adult, standard OTA rule).
let paxState = { adults: 1, children: 0, infants: 0 };

function formatPaxSummaryLabel({ adults, children, infants }) {
  const parts = [];
  if (adults > 0) parts.push(`${adults} Adult${adults > 1 ? "s" : ""}`);
  if (children > 0) parts.push(`${children} Child${children > 1 ? "ren" : ""}`);
  if (infants > 0) parts.push(`${infants} Infant${infants > 1 ? "s" : ""}`);
  return parts.join(", ") || "1 Adult";
}

function renderPaxPanel() {
  if (paxAdultsCount) paxAdultsCount.textContent = String(paxState.adults);
  if (paxChildrenCount) paxChildrenCount.textContent = String(paxState.children);
  if (paxInfantsCount) paxInfantsCount.textContent = String(paxState.infants);
  if (paxTriggerLabel) paxTriggerLabel.textContent = formatPaxSummaryLabel(paxState);

  const adultsMinusBtn = paxPanel?.querySelector('[data-pax-type="adults"][data-pax-delta="-1"]');
  const adultsPlusBtn = paxPanel?.querySelector('[data-pax-type="adults"][data-pax-delta="1"]');
  const childrenMinusBtn = paxPanel?.querySelector('[data-pax-type="children"][data-pax-delta="-1"]');
  const childrenPlusBtn = paxPanel?.querySelector('[data-pax-type="children"][data-pax-delta="1"]');
  const infantsMinusBtn = paxPanel?.querySelector('[data-pax-type="infants"][data-pax-delta="-1"]');
  const infantsPlusBtn = paxPanel?.querySelector('[data-pax-type="infants"][data-pax-delta="1"]');

  if (adultsMinusBtn) adultsMinusBtn.disabled = paxState.adults <= 1;
  if (adultsPlusBtn) adultsPlusBtn.disabled = paxState.adults >= 9;
  if (childrenMinusBtn) childrenMinusBtn.disabled = paxState.children <= 0;
  if (childrenPlusBtn) childrenPlusBtn.disabled = paxState.children >= 8;
  if (infantsMinusBtn) infantsMinusBtn.disabled = paxState.infants <= 0;
  if (infantsPlusBtn) infantsPlusBtn.disabled = paxState.infants >= paxState.adults;

  if (paxPanelNote) {
    const noteLines = [];
    // Infant fare isn't in the shown price today - the flight-search
    // provider doesn't return one for a lap infant, so we can't reflect it
    // here. Airlines typically add a small infant fee at booking, not at
    // search time, so this is disclosure rather than a bug workaround.
    if (paxState.infants > 0) {
      noteLines.push("Infant fees aren't included in this price - the airline may add them when you book.");
    }
    if (paxState.infants >= paxState.adults && paxState.adults > 0) {
      noteLines.push("Each infant must travel with an adult - add another adult for more infants.");
    }

    if (noteLines.length) {
      paxPanelNote.textContent = noteLines.join(" ");
      paxPanelNote.classList.add("visible");
    } else {
      paxPanelNote.textContent = "";
      paxPanelNote.classList.remove("visible");
    }
  }
}

function openPaxPanel() {
  paxPanel?.classList.add("open");
  paxTriggerBtn?.setAttribute("aria-expanded", "true");
}

function closePaxPanel() {
  paxPanel?.classList.remove("open");
  paxTriggerBtn?.setAttribute("aria-expanded", "false");
}

function wirePaxSelector() {
  if (!paxTriggerBtn || !paxPanel) return;

  paxTriggerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (paxPanel.classList.contains("open")) {
      closePaxPanel();
    } else {
      openPaxPanel();
    }
  });

  paxPanel.addEventListener("click", (e) => {
    const btn = e.target.closest(".pax-step-btn");
    if (!btn) return;
    const type = btn.getAttribute("data-pax-type");
    const delta = Number(btn.getAttribute("data-pax-delta"));
    if (!type || !Number.isFinite(delta)) return;

    if (type === "adults") {
      paxState.adults = Math.min(9, Math.max(1, paxState.adults + delta));
      // Decrementing adults below the current infant count would leave a
      // stale infants value (more infants than adults to hold them) - clamp
      // infants down to match.
      if (paxState.infants > paxState.adults) paxState.infants = paxState.adults;
    } else if (type === "children") {
      paxState.children = Math.min(8, Math.max(0, paxState.children + delta));
    } else if (type === "infants") {
      paxState.infants = Math.min(paxState.adults, Math.max(0, paxState.infants + delta));
    }

    renderPaxPanel();
  });

  paxDoneBtn?.addEventListener("click", () => closePaxPanel());

  document.addEventListener("click", (e) => {
    if (!paxPanel.classList.contains("open")) return;
    if (paxField?.contains(e.target)) return;
    closePaxPanel();
  });

  renderPaxPanel();
}
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
const paymentPromptCard = document.getElementById("paymentPromptCard");
const paymentPromptBtnLabel = document.getElementById("paymentPromptBtnLabel");
const paymentPromptTitle = document.getElementById("paymentPromptTitle");
const paymentPromptSub = document.getElementById("paymentPromptSub");
const paymentPromptCountEl = document.getElementById("paymentPromptCount");

const paymentModal = document.getElementById("paymentModal");
const pmClose = document.getElementById("pmClose");
const pmList = document.getElementById("pmList");
const pmClear = document.getElementById("pmClear");
const pmDone = document.getElementById("pmDone");

// Tabs container
const pmTabsContainer = document.querySelector(".pm-tabs");
const pmSearchInput = document.getElementById("pmSearch");
const pmSearchClearBtn = document.getElementById("pmSearchClear");
// Payment details editor
let editingPaymentIndex = null;
// Filters the bank/card list across ALL categories at once, not just the
// active tab (2026-08-17 - typing "hdfc" should surface it under Credit
// Card, Debit Card and Net Banking together, see renderPaymentList()).
// Reset on every modal open and every category switch (see
// openPaymentModal() and renderPaymentTabs()) so a stale filter never
// silently hides everything on the next tab/open (2026-08-16, founder
// catch: "too much scrolling and finding to locate your payment option").
let pmSearchQuery = "";

// ---------- State ----------
let paymentOptions = {}; // { "Credit Card":[...], ... }
let paymentOfferCounts = {}; // { "Credit Card": { "HDFC Bank": 3, ... }, ... } — how many live offers back each entry
let activePaymentType = "Credit Card";
let includeEmiOffers = false;

// ✅ Backward-compatible richer objects:
// { type, name, provider, network, cardFamily, cardVariant, isCorporate, tenureMonths }
let selectedPaymentMethods = [];

// Persists the user's payment profile (methods + EMI toggle) across visits
// via localStorage, so a returning user's FIRST search already shows their
// real personalized price instead of requiring "Add how you pay" every
// single time. Only ever stores method labels already visible in the UI
// (e.g. "HDFC Bank", "UPI") - never card numbers, CVVs, or any actual
// payment credential, so this carries no more sensitivity than a
// "remember my preferred airline" setting.
const PAYMENT_PROFILE_STORAGE_KEY = "skydeal_payment_profile_v1";
// Stale profiles (e.g. a card the user no longer holds) shouldn't silently
// resurrect forever - 180 days balances "actually useful across a normal
// booking-research window" against "not a permanent, forgotten setting".
const PAYMENT_PROFILE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function savePaymentProfileToStorage() {
  try {
    const payload = {
      v: 1,
      savedAt: Date.now(),
      selectedPaymentMethods,
      includeEmiOffers
    };
    localStorage.setItem(PAYMENT_PROFILE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // localStorage can throw (Safari private mode, storage disabled/full,
    // etc.) - persistence is a nice-to-have, never something that should
    // break the app if it fails.
    console.warn("[SkyDeal] could not save payment profile", err);
  }
}

// Validates each stored method has the minimum shape the rest of the app
// already assumes (isSelected/buildSearchPaymentMethods key off type+name) -
// deliberately conservative: a malformed/tampered/future-shape entry is
// dropped rather than passed through and causing a confusing downstream
// bug much later.
function isValidStoredPaymentMethod(m) {
  return (
    m &&
    typeof m === "object" &&
    typeof m.type === "string" && m.type.trim() &&
    typeof m.name === "string" && m.name.trim()
  );
}

function loadPaymentProfileFromStorage() {
  try {
    const raw = localStorage.getItem(PAYMENT_PROFILE_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    const age = Date.now() - Number(parsed.savedAt || 0);
    if (!Number.isFinite(age) || age < 0 || age > PAYMENT_PROFILE_MAX_AGE_MS) {
      localStorage.removeItem(PAYMENT_PROFILE_STORAGE_KEY);
      return;
    }

    const methods = Array.isArray(parsed.selectedPaymentMethods)
      ? parsed.selectedPaymentMethods.filter(isValidStoredPaymentMethod)
      : [];

    selectedPaymentMethods = methods;
    includeEmiOffers = parsed.includeEmiOffers === true;
  } catch (err) {
    console.warn("[SkyDeal] could not load payment profile", err);
  }
}

let outboundAll = [];
let returnAll = [];
let lastSearchPayload = null;

// Bumped on every new search; a page-2 prefetch (see prefetchNextPage)
// captures the value at kickoff and checks it still matches before
// merging results in, so a stale prefetch from an abandoned search can
// never clobber a newer search's results.
let searchGeneration = 0;

// Phase 1 intelligent payment guide state.
let paymentGuideState = "idle"; // idle | loading | ready | error
// Which step the "loading" banner is currently describing - "repricing"
// while an already-loaded search is being repriced against the current
// payment methods (fast, in-memory - the flight cards' own spinners),
// "suggestions" while separately checking whether some other method not
// yet added would help further (the slower candidate-loop call). Both
// steps used to share one static "Checking for a better way to pay..."
// message, so once the reprice finished and the cards settled on their
// final price, the banner gave no visible signal that a *second*,
// separate check was now running - it looked like the same message
// just hadn't caught up yet (founder catch, 2026-07-22). Splitting the
// copy by phase means the banner text itself visibly changes the
// moment the reprice hands off to the suggestions check.
let guideLoadingPhase = "suggestions"; // "repricing" | "suggestions"
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
// Bumped on every applyPaymentSuggestion call - lets an in-flight accept's
// finalize step detect it's been superseded by a newer one and skip
// firing a now-stale fetchPaymentSuggestions() call (see applyPaymentSuggestion).
let guideAcceptGeneration = 0;

// Phase 2 - the backend's own summary from the most recent
// /payment-suggestions response (selectedPaymentMethodCount,
// matchedOfferCount, isOptimised), used to enrich the "already optimised"
// state. Backend-authoritative; not recomputed client-side.
let lastGuideSummary = null;
let lastGuideCurrentBestPrice = null;
// Sairro decode priority hierarchy (2026-08-08) - the backend's single
// ordered message (Tier 1 exact match > Tier 2 same-bank nearby > Tier 3
// unlocks soon > Tier 4 fallback reassurance), replacing the old
// suggestions/timingInsights split as the primary "ready" state's
// content. Null when nothing is selected yet, or if the backend's own
// computation failed defensively - both cases fall back to the prior
// suggestions-based rendering. See DECISIONS.md.
let lastPrimaryDecodeMessage = null;
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
  airlines: [],
  departureAirports: [], // one-way mode only
  arrivalAirports: [], // one-way mode only
  out: { departureAirports: [], arrivalAirports: [] }, // round-trip onward leg
  ret: { departureAirports: [], arrivalAirports: [] } // round-trip return leg
};

const PAGE_SIZE = 40;

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

// resolveLocationToCode() falls back to the raw uppercased input when
// nothing matches (see its last line) - that fallback exists so a field
// is never silently blanked, but it means a typo or an unrecognized city
// silently becomes garbage the backend forwards straight to FlightAPI
// (QA, 2026-08-12: reproduced live - an unresolved value took ~35s to
// fail with a 500, instead of a fast, clear local error). This checks
// whether resolution actually found a real airport, so handleSearch can
// reject before ever calling the backend.
function isKnownAirportCode(code) {
  const upper = String(code || "").trim().toUpperCase();
  if (!upper) return false;
  return AIRPORTS.some((x) => x.code === upper);
}

function cityNameForCode(code) {
  const upper = String(code || "").trim().toUpperCase();
  if (!upper) return "";
  const match = AIRPORTS.find((x) => x.code === upper);
  return match?.city || upper;
}

// Distinct from cityNameForCode - needed once a search can span more than
// one airport per city (see METRO_AIRPORT_GROUPS in the backend, e.g.
// Mumbai = BOM + NMI): the city name alone can't tell two same-city
// airports apart, but the airport's own name can.
function airportNameForCode(code) {
  const upper = String(code || "").trim().toUpperCase();
  if (!upper) return "";
  const match = AIRPORTS.find((x) => x.code === upper);
  return match?.name || upper;
}

// Short, disambiguating city label for flight-card display when a search
// spans more than one airport per city (see METRO_AIRPORT_GROUPS,
// backend) - a full official airport name (airportNameForCode) is too
// long for an inline card label, and airports.js's own "city" field is
// already disambiguating for most groups (BOM->"Mumbai" vs NMI->"Navi
// Mumbai", DEL->"Delhi" vs DXN->"Noida") but not all: GOI and GOX both
// say "Goa", and HDO's own city field repeats its full verbose name.
// Overridden here for display only - the underlying airports.js record
// (used for search/autocomplete) is untouched. Filters keep the full
// airport name (airportNameForCode) since disambiguation there has more
// room and benefits from the fuller detail.
const METRO_CITY_LABEL_OVERRIDES = {
  GOI: "Goa (Dabolim)",
  GOX: "Goa (Mopa)",
  HDO: "Hindon"
};

function metroCityLabelForCode(code) {
  const upper = String(code || "").trim().toUpperCase();
  return METRO_CITY_LABEL_OVERRIDES[upper] || cityNameForCode(upper);
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

// Pulls the date straight off the flight's own departureTime rather than
// lastSearchPayload - works regardless of whether this is the outbound or
// return leg, no direction guessing needed.
function fmtDateFromISO(t) {
  if (!t) return "";
  const datePart = String(t).split("T")[0];
  const d = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
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

function renderBestDealSummary(bestDeal, context = "default", isSelected = false, actionsHtml = "") {
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
  const payment = getOfferAwarePaymentLabelForRow(bestDeal);
  const type = bestDeal.offerTypeLabel ? safeText(bestDeal.offerTypeLabel) : "";
  // Suppressed when the payment label above already reads "X's own
  // discount (any payment method)" - "Checkout offer" right after that
  // would just repeat the same fact (2026-08-12 texty-line cleanup).
  const showType = type && type.toLowerCase() !== "payment offer" && !isNonPaymentOfferRow(bestDeal);
  const showCouponChip = !isRoundTripLeg;
  const portalLine = `Best price on ${portal}`;
  const tiedWith = Array.isArray(bestDeal.tiedWithPortals) ? bestDeal.tiedWithPortals : [];
  const tiedNote = tiedWith.length > 0
    ? `<div class="bestDealTiedNote">Same price on ${tiedWith.map((p) => safeText(p)).join(", ")}</div>`
    : "";

  return `
    <div class="bestDealBanner">
      <div class="bestDealTopRow">
        <div>
          <div class="bestDealTop">${finalPrice}</div>
          <div class="bestDealPortal">${portalLine}</div>
          ${tiedNote}
        </div>
        ${savings > 0 ? `<div class="bestDealSave">Save ${money(savings)}</div>` : ""}
        ${radioHtml}
      </div>

      <div class="bestDealMeta">
        Base ${basePrice}
        ${savings > 0 ? ` • Save ${money(savings)}` : ""}
        ${payment ? ` • ${payment}` : ""}
        ${showType ? ` • ${type}` : ""}
        ${isRoundTripLeg ? " • Estimated" : ""}
      </div>

      ${
        (code && showCouponChip) || actionsHtml
          ? `
            <div class="bestDealCouponActionsRow">
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
              ${actionsHtml}
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

// "No payment restriction" on its own reads like a technical caveat, and
// worse, if a user's own bank/card offer didn't apply, seeing nothing else
// here reads as "we found nothing for you" even when a real discount (just
// not a payment-specific one) is the one actually applied to the price
// shown. Say so plainly and reassuringly instead.
//
// Matches by offer-type PREFIX, not an exact string - the backend emits
// several different labels for "not tied to a specific bank/card"
// (confirmed in source: "Checkout offer", "Checkout coupon", "Portal offer
// (no payment required)", "Airline offer"). The previous check only
// matched "checkout offer"/"checkout" verbatim, so a real "Checkout
// coupon" or "Portal offer" deal - both genuinely emitted - fell through
// to the raw "No payment restriction" label instead of this one. Same bug
// class as getInfoBadgeLabel's dead string check found earlier.
function getOfferAwarePaymentLabelForRow(item = {}) {
  const baseLabel = getOfferAwarePaymentLabel(item);
  const isNoRestriction = /^no (payment )?restriction/i.test(baseLabel.trim());
  const offerType = String(item.offerTypeLabel || "").trim().toLowerCase();
  const isNonPaymentOffer = /^(checkout|portal|airline)\b/.test(offerType);

  // Shortened from "X's own discount - already applied, works with any
  // payment method" (2026-08-12, flagged too texty on the flight card) -
  // "already applied" is redundant (it's shown as applied by definition)
  // and "(any payment method)" says the same thing as the longer clause
  // in far less space.
  if (isNoRestriction && isNonPaymentOffer) {
    return `${safeText(item.portal)}'s own discount (any payment method)`;
  }
  return baseLabel;
}

// True when getOfferAwarePaymentLabelForRow already used the compact
// "X's own discount (any payment method)" phrasing - in that case the
// offer-type label (e.g. "Checkout offer") right after it is redundant,
// since "own discount" already says the same thing.
function isNonPaymentOfferRow(item = {}) {
  const baseLabel = getOfferAwarePaymentLabel(item);
  const isNoRestriction = /^no (payment )?restriction/i.test(baseLabel.trim());
  const offerType = String(item.offerTypeLabel || "").trim().toLowerCase();
  return isNoRestriction && /^(checkout|portal|airline)\b/.test(offerType);
}

function getPortalCtaLabel(portal) {
  return `Book with ${safeText(portal)}`;
}

function getOtherOffersButtonLabel(portal, count = 0) {
  return count > 0 ? `${count} more offer${count === 1 ? "" : "s"}` : "More offers";
}

function getOtherOffersHideLabel(portal, count = 0) {
  return count > 0 ? `Hide ${count} more offer${count === 1 ? "" : "s"}` : "Hide offers";
}

function getInfoBadgeLabel(io) {
  const raw = String(io?.infoLabel || "").trim().toLowerCase();
  // Must match the backend's actual string (index.js: infoLabel: isSpecificFamilyInfoOnly
  // ? "Specific card required" : ...) - this previously checked for "specific card type
  // required", a string the backend has never sent, so this whole friendly-naming branch
  // was silently dead code (found 2026-08-04 while investigating a card-variant decode bug).
  if (raw !== "specific card required") return safeText(io?.infoLabel, "");

  const title = String(io?.title || "");
  // `match` is what's searched for in the offer's own title text; `label` is
  // what's shown. These differ because real scraped titles don't always
  // keep the bank name and product name adjacent (e.g. "Punjab National
  // Bank Luxura Credit Cards Sale" doesn't contain "PNB Luxura" as a
  // substring) - confirmed live 2026-08-04 when this first shipped with
  // "PNB Luxura" as the match term and silently never fired. Matching on
  // just the distinctive product word avoids the same gap recurring for
  // every other bank+product pair below.
  const knownCards = [
    { match: "Flipkart Axis", label: "Flipkart Axis" },
    { match: "Amazon Pay", label: "Amazon Pay ICICI" },
    { match: "Sbi Cashback", label: "SBI Cashback" },
    { match: "Tata Neu", label: "Tata Neu" },
    { match: "Infinia", label: "Infinia" },
    { match: "Regalia Gold", label: "Regalia Gold" },
    { match: "Regalia", label: "Regalia" },
    { match: "Millennia", label: "Millennia" },
    { match: "Axis Atlas", label: "Axis Atlas" },
    { match: "Axis Vistara", label: "Axis Vistara" },
    { match: "Axis Ace", label: "Axis Ace" },
    { match: "Axis Magnus", label: "Axis Magnus" },
    { match: "Scapia", label: "Scapia Federal" },
    { match: "SimplyCLICK", label: "SimplyCLICK" },
    { match: "SimplySAVE", label: "SimplySAVE" },
    { match: "TravelOne", label: "HSBC TravelOne" },
    { match: "Myntra", label: "Myntra Kotak" },
    { match: "Membership Rewards", label: "Membership Rewards" },
    { match: "SmartEarn", label: "SmartEarn" },
    { match: "Legend", label: "IndusInd Legend" },
    { match: "Pinnacle", label: "IndusInd Pinnacle" },
    { match: "Eterna", label: "BoB Eterna" },
    { match: "Luxura", label: "PNB Luxura" },
    { match: "OneCard", label: "OneCard" }
  ];

  const found = knownCards.find((k) => title.toLowerCase().includes(k.match.toLowerCase()));
  return found ? `Needs ${found.label} credit card` : "Specific card required";
}

function isDomesticSearchTrip() {
  const from = String(lastSearchPayload?.from || "").toUpperCase();
  const to = String(lastSearchPayload?.to || "").toUpperCase();
  if (!from || !to) return null;
  return INDIAN_IATA_CODES.has(from) && INDIAN_IATA_CODES.has(to);
}

// Some "info" offers on a portal are flagged with a generic backend
// label (e.g. "Requires different card/payment") even when the real
// reason is a trip-type mismatch (an international-only offer showing
// up on a domestic search, or vice versa) - no card swap fixes that.
// Detected from the offer's own text since the backend doesn't send a
// structured flag for it.
function isInfoOfferTripMismatch(io) {
  const domestic = isDomesticSearchTrip();
  if (domestic === null) return false;

  const text = `${io?.title || ""} ${io?.rawDiscount || ""}`.toLowerCase();
  const mentionsInternational = /\binternational\b/.test(text);
  const mentionsDomestic = /\bdomestic\b/.test(text);

  if (domestic && mentionsInternational && !mentionsDomestic) return true;
  if (!domestic && mentionsDomestic && !mentionsInternational) return true;
  return false;
}

function getEffectiveInfoBadge(io) {
  if (isInfoOfferTripMismatch(io)) {
    return { label: "Not valid for this trip", mismatch: true };
  }
  return { label: getInfoBadgeLabel(io), mismatch: false };
}

// Backend's paymentHint is often a near-duplicate of the offer title
// (e.g. title "Kotak Mahindra Bank Credit Card No-Cost EMI on Domestic
// Flights" + hint "Kotak Mahindra Bank • Kotak Mahindra Bank Credit
// Card No-Cost EMI"). Only render the hint when it adds information
// the title doesn't already say.
function isHintRedundantWithTitle(hint, title) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const hWords = norm(hint).split(" ").filter(Boolean);
  if (!hWords.length) return false;
  const t = norm(title);
  const matched = hWords.filter((w) => t.includes(w)).length;
  return matched / hWords.length >= 0.7;
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

  // Exact matches first (real usage always sets .value to one of these
  // literally, including the "-desc" variants only reachable by tapping
  // an already-active mobile sort chip a second time - see
  // ensureMobileQuickFilters) - the fuzzy substring checks below only
  // exist as a defensive fallback for a selectedText-only path with no
  // matching value attribute, and would otherwise misfire on these:
  // e.g. "price-desc" contains "price" and would wrongly resolve to the
  // ascending sort if that check ran first.
  const exactValues = [
    "price-asc", "price-desc",
    "departure-asc", "departure-desc",
    "arrival-asc", "arrival-desc",
    "savings-desc"
  ];
  if (exactValues.includes(raw)) return raw;

  if (
    raw.includes("cost") ||
    raw.includes("price") ||
    raw.includes("low")
  ) return "price-asc";

  if (raw.includes("arrival")) return "arrival-asc";

  if (
    raw.includes("departure") ||
    raw.includes("early")
  ) return "departure-asc";

  if (
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

function applyFlightFilters(items, leg) {
  const list = Array.isArray(items) ? [...items] : [];
  // Airports are the only per-leg filter (see activeFilters.out/.ret) - a
  // round-trip's return leg "departure" is the outbound's destination
  // city, so it needs its own airport values rather than sharing the
  // outbound leg's. Every other filter (nonStop, bestOffer, airlines,
  // timeSlots) intentionally stays shared across both legs.
  const airportFilters = leg ? activeFilters[leg] : activeFilters;

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

    if (
      Array.isArray(airportFilters.departureAirports) &&
      airportFilters.departureAirports.length > 0 &&
      !airportFilters.departureAirports.includes(String(flight?.departureAirportCode || ""))
    ) {
      return false;
    }

    if (
      Array.isArray(airportFilters.arrivalAirports) &&
      airportFilters.arrivalAirports.length > 0 &&
      !airportFilters.arrivalAirports.includes(String(flight?.arrivalAirportCode || ""))
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

// Only meaningfully different from a single entry when the searched city
// is part of a multi-airport metro group (see METRO_AIRPORT_GROUPS,
// backend index.js) - e.g. Mumbai searches can return flights tagged
// BOM or NMI. A normal single-airport route yields exactly one code here,
// and the caller hides the filter section entirely in that case.
function getAvailableAirportCodes(field, pool) {
  const all = Array.isArray(pool) ? pool : [...(outboundAll || []), ...(returnAll || [])];
  return [...new Set(all.map((f) => String(f?.[field] || "").trim()).filter(Boolean))]
    .sort((a, b) => airportNameForCode(a).localeCompare(airportNameForCode(b)));
}

// How many flights in the same pool match each airport code - shown as a
// count badge next to the airport name (MMT-style), round-trip journey
// groups only (see renderAirportFilterGroup's showCount param).
function getAirportCodeCounts(field, pool) {
  const all = Array.isArray(pool) ? pool : [...(outboundAll || []), ...(returnAll || [])];
  const counts = {};
  all.forEach((f) => {
    const code = String(f?.[field] || "").trim();
    if (!code) return;
    counts[code] = (counts[code] || 0) + 1;
  });
  return counts;
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

// Shared by both the Departure and Arrival Airports filter groups (see
// index.html) - only rendered/visible at all when 2+ distinct airports
// are actually present, since a normal single-airport route has nothing
// to filter and showing a lone always-checked-by-default option would
// just be clutter. Mirrors renderAirlineFilters()'s dynamic-from-results
// pattern exactly.
//
// filterState/pool (2026-08-20) let the same group renderer serve both
// one-way mode (defaults: reads/writes activeFilters directly, pools both
// legs' flights together) and round-trip mode (each leg passes its own
// activeFilters.out/.ret and its own outboundAll/returnAll) - see
// renderAirportFilters() below. Returns whether the group ended up
// visible, so a round-trip journey's outer wrapper can hide itself when
// neither of its two sub-groups has anything to show.
//
// showCount (2026-08-20) adds a flight-count badge next to each airport
// name (MMT-style) - used for the round-trip journey groups, which each
// sit behind a Departure/Arrival toggle (see renderAirportFilters() and
// wireAirportToggles()) rather than showing both lists at once, so full
// names have the sidebar's full ~220px width to themselves. An earlier
// attempt showed both lists side by side with codes only - user-tested
// as hard to read ("shortforms aren't working"), replaced same-day.
function renderAirportFilterGroup({ hostId, sectionId, field, activeKey, filterState, pool, showCount }) {
  const host = document.getElementById(hostId);
  const section = document.getElementById(sectionId);
  if (!host || !section) return false;

  const state = filterState || activeFilters;
  const codes = getAvailableAirportCodes(field, pool);

  if (codes.length < 2) {
    section.style.display = "none";
    state[activeKey] = [];
    host.innerHTML = "";
    return false;
  }

  const counts = showCount ? getAirportCodeCounts(field, pool) : null;

  section.style.display = "";
  host.innerHTML = codes.map((code) => {
    const fullName = airportNameForCode(code);
    return `
    <label class="filter-option${showCount ? " filter-option-airport" : ""}">
      <span class="filter-option-label" ${showCount ? `title="${safeText(fullName)}"` : ""}>
        <input type="checkbox" class="${hostId}-option" value="${safeText(code)}" ${
          state[activeKey].includes(code) ? "checked" : ""
        } />
        <span>${safeText(fullName)}</span>
      </span>
      ${counts ? `<span class="filter-airport-count">${counts[code] || 0}</span>` : ""}
    </label>
  `;
  }).join("");

  host.querySelectorAll(`.${hostId}-option`).forEach((cb) => {
    cb.addEventListener("change", () => {
      state[activeKey] = [...host.querySelectorAll(`.${hostId}-option:checked`)]
        .map((x) => x.value);

      outPageIdx = 1;
      retPageIdx = 1;
      renderOutbound();
      renderReturn();
    });
  });

  return true;
}

function renderAirportFilters() {
  const outGroup = document.getElementById("outAirportFilterGroup");
  const retGroup = document.getElementById("retAirportFilterGroup");

  if (!isRoundTripModeActive()) {
    if (outGroup) outGroup.style.display = "none";
    if (retGroup) retGroup.style.display = "none";

    renderAirportFilterGroup({
      hostId: "departureAirportFilters",
      sectionId: "departureAirportFilterGroup",
      field: "departureAirportCode",
      activeKey: "departureAirports"
    });
    renderAirportFilterGroup({
      hostId: "arrivalAirportFilters",
      sectionId: "arrivalAirportFilterGroup",
      field: "arrivalAirportCode",
      activeKey: "arrivalAirports"
    });
    return;
  }

  const flatOut = document.getElementById("departureAirportFilterGroup");
  const flatRet = document.getElementById("arrivalAirportFilterGroup");
  if (flatOut) flatOut.style.display = "none";
  if (flatRet) flatRet.style.display = "none";

  const outDepVisible = renderAirportFilterGroup({
    hostId: "outDepartureAirportFilters",
    sectionId: "outDepartureAirportFilterGroup",
    field: "departureAirportCode",
    activeKey: "departureAirports",
    filterState: activeFilters.out,
    pool: outboundAll,
    showCount: true
  });
  const outArrVisible = renderAirportFilterGroup({
    hostId: "outArrivalAirportFilters",
    sectionId: "outArrivalAirportFilterGroup",
    field: "arrivalAirportCode",
    activeKey: "arrivalAirports",
    filterState: activeFilters.out,
    pool: outboundAll,
    showCount: true
  });
  syncAirportToggle("out", outDepVisible, outArrVisible);

  const retDepVisible = renderAirportFilterGroup({
    hostId: "retDepartureAirportFilters",
    sectionId: "retDepartureAirportFilterGroup",
    field: "departureAirportCode",
    activeKey: "departureAirports",
    filterState: activeFilters.ret,
    pool: returnAll,
    showCount: true
  });
  const retArrVisible = renderAirportFilterGroup({
    hostId: "retArrivalAirportFilters",
    sectionId: "retArrivalAirportFilterGroup",
    field: "arrivalAirportCode",
    activeKey: "arrivalAirports",
    filterState: activeFilters.ret,
    pool: returnAll,
    showCount: true
  });
  syncAirportToggle("ret", retDepVisible, retArrVisible);

  if (outGroup) outGroup.style.display = (outDepVisible || outArrVisible) ? "" : "none";
  if (retGroup) retGroup.style.display = (retDepVisible || retArrVisible) ? "" : "none";
}

// Shows the Departure/Arrival toggle only when both sides actually have
// something to filter - a lone visible side is shown directly with no
// toggle, since switching to an empty tab would be pointless. When both
// are visible, re-applies whichever tab is currently marked .is-active
// (renderAirportFilterGroup's own display:"" for both would otherwise
// show them stacked, undoing the toggle).
function syncAirportToggle(journeyPrefix, depVisible, arrVisible) {
  const toggle = document.getElementById(`${journeyPrefix}AirportToggle`);
  const depGroup = document.getElementById(`${journeyPrefix}DepartureAirportFilterGroup`);
  const arrGroup = document.getElementById(`${journeyPrefix}ArrivalAirportFilterGroup`);
  if (!toggle || !depGroup || !arrGroup) return;

  if (depVisible && arrVisible) {
    toggle.style.display = "";
    const activeTab = toggle.querySelector(".filter-airport-tab.is-active")?.dataset.airportTab || "departure";
    depGroup.style.display = activeTab === "departure" ? "" : "none";
    arrGroup.style.display = activeTab === "arrival" ? "" : "none";
  } else {
    toggle.style.display = "none";
  }
}

function wireAirportToggles() {
  document.querySelectorAll(".filter-airport-toggle").forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      const btn = event.target.closest(".filter-airport-tab");
      if (!btn || !toggle.contains(btn)) return;

      toggle.querySelectorAll(".filter-airport-tab").forEach((tab) => {
        tab.classList.toggle("is-active", tab === btn);
      });

      const journeyPrefix = toggle.dataset.journey;
      const depGroup = document.getElementById(`${journeyPrefix}DepartureAirportFilterGroup`);
      const arrGroup = document.getElementById(`${journeyPrefix}ArrivalAirportFilterGroup`);
      if (depGroup) depGroup.style.display = btn.dataset.airportTab === "departure" ? "" : "none";
      if (arrGroup) arrGroup.style.display = btn.dataset.airportTab === "arrival" ? "" : "none";
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
      airlines: [],
      departureAirports: [],
      arrivalAirports: [],
      out: { departureAirports: [], arrivalAirports: [] },
      ret: { departureAirports: [], arrivalAirports: [] }
    };

    document.querySelectorAll(".filter-panel input[type='checkbox']").forEach((cb) => {
      cb.checked = false;
    });

    outPageIdx = 1;
    retPageIdx = 1;
    renderAirlineFilters();
    renderAirportFilters();
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

  if (sortValue === "price-desc") {
    return arr.sort((a, b) => Number(b?.bestDeal?.finalPrice ?? b?.price ?? 0) - Number(a?.bestDeal?.finalPrice ?? a?.price ?? 0));
  }

  if (sortValue === "departure-asc") {
    return arr.sort((a, b) => String(a?.departureTime || "").localeCompare(String(b?.departureTime || "")));
  }

  if (sortValue === "departure-desc") {
    return arr.sort((a, b) => String(b?.departureTime || "").localeCompare(String(a?.departureTime || "")));
  }

  if (sortValue === "arrival-asc") {
    return arr.sort((a, b) => String(a?.arrivalTime || "").localeCompare(String(b?.arrivalTime || "")));
  }

  if (sortValue === "arrival-desc") {
    return arr.sort((a, b) => String(b?.arrivalTime || "").localeCompare(String(a?.arrivalTime || "")));
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

// ixigo city slugs for its /cheap-flights/{from}-{to}-{FROM}-{TO} URL pattern.
// Only BOM/GOI ("mumbai"/"goa") and DEL/BLR ("new-delhi"/"bengaluru" — note ixigo
// uses "bengaluru", not "bangalore") were confirmed live via a real ixigo.com page
// load (2026-07). The rest are inferred by lowercasing the existing `plain` city
// name (reasonable default; not individually confirmed) — patch reactively if a
// specific one turns out wrong, same convention this file already uses for the
// airport-dataset gap fixes.
function skydealIxigoCitySlug(plainCityName) {
  return String(plainCityName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function skydealPortalAirportMeta(iata) {
  const code = String(iata || "").toUpperCase();

  const map = {
    BOM: { emt: "Mumbai-India", cleartrip: "Mumbai, IN", plain: "Mumbai", ixigo: "mumbai" },
    DEL: { emt: "Delhi-India", cleartrip: "New Delhi, IN", plain: "New Delhi", ixigo: "new-delhi" },
    BLR: { emt: "Bangalore-India", cleartrip: "Bangalore, IN", plain: "Bangalore", ixigo: "bengaluru" },
    HYD: { emt: "Hyderabad-India", cleartrip: "Hyderabad, IN", plain: "Hyderabad", ixigo: "hyderabad" },
    MAA: { emt: "Chennai-India", cleartrip: "Chennai, IN", plain: "Chennai", ixigo: "chennai" },
    CCU: { emt: "Kolkata-India", cleartrip: "Kolkata, IN", plain: "Kolkata", ixigo: "kolkata" },
    PNQ: { emt: "Pune-India", cleartrip: "Pune, IN", plain: "Pune", ixigo: "pune" },
    GOI: { emt: "Goa-India", cleartrip: "Goa, IN", plain: "Goa", ixigo: "goa" },
    AMD: { emt: "Ahmedabad-India", cleartrip: "Ahmedabad, IN", plain: "Ahmedabad", ixigo: "ahmedabad" },
    COK: { emt: "Kochi-India", cleartrip: "Kochi, IN", plain: "Kochi", ixigo: "kochi" },
    JAI: { emt: "Jaipur-India", cleartrip: "Jaipur, IN", plain: "Jaipur", ixigo: "jaipur" },
    LKO: { emt: "Lucknow-India", cleartrip: "Lucknow, IN", plain: "Lucknow", ixigo: "lucknow" },
    IXC: { emt: "Chandigarh-India", cleartrip: "Chandigarh, IN", plain: "Chandigarh", ixigo: "chandigarh" },
    BBI: { emt: "Bhubaneswar-India", cleartrip: "Bhubaneswar, IN", plain: "Bhubaneswar", ixigo: "bhubaneswar" },
    GAU: { emt: "Guwahati-India", cleartrip: "Guwahati, IN", plain: "Guwahati", ixigo: "guwahati" },
    TRV: { emt: "Thiruvananthapuram-India", cleartrip: "Thiruvananthapuram, IN", plain: "Thiruvananthapuram", ixigo: "thiruvananthapuram" },
    IXB: { emt: "Bagdogra-India", cleartrip: "Bagdogra, IN", plain: "Bagdogra", ixigo: "bagdogra" },
    PAT: { emt: "Patna-India", cleartrip: "Patna, IN", plain: "Patna", ixigo: "patna" },
    IDR: { emt: "Indore-India", cleartrip: "Indore, IN", plain: "Indore", ixigo: "indore" },
    NAG: { emt: "Nagpur-India", cleartrip: "Nagpur, IN", plain: "Nagpur", ixigo: "nagpur" }
  };

  if (map[code]) return map[code];

  const fallbackPlain = code;
  return {
    emt: `${code}-India`,
    cleartrip: `${code}, IN`,
    plain: fallbackPlain,
    ixigo: skydealIxigoCitySlug(fallbackPlain)
  };
}


function buildSkyDealPortalRoundTripUrl(portalName, payload = {}) {
  const portal = String(portalName || "").toLowerCase();

  const from = String(payload?.from || lastSearchPayload?.from || fromInput?.value || "").toUpperCase();
  const to = String(payload?.to || lastSearchPayload?.to || toInput?.value || "").toUpperCase();

  // Return leg's own airports (2026-08-19, round-trip half of the metro-
  // substitution deep-link fix - see buildFlightPortalSearchUrl below for
  // the one-way half). Defaults to the plain mirror (to->from) that every
  // caller relied on before this existed, so nothing changes unless a
  // caller explicitly passes a different pair (i.e. the selected return
  // flight actually departs/arrives a substituted metro airport).
  const returnFrom = String(payload?.returnFrom || to).toUpperCase();
  const returnTo = String(payload?.returnTo || from).toUpperCase();

  const depart =
    payload?.departureDate ||
    payload?.departDate ||
    lastSearchPayload?.departureDate ||
    departInput?.value ||
    "";

  // returnInput keeps a pre-filled date even in one-way mode (so it's
  // ready if the user later switches to round-trip) - falling back to it
  // unconditionally meant a one-way search's deep link still picked up
  // that leftover date and sent the user to the portal's round-trip
  // results page with a return date they never asked for. Only resolve a
  // return date at all when the actual search that was run was round-trip.
  const isRoundTripSearch = (payload?.tripType || lastSearchPayload?.tripType) === "round-trip";

  const ret = isRoundTripSearch
    ? (payload?.returnDate || payload?.retDate || lastSearchPayload?.returnDate || returnInput?.value || "")
    : "";

  const adults = Number(payload?.passengers || payload?.adults || lastSearchPayload?.passengers || 1) || 1;

  const departDmy = formatDateForMmtUrl(depart);
  const retDmy = formatDateForMmtUrl(ret);

  const fromMeta = skydealPortalAirportMeta(from);
  const toMeta = skydealPortalAirportMeta(to);

  const hasRoundTrip = from && to && departDmy && retDmy;
  // One-way searches used to fall all the way back to each portal's bare
  // homepage (no route/date at all) because every branch below only had a
  // round-trip deep link and a bare fallback, nothing in between. Each
  // portal's one-way URL is the same shape as its round-trip one - just
  // the standard tripType-O / single-segment / no-return-date variant -
  // so a one-way search now gets a real pre-filled results page too.
  const hasOneWay = from && to && departDmy;

  let url = "";

  if (portal.includes("makemytrip")) {
    if (hasRoundTrip) {
      url = `https://www.makemytrip.com/flight/search?tripType=R&itinerary=${encodeURIComponent(`${from}-${to}-${departDmy}_${returnFrom}-${returnTo}-${retDmy}`)}&paxType=${encodeURIComponent(`A-${adults}_C-0_I-0`)}&cabinClass=E`;
    } else if (hasOneWay) {
      url = `https://www.makemytrip.com/flight/search?tripType=O&itinerary=${encodeURIComponent(`${from}-${to}-${departDmy}`)}&paxType=${encodeURIComponent(`A-${adults}_C-0_I-0`)}&cabinClass=E`;
    } else {
      url = "https://www.makemytrip.com/flights/";
    }
  } else if (portal.includes("goibibo")) {
    // The old "pretty slug" (/flights/air-FROM-TO-date1-date2-.../) only
    // works when both dates are present - a one-way search (no return
    // date) doesn't match any route Goibibo's server recognizes and
    // silently falls back to their homepage with an unrelated default
    // route. Confirmed live (2026-07) that the pretty slug is itself just
    // a redirector into this real results endpoint - Goibibo and
    // MakeMyTrip share the same booking platform (post-merger), so it
    // uses the exact same tripType/itinerary/paxType shape as the MMT
    // branch above. Going straight here (skipping the fragile slug)
    // works for both one-way and round-trip.
    if (hasRoundTrip) {
      const params = new URLSearchParams({
        tripType: "R",
        itinerary: `${from}-${to}-${departDmy}_${returnFrom}-${returnTo}-${retDmy}`,
        paxType: `A-${adults}_C-0_I-0`,
        cabinClass: "E",
        intl: "false",
        ccde: "IN",
        lang: "eng"
      });
      url = `https://www.goibibo.com/flight/search/?${params.toString()}`;
    } else if (hasOneWay) {
      const params = new URLSearchParams({
        tripType: "O",
        itinerary: `${from}-${to}-${departDmy}`,
        paxType: `A-${adults}_C-0_I-0`,
        cabinClass: "E",
        intl: "false",
        ccde: "IN",
        lang: "eng"
      });
      url = `https://www.goibibo.com/flight/search/?${params.toString()}`;
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
    } else if (hasOneWay) {
      const params = new URLSearchParams({
        flex: "0",
        viewName: "normal",
        source: "fresco-flights",
        type: "O",
        class: "Economy",
        ADT: String(adults),
        CHD: "0",
        INF: "0",
        noOfSegments: "1",
        origin: from,
        originCountry: "IN",
        destination: to,
        destinationCountry: "IN",
        flight_depart_date: departDmy
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
    } else if (hasOneWay) {
      const params = new URLSearchParams({
        srch: `${from}-${fromMeta.emt}|${to}-${toMeta.emt}|${departDmy}`,
        px: `${adults}-0-0`,
        cbn: "0",
        ar: "undefined",
        isow: "true",
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
    } else if (hasOneWay) {
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
        rnd_one: "O",
        isCfw: "false",
        isFF: "false",
        sourceCountry: fromMeta.plain,
        destinationCountry: toMeta.plain,
        nonStop: ""
      });

      url = `https://www.cleartrip.com/flights/results?${params.toString()}`;
    } else {
      url = "https://www.cleartrip.com/flights";
    }
  } else if (portal.includes("ixigo")) {
    // Real results endpoint, confirmed from an actual ixigo search
    // (2026-07): /search/result/flight?from=..&to=..&date=DDMMYYYY
    // [&returnDate=DDMMYYYY]&adults=..&children=..&infants=..&class=e -
    // date has no separators (e.g. 28072026), unlike every other portal's
    // DD/MM/YYYY. Supersedes the old /cheap-flights/{slug} route page,
    // which never carried date/passengers and left the user to reselect
    // the date themselves once there.
    const departDdmmyyyy = departDmy.replace(/\//g, "");
    const retDdmmyyyy = retDmy.replace(/\//g, "");

    if (hasRoundTrip) {
      const params = new URLSearchParams({
        from,
        to,
        date: departDdmmyyyy,
        returnDate: retDdmmyyyy,
        adults: String(adults),
        children: "0",
        infants: "0",
        class: "e",
        source: "Search Form",
        utm_source: "seo"
      });
      url = `https://www.ixigo.com/search/result/flight?${params.toString()}`;
    } else if (hasOneWay) {
      const params = new URLSearchParams({
        from,
        to,
        date: departDdmmyyyy,
        adults: String(adults),
        children: "0",
        infants: "0",
        class: "e",
        source: "Search Form",
        utm_source: "seo"
      });
      url = `https://www.ixigo.com/search/result/flight?${params.toString()}`;
    } else if (from && to) {
      url = `https://www.ixigo.com/cheap-flights/${fromMeta.ixigo}-${toMeta.ixigo}-${from.toLowerCase()}-${to.toLowerCase()}`;
    } else {
      url = "https://www.ixigo.com/flights";
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

// Deep-link airport bug fix (2026-08-19, launch checklist item 8): on the 3
// metro-group routes (Mumbai/Delhi-NCR/Goa), a flight's real departure/
// arrival airport can differ from the searched from/to (e.g. searched
// Mumbai->Delhi, real flight is Navi Mumbai->Hindon) - see the 2026-07-16
// metro-merge feature. buildPortalSearchUrl() always used the SEARCH's
// from/to, so "Book with X" sent users to the portal's results for the
// wrong airport pair entirely, where this exact flight often doesn't even
// appear. Falls back to the search's from/to whenever the flight doesn't
// carry its own codes (ordinary non-substituted flights - the vast
// majority), so this is a no-op everywhere except the 3 affected routes.
function buildFlightPortalSearchUrl(portal, flight, payload) {
  const basePayload = payload || lastSearchPayload || {};
  const overridePayload = {
    ...basePayload,
    from: flight?.departureAirportCode || basePayload.from,
    to: flight?.arrivalAirportCode || basePayload.to,
    // Optional return-leg override (2026-08-19) - only set on the synthetic
    // "selected round trip" comparison flight built in
    // compareSelectedRoundTrip(), never on a real single-flight object, so
    // this stays a no-op for every ordinary one-way call site.
    ...(flight?.returnDepartureAirportCode
      ? { returnFrom: flight.returnDepartureAirportCode }
      : {}),
    ...(flight?.returnArrivalAirportCode
      ? { returnTo: flight.returnArrivalAirportCode }
      : {}),
  };
  return buildPortalSearchUrl(portal, overridePayload);
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
  if (!pm) return ["Other"];

  if (pm.type === "Credit Card") {
    return CARD_TYPE_OPTIONS_BY_BANK[pm.name] || ["Other"];
  }

  if (pm.type === "Debit Card") {
    return DEBIT_CARD_TYPE_OPTIONS_BY_BANK[pm.name] || ["Other"];
  }

  return ["Other"];
}

function getNetworkOptionsForPaymentMethod(pm) {
  if (!pm) return CARD_NETWORK_OPTIONS;
  return NETWORK_OPTIONS_BY_BANK[pm.name] || CARD_NETWORK_OPTIONS;
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

// Replaces the old separate "Heads up" dismissable nudge - this card is
// always visible (it's the entry point for a core action, not a tip to
// dismiss), so its job now is just staying in sync with real state: the
// user's own selected-method count, and the real bank-wide live offer
// count already computed for the "Price intelligence" panel.
function renderPaymentPromptCard() {
  if (!paymentPromptCard) return;

  const n = Array.isArray(selectedPaymentMethods) ? selectedPaymentMethods.length : 0;
  const total = typeof computeTotalLiveOfferCount === "function" ? computeTotalLiveOfferCount() : 0;

  if (paymentPromptTitle) {
    paymentPromptTitle.textContent = n === 0
      ? "Your final price depends on how you pay"
      : `${n} payment method${n === 1 ? "" : "s"} added`;
  }
  if (paymentPromptSub) {
    const emiNote = includeEmiOffers ? " EMI offers included." : "";
    paymentPromptSub.textContent = n === 0
      ? "Add your cards, UPI apps or wallets to see your real price"
      : `Add more to find an even better price.${emiNote}`;
  }
  if (paymentPromptCountEl) {
    paymentPromptCountEl.textContent = total > 0 ? `${total} offer${total === 1 ? "" : "s"}` : "";
  }

  if (!paymentPromptCard.dataset.wired) {
    paymentPromptCard.dataset.wired = "1";
    paymentPromptCard.addEventListener("click", () => openPaymentModal());
  }
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
    // Anchored after the whole merged payment-prompt card (2026-07-29),
    // not after paymentBtn directly - paymentBtn now lives inside that
    // card's own flex row, and "afterend" of just the button used to
    // land this chip list as an unwanted 4th flex child there, eating
    // most of the row's width via its own width:100%. Falls back to the
    // old anchor if the card ever isn't present for some reason.
    const anchor = document.getElementById("paymentPromptCard") || paymentBtn;
    anchor.insertAdjacentElement("afterend", host);
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
    const networkOptions = getNetworkOptionsForPaymentMethod(pm);

    bodyEl.innerHTML = `
      <div style="opacity:.8;font-size:12px;margin-bottom:12px;">All details below are optional.</div>

      <label style="display:block;font-size:13px;margin-bottom:8px;">Card network</label>
      <select id="pmDetailNetwork" style="width:100%;padding:10px;border-radius:8px;background:#17172a;color:#f8fafc;border:1px solid rgba(255,255,255,.12);margin-bottom:14px;">
        <option value="">Not specified</option>
        ${networkOptions.map((name) => `<option value="${name}" ${pm.network === name ? "selected" : ""}>${name}</option>`).join("")}
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
  // Sets the inner label span, not paymentBtn.textContent directly - the
  // button also contains the card-icon <svg> now, which a plain
  // textContent overwrite would silently wipe.
  if (paymentPromptBtnLabel) {
    paymentPromptBtnLabel.textContent = n === 0 ? "Add how you pay" : "Payment methods";
  }
  renderSelectedPaymentMethodsSummary();
  renderPaymentPromptCard();
  renderPaymentProfileCard();
  refreshDesktopSearchSummaryPaymentChip();
  // Every mutation of selectedPaymentMethods/includeEmiOffers already
  // calls this function immediately after (toggle, clear, done, accepting
  // a suggestion) - the single reliable choke point, so persistence is
  // hooked here rather than duplicated at each call site.
  savePaymentProfileToStorage();
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
    return `<div class="portalOfferLine portalOfferLine-muted">No discount with your selected payment methods.</div>`;
  }

  const codeText = p.code
    ? `<button
        type="button"
        class="copyCouponBtn inlineCopyCouponBtn"
        data-code="${safeText(p.code)}"
        title="Copy coupon code"
      >${safeText(p.code)}</button>`
    : "";
  const termsText = formatTermsForDisplay(p.terms);
  const tncBtn = termsText
    ? `<button
        type="button"
        class="tncBtn"
        data-portal="${safeText(p.portal)}"
        data-terms="${encodeURIComponent(termsText)}"
      >T&C</button>`
    : "";

  const pay = getOfferAwarePaymentLabelForRow(p);
  const parts = [];
  if (codeText) parts.push(`Code ${codeText}`);
  if (pay) parts.push(safeText(pay));

  if (!parts.length && !tncBtn) return "";

  return `
    <div class="portalOfferLine">
      ${parts.join(" &middot; ")}
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

// A brief, clean pause before handing off to the portal: confirms which
// flight(s) this is for and that the coupon code is already on the
// clipboard. Kept as a real click-through (not an auto-redirect after a
// timer) because browsers only allow window.open as a direct result of a
// click - a delayed one risks getting silently popup-blocked.
function openBookingHandoffModal({ portal, url, code, legs }) {
  if (!url) return;

  trackEvent("book_click", { portal: safeText(portal, "unknown") });

  const modal = document.getElementById("bookingHandoffModal");
  const body = document.getElementById("bookingHandoffBody");
  if (!modal || !body) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  if (code) {
    navigator.clipboard?.writeText(code).catch(() => {});
  }

  const legsHtml = (Array.isArray(legs) ? legs : [])
    .filter((leg) => leg && leg.summary && leg.summary !== "Not selected yet")
    .map(
      (leg) => `
        <div class="booking-handoff-leg">
          <div class="booking-handoff-leg-label">${safeText(leg.label)}</div>
          <div class="booking-handoff-leg-summary">${safeText(leg.summary)}</div>
        </div>
      `
    )
    .join("");

  const codeHtml = code
    ? `
      <div class="booking-handoff-code-note">
        <strong>Copied to clipboard:</strong> <code>${safeText(code)}</code> — paste it at checkout on ${safeText(portal)}.
      </div>
    `
    : `
      <div class="booking-handoff-code-note booking-handoff-code-note-plain">
        This price applies automatically - no coupon needed at checkout.
      </div>
    `;

  body.innerHTML = `
    ${legsHtml}
    ${codeHtml}
    <button type="button" class="btn-primary booking-handoff-continue">Continue to ${safeText(portal)} ↗</button>
  `;

  body.querySelector(".booking-handoff-continue").addEventListener("click", () => {
    window.open(url, "_blank", "noopener,noreferrer");
    closeBookingHandoffModal();
  });

  modal.classList.add("open");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

function closeBookingHandoffModal() {
  const modal = document.getElementById("bookingHandoffModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
}

// No modal in the app closed on Escape - the X button, a backdrop click,
// and (payment modal only) Done/Clear were the only ways out (QA,
// 2026-08-12: confirmed live, Escape left the payment modal open).
// Checked highest z-index first (pmDetailModal 10001, tncModal 10000,
// portalCompareModal 9999) since those are the ones most likely to be
// showing on top of another already-open modal; closes only the
// first/topmost one found open, not everything at once, so opening a
// method's details from inside the payment modal and pressing Escape
// closes just the details editor, not the payment modal underneath it.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  if (paxPanel && paxPanel.classList.contains("open")) {
    closePaxPanel();
    return;
  }

  const pmDetailModal = document.getElementById("pmDetailModal");
  if (pmDetailModal && pmDetailModal.style.display !== "none") {
    pmDetailModal.querySelector("#pmDetailClose")?.click();
    return;
  }

  const tncModal = document.getElementById("tncModal");
  if (tncModal && tncModal.classList.contains("open")) {
    closeTncModal();
    return;
  }

  const portalCompareModal = document.getElementById("portalCompareModal");
  if (portalCompareModal && portalCompareModal.style.display !== "none") {
    portalCompareModal.querySelector("#portalCompareClose")?.click();
    return;
  }

  const bookingHandoffModal = document.getElementById("bookingHandoffModal");
  if (bookingHandoffModal && bookingHandoffModal.classList.contains("open")) {
    closeBookingHandoffModal();
    return;
  }

  if (paymentModal && paymentModal.classList.contains("open")) {
    closePaymentModal();
  }
});

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
  pmSearchQuery = "";
  if (pmSearchInput) pmSearchInput.value = "";
  if (pmSearchClearBtn) pmSearchClearBtn.hidden = true;
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
    // data-tab is always the canonical full label (renderPaymentTabs() sets
    // it regardless of what's displayed), so normalize from that - not from
    // textContent, which may legitimately be a shortened mobile label like
    // "Credit" and would otherwise fail the `allowed` check and get removed.
    const normalized = normalizePaymentTabLabel(btn.getAttribute("data-tab") || btn.textContent);

    if (!allowed.includes(normalized) || seen.has(normalized)) {
      btn.remove();
      return;
    }

    seen.add(normalized);
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

  // On narrow screens "Credit Card"/"Debit Card" become "Credit"/"Debit" so
  // all five category tabs fit on one line instead of scrolling (measured
  // against the real component, 2026-08-17: full labels need 523px in a
  // 335px row - even shrinking the font to 9px still doesn't close that
  // gap, only shortening the two long labels does). data-tab keeps the
  // canonical full name regardless, since that's what drives filtering.
  const isNarrowViewport = typeof window !== "undefined" && window.innerWidth <= 760;
  const mobileShortLabels = { "Credit Card": "Credit", "Debit Card": "Debit" };
  const tabsHtml = finalTypes
    .map((t) => {
      const label = isNarrowViewport && mobileShortLabels[t] ? mobileShortLabels[t] : t;
      return `<button data-tab="${t}" class="tab ${t === activePaymentType ? "active" : ""}">${label}</button>`;
    })
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

  // Category buttons live in their own scrollable strip, separate from
  // the EMI toggle row below - previously all one flex container that
  // wrapped to 2 lines on mobile despite the "swipe for more" hint
  // implying horizontal scroll (founder catch, 2026-08-16: the CSS had
  // flex-wrap:wrap the whole time, so the hint was always inaccurate).
  pmTabsContainer.innerHTML = `<div class="pm-tabs-scroll">${tabsHtml}</div>${emiToggleHtml}`;
  cleanupPaymentTabsDom();

  pmTabsContainer.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activePaymentType = normalizePaymentTabLabel(btn.getAttribute("data-tab"));
      // Fresh search per category - a filter that matched "HDFC" on
      // Credit Card would otherwise silently carry over and hide
      // everything on Debit Card until the user notices and clears it.
      pmSearchQuery = "";
      if (pmSearchInput) pmSearchInput.value = "";
      if (pmSearchClearBtn) pmSearchClearBtn.hidden = true;
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

function offerCountFor(type, name) {
  const key = String(name).toLowerCase();
  const baseCount = paymentOfferCounts?.[type]?.[key] || 0;
  // On Credit Card, selecting a card with the EMI toggle on also tries
  // that same card's EMI offers during search (see buildSearchPaymentMethods),
  // so the badge should reflect that combined total once the toggle is on.
  const emiCount = (type === "Credit Card" && includeEmiOffers)
    ? (paymentOfferCounts?.EMI?.[key] || 0)
    : 0;
  return baseCount + emiCount;
}

function renderPaymentList() {
  if (!pmList) return;
  const query = pmSearchQuery.trim().toLowerCase();

  // Searching looks across every category at once (not just the active
  // tab) - founder feedback 2026-08-17: typing a bank should surface it
  // under Credit Card/Debit Card/Net Banking together rather than making
  // you re-search per tab. Since the same name can be a different
  // selectable payment method per category, each result is tagged with
  // its category so isSelected()/toggleSelected() still key off the
  // right {type, name} pair.
  if (query) {
    const allTypes = ["Credit Card", "Debit Card", "Net Banking", "UPI", "Wallet"];
    const matches = [];
    allTypes.forEach((t) => {
      const raw = Array.isArray(paymentOptions?.[t]) ? paymentOptions[t] : [];
      const names = [...new Set(raw.map((x) => String(x || "").trim()).filter(Boolean))];
      names.forEach((name) => {
        if (name.toLowerCase().includes(query)) matches.push({ type: t, name });
      });
    });

    if (matches.length === 0) {
      pmList.innerHTML = `
        <div class="empty pm-search-empty">
          No matches for "${safeText(pmSearchQuery.trim())}" across any payment type.
          <button type="button" id="pmSearchEmptyClear" class="pm-search-empty-clear">Clear search</button>
        </div>
      `;
      document.getElementById("pmSearchEmptyClear")?.addEventListener("click", () => {
        pmSearchQuery = "";
        if (pmSearchInput) { pmSearchInput.value = ""; pmSearchInput.focus(); }
        if (pmSearchClearBtn) pmSearchClearBtn.hidden = true;
        renderPaymentList();
      });
      return;
    }

    pmList.innerHTML = matches
      .map(({ type: t, name }, idx) => {
        const id = `pm_search_${idx}`.replace(/\s+/g, "_");
        const checked = isSelected(t, name) ? "checked" : "";
        const offerCount = offerCountFor(t, name);
        const badge = offerCount > 0
          ? `<span class="pm-offer-badge">${offerCount} offer${offerCount === 1 ? "" : "s"}</span>`
          : "";
        return `
          <label class="pm-item pm-item-tagged" for="${id}">
            <input id="${id}" type="checkbox" ${checked} />
            <span class="pm-item-main">
              <span class="pm-item-name">${safeText(name)}</span>
              <span class="pm-item-category">${safeText(t)}</span>
            </span>
            ${badge}
          </label>
        `;
      })
      .join("");

    pmList.querySelectorAll("input[type=checkbox]").forEach((cb, idx) => {
      cb.addEventListener("change", (e) => {
        const { type: t, name } = matches[idx];
        toggleSelected(t, name, e.target.checked);
      });
    });
    return;
  }

  // No active search - normal single-category browsing, unchanged.
  const type = activePaymentType;
  const raw = Array.isArray(paymentOptions?.[type]) ? paymentOptions[type] : [];
  const allForType = [...new Set(raw.map((x) => String(x || "").trim()).filter(Boolean))];

  if (allForType.length === 0) {
    pmList.innerHTML = `<div class="empty">No options found for ${type}.</div>`;
    return;
  }

  pmList.innerHTML = allForType
    .map((name, idx) => {
      const id = `pm_${type}_${idx}`.replace(/\s+/g, "_");
      const checked = isSelected(type, name) ? "checked" : "";
      const offerCount = offerCountFor(type, name);
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
      const name = allForType[idx];
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
  // Added 2026-08-04: the backend's live /payment-options list returns both
  // "PNB" and "Punjab National Bank" as separate raw strings for the same
  // bank (confirmed live) - without a rule here, "PNB" fell through to the
  // generic per-word title-case fallback below and became "Pnb", a THIRD
  // distinct string, splitting one real bank into three dropdown entries
  // instead of merging into one.
  if (u === "PNB" || u === "PNB BANK" || u === "PUNJAB NATIONAL BANK") return "Punjab National Bank";
  if (u === "STANDARD CHARTERED" || u === "STANDARD CHARTERED BANK" || u === "STANCHART" || u === "SCB") return "Standard Chartered Bank";
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
  if (u === "UPI" || u === "OTHER UPI") return u === "UPI" ? "UPI" : "Other";
  if (u === "EMI" || u === "OTHER EMI") return u === "EMI" ? "EMI" : "Other";

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

    // Alphabetical sorting (case-insensitive), with the catch-all "Other
    // X" entry always pinned to the end instead of wherever "O" happens
    // to fall - it's a fallback for "none of these apply to me", not a
    // bank name to scan alongside the rest.
    finalList.sort((a, b) => {
      const aOther = /^other\b/i.test(a);
      const bOther = /^other\b/i.test(b);
      if (aOther !== bOther) return aOther ? 1 : -1;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });

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
// Backend used to also emit legacy camelCase duplicate keys
// (CreditCard/DebitCard/NetBanking) pointing at the exact same underlying
// counts as these spaced equivalents - removed at the source 2026-08-11
// (QC-caught). Kept as an explicit canonical list (rather than
// Object.keys(paymentOfferCounts)) since that's a harmless, cheap safety
// net either way.
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
  const bodyEl = document.getElementById("paymentProfileBody");
  const footerEl = document.getElementById("paymentProfileFooter");
  const btnEl = document.getElementById("paymentProfileBtn");
  if (!statusEl && !bodyEl && !footerEl && !btnEl) return;

  const n = Array.isArray(selectedPaymentMethods) ? selectedPaymentMethods.length : 0;
  if (statusEl) {
    statusEl.textContent = n === 0 ? "No payment methods added" : `${n} payment method${n === 1 ? "" : "s"} added`;
  }

  // Body copy pitched "add your cards" regardless of whether you already
  // had (founder feedback, 2026-07-21) - it should read the same state the
  // heading above it already reflects.
  if (bodyEl) {
    bodyEl.textContent = n === 0
      ? "Add your cards, UPI apps or wallets to see your real price."
      : "Add more to find an even better price.";
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

// Marks the decode card as showing stale content while a re-search is in
// flight (route/date/passengers/cabin changed - not a payment-method-only
// addition, which reprices in place via /reprice-flights and never touches
// this). Only ever called when hasActiveSearchResults() was already true
// at the moment handleSearch started, so the first search of a session
// (handled by the separate decode-wait-stage) never sets this. See
// DECISIONS.md ("Decode card refreshing state on re-search").
function setDecodeCardRefreshing(isRefreshing) {
  const card = document.querySelector(".smart-guide-card");
  if (card) card.classList.toggle("decode-refreshing", isRefreshing);
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

async function fetchPaymentSuggestionsOnce() {
  const body = {
    from: lastSearchPayload.from,
    to: lastSearchPayload.to,
    travelClass: lastSearchPayload.travelClass,
    tripType: lastSearchPayload.tripType,
    passengers: lastSearchPayload.passengers,
    // buildSearchPaymentMethods(), not the raw selectedPaymentMethods -
    // this must match what /search itself sends, or every EMI-typed
    // offer is invisible to the backend's suggestions/timing-insight
    // engine whenever "Show EMI offers" is toggled on but the user never
    // separately added an EMI entry (found 2026-08-07: a real round-trip
    // min-transaction insight for an EMI-only offer silently never
    // appeared, because this request never told the backend EMI was in
    // play at all).
    selectedPaymentMethods: buildSearchPaymentMethods(),
    outboundFlights: outboundAll.map(tripFlightForGuideRequest),
    returnFlights: returnAll.map(tripFlightForGuideRequest),
    // Phase 3: used only to bound the timing-insight lookahead horizon
    // and check travel-period eligibility - never for pricing itself.
    outboundTravelDate: lastSearchPayload.departureDate || null,
    returnTravelDate: lastSearchPayload.returnDate || null,
  };

  // 30s, then 45s, both proved too tight for round-trip (Kapil,
  // 2026-08-12, reproduced repeatedly). Re-measured the REAL sequence a
  // user actually triggers (accepting a suggestion runs /reprice-flights
  // first, THEN this call) on a realistic 80-flight round-trip: 18.5s for
  // reprice-flights alone, then this endpoint ranged 2.9s-31.3s across
  // separate live runs depending on how "warm" Render's shared/bursty CPU
  // happened to be - i.e. genuinely variable, not a fixed number safe to
  // just barely clear. Raised to 60s to match the same ceiling already
  // used for /search and /compare-selected-trip elsewhere in this app,
  // rather than inventing a new, narrower one for this endpoint alone.
  const res = await fetchWithTimeout(`${BACKEND}/payment-suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 60000);

  if (!res.ok) throw new Error(`payment-suggestions failed: ${res.status}`);
  return res.json();
}

// A bare "we couldn't check for additional savings" dead end (no retry,
// no fallback) is confusing on a paid always-on backend, where a failed
// call almost always means something transient - not that the service is
// actually down (founder direction, 2026-08-09: never show this at all).
// Two attempts beyond the first before giving up on the richer engine,
// then a plain summary built entirely from data /search already
// returned (see buildOfflineFallbackDecodeMessage) - so the decode card
// says something true and useful even when the suggestions/timing-insight
// call itself can't be completed.
// loadingPhase defaults to "suggestions" ("Checking for a better way to
// pay…") - the right framing when this is a genuinely fresh look (a first
// search, or the user explicitly clicking "Check again"). The one caller
// that just accepted a suggestion passes "repricing" instead ("Updating
// your price…") - re-validating an action the user JUST took shouldn't
// visually read as restarting the investigation from scratch (founder
// catch, 2026-08-10: re-showing "Checking for a better way to pay…"
// right after "Price updated" read as the app second-guessing itself).
async function fetchPaymentSuggestions(loadingPhase = "suggestions") {
  if (!hasActiveSearchResults() || !lastSearchPayload) return;

  // Same staleness snapshot as repriceAndRenderFlights() - if a newer
  // handleSearch() finishes and renders its own decode card before this
  // call's response lands, applying this one afterward would overwrite
  // the fresh, current-search suggestions with suggestions computed for
  // a since-replaced flight list.
  const guardGeneration = searchGeneration;

  paymentGuideState = "loading";
  guideLoadingPhase = loadingPhase;
  renderPaymentGuideCard();

  // The round-trip "SELECTED TRIP" bottom banner was showing stale,
  // pre-change pricing with no visual sign anything was happening for the
  // ENTIRE duration this call takes (up to a minute) - it only started
  // showing its own "Checking..." state once refreshSelectedTripComparison()
  // was called AFTER this whole function already resolved. Kapil,
  // 2026-08-12: "while the results are being refreshed, the bottom banner
  // also should show being refreshed." Now flips it into its loading
  // state at the same moment the top card does, not after the fact.
  if (selectedOutboundFlight && selectedReturnFlight) {
    selectedTripCompareLoading = true;
    renderSelectedTripPanel();
  }

  // 2, not 3 (the timeout was just raised 30s -> 45s -> 60s): retries only
  // help a genuinely transient blip, not a sustained slowdown - and with a
  // 60s per-attempt ceiling, 3 attempts risks up to 180s of total wait
  // before falling back, which reads as far more broken than the
  // eventual fallback message itself. 2 keeps the worst case at 120s
  // while still covering a one-off network hiccup.
  const maxAttempts = 2;
  let json = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      json = await fetchPaymentSuggestionsOnce();
      break;
    } catch (e) {
      console.error(`[SkyDeal] payment-suggestions attempt ${attempt}/${maxAttempts} failed`, e);
    }
  }

  // A newer full search has since taken over - it already renders its
  // own decode card / suggestions, so bail out rather than clobbering
  // that fresher state with a response computed before it started.
  if (searchGeneration !== guardGeneration) return;

  if (json) {
    paymentSuggestions = Array.isArray(json?.suggestions) ? json.suggestions : [];
    paymentTimingInsights = Array.isArray(json?.timingInsights) ? json.timingInsights : [];
    lastGuideSummary = json?.summary || null;
    lastGuideCurrentBestPrice = Number.isFinite(json?.currentBestPrice) ? json.currentBestPrice : null;
    lastGuideTruncated = json?.meta?.truncated === true;
    lastPrimaryDecodeMessage = json?.primaryDecodeMessage || null;

    if (!guideSearchSummary && lastGuideCurrentBestPrice != null) {
      resetGuideSearchSummary(lastGuideCurrentBestPrice);
    } else if (guideSearchSummary && lastGuideCurrentBestPrice != null) {
      guideSearchSummary.currentBestPrice = lastGuideCurrentBestPrice;
    }

    paymentGuideState = "ready";
  } else {
    paymentSuggestions = [];
    paymentTimingInsights = [];
    lastGuideTruncated = false;
    lastPrimaryDecodeMessage = buildOfflineFallbackDecodeMessage();
    paymentGuideState = lastPrimaryDecodeMessage ? "ready" : "error";
  }

  setDecodeCardRefreshing(false);
  renderPaymentGuideCard();

  // The round-trip "SELECTED TRIP" bottom banner (refreshSelectedTripComparison)
  // has its own cache key that already includes the current payment
  // methods (getSelectedTripComparisonKey), so it WOULD refetch correctly
  // once asked - it just was never being asked again after a payment
  // method changed (its only other call site is the flight-selection
  // click handler). Every real payment-method-change path funnels through
  // this function, so fixing it once here covers all of them (Kapil,
  // 2026-08-12: banner kept showing stale pricing after adding a card).
  if (selectedOutboundFlight && selectedReturnFlight) {
    refreshSelectedTripComparison();
  }
}

// Frontend-only equivalent of the backend's Tier 1 / Tier 4 branches
// (resolvePrimaryDecodeMessage in index.js), built entirely from each
// flight's own bestDeal - already loaded by /search - since there's no
// suggestions/timingInsights/offers data to draw on once the dedicated
// call has failed. Deliberately simpler than the full hierarchy (no
// Tier 2/3 - those need the backend's candidate-matching engine), but
// says something true instead of nothing.
function buildOfflineFallbackDecodeMessage() {
  if (!selectedPaymentMethods.length) return null;

  const bestOf = (list) =>
    list.length ? list.reduce((a, b) => {
      const aPrice = a?.bestDeal?.applied ? a.bestDeal.finalPrice : a.price;
      const bPrice = b?.bestDeal?.applied ? b.bestDeal.finalPrice : b.price;
      return aPrice <= bPrice ? a : b;
    }) : null;

  const candidateDeals = [bestOf(outboundAll), bestOf(returnAll)]
    .map((f) => f?.bestDeal)
    .filter(Boolean);

  const tier1Deal = candidateDeals.find((d) => d?.applied && d?.offerDisplayType === "applied_payment_offer");
  if (tier1Deal) {
    const label = prettyPaymentLabel(tier1Deal.paymentLabel || "") || "Your payment method";
    const portal = tier1Deal.portal || "the portal";
    const discountPhrase = tier1Deal.appliedDiscountText
      || (Number.isFinite(tier1Deal.actualDiscount) && tier1Deal.actualDiscount > 0
        ? `₹${Math.round(tier1Deal.actualDiscount).toLocaleString("en-IN")} off`
        : "a lower price");
    return {
      tier: 1,
      urgent: false,
      heading: `${label} gets you the best price`,
      message: `${discountPhrase} on ${portal}.`,
      warning: null,
      tip: null,
      cta: null,
      upsell: null,
      mirror: null,
    };
  }

  const genericDealApplied = candidateDeals.some((d) => d?.applied && d?.offerDisplayType === "applied_offer_rule");
  const methodNames = [...new Set(selectedPaymentMethods.map((m) => m.name).filter(Boolean))];
  const methodLabel = methodNames.length ? methodNames.join(" or ") : "your selected method";

  return {
    tier: 4,
    urgent: false,
    heading: `${methodLabel}: here's your price`,
    message: "We couldn't fully re-check for extra savings just now, but this is your true final price for today.",
    warning: null,
    tip: genericDealApplied ? "Don't worry - we've already applied a site discount for you." : null,
    cta: null,
    ctaGeneric: "Add other payment options",
    upsell: null,
    mirror: null,
  };
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

  // Snapshot so we can tell, once the request resolves, whether a fresh
  // handleSearch() (Search button, not this reprice-only flow) has since
  // replaced outboundAll/returnAll with a whole new flight list. Without
  // this, applying repricedOutbound[i]/repricedReturn[i] by array INDEX
  // onto a since-replaced outboundAll/returnAll silently pairs each new
  // flight with some other flight's reprice data (Kapil, 2026-08-21:
  // changing payment methods then immediately hitting Search left the
  // results in a broken, single-column state - root cause was this race,
  // not a CSS issue).
  const guardGeneration = searchGeneration;

  setFlightPricesLoading(true);

  try {
    const body = {
      from: lastSearchPayload.from,
      to: lastSearchPayload.to,
      travelClass: lastSearchPayload.travelClass,
      tripType: lastSearchPayload.tripType,
      passengers: lastSearchPayload.passengers,
      // buildSearchPaymentMethods(), not the raw selectedPaymentMethods -
      // must match what /search itself sends, or a toggle-only reprice
      // (no fresh /search) silently drops back to non-EMI pricing whenever
      // "Show EMI offers" is on but no separate EMI entry was ever added.
      selectedPaymentMethods: buildSearchPaymentMethods(),
      outboundFlights: outboundAll.map(tripFlightForRepriceRequest),
      returnFlights: returnAll.map(tripFlightForRepriceRequest),
    };

    // 30s proved too tight here too (Kapil, 2026-08-12, reproduced live
    // twice back to back): measured this exact call at 18.5s-47s across
    // separate runs on a realistic 80-flight round-trip with 2 payment
    // methods selected. A timeout here doesn't just show a stale price on
    // the flight cards - it leaves outboundAll/returnAll's bestDeal
    // un-updated, so the SAIRRO DECODE card's next payment-suggestions call
    // (which reads bestDeal off these same arrays) describes a payment
    // method that was just added as if it were still unselected. Raised to
    // the same 60s ceiling already used for /search and /payment-suggestions
    // rather than a narrower number specific to this one call.
    const res = await fetchWithTimeout(`${BACKEND}/reprice-flights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 60000);

    if (!res.ok) throw new Error(`reprice-flights failed: ${res.status}`);

    const json = await res.json();

    // A newer full search has since taken over outboundAll/returnAll (and
    // already owns the loading spinner / results DOM) - applying this
    // response now would zip stale reprice data onto an unrelated flight
    // list, purely by array position. See the comment above this
    // function for why that's silently wrong, not just late.
    if (searchGeneration !== guardGeneration) return;

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
    // A newer search already owns the spinner/results DOM by now - don't
    // clear a loading state that isn't this call's to clear.
    if (searchGeneration !== guardGeneration) return;
    // renderOutbound()/renderReturn() above (which would otherwise clear
    // the loading spinner via their full re-render) never ran on this
    // path, so the spinner needs an explicit clear back to the
    // still-valid, unchanged prices.
    setFlightPricesLoading(false);
  }
}

// Used by the normal payment modal's Done/Clear actions only.
async function syncPaymentMethodsPostSearch() {
  guideAwaitingManualRecheck = false;
  // Show the banner's loading state immediately, in step with the flight
  // cards' own spinners - fetchPaymentSuggestions() only sets this itself
  // once repriceAndRenderFlights() below has already finished, which made
  // the banner flip to "loading" only after prices had already visibly
  // changed (founder catch, 2026-07-22). Starts in the "repricing" phase
  // so the copy matches what's actually happening to the cards right
  // now; fetchPaymentSuggestions() below flips it to "suggestions" (and
  // re-renders) once the reprice is done and it takes over.
  paymentGuideState = "loading";
  guideLoadingPhase = "repricing";
  renderPaymentGuideCard();

  // Same gap as applyPaymentSuggestion() (see its comment) - fetchPaymentSuggestions()
  // below is what normally sets this, but not until after repriceAndRenderFlights()
  // has already finished, leaving the bottom banner stale with no spinner for the
  // entire reprice wait when a payment method is changed via the modal's Done button.
  if (selectedOutboundFlight && selectedReturnFlight) {
    selectedTripCompareLoading = true;
    renderSelectedTripPanel();
  }

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

  trackEvent("decode_suggestion_accepted", {
    payment_type: pm.type || "unknown",
    payment_name: pm.name || "unknown",
    additional_saving: suggestion.additionalSaving || 0,
  });

  const already = selectedPaymentMethods.some(
    (existing) =>
      String(existing?.type || "").toLowerCase() === String(pm.type || "").toLowerCase() &&
      String(existing?.name || "").toLowerCase() === String(pm.name || "").toLowerCase() &&
      (existing?.tenureMonths ?? null) === (pm.tenureMonths ?? null)
  );

  if (!already) selectedPaymentMethods.push({ ...pm });

  updatePaymentButtonLabel();

  // fetchPaymentSuggestions() is what normally flips this on, but it isn't
  // called until AFTER repriceAndRenderFlights() below (18-47s measured
  // live) plus a 4s min-display have both finished - so without this, the
  // bottom SELECTED TRIP banner sat on the stale pre-accept price with no
  // spinner for the entire wait, while the individual flight cards above
  // it correctly showed their own (Kapil, 2026-08-12: "the bottom banner
  // also should show being refreshed" - the earlier fix only covered the
  // brief window inside fetchPaymentSuggestions() itself, not this whole
  // accept flow that precedes it).
  if (selectedOutboundFlight && selectedReturnFlight) {
    selectedTripCompareLoading = true;
    renderSelectedTripPanel();
  }

  const shortLabel = String(suggestion.primaryActionLabel || "").replace(/^Add\s+/i, "") || paymentMethodDisplayLabel(pm);
  const flightsImproved = Number.isFinite(suggestion.affectedFlights)
    ? suggestion.affectedFlights
    : (suggestion.affectedOutboundFlights || 0) + (suggestion.affectedReturnFlights || 0);
  const previousBestPrice = suggestion.newBestPrice + suggestion.additionalSaving;

  guideAwaitingManualRecheck = true;
  guideAcceptedNote = {
    heading: "Price updated",
    // The price line (previousBestPrice -> newBestPrice, rendered
    // separately above this message) already shows the ₹ saving on
    // the single cheapest flight - restating it in the sentence too,
    // then tacking on the unrelated "N other flights" headcount,
    // conflated two different numbers into one sentence and read as
    // if all N flights dropped by that same amount (founder catch,
    // 2026-07-22). This now states only the one fact the price line
    // doesn't already cover.
    message: flightsImproved > 0
      ? `${shortLabel} also lowers the price on ${flightsImproved} other flight${flightsImproved === 1 ? "" : "s"} in this search.`
      : "",
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

  // Once the transient note fades, resting on the OLD guideAwaitingManualRecheck
  // path (renderGuideAcceptedHtml -> renderGuideOptimisedRestingHtml) showed
  // "You've already got the best price" using selectedPaymentMethods from
  // BEFORE this method was added - both a stale summary and exactly the
  // comparison-claim language the sairro decode hierarchy was written to
  // replace everywhere else (founder catch, 2026-08-09: reappeared here
  // because this path predates that hierarchy and was never reconnected to
  // it). A fresh fetchPaymentSuggestions() call recomputes primaryDecodeMessage
  // for the new selection, so the resting view says the same kind of accurate,
  // non-comparison thing the rest of the card does - "ICICI Bank EMI gets you
  // the best price" instead of a stale "you've already got it" claim.
  if (guideAcceptedNoteTimer) clearTimeout(guideAcceptedNoteTimer);
  const myAcceptGeneration = ++guideAcceptGeneration;

  renderPaymentGuideCard();

  // The 4s note timer used to fire fetchPaymentSuggestions() on its OWN
  // wall-clock schedule, completely decoupled from whether the reprice
  // below had actually finished - on a slow reprice (Render has taken
  // 20s+ on this route this session), the recompute fired first and read
  // outboundAll BEFORE its bestDeal mutations landed, so the "fresh"
  // recompute sent the OLD pre-accept flight data and came back as if the
  // just-added method didn't exist at all (founder catch, 2026-08-10:
  // added ICICI EMI, card still said "Your ICICI Bank Credit Card offer
  // isn't live yet" with no mention of EMI, despite the flight list right
  // below already showing it applied). Both the minimum 4s display AND
  // the real reprice completion are now awaited together, so the
  // recompute can never fire on stale data regardless of how slow the
  // network is. myAcceptGeneration guards the (rarer) case where a second
  // suggestion gets accepted before this one finishes settling - only the
  // LATEST accept's finalize step is allowed to run.
  const minDisplayPromise = new Promise((resolve) => {
    guideAcceptedNoteTimer = setTimeout(resolve, 4000);
  });
  await Promise.all([repriceAndRenderFlights(), minDisplayPromise]);

  if (myAcceptGeneration !== guideAcceptGeneration) return;

  guideAcceptedNote = null;
  guideAcceptedNoteTimer = null;
  guideAwaitingManualRecheck = false;
  fetchPaymentSuggestions("repricing");
}

function dismissPaymentSuggestion(suggestion) {
  trackEvent("decode_suggestion_dismissed", {
    payment_type: suggestion?.paymentMethod?.type || "unknown",
    payment_name: suggestion?.paymentMethod?.name || "unknown",
  });
  dismissedSuggestionKeys.add(suggestionKey(suggestion));
  renderPaymentGuideCard();
}

function renderGuideLoadingHtml() {
  // Copy per SAIRRO_VOICE_AND_CONTENT.md A2/A3 (copy audit, 2026-08-11).
  if (guideLoadingPhase === "repricing") {
    return `
      <div class="payment-guide-loading">
        <div class="payment-guide-skeleton"></div>
        <div class="payment-guide-loading-title">Checking your new payment option…</div>
        <div class="payment-guide-loading-sub">We're seeing if it unlocks a better price.</div>
      </div>
    `;
  }

  return `
    <div class="payment-guide-loading">
      <div class="payment-guide-skeleton"></div>
      <div class="payment-guide-loading-title">Finding a better way to pay…</div>
      <div class="payment-guide-loading-sub">We're checking your payment options against live offers across portals.</div>
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
    // Copy per SAIRRO_VOICE_AND_CONTENT.md A5 (copy audit, 2026-08-11).
    return `
      <div class="payment-guide-optimised">
        <div class="payment-guide-optimised-title">We checked some options, but not all</div>
        <div class="payment-guide-optimised-sub">We found what we could. Try again to check every payment option.</div>
        ${summaryLine}
        <button type="button" class="payment-guide-check-more-btn" data-guide-action="retry">Check again</button>
      </div>
    `;
  }

  // Same "no further savings available" conclusion as the resting state
  // renderGuideAcceptedHtml falls back to once its transient note fades -
  // shared rendering so both paths (fresh check vs. post-accept) always
  // look and behave identically, including always offering a way to add
  // another payment method instead of sometimes dead-ending here.
  return renderGuideOptimisedRestingHtml();
}

// "You've already got the best price" is a comparison claim - it only
// means something once the user has actually seen a comparison happen
// (i.e. they've tried more than one way to pay). Said the moment someone
// adds their FIRST card, it asserts a conclusion against a baseline they
// never saw, which reads as unearned or just confusing (founder catch,
// 2026-08-07: "they wouldn't even know the use case of this message").
// Same reasoning for "We checked every other way to pay" - true either
// way, but only useful as a reassurance once the user might plausibly be
// wondering "is there something better", not before they've had the
// chance to wonder that at all.
//
// Deliberately reads the frontend's OWN selectedPaymentMethods array, not
// lastGuideSummary.selectedPaymentMethodCount - founder-caught bug,
// 2026-08-07: that backend count reflects buildSearchPaymentMethods()'s
// EMI expansion (one Credit Card entry + one auto-added EMI entry when
// "Show EMI offers" is on), so picking ONE bank with EMI included already
// counted as 2 and showed the earned "best price" framing on someone's
// very first pick. This array is exactly what the user themselves added
// in the payment modal, before any such expansion.
function renderGuideOptimisedRestingHtml() {
  const selectedCount = selectedPaymentMethods.length;

  // The passed-in summaryLine is built from lastGuideSummary.selectedPaymentMethodCount
  // - the backend's EMI-expanded count (buildSearchPaymentMethods() adds a
  // second entry per bank when "Show EMI offers" is on), not what the user
  // themselves picked in the payment modal. "N payment methods selected" is
  // describing the user's own action, so it should always use their raw
  // count - rebuilt here rather than trusting the passed-in line, in both
  // branches (founder-caught, 2026-08-07: first spotted on someone's very
  // first pick, but the same mismatch was still there once selected 2+).
  const ownSummaryLine = lastGuideSummary
    ? `
      <div class="payment-guide-optimised-facts">
        ${lastGuideCurrentBestPrice != null ? `<span>Best final price: ₹${lastGuideCurrentBestPrice}</span>` : ""}
        <span>${selectedCount} payment method${selectedCount === 1 ? "" : "s"} selected</span>
        ${Number.isFinite(lastGuideSummary.matchedOfferCount) ? `<span>${lastGuideSummary.matchedOfferCount} offer${lastGuideSummary.matchedOfferCount === 1 ? "" : "s"} matched</span>` : ""}
      </div>
    `
    : "";

  // Copy per SAIRRO_VOICE_AND_CONTENT.md A6 (copy audit, 2026-08-11) - the
  // doc's real split is Case 1 (nothing selected yet) vs Case 2 (checked,
  // nothing better found), not a passenger-card-count split. The per-count
  // fact ("N payment methods selected") still shows via ownSummaryLine
  // below, so that information isn't lost, just no longer baked into the
  // sentence itself.
  if (selectedCount === 0) {
    return `
      <div class="payment-guide-success-row">
        <div class="payment-guide-success-text">
          <div class="payment-guide-success-heading">Want to unlock more savings?</div>
          <div class="payment-guide-success-message payment-guide-resting-message">Add your cards, UPI apps or wallets and sairro will check if they can lower your price.</div>
          ${ownSummaryLine}
        </div>
        <button type="button" class="payment-guide-check-more-btn payment-guide-add-method-btn" data-guide-action="add-method">Add more ways to pay</button>
      </div>
    `;
  }

  return `
    <div class="payment-guide-success-row">
      <div class="payment-guide-success-text">
        <div class="payment-guide-success-heading">You're already getting the best available price</div>
        <div class="payment-guide-success-message payment-guide-resting-message">We checked your payment options and booking portals. Nothing else lowers this flight price right now.</div>
        ${ownSummaryLine}
      </div>
      <button type="button" class="payment-guide-check-more-btn payment-guide-add-method-btn" data-guide-action="add-method">Add more ways to pay</button>
    </div>
  `;
}

function renderGuideErrorHtml() {
  // Copy per SAIRRO_VOICE_AND_CONTENT.md A4 (copy audit, 2026-08-11) -
  // narrows the failure to the payment check specifically ("we found your
  // flights") rather than reading like the whole product broke.
  return `
    <div class="payment-guide-error-note">
      <div class="payment-guide-optimised-title">We couldn't check savings right now</div>
      <div class="payment-guide-optimised-sub">We found your flights, but couldn't complete the payment check.</div>
    </div>
  `;
}

function renderGuideSuggestionCardHtml(s, idx) {
  const labelBadge = s.label ? `<div class="payment-guide-label-badge">${s.label}</div>` : "";

  // Leads with the actual price transition (matches the strikethrough
  // base->final pattern flight cards already use, and the accepted-state
  // "₹X -> ₹Y" line below) instead of only a sentence - founder feedback,
  // 2026-07-21: the number should be the thing you see first.
  const hasPrices = Number.isFinite(s.newBestPrice) && Number.isFinite(s.additionalSaving);
  const oldPrice = hasPrices ? s.newBestPrice + s.additionalSaving : null;
  const priceTransition = hasPrices
    ? `
      <div class="payment-guide-price-transition">
        <span class="payment-guide-new-price">${money(s.newBestPrice)}</span>
        <span class="payment-guide-old-price">${money(oldPrice)}</span>
      </div>
    `
    : "";

  // Composed here rather than shown as the backend's raw s.message -
  // "lowers 40 flight options" reads backwards (sounds like fewer
  // results, not a lower price on the same results) and the same
  // pattern showed up in the accepted-state copy this function's
  // sibling builds. The affected-flight count and method name are
  // already structured data on the suggestion, so this doesn't need
  // the raw sentence to say it correctly (founder catch, 2026-07-21).
  const affectedFlights = Number.isFinite(s.affectedFlights) ? s.affectedFlights : null;
  const methodLabel = String(s.primaryActionLabel || "").replace(/^Add\s+/i, "") || paymentMethodDisplayLabel(s.paymentMethod);
  const suggestionMessage = affectedFlights > 0
    ? `${methodLabel} lowers the price on ${affectedFlights} flight${affectedFlights === 1 ? "" : "s"} in this search.`
    : "";

  return `
    <div class="payment-guide-suggestion">
      <div class="payment-guide-suggestion-row">
        <div class="payment-guide-suggestion-text">
          ${labelBadge}
          ${priceTransition}
          <div class="payment-guide-suggestion-heading">${s.heading || ""}</div>
          ${suggestionMessage ? `<div class="payment-guide-suggestion-message">${suggestionMessage}</div>` : ""}
        </div>
        <div class="payment-guide-suggestion-actions">
          <button type="button" class="payment-guide-add-btn" data-suggestion-idx="${idx}">${s.primaryActionLabel || "Add"}</button>
          <button type="button" class="payment-guide-dismiss-btn" data-suggestion-idx="${idx}">Not for me</button>
        </div>
      </div>
    </div>
  `;
}

function renderGuideSuggestionsHtml(visible) {
  if (visible.length <= 1) {
    return visible.length === 1 ? renderGuideSuggestionCardHtml(visible[0], 0) : "";
  }

  // Backend caps this at 2 suggestions (see CONTRACT.md /payment-suggestions).
  // Lead with whichever saves more so the hero always headlines the best
  // option instead of an arbitrary list order - the other stays one tap
  // away instead of matching it in visual weight, which is what made a
  // 2-suggestion result look like a stack of promo cards instead of one
  // headline (founder feedback, 2026-07-21).
  const ranked = visible
    .map((s, idx) => ({ s, idx }))
    .sort((a, b) => (Number(b.s.additionalSaving) || 0) - (Number(a.s.additionalSaving) || 0));

  const [lead, ...rest] = ranked;
  const leadHtml = renderGuideSuggestionCardHtml(lead.s, lead.idx);

  const restHtml = rest
    .map(({ s, idx }) => {
      const amount = Number.isFinite(s.additionalSaving) ? money(s.additionalSaving) : "";
      return `
        <details class="payment-guide-more-details">
          <summary class="payment-guide-more-toggle">+1 more way to save${amount ? ` ${amount}` : ""}</summary>
          ${renderGuideSuggestionCardHtml(s, idx)}
        </details>
      `;
    })
    .join("");

  return `${leadHtml}${restHtml}`;
}

function renderGuideAcceptedHtml() {
  if (!guideAcceptedNote) {
    // Once the transient success note fades (see applyPaymentSuggestion's
    // 4s timer), this means exactly the same thing as a fresh check
    // finding nothing further - shared rendering with
    // renderGuideOptimisedHtml so both paths always look and behave
    // identically, including always offering a way to add another
    // payment method instead of sometimes dead-ending here (founder
    // catch, 2026-07-22). No facts line here - lastGuideSummary/
    // lastGuideCurrentBestPrice reflect the check from *before* whatever
    // suggestion was just accepted, not the current state, so showing
    // them here would be stale.
    return renderGuideOptimisedRestingHtml();
  }

  // Price line leads right after the heading, ahead of the descriptive
  // sentence - the transformed price is the actual win, so it gets seen
  // first (founder feedback, 2026-07-21).
  const priceLine =
    guideAcceptedNote.previousBestPrice != null && guideAcceptedNote.newBestPrice != null
      ? `<div class="payment-guide-success-prices">${money(guideAcceptedNote.previousBestPrice)} → ${money(guideAcceptedNote.newBestPrice)}</div>`
      : "";

  // Wrapped in a row (text left, action right) rather than stacked, so
  // the hero's full width gets used on purpose instead of leaving most
  // of it empty next to a narrow column of text (founder catch,
  // 2026-07-21).
  //
  // This button opens the payment modal rather than silently re-running
  // the same check with the same payment methods - once we've told the
  // user they're already on their best price, "check for more options"
  // had nothing new to check. Adding a payment method is the actual
  // lever, so that's what this offers (founder catch, 2026-07-22).
  return `
    <div class="payment-guide-success-row">
      <div class="payment-guide-success-text">
        <div class="payment-guide-success-heading">${guideAcceptedNote.heading}</div>
        ${priceLine}
        ${guideAcceptedNote.message ? `<div class="payment-guide-success-message">${guideAcceptedNote.message}</div>` : ""}
      </div>
      <button type="button" class="payment-guide-check-more-btn payment-guide-add-method-btn" data-guide-action="add-method">Add more ways to pay</button>
    </div>
  `;
}

function wireGuideAddMethodButton(host) {
  const btn = host.querySelector(".payment-guide-add-method-btn");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";

  btn.addEventListener("click", () => {
    if (guideSearchSummary) guideSearchSummary.manuallyCheckedForMore = true;
    openPaymentModal();
  });
}

function wireGuideCheckMoreButton(host) {
  // Scoped to the retry button specifically - .payment-guide-check-more-btn
  // alone is shared with the "Add more ways to pay" button (same visual
  // style, different action), and both can be wired from the same render
  // path (see renderGuideOptimisedHtml's call site).
  const btn = host.querySelector('.payment-guide-check-more-btn[data-guide-action="retry"]');
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

// Smooths the height change when the guide's dynamic content swaps between
// states (loading -> suggestion -> accepted, etc.) - each state has a very
// different natural height, and a bare innerHTML swap made the whole page
// jump abruptly (founder feedback, 2026-07-21). Measures the height before
// and after the swap and animates between them, then releases back to
// height:auto so later organic reflows (e.g. the "+1 more way to save"
// <details> toggle) aren't blocked by a stale fixed height.
function setGuideDynamicHtml(host, html) {
  if (!host) return;
  const startHeight = host.getBoundingClientRect().height;
  host.style.transition = "none";
  host.style.height = `${startHeight}px`;
  host.style.overflow = "hidden";

  host.innerHTML = html;

  const endHeight = host.scrollHeight;
  // Forces layout so the browser registers the starting height before the
  // transition kicks in - without this the start/end heights collapse into
  // one paint and nothing visibly animates.
  void host.offsetHeight;
  host.style.transition = "height 0.2s ease";
  host.style.height = `${endHeight}px`;

  const clear = () => {
    host.style.transition = "";
    host.style.height = "";
    host.style.overflow = "";
    host.removeEventListener("transitionend", clear);
  };
  host.addEventListener("transitionend", clear);
  // Fallback in case transitionend never fires (e.g. start === end height,
  // so no property actually changes and no event dispatches).
  setTimeout(clear, 250);
}

// Sairro decode priority hierarchy (2026-08-08, revised 2026-08-09 to
// match decode_priority_hierarchy_mock.html precisely) - renders the
// backend's single ordered message (lastPrimaryDecodeMessage). tag/
// tagVariant come straight from the backend (it has the bank/day/percent
// data to build a specific label like "Same bank • live today" or "Opens
// Monday" - a tier-number->generic-word mapping here would just throw
// that specificity away), so this function is pure rendering, no copy.
function decodePrimaryTagClass(msg) {
  if (msg.tagVariant === "urgent") return " decode-primary-tag-urgent";
  if (msg.tagVariant === "warn") return " decode-primary-tag-soon";
  return "";
}

function renderPrimaryDecodeMessageHtml(msg) {
  const tagClass = decodePrimaryTagClass(msg);
  const parts = [];

  parts.push(`<span class="decode-primary-tag${tagClass}">${safeText(msg.tag || "")}</span>`);
  parts.push(`<div class="decode-primary-heading">${safeText(msg.heading)}</div>`);

  if (Number.isFinite(msg.priceNow)) {
    const wasPart = Number.isFinite(msg.priceWas) && msg.priceWas > msg.priceNow
      ? `<span class="decode-primary-price-was">${safeText(money(msg.priceWas))}</span>`
      : "";
    parts.push(`
      <div class="decode-primary-price-row">
        <span class="decode-primary-price">${safeText(money(msg.priceNow))}</span>
        ${wasPart}
      </div>
    `);
  }

  parts.push(`<div class="decode-primary-body">${safeText(msg.message)}</div>`);

  if (msg.upsell) {
    parts.push(`<div class="decode-primary-upsell">${safeText(msg.upsell)}</div>`);
  }
  if (msg.mirror) {
    parts.push(`<div class="decode-primary-mirror">${safeText(msg.mirror)}</div>`);
  }

  // Warning renders BEFORE the CTA/skip row (moved 2026-08-12, copy audit) -
  // it qualifies the message/mirror text just above it (e.g. "Estimated
  // only - the fare shown today may not match Monday's price" describes
  // the future-offer estimate in the body message, not whatever CTA
  // happens to render next). Sitting after the CTA read as a caveat on
  // the button just clicked, which is often about a completely different,
  // real-and-live offer (e.g. an EMI Add button) - a live screenshot
  // caught exactly this (Kapil, 2026-08-12). Tip stays AFTER the CTA,
  // deliberately - it's usually a direct reply to that same CTA (e.g.
  // "Not into EMI? ...").
  if (msg.warning) {
    parts.push(`<div class="decode-primary-warning">${safeText(msg.warning)}</div>`);
  }

  if (msg.cta) {
    parts.push(`
      <div class="decode-primary-actions">
        <button type="button" class="payment-guide-add-btn" data-cta-kind="method">${safeText(msg.cta.label)}</button>
        ${msg.skip ? `<button type="button" class="decode-primary-skip" data-cta-kind="skip">${safeText(msg.skip)}</button>` : ""}
      </div>
    `);
  } else if (msg.ctaGeneric) {
    parts.push(`
      <div class="decode-primary-actions">
        <button type="button" class="payment-guide-check-more-btn" data-cta-kind="generic">${safeText(msg.ctaGeneric)}</button>
      </div>
    `);
  }

  if (msg.tip) {
    parts.push(`<div class="decode-primary-tip">${safeText(msg.tip)}</div>`);
  }

  return parts.join("\n");
}

// Tier 2's cta only carries {label, paymentMethod} - re-finds the FULL
// suggestion object (additionalSaving/newBestPrice/affectedFlights etc.)
// from the same-request paymentSuggestions array so it can reuse
// applyPaymentSuggestion() exactly as the old suggestion cards did,
// rather than duplicating that accept-suggestion logic here.
function wirePrimaryDecodeMessageButtons(host) {
  if (!host || host.dataset.wired) return;
  host.dataset.wired = "1";

  // Reads lastPrimaryDecodeMessage fresh on every click rather than
  // capturing it in this closure - the host div persists and is only
  // wired once (guarded above), but its content re-renders on every
  // search/re-search, so a captured reference would silently go stale
  // and the button would act on a previous search's data.
  host.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cta-kind]");
    if (!btn) return;

    if (btn.dataset.ctaKind === "skip") {
      // "I'll wait" / "Not for me" - a plain dismissal, not an action on
      // any backend state. Just removes the actions row so the CTA
      // doesn't keep nagging for the rest of this render.
      btn.closest(".decode-primary-actions")?.remove();
      return;
    }

    if (btn.dataset.ctaKind === "generic") {
      openPaymentModal();
      return;
    }

    const pm = lastPrimaryDecodeMessage?.cta?.paymentMethod;
    if (!pm) return;

    const matched = paymentSuggestions.find(
      (s) =>
        String(s.paymentMethod?.type || "").toLowerCase() === String(pm.type || "").toLowerCase() &&
        String(s.paymentMethod?.name || "").toLowerCase() === String(pm.name || "").toLowerCase() &&
        (s.paymentMethod?.tenureMonths ?? null) === (pm.tenureMonths ?? null)
    );

    if (matched) applyPaymentSuggestion(matched);
  });
}

function renderPaymentGuideCardInner() {
  const container = document.querySelector(".offers-panel-content");
  const dynamicHost = document.getElementById("paymentGuideDynamic");
  if (!container || !dynamicHost) return;

  if (!hasActiveSearchResults()) {
    container.classList.remove("guide-replacing");
    setGuideDynamicHtml(dynamicHost, "");
    renderTimingInsights();
    return;
  }

  // Timing insights render into their own container regardless of which
  // Phase 1/2 state is showing above - a separate, secondary section,
  // never replacing the primary suggestion/optimised/success/error state.
  renderTimingInsights();

  if (guideAwaitingManualRecheck) {
    container.classList.add("guide-replacing");
    setGuideDynamicHtml(dynamicHost, renderGuideAcceptedHtml());
    wireGuideAddMethodButton(dynamicHost);
    return;
  }

  if (paymentGuideState === "loading") {
    container.classList.add("guide-replacing");
    setGuideDynamicHtml(dynamicHost, renderGuideLoadingHtml());
    return;
  }

  if (paymentGuideState === "error") {
    // Every other branch here adds "guide-replacing" to hide the stale
    // pre-search .payment-profile-static block - this one removed it
    // instead, so an error rendered the old "N payment methods added"
    // card and the error note at the same time (2026-08-03 audit).
    container.classList.add("guide-replacing");
    setGuideDynamicHtml(dynamicHost, renderGuideErrorHtml());
    return;
  }

  if (paymentGuideState === "ready") {
    if (lastPrimaryDecodeMessage) {
      container.classList.add("guide-replacing");
      setGuideDynamicHtml(dynamicHost, renderPrimaryDecodeMessageHtml(lastPrimaryDecodeMessage));
      wirePrimaryDecodeMessageButtons(dynamicHost);
      return;
    }

    const visible = visiblePaymentSuggestions();

    if (visible.length === 0) {
      container.classList.add("guide-replacing");
      setGuideDynamicHtml(dynamicHost, renderGuideOptimisedHtml());
      // Exactly one of these finds its button and wires it - which one
      // depends on lastGuideTruncated (see renderGuideOptimisedHtml).
      wireGuideCheckMoreButton(dynamicHost);
      wireGuideAddMethodButton(dynamicHost);
      return;
    }

    container.classList.add("guide-replacing");
    setGuideDynamicHtml(dynamicHost, renderGuideSuggestionsHtml(visible));
    wireGuideSuggestionButtons(dynamicHost, visible);
    return;
  }

  container.classList.remove("guide-replacing");
  setGuideDynamicHtml(dynamicHost, "");
}

// Small inline clock icon (not an emoji - keeps the hero's polished,
// slightly-fintech visual language rather than looking like a chat
// message) used to give timing insights their own distinct identity
// separate from the payment-method suggestion above/below them.
const TIMING_CLOCK_ICON_SVG = `
  <svg class="payment-timing-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.6"/>
    <path d="M10 5.5V10L13 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

// Phase 3 - these are read-only "when" signals, not new suggestions to
// accept (no add/dismiss actions). Never shown pre-search; empty when the
// backend has nothing to say (no timing opportunity is not an error and
// gets no messaging at all).
//
// Split into two visually distinct tiers rather than one undifferentiated
// list (2026-07-25 - previously a single small, muted section trailing
// below the main suggestion, easy to miss entirely):
//   - "urgent" (isOfferOnlyEstimate === false, i.e. a real discount that's
//     ACTUALLY ending) renders in its own slot ABOVE the main payment
//     suggestion, with a stronger amber/red treatment scaled by
//     insight.urgency - this is the single most actionable signal in the
//     whole panel ("book today or lose this saving") and deserved to be
//     found, not stumbled into.
//   - "future" (isOfferOnlyEstimate === true, a forward-looking estimate -
//     "a better rate opens up in N days") stays below the main suggestion
//     as a secondary, exploratory signal, but now with real card styling
//     instead of a thin divider.
function renderTimingInsightCardHtml(insight, { urgent }) {
  const labelBadge = insight.label ? `<div class="payment-timing-label-badge">${insight.label}</div>` : "";
  const disclaimerPart = insight.disclaimer
    ? `<div class="payment-timing-disclaimer">${insight.disclaimer}</div>`
    : "";
  const urgencyClass = urgent ? ` is-urgent urgency-${safeText(insight.urgency || "medium")}` : "";

  return `
    <div class="payment-timing-insight${urgencyClass}">
      ${TIMING_CLOCK_ICON_SVG}
      <div class="payment-timing-body">
        ${labelBadge}
        <div class="payment-timing-heading">${insight.heading || ""}</div>
        <div class="payment-timing-message">${insight.message || ""}</div>
        ${disclaimerPart}
      </div>
    </div>
  `;
}

function renderTimingInsights() {
  const urgentHost = document.getElementById("paymentTimingUrgentDynamic");
  const futureHost = document.getElementById("paymentTimingDynamic");
  if (!urgentHost || !futureHost) return;

  // Sairro decode priority hierarchy (2026-08-08): urgency and "unlocks
  // soon" now live INSIDE the single primary message (Tier 1's warning
  // line, Tier 3) instead of these separate cards - showing both would
  // duplicate the same signal twice. These containers stay the fallback
  // for whenever lastPrimaryDecodeMessage is null (nothing selected yet,
  // or the backend's computation failed defensively).
  if (lastPrimaryDecodeMessage) {
    urgentHost.innerHTML = "";
    futureHost.innerHTML = "";
    return;
  }

  if (!hasActiveSearchResults() || !Array.isArray(paymentTimingInsights) || paymentTimingInsights.length === 0) {
    urgentHost.innerHTML = "";
    futureHost.innerHTML = "";
    return;
  }

  const urgentInsights = paymentTimingInsights.filter((i) => i.isOfferOnlyEstimate === false);
  const futureInsights = paymentTimingInsights.filter((i) => i.isOfferOnlyEstimate !== false);

  urgentHost.innerHTML = urgentInsights.map((i) => renderTimingInsightCardHtml(i, { urgent: true })).join("");
  futureHost.innerHTML = futureInsights.map((i) => renderTimingInsightCardHtml(i, { urgent: false })).join("");
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
  const outPagesEl = document.getElementById("outPages");
  const retPagesEl = document.getElementById("retPages");

  if (which === "out") {
    // totalPages must reflect what's actually being shown (post-filter),
    // not the raw fetched count - otherwise "Next" can stay enabled past
    // the point where the filtered results actually run out.
    const tp = totalPages(applyFlightFilters(outboundAll, isRoundTripModeActive() ? "out" : undefined));
    if (outPage) outPage.textContent = String(outPageIdx);
    if (outPagesEl) outPagesEl.textContent = String(tp);
    if (outPrev) outPrev.disabled = outPageIdx <= 1;
    if (outNext) outNext.disabled = outPageIdx >= tp;
  } else {
    const tp = totalPages(applyFlightFilters(returnAll, "ret"));
    if (retPage) retPage.textContent = String(retPageIdx);
    if (retPagesEl) retPagesEl.textContent = String(tp);
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
            <div class="portalModalEyebrow"><svg class="modal-head-mark" viewBox="0 0 64 64" aria-hidden="true"><use href="#sairroMark"/></svg>Portal comparison</div>
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

const portalPrices = [...portalPricesRaw].sort((a, b) => {
  const aPrice = Number(a?.finalPrice ?? a?.basePrice ?? Infinity);
  const bPrice = Number(b?.finalPrice ?? b?.basePrice ?? Infinity);
  return aPrice - bPrice;
});

  console.log("[SkyDeal] portalPrices for clicked flight:", portalPrices);
  trackEvent("compare_portals_click", { portal_count: portalPrices.length });

  if (portalPrices.length === 0) {
    body.innerHTML = `<div class="portalModalEmpty">No portal-wise price data available for this flight.</div>`;
  } else {
    body.innerHTML = `
      <div class="portalCompareFlightHead portalCompareFlightHeadV2">
        <span>${safeText(flight.displayAirlineName || flight.airlineName)} ${displayFlightNumber(flight)}</span>
        <strong>${fmtTime(flight.departureTime)} → ${fmtTime(flight.arrivalTime)}${fmtDateFromISO(flight.departureTime) ? ` · ${fmtDateFromISO(flight.departureTime)}` : ""}</strong>
      </div>

      <div class="portalCompareList">
        ${portalPrices
          .map((p, idx) => {
            const href = buildFlightPortalSearchUrl(p.portal, flight, lastSearchPayload);
            const isBest = idx === 0;
             const portalSavings = getSavingsAmount(p.basePrice, p.finalPrice);

            const infoOffersHtml =
  Array.isArray(p.infoOffers) && p.infoOffers.length > 0
    ? (() => {
        const portalSlug = String(p.portal || "portal")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");

        const renderOfferCard = (io) => {
          const badge = getEffectiveInfoBadge(io);
          const showHint = io.paymentHint && !isHintRedundantWithTitle(io.paymentHint, io.title);

          return `
          <div class="otherOfferItem${badge.mismatch ? " otherOfferItem-muted" : ""}">
            <div class="otherOfferHead">
              <b>${safeText(io.title || io.couponCode || "Offer")}</b>
              ${io.infoLabel ? `<span class="otherOfferBadge${badge.mismatch ? " otherOfferBadge-muted" : ""}">${safeText(badge.label)}</span>` : ""}
            </div>
            ${showHint ? `<div class="otherOfferHint">${safeText(io.paymentHint)}</div>` : ""}
            ${io.rawDiscount ? `<div class="otherOfferDiscount">${safeText(io.rawDiscount)}</div>` : ""}
            <div class="otherOfferActions">
              ${
                io.couponCode && !badge.mismatch
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
        };

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
              <div class="otherOffersTitle">More offers</div>
              <div class="otherOffersMore open">
                ${p.infoOffers.map(renderOfferCard).join("")}
              </div>
            </div>
          </div>
        `;
      })()
    : "";

            const offerLineHtml = formatOfferLine(p);

            return `
              <div class="portalRow ${isBest ? "best" : ""}">
                <div class="portalHeader">
  <div class="portalHeaderMain">
    <div class="portalHeaderLeft">
      <div class="portalName">${safeText(p.portal)}</div>
     ${isBest ? `<span class="badge bestPriceBadge">Best price</span>` : ""}
    </div>

    <div class="portalPrice">
  <div>${money(p.finalPrice ?? p.basePrice ?? flight?.price)}</div>
  ${
    portalSavings > 0
      ? `<div class="portalPriceOld">${money(p.basePrice)}</div>
         <div class="portalPriceSave">Save ${money(portalSavings)}</div>`
      : ""
  }
</div>
  </div>

  ${
    href
      ? `<button type="button" class="badge portalLinkBadge portalLinkBelowPrice" data-url="${safeText(href)}" data-portal="${safeText(p.portal)}" data-code="${safeText(p.code || "", "")}">${getPortalCtaLabel(p.portal)}</button>`
      : ""
  }
</div>

                ${
                  offerLineHtml || infoOffersHtml
                    ? `<div class="portalRowFooter">${offerLineHtml}${infoOffersHtml}</div>`
                    : ""
                }
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  modal.style.display = "block";

  body.querySelectorAll(".portalLinkBelowPrice").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const url = btn.getAttribute("data-url") || "";
      const portal = btn.getAttribute("data-portal") || "";
      const code = btn.getAttribute("data-code") || "";
      if (!url) return;

      const legSummary = flight
        ? `${safeText(flight.displayAirlineName || flight.airlineName)} ${displayFlightNumber(flight)} · ${fmtTime(flight.departureTime)} → ${fmtTime(flight.arrivalTime)}${fmtDateFromISO(flight.departureTime) ? ` · ${fmtDateFromISO(flight.departureTime)}` : ""}`
        : "";

      // Close the compare list underneath instead of stacking a second
      // backdrop on top of it - the handoff modal is a step forward in
      // the same flow, not a second, simultaneous dialog.
      modal.style.display = "none";

      openBookingHandoffModal({
        portal,
        url,
        code: code || null,
        legs: [{ label: "Your flight", summary: legSummary }]
      });
    });
  });

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
        <div class="empty-copy">Switch to round-trip when you want sairro to compare departure and return flights together.</div>
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
    tiedWithPortals: best.tiedWithPortals || matchingPortal?.tiedWithPortals || null,
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


// Round-trip half of the metro-substitution deep-link fix (2026-08-19,
// see buildFlightPortalSearchUrl above for the one-way half). Overrides
// both legs independently with the actual selected flights' real airport
// codes when present - outbound from selectedOutboundFlight, return from
// selectedReturnFlight - falling back to the searched route (mirrored,
// exactly as before) whenever either flight isn't selected yet or doesn't
// carry substituted codes, so this is a no-op for ordinary trips.
function buildPortalBookingUrl(portalName) {
  const basePayload = lastSearchPayload || {};
  const overridePayload = {
    ...basePayload,
    from: selectedOutboundFlight?.departureAirportCode || basePayload.from,
    to: selectedOutboundFlight?.arrivalAirportCode || basePayload.to,
    returnFrom: selectedReturnFlight?.departureAirportCode || basePayload.to,
    returnTo: selectedReturnFlight?.arrivalAirportCode || basePayload.from,
  };
  return buildSkyDealPortalRoundTripUrl(portalName, overridePayload);
}

function bookSelectedRoundTripBestPortal() {
  const bestInfo = getBestTripPortalInfo();
  if (!bestInfo) return;

  const url = bestInfo.bookingUrl || buildPortalBookingUrl(bestInfo.portal);

  if (url) {
    openBookingHandoffModal({
      portal: bestInfo.portal,
      url,
      code: bestInfo.code || null,
      legs: [
        { label: selectedTripRouteLabel("out"), summary: selectedFlightSummary(selectedOutboundFlight, "out") },
        { label: selectedTripRouteLabel("ret"), summary: selectedFlightSummary(selectedReturnFlight, "ret") }
      ]
    });
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
  const paymentText = getOfferAwarePaymentLabelForRow(bestInfo) || "Selected payment method";
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
    // Visible spinner, not just changed text (Kapil, 2026-08-12: "like a
    // circle revolving") - reuses the exact same spin animation flight
    // cards already use during a reprice (.price-loading in style.css),
    // so the whole page's "this is recalculating" language stays
    // consistent rather than inventing a second visual pattern for it.
    return `
      <div class="sky-trip-compact-summary is-loading">
        <span class="sky-trip-spinner" aria-hidden="true"></span>
        <div class="sky-trip-compact-main">
          <div class="sky-trip-compact-title">Comparing prices across portals…</div>
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
        <span class="sky-trip-spinner" aria-hidden="true"></span>
        <div class="sky-trip-compact-main">
          <div class="sky-trip-compact-title">Calculating your best price…</div>
        </div>
      </div>
    `;
  }

  const offerTitle = bestInfo.offerTitle || bestInfo.rawDiscount || "Matching payment offer applied";
  const paymentText = getOfferAwarePaymentLabelForRow(bestInfo) || "Selected payment option";
  const coupon = bestInfo.code || "";
  const saveText = bestInfo.savings > 0 ? `Save ${money(bestInfo.savings)}` : "No discount applied";
  const tiedWith = Array.isArray(bestInfo.tiedWithPortals) ? bestInfo.tiedWithPortals : [];
  const tiedNote = tiedWith.length > 0
    ? `<div class="sky-trip-compact-tied-note">Same price on ${tiedWith.map((p) => safeText(p)).join(", ")}</div>`
    : "";

  // No separate "Best price on X" eyebrow here - the book button right
  // next to this card already names the portal ("Book with X"), and the
  // coupon code/offer title used to repeat the same fact as its own bold
  // line above the coupon chip. One of the two (never both) is enough.
  const primaryLineHtml = coupon
    ? `
      <div class="sky-trip-compact-coupon">
        <span>Coupon</span>
        <strong>${safeText(coupon)}</strong>
        <button type="button" class="copyTripCouponBtn" data-code="${safeText(coupon)}">Copy</button>
      </div>
    `
    : `<div class="sky-trip-compact-title">${offerTitle}</div>`;

  return `
    <div class="sky-trip-compact-summary">
      <div class="sky-trip-compact-price">
        <div class="sky-trip-compact-price-label">Best price</div>
        <div class="sky-trip-compact-price-value">${money(bestInfo.finalPrice)}</div>
        <div class="sky-trip-compact-base">Base fare <s>${money(bestInfo.baseTotal)}</s></div>
        ${tiedNote}
      </div>

      <div class="sky-trip-compact-main">
        ${primaryLineHtml}
        <div class="sky-trip-compact-sub">
          <span class="sky-trip-save-pill">${saveText}</span>
          <span>${paymentText}</span>
        </div>
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
    // fetchPaymentSuggestions() now speculatively sets
    // selectedTripCompareLoading=true the moment it starts (see its own
    // comment), before it's known whether the payment-method change will
    // actually produce a different comparison key - if it didn't (e.g. a
    // plain retry with the same methods), this early return used to leave
    // that flag stuck true forever, since nothing else here would ever
    // clear it. Clear it explicitly on this path too.
    if (selectedTripCompareLoading) {
      selectedTripCompareLoading = false;
      renderSelectedTripPanel();
    }
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
      tripComparison: comparison,
      // Metro-substitution deep-link fix (2026-08-19) - without these,
      // buildFlightPortalSearchUrl() had nothing to read and silently fell
      // back to the searched route for both legs, even when one or both
      // selected flights actually depart/arrive a substituted airport.
      departureAirportCode: selectedOutboundFlight.departureAirportCode,
      arrivalAirportCode: selectedOutboundFlight.arrivalAirportCode,
      returnDepartureAirportCode: selectedReturnFlight.departureAirportCode,
      returnArrivalAirportCode: selectedReturnFlight.arrivalAirportCode
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

// The <select> backing whichever leg is currently active in the mobile
// round-trip toggle - "out" whenever the toggle itself isn't showing
// (one-way search, or round-trip results not both ready yet), same
// fallback isRoundTripModeActive() ? "out" : undefined pattern already
// used for the per-leg airport filters.
function activeMobileSortSelect() {
  const leg = isRoundTripModeActive() ? mobileRoundTripActiveLeg : "out";
  return leg === "ret" ? retSortSelect : outSortSelect;
}

// "price-asc" -> "price", "arrival-desc" -> "arrival" - data-mobile-sort/
// data-sort always name the criterion via its -asc form (see
// ensureMobileQuickFilters, wireDesktopSortButtons); this strips either
// suffix to get the bare criterion for comparison.
function mobileSortCriterion(value) {
  return String(value || "").replace(/-asc$|-desc$/, "");
}

// Shared by the mobile sort chips and desktop's per-column sort buttons -
// tapping the already-active criterion flips its direction; tapping a
// different one always starts at its default (ascending - lowest cost /
// earliest departure / earliest arrival first), same as picking a fresh
// option from the old dropdown used to.
function nextSortValue(currentValue, criterion) {
  const alreadyActive = mobileSortCriterion(currentValue) === criterion;
  return alreadyActive && !String(currentValue || "").endsWith("-desc")
    ? `${criterion}-desc`
    : `${criterion}-asc`;
}

// Mirrors the active leg's <select> value onto the 3 sort chips' active
// state and direction arrow (▼ ascending/lowest/earliest-first, ▲
// descending/highest/latest-first - Kapil feedback 2026-08-20, flipped
// from the more "obvious" ▲-for-ascending mapping) - called from
// updateMobileRoundTripTabs() so it stays in sync both on tab switch and
// on every render.
function syncMobileSortChips() {
  const bar = document.getElementById("mobileQuickFilters");
  if (!bar) return;

  const value = activeMobileSortSelect()?.value || "price-asc";
  const activeCriterion = mobileSortCriterion(value);
  const isDesc = value.endsWith("-desc");

  bar.querySelectorAll("[data-mobile-sort]").forEach((btn) => {
    const criterion = mobileSortCriterion(btn.getAttribute("data-mobile-sort"));
    const isActive = criterion === activeCriterion;
    btn.classList.toggle("is-active", isActive);
    const arrow = btn.querySelector(".mobile-chip-arrow");
    if (arrow) arrow.textContent = isActive ? (isDesc ? "▲" : "▼") : "";
  });
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
    <button type="button" class="mobile-chip" data-mobile-sort="price-asc">Cost<span class="mobile-chip-arrow"></span></button>
    <button type="button" class="mobile-chip" data-mobile-sort="departure-asc">Departure<span class="mobile-chip-arrow"></span></button>
    <button type="button" class="mobile-chip" data-mobile-sort="arrival-asc">Arrival<span class="mobile-chip-arrow"></span></button>
    <button type="button" class="mobile-chip mobile-chip-filter">Filter</button>
  `;

  workspace.parentNode.insertBefore(bar, workspace);

  bar.querySelectorAll("[data-mobile-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const select = activeMobileSortSelect();
      if (!select) return;

      const criterion = mobileSortCriterion(btn.getAttribute("data-mobile-sort"));
      select.value = nextSortValue(select.value, criterion);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      syncMobileSortChips();
    });
  });

  bar.querySelector(".mobile-chip-filter")?.addEventListener("click", () => {
    document.body.classList.toggle("mobile-filter-drawer-open");
  });

  syncMobileSortChips();
  return bar;
}

function renderMobileQuickFilters() {
  ensureMobileQuickFilters();
}

// Desktop's per-column sort buttons (2026-08-20) - unlike mobile's single
// shared chip row (one active leg at a time via the Departure/Return
// toggle), desktop shows both columns simultaneously with no leg concept,
// so each .col-sort-buttons bar operates independently on its own
// #outSort/#retSort. Mirrors syncMobileSortChips()'s active/arrow logic;
// Savings has no arrow since it's single-direction (no savings-asc exists
// anywhere - matches the old dropdown's own behavior exactly).
function syncDesktopSortButtons(bar, select) {
  if (!bar || !select) return;

  const value = select.value || "price-asc";
  const activeCriterion = mobileSortCriterion(value);
  const isDesc = value.endsWith("-desc");

  bar.querySelectorAll("[data-sort]").forEach((btn) => {
    const criterion = mobileSortCriterion(btn.getAttribute("data-sort"));
    const isActive = criterion === activeCriterion;
    btn.classList.toggle("is-active", isActive);
    const arrow = btn.querySelector(".col-sort-arrow");
    if (arrow) arrow.textContent = isActive ? (isDesc ? "▲" : "▼") : "";
  });
}

function wireDesktopSortButtons() {
  document.querySelectorAll(".col-sort-buttons").forEach((bar) => {
    const select = document.getElementById(bar.getAttribute("data-select-id"));
    if (!select) return;

    bar.querySelectorAll("[data-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const criterion = mobileSortCriterion(btn.getAttribute("data-sort"));
        select.value = criterion === "savings" ? "savings-desc" : nextSortValue(select.value, criterion);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncDesktopSortButtons(bar, select);
      });
    });

    syncDesktopSortButtons(bar, select);
  });
}

// Mirrors whichever headline renderPaymentGuideCard() is currently
// showing inside the full card, condensed to one line, for the frozen
// mobile banner below - reuses the same state, never a second source
// of truth for what the guide is currently saying.
function getPriceIntelHeroLine() {
  // Copy per SAIRRO_VOICE_AND_CONTENT.md's "Mobile frozen banner" section
  // (copy audit, 2026-08-11).
  if (!hasActiveSearchResults()) {
    const n = Array.isArray(selectedPaymentMethods) ? selectedPaymentMethods.length : 0;
    return n === 0
      ? "Add your payment options to unlock better prices"
      : "Checking your payment options for hidden savings";
  }

  if (guideAwaitingManualRecheck) {
    return guideAcceptedNote?.heading || "You're on your best price right now";
  }

  if (paymentGuideState === "loading") {
    return guideLoadingPhase === "repricing" ? "Checking your new payment option…" : "Finding a better way to pay…";
  }

  if (paymentGuideState === "error") {
    return "We couldn't check savings right now";
  }

  if (paymentGuideState === "ready") {
    // lastPrimaryDecodeMessage.sticky is the decode hierarchy's own
    // condensed one-liner (built for exactly this - see resolvePrimaryDecodeMessage
    // in the backend), sized for a single line the way this frozen banner
    // needs. The old visiblePaymentSuggestions()-based fallback below
    // predates that hierarchy and normally has nothing left to show once
    // it's active (its suggestion cards are suppressed whenever
    // lastPrimaryDecodeMessage exists) - kept only as a defensive
    // fallback for the rare case primaryDecodeMessage itself is null.
    if (lastPrimaryDecodeMessage?.sticky) return lastPrimaryDecodeMessage.sticky;
    const visible = visiblePaymentSuggestions();
    return visible.length === 0
      ? "We've checked your options"
      : (visible[0]?.heading || "You could save more on this trip");
  }

  return "sairro decode";
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
      <div class="price-intel-frozen-eyebrow">sairro decode</div>
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

// Desktop/tablet equivalent of the frozen banner above. .price-intel-hero
// (the full-width band between the search card and the results grid,
// see ensureMobilePriceIntelPlacement's desktop branch below) had no
// scroll-persistent version at all - scroll a few flight cards down and
// it was just gone. This mirrors the mobile pattern exactly (sentinel +
// scroll-listener + fixed banner that takes over), sized to the page's
// own centered column instead of an edge-to-edge mobile bar, and wider/
// richer (headline + supporting line + the live Add button when there's
// an actionable suggestion) per founder feedback that a single truncated
// line wasn't enough on the extra width desktop has to spend.
function ensureDesktopDecodeFrozenBanner() {
  let banner = document.getElementById("decodeFrozenBanner");
  if (banner) return banner;

  banner = document.createElement("div");
  banner.id = "decodeFrozenBanner";
  banner.className = "decode-frozen-banner";
  banner.innerHTML = `
    <div class="decode-frozen-banner-inner">
      <span class="decode-frozen-dot"></span>
      <div class="decode-frozen-text">
        <div class="decode-frozen-eyebrow">sairro decode</div>
        <div class="decode-frozen-heading" id="decodeFrozenHeading"></div>
        <div class="decode-frozen-sub" id="decodeFrozenSub"></div>
      </div>
    </div>
  `;
  banner.addEventListener("click", (e) => {
    if (e.target.closest(".decode-frozen-cta")) return;
    const card = document.querySelector(".price-intel-hero");
    card?.scrollIntoView({ behavior: "instant", block: "start" });
  });

  document.body.appendChild(banner);
  return banner;
}

// Mirrors whatever the full .price-intel-hero card is already showing
// rather than recomputing suggestion copy separately - reading its
// rendered heading/body means this can never disagree with the full
// card, and the Add button proxies its click to the real one instead of
// duplicating the accept-suggestion logic.
//
// Reads .decode-primary-heading/.decode-primary-body (the decode
// hierarchy's own markup) rather than getPriceIntelHeroLine() for the
// heading slot - that function now returns the CONDENSED one-line
// "sticky" text meant for the mobile banner's single line; dumping it
// into this banner's heading would waste the two-line richness this
// wider desktop banner was specifically built for (founder feedback: "a
// single truncated line wasn't enough on the extra width desktop has to
// spend"). Previously queried .payment-guide-suggestion-message, which
// stopped existing once the decode hierarchy replaced the old suggestion
// cards it belonged to - this banner's sub-line was silently blank ever
// since (confirmed 2026-08-10).
function updateDesktopDecodeFrozenBannerText() {
  const heading = document.getElementById("decodeFrozenHeading");
  const sub = document.getElementById("decodeFrozenSub");

  const liveHeading = document.querySelector(".price-intel-hero .decode-primary-heading");
  const liveBody = document.querySelector(".price-intel-hero .decode-primary-body");
  if (heading) heading.textContent = liveHeading ? liveHeading.textContent : getPriceIntelHeroLine();
  if (sub) sub.textContent = liveBody ? liveBody.textContent : "";

  const banner = document.getElementById("decodeFrozenBanner");
  const liveAddBtn = document.querySelector(".price-intel-hero .payment-guide-add-btn");
  if (!banner) return;

  let cta = banner.querySelector(".decode-frozen-cta");
  if (liveAddBtn) {
    if (!cta) {
      cta = document.createElement("button");
      cta.type = "button";
      cta.className = "decode-frozen-cta";
      banner.querySelector(".decode-frozen-banner-inner").appendChild(cta);
      cta.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelector(".price-intel-hero .payment-guide-add-btn")?.click();
      });
    }
    cta.textContent = liveAddBtn.textContent;
  } else if (cta) {
    cta.remove();
  }
}

// Small clearance from the real viewport top, same as
// PRICE_INTEL_BANNER_TOP_OFFSET above - not offset by .nav's height.
// .nav declares position:sticky but .skydeal-hero-header (the other
// class on the same live <header>) sets position:relative later in the
// cascade at equal specificity and wins, so the nav doesn't actually
// stay pinned - confirmed live (getComputedStyle(nav).position reports
// "relative", nav scrolls fully away). A small, viewport-anchored
// offset means this banner's timing isn't tied to that pre-existing bug
// either way, and it only appears once the hero has essentially fully
// scrolled past, not while a chunk of it (e.g. its timing-insight
// footer) is still on screen.
const DECODE_FROZEN_BANNER_TOP_OFFSET = 10;

function checkDecodeFrozenBannerFreeze() {
  if (isSkyDealMobileView()) return;

  const sentinel = document.getElementById("decodeHeroSentinel");
  const banner = document.getElementById("decodeFrozenBanner");
  if (!sentinel || !banner) return;

  const pastTop = sentinel.getBoundingClientRect().top < DECODE_FROZEN_BANNER_TOP_OFFSET;
  banner.classList.toggle("is-visible", pastTop);
  if (pastTop) updateDesktopDecodeFrozenBannerText();
}

let decodeFrozenBannerTicking = false;
function scheduleDecodeFrozenBannerCheck() {
  if (decodeFrozenBannerTicking) return;
  decodeFrozenBannerTicking = true;
  requestAnimationFrame(() => {
    decodeFrozenBannerTicking = false;
    checkDecodeFrozenBannerFreeze();
  });
}

window.addEventListener("scroll", scheduleDecodeFrozenBannerCheck, { passive: true });
window.addEventListener("resize", scheduleDecodeFrozenBannerCheck, { passive: true });

// Keeps .filter-card in view while the (much taller) results column
// scrolls past it, so Filters doesn't disappear once you're a dozen
// flight cards down. .filter-panel already declared position:sticky
// here, but confirmed live it never actually clamps - same class of bug
// as .nav (see the decode-frozen-banner comment above), different
// mechanism, not worth chasing further given this JS-driven
// position:fixed pattern is already proven twice in this file. Same
// 3-state shape as the others: static above the stick point, fixed
// while .filter-panel (stretched tall by the grid's align-items:stretch
// to match .flights-workspace) still has room, then absolute at the
// panel's own bottom edge once it runs out - so it settles above the
// footer instead of overlapping it.
//
// roomLeft's height term is cached, not live-measured, whenever the card
// isn't already pinned/bottomed (2026-08-20 fix, same idea as the
// existing cardHeight cache below). .filter-panel and .flights-workspace
// are sibling grid items under align-items:stretch, both stretched to
// match whichever one's OWN natural content is tallest - which is
// .filter-card's, since round-trip mode paginates each results column to
// one card at a time (short) while the filter list (airlines, airports,
// departure time, etc.) runs long. So .flights-workspace isn't a stable
// substitute either: the instant .filter-card leaves flow (fixed or
// absolute), the row's natural-content max drops, and BOTH siblings'
// stretched height collapses together - confirmed live (.flights-
// workspace's own rect shrank in lockstep with .filter-panel's). Feeding
// that live height back into the very calculation that decides whether
// to take the card out of flow is what caused the bug: roomLeft swings
// deeply negative the instant the card leaves flow, flipping it straight
// back to static, which re-inflates both siblings, flipping it right
// back out - an infinite same-frame oscillation (window.scrollY got
// stuck mid-page, .filter-card flickered between on-screen and 1600px
// off-screen every animation frame). Caching the height only while
// everything is still in its normal, uncollapsed state breaks the loop.
const FILTER_CARD_TOP_OFFSET = 92;

function updateStickyFilterCard() {
  const card = document.querySelector(".filter-card");
  const panel = document.querySelector(".filter-panel");
  if (!card || !panel) return;

  if (isSkyDealMobileView() || window.matchMedia("(max-width: 1080px)").matches) {
    card.classList.remove("is-pinned", "is-bottomed");
    card.style.left = "";
    card.style.width = "";
    return;
  }

  const panelRect = panel.getBoundingClientRect();
  const cardIsOutOfFlow = card.classList.contains("is-pinned") || card.classList.contains("is-bottomed");
  // Same reasoning as updateDesktopStickyFilterPanel used to have: only
  // remeasure while not already fixed, since a fixed element's own rect
  // no longer reflects its natural content height once pinned.
  if (!cardIsOutOfFlow) {
    updateStickyFilterCard._lastHeight = card.getBoundingClientRect().height;
    updateStickyFilterCard._lastPanelHeight = panelRect.height;
  }
  const cardHeight = updateStickyFilterCard._lastHeight || card.getBoundingClientRect().height;
  const panelHeight = updateStickyFilterCard._lastPanelHeight || panelRect.height;

  const pastTop = panelRect.top < FILTER_CARD_TOP_OFFSET;
  const roomLeft = (panelRect.top + panelHeight) - (FILTER_CARD_TOP_OFFSET + cardHeight);

  // Taking .filter-card out of flow (fixed or absolute) also has to hold
  // .filter-panel's own height where it was - otherwise the parent
  // collapses toward zero the instant its only in-flow child disappears,
  // a multi-hundred-pixel same-frame layout shift right at the scroll
  // position that triggered it. That's large enough to trip Chrome's
  // scroll anchoring, which yanks window.scrollY to compensate, which
  // fires another scroll event with a different panelRect.top, which can
  // flip pastTop and undo the very change that caused the shift -
  // confirmed live as a permanent scrollY-stuck flicker between pinned
  // and static every animation frame. Pinning/bottoming and un-pinning
  // must not change how much vertical space the layout thinks this
  // column occupies.
  if (pastTop) {
    panel.style.minHeight = `${panelHeight}px`;
  } else {
    panel.style.minHeight = "";
  }

  if (pastTop && roomLeft > 0) {
    card.classList.add("is-pinned");
    card.classList.remove("is-bottomed");
    card.style.left = `${panelRect.left}px`;
    card.style.width = `${panelRect.width}px`;
  } else if (pastTop) {
    card.classList.remove("is-pinned");
    card.classList.add("is-bottomed");
    card.style.left = "";
    card.style.width = "";
  } else {
    card.classList.remove("is-pinned", "is-bottomed");
    card.style.left = "";
    card.style.width = "";
  }
}

let filterCardStickyTicking = false;
function scheduleFilterCardStickyCheck() {
  if (filterCardStickyTicking) return;
  filterCardStickyTicking = true;
  requestAnimationFrame(() => {
    filterCardStickyTicking = false;
    updateStickyFilterCard();
  });
}

window.addEventListener("scroll", scheduleFilterCardStickyCheck, { passive: true });
window.addEventListener("resize", scheduleFilterCardStickyCheck, { passive: true });
document.addEventListener("DOMContentLoaded", scheduleFilterCardStickyCheck);

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
    card.classList.remove("price-intel-hero");
    // 2026-08-20: anchored to the round-trip toggle (not mobileQuickFilters)
    // so the card renders ABOVE the toggle - user-requested order is
    // banner, then Departure/Return toggle, then the sort/filter row.
    const anchor = document.getElementById("mobileRoundTripTabs") || document.getElementById("mobileQuickFilters") || workspace;
    proResults.insertBefore(card, anchor);
    proResults.insertBefore(sentinel, anchor);
    ensureMobilePriceIntelFrozenBanner();
    checkPriceIntelScrollFreeze();
    document.getElementById("decodeHeroSentinel")?.remove();
    document.getElementById("decodeFrozenBanner")?.classList.remove("is-visible");
    updateStickyFilterCard();
    return;
  }

  sentinel.remove();
  const banner = document.getElementById("priceIntelFrozenBanner");
  if (banner) banner.classList.remove("is-visible");

  // Desktop, post-search only (2026-07-21, v2): the hero band's dark,
  // bold treatment only earns its weight once there's a real result to
  // headline (a live suggestion, or "you're already optimised") - shown
  // pre-search, the same treatment had nothing behind it yet and read as
  // a random, unearned banner (founder feedback on the v1 always-on
  // hero). Pre-search and while loading, the card stays exactly where
  // it always lived: the quiet .filter-panel sidebar slot.
  const filterPanel = document.querySelector(".filter-panel");
  const filterCard = document.querySelector(".filter-card");
  const wrap = document.querySelector("main.wrap") || document.querySelector(".wrap");

  if (hasActiveSearchResults() && wrap) {
    card.classList.add("price-intel-hero");
    if (card.parentElement !== wrap) {
      wrap.insertBefore(card, proResults);
    }

    let heroSentinel = document.getElementById("decodeHeroSentinel");
    if (!heroSentinel) {
      heroSentinel = document.createElement("div");
      heroSentinel.id = "decodeHeroSentinel";
      heroSentinel.className = "decode-hero-sentinel";
    }
    wrap.insertBefore(heroSentinel, proResults);

    ensureDesktopDecodeFrozenBanner();
    checkDecodeFrozenBannerFreeze();
    updateStickyFilterCard();
    return;
  }

  card.classList.remove("price-intel-hero");
  document.getElementById("decodeHeroSentinel")?.remove();
  document.getElementById("decodeFrozenBanner")?.classList.remove("is-visible");
  if (filterPanel && card.parentElement !== filterPanel) {
    filterPanel.insertBefore(card, filterCard || filterPanel.firstChild);
  }
  updateStickyFilterCard();
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

  // Used to scroll straight to the return flight cards - landed the user
  // mid-list with no indication the Departure/Return toggle above had
  // just flipped to Return for them (Kapil feedback 2026-08-20: "the
  // first screen they see... starts with the first flight card"). Scroll
  // to the toggle itself instead, so its now-active "Return" state is the
  // first thing visible, not buried above the fold.
  const tabs = document.getElementById("mobileRoundTripTabs");
  if (!tabs) return;

  setTimeout(() => {
    tabs.scrollIntoView({
      behavior: "instant",
      block: "start"
    });

    // scrollIntoView alone still isn't enough (caught live, not from
    // source reading - Kapil feedback: "I see the sairro decode sticky
    // banner but not the return toggle"). #mobileSearchSummary (the
    // route bar, position:sticky, z-index:50) and, once its sentinel
    // crosses the trigger threshold right as this toggle nears the top,
    // #priceIntelFrozenBanner (the condensed banner, position:fixed,
    // z-index:55) both stack ABOVE this toggle's own z-index:40 at the
    // exact same screen position - scrolling the toggle to y:0 just
    // parks it directly behind them, fully hidden either way. Double rAF
    // so this runs after both scrollIntoView's own reflow AND the OTHER
    // scroll listener's rAF-deferred frozen-banner visibility check
    // (schedulePriceIntelScrollCheck) have settled, then nudge further
    // by however much of the toggle is still covered.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const summary = document.getElementById("mobileSearchSummary");
        const frozenBanner = document.getElementById("priceIntelFrozenBanner");
        const summaryBottom = summary ? summary.getBoundingClientRect().bottom : 0;
        const bannerBottom = frozenBanner?.classList.contains("is-visible")
          ? frozenBanner.getBoundingClientRect().bottom
          : 0;
        const coveredUntil = Math.max(summaryBottom, bannerBottom, 0);
        const tabsTop = tabs.getBoundingClientRect().top;
        if (tabsTop < coveredUntil) {
          window.scrollBy(0, tabsTop - coveredUntil);
        }
      });
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
  // Keeps the sort chips matching whichever leg is active on every call,
  // not just when the toggle itself is showing - one-way search (ready
  // is false here) still has a sort row acting on outSort.
  syncMobileSortChips();

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
    "#fromInput",
    "#toInput",
    "#departInput",
    "#returnInput",
    "#paxTriggerBtn",
    "#cabinSelect"
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

  const paxSummary = formatPaxSummaryLabel({
    adults: Number(lastSearchPayload?.adults ?? paxState.adults ?? 1) || 1,
    children: Number(lastSearchPayload?.children ?? paxState.children ?? 0) || 0,
    infants: Number(lastSearchPayload?.infants ?? paxState.infants ?? 0) || 0
  });
  const cabin = lastSearchPayload?.travelClass || "Economy";

  const isRound = isRoundTripModeActive();
  const dateText = isRound && ret ? `${depart} - ${ret}` : depart;

  summary.innerHTML = `
    <div class="mobile-search-summary-left">
      <div class="mobile-search-route">${safeText(from)} ${getRouteArrowForSearchState()} ${safeText(to)}</div>
      <div class="mobile-search-meta">${safeText(dateText)} · ${safeText(paxSummary)} · ${safeText(cabin)}</div>
    </div>
    <button type="button" id="mobileEditSearchBtn" class="mobile-edit-search-btn">Edit</button>
  `;

  summary.querySelector("#mobileEditSearchBtn")?.addEventListener("click", () => {
    document.body.classList.remove("mobile-results-mode");
    document.body.classList.remove("desktop-results-mode");
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

// ---------- Desktop: payment-first search summary ----------
// Mirrors the mobile search-to-results collapse above (full form -> thin
// banner -> Edit search brings it back) for viewports wider than 760px,
// with one difference: the payment chip is its own tap target that opens
// the real payment modal directly, since payment methods are the thing
// people change most after a search - "Edit search" only covers route,
// dates, passengers and cabin. See DECISIONS.md ("Post-search layout").
function ensureDesktopSearchSummary() {
  const results = document.querySelector(".pro-results") || document.querySelector(".results");
  if (!results) return null;

  let summary = document.getElementById("desktopSearchSummary");
  if (summary) return summary;

  summary = document.createElement("div");
  summary.id = "desktopSearchSummary";
  summary.className = "desktop-search-summary";

  results.parentNode.insertBefore(summary, results);

  return summary;
}

function desktopPaymentChipLabel() {
  const n = Array.isArray(selectedPaymentMethods) ? selectedPaymentMethods.length : 0;
  if (n === 0) return "Add payment method";
  if (n === 1) return paymentMethodDisplayLabel(selectedPaymentMethods[0]);
  return `${n} payment methods`;
}

function renderDesktopSearchSummary() {
  const summary = ensureDesktopSearchSummary();
  if (!summary) return;

  const from = String(lastSearchPayload?.from || fromInput?.value || "From").toUpperCase();
  const to = String(lastSearchPayload?.to || toInput?.value || "To").toUpperCase();

  const depart = formatMobileSummaryDate(lastSearchPayload?.departureDate || departInput?.value || "");
  const ret = formatMobileSummaryDate(lastSearchPayload?.returnDate || returnInput?.value || "");

  const paxSummary = formatPaxSummaryLabel({
    adults: Number(lastSearchPayload?.adults ?? paxState.adults ?? 1) || 1,
    children: Number(lastSearchPayload?.children ?? paxState.children ?? 0) || 0,
    infants: Number(lastSearchPayload?.infants ?? paxState.infants ?? 0) || 0
  });
  const cabin = lastSearchPayload?.travelClass || "Economy";

  const isRound = isRoundTripModeActive();
  const dateText = isRound && ret ? `${depart} - ${ret}` : depart;

  summary.innerHTML = `
    <div class="desktop-search-route">
      ${safeText(from)} ${getRouteArrowForSearchState()} ${safeText(to)}
      <span class="sep">&middot;</span>${safeText(dateText)}
      <span class="sep">&middot;</span>${safeText(paxSummary)}
      <span class="sep">&middot;</span>${safeText(cabin)}
    </div>
    <div class="desktop-search-summary-right">
      <button type="button" id="desktopPaymentChipBtn" class="desktop-payment-chip"><span>${safeText(desktopPaymentChipLabel())}</span></button>
      <button type="button" id="desktopEditSearchBtn" class="desktop-edit-search-btn">Edit search</button>
    </div>
  `;

  summary.querySelector("#desktopPaymentChipBtn")?.addEventListener("click", () => {
    openPaymentModal();
  });

  summary.querySelector("#desktopEditSearchBtn")?.addEventListener("click", () => {
    document.body.classList.remove("mobile-results-mode");
    document.body.classList.remove("desktop-results-mode");
    const searchCard = document.querySelector(".search-card");
    if (searchCard) searchCard.scrollIntoView({ behavior: "instant", block: "start" });
  });
}

// Cheap text-only refresh for the payment chip - called from
// updatePaymentButtonLabel()'s single choke point (see its own comment)
// so the chip stays in sync whenever payment methods change, without a
// full summary re-render/re-bind on every add/remove.
function refreshDesktopSearchSummaryPaymentChip() {
  if (!document.body.classList.contains("desktop-results-mode")) return;
  const chipLabel = document.querySelector("#desktopPaymentChipBtn span");
  if (chipLabel) chipLabel.textContent = desktopPaymentChipLabel();
}

function enterDesktopResultsMode() {
  if (isSkyDealMobileView()) return;

  renderDesktopSearchSummary();
  document.body.classList.add("desktop-results-mode");
}

// enterMobileResultsMode()/enterDesktopResultsMode() above are only ever
// called from search-completion code paths, so resizing the window (or
// rotating a tablet) after a search was already active never re-evaluated
// which one should be showing - the results-mode class picked at search
// time was permanent for the rest of the page's life (QA, 2026-08-12:
// reproduced live - resizing from desktop to mobile width left the full,
// uncollapsed search form permanently visible above the results instead
// of the intended thin summary bar, and the mobile-only quick-filter
// chips/round-trip tabs never initialized). Reads which mode is ACTUALLY
// active straight off the body class every time, rather than tracking a
// separately-initialized "last known" flag - an earlier version of this
// fix used a nullable tracking variable that got initialized to the
// current value before ever comparing it, so the first resize after a
// search could never detect a flip (caught in this same QA/fix pass by
// re-testing live before shipping, not left in).
window.addEventListener("resize", () => {
  const isMobileModeActive = document.body.classList.contains("mobile-results-mode");
  const isDesktopModeActive = document.body.classList.contains("desktop-results-mode");
  if (!isMobileModeActive && !isDesktopModeActive) return;

  const nowMobile = isSkyDealMobileView();
  if (isMobileModeActive === nowMobile) return;

  document.body.classList.remove("mobile-results-mode", "desktop-results-mode");
  if (nowMobile) {
    enterMobileResultsMode();
    renderMobileQuickFilters();
    updateMobileRoundTripTabs();
  } else {
    enterDesktopResultsMode();
  }
}, { passive: true });

function removeStandaloneSearchError() {
  const existing = document.getElementById("skySearchStandaloneError");
  if (existing) existing.remove();

  const proResults = document.querySelector(".pro-results");
  if (proResults) proResults.style.removeProperty("display");
}

// ---------- Decode wait stage ----------
// While a search is actually in flight (only relevant when
// .how-it-works-presearch is the thing on screen - i.e. the first search
// of a session, or after an error/no-results revert), swap its static
// explainer for a live progress view instead of leaving it inert for
// however long the real /search + /payment-suggestions round trip takes
// (measured ~6-20s+). Deliberately does NOT touch setResultsPreSearch()
// or its timing - only the inner content of the pre-search explainer
// changes; a re-search (pre-search already false from a prior search)
// is untouched and keeps today's behavior. See DECISIONS.md.
var decodeWaitTimerId = null;
var decodeWaitCurrentPhase = 0;
var decodeWaitCountdownTimerId = null;
// Real waits here range roughly 6-20s+ (see comment above) with no fixed
// schedule - this is a target for the countdown/plane to aim at, not a
// guarantee. Picked from the founder's own stated typical experience
// (2026-08-17: "right now we're taking fifteen to twenty seconds"), not
// the worst case, since a countdown tuned to the worst case would read
// as too slow on every normal search. Runs past this are expected and
// handled explicitly (decodeWaitTick() below), not an error state.
var DECODE_WAIT_ESTIMATE_SECONDS = 18;

function decodeWaitPhaseForProgress(pct) {
  if (pct < 20) return 1;
  if (pct < 50) return 2;
  if (pct < 78) return 3;
  return 4;
}

function decodeWaitSetStep(n, state) {
  var step = document.querySelector('.dws-step[data-step="' + n + '"]');
  if (!step) return;
  step.classList.remove("done", "active");
  if (state) step.classList.add(state);
}

var DECODE_WAIT_SUBTEXTS = {
  1: "Scanning live fares for your route",
  2: "Checking MakeMyTrip, Goibibo, Yatra and more",
  3: "Matching your cards and UPI apps against today's offers",
  4: "Locking in your true final price",
};

function decodeWaitApplyProgress(pct) {
  var fill = document.getElementById("dwsFill");
  if (fill) fill.style.width = pct + "%";
  var phase = decodeWaitPhaseForProgress(pct);
  if (phase !== decodeWaitCurrentPhase) {
    if (decodeWaitCurrentPhase) decodeWaitSetStep(decodeWaitCurrentPhase, "done");
    decodeWaitSetStep(phase, "active");
    // Once overrun, decodeWaitTick() owns the subtext (reassurance
    // message) - this phase-based text would otherwise stomp it back on
    // the next progress tick, which fire independently of each other.
    if (!decodeWaitIsOverrun) {
      var subtext = document.getElementById("dwsSubtext");
      if (subtext) subtext.textContent = DECODE_WAIT_SUBTEXTS[phase];
    }
    decodeWaitCurrentPhase = phase;
  }
}

var decodeWaitIsOverrun = false;
var decodeWaitStartMs = 0;
var DECODE_WAIT_OVERRUN_SUBTEXT = "A couple of portals are taking a little longer than usual";

// Countdown + plane (2026-08-17): "sairro decode" in the eyebrow read as
// a stray label with nothing to anchor it to (founder catch) - replaced
// with a live "Xs left" ticking down against DECODE_WAIT_ESTIMATE_SECONDS,
// and the plane (previously a decorative fixed-loop animation, see
// dwsFly's removal in style.css) now actually glides from BOM to DEL in
// sync with it. Since real waits commonly run past the estimate (see
// DECODE_WAIT_ESTIMATE_SECONDS' own comment), this explicitly does NOT
// let the countdown hit a bare "0s" or the plane land mid-request -
// past the estimate both switch to an "almost there" holding state that
// keeps reading as "still working," not "broken" or "done."
function decodeWaitTick() {
  var elapsedMs = performance.now() - decodeWaitStartMs;
  var estimateMs = DECODE_WAIT_ESTIMATE_SECONDS * 1000;
  var eyebrowText = document.getElementById("dwsEyebrowText");
  var eyebrow = document.getElementById("dwsEyebrow");
  var plane = document.getElementById("dwsFlyingPlane");
  var subtext = document.getElementById("dwsSubtext");

  if (elapsedMs < estimateMs) {
    var remain = Math.max(0, Math.ceil((estimateMs - elapsedMs) / 1000));
    if (eyebrowText) eyebrowText.textContent = remain + "s left";
    if (eyebrow) eyebrow.classList.remove("overrun");
    if (subtext) subtext.classList.remove("overrun");
    if (plane) {
      var planePct = 2 + (elapsedMs / estimateMs) * 96;
      plane.style.left = planePct + "%";
      plane.classList.remove("holding");
    }
  } else {
    if (!decodeWaitIsOverrun) {
      decodeWaitIsOverrun = true;
      if (subtext) subtext.textContent = DECODE_WAIT_OVERRUN_SUBTEXT;
    }
    if (eyebrowText) eyebrowText.textContent = "almost there";
    if (eyebrow) eyebrow.classList.add("overrun");
    if (subtext) subtext.classList.add("overrun");
    if (plane) {
      plane.style.left = "98%";
      plane.classList.add("holding");
    }
  }
}

function stopDecodeWaitTimers() {
  if (decodeWaitTimerId) clearTimeout(decodeWaitTimerId);
  decodeWaitTimerId = null;
  if (decodeWaitCountdownTimerId) clearInterval(decodeWaitCountdownTimerId);
  decodeWaitCountdownTimerId = null;
}

// Reverts .how-it-works-presearch back to its normal static explainer -
// needed whenever pre-search flips back to true after a failed/empty
// search, so the next thing the user sees isn't a frozen mid-progress
// wait stage. Not needed on the success path (the whole explainer is
// hidden once pre-search flips false, regardless of what's inside it).
function resetDecodeWaitVisualToStatic() {
  stopDecodeWaitTimers();
  decodeWaitCurrentPhase = 0;
  var hiwPresearch = document.getElementById("hiwPresearch");
  var waitStage = document.getElementById("decodeWaitStage");
  var staticContent = document.getElementById("hiwStaticContent");
  if (hiwPresearch) hiwPresearch.classList.remove("decode-wait-active");
  if (waitStage) waitStage.style.display = "none";
  if (staticContent) staticContent.style.display = "";
}

function startDecodeWaitStage(fromCode, toCode) {
  stopDecodeWaitTimers();
  decodeWaitCurrentPhase = 0;
  decodeWaitIsOverrun = false;

  var hiwPresearch = document.getElementById("hiwPresearch");
  var waitStage = document.getElementById("decodeWaitStage");
  var staticContent = document.getElementById("hiwStaticContent");
  if (!hiwPresearch || !waitStage || !staticContent) return;

  hiwPresearch.classList.add("decode-wait-active");
  staticContent.style.display = "none";
  waitStage.style.display = "block";

  var fromEl = document.getElementById("dwsFrom");
  var toEl = document.getElementById("dwsTo");
  if (fromEl) fromEl.textContent = safeText(String(fromCode || "").toUpperCase() || "—");
  if (toEl) toEl.textContent = safeText(String(toCode || "").toUpperCase() || "—");

  var eyebrow = document.getElementById("dwsEyebrow");
  var eyebrowText = document.getElementById("dwsEyebrowText");
  var plane = document.getElementById("dwsFlyingPlane");
  if (eyebrow) eyebrow.classList.remove("overrun");
  if (eyebrowText) eyebrowText.textContent = DECODE_WAIT_ESTIMATE_SECONDS + "s left";
  if (plane) {
    plane.classList.remove("holding");
    plane.style.left = "2%";
  }
  decodeWaitStartMs = performance.now();
  decodeWaitTick();
  decodeWaitCountdownTimerId = setInterval(decodeWaitTick, 250);

  [1, 2, 3, 4].forEach(function (n) { decodeWaitSetStep(n, null); });
  var fill = document.getElementById("dwsFill");
  if (fill) fill.style.width = "0%";
  var subtext = document.getElementById("dwsSubtext");
  if (subtext) subtext.textContent = " ";

  // Domestic fares are realistically ~5-10k; the plain per-digit
  // randomizer below has no concept of that and can just as easily land
  // on an international-scale number (e.g. ₹80,000+) mid-decode, which
  // reads as alarming for the second or two before the real, much lower
  // price replaces it (founder catch, 2026-08-15). isDomesticSearchTrip()
  // already reads lastSearchPayload, which is set before this function is
  // called (script.js:7674 runs before the 7752 call site), so it
  // reflects the search actually in flight, not a stale one.
  var isDomestic = isDomesticSearchTrip() === true;

  var digits = document.querySelectorAll("#dwsTicketPrice .dws-digit");
  var cipherDigitIndex = 0;
  function randomDomesticTicketDigits() {
    var n = 5000 + Math.floor(Math.random() * 5000); // 5000..9999
    return String(n).padStart(5, "0");
  }
  function advanceCipherDigits(count) {
    if (isDomestic) {
      // Refreshed as one coherent number (not per-digit) so it always
      // reads as a plausible domestic fare, never a patchwork of
      // independently-drawn digits that could drift out of range.
      var s = randomDomesticTicketDigits();
      for (var j = 0; j < digits.length; j++) {
        if (digits[j]) digits[j].textContent = s[j];
      }
      return;
    }
    for (var i = 0; i < count; i++) {
      var d = digits[cipherDigitIndex % digits.length];
      if (d) d.textContent = Math.floor(Math.random() * 10);
      cipherDigitIndex++;
    }
  }

  // Unknown real duration (no fixed schedule) - a fixed time constant
  // eases progress toward ~94% and lets it slow down the longer it runs,
  // but never claims 100% until stopDecodeWaitTimers() is actually
  // called from the real /search + /payment-suggestions completion. A
  // fast ~6s response just catches this curve early; a slow ~30s+ one
  // keeps creeping upward instead of looking stalled. See DECISIONS.md
  // ("Sairro decode wait stage") for why this replaced an earlier,
  // wall-clock-scheduled version.
  var maxProgress = 94;
  var tau = 9000;
  var startTime = performance.now();

  // Runs for the WHOLE wait (2026-08-14), not just an opening flourish -
  // a stalled progress bar/frozen price reads as broken and makes the
  // wait feel longer, which is exactly backwards on searches that
  // routinely run 20-50s+ (live-measured this session). The 2026-08-09
  // fix that capped this to a 3s flourish was solving a real problem
  // (continuous 60fps rAF + a 90ms DOM-mutation interval fighting the
  // user's scroll for the entire wait) but over-corrected by freezing
  // outright instead of just slowing down. This keeps the original fast,
  // smooth cadence for the first FLOURISH_MS (proven fine), then drops
  // to a self-rescheduling setTimeout at ~9x lower frequency for the
  // remainder - .dws-fill's existing `transition: width 0.5s ease`
  // (style.css) smooths the visual motion between those sparser updates,
  // and the cipher only touches one digit per tick post-flourish instead
  // of all five - both together keep something visibly moving until the
  // real result arrives without reintroducing the churn that caused the
  // original scroll-jank bug.
  var FLOURISH_MS = 3000;
  var FLOURISH_INTERVAL_MS = 90;
  var SUSTAINED_INTERVAL_MS = 700;

  function tick() {
    var elapsed = performance.now() - startTime;
    var inFlourish = elapsed < FLOURISH_MS;
    decodeWaitApplyProgress(maxProgress * (1 - Math.exp(-elapsed / tau)));
    advanceCipherDigits(inFlourish ? digits.length : 1);
    decodeWaitTimerId = setTimeout(tick, inFlourish ? FLOURISH_INTERVAL_MS : SUSTAINED_INTERVAL_MS);
  }
  decodeWaitTimerId = setTimeout(tick, 0);
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
        This can happen for a live pricing hiccup, or because of something about this search
        itself (like the date or route). Try again, or edit your search if it doesn't clear up.
        Your route and payment selections are still saved.
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
    document.body.classList.remove("desktop-results-mode");
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
  // Do NOT add "search-error-mode" here (tried, then reverted, 2026-08-15)
  // - that class triggers "body.search-error-mode .pro-results
  // { display: none !important; }" (style.css), which is the mechanism
  // renderSearchErrorState() actually depends on: it deliberately hides
  // the whole .pro-results and injects a completely separate standalone
  // element after .search-card instead. This function takes the simpler,
  // already-correct approach of rendering straight into #outboundList
  // (inside .flights-workspace/.pro-results) - the only thing that was
  // ever wrong is the caller re-adding "pre-search" to .pro-results
  // (see handleSearch's missingOutbound/missingReturn branch), which
  // force-hides .flights-workspace via ".pro-results.pre-search
  // .flights-workspace { display: none !important; }" regardless of
  // anything set here. Fixed at the source (setResultsPreSearch(false)
  // instead of true) rather than here.
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
    document.body.classList.remove("desktop-results-mode");
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

// decoratePaymentTabsForMobile() removed 2026-08-16 - it used to sniff
// .pm-tabs' text content to guess which row was the category-tab row and
// tag it/its EMI child with classes for CSS to key off. Now unnecessary:
// renderPaymentTabs() itself always wraps the category buttons in a
// stable ".pm-tabs-scroll" child, directly selectable, no text-sniffing
// needed. The "swipe for more" hint was retired 2026-08-17 once shorter
// mobile labels made scrolling the exception rather than the norm.

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
            ${
              !ready
                ? "Select one departure and one return flight."
                : selectedTripCompareLoading
                  ? "Checking your best price…"
                  : selectedTripComparisonError
                    ? "Couldn't check your best price."
                    : "Best price calculated for the flights you selected."
            }
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
              ${
                selectedTripCompareLoading || bestTripPortalInfo
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
                          : `Book with ${bestTripPortalInfo.portal}`
                      }
                    </button>
                  `
                  : ""
              }

              <button
                type="button"
                id="compareSelectedTripBtn"
                class="sky-trip-compare-btn"
                ${selectedTripCompareLoading ? "disabled" : ""}
              >
                ${selectedTripComparisonError ? "Try again" : "Compare all portals"}
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
    enterDesktopResultsMode();
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
    // When the auto-comparison failed (button reads "Try again"), retry
    // THAT - refreshSelectedTripComparison() - rather than
    // compareSelectedRoundTrip(), which is a different action (opens the
    // full all-portals modal) that never touches selectedTripComparison/
    // selectedTripComparisonError, so it wouldn't actually clear the
    // error or restore the Book button on success.
    if (selectedTripComparisonError) {
      refreshSelectedTripComparison();
    } else {
      compareSelectedRoundTrip();
    }
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
      tripComparison: comparison,
      // Metro-substitution deep-link fix (2026-08-19) - without these,
      // buildFlightPortalSearchUrl() had nothing to read and silently fell
      // back to the searched route for both legs, even when one or both
      // selected flights actually depart/arrive a substituted airport.
      departureAirportCode: selectedOutboundFlight.departureAirportCode,
      arrivalAirportCode: selectedOutboundFlight.arrivalAirportCode,
      returnDepartureAirportCode: selectedReturnFlight.departureAirportCode,
      returnArrivalAirportCode: selectedReturnFlight.arrivalAirportCode
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

// Surfaces the backend's priceSource distinction (see
// skydeal-backend/index.js mapFlightsFromFlightAPI and
// NO_CARRIER_PRICE_ESTIMATE_DISCOUNT) to the user for the first time -
// the data has always been sent in the /search response, just never
// rendered. Deliberately silent for the normal "carrier_airline" case
// (the overwhelming majority of flights) - only the minority
// "estimated_min_reseller" case (currently Star Air, Alliance Air; see
// FLIGHTAPI_CARRIER_PRICING_AUDIT_2026-07.md) gets a badge, so as not to
// clutter every card with a "verified" tag nobody needs. Reuses the exact
// .stopsHoverable/.stopsTooltip tap-and-hover mechanism already wired
// generically in renderList() - no new interaction code needed, just the
// same class names with different content.
function estimatedPriceBadgeHtml(f) {
  if (f?.priceSource !== "estimated_min_reseller") return "";

  return `
    <div class="stopsHoverable estimatedPriceBadge">
      <span class="estimatedPriceBadgeLabel">Estimated price</span>
      <div class="stopsTooltip">${safeText(f.displayAirlineName || f.airlineName)} doesn't publish a direct price for this flight, so we estimate it from other travel-booking sites. The real price may differ slightly - always confirm on the booking page before paying.</div>
    </div>
  `;
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
    // No stopsLineHtml() here - that divider exists to carry one dot per
    // stop, so on a non-stop flight it would render with zero dots: pure
    // empty vertical space (a 1px line plus its own margin) with nothing
    // for it to show. Timing/cost are what users actually scan for, so
    // this secondary info shouldn't claim space it isn't using.
    return `
      <div class="stops">
        ${durationHtml}
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

function flightCard(f, direction = "out", airportLabelFlags = {}) {
  const name = safeText(f.displayAirlineName || f.airlineName);
  const num = displayFlightNumber(f);
  const dep = fmtTime(f.departureTime);
  const arr = fmtTime(f.arrivalTime);

  // Only shown when the current results actually span more than one
  // airport for the same city on EITHER side (e.g. Mumbai = BOM + Navi
  // Mumbai) - see METRO_AIRPORT_GROUPS (backend) and renderList's
  // airportLabelFlags below. A normal single-airport route never builds
  // any of this, so existing cards are byte-for-byte unchanged (plain
  // .timeStopsRow, plain "dep → arr" .times, no .arrival-tile at all).
  //
  // MMT-style tile layout, once EITHER side needs disambiguation: .times
  // (departure time+city), .stops (duration/stop badge, unmodified from
  // the ordinary case), and a new .arrival-tile (arrival time+city) all
  // become TRUE siblings inside .timeStopsRow, which itself switches from
  // display:contents (passthrough into the outer .row grid - the ordinary
  // case) to its own real 3-column grid via the "tile-mode" class (see
  // CSS) - `auto 1fr auto`, so the middle .stops column gets whatever
  // space remains and the duration/stop text sits genuinely centered
  // between the two times, not just packed against .times. Only the
  // side(s) actually flagged get a city caption; a flight whose arrival
  // isn't itself ambiguous still needs its arrival TIME rendered
  // somewhere once the card is in tile mode, so the switch is driven by
  // "either side ambiguous", not "this specific side ambiguous" -
  // otherwise a Mumbai(BOM/NMI)->Aurangabad search would silently drop
  // the arrival time entirely (Aurangabad itself has only one airport).
  //
  // Round-trip mode's compact 2-column card layout (.row's own separate
  // grid-template-areas, see style.css) has no spare named area for a
  // 3rd tile - deliberately left as a known scope limit rather than
  // reworking that grid too, since every real report/screenshot of this
  // feature so far has been a one-way search. Falls back to the plain
  // "dep → arr" format there (no city disambiguation), never to a
  // half-built or overlapping tile.
  const showTileLayout = !isRoundTripModeActive() && Boolean(
    (airportLabelFlags.showDeparture && f.departureAirportCode) ||
    (airportLabelFlags.showArrival && f.arrivalAirportCode)
  );

  const depCityHtml = showTileLayout && f.departureAirportCode
    ? `<div class="flight-city-label">${safeText(metroCityLabelForCode(f.departureAirportCode))}</div>`
    : "";
  const arrCityHtml = showTileLayout && f.arrivalAirportCode
    ? `<div class="flight-city-label">${safeText(metroCityLabelForCode(f.arrivalAirportCode))}</div>`
    : "";

  const timesHtml = showTileLayout
    ? `<div class="times"><div class="dep-time">${dep}</div>${depCityHtml}</div>`
    : `<div class="times">${dep} → ${arr}</div>`;

  const arrivalTileHtml = showTileLayout
    ? `<div class="arrival-tile"><div class="arrival-time">${arr}</div>${arrCityHtml}</div>`
    : "";

  const best = f.bestDeal;
  const cardFinalPrice = best?.applied ? best.finalPrice : f.price;
  const cardSavings = best?.applied ? getSavingsAmount(best.basePrice, best.finalPrice) : 0;

  const key = flightKey(f);
  const isRoundTrip = isRoundTripModeActive();
  const selectedForDirection = direction === "ret" ? selectedReturnFlight : selectedOutboundFlight;
  const isSelectedForDirection = isSameSelectedFlight(f, selectedForDirection);

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

  // best?.applied renders via renderBestDealSummary's main (coupon-capable)
  // branch, which now folds oneWayActions into the same row as the coupon
  // instead of it sitting in its own full-width row below (founder catch:
  // that row was flex-end-aligned, leaving the whole left side empty at
  // the buttons' height). The "no extra discount" / no-bestDeal branches
  // never had a coupon to share a row with, so they keep the old
  // separate-row behavior below unchanged.
  const bestLine = best
    ? renderBestDealSummary(
        best,
        isRoundTrip ? "round-trip-leg" : "default",
        isSelectedForDirection,
        best.applied ? oneWayActions : ""
      )
    : `<div class="best">${
        isRoundTrip
          ? "Select both flights to compare the full round-trip booking price."
          : "Compare portals to find the best payable price."
      }${
        isRoundTrip
          ? `<span class="selectTripRadio${isSelectedForDirection ? " is-selected" : ""}" aria-hidden="true"></span>`
          : ""
      }</div>`;

  const oneWayActionsStandalone = best?.applied ? "" : oneWayActions;

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
            ${estimatedPriceBadgeHtml(f)}
          </div>
        </div>

        <div class="timeStopsRow${showTileLayout ? " tile-mode" : ""}">
          ${timesHtml}
          ${stopsBadgeHtml(f)}
          ${arrivalTileHtml}
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
      ${oneWayActionsStandalone}
    </div>
  `;
}

function renderList(el, items, direction = "out") {
  if (!el) return;
  if (!Array.isArray(items) || items.length === 0) {
    el.innerHTML = emptyStateHtml("default");
    return;
  }

  const airportLabelFlags = {
    showDeparture: getAvailableAirportCodes("departureAirportCode").length > 1,
    showArrival: getAvailableAirportCodes("arrivalAirportCode").length > 1
  };
  el.innerHTML = items.map((f) => flightCard(f, direction, airportLabelFlags)).join("");

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

      const href = buildFlightPortalSearchUrl(portal, flight, lastSearchPayload);
      if (href) {
        openBookingHandoffModal({
          portal,
          url: href,
          code: flight.bestDeal?.applied ? (flight.bestDeal?.code || null) : null,
          legs: [{ label: "Your flight", summary: selectedFlightSummary(flight) }]
        });
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
  const filtered = applyFlightFilters(outboundAll, isRoundTripModeActive() ? "out" : undefined);
  const sorted = sortFlightsForDisplay(filtered, getSortValue(outSortSelect));
  const pageItems = slicePage(sorted, outPageIdx);
  renderList(outboundList, pageItems, "out");
  renderSelectedTripPanel();
  renderPager("out");
  updateMobileRoundTripTabs();
  syncDesktopSortButtons(document.querySelector('.col-sort-buttons[data-select-id="outSort"]'), outSortSelect);
  // updateFlightSectionHeadings() above (via ensureMobilePriceIntelPlacement)
  // already calls updateStickyFilterCard() once, but that runs BEFORE
  // renderList() just above has actually replaced the loading placeholder
  // with the real flight cards - .filter-panel's stretched height (CSS
  // grid align-items:stretch) still reflected the short loading card's
  // height at that point, not the real list about to be inserted, so the
  // pin/bottom classification it computed was measured against stale,
  // about-to-be-wrong geometry. That's why Filters could render pinned to
  // the very bottom of a 9000px+ column - effectively invisible - until a
  // later scroll event finally recalculated it correctly (Kapil feedback,
  // 2026-08-10: "doesn't appear till we scroll the flights section").
  // Recomputing again here, now that the real list is actually in the
  // DOM, fixes it for the first paint instead of only after user input.
  scheduleFilterCardStickyCheck();
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

  const filtered = applyFlightFilters(returnAll, "ret");
  const sorted = sortFlightsForDisplay(filtered, getSortValue(retSortSelect));
  const pageItems = slicePage(sorted, retPageIdx);
  renderList(returnList, pageItems, "ret");
  renderSelectedTripPanel();
  renderPager("ret");
  updateMobileRoundTripTabs();
  syncDesktopSortButtons(document.querySelector('.col-sort-buttons[data-select-id="retSort"]'), retSortSelect);
  // Same reasoning as the end of renderOutbound() - recompute against the
  // now-final DOM instead of whatever was measured before this leg's real
  // list replaced its loading placeholder.
  scheduleFilterCardStickyCheck();
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

// Fetches page 2 (flights ranked 41-80) in the background and appends it
// to the already-rendered page-1 results, so clicking "Next" past the
// existing pages feels instant instead of triggering a fresh wait. Never
// awaited by its caller - a slow or failed prefetch must not affect the
// page-1 results already on screen.
//
// applyFlightFilters() already filters over the FULL outboundAll/returnAll
// array (not just the current page), so once page 2 is merged in here, any
// filter the user applies automatically searches across both pages for
// free - the only extra step needed is refreshing the filter CHECKBOX
// LIST itself (renderAirlineFilters/renderAirportFilters), since a carrier
// that only appears in page 2 (e.g. Air India Express on a busy route)
// wouldn't otherwise show up as a filter option at all.
async function prefetchNextPage(basePayload, generation) {
  try {
    const res = await fetchWithTimeout(`${BACKEND}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...basePayload, page: 2 }),
    }, 90000);

    // A newer search may have started (and bumped searchGeneration) while
    // this was in flight - discard this page's results if so, since
    // outboundAll/returnAll now belong to a different search entirely.
    if (generation !== searchGeneration || !res.ok) return;

    const json = await res.json();
    if (generation !== searchGeneration) return;

    const nextOutbound = Array.isArray(json?.outboundFlights) ? json.outboundFlights : [];
    const nextReturn = Array.isArray(json?.returnFlights) ? json.returnFlights : [];

    if (!nextOutbound.length && !nextReturn.length) return;

    if (nextOutbound.length) {
      outboundAll = outboundAll.concat(nextOutbound);
      renderPager("out");
    }
    if (nextReturn.length) {
      returnAll = returnAll.concat(nextReturn);
      renderPager("ret");
    }

    // Refresh the filter option lists so a carrier/airport that only
    // appeared in page 2 becomes selectable - the currently-active
    // filters themselves (activeFilters.*) are untouched, so anything the
    // user already selected stays selected.
    renderAirlineFilters();
    renderAirportFilters();
  } catch (err) {
    console.warn("[SkyDeal] page-2 prefetch failed (non-fatal)", err);
  }
}

async function handleSearch(e) {
  tagMobileSearchFieldWrappers();
  e?.preventDefault?.();

  const payload = {
    from: resolveLocationToCode(safeText(fromInput?.value, "").trim()),
to: resolveLocationToCode(safeText(toInput?.value, "").trim()),
    departureDate: toISO(departInput?.value || ""),
    returnDate: roundTripRadio?.checked ? toISO(returnInput?.value || "") : "",
    tripType: roundTripRadio?.checked ? "round-trip" : "one-way",
    adults: paxState.adults,
    children: paxState.children,
    infants: paxState.infants,
    // Offer-eligibility passenger count (adults+children); infants excluded
    // per product decision - they don't get a fare or count toward
    // passenger-count offer restrictions. Kept under the pre-existing
    // "passengers" field name for backward compatibility with every
    // downstream consumer already keyed on lastSearchPayload.passengers.
    passengers: paxState.adults + paxState.children,
    travelClass: cabinSelect?.value || "economy",

    // ✅ enable backend checkout/generic offer display layer
    includeGenericDisplayOffers: true,

    // ✅ send structured selections so backend can match bank/type correctly
    paymentMethods: buildSearchPaymentMethods(),
  };

  lastSearchPayload = payload;
  console.log("[SkyDeal] payload.paymentMethods", payload.paymentMethods);

  // All validation happens before setSearchButtonLoading/renderSearchLoadingState
  // below - those two calls used to run first, so any early return here (e.g.
  // the alerts) left the search button and results area stuck showing
  // "Checking prices..." forever, since nothing ever reset them.
  if (!payload.from || !payload.to || !payload.departureDate) {
    alert("Please enter From, To and Depart date.");
    return;
  }

  // Must run before the from===to check below - an unresolved city on
  // both sides (e.g. two typos) would otherwise slip past that check by
  // matching itself and reach the backend as garbage in both fields.
  if (!isKnownAirportCode(payload.from)) {
    alert("Please select your departure city from the suggestions list.");
    return;
  }

  if (!isKnownAirportCode(payload.to)) {
    alert("Please select your destination city from the suggestions list.");
    return;
  }

  if (payload.from === payload.to) {
    alert("Departure and destination airports cannot be the same.");
    return;
  }

  // A past date always fails at FlightAPI (QA, 2026-08-12: confirmed live,
  // deterministic every time) - catching it here instead means a plain
  // typo'd year doesn't cost the user a ~30s wait for a generic error.
  if (payload.departureDate && payload.departureDate < todayISO()) {
    alert("Departure date can't be in the past. Please choose today or a later date.");
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

  trackEvent("search_submitted", {
    trip_type: payload.tripType,
    from: payload.from,
    to: payload.to,
    cabin: payload.travelClass,
    passengers: payload.passengers,
    payment_methods_count: (payload.paymentMethods || []).length,
  });

  const thisSearchGeneration = ++searchGeneration;

  const isReSearch = hasActiveSearchResults();

  setSearchButtonLoading(true);
  renderSearchLoadingState();
  // Filters (airlines/airports/departure time) describe THIS search's
  // results - on a re-search they used to keep showing the previous
  // search's stale options with nothing to actually filter yet (the new
  // airline/airport lists aren't known until real results land), which
  // read as a broken, empty, unscrollable panel. Not needed before
  // results exist, so hide it for the duration (Kapil feedback,
  // 2026-08-10) - cleared in every terminal branch below.
  document.body.classList.add("search-in-flight");
  // The route/date label next to "Your final price options" is a
  // separate element from the loading card above and was previously
  // only touched inside renderOutbound()/renderReturn() - which only
  // run once real results arrive. On a re-search that left it showing the
  // PREVIOUS search's route (e.g. "Mumbai -> Delhi") for the entire
  // loading window, mismatched against the top banner (which updates
  // immediately from payload) - read as the page showing two different
  // searches at once (Kapil screen recording, 2026-08-10). Calling this
  // here, now that lastSearchPayload already reflects the new search,
  // refreshes it in step with the banner instead of waiting for results.
  updateFlightSectionHeadings();
  startDecodeWaitStage(payload.from, payload.to);
  if (isReSearch) setDecodeCardRefreshing(true);
  // Collapsing into the results-mode banner used to be a blind 80ms timer
  // fired on every click, completely decoupled from whether validation
  // above actually passed - a search left blank still collapsed into a
  // banner reading "FROM -> TO" with "How sairro works" showing
  // underneath, even though the alert() had already stopped the search
  // itself. Calling these here instead means the collapse only ever
  // happens as a direct consequence of a validated search actually
  // starting. Founder-reported 2026-08-08 - see CURRENT_BUGS.md.
  enterMobileResultsMode();
  enterDesktopResultsMode();

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
    // 90s, not 60s - some itinerary-heavy domestic routes (e.g. BOM-IXJ,
    // 104 raw FlightAPI itineraries) measured a real, successful backend
    // response taking ~66s (one failed FlightAPI attempt needing a retry,
    // plus a genuinely slow retry response) - at 60s the frontend was
    // giving up and showing "no results" a few seconds before the
    // backend's correct answer (real same-carrier connecting flights)
    // would have arrived. See CURRENT_BUGS.md (2026-07-15).
    const res = await fetchWithTimeout(`${BACKEND}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 90000);

    const json = await res.json();
    console.log("[SkyDeal] /search meta", json?.meta);

    if (!res.ok) {
      const msg = json?.meta?.error || json?.error || `Backend error (${res.status})`;
      outboundAll = [];
      returnAll = [];
      selectedOutboundFlight = null;
      selectedReturnFlight = null;
      selectedTripComparison = null;
      resetDecodeWaitVisualToStatic();
      setDecodeCardRefreshing(false);
      renderSelectedTripPanel();
      renderSearchErrorState(msg);
      renderMobileQuickFilters();
      enterMobileResultsMode();
      enterDesktopResultsMode();
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
      renderAirportFilters();
      // false, not true (2026-08-15 founder+user catch): a completed
      // search with zero flights is NOT the same as "never searched" -
      // setResultsPreSearch(true) re-adds .pro-results' "pre-search"
      // class, and ".pro-results.pre-search .flights-workspace
      // { display: none !important; }" (style.css) unconditionally hides
      // the very container renderSearchNoResultsState() renders its card
      // into (#outboundList, inside .flights-workspace). The card was
      // rendering correctly into the DOM the whole time, just inside a
      // force-hidden container, so a genuinely empty result silently
      // looked identical to the button doing nothing at all. Fix is
      // simply not re-entering pre-search state - .flights-workspace
      // renders fine once "pre-search" is absent, no other override
      // needed (verified: adding "search-error-mode" here instead was
      // tried and reverted - that class triggers a DIFFERENT rule,
      // "body.search-error-mode .pro-results { display: none !important; }",
      // which hides the results column entirely; it's the mechanism
      // renderSearchErrorState() actually depends on for its own separate
      // standalone-element error UI, not applicable here). This only
      // reproduces for a route/date combo that truly returns zero flights
      // (e.g. same-day domestic on an unlucky day), which is why it went
      // unnoticed until now.
      setResultsPreSearch(false);
      resetDecodeWaitVisualToStatic();
      setDecodeCardRefreshing(false);
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
    renderAirportFilters();
    setResultsPreSearch(false);
    stopDecodeWaitTimers();
    // Belt-and-braces alongside the .filter-panel CSS fix above: a
    // successful search never used to clear this class (only the
    // error/no-results paths did, via resetDecodeWaitVisualToStatic),
    // on the assumption that #hiwPresearch was always fully hidden once
    // pre-search flipped false regardless of its classes - a round-trip
    // CSS bug proved that assumption false, so clear it explicitly here
    // too rather than relying solely on the CSS fix to hide it.
    document.getElementById("hiwPresearch")?.classList.remove("decode-wait-active");

    renderOutbound();
    renderReturn();
    // The error/catch paths below already render this; the normal
    // success path never did, leaving the mobile quick-filter chip row
    // (Non-stop/Best offer/Filter) unreachable after an ordinary
    // successful search - the only path a mobile user actually takes
    // most of the time.
    renderMobileQuickFilters();

    // Fire-and-forget: if the backend says there's a page 2 (ranks 41-80)
    // for either leg, fetch it in the background now rather than waiting
    // for the user to click "Next" - see FLIGHTAPI_CARRIER_PRICING_AUDIT_2026-07.md
    // for why a lower-frequency carrier can rank just past 40 and never
    // show up without this. Deliberately not awaited: must never delay
    // the page-1 results the user is already looking at.
    if (json?.meta?.outHasMore || json?.meta?.retHasMore) {
      prefetchNextPage(payload, thisSearchGeneration);
    }

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

    // false, not true - same "not really pre-search" fix as the
    // no-results branch above (see its comment for the full explanation).
    // renderSearchErrorState() actually hides .pro-results itself via a
    // direct inline style and shows a separate standalone element instead,
    // so this specific change doesn't change what the user sees for a
    // real error - it's here so the "pre-search" flag stays semantically
    // correct (a failed search still isn't "never searched"), since
    // hasActiveSearchResults() and anything else reading that flag would
    // otherwise incorrectly treat a failed search the same as no search
    // ever having happened.
    setResultsPreSearch(false);
    resetDecodeWaitVisualToStatic();
    setDecodeCardRefreshing(false);
    updateFlightSectionHeadings();
    renderSearchErrorState(err?.message || "We couldn’t load live flights.");
    renderMobileQuickFilters();
    enterMobileResultsMode();
    enterDesktopResultsMode();
    return;
  }

  finally {
    setSearchButtonLoading(false);
    document.body.classList.remove("search-in-flight");
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
    outPageIdx = Math.min(totalPages(applyFlightFilters(outboundAll, isRoundTripModeActive() ? "out" : undefined)), outPageIdx + 1);
    renderOutbound();
  });

  retPrev?.addEventListener("click", () => {
    retPageIdx = Math.max(1, retPageIdx - 1);
    renderReturn();
  });
  retNext?.addEventListener("click", () => {
    retPageIdx = Math.min(totalPages(applyFlightFilters(returnAll, "ret")), retPageIdx + 1);
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

  // Tap-to-open/close for the "why offer counts might not apply" info
  // icon (replaced the old permanent .pm-offer-disclaimer banner,
  // 2026-08-17). Same tap-toggle + tap-outside-to-close idea as the
  // flight-card layover tooltip, but that one's handler is wired per
  // rendered card - this icon is static markup, so it gets its own.
  const pmInfoIcon = document.getElementById("pmInfoIcon");
  pmInfoIcon?.addEventListener("click", (e) => {
    e.stopPropagation();
    pmInfoIcon.classList.toggle("tooltip-open");
  });
  document.addEventListener("click", (e) => {
    if (!pmInfoIcon || e.target.closest("#pmInfoIcon")) return;
    pmInfoIcon.classList.remove("tooltip-open");
  });

  pmSearchInput?.addEventListener("input", () => {
    pmSearchQuery = pmSearchInput.value;
    if (pmSearchClearBtn) pmSearchClearBtn.hidden = pmSearchQuery.trim().length === 0;
    renderPaymentList();
  });
  pmSearchClearBtn?.addEventListener("click", () => {
    pmSearchQuery = "";
    if (pmSearchInput) { pmSearchInput.value = ""; pmSearchInput.focus(); }
    pmSearchClearBtn.hidden = true;
    renderPaymentList();
  });

  const bookingHandoffModal = document.getElementById("bookingHandoffModal");
  document.getElementById("bookingHandoffClose")?.addEventListener("click", closeBookingHandoffModal);
  bookingHandoffModal?.addEventListener("click", (e) => {
    if (e.target === bookingHandoffModal) closeBookingHandoffModal();
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
    trackEvent("payment_method_added", {
      payment_methods_count: selectedPaymentMethods.length,
      payment_method_types: [...new Set(selectedPaymentMethods.map((pm) => pm.type))].join(","),
    });
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
  wireAirportToggles();
  wireDesktopSortButtons();
  renderAirlineFilters();
  renderAirportFilters();

  renderPager("out");
  renderPager("ret");
}

document.addEventListener("DOMContentLoaded", async () => {
  // Restore the payment profile FIRST, before anything below renders off
  // selectedPaymentMethods/includeEmiOffers - a returning user's very
  // first paint should already reflect their saved methods, not flash
  // "Add how you pay" and then update a moment later.
  loadPaymentProfileFromStorage();

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
wirePaxSelector();
wirePopularRoutes();
updatePaymentButtonLabel();

  console.log("[SkyDeal] frontend ready");
});


setTimeout(renderPaymentPromptCard, 0);
