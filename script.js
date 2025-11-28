// ==============================
// SkyDeal Frontend Script
// Backend: https://skydeal-backend.onrender.com
// ==============================

const backendURL = "https://skydeal-backend.onrender.com";

// UI Elements
const searchBtn = document.getElementById("searchBtn");
const outboundDiv = document.getElementById("outboundResults");
const returnDiv = document.getElementById("returnResults");
const modal = document.getElementById("priceModal");
const modalContent = document.getElementById("modalContent");
const closeModalBtn = document.getElementById("closeModal");

// Trip type logic
const oneWayRadio = document.getElementById("oneWay");
const roundTripRadio = document.getElementById("roundTrip");
const returnDateInput = document.getElementById("returnDate");

roundTripRadio.addEventListener("change", () => {
  returnDateInput.style.display = "block";
});

oneWayRadio.addEventListener("change", () => {
  returnDateInput.style.display = "none";
});

// ==============================
// Search Handler
// ==============================
searchBtn.addEventListener("click", async () => {
  const from = document.getElementById("from").value.trim().toUpperCase();
  const to = document.getElementById("to").value.trim().toUpperCase();
  const departureDate = document.getElementById("departureDate").value;
  const returnDate = document.getElementById("returnDate").value;
  const travelClass = document.getElementById("travelClass").value;
  const passengers = Number(document.getElementById("passengers").value) || 1;

  const tripType = roundTripRadio.checked ? "round-trip" : "one-way";

  if (!from || !to || !departureDate) {
    alert("Please fill all required fields");
    return;
  }

  const payload = {
    from,
    to,
    departureDate,
    returnDate: tripType === "round-trip" ? returnDate : null,
    tripType,
    passengers,
    travelClass
  };

  outboundDiv.innerHTML = "<p>Loading flights...</p>";
  returnDiv.innerHTML = tripType === "round-trip" ? "<p>Loading return flights...</p>" : "";

  try {
    const response = await fetch(`${backendURL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    displayFlights(data.outboundFlights, outboundDiv, "Outbound");
    if (tripType === "round-trip") {
      displayFlights(data.returnFlights, returnDiv, "Return");
    }

  } catch (err) {
    console.error("Search error:", err);
    outboundDiv.innerHTML = "<p>Error fetching results</p>";
    returnDiv.innerHTML = "";
  }
});

// ==============================
// Display Flights in UI
// ==============================
function displayFlights(flights, container, title) {
  container.innerHTML = `<h3>${title} Flights</h3>`;

  if (!flights || flights.length === 0) {
    container.innerHTML += "<p>No flights found</p>";
    return;
  }

  flights.forEach((f, index) => {
    const card = document.createElement("div");
    card.className = "flightCard";
    card.innerHTML = `
      <p><strong>${f.airlineName || "Airline"}</strong> — ${f.flightNumber || ""}</p>
      <p>⏱ ${f.departure} → ${f.arrival}</p>
      <p>🛑 Stops: ${f.stops}</p>
      <p>💰 ₹${Number(f.price).toFixed(2)}</p>
      <button class="priceBtn" data-index="${index}" data-type="${title}">
        View OTA Prices
      </button>
    `;

    container.appendChild(card);
  });

  // Add click listener for price modal
  document.querySelectorAll(".priceBtn").forEach(btn =>
    btn.addEventListener("click", (e) => {
      const idx = e.target.getAttribute("data-index");
      const t = e.target.getAttribute("data-type");

      const flight = (t === "Outbound" ? flights : flights)[idx];
      showPriceModal(flight);
    })
  );
}

// ==============================
// Show Modal with OTA Prices
// ==============================
function showPriceModal(flight) {
  modal.style.display = "flex";

  let html = `
    <h2>OTA Prices</h2>
    <p><strong>${flight.airlineName}</strong> — ₹${Number(flight.price).toFixed(2)}</p>
    <hr/>
  `;

  flight.portalPrices.forEach(p => {
    html += `
      <div class="otaRow">
        <p><strong>${p.portal}</strong></p>
        <p>Base: ₹${p.basePrice.toFixed(2)}</p>
        <p>Final: <strong>₹${p.finalPrice.toFixed(2)}</strong></p>
        <button onclick="alert('Redirect simulation for ${p.portal}')">Go →</button>
      </div>
      <hr/>
    `;
  });

  modalContent.innerHTML = html;
}

closeModalBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

window.onclick = (e) => {
  if (e.target === modal) modal.style.display = "none";
};
