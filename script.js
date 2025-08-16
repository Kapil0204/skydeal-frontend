// === script.js ===

// ✅ valid identifier for formatting currency
const formatINR = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

// ---- Dropdown toggle ----
function setupDropdown() {
  const toggle = document.getElementById("paymentToggle");
  const wrap = toggle.parentElement;

  toggle.addEventListener("click", () => {
    wrap.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) {
      wrap.classList.remove("open");
    }
  });
}

// ---- Collect selected payment methods ----
function getSelectedPaymentMethods() {
  const checked = [...document.querySelectorAll("#paymentDropdown input:checked")];
  return checked.map(cb => cb.value);
}

// ---- Render flights ----
function displayFlights(flights, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  flights.forEach(f => {
    const card = document.createElement("div");
    card.className = "flight-card";

    // show carrier name + flight number
    const title = document.createElement("h3");
    title.textContent = `${f.carrierName || ""} ${f.flightNumber}`;
    card.appendChild(title);

    const times = document.createElement("p");
    times.textContent = `Departure: ${f.departure} | Arrival: ${f.arrival}`;
    card.appendChild(times);

    const stops = document.createElement("p");
    stops.textContent = `Stops: ${f.stops}`;
    card.appendChild(stops);

    // best deal
    let bestHtml = "";
    if (f.bestDeal) {
      const bd = f.bestDeal;
      const pm = bd.paymentMethod ? ` (Payment: ${bd.paymentMethod}, Coupon: ${bd.couponCode})` : "";
      bestHtml = `Best deal: <strong>${bd.portal}</strong> ${formatINR(bd.finalPrice)}${pm}`;
    }

    const best = document.createElement("div");
    best.className = "best-deal";
    best.innerHTML = bestHtml;
    card.appendChild(best);

    // info button
    const info = document.createElement("button");
    info.className = "info-btn";
    info.textContent = "i";
    info.addEventListener("click", () => showPortalPrices(f));
    card.appendChild(info);

    container.appendChild(card);
  });
}

// ---- Show comparison modal ----
function showPortalPrices(flight) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const inner = document.createElement("div");
  inner.className = "modal";

  const close = document.createElement("span");
  close.className = "modal-close";
  close.textContent = "×";
  close.onclick = () => modal.remove();

  const list = document.createElement("ul");
  (flight.portalPrices || []).forEach(p => {
    const li = document.createElement("li");
    const pm = p.paymentMethod ? ` (Payment: ${p.paymentMethod}, Coupon: ${p.couponCode})` : "";
    li.textContent = `${p.portal}: ${formatINR(p.finalPrice || p.basePrice)}${pm}`;
    list.appendChild(li);
  });

  inner.appendChild(close);
  inner.appendChild(list);
  modal.appendChild(inner);
  document.body.appendChild(modal);
}

// ---- Search handler ----
async function onSearch(e) {
  e.preventDefault();
  const origin = document.getElementById("origin").value;
  const dest = document.getElementById("destination").value;
  const depart = document.getElementById("departDate").value;
  const ret = document.getElementById("returnDate").value;
  const trip = document.querySelector("input[name='tripType']:checked").value;
  const pax = document.getElementById("pax").value;
  const cabin = document.getElementById("cabin").value;
  const payments = getSelectedPaymentMethods();

  try {
    const res = await fetch("https://skydeal-backend.onrender.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination: dest, departDate: depart, returnDate: ret, tripType: trip, pax, cabin, paymentMethods: payments })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    displayFlights(data.outbound || [], "outboundFlights");
    displayFlights(data.return || [], "returnFlights");
  } catch (err) {
    console.error("Search error:", err);
    alert("Search failed: " + err.message);
  }
}

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  setupDropdown();
  document.getElementById("searchForm").addEventListener("submit", onSearch);
});
