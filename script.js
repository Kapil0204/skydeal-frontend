// script.js — Final Version for SkyDeal

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("flightSearchForm");
  const resultsContainer = document.getElementById("resultsContainer");

  if (!searchForm) return;

  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get form values
    const from = document.getElementById("fromInput").value;
    const to = document.getElementById("toInput").value;
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = document.getElementById("passengers").value;
    const travelClass = document.getElementById("travelClass").value;
    const tripType = document.getElementById("tripType").value;

    // Clear previous results
    resultsContainer.innerHTML = "<h3>Loading flights...</h3>";

    try {
      const res = await fetch("https://skydeal-backend.onrender.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          departureDate,
          returnDate,
          passengers,
          travelClass: travelClass.toLowerCase(), // 🔥 FIXED
          tripType,
        }),
      });

      const data = await res.json();

      if (!data || !data.flights || data.flights.length === 0) {
        resultsContainer.innerHTML = "<p>No flights found.</p>";
        return;
      }

      renderFlightResults(data.flights);
    } catch (error) {
      console.error("Search error:", error);
      resultsContainer.innerHTML = "<p>Something went wrong. Try again.</p>";
    }
  });
});

function renderFlightResults(flights) {
  const resultsContainer = document.getElementById("resultsContainer");
  resultsContainer.innerHTML = "<h3>Available Flights</h3>";

  flights.forEach((flight, index) => {
    const card = document.createElement("div");
    card.className = "flight-card";
    card.innerHTML = `
      <p><strong>${flight.airline}</strong> - ${flight.flightNumber}</p>
      <p>${flight.departure} → ${flight.arrival}</p>
      <p>Departure: ${flight.departureTime}, Arrival: ${flight.arrivalTime}</p>
      <p>Price: ₹${flight.price}</p>
      <button onclick="showModal(${flight.price}, '${flight.airline}', '${flight.flightNumber}')">View Prices</button>
    `;
    resultsContainer.appendChild(card);
  });
}

function showModal(basePrice, airline, flightNumber) {
  const modal = document.createElement("div");
  modal.className = "modal";

  const portals = ["MakeMyTrip", "Goibibo", "Yatra", "EaseMyTrip", "Cleartrip"];

  let html = `
    <div class="modal-content">
      <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
      <h3>${airline} - ${flightNumber}</h3>
      <p>Simulated Prices from Portals:</p>
      <ul>
        ${portals
          .map(
            (portal) => `
            <li><strong>${portal}:</strong> ₹${basePrice + 100}</li>
          `
          )
          .join("")}
      </ul>
    </div>
  `;

  modal.innerHTML = html;
  document.body.appendChild(modal);
}
