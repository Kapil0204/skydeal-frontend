const searchForm = document.getElementById('search-form');
const outboundResults = document.getElementById('outbound-results');
const returnResults = document.getElementById('return-results');

const portals = ['MakeMyTrip', 'Goibibo', 'Yatra', 'Cleartrip', 'EaseMyTrip'];

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  outboundResults.innerHTML = '';
  returnResults.innerHTML = '';

  const origin = document.getElementById('from').value;
  const destination = document.getElementById('to').value;
  const departureDate = document.getElementById('departure-date').value;
  const returnDate = document.getElementById('return-date').value;
  const passengers = document.getElementById('passengers').value;
  const travelClass = document.getElementById('travel-class').value;
  const tripType = document.querySelector('input[name="trip-type"]:checked').value;

  try {
    const response = await fetch('http://localhost:3000/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        departureDate,
        returnDate,
        passengers,
        travelClass,
        tripType
      })
    });

    const data = await response.json();
    const outboundFlights = data.outboundFlights || [];
    const returnFlights = data.returnFlights || [];

    outboundFlights.forEach(flight => {
      const card = createFlightCard(flight, 'Outbound');
      outboundResults.appendChild(card);
    });

    returnFlights.forEach(flight => {
      const card = createFlightCard(flight, 'Return');
      returnResults.appendChild(card);
    });
  } catch (err) {
    console.error('Error fetching flights:', err);
    alert('Failed to fetch flights. Try again.');
  }
});

function createFlightCard(flight, type) {
  const card = document.createElement('div');
  card.className = 'flight-card';
  card.innerHTML = `
    <strong>${flight.airline}</strong><br>
    ${flight.flightNumber}<br>
    ${flight.departure} → ${flight.arrival}<br>
    ₹${flight.price}<br>
    <button class="price-btn">View OTA Prices</button>
  `;

  card.querySelector('button').addEventListener('click', () => {
    showPortalPrices(flight);
  });

  return card;
}

function showPortalPrices(flight) {
  const modal = document.createElement('div');
  modal.className = 'modal';

  let content = `<h3>Prices for ${flight.flightNumber}</h3>`;
  portals.forEach(portal => {
    const price = flight.price + 100;
    content += `<p><strong>${portal}:</strong> ₹${price}</p>`;
  });
  content += '<button onclick="this.parentElement.remove()">Close</button>';

  modal.innerHTML = content;
  document.body.appendChild(modal);
}
