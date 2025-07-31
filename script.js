document.getElementById("searchForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const departureDate = document.getElementById("departureDate").value;
  const passengers = parseInt(document.getElementById("passengers").value);
  const travelClass = document.getElementById("travelClass").value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const searchData = {
    from,
    to,
    departureDate,
    passengers,
    travelClass,
    tripType
  };

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "Searching...";

  try {
    const response = await fetch("https://skydeal-backend.onrender.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchData),
    });

    const data = await response.json();

    if (data.flights && data.flights.length > 0) {
      resultsDiv.innerHTML = `<h3>Available Flights:</h3>`;
      data.flights.forEach(flight => {
        const div = document.createElement("div");
        div.classList.add("flight-card");
        div.innerHTML = `
          <strong>${flight.airline} ${flight.flightNumber}</strong><br>
          ${flight.departure} → ${flight.arrival}<br>
          Price: ₹${flight.price}
          <hr>
        `;
        resultsDiv.appendChild(div);
      });
    } else {
      resultsDiv.innerHTML = "No flights found.";
    }
  } catch (error) {
    console.error("Search failed:", error);
    resultsDiv.innerHTML = "Error fetching flights.";
  }
});
