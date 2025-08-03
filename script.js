// ✅ Replace this with your live backend
const API_BASE_URL = "https://skydeal-backend.onrender.com";

document.getElementById("search-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const passengers = parseInt(document.getElementById("passengers").value);
  const travelClass = document.getElementById("travel-class").value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const payload = {
    from,
    to,
    departureDate,
    returnDate,
    passengers,
    travelClass,
    tripType
  };

  try {
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    displayFlights(data.outboundFlights, "outbound-results", "Outbound");
    displayFlights(data.returnFlights || [], "return-results", "Return");
  } catch (err) {
    console.error("❌ Error fetching flights:", err);
  }
});

function displayFlights(flights, containerId, label) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<h3>${label} Flights</h3>`;

  if (!flights.length) {
    container.innerHTML += `<p>No flights found.</p>`;
    return;
  }

  flights.forEach(flight => {
    const card = document.createElement("div");
    card.className = "flight-card";
    card.innerHTML = `
      <strong>${flight.flightNumber}</strong> - ${flight.airline}<br>
      ${flight.departureTime} → ${flight.arrivalTime}<br>
      Price: ₹${flight.price}<br>
      <button onclick="showPortalPrices('${flight.flightNumber}', ${flight.price})">View on OTAs</button>
    `;
    container.appendChild(card);
  });
}

function showPortalPrices(flightNumber, basePrice) {
  const portals = ["MakeMyTrip", "Goibibo", "Cleartrip", "EaseMyTrip", "Yatra"];
  const markup = 100;

  let content = `<h4>${flightNumber} Prices Across Portals:</h4>`;
  portals.forEach(p => {
    content += `${p}: ₹${basePrice + markup}<br>`;
  });

  alert(content);
}
