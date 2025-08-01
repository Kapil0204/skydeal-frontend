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

  // ✅ 1. Toggle return date visibility
  if (tripTypeRadios && tripTypeRadios.length > 0) {
    tripTypeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (returnDateDiv) {
          returnDateDiv.style.display =
            document.querySelector('input[name="tripType"]:checked').value === 'round-trip'
              ? 'block'
              : 'none';
        }
      });
    });
  }

  // ✅ 2. Handle form submission
  if (searchForm) {
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

        const renderFlights = (flights, container) => {
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

        renderFlights(data.outboundFlights, outboundResults);
        if (tripType === 'round-trip') {
          renderFlights(data.returnFlights, returnResults);
        }

        resultsSection.style.display = 'flex';

        document.querySelectorAll('.view-portals').forEach(button => {
          button.addEventListener('click', (e) => {
            const flight = JSON.parse(e.target.getAttribute('data-flight'));
            const portals = ['MakeMyTrip', 'Goibibo', 'EaseMyTrip', 'Yatra', 'Cleartrip'];
            const portalPricing = portals.map(p => {
              return `<p><strong>${p}</strong>: ₹${flight.price + 100}</p>`;
            }).join('');

            modalContent.innerHTML = `
              <h3>${flight.airline} (${flight.flightNumber})</h3>
              <p>${flight.departureTime} → ${flight.arrivalTime}</p>
              ${portalPricing}
            `;
            flightModal.style.display = 'block';
          });
        });

      } catch (error) {
        console.error('❌ Error fetching flights:', error);
        alert('Something went wrong while searching flights.');
      }
    });
  }

  // ✅ 3. Modal handling
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      flightModal.style.display = 'none';
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === flightModal) {
      flightModal.style.display = 'none';
    }
  });
});
