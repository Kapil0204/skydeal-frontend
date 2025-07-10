// Handle trip type radio toggle
document.getElementById("oneWay").addEventListener("change", () => {
  document.getElementById("returnDate").disabled = true;
});
document.getElementById("roundTrip").addEventListener("change", () => {
  document.getElementById("returnDate").disabled = false;
});

// Payment method dropdown logic
const paymentInput = document.getElementById("paymentMethods");
const paymentDropdown = document.getElementById("paymentDropdown");

paymentInput.addEventListener("click", () => {
  paymentDropdown.style.display =
    paymentDropdown.style.display === "block" ? "none" : "block";
});

// Update input with selected methods
paymentDropdown.addEventListener("change", () => {
  const selected = Array.from(
    paymentDropdown.querySelectorAll("input:checked")
  ).map((cb) => cb.value);
  paymentInput.value = selected.join(", ");
});

// Hide dropdown if clicked outside
document.addEventListener("click", (e) => {
  if (!paymentDropdown.contains(e.target) && e.target !== paymentInput) {
    paymentDropdown.style.display = "none";
  }
});

// Handle Search
document.getElementById("searchBtn").addEventListener("click", () => {
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const departureDate = document.getElementById("departureDate").value;
  const returnDate = document.getElementById("returnDate").value;
  const isRoundTrip = document.getElementById("roundTrip").checked;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travelClass").value;
  const paymentMethods = document.getElementById("paymentMethods").value
    .split(", ")
    .filter(Boolean);

  const payload = {
    from,
    to,
    departureDate,
    returnDate: isRoundTrip ? returnDate : null,
    passengers,
    travelClass,
    paymentMethods,
    tripType: isRoundTrip ? "roundTrip" : "oneWay",
  };

  fetch("https://skydeal-backend.onrender.com/simulated-flights", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      renderResults(data);
    })
    .catch((err) => {
      console.error("Error:", err);
      alert("Something went wrong. Please try again.");
    });
});

function renderResults(data) {
  const outbound = document.getElementById("outboundResults");
  const ret = document.getElementById("returnResults");
  outbound.innerHTML = "";
  ret.innerHTML = "";

  data.outbound.forEach((flight) => {
    outbound.innerHTML += createFlightCard(flight);
  });

  if (data.return) {
    data.return.forEach((flight) => {
      ret.innerHTML += createFlightCard(flight);
    });
  }
}

function createFlightCard(flight) {
  const modalId = `modal-${Math.random().toString(36).substring(2, 9)}`;
  return `
    <div class="flight-card">
      <strong>Flight:</strong> ${flight.airline}<br />
      <strong>Departure:</strong> ${flight.departure}<br />
      <strong>Arrival:</strong> ${flight.arrival}<br />
      <strong>Best Deal:</strong> ${flight.bestDeal.portal} – ${flight.bestDeal.offer} (Use: ${flight.bestDeal.code}) ₹${flight.bestDeal.price}
      <button class="info-btn" onclick="showModal('${modalId}')">i</button>

      <div class="modal" id="${modalId}">
        <div class="modal-content">
          <span class="close" onclick="closeModal('${modalId}')">&times;</span>
          <h4>Portal-wise Pricing</h4>
          <ul>
            <li>MakeMyTrip: ₹4900</li>
            <li>Goibibo: ₹5100</li>
            <li>Yatra: ₹5000</li>
            <li>EaseMyTrip: ₹4800</li>
            <li>Cleartrip: ₹4700</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}
function showModal(id) {
  document.getElementById(id).style.display = "block";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

