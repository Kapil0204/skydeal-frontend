document.getElementById('flight-search-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const from = document.getElementById('from').value.toUpperCase();
  const to = document.getElementById('to').value.toUpperCase();
  const departureDate = document.getElementById('departure-date').value;
  const returnDate = document.getElementById('return-date').value;
  const passengers = document.getElementById('passengers').value;
  const travelClass = document.getElementById('travel-class').value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const response = await fetch('https://skydeal-backend.onrender.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      departureDate,
      returnDate,
      passengers,
      travelClass,
      tripType
    })
  });

  const data = await response.json();
  displayFlights(data.outboundFlights, 'outbound-results');
  displayFlights(data.returnFlights, 'return-results');
});

function displayFlights(flights, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const sortOption = document.getElementById('sort-select').value;
  if (sortOption === 'price') {
    flights.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  } else if (sortOption === 'departure') {
    flights.sort((a, b) => a.departure.localeCompare(b.departure));
  }

  flights.forEach((flight, index) => {
    const card = document.createElement('div');
    card.className = 'flight-card';

    const flightName = document.createElement('p');
    flightName.innerHTML = `<strong>${flight.flightNumber}</strong> (${flight.airlineName})`;

    const departure = document.createElement('p');
    departure.textContent = `Departure: ${flight.departure}`;

    const arrival = document.createElement('p');
    arrival.textContent = `Arrival: ${flight.arrival}`;

    const stops = document.createElement('p');
    stops.textContent = `Stops: ${flight.stops}`;

    const price = document.createElement('p');
    price.textContent = `Price: ₹${flight.price}`;

    const btn = document.createElement('button');
    btn.textContent = 'View on OTAs';
    btn.onclick = () => {
      const basePrice = parseFloat(flight.price);
      const markup = 100;
      const portals = ['MakeMyTrip', 'Goibibo', 'Cleartrip', 'EaseMyTrip', 'Yatra'];
      const message = portals.map(p => `${p}: ₹${(basePrice + markup).toFixed(0)}`).join('\n');
      alert(`${flight.flightNumber} pricing:\n\n${message}`);
    };

    card.appendChild(flightName);
    card.appendChild(departure);
    card.appendChild(arrival);
    card.appendChild(stops);
    card.appendChild(price);
    card.appendChild(btn);

    container.appendChild(card);
  });
}

// ✅ Toggle return date field
const tripRadios = document.querySelectorAll('input[name="tripType"]');
tripRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    const returnGroup = document.getElementById('return-date-group');
    if (document.querySelector('input[name="tripType"]:checked').value === 'round-trip') {
      returnGroup.style.display = 'block';
    } else {
      returnGroup.style.display = 'none';
    }
  });
});
