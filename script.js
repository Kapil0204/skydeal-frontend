document.getElementById('flight-search-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const from = document.getElementById('from').value.toUpperCase();
  const to = document.getElementById('to').value.toUpperCase();
  const departureDate = document.getElementById('departure-date').value;
  const returnDate = document.getElementById('return-date').value;
  const passengers = document.getElementById('passengers').value;
  const travelClass = document.getElementById('travel-class').value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  try {
    const response = await fetch('https://skydeal-backend.onrender.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, departureDate, returnDate, passengers, travelClass, tripType })
    });

    const data = await response.json();
    renderFlights(data.outboundFlights, 'outbound-flights-container');
    renderFlights(data.returnFlights, 'return-flights-container');
    document.getElementById('sort-container').style.display = 'block';
  } catch (error) {
    console.error('Error fetching flights:', error);
  }
});

function renderFlights(flights, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  flights.forEach((flight, index) => {
    const flightCard = document.createElement('div');
    flightCard.className = 'flight-card';

    const airlineName = flight.airline || 'Unknown Airline';
    const flightNumber = flight.flightNumber || '';
    const price = typeof flight.price === 'number' ? flight.price.toFixed(2) : 'N/A';

    flightCard.innerHTML = `
      <strong>${flightNumber} (${airlineName})</strong><br>
      Departure: ${flight.departureTime} <br>
      Arrival: ${flight.arrivalTime} <br>
      Stops: ${flight.stops || 0} <br>
      Price: ₹${price} <br>
      <button onclick="showModal(${price})">View on OTAs</button>
    `;

    container.appendChild(flightCard);
  });
}

function showModal(basePrice) {
  const portals = ['MakeMyTrip', 'Cleartrip', 'Goibibo', 'EaseMyTrip', 'Yatra'];
  const modalContent = document.getElementById('modal-content');
  modalContent.innerHTML = '<h3>Prices on OTAs</h3>';

  portals.forEach(portal => {
    const markupPrice = (basePrice + 100).toFixed(2);
    const row = document.createElement('div');
    row.innerHTML = `<strong>${portal}:</strong> ₹${markupPrice}`;
    modalContent.appendChild(row);
  });

  document.getElementById('modal').style.display = 'block';
}

document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('modal').style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) {
    document.getElementById('modal').style.display = 'none';
  }
});

document.getElementById('sort').addEventListener('change', () => {
  const sortBy = document.getElementById('sort').value;
  const outboundContainer = document.getElementById('outbound-flights-container');
  const returnContainer = document.getElementById('return-flights-container');

  sortFlightCards(outboundContainer, sortBy);
  sortFlightCards(returnContainer, sortBy);
});

function sortFlightCards(container, sortBy) {
  const cards = Array.from(container.querySelectorAll('.flight-card'));

  cards.sort((a, b) => {
    const aText = a.innerText;
    const bText = b.innerText;

    const aTime = parseTime(aText.match(/Departure: (\d{2}:\d{2})/)[1]);
    const bTime = parseTime(bText.match(/Departure: (\d{2}:\d{2})/)[1]);

    const aPrice = parseFloat(aText.match(/Price: ₹(\d+\.\d{2})/)[1]);
    const bPrice = parseFloat(bText.match(/Price: ₹(\d+\.\d{2})/)[1]);

    if (sortBy === 'price') {
      return aPrice - bPrice;
    } else {
      return aTime - bTime;
    }
  });

  container.innerHTML = '';
  cards.forEach(card => container.appendChild(card));
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
