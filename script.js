document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");
  const tripTypeRadios = document.getElementsByName("tripType");
  const returnDateGroup = document.getElementById("returnDateGroup");
  const outboundContainer = document.getElementById("outboundContainer");
  const returnContainer = document.getElementById("returnContainer");
  const filtersContainer = document.getElementById("filtersContainer");

  tripTypeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (document.querySelector('input[name="tripType"]:checked').value === "round-trip") {
        returnDateGroup.style.display = "block";
      } else {
        returnDateGroup.style.display = "none";
      }
    });
  });

  searchBtn.addEventListener("click", async () => {
    const from = document.getElementById("fromInput").value.trim();
    const to = document.getElementById("toInput").value.trim();
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = document.getElementById("passengers").value;
    const travelClass = document.getElementById("travelClass").value;
    const tripType = document.querySelector('input[name="tripType"]:checked').value;

    if (!from || !to || !departureDate || !passengers || !travelClass) {
      alert("Please fill in all required fields.");
      return;
    }

    const response = await fetch("https://skydeal-backend.onrender.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, departureDate, returnDate, passengers, travelClass, tripType }),
    });

    const data = await response.json();
    displayFlights(data.outboundFlights, data.returnFlights);
    filtersContainer.style.display = "flex"; // Show filters only after search
  });

  function displayFlights(outboundFlights, returnFlights) {
    outboundContainer.innerHTML = "";
    returnContainer.innerHTML = "";

    outboundFlights.forEach(flight => {
      outboundContainer.appendChild(createFlightCard(flight));
    });

    returnFlights.forEach(flight => {
      returnContainer.appendChild(createFlightCard(flight));
    });
  }

  function createFlightCard(flight) {
    const card = document.createElement("div");
    card.className = "flight-card";

    card.innerHTML = `
      <strong>${flight.flightNumber || "Unknown Flight"} (${flight.airlineName || "Airline"})</strong><br>
      Departure: ${flight.departure}<br>
      Arrival: ${flight.arrival}<br>
      Stops: ${flight.stops}<br>
      Price: ₹${Number(flight.price).toFixed(2)}<br>
      <button class="view-otas-btn">View on OTAs</button>
    `;

    const button = card.querySelector(".view-otas-btn");
    button.addEventListener("click", () => {
      showOTAModal(flight);
    });

    return card;
  }

  function showOTAModal(flight) {
    const modal = document.createElement("div");
    modal.className = "ota-modal";

    const closeBtn = document.createElement("span");
    closeBtn.className = "close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = () => modal.remove();

    modal.innerHTML = `
      <div class="modal-content">
        <h3>Prices for ${flight.flightNumber}</h3>
        <ul>
          <li>MakeMyTrip: ₹${Number(flight.price) + 100}</li>
          <li>Goibibo: ₹${Number(flight.price) + 100}</li>
          <li>EaseMyTrip: ₹${Number(flight.price) + 100}</li>
          <li>Cleartrip: ₹${Number(flight.price) + 100}</li>
          <li>Yatra: ₹${Number(flight.price) + 100}</li>
        </ul>
      </div>
    `;

    modal.querySelector(".modal-content").prepend(closeBtn);
    document.body.appendChild(modal);
  }

  // Sorting logic
  const sortSelect = document.getElementById("sortSelect");
  sortSelect.addEventListener("change", () => {
    const criteria = sortSelect.value;
    const outboundCards = [...outboundContainer.children];
    const returnCards = [...returnContainer.children];

    const sortFn = (a, b) => {
      const valA = extractSortValue(a, criteria);
      const valB = extractSortValue(b, criteria);
      return valA - valB;
    };

    outboundCards.sort(sortFn);
    returnCards.sort(sortFn);

    outboundContainer.innerHTML = "";
    returnContainer.innerHTML = "";
    outboundCards.forEach(card => outboundContainer.appendChild(card));
    returnCards.forEach(card => returnContainer.appendChild(card));
  });

  function extractSortValue(card, criteria) {
    const text = card.innerText;
    if (criteria === "price") {
      const match = text.match(/Price: ₹(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : 0;
    } else if (criteria === "departure") {
      const match = text.match(/Departure: (\d{2}):(\d{2})/);
      return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
    }
    return 0;
  }
});
