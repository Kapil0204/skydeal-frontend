document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("search-form");
  const oneWayRadio = document.getElementById("oneWay");
  const roundTripRadio = document.getElementById("roundTrip");
  const returnDateInput = document.getElementById("returnDate");

  // Handle one-way vs round-trip toggle
  function toggleReturnDate() {
    returnDateInput.disabled = oneWayRadio.checked;
  }

  oneWayRadio.addEventListener("change", toggleReturnDate);
  roundTripRadio.addEventListener("change", toggleReturnDate);
  toggleReturnDate(); // initialize on load

  // Show/hide multi-select dropdown
  const paymentDropdown = document.getElementById("paymentDropdown");
  const paymentMethods = document.getElementById("paymentMethods");
  const selectedPayments = document.getElementById("selectedPayments");

  paymentDropdown.addEventListener("click", (e) => {
    e.stopPropagation();
    paymentMethods.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    paymentMethods.classList.remove("show");
  });

  // Update selected payment methods display
  paymentMethods.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const selected = Array.from(paymentMethods.querySelectorAll("input[type='checkbox']:checked"))
        .map(cb => cb.value)
        .join(", ");
      selectedPayments.value = selected || "Select Methods";
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const flyFrom = document.getElementById("from").value.trim();
    const to = document.getElementById("to").value.trim();
    const dateFrom = document.getElementById("departureDate").value;
    const dateTo = returnDateInput.disabled ? "" : returnDateInput.value;
    const travelClass = document.getElementById("travelClass").value;
    const adults = document.getElementById("passengers").value;
    const oneWay = oneWayRadio.checked;

    const selectedBanks = Array.from(paymentMethods.querySelectorAll("input[type='checkbox']:checked"))
      .map(cb => cb.value);

    const queryParams = new URLSearchParams({
      flyFrom,
      to,
      dateFrom,
      dateTo,
      travelClass,
      adults,
      oneWay
    });

    try {
      const response = await fetch(`https://skydeal-backend.onrender.com/kiwi?${queryParams}`);
      const data = await response.json();
      displayResults(data, selectedBanks);
    } catch (error) {
      alert("Failed to fetch flight data.");
      console.error(error);
    }
  });

  function displayResults(data, selectedBanks) {
    const outboundDiv = document.getElementById("outboundResults");
    const returnDiv = document.getElementById("returnResults");

    outboundDiv.innerHTML = "";
    returnDiv.innerHTML = "";

    data.outbound.forEach(flight => {
      outboundDiv.appendChild(createFlightCard(flight, selectedBanks));
    });

    if (!oneWayRadio.checked) {
      data.return.forEach(flight => {
        returnDiv.appendChild(createFlightCard(flight, selectedBanks));
      });
    }
  }

  function createFlightCard(flight, selectedBanks) {
    const card = document.createElement("div");
    card.className = "flight-card";

    const bestDeal = flight.portalDeals.find(deal =>
      selectedBanks.includes(deal.paymentMethod)
    ) || flight.portalDeals[0];

    card.innerHTML = `
      <strong>Flight:</strong> ${flight.name}<br>
      <strong>Departure:</strong> ${flight.departure}<br>
      <strong>Arrival:</strong> ${flight.arrival}<br>
      <strong>Best Deal:</strong> ${bestDeal.portal} – ${bestDeal.discount}% off (Use: ${bestDeal.code}) ₹${bestDeal.finalPrice}
      <button class="info-button" onclick="alert('Portal Price Breakdown Coming Soon')">i</button>
    `;

    return card;
  }
});
