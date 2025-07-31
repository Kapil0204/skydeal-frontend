document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");

  searchBtn.addEventListener("click", async () => {
    console.log("✅ Search button clicked");

    const from = document.getElementById("from").value.trim();
    const to = document.getElementById("to").value.trim();
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = document.getElementById("passengers").value;
    const travelClass = document.getElementById("travelClass").value;

    const tripType = document.querySelector('input[name="tripType"]:checked')?.value;

    // Collect selected payment methods
    const paymentMethods = Array.from(
      document.querySelectorAll('input[name="paymentMethod"]:checked')
    ).map(cb => cb.value);

    const payload = {
      from,
      to,
      departureDate,
      returnDate,
      passengers,
      travelClass,
      paymentMethods,
      tripType
    };

    console.log("📦 Sending payload:", payload);

    try {
      const res = await fetch("https://skydeal-backend.onrender.com/simulated-flights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      console.log("📨 Response received:", data);

      displayFlights(data.outboundFlights, "outbound");
      displayFlights(data.returnFlights || [], "return");
    } catch (error) {
      console.error("❌ Error fetching flights:", error);
      alert("Something went wrong. Please try again.");
    }
  });
});

function displayFlights(flights, type) {
  const containerId = type === "outbound" ? "outboundFlights" : "returnFlights";
  const container = document.getElementById(containerId);
  container.innerHTML = ""; // Clear previous

  if (!flights.length) {
    container.innerHTML = "<p>No flights found.</p>";
    return;
  }

  flights.forEach(flight => {
    const card = document.createElement("div");
    card.className = "flight-card";
    card.innerHTML = `
      <h4>${flight.flightName}</h4>
      <p><strong>Departure:</strong> ${flight.departure}</p>
      <p><strong>Arrival:</strong> ${flight.arrival}</p>
      ${flight.bestDeal ? `
        <p><strong>Best Deal:</strong> ${flight.bestDeal.portal}</p>
        <p><strong>Offer:</strong> ${flight.bestDeal.offer} (Code: ${flight.bestDeal.code})</p>
        <p><strong>Price:</strong> ₹${flight.bestDeal.price}</p>
      ` : `<p><em>No offer available for selected payment method</em></p>`}
    `;
    container.appendChild(card);
  });
}
