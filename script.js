document.getElementById('searchBtn').addEventListener('click', async () => {
  const from = document.getElementById('from').value.trim();
  const to = document.getElementById('to').value.trim();
  const departureDate = document.getElementById('departureDate').value;
  const returnDate = document.getElementById('returnDate')?.value || '';
  const passengers = parseInt(document.getElementById('passengers').value);
  const travelClass = document.getElementById('travelClass').value.toUpperCase();
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  // Get selected payment methods
  const paymentMethods = [];
  document.querySelectorAll('#paymentDropdown input[type="checkbox"]:checked').forEach(cb => {
    paymentMethods.push(cb.value);
  });

  // Clear previous results
  document.getElementById('outboundResults').innerHTML = '';
  document.getElementById('returnResults').innerHTML = '';

  try {
    const response = await fetch('https://skydeal-backend.onrender.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, departureDate, returnDate, passengers, travelClass, tripType })
    });

    const data = await response.json();

    if (data.outboundFlights && Array.isArray(data.outboundFlights)) {
      data.outboundFlights.forEach(flight => {
        const card = createFlightCard(flight);
        document.getElementById('outboundResults').appendChild(card);
      });
    }

    if (tripType === 'round-trip' && data.returnFlights && Array.isArray(data.returnFlights)) {
      data.returnFlights.forEach(flight => {
        const card = createFlightCard(flight);
        document.getElementById('returnResults').appendChild(card);
      });
    }
  } catch (err) {
    console.error('Search error:', err);
    alert('Failed to fetch flight data. Please try again.');
  }
});

function createFlightCard(flight) {
  const div = document.createElement('div');
  div.className = 'flight-card';
  div.innerHTML = `
    <p><strong>${flight.airline}</strong> (${flight.flightNumber})</p>
    <p>${flight.departureTime} → ${flight.arrivalTime}</p>
    <p>Class: ${flight.travelClass}</p>
    <p>Price: ₹${flight.price}</p>
  `;
  return div;
}
