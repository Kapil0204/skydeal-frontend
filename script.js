// public/script.js

const searchForm = document.getElementById("search-form");
const resultsContainer = document.getElementById("results");

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const departureDate = document.getElementById("departure-date").value;
  const returnDateInput = document.getElementById("return-date");
  const tripType = document.querySelector('input[name="trip-type"]:checked').value;
  const returnDate = tripType === "round-trip" ? returnDateInput.value : "";

  const passengers = parseInt(document.getElementById("passengers").value);
  const travelClass = document.getElementById("travel-class").value;

  const searchData = {
    from,
    to,
    departureDate,
    returnDate,
    passengers,
    travelClass,
    tripType
  };

  try {
    const response = await fetch("https://skydeal-backend.onrender.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchData)
    });

    const data = await response.json();
    displayFlightResults(data.outboundFlights, data.returnFlights);
  } catch (error) {
    console.error("Error fetching flights:", error);
    resultsContainer.innerHTML = "<p>Error fetching flight results.</p>";
  }
});

function displayFlightResults(outboundFlights, returnFlights) {
  resultsContainer.innerHTML = "";

  if (outboundFlights.length > 0) {
    const outboundDiv = document.createElement("div");
    outboundDiv.classList.add("flight-section");
    outboundDiv.innerHTML = `<h3>Outbound Flights</h3>`;
    outboundFlights.forEach((flight) => {
      outboundDiv.appendChild(createFlightCard(flight));
    });
    resultsContainer.appendChild(outboundDiv);
  }

  if (returnFlights.length > 0) {
    const returnDiv = document.createElement("div");
    returnDiv.classList.add("flight-section");
    returnDiv.innerHTML = `<h3>Return Flights</h3>`;
    returnFlights.forEach((flight) => {
      returnDiv.appendChild(createFlightCard(flight));
    });
    resultsContainer.appendChild(returnDiv);
  }
}

function createFlightCard(flight) {
  const card = document.createElement("div");
  card.className = "flight-card";
  card.innerHTML = `
    <div><strong>${flight.airline}</strong> - ${flight.flightNumber}</div>
    <div>${flight.departureTime} → ${flight.arrivalTime}</div>
    <div>₹${flight.price}</div>
    <button class="view-prices-btn">Compare Prices</button>
  `;

  card.querySelector(".view-prices-btn").addEventListener("click", () => {
    showPriceModal(flight);
  });

  return card;
}

function showPriceModal(flight) {
  const portals = ["MakeMyTrip", "Goibibo", "Yatra", "EaseMyTrip", "Cleartrip"];

  let modalHtml = `
    <div class="modal-overlay">
      <div class="modal-content">
        <h3>Compare Prices for ${flight.airline} ${flight.flightNumber}</h3>
        <ul>
          ${portals
            .map(
              (portal) =>
                `<li>${portal}: ₹${flight.price + 100}</li>`
            )
            .join("")}
        </ul>
        <button id="close-modal">Close</button>
      </div>
    </div>
  `;

  const modalContainer = document.createElement("div");
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);

  document.getElementById("close-modal").addEventListener("click", () => {
    modalContainer.remove();
  });
}
