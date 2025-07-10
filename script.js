const form = document.getElementById("flightForm");
const outboundContainer = document.getElementById("outboundFlights");
const returnContainer = document.getElementById("returnFlights");
const returnDateDiv = document.getElementById("returnDateDiv");
const oneWayRadio = document.getElementById("oneWay");
const roundTripRadio = document.getElementById("roundTrip");
const returnDateInput = document.getElementById("returnDate");
const paymentDropdown = document.getElementById("paymentDropdown");
const paymentOptions = document.getElementById("paymentOptions");
const paymentMethodInput = document.getElementById("paymentMethodInput");

const paymentMethods = ["ICICI Bank", "HDFC Bank", "SBI", "Axis Bank", "Kotak Bank"];

let selectedMethods = [];

paymentMethods.forEach(method => {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = method;
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedMethods.push(method);
    } else {
      selectedMethods = selectedMethods.filter(m => m !== method);
    }
    paymentMethodInput.value = selectedMethods.join(", ");
  });
  label.appendChild(checkbox);
  label.append(` ${method}`);
  paymentOptions.appendChild(label);
});

paymentDropdown.addEventListener("click", (e) => {
  e.stopPropagation();
  paymentOptions.style.display = "block";
});

document.addEventListener("click", () => {
  paymentOptions.style.display = "none";
});

oneWayRadio.addEventListener("change", () => {
  returnDateDiv.style.display = "none";
});

roundTripRadio.addEventListener("change", () => {
  returnDateDiv.style.display = "flex";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  outboundContainer.innerHTML = "";
  returnContainer.innerHTML = "";

  const flyFrom = document.getElementById("flyFrom").value;
  const to = document.getElementById("to").value;
  const dateFrom = document.getElementById("dateFrom").value;
  const dateTo = document.getElementById("returnDate").value;
  const adults = document.getElementById("adults").value;
  const travelClass = document.getElementById("travelClass").value;
  const isRoundTrip = roundTripRadio.checked;

  const selected = selectedMethods;

  // Simulate response
  const flights = [
    { name: "IndiGo", dep: "08:30", arr: "10:45", basePrice: 5000 },
    { name: "Air India", dep: "09:00", arr: "11:20", basePrice: 4900 },
    { name: "SpiceJet", dep: "13:15", arr: "15:30", basePrice: 5200 }
  ];

  const getBestDeal = (basePrice) => {
    const bank = selected[0] || "ICICI Bank";
    const code = bank.includes("ICICI") ? "SKYICICI10" : "SKYDEAL10";
    const discount = bank.includes("ICICI") ? 10 : 5;
    const discountedPrice = Math.round(basePrice * (1 - discount / 100));
    return {
      portal: "MakeMyTrip",
      discount,
      code,
      finalPrice: `₹${discountedPrice}`
    };
  };

  const createFlightCard = (flight) => {
    const deal = getBestDeal(flight.basePrice);
    const card = document.createElement("div");
    card.className = "flight-card";
    card.innerHTML = `
      <p><strong>Flight:</strong> ${flight.name}</p>
      <p><strong>Departure:</strong> ${flight.dep}</p>
      <p><strong>Arrival:</strong> ${flight.arr}</p>
      <p><strong>Best Deal:</strong> ${deal.portal} – ${deal.discount}% off (Use: ${deal.code}) ${deal.finalPrice}
        <button class="info-button" onclick="alert('View on ${deal.portal}')">i</button>
      </p>
    `;
    return card;
  };

  flights.forEach(flight => {
    outboundContainer.appendChild(createFlightCard(flight));
    if (isRoundTrip) {
      returnContainer.appendChild(createFlightCard(flight));
    }
  });
});
