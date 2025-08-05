const form = document.getElementById("flight-search-form");
const outboundDiv = document.getElementById("outbound-results");
const returnDiv = document.getElementById("return-results");
const sortBySelect = document.getElementById("sort-by");
const sortContainer = document.getElementById("sort-container");

let currentResults = {
  outboundFlights: [],
  returnFlights: []
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const passengers = document.getElementById("passengers").value;
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

  const response = await fetch("https://skydeal-backend.onrender.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  currentResults = data;

  sortContainer.style.display = "block"; // show sort dropdown

  renderFlights();
});

sortBySelect.addEventListener("change", renderFlights);

function renderFlights() {
  const sortBy = sortBySelect.value;

  const sortedOutbound = [...currentResults.outboundFlights].sort((a, b) => {
    return sortBy === "price"
      ? parseFloat(a.price) - parseFloat(b.price)
      : a.departure.localeCompare(b.departure);
  });

  const sortedReturn = [...currentResults.returnFlights].sort((a, b) => {
    return sortBy === "price"
      ? parseFloat(a.price) - parseFloat(b.price)
      : a.departure.localeCompare(b.departure);
  });

  outboundDiv.innerHTML = "";
  returnDiv.innerHTML = "";

  sortedOutbound.forEach((flight) => {
    outboundDiv.appendChild(createFlightCard(flight));
  });

  sortedReturn.forEach((flight) => {
    returnDiv.appendChild(createFlightCard(flight));
  });
}

function createFlightCard(flight) {
  const card = document.createElement("div");
  card.className = "flight-card";

  const title = document.createElement("h3");
  title.textContent = `${flight.flightNumber} (${flight.airlineName})`;

  const departure = document.createElement("p");
  departure.textContent = `Departure: ${flight.departure}`;

  const arrival = document.createElement("p");
  arrival.textContent = `Arrival: ${flight.arrival}`;

  const stops = document.createElement("p");
  stops.textContent = `Stops: ${flight.stops}`;

  const price = document.createElement("p");
  price.textContent = `Price: ₹${parseFloat(flight.price).toFixed(2)}`;

  const viewBtn = document.createElement("button");
  viewBtn.className = "view-button";
  viewBtn.textContent = "View on OTAs";
  viewBtn.onclick = () => {
    alert(`Simulated pricing:\n\nMakeMyTrip: ₹${+flight.price + 100}\nGoibibo: ₹${+flight.price + 100}\nCleartrip: ₹${+flight.price + 100}\nEaseMyTrip: ₹${+flight.price + 100}\nYatra: ₹${+flight.price + 100}`);
  };

  card.appendChild(title);
  card.appendChild(departure);
  card.appendChild(arrival);
  card.appendChild(stops);
  card.appendChild(price);
  card.appendChild(viewBtn);

  return card;
}
