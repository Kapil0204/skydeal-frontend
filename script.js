const form = document.querySelector('form');
const outboundResults = document.getElementById('outboundResults');
const returnResults = document.getElementById('returnResults');

form.addEventListener('submit', function (e) {
  e.preventDefault();

  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const dateFrom = document.getElementById('dateFrom').value;
  const dateTo = document.getElementById('dateTo').value;
  const isOneWay = document.getElementById('oneWay').checked;
  const passengers = document.getElementById('passengers').value;
  const travelClass = document.getElementById('travelClass').value;
  const paymentMethods = Array.from(document.getElementById('paymentMethods').selectedOptions).map(opt => opt.value);

  // Simulated flight data
  const flights = [
    {
      name: 'IndiGo',
      departure: '08:30',
      arrival: '10:45',
      basePrice: 5000,
    },
    {
      name: 'Air India',
      departure: '09:00',
      arrival: '11:20',
      basePrice: 5500,
    },
    {
      name: 'SpiceJet',
      departure: '13:15',
      arrival: '15:30',
      basePrice: 6000,
    }
  ];

  const offers = {
    'ICICI Bank': { portal: 'EaseMyTrip', discount: 10, code: 'SKYICICI10' },
    'HDFC Bank': { portal: 'Goibibo', discount: 8, code: 'SKYHDFC8' },
    'SBI': { portal: 'MakeMyTrip', discount: 5, code: 'SKYSBI5' },
    'Axis Bank': { portal: 'Cleartrip', discount: 6, code: 'SKYAXIS6' },
    'Kotak Bank': { portal: 'EaseMyTrip', discount: 4, code: 'SKYKOTAK4' },
  };

  outboundResults.innerHTML = '';
  returnResults.innerHTML = '';

  function createCard(flight) {
    let bestOffer = null;
    let lowestPrice = flight.basePrice;

    for (const method of paymentMethods) {
      if (offers[method]) {
        const offer = offers[method];
        const discounted = flight.basePrice * (1 - offer.discount / 100);
        if (discounted < lowestPrice) {
          lowestPrice = discounted;
          bestOffer = offer;
        }
      }
    }

    const card = document.createElement('div');
    card.className = 'flight-card';
    card.innerHTML = `
      <p><strong>Flight:</strong> ${flight.name}</p>
      <p><strong>Departure:</strong> ${flight.departure}</p>
      <p><strong>Arrival:</strong> ${flight.arrival}</p>
      <p><strong>Best Deal:</strong> 
        ${bestOffer ? `${bestOffer.portal} – ${bestOffer.discount}% off (Use: ${bestOffer.code}) – ₹${lowestPrice.toFixed(0)}` : 'No offer available'}
        <button class="info-btn" title="Compare all portals">i</button>
      </p>
    `;
    return card;
  }

  flights.forEach(flight => {
    outboundResults.appendChild(createCard(flight));
    if (!isOneWay) returnResults.appendChild(createCard(flight));
  });
});
