document.getElementById("flight-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  const flyFrom = document.getElementById("from").value;
  const flyTo = document.getElementById("to").value;
  const date = document.getElementById("date").value;
  const returnDate = document.getElementById("returnDate").value;
  const oneWay = document.getElementById("oneWay").checked;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travelClass").value;
  const paymentMethods = Array.from(
    document.getElementById("paymentMethods").selectedOptions
  ).map((opt) => opt.value);

  const url = "https://skydeal-backend.onrender.com/simulated";

  document.getElementById("results").innerHTML = "<p>Searching...</p>";

  try {
    const response = await fetch(url);
    const data = await response.json();

    const bestDeals = {};
    data.offers.forEach((offer) => {
      offer.payment_methods.forEach((method) => {
        if (!bestDeals[offer.portal]) bestDeals[offer.portal] = {};
        bestDeals[offer.portal][method] = offer;
      });
    });

    const getBestPortal = (price) => {
      for (const portal in bestDeals) {
        for (const method of paymentMethods) {
          if (bestDeals[portal][method]) {
            const offer = bestDeals[portal][method];
            const discountedPrice = price - price * (offer.discount / 100);
            return {
              portal,
              discount: offer.discount,
              code: offer.code,
              final: discountedPrice.toFixed(0),
            };
          }
        }
      }
      return null;
    };

    const outboundHTML = data.flights
      .filter((f) => f.type === "outbound")
      .map((flight) => {
        const deal = getBestPortal(flight.price);
        return `
        <div class="flight-card">
          <strong>${flight.airline}</strong><br>
          ${flight.from} → ${flight.to}<br>
          Departure: ${flight.departure} | Arrival: ${flight.arrival}<br>
          ${
            deal
              ? `<strong>Best Deal:</strong> ₹${deal.final} on ${deal.portal} (${deal.discount}% off - Code: ${deal.code})`
              : "No applicable offers"
          }
          <button class="info-button" onclick="showOfferModal('${flight.airline}', '${flight.price}')">i</button>
        </div>`;
      })
      .join("");

    const returnHTML = data.flights
      .filter((f) => f.type === "return")
      .map((flight) => {
        const deal = getBestPortal(flight.price);
        return `
        <div class="flight-card">
          <strong>${flight.airline}</strong><br>
          ${flight.from} → ${flight.to}<br>
          Departure: ${flight.departure} | Arrival: ${flight.arrival}<br>
          ${
            deal
              ? `<strong>Best Deal:</strong> ₹${deal.final} on ${deal.portal} (${deal.discount}% off - Code: ${deal.code})`
              : "No applicable offers"
          }
          <button class="info-button" onclick="showOfferModal('${flight.airline}', '${flight.price}')">i</button>
        </div>`;
      })
      .join("");

    document.getElementById("results").innerHTML = `
      <div class="column">
        <h3>Outbound Flights</h3>
        ${outboundHTML || "<p>No outbound flights found.</p>"}
      </div>
      <div class="column">
        <h3>Return Flights</h3>
        ${returnHTML || "<p>No return flights found.</p>"}
      </div>`;
  } catch (error) {
    console.error("Error:", error);
    document.getElementById("results").innerHTML =
      "<p>Failed to fetch flight data.</p>";
  }
});

function showOfferModal(airline, price) {
  alert(`Portal-wise comparison coming soon for ${airline} at ₹${price}`);
}
