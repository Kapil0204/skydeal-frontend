document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");
  const fromInput = document.getElementById("fromInput");
  const toInput = document.getElementById("toInput");
  const departureDate = document.getElementById("departureDate");
  const returnDate = document.getElementById("returnDate");
  const travelClass = document.getElementById("travelClass");
  const passengers = document.getElementById("passengers");
  const tripType = document.getElementById("tripType");
  const flightsContainer = document.getElementById("flights");

  if (
    !searchBtn || !fromInput || !toInput || !departureDate || !travelClass ||
    !passengers || !tripType || !flightsContainer
  ) {
    console.error("❌ Required elements not found in DOM");
    return;
  }

  searchBtn.addEventListener("click", async () => {
    const from = fromInput.value.trim().toUpperCase();
    const to = toInput.value.trim().toUpperCase();
    const departure = departureDate.value;
    const retDate = returnDate.value;
    const travelClassVal = travelClass.value;
    const passengerCount = passengers.value;
    const isRoundTrip = tripType.value === "round-trip";

    if (!from || !to || !departure) {
      alert("Please fill in origin, destination, and departure date.");
      return;
    }

    const body = {
      from,
      to,
      departureDate: departure,
      returnDate: isRoundTrip ? retDate : null,
      passengers: passengerCount,
      travelClass: travelClassVal
    };

    console.log("📡 Sending request to backend:", body);

    try {
      const response = await fetch("https://skydeal-backend.onrender.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      console.log("✅ Response from backend:", data);

      flightsContainer.innerHTML = "";

      if (Array.isArray(data.flights) && data.flights.length > 0) {
        data.flights.forEach((flight) => {
          const div = document.createElement("div");
          div.classList.add("flight-card");
          div.innerHTML = `
            <strong>${flight.airline}</strong> ${flight.flightNumber}<br/>
            ${flight.departure} → ${flight.arrival}<br/>
            ₹${flight.price}
          `;
          flightsContainer.appendChild(div);
        });
      } else {
        flightsContainer.innerHTML = "<p>No flights found.</p>";
      }

    } catch (err) {
      console.error("❌ Error fetching flights:", err);
      flightsContainer.innerHTML = "<p>Failed to fetch flights.</p>";
    }
  });
});
