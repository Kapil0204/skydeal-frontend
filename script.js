const backendBaseUrl = "https://skydeal-backend.onrender.com";

// DOM Elements
const searchForm = document.getElementById("search-form");
const resultsContainer = document.getElementById("results");
const loadingMessage = document.getElementById("loading");

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultsContainer.innerHTML = "";
  loadingMessage.style.display = "block";

  const origin = document.getElementById("origin").value;
  const destination = document.getElementById("destination").value;
  const date = document.getElementById("date").value;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travelClass").value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const params = {
    flyFrom: origin,
    to: destination,
    dateFrom: date,
    dateTo: date,
    oneWay: tripType === "oneway" ? 1 : 0,
    adults: passengers,
    travelClass: travelClass
  };

  try {
    const response = await fetch(`${backendBaseUrl}/kiwi?${new URLSearchParams(params)}`);
    const data = await response.json();

    loadingMessage.style.display = "none";

    if (data.error || !data.data || data.data.length === 0) {
      resultsContainer.innerHTML = `<p>No flights found. Please try different dates or cities.</p>`;
      return;
    }

    renderFlightResults(data);
  } catch (error) {
    loadingMessage.style.display = "none";
    console.error("Fetch error:", error);
    resultsContainer.innerHTML = `<p>Failed to fetch flight data. Please try again later.</p>`;
  }
});

function renderFlightResults(data) {
  const airlines = {};
  if (data.carriers) {
    data.carriers.forEach(c => airlines[c.code] = c.name);
  }

  const flights = data.data || data.itineraries || [];

  if (flights.length === 0) {
    resultsContainer.innerHTML = "<p>No results found.</p>";
    return;
  }

  flights.forEach(flight => {
    const flightName = airlines[flight.airlines?.[0]] || flight.airlines?.[0] || "Unknown Airline";
    const price = flight.price || flight.price?.amount || "N/A";

    const depTime = new Date(flight.dTime * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const arrTime = new Date(flight.aTime * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const div = document.createElement("div");
    div.className = "flight-result";
    div.innerHTML = `
      <strong>${flightName}</strong><br>
      ₹${price}<br>
      Departure: ${depTime} → Arrival: ${arrTime}<br>
      From: ${flight.cityFrom} (${flight.flyFrom}) → To: ${flight.cityTo} (${flight.flyTo})
    `;
    resultsContainer.appendChild(div);
  });
}
