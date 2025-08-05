document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("flight-search-form");
  const returnDateGroup = document.getElementById("return-date-group");
  const tripTypeInputs = document.getElementsByName("tripType");
  const outboundResults = document.getElementById("outbound-results");
  const returnResults = document.getElementById("return-results");
  const sortSelect = document.getElementById("sort-select");

  // Toggle return date input
  tripTypeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      returnDateGroup.style.display = input.value === "round-trip" ? "block" : "none";
    });
  });

  // Handle form submission
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;
    const departureDate = document.getElementById("departure-date").value;
    const returnDate = document.getElementById("return-date").value;
    const passengers = parseInt(document.getElementById("passengers").value);
    const travelClass = document.getElementById("travel-class").value;
    const tripType = document.querySelector('input[name="tripType"]:checked').value;

    const payload = { from, to, departureDate, returnDate, passengers, travelClass, tripType };

    try {
      const res = await fetch("https://skydeal-backend.onrender.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      displayFlights(data.outboundFlights, outboundResults);
      displayFlights(data.returnFlights, returnResults);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  });

  // Sort dropdown
  sortSelect.addEventListener("change", () => {
    const sortBy = sortSelect.value;
    sortFlights(outboundResults, sortBy);
    sortFlights(returnResults, sortBy);
  });

  function displayFlights(flights, container) {
    container.innerHTML = "";

    if (!flights || flights.length === 0) {
      container.innerHTML = "<p>No flights found.</p>";
      return;
    }

    flights.forEach((flight) => {
      const card = document.createElement("div");
      card.className = "flight-card";
      card.innerHTML = `
        <p><strong>${flight.flightNumber}</strong></p>
        <p>Departure: ${flight.departure}</p>
        <p>Arrival: ${flight.arrival}</p>
        <p>Stops: ${flight.stops === 0 ? 'Non-stop' : flight.stops}</p>
        <p>Price: ₹${flight.price}</p>
        <button onclick="alertPricing(${flight.price})">View on OTAs</button>
      `;
      container.appendChild(card);
    });
  }

  // Alert popup pricing
  window.alertPricing = function (basePrice) {
    let msg = `Base Price: ₹${basePrice}\n`;
    const portals = ["MakeMyTrip", "Goibibo", "Cleartrip", "EaseMyTrip", "Yatra"];
    portals.forEach((p) => {
      msg += `\n${p}: ₹${parseInt(basePrice) + 100}`;
    });
    alert(msg);
  };

  function sortFlights(container, criteria) {
    const cards = Array.from(container.querySelectorAll(".flight-card"));
    cards.sort((a, b) => {
      const getValue = (card, label) => parseInt(card.querySelector(`p:contains(${label})`).textContent.split(": ₹")[1]);
      if (criteria === "price") {
        return getValue(a, "Price") - getValue(b, "Price");
      } else if (criteria === "departure") {
        return a.querySelector("p:nth-child(2)").textContent.localeCompare(b.querySelector("p:nth-child(2)").textContent);
      } else {
        return 0;
      }
    });
    container.innerHTML = "";
    cards.forEach(card => container.appendChild(card));
  }
});

