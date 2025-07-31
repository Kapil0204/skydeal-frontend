console.log("Script loaded");

const baseUrl = 'https://skydeal-backend.onrender.com';

document.getElementById('searchBtn').addEventListener('click', async () => {
  console.log("Search button clicked");

  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const departureDate = document.getElementById('departureDate').value;
  const returnDate = document.getElementById('returnDate').value;
  const passengers = parseInt(document.getElementById('passengers').value);
  const travelClass = document.getElementById('travelClass').value;
  const paymentMethods = Array.from(document.querySelectorAll('input[name="paymentMethod"]:checked')).map(cb => cb.value);
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const payload = {
    from,
    to,
    departureDate,
    returnDate,
    passengers,
    travelClass,
    paymentMethods,
    tripType
  };

  console.log("Sending payload: ", payload);

  try {
    const res = await fetch(`${baseUrl}/simulated-flights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("Received data:", data);
    renderFlights(data);
  } catch (err) {
    console.error("❌ Error fetching flights:", err);
  }
});

function renderFlights(data) {
  const outboundSection = document.getElementById('outboundFlights');
  const returnSection = document.getElementById('returnFlights');

  outboundSection.innerHTML = '';
  returnSection.innerHTML = '';

  if (data.outboundFlights.length > 0) {
    data.outboundFlights.forEach(flight => {
      const card = createFlightCard(flight, 'Outbound');
      outboundSection.appendChild(card);
    });
  } else {
    outboundSection.innerHTML = '<p>No outbound flights found.</p>';
  }

  if (data.returnFlights && data.returnFlights.length > 0) {
    data.returnFlights.forEach(flight => {
      const card = createFlightCard(flight, 'Return');
      returnSection.appendChild(card);
    });
  } else {
    returnSection.innerHTML = '<p>No return flights found.</p>';
  }
}

function createFlightCard(flight, type) {
  const card = document.createElement('div');
  card.classList.add('flight-card');

  const bestDealText = flight.bestDeal
    ? `<strong>Best Deal:</strong> ${flight.bestDeal.portal} - ${flight.bestDeal.offer} (Code: ${flight.bestDeal.code})<br><strong>Price:</strong> ₹${flight.bestDeal.price}`
    : `<em>No offer available</em>`;

  card.innerHTML = `
    <h4>${flight.flightName}</h4>
    <p><strong>Departure:</strong> ${flight.departure}</p>
    <p><strong>Arrival:</strong> ${flight.arrival}</p>
    <p>${bestDealText}</p>
    <button class="info-btn" onclick="showPortalPopup(${JSON.stringify(flight.bestDeal || {}).replace(/"/g, '&quot;')})">i</button>
  `;

  return card;
}

function showPortalPopup(bestDeal) {
  if (!bestDeal || !bestDeal.portal) {
    alert('No detailed pricing available.');
    return;
  }

  alert(
    `Portal: ${bestDeal.portal}\nOffer: ${bestDeal.offer}\nCoupon Code: ${bestDeal.code}\nPrice: ₹${bestDeal.price}`
  );
}
