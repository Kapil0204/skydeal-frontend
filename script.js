document.addEventListener("DOMContentLoaded", function () {
  const tripTypeRadios = document.getElementsByName("tripType");
  const returnDateInput = document.getElementById("returnDate");
  const paymentSelect = document.getElementById("paymentMethods");
  const dropdown = document.getElementById("paymentDropdown");
  const checkboxes = dropdown.querySelectorAll("input[type=checkbox]");
  const searchBtn = document.getElementById("searchBtn");

  // Toggle return date input visibility
  tripTypeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (document.getElementById("roundTrip").checked) {
        returnDateInput.style.display = "block";
      } else {
        returnDateInput.style.display = "none";
      }
    });
  });

  // Toggle dropdown visibility
  paymentSelect.addEventListener("click", function () {
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
  });

  // Update text input based on selected checkboxes
  checkboxes.forEach(function (checkbox) {
    checkbox.addEventListener("change", function () {
      const selected = Array.from(checkboxes)
        .filter(i => i.checked)
        .map(i => i.value);
      paymentSelect.value = selected.join(", ");
    });
  });

  // Search handler
  searchBtn.addEventListener("click", async function () {
    const origin = document.getElementById("from").value;
    const destination = document.getElementById("to").value;
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = document.getElementById("passengers").value;
    const travelClass = document.getElementById("travelClass").value;
    const paymentMethods = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    const isRoundTrip = document.getElementById("roundTrip").checked;

    // Fetch outbound flights
    try {
      const response = await fetch("https://skydeal-backend.onrender.com/simulated-flights");
      const data = await response.json();
      displayFlights(data.outbound, "outboundResults", paymentMethods);
      displayFlights(isRoundTrip ? data.return : [], "returnResults", paymentMethods);
    } catch (error) {
      console.error("Error fetching flight data:", error);
    }
  });

  function displayFlights(flights, containerId, paymentMethods) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    flights.forEach(flight => {
      const card = document.createElement("div");
      card.className = "flight-card";
      const bestOffer = flight.offers.find(o => paymentMethods.includes(o.method));
      const offerText = bestOffer
        ? `Best Deal: ${bestOffer.portal} – ${bestOffer.discount} (Use: ${bestOffer.code}) ₹${bestOffer.price}`
        : "No matching deal for selected payment method.";

      card.innerHTML = `
        <p><strong>Flight:</strong> ${flight.name}</p>
        <p><strong>Departure:</strong> ${flight.departure}</p>
        <p><strong>Arrival:</strong> ${flight.arrival}</p>
        <p><strong>${offerText}</strong></p>
      `;
      container.appendChild(card);
    });
  }
});
