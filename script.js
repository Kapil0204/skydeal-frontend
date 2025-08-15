// ===== Config =====
const API_BASE = "https://skydeal-backend.onrender.com";

// State
let currentOutboundFlights = [];
let currentReturnFlights = [];

// Utilities
const fmtINR = n => "₹" + Number(n).toLocaleString("en-IN");

// Normalize a label for dedupe (keeps banks but merges EMI variants etc.)
function normalizeLabel(s) {
  return s
    .toLowerCase()
    .replace(/\b(credit|debit)\s+card\s+emi\b/g, "credit card") // treat EMI as card
    .replace(/\bemi\b/g, "")                                   // drop stray "emi"
    .replace(/\s+/g, " ")
    .trim();
}

// Build a checkbox
function makePMCheckbox(label) {
  const id = "pm_" + label.replace(/\W+/g, "_");
  const wrap = document.createElement("label");
  wrap.innerHTML = `<input type="checkbox" value="${label}" id="${id}" /> ${label}`;
  return wrap;
}

// Categorize labels into columns (loose, readable rules)
function categorize(labels) {
  const cats = { credit: [], debit: [], upi: [], net: [], wallet: [] };
  labels.forEach(l => {
    const low = l.toLowerCase();
    if (low.includes("wallet")) cats.wallet.push(l);
    else if (low.includes("upi")) cats.upi.push(l);
    else if (low.includes("net") && low.includes("bank")) cats.net.push(l);
    else if (low.includes("debit")) cats.debit.push(l);
    else cats.credit.push(l);
  });
  return cats;
}

// Payment methods dropdown logic
function openPM() {
  document.getElementById("paymentMenu").style.display = "block";
}
function closePM() {
  document.getElementById("paymentMenu").style.display = "none";
}

document.addEventListener("click", (e) => {
  const dd = document.getElementById("paymentDropdown");
  if (!dd.contains(e.target)) closePM();
});

document.getElementById("paymentToggle").addEventListener("click", (e) => {
  e.stopPropagation();
  const menu = document.getElementById("paymentMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
});

// Populate payment methods (deduped + categorized)
async function loadPaymentMethods() {
  try {
    const res = await fetch(`${API_BASE}/payment-methods`);
    const { methods = [] } = await res.json();

    // Dedupe
    const seen = new Map(); // norm => original
    methods.forEach(m => {
      const norm = normalizeLabel(m);
      if (!seen.has(norm)) seen.set(norm, m.trim());
    });
    const deduped = Array.from(seen.values()).sort((a,b)=>a.localeCompare(b));

    // Categorize & render
    const cats = categorize(deduped);
    const mount = (id, arr) => {
      const el = document.getElementById(id);
      el.innerHTML = "";
      arr.forEach(label => el.appendChild(makePMCheckbox(label)));
      // add "Other"
      el.appendChild(makePMCheckbox("Other"));
    };

    mount("pmCredit", cats.credit);
    mount("pmDebit", cats.debit);
    mount("pmUPI", cats.upi);
    mount("pmNetbanking", cats.net);
    mount("pmWallets", cats.wallet);
  } catch (err) {
    console.error("Failed to load payment methods:", err);
  }
}
loadPaymentMethods();

// ===== Search & Render =====
const searchForm = document.getElementById("searchForm");
const outboundContainer = document.getElementById("outboundContainer");
const returnContainer = document.getElementById("returnContainer");

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const from = document.getElementById("from").value.trim().toUpperCase();
  const to = document.getElementById("to").value.trim().toUpperCase();
  const departureDate = document.getElementById("departureDate").value;
  const returnDate = document.getElementById("returnDate").value;
  const passengers = +document.getElementById("passengers").value;
  const travelClass = document.getElementById("travelClass").value;

  const tripType = [...document.getElementsByName("tripType")]
    .find(r => r.checked)?.value || "round-trip";

  // Collect selected payment methods
  const selectedPaymentMethods = Array.from(
    document.querySelectorAll("#paymentMenu input[type='checkbox']:checked")
  ).map(cb => cb.value);

  // Clear previous
  outboundContainer.innerHTML = "";
  returnContainer.innerHTML = "";
  document.getElementById("sortControls").style.display = "none";

  try {
    const response = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to, departureDate, returnDate,
        passengers, travelClass, tripType,
        paymentMethods: selectedPaymentMethods
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`HTTP ${response.status} ${txt || ""}`.trim());
    }

    const data = await response.json();
    currentOutboundFlights = data.outboundFlights || [];
    currentReturnFlights = data.returnFlights || [];

    displayFlights(currentOutboundFlights, outboundContainer);
    displayFlights(currentReturnFlights, returnContainer);

    document.getElementById("sortControls").style.display =
      (currentOutboundFlights.length + currentReturnFlights.length) ? "block" : "none";
  } catch (err) {
    console.error("Search error:", err);
    alert("Search failed. Backend returned an error.\nPlease try different dates or check server logs.");
  }
});

// Card renderer
function displayFlights(flights, container) {
  container.innerHTML = "";
  if (!flights || flights.length === 0) {
    container.innerHTML = "<p>No flights found.</p>";
    return;
  }

  flights.forEach((flight) => {
    const card = document.createElement("div");
    card.className = "flight-card";

    // Airline name + number
    const title = `${flight.airlineName || ""} ${flight.flightNumber || ""}`.trim();

    // Find best deal across portals (lowest finalPrice)
    let best = null;
    if (Array.isArray(flight.portalPrices) && flight.portalPrices.length) {
      best = flight.portalPrices
        .filter(p => typeof p.finalPrice === "number")
        .sort((a,b) => a.finalPrice - b.finalPrice)[0] || null;
    }

    card.innerHTML = `
      <div><strong>${title}</strong></div>
      <div>Departure: ${flight.departure} | Arrival: ${flight.arrival}</div>
      <div>Stops: ${flight.stops}</div>
      ${best ? `
        <div class="best-deal">
          <span><strong>Best deal:</strong> ${best.portal} ${fmtINR(best.finalPrice)}${
            best.appliedOffer && best.appliedOffer.couponCode
              ? ` (Coupon: ${best.appliedOffer.couponCode})`
              : ""
          }</span>
          <button class="info-btn" title="See all portal prices" aria-label="See all portal prices">i</button>
        </div>
      ` : ""}
    `;

    // Info modal
    if (best) {
      const btn = card.querySelector(".info-btn");
      btn.addEventListener("click", () => showPortalPrices(flight));
    }

    container.appendChild(card);
  });
}

// Sorting
window.sortFlights = function (key) {
  const byDep = (a,b) => a.departure.localeCompare(b.departure);
  const byPrice = (a,b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);

  if (key === "departure") {
    currentOutboundFlights.sort(byDep);
    currentReturnFlights.sort(byDep);
  } else {
    currentOutboundFlights.sort(byPrice);
    currentReturnFlights.sort(byPrice);
  }
  displayFlights(currentOutboundFlights, outboundContainer);
  displayFlights(currentReturnFlights, returnContainer);
};

// Modal logic
function showPortalPrices(flight) {
  const list = document.getElementById("portalPriceList");
  list.innerHTML = "";

  (flight.portalPrices || []).forEach(p => {
    const li = document.createElement("li");
    if (typeof p.finalPrice === "number") {
      const detail = p.appliedOffer && p.appliedOffer.couponCode
        ? ` → ${fmtINR(p.finalPrice)} (Coupon: ${p.appliedOffer.couponCode})`
        : "";
      li.textContent = `${p.portal}: ${fmtINR(p.basePrice)}${detail}`;
    } else {
      li.textContent = `${p.portal}: ${fmtINR(p.basePrice)}`;
    }
    list.appendChild(li);
  });

  document.getElementById("priceModal").style.display = "flex";
}

// Close modal (X and outside)
document.getElementById("closeModal").addEventListener("click", () => {
  document.getElementById("priceModal").style.display = "none";
});
document.getElementById("priceModal").addEventListener("click", (e) => {
  if (e.target.id === "priceModal") {
    document.getElementById("priceModal").style.display = "none";
  }
});
