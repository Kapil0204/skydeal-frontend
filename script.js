document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const searchBtn = document.getElementById('searchBtn');
  const returnDateInput = document.getElementById('returnDate');
  const tripTypeRadios = document.getElementsByName('tripType');
  const resultsSection = document.getElementById('results');

  // Toggle return date input
  tripTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      returnDateInput.parentElement.style.display = radio.value === 'round-trip' ? 'block' : 'none';
    });
  });

  // OTA portals for modal popup
  const portals = ['MakeMyTrip', 'Goibibo', 'EaseMyTrip', 'Cleartrip', 'Yatra'];

  // Search button click
  searchBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    resultsSection.innerHTML = ''; // Clear previous results

    const from = document.getElementById('from').value.trim().toUpperCase();
    const to = document.getElementById('to').value.trim().toUpperCase();
    const departureDate = document.getElementById('departureDate').value;
    const returnDate = document.getElementById('returnDate').value;
    const passengers = parseInt(document.getElementById('passengers').value);
    const travelClass = document.getElementById('travelClass').value.toLowerCase();
    const tripType = [...tripTypeRadios].find(r => r.checked)?.value || 'one-way';

    const body = {
      from,
      to,
      departureDate,
      returnDate: tripType === 'round-trip' ? returnDate : '',
      passengers,
      travelClass,
      tripType
    };

    try {
      const response = await fetch('https://skydeal-backend.onrender.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      displayResults(data, tripType);
    } catch (err) {
      console.error('Search failed:', err);
      alert('Error fetching flights. Please try again.');
    }
  });

  function displayResults(data, tripType) {
    const outbound = data.outbound || [];
    const inbound = data.return || [];

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.justifyContent = 'space-between';
    container.style.gap = '30px';

    const outboundCol = document.createElement('div');
    const returnCol = document.createElement('div');

    const createFlightCard = (flight, label) => {
      const card = document.createElement('div');
      card.className = 'flight-card';
      card.innerHTML = `
        <strong>${label}</strong><br>
        ${flight.airline} ${flight.flightNumber}<br>
        ${flight.departureTime} → ${flight.arrivalTime}<br>
        ₹${flight.price}
        <button class="showPricesBtn" style="margin-top: 8px;">View OTA Prices</button>
      `;
      card.querySelector('.showPricesBtn').addEventListener('click', () => {
        showPortalModal(flight);
      });
      return card;
    };

    outbound.forEach(f => outboundCol.appendChild(createFlightCard(f, 'Outbound')));
    if (tripType === 'round-trip') {
      inbound.forEach(f => returnCol.appendChild(createFlightCard(f, 'Return')));
    }

    container.appendChild(outboundCol);
    if (tripType === 'round-trip') container.appendChild(returnCol);

    resultsSection.appendChild(container);
  }

  function showPortalModal(flight) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>${flight.airline} ${flight.flightNumber} – ${flight.departureTime} → ${flight.arrivalTime}</h3>
        <ul>
          ${portals.map(p => `<li>${p}: ₹${flight.price + 100} <button onclick="alert('Redirecting to ${p}')">Go</button></li>`).join('')}
        </ul>
        <button onclick="this.parentElement.parentElement.remove()">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
});
