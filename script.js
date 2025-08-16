/* CONFIG */
const API_BASE = "https://skydeal-backend.onrender.com";

/* State */
let currentOutboundFlights = [];
let currentReturnFlights = [];

/* Helpers */
const ₹ = n => `₹${Number(n).toLocaleString("en-IN")}`;

/* Payment methods rendering (grouped, de-duplicated) */
function buildPaymentPanel(grouped) {
  const grid = document.getElementById("pmGrid");
  grid.innerHTML = "";

  const order = ["Credit Cards","Debit Cards","UPI","Netbanking","Wallets"];
  order.forEach(sectionName => {
    const items = (grouped[sectionName] || []).map(s => s.trim()).filter(Boolean);

    // de-duplicate within section (case-insensitive)
    const seen = new Set();
    const unique = [];
    for (const label of items) {
      const key = label.toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(label); }
    }

    const sec = document.createElement("div");
    sec.className = "pm-section";
    sec.innerHTML = `<h4>${sectionName}</h4>`;
    const list = document.createElement("div");
    list.className = "pm-list";

    unique.forEach(label => {
      const id = `pm_${sectionName.replace(/\s+/g,'_')}_${label.replace(/\s+/g,'_')}`;
      const row = document.createElement("label");
      row.className = "pm-item";
      row.innerHTML = `
        <input type="checkbox" data-section="${sectionName}" value="${label}" id="${id}"/>
        <span>${label}</span>
      `;
      list.appendChild(row);
    });

    // Add “Other”
    const otherId = `pm_${sectionName.replace(/\s+/g,'_')}_Other`;
    const other = document.createElement("label");
    other.className = "pm-item";
    other.innerHTML = `<input type="checkbox" data-section="${sectionName}" value="Other" id="${otherId}"/> <span>Other</span>`;
    list.appendChild(other);

    sec.appendChild(list);
    grid.appendChild(sec);
  });
}

/* Toggle dropdown + outside click */
function setupDropdown() {
  const toggle = document.getElementById("paymentToggle");
  const wrap = toggle.parentElement;
  const panel = document.getElementById("paymentPanel");

  toggle.addEventListener("click", () => {
    wrap.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) wrap.classList.remove("open");
  });
}

/* One-way / Round-trip behavior */
function setupTripType() {
  const returnInput = document.getElementById("returnDate");
  const radios = document.getElementsByName("tripType");
  const apply = () => {
    const val = [...radios].find(r => r.checked)?.value;
    if (val === "one-way") {
      returnInput.style.display = "none";
      returnInput.value = "";
    } else {
      returnInput.style.display = "";
    }
  };
  [...radios].forEach(r => r.addEventListener("change", apply));
  apply(); // initialize (Round Trip default)
}

/* Fetch grouped payment methods from backend */
async function loadPaymentMethods() {
  const grid = document.getElementById("pmGrid");
  try {
    const res = await fetch(`${API_BASE}/payment-methods?grouped=1`);
    const data = await res.json();
    // expected: { grouped: { "Credit Cards":[...], "Debit Cards":[...], "UPI":[...], "Netbanking":[...], "Wallets":[...] } }
    buildPaymentPanel(data.grouped || {});
  } catch (e) {
    grid.innerHTML = `<div class="pm-loading">Failed to load payment methods.</div>`;
  }
}

/* Collect selected payment methods as flat labels */
function getSelectedPaymentLabels() {
  const panel = document.getElementById("paymentPanel");
  const cbs = panel.querySelectorAll('input[type="checkbox"]:checked');
  const labels = [];
  cbs.forEach(cb => labels.push(cb.value));
  return labels;
}

/* Render a list of flights into a container */
function displayFlights(flights, container) {
  container.innerHTML = "";
  if (!flights || flights.length === 0) {
    container.innerHTML = "<p>No flights found.</p>";
    return;
  }

  flights.forEach((flight) => {
    const card = document.createElement("div");
    card.className = "flight-card";

    // Name = airlineName + flightNumber (fallbacks)
    const airline = (flight.airlineName || "").toString().trim();
    const fno = (flight.flightNumber || "").toString().trim();
    const displayName = [airline, fno].filter(Boolean).join(" ");

    // Best deal tile text
    let bestHtml = "Best deal: —";
    if (flight.bestDeal) {
      const bd = flight.bestDeal;
      const pm = bd.paymentMethodLabel ? ` (via ${bd.paymentMethodLabel}${bd.couponCode ? `, Coupon: ${bd.couponCode}` : ""})` : (bd.couponCode ? ` (Coupon: ${bd.couponCode})` : "");
      bestHtml = `Best deal: <strong>${bd.portal}</strong> ${₹(bd.finalPrice)}${pm}`;
    }

    card.innerHTML = `
      <div class="title"><strong>${displayName || "Flight"}</strong></div>
      <p>Departure: ${flight.departure} | Arrival: ${flight.arrival}</p>
      <p>Stops: ${flight.stops}</p>

      <div class="best-badge">
        <span>${bestHtml}</span>
        <button type="button" class="info-btn" aria-label="See portal prices" title="See portal prices">i</button>
      </div>
    `;

    // info click -> modal with portal prices (final price + payment method)
    const infoBtn = card.querySelector(".info-btn");
    infoBtn.addEventListener("click", () => showPortalPrices(flight));

    container.appendChild(card);
  });
}

/* Sorting */
window.sortFlights = function(key) {
  const sortByDeparture = (a,b) => a.departure.localeCompare(b.departure);
  const sortByPrice = (a,b) => parseFloat(a.price) - parseFloat(b.price);

  const out = [...currentOutboundFlights];
  const ret = [...currentReturnFlights];

  if (key === "departure") {
    out.sort(sortByDeparture);
    ret.sort(sortByDeparture);
  } else {
    out.sort(sortByPrice);
    ret.sort(sortByPrice);
  }

  displayFlights(out, document.getElementById("outboundContainer"));
  displayFlights(ret, document.getElementById("returnContainer"));
};

/* Modal for portal prices (final prices only + payment method) */
function showPortalPrices(flight) {
  const list = document.getElementById("portalPriceList");
  list.innerHTML = "";

  const prices = flight.portalPrices || [];
  prices.forEach(p => {
    const li = document.createElement("li");
    const pm = p.paymentMethodLabel ? ` — ${p.paymentMethodLabel}${p.appliedOffer?.couponCode ? ` (Coupon: ${p.appliedOffer.couponCode})` : ""}` : (p.appliedOffer?.couponCode ? ` — (Coupon: ${p.appliedOffer.couponCode})` : "");
    li.textContent = `${p.portal}: ${₹(p.finalPrice || p.basePrice)}${pm}`;
    list.appendChild(li);
  });

  const modal = document.getElementById("priceModal");
  modal.style.display = "flex";
}

/* Close modal */
(function modalWiring(){
  const modal = document.getElementById("priceModal");
  const close = document.getElementById("closeModal");
  close.addEventListener("click", ()=> modal.style.display="none");
  window.addEventListener("click", (e)=>{
    if (e.target === modal) modal.style.display="none";
  });
})();

/* Search submit */
document.getElementById("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const from = document.getElementById("from").value.trim();
  const to = document.getElementById("to").value.trim();
  const departureDate = document.getElementById("departureDate").value;
  const returnDate = document.getElementById("returnDate").value;
  const passengers = parseInt(document.getElementById("passengers").value, 10);
  const travelClass = document.getElementById("travelClass").value;
  const tripType = [...document.getElementsByName("tripType")].find(r=>r.checked)?.value || "round-trip";

  const paymentMethods = getSelectedPaymentLabels();

  // Clear old results & show sort controls
  document.getElementById("outboundContainer").innerHTML = "";
  document.getElementById("returnContainer").innerHTML = "";
  document.getElementById("sortControls").style.display = "flex";

  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        from, to, departureDate, returnDate, passengers, travelClass, tripType, paymentMethods
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    currentOutboundFlights = data.outboundFlights || [];
    currentReturnFlights = data.returnFlights || [];

    displayFlights(currentOutboundFlights, document.getElementById("outboundContainer"));
    displayFlights(currentReturnFlights, document.getElementById("returnContainer"));
  } catch (err) {
    console.error("Search error:", err);
    alert("Failed to fetch flights. Please try again.");
  }
});

/* Init */
document.addEventListener("DOMContentLoaded", () => {
  setupDropdown();
  setupTripType();
  loadPaymentMethods();
});
