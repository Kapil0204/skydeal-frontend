document.querySelector('form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const flyFrom = document.querySelector('#from').value;
  const to = document.querySelector('#to').value;
  const date = document.querySelector('#date').value;
  const passengers = document.querySelector('#passengers').value;
  const travelClass = document.querySelector('#travelClass').value;
  const isRoundTrip = document.querySelector('#roundTrip').checked;
  const tripType = isRoundTrip ? 'false' : 'true';

  const query = `flyFrom=${flyFrom}&to=${to}&dateFrom=${date}&dateTo=${date}&adults=${passengers}&travelClass=${travelClass}&oneWay=${tripType}`;

  try {
    const response = await fetch(`https://skydeal-backend.onrender.com/kiwi?${query}`);
    const data = await response.json();

    const resultDiv = document.querySelector('#results');
    resultDiv.innerHTML = '';

    if (!data || !data.Itineraries || !data.Itineraries.metadata || !data.Itineraries.metadata.carriers) {
      resultDiv.textContent = 'No flights found. Please try different dates or cities.';
      return;
    }

    // Build carrier ID to name map
    const carrierMap = {};
    for (const carrier of data.Itineraries.metadata.carriers) {
      carrierMap[carrier.id] = carrier.name;
    }

    if (data.Itineraries.items.length === 0) {
      resultDiv.textContent = 'No flights found.';
      return;
    }

    // Display each flight result
    data.Itineraries.items.forEach((item, index) => {
      const carrierIds = item.legs[0].carriers;
      const airlineNames = carrierIds.map(id => carrierMap[id] || id).join(', ');

      const flightDiv = document.createElement('div');
      flightDiv.className = 'flight-result';
      flightDiv.innerHTML = `
        <p><strong>Airline:</strong> ${airlineNames}</p>
        <p><strong>Price:</strong> ₹${item.price.amount}</p>
        <p><strong>Departure:</strong> ${item.legs[0].departure}</p>
        <p><strong>Arrival:</strong> ${item.legs[0].arrival}</p>
      `;
      resultDiv.appendChild(flightDiv);
    });
  } catch (err) {
    console.error('Error fetching:', err);
    document.querySelector('#results').textContent = 'Failed to fetch flight data.';
  }
});
