document.addEventListener("DOMContentLoaded", () => {
  const paymentOptions = document.getElementById("paymentOptions");
  const paymentInput = document.getElementById("paymentMethodInput");

  const paymentMethods = ["ICICI Bank", "HDFC Bank", "SBI", "Axis Bank", "Kotak Bank"];

  // Populate checkboxes
  paymentOptions.innerHTML = paymentMethods.map(method => `
    <label><input type="checkbox" value="${method}"> ${method}</label>
  `).join("");

  // Toggle dropdown
  paymentInput.addEventListener("click", (e) => {
    e.stopPropagation();
    paymentOptions.style.display = paymentOptions.style.display === "block" ? "none" : "block";
  });

  // Update input value based on selected checkboxes
  paymentOptions.addEventListener("change", () => {
    const selected = Array.from(paymentOptions.querySelectorAll("input:checked"))
                          .map(cb => cb.value);
    paymentInput.value = selected.join(", ");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    paymentOptions.style.display = "none";
  });

  // Submit handler for Search
  document.getElementById("flightForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const flyFrom = document.getElementById("flyFrom").value;
    const to = document.getElementById("to").value;
    const dateFrom = document.getElementById("dateFrom").value;
    const returnDate = document.getElementById("returnDate").value;
    const adults = document.getElementById("adults").value;
    const travelClass = document.getElementById("travelClass").value;
    const selectedPayments = paymentInput.value.split(",").map(p => p.trim());
    const isRoundTrip = document.getElementById("roundTrip").checked;

    const requestBody = {
      flyFrom,
      to,
      dateFrom,
      returnDate,
      adults,
      travelClass,
      paymentMethods: selectedPayments,
      roundTrip: isRoundTrip
    };

    const response = await fetch("https://skydeal-backend.onrender.com/flights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    renderFlights(data);
  });

  function renderFlights(data) {
    const outboundContainer = document.getElementById("outboundFlights");
    const returnContainer = document.getElementById("returnFlights");
    outboundContainer.innerHTML = "";
    returnContainer.innerHTML = "";

    data.outboundFlights.forEach(flight => {
      outboundContainer.innerHTML += renderFlightCard(flight);
    });

    if (data.returnFlights) {
      data.returnFlights.forEach(flight => {
        returnContainer.innerHTML += renderFlightCard(flight);
      });
    }
  }

  function renderFlightCard(flight) {
    return `
      <div class="flight-card">
        <p><strong>Flight:</strong> ${flight.flightName}</p>
        <p><strong>Departure:</strong> ${flight.departureTime}</p>
        <p><strong>Arrival:</strong> ${flight.arrivalTime}</p>
        <p><strong>Best Deal:</strong> ${flight.bestPortal} – ${flight.discount} (Use: ${flight.code}) ₹${flight.price}
          <span class="info-btn" onclick="alert('${flight.bestPortal} prices: ...')">ℹ️</span>
        </p>
      </div>
    `;
  }
});
