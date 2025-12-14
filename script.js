const API_BASE = "https://skydeal-backend.onrender.com";

// --------------------
// SEARCH
// --------------------
const searchBtn = document.getElementById("searchBtn");

searchBtn.addEventListener("click", async () => {
  const from = fromInput.value.trim();
  const to = toInput.value.trim();

  const payload = {
    from,
    to,
    departureDate: departInput.value,   // dd/mm/yyyy OR yyyy-mm-dd
    returnDate: returnInput.value,
    tripType: roundTripRadio.checked ? "round-trip" : "one-way",
    passengers: Number(passengersSelect.value),
    travelClass: cabinSelect.value
  };

  console.log("[SkyDeal] /search payload →", payload);

  outboundResults.innerHTML = "Loading flights...";
  returnResults.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("[SkyDeal] /search response →", data);

    renderFlights(
      data.outboundFlights || [],
      outboundResults,
      "Outbound"
    );

    renderFlights(
      data.returnFlights || [],
      returnResults,
      "Return"
    );

  } catch (err) {
    console.error("Search failed", err);
    outboundResults.innerHTML = "Error loading flights";
    returnResults.innerHTML = "";
  }
});

// --------------------
// RENDERING
// --------------------
function renderFlights(flights, container, label) {
  if (!flights.length) {
    container.innerHTML = `<div class="no-flights">No flights found for your search.</div>`;
    return;
  }

  container.innerHTML = "";

  flights.forEach(f => {
    const card = document.createElement("div");
    card.className = "flight-card";

    card.innerHTML = `
      <div class="flight-row">
        <strong>${f.airlineName || "-"}</strong>
        <span>${f.flightNumber || ""}</span>
      </div>

      <div class="flight-row">
        ${f.departureTime || "--"} → ${f.arrivalTime || "--"}
        · ${f.stops ?? 0} stop(s)
      </div>

      <div class="flight-price">
        ₹${f.price || 0}
      </div>
    `;

    container.appendChild(card);
  });
}
