document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  const resultsContainer = document.getElementById('results');

  if (!searchBtn || !resultsContainer) {
    console.error('Required elements not found in DOM');
    return;
  }

  searchBtn.addEventListener('click', async () => {
    const from = document.getElementById('fromInput').value.trim();
    const to = document.getElementById('toInput').value.trim();
    const departureDate = document.getElementById('departureDate').value;
    const returnDate = document.getElementById('returnDate').value;
    const passengers = document.getElementById('passengers').value || 1;
    const travelClass = document.getElementById('travelClass').value;
    const tripType = document.getElementById('tripType').value;

    if (!from || !to || !departureDate || !travelClass) {
      alert("Please fill in all required fields.");
      return;
    }

    const payload = {
      from,
      to,
      departureDate,
      returnDate: tripType === 'round-trip' ? returnDate : '',
      passengers: parseInt(passengers),
      travelClass: travelClass.toLowerCase(),
      tripType
    };

    try {
      const res = await fetch('https://skydeal-backend.onrender.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data || !data.flights || data.flights.length === 0) {
        resultsContainer.innerHTML = `<p>No flights found.</p>`;
        return;
      }

      displayResults(data.flights);
    } catch (err) {
      console.error('Search failed:', err);
      alert('Failed to fetch flights. Please try again.');
    }
  });

  function displayResults(flights) {
    resultsContainer.innerHTML = `<h3>Outbound Flights</h3>`;

    flights.forEach((flight, index) => {
      const card = document.createElement('div');
      card.className = 'flight-card';
      card.innerHTML = `
        <p><strong>${flight.airline}</strong> (${flight.flightNumber})</p>
        <p>${flight.departureTime} → ${flight.arrivalTime}</p>
        <p>Price: ₹${flight.price}</p>
        <button class="price-btn" data-price="${flight.price}" data-index="${index}">View Portal Prices</button>
      `;
      resultsContainer.appendChild(card);
    });

    // Attach modal trigger
    document.querySelectorAll('.price-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const basePrice = parseFloat(e.target.dataset.price);
        const portals = ['MakeMyTrip', 'Goibibo', 'EaseMyTrip', 'Yatra', 'Cleartrip'];
        const markup = 100;
        let popup = `Showing prices with +₹${markup} markup:\n\n`;
        portals.forEach(p => {
          popup += `${p}: ₹${basePrice + markup}\n`;
        });
        alert(popup);
      });
    });
  }
});
