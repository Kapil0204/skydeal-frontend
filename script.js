// ====== CONFIG ======
const BACKEND_BASE = "https://skydeal-backend.onrender.com"; // your deployed backend

// IATA -> Airline (extend as needed)
const AIRLINE_MAP = {
  "AI":"Air India",
  "6E":"IndiGo",
  "UK":"Vistara",
  "SG":"SpiceJet",
  "IX":"Air India Express",
  "I5":"AIX Connect",
  "G8":"Go First",
  "QP":"Akasa Air"
};

// Defaults if a category has no entries in offers
const FALLBACKS = {
  upi: ["Google Pay (GPay)", "PhonePe", "Paytm", "Other"],
  netbanking: ["Other"],
  wallets: ["Mobikwik Wallet", "Paytm Wallet", "Other"]
};

// ====== STATE ======
let currentOutboundFlights = [];
let currentReturnFlights   = [];
let groupedPaymentOptions  = { credit:[], debit:[], upi:[], netbanking:[], wallets:[] };

// ====== HELPERS ======
const fmtRs = n => `₹${Number(n).toLocaleString("en-IN")}`;

function airlineLabel(code, flightNumber) {
  const al = AIRLINE_MAP[code] || code;
  return `${al} ${flightNumber}`;
}

function getOfferPaymentLabel(offer){
  if (!offer) return null;
  // Offer may have a structured paymentMethods or text title; try best effort.
  if (offer.paymentMethodLabel) return offer.paymentMethodLabel;
  if (Array.isArray(offer.paymentMethods) && offer.paymentMethods.length){
    const raw = offer.paymentMethods[0];
    if (typeof raw === "string") return raw;
    if (raw.bank || raw.type || raw.cardNetwork){
      const parts = [raw.bank, raw.type, raw.cardNetwork].filter(Boolean);
      if (parts.length) return parts.join(" ");
    }
  }
  // Last resort: try to infer from title
  if (offer.title) {
    const t = offer.title;
    if (/credit/i.test(t)) return "Credit Card";
    if (/debit/i.test(t))  return "Debit Card";
    if (/upi/i.test(t))    return "UPI";
    if (/wallet/i.test(t)) return "Wallet";
    if (/netbank/i.test(t))return "Netbanking";
  }
  return "—";
}

function buildPaymentGroups(methods){
  // Deduplicate and bucket
  const seen = new Set();
  const buckets = { credit:[], debit:[], upi:[], netbanking:[], wallets:[] };

  (methods || []).forEach(label=>{
    if(!label) return;
    const norm = label.trim().replace(/\s+/g," ");
    const key = norm.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    if (/wallet/i.test(norm)) buckets.wallets.push(norm);
    else if (/upi/i.test(norm)) buckets.upi.push(norm);
    else if (/net\s*bank/i.test(norm) || /netbank/i.test(norm)) buckets.netbanking.push(norm);
    else if (/debit/i.test(norm)) buckets.debit.push(norm);
    else if (/credit|emi/i.test(norm)) buckets.credit.push(norm); // treat EMI as Credit
    else buckets.credit.push(norm); // default into credit
  });

  // Ensure fallbacks where empty
  Object.entries(FALLBACKS).forEach(([cat, arr])=>{
    if (buckets[cat].length === 0) buckets[cat] = [...arr];
  });

  // Always append "Other" to credit/debit if missing
  ["credit","debit"].forEach(cat=>{
    if (!buckets[cat].some(v=>/other/i.test(v))) buckets[cat].push("Other");
  });

  return buckets;
}

function renderPaymentDropdown(){
  const cats = ["credit","debit","upi","netbanking","wallets"];
  cats.forEach(cat=>{
    const sub = document.querySelector(`.pm-sub[data-sub="${cat}"]`);
    sub.innerHTML = "";
    const list = groupedPaymentOptions[cat] || [];
    list.forEach(label=>{
      const id = `pm-${cat}-${label.replace(/\W+/g,'-').toLowerCase()}`;
      const div = document.createElement("label");
      div.innerHTML = `<input type="checkbox" data-leaf="1" data-cat="${cat}" value="${label}" id="${id}"> ${label}`;
      sub.appendChild(div);
    });
    // Show sub only when category checkbox is checked
    const catCb = document.querySelector(`input[type="checkbox"][data-cat="${cat}"]`);
    sub.style.display = catCb && catCb.checked ? "block" : "none";
  });
}

function selectedPaymentLabels(){
  const leafs = Array.from(document.querySelectorAll('#pmMenu input[type="checkbox"][data-leaf="1"]:checked'));
  return leafs.map(cb => cb.value);
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", async () => {
  const pmToggle   = document.getElementById("pmToggle");
  const pmMenu     = document.getElementById("pmMenu");

  // Toggle PM dropdown
  pmToggle.addEventListener("click", ()=>{
    pmMenu.style.display = (pmMenu.style.display === "block" ? "none":"block");
  });
  // Close on click outside
  document.addEventListener("click", (e)=>{
    const dd = document.getElementById("paymentDropdown");
    if (!dd.contains(e.target)) pmMenu.style.display = "none";
  });

  // Category checkbox: show/hide its sub-panel
  pmMenu.addEventListener("change", (e)=>{
    const t = e.target;
    if (t.matches('input[type="checkbox"][data-cat]') && !t.hasAttribute("data-leaf")){
      const cat = t.getAttribute("data-cat");
      const sub = document.querySelector(`.pm-sub[data-sub="${cat}"]`);
      if (sub) sub.style.display = t.checked ? "block" : "none";
    }
  });

  // Fetch payment methods from backend and render
  try{
    const resp = await fetch(`${BACKEND_BASE}/payment-methods`);
    const data = await resp.json();
    groupedPaymentOptions = buildPaymentGroups(data.methods || []);
  }catch(_e){
    groupedPaymentOptions = buildPaymentGroups([]); // fallbacks only
  }
  renderPaymentDropdown();

  // Trip type hide/show Return Date
  const returnDateInput = document.getElementById("returnDate");
  const tripTypeRadios  = document.getElementsByName("tripType");

  function updateReturnVisibility(){
    const tripType = Array.from(tripTypeRadios).find(r=>r.checked)?.value || "round-trip";
    if (tripType === "one-way"){
      returnDateInput.value = "";
      returnDateInput.style.display = "none";
    } else {
      returnDateInput.style.display = "";
    }
  }
  Array.from(tripTypeRadios).forEach(r=>r.addEventListener("change", updateReturnVisibility));
  updateReturnVisibility(); // set initial

  // Sorting buttons
  document.getElementById("sortDepartureBtn").addEventListener("click", ()=> sortFlights("departure"));
  document.getElementById("sortPriceBtn").addEventListener("click", ()=> sortFlights("price"));

  // Search
  document.getElementById("searchForm").addEventListener("submit", onSearch);
});

// ====== SEARCH ======
async function onSearch(e){
  e.preventDefault();
  const from          = document.getElementById("from").value.trim().toUpperCase();
  const to            = document.getElementById("to").value.trim().toUpperCase();
  const departureDate = document.getElementById("departureDate").value;
  const returnDate    = document.getElementById("returnDate").value;
  const passengers    = parseInt(document.getElementById("passengers").value || "1",10);
  const travelClass   = document.getElementById("travelClass").value;
  const tripType      = Array.from(document.getElementsByName("tripType")).find(r=>r.checked)?.value || "round-trip";

  // collect selected payment leaf labels
  const paymentMethods = selectedPaymentLabels();

  document.getElementById("outboundContainer").innerHTML = "";
  document.getElementById("returnContainer").innerHTML   = "";
  document.getElementById("sortControls").style.display  = "none";

  try{
    const resp = await fetch(`${BACKEND_BASE}/search`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        from, to, departureDate,
        returnDate: tripType==="round-trip" ? returnDate : undefined,
        passengers, travelClass, tripType,
        paymentMethods
      })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    currentOutboundFlights = (data.outboundFlights || []);
    currentReturnFlights   = (data.returnFlights   || []);

    document.getElementById("sortControls").style.display = "flex";
    renderFlights(currentOutboundFlights, document.getElementById("outboundContainer"));
    renderFlights(currentReturnFlights,   document.getElementById("returnContainer"));
  }catch(err){
    console.error("Search error:", err);
    alert("Failed to fetch flights. Please try again.");
  }
}

// ====== RENDER ======
function renderFlights(flights, container){
  container.innerHTML = "";
  if (!flights || flights.length===0){
    container.innerHTML = "<p>No flights found.</p>";
    return;
  }

  flights.forEach(f=>{
    const card = document.createElement("div");
    card.className = "flight-card";

    // airlineName may be code; derive label with map
    const [code] = String(f.flightNumber).trim().split(/\s+/); // “AI 9485” -> “AI”
    const title  = airlineLabel(code, f.flightNumber);

    const best = bestDealForFlight(f);
    const bestText = best
      ? `Best deal: <strong>${best.portal}</strong> ${fmtRs(best.finalPrice)} (Coupon: ${best.appliedOffer?.couponCode || "—"}; <em>${getOfferPaymentLabel(best.appliedOffer)}</em>)`
      : `Price: ${fmtRs(f.price)}`;

    card.innerHTML = `
      <p><strong>${title}</strong></p>
      <p>Departure: ${f.departure} | Arrival: ${f.arrival}</p>
      <p>Stops: ${f.stops}</p>
      <div class="best-deal">
        <span>${bestText}</span>
        <button class="info-btn" title="Compare portal prices" aria-label="Compare">i</button>
      </div>
    `;

    card.querySelector(".info-btn").addEventListener("click", ()=> showPortalPrices(f));
    container.appendChild(card);
  });
}

function bestDealForFlight(flight){
  if (!flight.portalPrices || flight.portalPrices.length===0) return null;
  // choose min finalPrice (ties keep first)
  let best = null;
  flight.portalPrices.forEach(p=>{
    if (best===null || Number(p.finalPrice) < Number(best.finalPrice)) best = p;
  });
  return best;
}

// ====== SORT ======
function sortFlights(key){
  const cmpDeparture = (a,b)=> a.departure.localeCompare(b.departure);
  const cmpPrice     = (a,b)=> parseFloat(a.price) - parseFloat(b.price);

  let out = [...currentOutboundFlights];
  let ret = [...currentReturnFlights];

  if (key==="departure"){
    out.sort(cmpDeparture); ret.sort(cmpDeparture);
  }else{
    out.sort(cmpPrice); ret.sort(cmpPrice);
  }
  renderFlights(out, document.getElementById("outboundContainer"));
  renderFlights(ret, document.getElementById("returnContainer"));
}

// ====== MODAL: PORTAL PRICES ======
function showPortalPrices(flight){
  const ul = document.getElementById("portalPriceList");
  ul.innerHTML = "";
  (flight.portalPrices || []).forEach(p=>{
    const li = document.createElement("li");
    const payLabel = getOfferPaymentLabel(p.appliedOffer);
    // Only final price; include coupon + payment method if available
    const extra = p.appliedOffer
      ? ` (Coupon: ${p.appliedOffer.couponCode || "—"}; ${payLabel})`
      : "";
    li.textContent = `${p.portal}: ${fmtRs(p.finalPrice)}${extra}`;
    ul.appendChild(li);
  });

  const modal = document.getElementById("priceModal");
  modal.style.display = "flex";

  document.getElementById("closeModal").onclick = ()=> modal.style.display = "none";
  window.onclick = (e)=>{ if (e.target === modal) modal.style.display = "none"; };
}
