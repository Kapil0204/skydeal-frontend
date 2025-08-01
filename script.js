document.getElementById('searchBtn').addEventListener('click', async () => {
  const from = document.getElementById('from').value.trim();
  const to = document.getElementById('to').value.trim();
  const date = document.getElementById('date').value;
  const travelClass = document.getElementById('travelClass').value;

  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = 'Searching...';

  try {
    const res = await fetch('https://skydeal-backend.onrender.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        departureDate: date,
        travelClass,
        passengers: 1
      })
    });

    const data = await res.json();
    resultsDiv.innerHTML = '';

    if (!data.flights || data.flights.length === 0) {
      resultsDiv.textContent = 'No flights found.';
      return;
    }

    data.flights.forEach(flight => {
      const div = document.createElement('div');
      div.className = 'flight-card';
      div.innerHTML = `
        <strong>${flight.airline} ${flight.flightNumber}</strong><br>
        🛫 ${formatDateTime(flight.departure)} → 🛬 ${formatDateTime(flight.arrival)}<br>
        💰 <strong>₹${flight.price}</strong>
      `;
      resultsDiv.appendChild(div);
    });

  } catch (error) {
    console.error('Fetch error:', error);
    resultsDiv.textContent = 'Error fetching flights.';
  }
});

function formatDateTime(isoString) {
  const dt = new Date(isoString);
  const hh = dt.getHours().toString().padStart(2, '0');
  const mm = dt.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
