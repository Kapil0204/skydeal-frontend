document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");
  const flightContainer = document.getElementById("flightContainer");
  const outboundContainer = document.getElementById("outboundContainer");
  const returnContainer = document.getElementById("returnContainer");
  const sortSelect = document.getElementById("sortSelect");

  let currentOutbound = [];
  let currentReturn = [];

  searchBtn.addEventListener("click", async () => {
    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;
    const departureDate = document.getElementById("departure-date").value;
    const returnDate = document.getElementById("return-date").value;
    const passengers = document.getElementById("passengers").value;
    const travelClass = document.getElementById("travel-class").value.toUpperCase();
    const tripType = document.querySelector('input[name="tripType"]:checked').value;

    if (!from || !to || !departureDate || !passengers || !travelClass) {
      alert("Please fill in all required fields.");
      return;
    }

    const body = {
      from,
      to,
      departureDate,
      returnDate: tripType === "round-trip" ? returnDate : "",
      passengers,
      travelClass,
      tripType
    };

    try {
      const res = await fetch("https://skydeal-backend.onrender.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      currentOutbound = data.outboundFlights || [];
      currentReturn = data.returnFlights || [];

      renderFlights(currentOutbound, outboundContainer, "Outbound");
      renderFlights(currentReturn, returnContainer, "Return");

      sortSelect.style.display = "inline-block";
    } catch (err) {
      console.error("Search failed", err);
      alert("Failed to fetch flights");
    }
  });

  sortSelect.addEventListener("change", () => {
    const sortBy = sortSelect.value;
    currentOutbound = sortFlights(currentOutbound, sortBy);
    currentReturn = sortFlights(currentReturn, sortBy);
    renderFlights(currentOutbound, outboundContainer, "Outbound");
    renderFlights(currentReturn, returnContainer, "Return");
  });

  function sortFlights(flights, sortBy) {
    return flights.slice().sort((a, b) => {
      if (sortBy === "price") return a.price - b.price;
      if (sortBy === "departure") return a.departure.localeCompare(b.departure);
      return 0;
    });
  }

  function renderFlights(flights, container, label) {
    container.innerHTML = `<h3>${label} Flights</h3>`;
    if (!flights || flights.length === 0) {
      container.innerHTML += "<p>No flights available.</p>";
      return;
    }

    const grid = document.createElement("div");
    grid.className = "flight-grid";

    flights.forEach((flight, idx) => {
      const card = document.createElement("div");
      card.className = "flight-card";
      card.innerHTML = `
        <p><strong>${flight.airlineName} ${flight.flightNumber}</strong></p>
        <p>${flight.departure} → ${flight.arrival}</p>
        <p>Stops: ${flight.stops}</p>
        <p>Base Price: ₹${flight.price}</p>
        <button class="view-prices" data-price="${flight.price}" data-flight="${flight.flightNumber}">View OTA Prices</button>
      `;
      grid.appendChild(card);
    });

    container.appendChild(grid);

    document.querySelectorAll(".view-prices").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const price = parseFloat(e.target.getAttribute("data-price"));
        const flightNumber = e.target.getAttribute("data-flight");
        showModal(price, flightNumber);
      });
    });
  }

  function showModal(basePrice, flightNumber) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal">
        <h2>OTA Prices for ${flightNumber}</h2>
        <ul>
          <li>MakeMyTrip: ₹${basePrice + 100}</li>
          <li>Goibibo: ₹${basePrice + 100}</li>
          <li>Cleartrip: ₹${basePrice + 100}</li>
          <li>EaseMyTrip: ₹${basePrice + 100}</li>
          <li>Yatra: ₹${basePrice + 100}</li>
        </ul>
        <button id="closeModal">Close</button>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById("closeModal").addEventListener("click", () => {
      modal.remove();
    });
  }
});
