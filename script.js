document.addEventListener("DOMContentLoaded", () => {
  const searchButton = document.getElementById("searchButton");
  const outboundFlightsDiv = document.getElementById("outboundFlights");
  const returnFlightsDiv = document.getElementById("returnFlights");
  const returnSection = document.getElementById("returnResults");

  const modal = document.getElementById("modal");
  const priceComparison = document.getElementById("priceComparison");
  const closeModal = document.getElementById("closeModal");

  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  searchButton.addEventListener("click", async (e) => {
    e.preventDefault();

    outboundFlightsDiv.innerHTML = "";
    returnFlightsDiv.innerHTML = "";
    returnSection.style.display = "none";

    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = document.getElementById("passengers").value;
    const travelClass = document.getElementById("travelClass").value;
    const tripType = document.getElementById("tripType").value;

    const payload = {
      from,
      to,
      departureDate,
      returnDate: tripType === "round-trip" ? returnDate : "",
      passengers,
      travelClass
    };

    try {
      const response = await fetch("https://skydeal-backend.onrender.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      const { outbound, returnFlights } = data;

      outbound.forEach((flight) => {
        const card = createFlightCard(flight);
        outboundFlightsDiv.appendChild(card);
      });

      if (tripType === "round-trip" && returnFlights?.length) {
        returnSection.style.display = "block";
        returnFlights.forEach((flight) => {
          const card = createFlightCard(flight);
          returnFlightsDiv.appendChild(card);
        });
      }
    } catch (err) {
      console.error("Error fetching flights:", err);
    }
  });

  function createFlightCard(flight) {
    const div = document.createElement("div");
    div.className = "flight-card";
    div.innerHTML = `
      <h4>${flight.airline} (${flight.flightNumber})</h4>
      <div class="info">Departure: ${flight.departureTime} | Arrival: ${flight.arrivalTime}</div>
      <div class="info">Price: ₹${flight.price}</div>
      <button class="compare-button">Compare Prices</button>
    `;

    div.querySelector(".compare-button").addEventListener("click", () => {
      const portals = ["MakeMyTrip", "Goibibo", "Yatra", "Cleartrip", "EaseMyTrip"];
      priceComparison.innerHTML = portals
        .map(
          (portal) => `
          <div><strong>${portal}</strong>: ₹${flight.price + 100}</div>
        `
        )
        .join("");
      modal.style.display = "block";
    });

    return div;
  }
});
