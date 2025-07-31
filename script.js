document.getElementById('searchBtn').addEventListener('click', async () => {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const departureDate = document.getElementById('departure').value;
  const passengers = parseInt(document.getElementById('passengers').value);
  const travelClass = document.getElementById('travelClass').value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const requestBody = {
    from,
    to,
    departureDate,
    passengers,
    travelClass,
    tripType
  };

  try {
    const res = await fetch('https://skydeal-backend.onrender.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const flights = await res.json();
    renderFlights(flights);
  } catch (error) {
    alert('Error fetching flights');
  }
});

function renderFlights(flights) {
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = '';

  if (!flights.length) {
    resultsContainer.innerHTML = '<p>No flights found.</p>';
    return;
  }

  flights.forEach((flight, index) => {
    const div = document.createElement('div');
    div.className = 'flight-card';
    div.innerHTML = `
      <p><strong>${flight.airline}</strong> ${flight.flightNumber}</p>
      <p>${flight.departureTime} → ${flight.arrivalTime}</p>
      <p>₹${flight.price}</p>
      <button onclick="showPricePopup(${flight.price})">Compare OTA Prices</button>
    `;
    resultsContainer.appendChild(div);
  });
}

function showPricePopup(basePrice) {
  const modal = document.getElementById('priceModal');
  const content = document.getElementById('modalContent');
  content.innerHTML = `
    <h3>OTA Prices</h3>
    <ul>
      <li>MakeMyTrip: ₹${basePrice + 100}</li>
      <li>Goibibo: ₹${basePrice + 100}</li>
      <li>Cleartrip: ₹${basePrice + 100}</li>
      <li>Yatra: ₹${basePrice + 100}</li>
      <li>EaseMyTrip: ₹${basePrice + 100}</li>
    </ul>
    <button onclick="closeModal()">Close</button>
  `;
  modal.style.display = 'block';
}

function closeModal() {
  document.getElementById('priceModal').style.display = 'none';
}
