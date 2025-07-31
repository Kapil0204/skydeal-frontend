document.getElementById('searchBtn').addEventListener('click', async () => {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const date = document.getElementById('date').value;
  const travelClass = document.getElementById('travelClass').value;
  const passengers = 1;

  const body = {
    from,
    to,
    departureDate: date,
    travelClass,
    passengers
  };

  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = 'Searching...';

  try {
    const res = await fetch('https://your-backend-url.onrender.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    resultsDiv.innerHTML = '';

    if (data.flights && data.flights.length > 0) {
      data.flights.forEach(flight => {
        const div = document.createElement('div');
        div.className = 'flight-card';
        div.innerHTML = `
          <strong>${flight.airline} ${flight.flightNumber}</strong><br>
          🛫 ${flight.departure} → 🛬 ${flight.arrival}<br>
          💰 ₹${flight.price}
        `;
        resultsDiv.appendChild(div);
      });
    } else {
      resultsDiv.textContent = 'No flights found.';
    }

  } catch (err) {
    resultsDiv.textContent = 'Error fetching flights.';
    console.error(err);
  }
});
