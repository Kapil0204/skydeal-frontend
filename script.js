const form = document.getElementById('flight-form');
const resultsDiv = document.getElementById('results');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const origin = document.getElementById('origin').value;
  const destination = document.getElementById('destination').value;
  const date = document.getElementById('date').value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const backendUrl = 'https://your-render-backend.onrender.com/kiwi';

  try {
    const response = await fetch(`${backendUrl}?origin=${origin}&destination=${destination}&date=${date}&tripType=${tripType}`);
    const data = await response.json();
    displayFlights(data);
  } catch (error) {
    resultsDiv.innerHTML = 'Failed to fetch flight data.';
  }
});

function displayFlights(data) {
  resultsDiv.innerHTML = '';
  const itineraries = data.itineraries || [];

  if (itineraries.length === 0) {
    resultsDiv.innerHTML = 'No flights found.';
    return;
  }

  itineraries.forEach((flight) => {
    const card = document.createElement('div');
    card.className = 'flight-card';

    const airline = flight.carriers?.[0]?.name || 'Unknown Airline';
    const departure = flight.itineraryOutbound?.departureTime || 'N/A';
    const arrival = flight.itineraryOutbound?.arrivalTime || 'N/A';
    const price = flight.price?.amount || 'N/A';

    card.innerHTML = `
      <strong>✈️ ${airline}</strong><br>
      <b>Departure:</b> ${departure}<br>
      <b>Arrival:</b> ${arrival}<br>
      <b>Price:</b> ₹${price}
    `;

    resultsDiv.appendChild(card);
  });
}



