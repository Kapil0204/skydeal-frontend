const API_URL = "https://skydeal-backend.onrender.com";

// Toggle payment dropdown
document.getElementById("payment-toggle").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("payment-dropdown").classList.toggle("show");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#payment-dropdown") && !e.target.closest("#payment-toggle")) {
    document.getElementById("payment-dropdown").classList.remove("show");
  }
});

document.getElementById("search-button").addEventListener("click", async () => {
  const origin = document.getElementById("origin").value.trim();
  const destination = document.getElementById("destination").value.trim();
  const departureDate = document.getElementById("departure-date").value;
  const passengers = document.getElementById("passengers").value || 1;
  const travelClass = document.getElementById("travel-class").value;
  const tripType = document.getElementById("trip-type").value;

  if (!origin || !destination || !departureDate) {
    alert("Please fill in From, To, and Departure Date.");
    return;
  }

  if (tripType === "Round Trip") {
    alert("Round Trip support is not enabled yet. Showing one-way flights.");
  }

  const query = new URLSearchParams({
    origin,
    destination,
    date: departureDate,
    adults: passengers,
    travelClass
  });

  try {
    const res = await fetch(`${API_URL}/kiwi?${query}`);
    const data = await res.json();

    const outboundFlights = [];

    if (Array.isArray(data.data)) {
      data.data.forEach(flight => {
        const route = flight.route || [];
        const firstLeg = route[0];

        if (firstLeg) {
          outboundFlights.push({
            airline: firstLeg.airline || "N/A",
            from: firstLeg.cityFrom,
            to: firstLeg.cityTo,
            departure: firstLeg.dTimeUTC * 1000,
            arrival: firstLeg.aTimeUTC * 1000,
            price: flight.price
          });
        }
      });
    }

    document.getElementById("results-container").style.display = "flex";
    displayFlights("outbound", outboundFlights);
    displayFlights("return", []); // Return flights empty for now
  } catch (err) {
    console.error("Error fetching flights:", err);
    alert("Failed to fetch flight data.");
  }
});

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

function formatTime(timestampMs) {
  const date = new Date(timestampMs);
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

