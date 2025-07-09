const API_URL = 'https://skydeal-backend.onrender.com/kiwi';

document.getElementById('searchForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const origin = document.getElementById('origin').value;
  const destination = document.getElementById('destination').value;
  const date = document.getElementById('date').value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  try {
    const response = await fetch(`${API_URL}?origin=${origin}&destination=${destination}&date=${date}&tripType=${tripType}`);
    const data = await response.json();
    displayFlights(data);
  } catch (error) {
    console.error("Error fetching flight data:", error);
    document.getElementById('results').innerHTML = `<p>Something went wrong. Please try again.</p>`;
  }
});

function displayFlights(data) {
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = ''; // Clear previous results

  if (!data || !data.itineraries || !data.itineraries.length) {
    resultsContainer.innerHTML = `<p>No flights found.</p>`;
    return;
  }

  const carriersMap = {};
  if (data.metadata?.carriers) {
    data.metadata.carriers.forEach(carrier => {
      carriersMap[carrier.id] = carrier.name;
    });
  }

  data.itineraries.forEach((flight, index) => {
    const price = flight.price?.amount || 'N/A';
    const segments = flight.legs?.[0]?.segments || [];
    const departure = segments[0]?.departure?.localTime || 'N/A';
    const arrival = segments[segments.length - 1]?.arrival?.localTime || 'N/A';
    const airlineId = segments[0]?.carrier?.id;
    const airlineName = carriersMap[airlineId] || 'Unknown Airline';

    const flightDiv = document.createElement('div');
    flightDiv.className = 'flight-card';
    flightDiv.innerHTML = `
      <h3>✈️ ${airlineName}</h3>
      <p><strong>Departure:</strong> ${departure}</p>
      <p><strong>Arrival:</strong> ${arrival}</p>
      <p><strong>Price:</strong> ₹${price}</p>
    `;
    resultsContainer.appendChild(flightDiv);
  });
}


