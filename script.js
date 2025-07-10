document.querySelector("form").addEventListener("submit", function (e) {
  e.preventDefault();

  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const departureDate = document.getElementById("departureDate").value;
  const returnDate = document.getElementById("returnDate").value;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travelClass").value;
  const paymentMethod = document.getElementById("paymentMethod").value.toLowerCase();
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const resultDiv = document.getElementById("results");
  resultDiv.innerHTML = "";

  fetch(`https://skydeal-backend.onrender.com/simulated-flights`)
    .then(res => res.json())
    .then(data => {
      const outbound = data.outbound;
      const returnFlights = data.return;

      if (tripType === "oneway") {
        renderFlights("Outbound Flights", outbound, paymentMethod, "outbound");
      } else {
        renderFlights("Outbound Flights", outbound, paymentMethod, "outbound");
        renderFlights("Return Flights", returnFlights, paymentMethod, "return");
      }
    })
    .catch(err => {
      resultDiv.textContent = "Failed to fetch flight data.";
      console.error(err);
    });
});

function renderFlights(title, flights, paymentMethod, sectionId) {
  const section = document.createElement("div");
  section.className = "flight-section";

  const heading = document.createElement("h2");
  heading.textContent = title;
  section.appendChild(heading);

  const filter = document.createElement("div");
  filter.className = "filters";
  filter.innerHTML = `
    <select onchange="filterFlights('${sectionId}', this.value, 'airline')">
      <option value="">Filter by Airline</option>
      ${[...new Set(flights.map(f => f.airline))].map(a => `<option value="${a}">${a}</option>`).join("")}
    </select>
    <select onchange="filterFlights('${sectionId}', this.value, 'time')">
      <option value="">Filter by Time</option>
      <option value="morning">Morning (00-12)</option>
      <option value="afternoon">Afternoon (12-18)</option>
      <option value="evening">Evening (18-24)</option>
    </select>
  `;
  section.appendChild(filter);

  flights.forEach((flight, index) => {
    const bestPortal = Object.entries(flight.portals).find(([portal, offers]) =>
      offers.payment.toLowerCase().includes(paymentMethod)
    ) || Object.entries(flight.portals)[0];

    const card = document.createElement("div");
    card.className = "flight-card";
    card.dataset.airline = flight.airline;
    card.dataset.time = parseInt(flight.departure.split(":")[0]);

    card.innerHTML = `
      <p><strong>${flight.airline}</strong></p>
      <p>${flight.departure} → ${flight.arrival}</p>
      <p><strong>Best Deal:</strong> ${bestPortal[0]} - ₹${bestPortal[1].price}</p>
      <button onclick="showModal(${JSON.stringify(flight.portals).replace(/"/g, '&quot;')})">i</button>
    `;

    section.appendChild(card);
  });

  document.getElementById("results").appendChild(section);
}

function filterFlights(sectionId, value, type) {
  const section = document.querySelectorAll(`.flight-section`)[type === 'airline' ? 0 : 1] || document.querySelector('.flight-section');
  const cards = section.querySelectorAll('.flight-card');

  cards.forEach(card => {
    let show = true;

    if (type === 'airline' && value) {
      show = card.dataset.airline === value;
    }

    if (type === 'time' && value) {
      const hour = parseInt(card.dataset.time);
      if (value === 'morning') show = hour < 12;
      else if (value === 'afternoon') show = hour >= 12 && hour < 18;
      else show = hour >= 18;
    }

    card.style.display = show ? "block" : "none";
  });
}

function showModal(portalData) {
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modal-body");
  modalBody.innerHTML = "";

  for (const [portal, offer] of Object.entries(portalData)) {
    const p = document.createElement("p");
    p.textContent = `${portal}: ₹${offer.price} (${offer.payment})`;
    modalBody.appendChild(p);
  }

  modal.classList.remove("hidden");
}

document.querySelector(".close").addEventListener("click", () => {
  document.getElementById("modal").classList.add("hidden");
});
