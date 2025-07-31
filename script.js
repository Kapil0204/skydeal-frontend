document.addEventListener("DOMContentLoaded", () => {
  // Toggle return date visibility
  const tripRadios = document.querySelectorAll('input[name="trip-type"]');
  const returnDateInput = document.getElementById('return-date');
  tripRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (document.querySelector('input[name="trip-type"]:checked').value === 'round-trip') {
        returnDateInput.style.display = 'inline-block';
      } else {
        returnDateInput.style.display = 'none';
      }
    });
  });
});

async function searchFlights() {
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const passengers = parseInt(document.getElementById("passengers").value) || 1;
  const travelClass = document.getElementById("travel-class").value;
  const tripType = document.querySelector('input[name="trip-type"]:checked').value;

  const requestBody = {
    from,
    to,
    departureDate,
    returnDate: tripType === "round-trip" ? returnDate : null,
    passengers,
    travelClass
  };

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "Searching...";

  try {
    const response = await fetch("https://skydeal-backend.onrender.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (data.error) {
      resultsDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
      return;
    }

    if (!data.flights || data.flights.length === 0) {
      resultsDiv.innerHTML = "No flights found.";
      return;
    }

    // Show all flights with popup button
    const flightCards = data.flights.map((flight, index) => `
      <div class="flight-card">
        <strong>${flight.airline}</strong> - ${flight.flightNumber}<br>
        ${flight.departureTime} → ${flight.arrivalTime}<br>
        Base Price: ₹${flight.price}<br>
        <button onclick="showOTAPrices(${flight.price}, ${index})">View OTA Prices</button>
      </div>
    `).join("<hr>");

    resultsDiv.innerHTML = flightCards;

  } catch (error) {
    console.error("Error fetching flights:", error);
    resultsDiv.innerHTML = `<pre>${JSON.stringify({ error: "Failed to fetch flight data from Amadeus" }, null, 2)}</pre>`;
  }
}

function showOTAPrices(basePrice, index) {
  const markup = 100;
  const otaPrices = [
    { name: "MakeMyTrip", price: basePrice + markup },
    { name: "Goibibo", price: basePrice + markup },
    { name: "EaseMyTrip", price: basePrice + markup },
    { name: "Yatra", price: basePrice + markup },
    { name: "Cleartrip", price: basePrice + markup }
  ];

  const content = otaPrices.map(ota =>
    `<div>${ota.name}: ₹${ota.price} <button onclick="alert('Go to ${ota.name}')">Book</button></div>`
  ).join("");

  const popup = document.createElement("div");
  popup.className = "popup";
  popup.innerHTML = `
    <div class="popup-inner">
      <h3>OTA Prices</h3>
      ${content}
      <button onclick="closePopup()">Close</button>
    </div>
  `;
  document.body.appendChild(popup);
}

function closePopup() {
  const popup = document.querySelector(".popup");
  if (popup) popup.remove();
}

