document.getElementById("search-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const flyFrom = document.getElementById("flyFrom").value.trim().toUpperCase();
  const to = document.getElementById("to").value.trim().toUpperCase();
  const date = document.getElementById("date").value;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travelClass").value;
  const oneWay = document.getElementById("oneWay").checked;

  // Format date
  const dateFormatted = date; // already YYYY-MM-DD from input[type="date"]

  const url = `https://skydeal-backend.onrender.com/kiwi?flyFrom=${flyFrom}&to=${to}&dateFrom=${dateFormatted}&dateTo=${dateFormatted}&oneWay=${oneWay ? 1 : 0}&adults=${passengers}&travelClass=${travelClass}`;

  document.getElementById("results").innerHTML = "Searching...";

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data.data || data.data.length === 0) {
      document.getElementById("results").innerHTML = "No flights found. Please try different dates or cities.";
      return;
    }

    const resultsHTML = data.data.map((flight) => {
      const airline = flight.airlines?.join(", ") || "N/A";
      const depTime = new Date(flight.dTimeUTC * 1000).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const arrTime = new Date(flight.aTimeUTC * 1000).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const price = flight.price;

      return `
        <div class="flight-result">
          <p><strong>${airline}</strong></p>
          <p>${flight.cityFrom} (${flight.flyFrom}) → ${flight.cityTo} (${flight.flyTo})</p>
          <p>Departure: ${depTime} | Arrival: ${arrTime}</p>
          <p>Price: ₹${price}</p>
        </div>
      `;
    }).join("");

    document.getElementById("results").innerHTML = resultsHTML;
  } catch (err) {
    console.error(err);
    document.getElementById("results").innerHTML = "Failed to fetch flight data.";
  }
});

