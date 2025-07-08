const API_URL = "https://skydeal-backend-live.onrender.com";

document.getElementById("payment-toggle").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("payment-dropdown").classList.toggle("show");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown") && !e.target.closest("#payment-toggle")) {
    document.getElementById("payment-dropdown").classList.remove("show");
  }
});

document.getElementById("search-button").addEventListener("click", async () => {
  const origin = document.getElementById("origin").value;
  const destination = document.getElementById("destination").value;
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const passengers = document.getElementById("passengers").value || 1;
  const travelClass = document.getElementById("travel-class").value;
  const tripType = document.getElementById("trip-type").value;

  if (!origin || !destination || !departureDate) {
    alert("Please fill in all required fields.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/search?origin=${origin}&destination=${destination}&departureDate=${departureDate}&returnDate=${returnDate}&adults=${passengers}&travelClass=${travelClass}&tripType=${tripType}`);
    const data = await res.json();

    document.getElementById("results-container").style.display = "flex";
    displayFlights("outbound", data.outbound);
    displayFlights("return", data.returning);
  } catch (error) {
    console.error(error);
    alert("Failed to fetch flight data.");
  }
});

function displayFlights(type, flights) {
  const flightContainer = document.getElementById(`${type}-flights`);
  const filterContainer = document.getElementById(`${type}-filters`);
  flightContainer.innerHTML = "";
  filterContainer.innerHTML = "";

  if (!flights || flights.length === 0) {
    flightContainer.innerHTML = "<p>No flights available</p>";
    return;
  }

  const airlines = [...new Set(flights.map(f => f.airline))];
  const airlineSelect = document.createElement("select");
  airlineSelect.innerHTML = `<option value="">All Airlines</option>` +
    airlines.map(a => `<option value="${a}">${a}</option>`).join("");

  const timeSelect = document.createElement("select");
  timeSelect.innerHTML = `
    <option value="">All Times</option>
    <option value="morning">Morning (5AM–12PM)</option>
    <option value="afternoon">Afternoon (12PM–5PM)</option>
    <option value="evening">Evening (5PM–9PM)</option>
    <option value="night">Night (9PM–5AM)</option>
  `;

  airlineSelect.addEventListener("change", () => renderFlights(type, flights, airlineSelect.value, timeSelect.value));
  timeSelect.addEventListener("change", () => renderFlights(type, flights, airlineSelect.value, timeSelect.value));

  filterContainer.appendChild(airlineSelect);
  filterContainer.appendChild(timeSelect);

  renderFlights(type, flights, "", "");
}

function renderFlights(type, flights, selectedAirline, selectedTime) {
  const container = document.getElementById(`${type}-flights`);
  container.innerHTML = "";

  const paymentMethods = Array.from(document.querySelectorAll("#payment-dropdown input:checked")).map(cb => cb.value);
  const dummyPortals = ["MakeMyTrip", "Goibibo", "Cleartrip", "Yatra"];

  const filtered = flights.filter(flight => {
    const depHour = parseInt(flight.departure.split("T")[1].split(":")[0]);
    const airlineMatch = !selectedAirline || flight.airline === selectedAirline;
    const timeMatch =
      !selectedTime ||
      (selectedTime === "morning" && depHour >= 5 && depHour < 12) ||
      (selectedTime === "afternoon" && depHour >= 12 && depHour < 17) ||
      (selectedTime === "evening" && depHour >= 17 && depHour < 21) ||
      (selectedTime === "night" && (depHour >= 21 || depHour < 5));
    return airlineMatch && timeMatch;
  });

  filtered.forEach(flight => {
    const div = document.createElement("div");
    div.className = "flight";

    let dealText = "";
    if (paymentMethods.length > 0) {
      const selectedPayment = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      const randomPortal = dummyPortals[Math.floor(Math.random() * dummyPortals.length)];
      const randomDiscount = Math.floor(Math.random() * 1000);
      const bestDeal = flight.price - randomDiscount;

      dealText = `Best Deal: ₹${bestDeal} 
        <span class="deal-note">
          (on <a href="#" onclick="alert('Taking you to ${randomPortal}...')" class="portal-link">${randomPortal}</a> using ${selectedPayment})
        </span>`;
    } else {
      dealText = `Best Deal: ₹${flight.price} 
        <span class="deal-note">(choose payment method to view offers)</span>`;
    }

    div.innerHTML = `
      <strong>${flight.airline}</strong><br/>
      From: ${flight.from} → ${flight.to}<br/>
      Departure: ${formatTime(flight.departure)} | Arrival: ${formatTime(flight.arrival)}<br/>
      <div class="price-row">
        ${dealText}
        <span class="info-icon" onclick='comparePrices(${JSON.stringify(flight)});'>ℹ️</span>
      </div>
    `;
    container.appendChild(div);
  });
}

function formatTime(isoTime) {
  const [hour, minute] = isoTime.split("T")[1].split(":");
  return `${hour}:${minute}`;
}

function comparePrices(flight) {
  const paymentMethods = Array.from(document.querySelectorAll("#payment-dropdown input:checked")).map(cb => cb.value);
  if (paymentMethods.length === 0) {
    alert("Please select at least one payment method.");
    return;
  }

  const portals = ["MakeMyTrip", "Goibibo", "Cleartrip", "Yatra"];
  let content = `<h3>${flight.airline} | ${flight.from} → ${flight.to}</h3>`;
  content += `<p>Departure: ${formatTime(flight.departure)} | Arrival: ${formatTime(flight.arrival)}</p>`;

  portals.forEach(portal => {
    const basePrice = flight.price;
    const discount = Math.floor(Math.random() * 1000);
    const paymentUsed = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const finalPrice = basePrice - discount;

    content += `
      <p>
        <strong>${portal}</strong> – ₹${finalPrice} with ${paymentUsed}
        <span class="go-link" onclick="alert('Redirecting to ${portal}...')">🔗</span>
      </p>`;
  });

  document.getElementById("comparison-content").innerHTML = content;
  document.getElementById("compare-modal").style.display = "block";
}

function closeModal() {
  document.getElementById("compare-modal").style.display = "none";
}
