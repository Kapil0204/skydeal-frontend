document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('searchForm');
  const resultsContainer = document.getElementById('results');
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modalContent');
  const closeModal = document.getElementById('closeModal');

  // Hide return date if one-way selected
  const tripTypeSelect = document.getElementById('tripType');
  const returnDateDiv = document.getElementById('returnDateDiv');
  tripTypeSelect.addEventListener('change', () => {
    returnDateDiv.style.display = tripTypeSelect.value === 'round-trip' ? 'inline-block' : 'none';
  });

  // Search button logic
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const from = document.getElementById('from')?.value;
    const to = document.getElementById('to')?.value;
    const departureDate = document.getElementById('departure')?.value;
    const returnDate = document.getElementById('return')?.value;
    const passengers = document.getElementById('passengers')?.value;
    const travelClass = document.getElementById('travelClass')?.value;
    const tripType = document.getElementById('tripType')?.value;

    if (!from || !to || !departureDate || !passengers || !travelClass || !tripType) {
      alert('Missing form fields in HTML. Please check IDs.');
      return;
    }

    const payload = {
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
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log('🔍 Raw flight data:', data);

      displayFlights(data.flights || []);
    } catch (err) {
      console.error('❌ Error fetching flights:', err);
      resultsContainer.innerHTML = '<p style="color:red;">Failed to fetch flights. Please try again later.</p>';
    }
  });

  // Render flights on the page
  function displayFlights(flights) {
    resultsContainer.innerHTML = ''; // Clear old results

    if (!flights.length) {
      resultsContainer.innerHTML = '<p>No flights found.</p>';
      return;
    }

    flights.forEach((flight, index) => {
      const flightCard = document.createElement('div');
      flightCard.className = 'flight-card';
      flightCard.innerHTML = `
        <strong>${flight.airline}</strong> (${flight.flightNumber})<br>
        ${flight.departureTime} → ${flight.arrivalTime}<br>
        Price: ₹${flight.price}<br>
        <button class="view-prices" data-index="${index}">View OTA Prices</button>
      `;
      resultsContainer.appendChild(flightCard);
    });

    // Attach popup listeners
    document.querySelectorAll('.view-prices').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = e.target.getAttribute('data-index');
        const selectedFlight = flights[index];
        showModalWithPrices(selectedFlight);
      });
    });
  }

  // Show simulated OTA prices in modal
  function showModalWithPrices(flight) {
    const base = flight.price;
    const portals = ['MakeMyTrip', 'Goibibo', 'Yatra', 'EaseMyTrip', 'Cleartrip'];
    modalContent.innerHTML = `<h3>${flight.airline} ${flight.flightNumber}</h3><ul>` +
      portals.map(p => `<li><strong>${p}:</strong> ₹${base + 100}</li>`).join('') +
      `</ul>`;
    modal.style.display = 'block';
  }

  // Close modal
  closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Close modal on outside click
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
});
