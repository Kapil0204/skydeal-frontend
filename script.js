document.getElementById("search-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const flyFrom = document.getElementById("flyFrom").value.toUpperCase();
  const to = document.getElementById("to").value.toUpperCase();
  const date = document.getElementById("date").value;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travelClass").value.toUpperCase();
  const oneWay = document.getElementById("oneWay").checked;

  const [year, month, day] = date.split("-");
  const dateFormatted = `${year}-${month}-${day}`;

  const url = `https://skydeal-backend.onrender.com/kiwi?flyFrom=${flyFrom}&to=${to}&dateFrom=${dateFormatted}&dateTo=${dateFormatted}&oneWay=${oneWay ? 1 : 0}&adults=${passengers}&travelClass=${travelClass}`;

  document.getElementById("results").innerHTML = "Searching...";

  try {
    const response = await fetch(url);
    const data = await response.json();

    // Check if the 'data' array exists in the Kiwi response
    const flights = data?.data;

    if (!flights || flights.length === 0) {
      document.getElementById("results").innerHTML = "No flights found. Please try different dates or cities.";
      return;
    }

    const resultsHTML = flights.map((flight) => {
      const fromCity = flight.source?.city?.name || flight.source?.name || "Unknown";
      const toCity = flight.destination?.city?.name || flight.destination?.name || "Unknown";
      const depTime = flight.segments?.[0]?.departLocal || "N/A";
      const arrTime = flight.segments?.[0]?.arriveLocal || "N/A";
      const airline = flight.segments?.[0]?.marketingCarrier?.name || "Unknown Airline";
      const price = flight.price?.amount || "N/A";
      const currency = flight.price?.currency || "INR";

      return `
        <div class="flight-result">
          <p><strong>${airline}</strong></p>
          <p>${fromCity} → ${toCity}</p>
          <p>Departure: ${depTime} | Arrival: ${arrTime}</p>
          <p>Price: ₹${price} ${currency}</p>
        </div>
      `;
    }).join("");

    document.getElementById("results").innerHTML = resultsHTML;
  } catch (err) {
    console.error(err);
    document.getElementById("results").innerHTML = "Failed to fetch flight data.";
  }
});
