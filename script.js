document.getElementById("flight-search-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const from = document.getElementById("from").value.toUpperCase();
  const to = document.getElementById("to").value.toUpperCase();
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travel-class").value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const response = await fetch("https://skydeal-backend.onrender.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, departureDate, returnDate, passengers, travelClass, tripType }),
  });

  const data = await response.json();
  const outboundFlights = data.outboundFlights || [];
  const returnFlights = data.returnFlights || [];

  // Show sort dropdown only when flights are shown
  document.getElementById("sort-container").style.display = "block";

  const sortBy = document.getElementById("sort-by").value;
  if (sortBy === "price") {
    outboundFlights.sort((a, b) => a.price - b.price);
    returnFlights.sort((a, b) => a.price - b.price);
  } else if (sortBy === "departureTime") {
    outboundFlights.sort((a, b) => a.departure.localeCompare(b.departure));
    returnFlights.sort((a, b) => a.departure.localeCompare(b.departure));
  }

  const outboundContainer = document.getElementById("outbound-flights");
  const returnContainer = document.getElementById("return-flights");
  outboundContainer.innerHTML = "";
  returnContainer.innerHTML = "";

  const renderFlights = (flights, container) => {
    flights.forEach((flight) => {
      const div = document.createElement("div");
      div.className = "flight-card";
      div.innerHTML = `
        <strong>${flight.flightNumber} (${flight.airline})</strong><br/>
        Departure: ${flight.departure}<br/>
        Arrival: ${flight.arrival}<br/>
        Stops: ${flight.stops}<br/>
        Price: ₹${Number(flight.price || 0).toFixed(2)}<br/>
        <button onclick="showOTAs('${flight.flightNumber}', ${flight.price})">View on OTAs</button>
      `;
      container.appendChild(div);
    });
  };

  renderFlights(outboundFlights, outboundContainer);
  if (tripType === "round-trip") {
    renderFlights(returnFlights, returnContainer);
  }
});

function showOTAs(flightNumber, basePrice) {
  const markup = 100;
  const otas = ["MakeMyTrip", "Goibibo", "Cleartrip", "EaseMyTrip", "Yatra"];
  const prices = otas.map((ota) => `${ota}: ₹${(basePrice + markup).toFixed(0)}`).join("\n");

  alert(`${flightNumber} pricing:\n\n${prices}`);
}

document.querySelectorAll('input[name="tripType"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const returnDateInput = document.getElementById("return-date");
    returnDateInput.style.display = e.target.value === "round-trip" ? "inline-block" : "none";
  });
});
