document.getElementById('searchButton').addEventListener('click', async () => {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const departureDate = document.getElementById('departureDate').value;
  const returnDate = document.getElementById('returnDate').value;
  const passengers = document.getElementById('passengers').value;
  const travelClass = document.getElementById('travelClass').value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  if (!from || !to || !departureDate || !passengers || !travelClass) {
    alert('Please fill in all required fields.');
    return;
  }

  try {
    const response = await fetch('https://skydeal-backend.onrender.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, departureDate, returnDate, passengers, travelClass, tripType })
    });

    const data = await response.json();
    displayFlights(data.outboundFlights, 'outboundResults', 'Outbound Flights');
    displayFlights(data.returnFlights, 'returnResults', 'Return Flights');
  } catch (err) {
    alert('Failed to fetch flights. Please try again later.');
    console.error(err);
  }
});

function displayFlights(flights, containerId, title) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<h3>${title}</h3>`;

  if (!flights || flights.length === 0) {
    container.innerHTML += '<p>No flights found.</p>';
    return;
  }

  flights.forEach((flight, index) => {
    const card = document.createElement('div');
    card.className = 'flight-card';
    card.innerHTML = `
      <p><strong>${flight.flightName}</strong></p>
      <p>${flight.departure} → ${flight.arrival}</p>
      <p>Base Price: ₹${flight.price}</p>
      <button onclick="showPortalPricing(${flight.price})">View Portals</button>
    `;
    container.appendChild(card);
  });
}

function showPortalPricing(basePrice) {
  const modal = document.getElementById('portalModal');
  const content = document.getElementById('portalContent');

  const portals = ['MakeMyTrip', 'Goibibo', 'EaseMyTrip', 'Cleartrip', 'Yatra'];
  content.innerHTML = portals.map(p => {
    return `<p><strong>${p}:</strong> ₹${basePrice + 100} <button onclick="alert('Redirecting to ${p}')">Go</button></p>`;
  }).join('');

  modal.style.display = 'block';
}

document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('portalModal').style.display = 'none';
});
