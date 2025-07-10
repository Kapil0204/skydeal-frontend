document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");
  const form = document.getElementById("flightForm");
  const returnDateInput = document.getElementById("returnDate");
  const oneWayRadio = document.getElementById("oneWay");
  const roundTripRadio = document.getElementById("roundTrip");
  const paymentInput = document.getElementById("paymentMethodInput");
  const paymentOptions = document.getElementById("paymentOptions");
  const outboundResults = document.getElementById("outboundResults");
  const returnResults = document.getElementById("returnResults");

  // Handle payment dropdown toggle
  paymentInput.addEventListener("click", (e) => {
    e.stopPropagation();
    paymentOptions.style.display =
      paymentOptions.style.display === "block" ? "none" : "block";
  });

  // Close dropdown on outside click
  document.addEventListener("click", () => {
    paymentOptions.style.display = "none";
  });

  // Update selected methods in input
  const checkboxes = paymentOptions.querySelectorAll("input[type='checkbox']");
  checkboxes.forEach((checkbox) =>
    checkbox.addEventListener("change", () => {
      const selected = Array.from(checkboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
      paymentInput.value = selected.join(", ");
    })
  );

  // Handle One Way vs Round Trip toggle
  oneWayRadio.addEventListener("change", () => {
    returnDateInput.disabled = oneWayRadio.checked;
  });
  roundTripRadio.addEventListener("change", () => {
    returnDateInput.disabled = !roundTripRadio.checked;
  });

  // Handle Search
  searchBtn.addEventListener("click", (e) => {
    e.preventDefault();

    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = document.getElementById("passengers").value;
    const travelClass = document.getElementById("travelClass").value;
    const paymentMethods = paymentInput.value.split(",").map((s) => s.trim());

    const isRoundTrip = roundTripRadio.checked;

    // Dummy flight data
    const flights = [
      {
        name: "IndiGo",
        departure: "08:30",
        arrival: "10:45",
        offers: {
          "HDFC Bank": { portal: "MakeMyTrip", discount: "10%", code: "SKYHDFC10", price: 4700 },
          "SBI": { portal: "EaseMyTrip", discount: "5%", code: "SKYSBI5", price: 4900 },
        },
      },
      {
        name: "Air India",
        departure: "09:00",
        arrival: "11:20",
        offers: {
          "ICICI Bank": { portal: "Goibibo", discount: "7%", code: "SKYICICI7", price: 4800 },
          "HDFC Bank": { portal: "MakeMyTrip", discount: "10%", code: "SKYHDFC10", price: 4750 },
        },
      },
      {
        name: "SpiceJet",
        departure: "13:15",
        arrival: "15:30",
        offers: {
          "Axis Bank": { portal: "EaseMyTrip", discount: "8%", code: "SKYAXIS8", price: 4600 },
        },
      },
    ];

    function renderFlights(container, direction) {
      container.innerHTML = "";
      flights.forEach((flight) => {
        let bestOffer = null;
        for (const method of paymentMethods) {
          if (flight.offers[method]) {
            bestOffer = { ...flight.offers[method], method };
            break;
          }
        }

        const card = document.createElement("div");
        card.className = "flight-card";
        card.innerHTML = `
          <p><strong>Flight:</strong> ${flight.name}</p>
          <p><strong>Departure:</strong> ${flight.departure}</p>
          <p><strong>Arrival:</strong> ${flight.arrival}</p>
          ${
            bestOffer
              ? `<p><strong>Best Deal:</strong> ${bestOffer.portal} – ${bestOffer.discount} off (Use: ${bestOffer.code}) ₹${bestOffer.price} <span class="info-btn" onclick="alert('Prices across portals:\n${Object.entries(flight.offers).map(([bank, offer]) => `${bank}: ${offer.portal} ₹${offer.price} (${offer.discount} off)`).join('\n')}')">ℹ️</span></p>`
              : "<p><em>No matching offer for selected payment methods.</em></p>"
          }
        `;
        container.appendChild(card);
      });
    }

    renderFlights(outboundResults, "outbound");
    if (isRoundTrip) renderFlights(returnResults, "return");
    else returnResults.innerHTML = "";
  });
});
