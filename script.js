document.addEventListener("DOMContentLoaded", function () {
  const searchBtn = document.getElementById("searchBtn");
  const fromInput = document.getElementById("from");
  const toInput = document.getElementById("to");
  const departureInput = document.getElementById("departure");
  const returnInput = document.getElementById("return");
  const classSelect = document.getElementById("class");
  const passengersInput = document.getElementById("passengers");
  const tripTypeSelect = document.getElementById("tripType");
  const resultsContainer = document.getElementById("results");

  const airlineNames = {
    AI: "Air India",
    "6E": "IndiGo",
    SG: "SpiceJet",
    UK: "Vistara",
    G8: "Go First",
    IX: "Air India Express",
    I5: "AirAsia India",
    OP: "Akasa Air"
  };

  searchBtn.addEventListener("click", async function () {
    const from = fromInput.value.trim().toUpperCase();
    const to = toInput.value.trim().toUpperCase();
    const departureDate = departureInput.value;
    const returnDate = returnInput.value;
    const travelClass = classSelect.value;
    const passengers = parseInt(passengersInput.value, 10);
    const tripType = tripTypeSelect.value;

    if (!from || !to || !departureDate || !travelClass || !passengers) {
      alert("Please fill in all required fields.");
      return;
    }

    const payload = {
      from,
      to,
      departureDate,
      returnDate: tripType === "round-trip" ? returnDate : "",
      travelClass,
      passengers
    };

    try {
      const response = await fetch("https://skydeal-backend.onrender.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      displayFlights(data.flights || []);
    } catch (err) {
      console.error("Search failed:", err);
      resultsContainer.innerHTML = `<p style="color:red;">Failed to fetch flight results.</p>`;
    }
  });

  function displayFlights(flights) {
    resultsContainer.innerHTML = "";

    if (flights.length === 0) {
      resultsContainer.innerHTML = "<p>No flights found for the selected route.</p>";
      return;
    }

    flights.forEach((flight, index) => {
      const card = document.createElement("div");
      card.className = "flight-card";

      const airlineFull = airlineNames[flight.carrierCode] || flight.carrierCode;
      card.innerHTML = `
        <strong>${airlineFull} ${flight.flightNumber}</strong><br>
        ${flight.departureTime} → ${flight.arrivalTime}<br>
        ₹${flight.price}<br>
        <button class="view-portals" data-index="${index}">View on Portals</button>
      `;

      resultsContainer.appendChild(card);
    });

    document.querySelectorAll(".view-portals").forEach(btn => {
      btn.addEventListener("click", function () {
        const idx = this.getAttribute("data-index");
        showPortals(flights[idx]);
      });
    });
  }

  function showPortals(flight) {
    const portals = ["MakeMyTrip", "Goibibo", "EaseMyTrip", "Cleartrip", "Yatra"];
    const basePrice = flight.price;

    const popup = document.createElement("div");
    popup.className = "popup";
    popup.innerHTML = `
      <h3>Compare Prices on Portals</h3>
      <ul>
        ${portals
          .map(
            p =>
              `<li>${p}: ₹${basePrice + 100} <button onclick="alert('Go to ${p}')">Visit</button></li>`
          )
          .join("")}
      </ul>
      <button onclick="this.parentElement.remove()">Close</button>
    `;

    document.body.appendChild(popup);
  }
});
