document.getElementById("searchBtn").addEventListener("click", async () => {
  const from = document.getElementById("from").value.trim();
  const to = document.getElementById("to").value.trim();
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travel-class").value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;
  const paymentMethods = Array.from(
    document.querySelectorAll('#payment-methods input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  const requestBody = {
    from,
    to,
    departureDate,
    returnDate: tripType === "round-trip" ? returnDate : "",
    passengers: Number(passengers),
    travelClass,
    tripType,
    paymentMethods
  };

  try {
    const response = await fetch("https://skydeal-backend.onrender.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!data || !data.outboundFlights || data.outboundFlights.length === 0) {
      alert("No flights found for selected route/date.");
      return;
    }

    displayFlights(data);
  } catch (error) {
    console.error("Error fetching flights:", error);
    alert("Failed to fetch flight data.");
  }
});

function displayFlights(data) {
  const outboundContainer = document.getElementById("outbound-flights");
  const returnContainer = document.getElementById("return-flights");

  outboundContainer.innerHTML = "<h3>Outbound Flights</h3>";
  data.outboundFlights.forEach(flight => {
    outboundContainer.innerHTML += `
      <div class="flight-card">
        <strong>${flight.airline} ${flight.flightNumber}</strong><br>
        ${flight.departure} → ${flight.arrival}<br>
        ₹${flight.price}
      </div>`;
  });

  returnContainer.innerHTML = "";
  if (data.returnFlights && data.returnFlights.length > 0) {
    returnContainer.innerHTML = "<h3>Return Flights</h3>";
    data.returnFlights.forEach(flight => {
      returnContainer.innerHTML += `
        <div class="flight-card">
          <strong>${flight.airline} ${flight.flightNumber}</strong><br>
          ${flight.departure} → ${flight.arrival}<br>
          ₹${flight.price}
        </div>`;
    });
  }
}

