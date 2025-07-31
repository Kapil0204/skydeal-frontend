document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("search-form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;
    const departureDate = document.getElementById("departure-date").value;
    const returnDate = document.getElementById("return-date").value;
    const passengers = document.getElementById("passengers").value;
    const travelClass = document.getElementById("travel-class").value;
    const paymentMethodsRaw = document.getElementById("payment-methods").value;
    const paymentMethods = paymentMethodsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tripType = document.querySelector("input[name='tripType']:checked").value;

    const payload = {
      from,
      to,
      departureDate,
      returnDate,
      passengers,
      travelClass,
      paymentMethods,
      tripType,
    };

    try {
      const response = await fetch("https://skydeal-backend.onrender.com/simulated-flights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      renderFlights("outbound-flights", data.outboundFlights);
      renderFlights("return-flights", data.returnFlights);
    } catch (err) {
      console.error("❌ Error fetching flights:", err);
    }
  });

  function renderFlights(containerId, flights) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!flights || flights.length === 0) {
      container.innerHTML = "<p>No flights found.</p>";
      return;
    }

    container.innerHTML = flights
      .map(
        (flight) => `
        <div>
          ✈️ <strong>${flight.flightName}</strong><br/>
          ⏰ ${flight.departure} → ${flight.arrival}<br/>
          💸 Best Deal: ${flight.bestDeal ? `${flight.bestDeal.portal} - ${flight.bestDeal.offer} (Code: ${flight.bestDeal.code}) ₹${flight.bestDeal.price}` : "N/A"}
        </div><hr/>
      `
      )
      .join("");
  }
});
