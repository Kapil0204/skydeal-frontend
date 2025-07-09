const backendUrl = 'https://skydeal-backend.onrender.com/kiwi';

document.getElementById('flight-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const origin = document.getElementById('origin').value;
  const destination = document.getElementById('destination').value;
  const date = document.getElementById('departure').value;

  const url = `${backendUrl}?origin=${origin}&destination=${destination}&date=${date}`;

  try {
    const res = await fetch(url);
    const flights = await res.json();
    displayFlights(flights);
  } catch (err) {
    console.error('Error fetching flights:', err);
    alert('Error fetching flight data');
  }
});

function displayFlights(flights) {
  const container = document.getElementById('results');
  container.innerHTML = '';

  if (!flights.length) {
    container.innerHTML = '<p>No flights found.</p>';
    return;
  }

  flights.forEach(flight => {
    const div = document.createElement('div');
    div.classList.add('flight-card');
    div.innerHTML = `
      <h3>✈️ ${flight.airline || 'Unknown Airline'}</h3>
      <p><strong>Departure:</strong> ${formatTime(flight.departureTime)}</p>
      <p><strong>Arrival:</strong> ${formatTime(flight.arrivalTime)}</p>
      <p><strong>Price:</strong> ₹${flight.price}</p>
    `;
    container.appendChild(div);
  });
}

function formatTime(timeStr) {
  if (!timeStr) return 'N/A';
  const date = new Date(timeStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}




