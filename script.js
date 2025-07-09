document.getElementById('flight-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const origin = document.getElementById('origin').value.trim();
  const destination = document.getElementById('destination').value.trim();
  const date = document.getElementById('date').value;
  const returnDateInput = document.getElementById('return-date');
  const returnDate = returnDateInput && returnDateInput.value ? returnDateInput.value : '';
  const travelClass = document.querySelector('input[name="tripType"]:checked').value === 'round-trip' ? 'ECONOMY' : 'ECONOMY';

  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = 'Loading...';

  try {
    const res = await fetch(`https://skydeal-backend.onrender.com/kiwi?origin=${origin}&destination=${destination}&date=${date}&returnDate=${returnDate}&travelClass=${travelClass}`);
    const data = await res.json();

    if (!data?.itineraries?.length) {
      resultsDiv.innerHTML = 'No flights found.';
      return;
    }

    resultsDiv.innerHTML = '';
    data.itineraries.slice(0, 5).forEach((flight) => {
      const leg = flight.legs?.[0] || {};
      const airline = leg.carrier || 'Unknown Airline';
      const price = flight.price?.amount || 'N/A';
      const depTime = leg.departureTime ? new Date(leg.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A';
      const arrTime = leg.arrivalTime ? new Date(leg.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A';

      const div = document.createElement('div');
      div.className = 'flight-result';
      div.innerHTML = `
        <h3>✈️ ${airline}</h3>
        <p><strong>Departure:</strong> ${depTime}</p>
        <p><strong>Arrival:</strong> ${arrTime}</p>
        <p><strong>Price:</strong> ₹${price}</p>
      `;
      resultsDiv.appendChild(div);
    });
  } catch (error) {
    resultsDiv.innerHTML = 'Error fetching flights.';
    console.error(error);
  }
});

