document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");

  searchBtn.addEventListener("click", async () => {
    const from = document.getElementById("fromInput").value;
    const to = document.getElementById("toInput").value;
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = document.getElementById("passengers").value || 1;
    const travelClass = document.getElementById("travelClass").value;
    const tripType = document.querySelector('input[name="tripType"]:checked').value;

    const searchParams = {
      from,
      to,
      departureDate,
      returnDate: tripType === "round-trip" ? returnDate : null,
      passengers,
      travelClass,
      tripType
    };

    const response = await fetch("https://skydeal-backend.onrender.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchParams)
    });

    const data = await response.json();
    displayFlights(data);
  });

  function displayFlights(data) {
    const outboundContainer = document.getElementById("outboundContainer");
    const returnContainer = document.getElementById("returnContainer");
    outboundContainer.innerHTML = "";
    returnContainer.innerHTML = "";

    data.outbound.forEach(flight => {
      outboundContainer.appendChild(createFlightCard(flight));
    });

    if (data.return && data.return.length > 0) {
      data.return.forEach(flight => {
        returnContainer.appendChild(createFlightCard(flight));
      });
    }
  }

  function createFlightCard(flight) {
    const card = document.createElement("div");
    card.className = "flight-card";
    card.innerHTML = `
      <strong>${flight.airline || flight.flightNumber}</strong><br/>
      ${flight.departureTime || "-"} → ${flight.arrivalTime || "-"}<br/>
      Price: ₹${flight.price || "-"}<br/>
      <button class="compare-btn">Compare Prices</button>
    `;
    return card;
  }

  // Handle return date visibility toggle
  const tripTypeRadios = document.getElementsByName("tripType");
  const returnDateInput = document.getElementById("returnDate");

  tripTypeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (document.querySelector('input[name="tripType"]:checked').value === "round-trip") {
        returnDateInput.style.display = "inline-block";
      } else {
        returnDateInput.style.display = "none";
      }
    });
  });
});
