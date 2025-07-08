const API_URL = "https://skydeal-backend-live.onrender.com";
 // Update if needed

// Toggle payment dropdown
document.getElementById("payment-toggle").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("payment-dropdown").classList.toggle("show");
});

// Close dropdown if clicked outside
document.addEventListener("click", (e) => {
  if (!e.target.closest("#payment-dropdown") && !e.target.closest("#payment-toggle")) {
    document.getElementById("payment-dropdown").classList.remove("show");
  }
});

// Handle search
document.getElementById("search-button").addEventListener("click", async () => {
  const origin = document.getElementById("origin").value.trim();
  const destination = document.getElementById("destination").value.trim();
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const passengers = document.getElementById("passengers").value || 1;
  const travelClass = document.getElementById("travel-class").value;
  const tripType = document.getElementById("trip-type").value;

  if (!origin || !destination || !departureDate) {
    alert("Please fill in From, To, and Departure Date.");
    return;
  }

  const query = new URLSearchParams({
    origin,
    destination,
    date: departureDate,
    returnDate: tripType === "Round Trip" ? returnDate : "",
    adults: passengers,
    travelClass
  });

  try {
    const res = await fetch(`${API_URL}/kiwi?${query}`);
    const data = await res.json();

    const outboundFlights = [];
const returnFlights = [];

if (Array.isArray(data.data)) {
  data.data.forEach(flight => {
    const price = flight.price;
    const route = flight.route || [];

    const outbound = route.find(r => r.return === 0);
    const inbound = route.find(r => r.return === 1);

    if (outbound) {
      outboundFlights.push({
        airline: outbound.airline || "N/A",
        from: outbound.cityFrom,
        to: outbound.cityTo,
        departure: outbound.dTimeUTC * 1000,
        arrival: outbound.aTimeUTC * 1000,
        price
      });
    }

    if (inbound) {
      returnFlights.push({
        airline: inbound.airline || "N/A",
        from: inbound.cityFrom,
        to: inbound.cityTo,
        departure: inbound.dTimeUTC * 1000,
        arrival: inbound.aTimeUTC * 1000,
        price
      });
    }
  });
}


    // Show and populate results
    document.getElementById("results-container").style.display = "flex";
    displayFlights("outbound", outboundFlights);
    displayFlights("return", returnFlights);
  } catch (err) {
    console.error("Error fetching flights:", err);
    alert("Failed to fetch flight data.");
  }
});

// Utility: Display flights
function displayFlights(type, flights) {
  const container = document.getElementById(`${type}-flights`);
  container.innerHTML = "";

  if (flights.length === 0) {
    container.innerHTML = "<p>No flights found.</p>";
    return;
  }

  flights.forEach(f => {
    const div = document.createElement("div");
    div.className = "flight-card";
    div.innerHTML = `
      <p><strong>${f.airline}</strong>: ${f.from} → ${f.to}</p>
      <p>Depart: ${formatTime(f.departure)} | Arrive: ${formatTime(f.arrival)}</p>
      <p>Price: ₹${f.price}</p>
    `;
    container.appendChild(div);
  });
}

// Format time
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
