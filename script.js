const API_BASE_URL = 'https://skydeal-backend.onrender.com';

document.getElementById('search-button').addEventListener('click', async () => {
  const origin = document.getElementById('from').value;
  const destination = document.getElementById('to').value;
  const departureDate = document.getElementById('departure-date').value;
  const returnDate = document.getElementById('return-date').value;
  const passengers = document.getElementById('passengers').value;
  const travelClass = document.getElementById('travel-class').value;
  const tripType = document.querySelector('input[name="trip-type"]:checked').value;

  try {
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
    displayFlights(data);
  } catch (error) {
    console.error('Error fetching flights:', error);
  }
});

function displayFlights(data) {
  const outboundContainer = document.getElementById('outbound-flights');
  const returnContainer = document.getElementById('return-flights');

  outboundContainer.innerHTML = '';
  returnContainer.innerHTML = '';

  if (data.outboundFlights && data.outboundFlights.length > 0) {
    data.outboundFlights.forEach(flight => {
      const card = createFlightCard(flight);
      outboundContainer.appendChild(card);
    });
  } else {
    outboundContainer.innerHTML = '<p>No flights found.</p>';
  }

  if (data.returnFlights && data.returnFlights.length > 0) {
    data.returnFlights.forEach(flight => {
      const card = createFlightCard(flight);
      returnContainer.appendChild(card);
    });
  } else {
    returnContainer.innerHTML = '<p>No flights found.</p>';
  }
}

function createFlightCard(flight) {
  const card = document.createElement('div');
  card.className = 'flight-card';
  card.innerHTML = `
    <p><strong>${flight.airline}</strong> - ${flight.flightNumber}</p>
    <p>Departure: ${flight.departureTime}</p>
    <p>Arrival: ${flight.arrivalTime}</p>
    <p>Price: ₹${flight.price}</p>
    <button class="view-portals-btn">View on Portals</button>
  `;

  card.querySelector('.view-portals-btn').addEventListener('click', () => {
    showPortalModal(flight);
  });

  return card;
}

function showPortalModal(flight) {
  const modal = document.createElement('div');
  modal.className = 'portal-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-btn">&times;</span>
      <h3>Available on:</h3>
      <ul>
        <li>MakeMyTrip – ₹${flight.price + 100}</li>
        <li>Goibibo – ₹${flight.price + 100}</li>
        <li>Cleartrip – ₹${flight.price + 100}</li>
        <li>Yatra – ₹${flight.price + 100}</li>
        <li>EaseMyTrip – ₹${flight.price + 100}</li>
      </ul>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.close-btn').addEventListener('click', () => {
    modal.remove();
  });
}


