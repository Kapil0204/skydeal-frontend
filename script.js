window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('flight-form');
  const resultsDiv = document.getElementById('results');

  if (!form || !resultsDiv) {
    console.error('Form or results container not found');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const origin = document.getElementById('origin')?.value;
    const destination = document.getElementById('destination')?.value;
    const departureDate = document.getElementById('departure-date')?.value;
    const returnDate = document.getElementById('return-date')?.value;
    const isRoundTrip = document.getElementById('roundtrip')?.checked;

    if (!origin || !destination || !departureDate) {
      resultsDiv.innerHTML = '<p>Please fill all required fields.</p>';
      return;
    }

    let url = `https://skydeal-backend.onrender.com/kiwi?origin=${origin}&destination=${destination}&date=${departureDate}&adults=1&travelClass=ECONOMY`;

    if (isRoundTrip && returnDate) {
      url += `&returnDate=${returnDate}`;
    }

    try {
      resultsDiv.innerHTML = '<p>Loading...</p>';
      const response = await fetch(url);
      const data = await response.json();

      const flights = data.flights || data.data || [];
      const carriers = data.carriers || [];

      const carrierMap = {};
      carriers.forEach(c => {
        carrierMap[c.code] = c.name;
      });

      displayFlights(flights, carrierMap);
    } catch (error) {
      console.error('Error fetching flights:', error);
      resultsDiv.innerHTML = '<p>Error fetching flights.</p>';
    }
  });

  function displayFlights(flights, carrierMap) {
    resultsDiv.innerHTML = '';

    if (!flights.length) {
      resultsDiv.innerHTML = '<p>No flights found.</p>';
      return;
    }

    flights.forEach(flight => {
      const airlineCode = flight.airlines?.[0] || 'N/A';
      const airlineName = carrierMap[airlineCode] || 'Unknown Airline';

      const departureTime = flight.dTimeUTC
        ? new Date(flight.dTimeUTC * 1000).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'N/A';

      const arrivalTime = flight.aTimeUTC
        ? new Date(flight.aTimeUTC * 1000).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'N/A';

      const price = flight.price || 'N/A';

      const flightCard = document.createElement('div');
      flightCard.classList.add('flight-card');
      flightCard.innerHTML = `
        <h3>✈️ ${airlineName}</h3>
        <p><strong>Departure:</strong> ${departureTime}</p>
        <p><strong>Arrival:</strong> ${arrivalTime}</p>
        <p><strong>Price:</strong> ₹${price}</p>
      `;
      resultsDiv.appendChild(flightCard);
    });
  }
});



