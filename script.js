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
    6E: "IndiGo",
    SG: "SpiceJet",
    UK: "Vistara",
    G8: "Go First",
    IX: "Air India Express",
    I5: "AirAsia India",
    QP: "Akasa Air"
  };

  searchBtn.addEventListener("click", async function () {
    const from = fromInput.value.trim().toUpperCase();
    const to = toInput.value.trim().toUpperCase();
    const departureDate = departureInput.value;
    const returnDate = returnInput.value;
    const travelClass = classSelect.value;
    const passengers = passengersInput.value;
    const tripType = tripTypeSelect.value;

    if (!from || !to || !departureDate || !travelClass || !passengers) {
      alert("Please fill all required fields.");
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
      resultsContainer.innerHTML = "";

      if (Array.isArray(data.flights) && data.flights.length > 0) {
        data.flights.forEach((flight) => {
          const airline = airlineNames[flight.carrierCode] || flight.carrierCode;
          const flightNumber = `${flight.carrierCode} ${flight.number}`;
          const departure = flight.departureDateTime;
          const arrival = flight.arrivalDateTime;
          const price = flight.price;

          const card = document.createElement("div");
          card.className = "flight-card";
          card.innerHTML = `
            <strong>${airline} ${flightNumber}</strong><br>
            ${departure} → ${arrival}<br>
            ₹${price}
          `;
          resultsContainer.appendChild(card);
        });
      } else {
        resultsContainer.innerHTML = "<p>No flights found.</p>";
      }
    } catch (error) {
      console.error("Search failed:", error);
      resultsContainer.innerHTML = "<p>Something went wrong. Please try again.</p>";
    }
  });
});
