document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("searchForm");
  const outboundContainer = document.getElementById("outboundContainer");
  const returnContainer = document.getElementById("returnContainer");
  const returnDateInput = document.getElementById("returnDate");
  const tripTypeRadios = document.getElementsByName("tripType");

  returnDateInput.style.display = "none";

  tripTypeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      const selectedType = document.querySelector('input[name="tripType"]:checked').value;
      returnDateInput.style.display = selectedType === "round-trip" ? "inline" : "none";
    });
  });

  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const from = document.getElementById("from").value.toUpperCase();
    const to = document.getElementById("to").value.toUpperCase();
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = parseInt(document.getElementById("passengers").value);
    const travelClass = document.getElementById("travelClass").value;
    const tripType = document.querySelector('input[name="tripType"]:checked').value;

    outboundContainer.innerHTML = "";
    returnContainer.innerHTML = "";

    try {
      const response = await fetch("https://skydeal-backend.onrender.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          departureDate,
          returnDate,
          passengers,
          travelClass,
          tripType
        })
      });

      const data = await response.json();
      displayFlights(data.outboundFlights, outboundContainer);
      displayFlights(data.returnFlights, returnContainer);
    } catch (error) {
      console.error("Error fetching flights:", error);
      alert("Failed to fetch flights. Please try again.");
    }
  });

  function displayFlights(flights, container) {
    if (!flights || flights.length === 0) {
      container.innerHTML = "<p>No flights found.</p>";
      return;
    }

    flights.forEach((flight) => {
      const card = document.createElement("div");
      card.className = "flight-card";
      card.innerHTML = `
        <p><strong>${flight.flightNumber}</strong> (${flight.airlineName})</p>
        <p>Departure: ${flight.departure} | Arrival: ${flight.arrival}</p>
        <p>Stops: ${flight.stops}</p>
        <p>Price: ₹${flight.price}</p>
      `;
      container.appendChild(card);
    });
  }
});
