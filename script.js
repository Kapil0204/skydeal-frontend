document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("flight-search-form");
  const returnDateGroup = document.getElementById("return-date-group");
  const tripTypeInputs = document.getElementsByName("tripType");
  const outboundResults = document.getElementById("outbound-results");
  const returnResults = document.getElementById("return-results");

  tripTypeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      returnDateGroup.style.display = input.value === "round-trip" ? "block" : "none";
    });
  });

  form.addEventListener("submit", async function (e) {
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
      const res = await fetch("https://skydeal-backend.onrender.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      displayFlights(data.outboundFlights, outboundResults);
      displayFlights(data.returnFlights, returnResults);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  });

  function displayFlights(flights, container) {
    container.innerHTML = "";

    if (!flights || flights.length === 0) {
      container.innerHTML = "<p>No flights found.</p>";
      return;
    }

    flights.forEach((flight) => {
      const card = document.createElement("div");
      card.className = "flight-card";
      card.innerHTML = `
        <p><strong>${flight.flightName}</strong></p>
        <p>Departure: ${flight.departure}</p>
        <p>Arrival: ${flight.arrival}</p>
        <p>Price: ₹${flight.price}</p>
      `;
      container.appendChild(card);
    });
  }
});
