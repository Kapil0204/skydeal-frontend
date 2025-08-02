document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('search-btn');

  if (!searchBtn) {
    console.error('Search button not found');
    return;
  }

  searchBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const departureDate = document.getElementById('departure-date').value;
    const returnDate = document.getElementById('return-date').value;
    const passengers = parseInt(document.getElementById('passengers').value);
    const travelClass = document.getElementById('travel-class').value;
    const paymentMethods = [document.getElementById('payment-methods').value]; // placeholder

    const tripTypeRadio = document.querySelector('input[name="trip-type"]:checked');
    const tripType = tripTypeRadio ? tripTypeRadio.value : 'one-way';

    const requestBody = {
      from,
      to,
      departureDate,
      returnDate,
      passengers,
      travelClass,
      paymentMethods,
      tripType
    };

    try {
      const response = await fetch('https://skydeal-backend.onrender.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      // Basic display logic
      const outboundDiv = document.getElementById('outbound-results');
      const returnDiv = document.getElementById('return-results');

      outboundDiv.innerHTML = '';
      returnDiv.innerHTML = '';

      if (data.outboundFlights && Array.isArray(data.outboundFlights)) {
        data.outboundFlights.forEach(flight => {
          const div = document.createElement('div');
          div.textContent = `${flight.airline} ${flight.flightNumber} - ₹${flight.price}`;
          outboundDiv.appendChild(div);
        });
      }

      if (tripType === 'round-trip' && data.returnFlights && Array.isArray(data.returnFlights)) {
        data.returnFlights.forEach(flight => {
          const div = document.createElement('div');
          div.textContent = `${flight.airline} ${flight.flightNumber} - ₹${flight.price}`;
          returnDiv.appendChild(div);
        });
      }
    } catch (err) {
      console.error('Flight fetch failed:', err);
    }
  });
});
