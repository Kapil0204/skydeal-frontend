document.querySelector('form').addEventListener('submit', function (e) {
  e.preventDefault();

  const from = document.querySelector('#from').value;
  const to = document.querySelector('#to').value;
  const departureDate = document.querySelector('#departure-date').value;
  const returnDate = document.querySelector('#return-date').value;
  const isOneWay = document.querySelector('#one-way').checked;
  const passengers = document.querySelector('#passengers').value;
  const travelClass = document.querySelector('#travel-class').value;

  const selectedOptions = Array.from(document.querySelector('#payment-methods').selectedOptions);
  const selectedPayments = selectedOptions.map(option => option.value);

  document.querySelector('#outbound-flights').innerHTML = '';
  document.querySelector('#return-flights').innerHTML = '';

  const dummyFlights = [
    { airline: 'IndiGo', departure: '08:30', arrival: '10:45' },
    { airline: 'Air India', departure: '09:00', arrival: '11:20' },
    { airline: 'SpiceJet', departure: '13:15', arrival: '15:30' },
    { airline: 'Vistara', departure: '18:00', arrival: '20:15' },
  ];

  const portals = [
    { name: 'MakeMyTrip', discount: '10% off', code: 'SKYDEAL10', paymentMethod: 'ICICI Bank' },
    { name: 'EaseMyTrip', discount: '5% off', code: 'SKYDEAL5', paymentMethod: 'HDFC Bank' },
    { name: 'Goibibo', discount: '15% off', code: 'SKYGO15', paymentMethod: 'Axis Bank' },
    { name: 'Cleartrip', discount: '7% off', code: 'SKYCLR7', paymentMethod: 'SBI' },
    { name: 'Yatra', discount: '12% off', code: 'SKYYATRA12', paymentMethod: 'Kotak Bank' },
  ];

  function getBestDeal(paymentOptions) {
    for (let method of paymentOptions) {
      const deal = portals.find(p => p.paymentMethod === method);
      if (deal) return deal;
    }
    return { name: 'EaseMyTrip', discount: '5% off', code: 'SKYDEAL10' };
  }

  function createFlightCard(flight, bestDeal) {
    const div = document.createElement('div');
    div.className = 'flight-card';
    div.innerHTML = `
      <p><strong>Flight:</strong> ${flight.airline}</p>
      <p><strong>Departure:</strong> ${flight.departure}</p>
      <p><strong>Arrival:</strong> ${flight.arrival}</p>
      <p><strong>Best Deal:</strong> ${bestDeal.name} - ${bestDeal.discount} (Use: ${bestDeal.code})
        <button class="info-button" onclick="alert('Comparing prices on all portals...')">i</button></p>
    `;
    return div;
  }

  const outboundContainer = document.querySelector('#outbound-flights');
  const returnContainer = document.querySelector('#return-flights');

  dummyFlights.forEach(flight => {
    const bestDeal = getBestDeal(selectedPayments);
    outboundContainer.appendChild(createFlightCard(flight, bestDeal));
    if (!isOneWay) {
      returnContainer.appendChild(createFlightCard(flight, bestDeal));
    }
  });
});
