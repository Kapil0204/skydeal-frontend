document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('search-btn');
  const tripTypeSelect = document.getElementById('tripType');
  const returnDateDiv = document.getElementById('return-date-div');
  const resultsSection = document.getElementById('results');
  const outboundList = document.getElementById('outbound-list');
  const modal = document.getElementById('price-modal');
  const modalContent = document.getElementById('modal-content');
  const modalClose = document.getElementById('modal-close');

  const BACKEND_URL = 'https://skydeal-backend.onrender.com';

  // Toggle return date field
  tripTypeSelect.addEventListener('change', () => {
    if (tripTypeSelect.value === 'round-trip') {
      returnDateDiv.style.display = 'block';
    } else {
      returnDateDiv.style.display = 'none';
    }
  });

  // Handle search
  searchBtn.addEventListener('click', async () => {
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const departureDate = document.getElementById('departure-date').value;
    const returnDate = document.getElementById('return-date').value;
    const travelClass = document.getElementById('travel-class').value;
    const passengers = parseInt(document.getElementById('passengers').value, 10);
    const tripType = tripTypeSelect.value;

    const requestData = {
      from,
      to,
      departureDate,
      returnDate,
      travelClass,
      passengers,
      tripType
    };

    try {
      const response = await fetch(`${BACKEND_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      const flights = data.flights || [];

      outboundList.innerHTML = '';
      resultsSection.style.display = 'block';

      if (flights.length === 0) {
        outboundList.innerHTML = '<p>No flights found.</p>';
        return;
      }

      flights.forEach((flight, index) => {
        const card = document.createElement('div');
        card.className = 'flight-card';

        const depTime = new Date(flight.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const arrTime = new Date(flight.arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        card.innerHTML = `
          <strong>${flight.airline} ${flight.flightNumber}</strong><br>
          ${flight.from} → ${flight.to}<br>
          ${depTime} → ${arrTime}<br>
          Price: ₹${flight.price}<br>
          <button class="view-portals" data-index="${index}">View Prices on Portals</button>
        `;

        outboundList.appendChild(card);
      });

      // Attach modal logic
      document.querySelectorAll('.view-portals').forEach(button => {
        button.addEventListener('click', (e) => {
          const idx = parseInt(e.target.getAttribute('data-index'));
          const selectedFlight = flights[idx];
          showPriceModal(selectedFlight);
        });
      });

    } catch (error) {
      console.error('Error fetching flights:', error);
      outboundList.innerHTML = '<p>Error fetching flights. Try again.</p>';
    }
  });

  // Show modal with 5 portals (price + ₹100)
  function showPriceModal(flight) {
    const basePrice = parseFloat(flight.price);
    const portals = ['MakeMyTrip', 'Goibibo', 'Yatra', 'EaseMyTrip', 'Cleartrip'];

    modalContent.innerHTML = `
      <h3>${flight.airline} ${flight.flightNumber}</h3>
      <p>${flight.from} → ${flight.to} | ${new Date(flight.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
      <table>
        <tr><th>Portal</th><th>Price</th></tr>
        ${portals.map(p => `<tr><td>${p}</td><td>₹${(basePrice + 100).toFixed(2)}</td></tr>`).join('')}
      </table>
    `;

    modal.style.display = 'block';
  }

  // Close modal
  modalClose.addEventListener('click', () => {
    modal.style.display = 'none';
  });
});
