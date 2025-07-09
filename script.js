document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("flight-form");
  const resultsDiv = document.getElementById("results");
  const tripTypeRadios = document.getElementsByName("tripType");
  const returnDateGroup = document.getElementById("return-date-group");
  const errorDiv = document.getElementById("error");

  tripTypeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      returnDateGroup.style.display =
        document.querySelector('input[name="tripType"]:checked').value === "round-trip"
          ? "block"
          : "none";
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    resultsDiv.innerHTML = "";
    errorDiv.textContent = "";

    const origin = document.getElementById("origin").value.trim();
    const destination = document.getElementById("destination").value.trim();
    const departureDate = document.getElementById("departure-date").value;
    const returnDate = document.getElementById("return-date").value;
    const tripType = document.querySelector('input[name="tripType"]:checked').value;

    if (!origin || !destination || !departureDate) {
      errorDiv.textContent = "Please fill all required fields.";
      return;
    }

    try {
      const url = new URL("https://skydeal-backend.onrender.com/kiwi");
      url.searchParams.append("origin", origin);
      url.searchParams.append("destination", destination);
      url.searchParams.append("date", departureDate);
      url.searchParams.append("adults", 1);
      url.searchParams.append("travelClass", "ECONOMY");

      const response = await fetch(url);
      const data = await response.json();

      if (data.flights && data.flights.length > 0) {
        data.flights.forEach((flight) => {
          const flightDiv = document.createElement("div");
          flightDiv.className = "flight-card";

          const departureTime = flight.dTimeUTC
            ? new Date(flight.dTimeUTC * 1000).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            : "N/A";
          const arrivalTime = flight.aTimeUTC
            ? new Date(flight.aTimeUTC * 1000).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            : "N/A";

          const airline = flight.airlines && flight.airlines.length > 0 ? flight.airlines[0] : "Unknown Airline";
          const fullAirlineName = flight.route && flight.route[0] && flight.route[0].airline_fullname
            ? flight.route[0].airline_fullname
            : airline;

          flightDiv.innerHTML = `
            <h3>✈️ ${fullAirlineName}</h3>
            <p><strong>Departure:</strong> ${departureTime}</p>
            <p><strong>Arrival:</strong> ${arrivalTime}</p>
            <p><strong>Price:</strong> ₹${flight.price}</p>
          `;
          resultsDiv.appendChild(flightDiv);
        });
      } else {
        resultsDiv.innerHTML = "<p>No flights found.</p>";
      }
    } catch (err) {
      console.error(err);
      errorDiv.textContent = "Error fetching flights.";
    }
  });
});




