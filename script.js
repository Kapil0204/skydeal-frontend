console.log("✅ Script loaded!");

document.getElementById("search-button").addEventListener("click", handleSearch);

async function handleSearch(event) {
  event.preventDefault();

  const from = document.getElementById("from").value.trim();
  const to = document.getElementById("to").value.trim();
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const passengers = parseInt(document.getElementById("passengers").value, 10);
  const travelClass = document.getElementById("travel-class").value;
  const tripType = document.querySelector('input[name="trip-type"]:checked').value;

  if (!from || !to || !departureDate || !passengers || !travelClass) {
    alert("Please fill all required fields.");
    return;
  }

  const requestBody = {
    from,
    to,
    departureDate,
    returnDate: tripType === "round-trip" ? returnDate : "",
    passengers,
    travelClass,
    tripType,
  };

  try {
    const response = await fetch("https://skydeal-backend.onrender.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    displayFlights(data, tripType);
  } catch (error) {
    console.error("❌ Failed to fetch flights:", error);
    alert("Error fetching flight data. Please try again.");
  }
}

function displayFlights(data, tripType) {
  const outboundContainer = document.getElementById("outbound-results");
  const returnContainer = document.getElementById("return-results");
  outboundContainer.innerHTML = "";
  returnContainer.innerHTML = "";

  const createFlightCard = (flight) => {
    const card = document.createElement("div");
    card.className = "flight-card";
    card.innerHTML = `
      <div><strong>${flight.airline}</strong> | ${flight.flightNumber}</div>
      <div>${flight.departureTime} → ${flight.arrivalTime}</div>
      <div>₹${flight.price}</div>
      <button class="view-portals-btn">View on Portals</button>
    `;

    card.querySelector(".view-portals-btn").addEventListener("click", () => {
      showPortalPopup(flight);
    });

    return card;
  };

  data.outboundFlights?.forEach((flight) => {
    outboundContainer.appendChild(createFlightCard(flight));
  });

  if (tripType === "round-trip" && data.returnFlights?.length > 0) {
    data.returnFlights.forEach((flight) => {
      returnContainer.appendChild(createFlightCard(flight));
    });
  }
}

function showPortalPopup(flight) {
  const portals = ["MakeMyTrip", "Goibibo", "Yatra", "Cleartrip", "EaseMyTrip"];
  const basePrice = flight.price;
  const popup = document.createElement("div");
  popup.className = "portal-popup";

  popup.innerHTML = `
    <div class="popup-content">
      <h3>${flight.airline} ${flight.flightNumber}</h3>
      <ul>
        ${portals.map(p => `<li>${p}: ₹${basePrice + 100}</li>`).join("")}
      </ul>
      <button class="close-popup">Close</button>
    </div>
  `;

  popup.querySelector(".close-popup").addEventListener("click", () => {
    popup.remove();
  });

  document.body.appendChild(popup);
}
