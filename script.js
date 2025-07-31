document.getElementById('searchBtn').addEventListener('click', async () => {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const departureDate = document.getElementById('departure').value;
  const returnDate = document.getElementById('return').value;
  const passengers = parseInt(document.getElementById('passengers').value);
  const travelClass = document.getElementById('class').value;
  const tripType = document.getElementById('tripType').value;

  if (!from || !to || !departureDate || !passengers || !travelClass || !tripType) {
    alert('Missing form fields in HTML. Please check IDs.');
    return;
  }

  const requestBody = {
    from,
    to,
    departureDate,
    returnDate: tripType === 'round-trip' ? returnDate : '',
    passengers,
    travelClass
  };

  try {
    const response = await fetch('https://skydeal-backend.onrender.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    displayFlights(data.flights || []);
  } catch (error) {
    console.error('Error fetching flights:', error);
    alert('Failed to fetch flights.');
  }
});

function displayFlights(flights) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  if (!flights.length) {
    resultsDiv.textContent = 'No flights found.';
    return;
  }

  flights.forEach((flight, index) => {
    const div = document.createElement('div');
    div.className = 'flight-card';
    div.innerHTML = `
      <strong>${flight.airline}</strong> (${flight.flightNumber})<br>
      Departure: ${flight.departureTime} — Arrival: ${flight.arrivalTime}<br>
      Price: ₹${flight.price}<br>
      <button onclick="showPortals(${flight.price})">View Portals</button>
    `;
    resultsDiv.appendChild(div);
  });
}

function showPortals(basePrice) {
  const portals = ['MakeMyTrip', 'Goibibo', 'Cleartrip', 'EaseMyTrip', 'Yatra'];
  let message = 'Prices on portals:\n\n';

  portals.forEach(portal => {
    message += `${portal}: ₹${basePrice + 100}\n`;
  });

  alert(message);
}
