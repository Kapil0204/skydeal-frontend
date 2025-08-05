document.addEventListener('DOMContentLoaded', function () {
  const searchBtn = document.getElementById('searchBtn');
  const roundTripRadio = document.getElementById('roundTrip');
  const oneWayRadio = document.getElementById('oneWay');
  const returnDateContainer = document.getElementById('returnDateContainer');

  function toggleReturnDate() {
    if (roundTripRadio.checked) {
      returnDateContainer.style.display = 'inline-block';
    } else {
      returnDateContainer.style.display = 'none';
    }
  }

  roundTripRadio.addEventListener('change', toggleReturnDate);
  oneWayRadio.addEventListener('change', toggleReturnDate);

  toggleReturnDate(); // set initial state

  searchBtn.addEventListener('click', async () => {
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const departureDate = document.getElementById('departureDate').value;
    const returnDateInput = document.getElementById('returnDate');
    const returnDate = returnDateInput ? returnDateInput.value : '';
    const passengers = document.getElementById('passengers').value;
    const travelClass = document.getElementById('travelClass').value;
    const tripType = roundTripRadio.checked ? 'round-trip' : 'one-way';

    const searchData = {
      from,
      to,
      departureDate,
      returnDate: tripType === 'round-trip' ? returnDate : '',
      passengers,
      travelClass,
      tripType
    };

    try {
      const response = await fetch('https://skydeal-backend.onrender.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchData)
      });

      const result = await response.json();
      displayFlights(result);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Failed to fetch flights. Please try again.');
    }
  });

  function displayFlights(data) {
    const outboundDiv = document.getElementById('outboundFlights');
    const returnDiv = document.getElementById('returnFlights');
    outboundDiv.innerHTML = '';
    returnDiv.innerHTML = '';

    if (!data.outboundFlights) {
      outboundDiv.innerHTML = '<p>No outbound flights found.</p>';
      return;
    }

    data.outboundFlights.forEach(flight => {
      const card = createFlightCard(flight);
      outboundDiv.appendChild(card);
    });

    if (data.returnFlights && data.returnFlights.length > 0) {
      data.returnFlights.forEach(flight => {
        const card = createFlightCard(flight);
        returnDiv.appendChild(card);
      });
    }
  }

  function createFlightCard(flight) {
    const div = document.createElement('div');
    div.className = 'flight-card';
    div.innerHTML = `
      <strong>${flight.airline || flight.flightName}</strong><br>
      Flight: ${flight.flightNumber || ''}<br>
      From: ${flight.from} @ ${flight.departure}<br>
      To: ${flight.to} @ ${flight.arrival}<br>
      Stops: ${flight.stops || '0'}<br>
      Price: ₹${flight.price}
    `;
    return div;
  }
});
