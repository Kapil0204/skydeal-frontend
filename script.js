document.addEventListener("DOMContentLoaded", () => {
  // 🔁 All your existing script.js code goes here
});
const searchButton = document.getElementById("search-button");
const outboundContainer = document.getElementById("outbound-flights");
const returnContainer = document.getElementById("return-flights");
const sortSelect = document.getElementById("sort");
const filterBar = document.getElementById("filter-bar");

// Modal elements
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modal-content");
const closeModal = document.getElementById("close-modal");

const API_BASE = "https://skydeal-backend.onrender.com/search";

// Event listeners
searchButton.addEventListener("click", async () => {
  const from = document.getElementById("origin").value.trim().toUpperCase();
  const to = document.getElementById("destination").value.trim().toUpperCase();
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travel-class").value;
  const tripType = document.querySelector('input[name="trip-type"]:checked').value;

  if (!from || !to || !departureDate) {
    alert("Please fill in all required fields.");
    return;
  }

  const payload = {
    from,
    to,
    departureDate,
    returnDate,
    passengers,
    travelClass,
    tripType,
  };

  try {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data || (!data.outboundFlights.length && !data.returnFlights.length)) {
      outboundContainer.innerHTML = "<p>No outbound flights found.</p>";
      returnContainer.innerHTML = "<p>No return flights found.</p>";
    } else {
      displayFlights(data.outboundFlights, outboundContainer, "outbound");
      displayFlights(data.returnFlights, returnContainer, "return");

      // Show filter bar after successful search
      filterBar.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Search error:", error);
    alert("Failed to fetch flights.");
  }
});

// Sorting functionality
sortSelect.addEventListener("change", () => {
  const type = sortSelect.value;
  sortAndRedisplay("outbound", type);
  sortAndRedisplay("return", type);
});

function sortAndRedisplay(type, sortBy) {
  const container = type === "outbound" ? outboundContainer : returnContainer;
  const cards = Array.from(container.querySelectorAll(".flight-card"));

  const sorted = cards.sort((a, b) => {
    const aVal = sortBy === "price"
      ? parseFloat(a.getAttribute("data-price"))
      : a.getAttribute("data-departure");

    const bVal = sortBy === "price"
      ? parseFloat(b.getAttribute("data-price"))
      : b.getAttribute("data-departure");

    return sortBy === "price"
      ? aVal - bVal
      : aVal.localeCompare(bVal); // string comparison for time
  });

  container.innerHTML = "";
  sorted.forEach(card => container.appendChild(card));
}

function displayFlights(flights, container, type) {
  container.innerHTML = "";

  flights.forEach((flight) => {
    const card = document.createElement("div");
    card.className = "flight-card";
    card.setAttribute("data-price", flight.price || 0);
    card.setAttribute("data-departure", flight.departure || "00:00");

    card.innerHTML = `
      <strong>${flight.flightNumber || "Flight"} (${flight.airline || "Unknown"})</strong><br />
      Departure: ${flight.departure}<br />
      Arrival: ${flight.arrival}<br />
      Stops: ${flight.stops}<br />
      Price: ₹${flight.price}<br />
      <button class="ota-button">View on OTAs</button>
    `;

    // Add click listener for modal
    card.querySelector(".ota-button").addEventListener("click", () => {
      showOTAModal(flight);
    });

    container.appendChild(card);
  });
}

function showOTAModal(flight) {
  modalContent.innerHTML = `
    <span id="close-modal" class="close-button">&times;</span>
    <h3>Prices for ${flight.flightNumber}</h3>
    <ul>
      <li>MakeMyTrip: ₹${flight.price + 100}</li>
      <li>Goibibo: ₹${flight.price + 100}</li>
      <li>EaseMyTrip: ₹${flight.price + 100}</li>
      <li>Cleartrip: ₹${flight.price + 100}</li>
      <li>Yatra: ₹${flight.price + 100}</li>
    </ul>
  `;
  modal.style.display = "block";

  document.getElementById("close-modal").addEventListener("click", () => {
    modal.style.display = "none";
  });
}

window.onclick = function (event) {
  if (event.target === modal) {
    modal.style.display = "none";
  }
};
