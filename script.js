const searchForm = document.getElementById("searchForm");
const flightResults = document.getElementById("flightResults");

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const from = document.getElementById("fromInput").value;
  const to = document.getElementById("toInput").value;
  const departureDate = document.getElementById("departureDate").value;
  const returnDate = document.getElementById("returnDate").value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;
  const travelClass = document.getElementById("travelClass").value;
  const passengers = document.getElementById("passengers").value;

  const body = {
    from,
    to,
    departureDate,
    returnDate: tripType === "round-trip" ? returnDate : "",
    passengers,
    travelClass,
    tripType
  };

  flightResults.innerHTML = `<p>Searching...</p>`;

  try {
    const response = await fetch("https://skydeal-backend.onrender.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    renderFlightResults(data);
  } catch (err) {
    console.error("Search error:", err);
    flightResults.innerHTML = `<p>Failed to fetch flights.</p>`;
  }
});

function renderFlightResults(data) {
  flightResults.innerHTML = "";

  if (!data || (!data.outboundFlights.length && !data.returnFlights.length)) {
    flightResults.innerHTML = "<p>No flights found.</p>";
    return;
  }

  const container = document.createElement("div");
  container.classList.add("flight-container");

  if (data.outboundFlights.length > 0) {
    const outboundSection = document.createElement("div");
    outboundSection.classList.add("flight-column");
    outboundSection.innerHTML = `<h3>Outbound Flights</h3>`;
    data.outboundFlights.forEach((flight) => outboundSection.appendChild(createFlightCard(flight)));
    container.appendChild(outboundSection);
  }

  if (data.returnFlights.length > 0) {
    const returnSection = document.createElement("div");
    returnSection.classList.add("flight-column");
    returnSection.innerHTML = `<h3>Return Flights</h3>`;
    data.returnFlights.forEach((flight) => returnSection.appendChild(createFlightCard(flight)));
    container.appendChild(returnSection);
  }

  flightResults.appendChild(container);
}

function createFlightCard(flight) {
  const card = document.createElement("div");
  card.className = "flight-card";

  const airline = flight.airline || "Unknown Airline";
  const number = flight.flightNumber || "";
  const from = flight.from || "-";
  const to = flight.to || "-";
  const dep = flight.departure || "-";
  const arr = flight.arrival || "-";
  const price = flight.price ? `₹${flight.price}` : "₹undefined";

  card.innerHTML = `
    <strong>${airline} ${number}</strong><br>
    ${from} → ${to}<br>
    ${dep} → ${arr}<br>
    Price: ${price}<br>
    <button class="price-btn">Compare Prices</button>
  `;

  return card;
}
