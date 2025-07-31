document.addEventListener('DOMContentLoaded', function () {
  const searchBtn = document.getElementById('searchBtn');

  searchBtn.addEventListener('click', async () => {
    console.log('Search button clicked');

    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const departureDate = document.getElementById('departure-date').value;
    const returnDateInput = document.getElementById('return-date');
    const returnDate = returnDateInput && !returnDateInput.disabled ? returnDateInput.value : '';
    const passengers = document.getElementById('passengers').value;
    const travelClass = document.getElementById('travel-class').value;
    const tripType = document.querySelector('input[name="trip-type"]:checked').value;

    const paymentCheckboxes = document.querySelectorAll('.payment-method input[type="checkbox"]:checked');
    const paymentMethods = Array.from(paymentCheckboxes).map(cb => cb.value);

    const payload = {
      from,
      to,
      departureDate,
      returnDate,
      passengers,
      travelClass,
      tripType,
      paymentMethods
    };

    console.log('Sending payload:', payload);

    try {
      const response = await fetch('https://skydeal-backend.onrender.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log('Received data:', data);

      if (data.flights) {
        renderFlights(data.flights, tripType);
      } else {
        throw new Error('Invalid flight data received.');
      }
    } catch (error) {
      console.error('❌ Error fetching flights:', error);
      alert('Something went wrong while fetching flights. Try again.');
    }
  });
});

function renderFlights(flights, tripType) {
  const outboundContainer = document.getElementById('outbound-flights');
  const returnContainer = document.getElementById('return-flights');

  outboundContainer.innerHTML = '';
  returnContainer.innerHTML = '';

  flights.forEach(flight => {
    const flightCard = `
      <div class="flight-card">
        <p><strong>✈️ ${flight.airline} ${flight.flightNumber}</strong></p>
        <p>⏰ ${flight.departureTime} → ${flight.arrivalTime}</p>
        <p>💰 Price: ₹${flight.price}</p>
      </div>
    `;

    if (tripType === 'one-way' || flight.direction === 'outbound') {
      outboundContainer.innerHTML += flightCard;
    } else if (tripType === 'round-trip' && flight.direction === 'return') {
      returnContainer.innerHTML += flightCard;
    }
  });
}
