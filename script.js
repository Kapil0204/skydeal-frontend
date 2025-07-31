document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("flight-search-form");
  const resultsContainer = document.getElementById("results");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;
    const departureDate = document.getElementById("departure-date").value;
    const returnDateInput = document.getElementById("return-date");
    const returnDate = returnDateInput ? returnDateInput.value : "";
    const tripType = document.querySelector('input[name="tripType"]:checked').value;
    const travelClass = document.getElementById("travel-class").value;
    const passengers = document.getElementById("passengers").value;

    const body = {
      from,
      to,
      departureDate,
      returnDate: tripType === "round-trip" ? returnDate : "",
      passengers,
      travelClass,
    };

    try {
      const response = await fetch("https://skydeal-backend.onrender.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      displayFlights(data, tripType);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  });

  function displayFlights(data, tripType) {
    resultsContainer.innerHTML = ""; // clear previous

    const outboundHeader = document.createElement("h3");
    outboundHeader.textContent = "Outbound Flights";
    resultsContainer.appendChild(outboundHeader);

    data.outboundFlights.forEach((flight) => {
      resultsContainer.appendChild(createFlightCard(flight));
    });

    if (tripType === "round-trip" && data.returnFlights && data.returnFlights.length > 0) {
      const returnHeader = document.createElement("h3");
      returnHeader.textContent = "Return Flights";
      resultsContainer.appendChild(returnHeader);

      data.returnFlights.forEach((flight) => {
        resultsContainer.appendChild(createFlightCard(flight));
      });
    }
  }

  function createFlightCard(flight) {
    const card = document.createElement("div");
    card.className = "flight-card";

    const flightInfo = document.createElement("p");
    flightInfo.innerHTML = `<strong>${flight.airlineName || "Flight"} ${flight.flightNumber || ""}</strong><br>
      ${flight.departureTime || "Time N/A"} → ${flight.arrivalTime || "Time N/A"}<br>
      Price: ₹${flight.price || "N/A"}`;

    const compareBtn = document.createElement("button");
    compareBtn.className = "compare-button";
    compareBtn.textContent = "Compare Prices";
    compareBtn.onclick = () => alert("Comparison popup coming soon");

    card.appendChild(flightInfo);
    card.appendChild(compareBtn);

    return card;
  }
});
