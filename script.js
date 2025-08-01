document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('searchForm');
  const resultsSection = document.getElementById('resultsSection');
  const outboundResults = document.getElementById('outboundResults');
  const returnResults = document.getElementById('returnResults');
  const tripTypeRadios = document.getElementsByName('tripType');
  const returnDateDiv = document.getElementById('returnDateDiv');
  const flightModal = document.getElementById('flightModal');
  const modalContent = document.getElementById('modalContent');
  const closeModal = document.getElementById('closeModal');

  const API_URL = 'https://skydeal-backend.onrender.com';

  // Toggle return date visibility
  tripTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      returnDateDiv.style.display = document.querySelector('input[name="tripType"]:checked').value === 'round-trip' ? 'block' : 'none';
    });
  });

  // Search form submission
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const from = document.getElementById('from').value.trim();
    const to = document.getElementById('to').value.trim();
    const departureDate = document.getElementById('departureDate').value;
    const returnDate = document.getElementById('returnDate').value;
    const tripType = document.querySelector('input[name="tripType"]:checked').value;
    const passengers = document.getElementById('passengers').value;
    const travelClass = document.getElementById('travelClass').value;

    resultsSection.style.display = 'none';
    outboundResults.innerHTML = '';
    returnResults.innerHTML = '';

    try {
      const response = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, departureDate, returnDate, passengers, travelClass, tripType })
      });

      const data = await response.json();

      const renderFlights = (flights, container, direction) => {
        flights.forEach(flight => {
          const card = document.createElement('div');
          card.className = 'flight-card';
          card.innerHTML = `
            <strong>${flight.airline}</strong><br>
            Flight No: ${flight.flightNumber}<br>
            Departure: ${flight.departureTime} | Arrival: ${flight.arrivalTime}<br>
            Price: ₹${flight.price}<br>
            <button class="view-portals" data-flight='${JSON.stringify(flight)}'>View on Portals</button>
          `;
          container.appendChild(card);
        });
      };

      renderFlights(data.outboundFlights, outboundResults, 'outbound');

      if (tripType === 'round-trip') {
        renderFlights(data.returnFlights, returnResults, 'return');
      }

      resultsSection.style.display = 'flex';

      document.querySelectorAll('.view-portals').forEach(button => {
        button.addEventListener('click', (e) => {
          const flight = JSON.parse(e.target.getAttribute('data-flight'));
          const portals = ['MakeMyTrip', 'Goibibo', 'EaseMyTrip', 'Yatra', 'Cleartrip'];
          const portalPricing = portals.map(p => {
            const price = flight.price + 100;
            return `<p><strong>${p}</strong>: ₹${price}</p>`;
          }).join('');
          modalContent.innerHTML = `
            <h3>${flight.airline} (${flight.flightNumber})</h3>
            <p>${flight.departureTime} → ${flight.arrivalTime}</p>
            ${portalPricing}
          `;
          flightModal.style.display = 'block';
        });
      });

    } catch (err) {
      console.error('Error fetching flights:', err);
      alert('Something went wrong while searching flights.');
    }
  });

  // Modal close logic
  closeModal.addEventListener('click', () => {
    flightModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target == flightModal) {
      flightModal.style.display = 'none';
    }
  });
});



