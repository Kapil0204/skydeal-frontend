const form = document.getElementById("searchForm");
const outboundResults = document.getElementById("outboundResults");
const returnResults = document.getElementById("returnResults");

const paymentDropdown = document.getElementById("paymentDropdown");
const selectBox = document.getElementById("selectBox");
const checkboxes = document.getElementById("checkboxes");

selectBox.addEventListener("click", () => {
  checkboxes.classList.toggle("hidden");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const from = document.getElementById("from").value.trim();
  const to = document.getElementById("to").value.trim();
  const departureDate = document.getElementById("departureDate").value;
  const returnDate = document.getElementById("returnDate").value;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travelClass").value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const selectedMethods = Array.from(
    checkboxes.querySelectorAll("input:checked")
  ).map((input) => input.value);

  const payload = {
    from,
    to,
    departureDate,
    returnDate,
    passengers,
    travelClass,
    tripType,
    paymentMethods: selectedMethods
  };

  const response = await fetch("https://skydeal-backend.onrender.com/simulated-flights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  renderResults(data);
});

function renderResults(data) {
  outboundResults.innerHTML = "";
  returnResults.innerHTML = "";

  data.outbound.forEach((flight) => {
    outboundResults.innerHTML += flightCard(flight);
  });

  if (data.return && data.return.length > 0) {
    data.return.forEach((flight) => {
      returnResults.innerHTML += flightCard(flight);
    });
  }
}

function flightCard(flight) {
  return `
    <div class="flight-card">
      <p><strong>Flight:</strong> ${flight.name}</p>
      <p><strong>Departure:</strong> ${flight.departureTime}</p>
      <p><strong>Arrival:</strong> ${flight.arrivalTime}</p>
      <p><strong>Best Deal:</strong> ${flight.bestDeal.portal} – ${flight.bestDeal.discount} (Use: ${flight.bestDeal.code}) ₹${flight.bestDeal.finalPrice}
        <span class="info-icon" onclick="alert('Portal-wise price comparison popup (simulated)')">ℹ️</span>
      </p>
    </div>`;
}
