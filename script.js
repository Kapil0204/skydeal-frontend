document.querySelector('#searchForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const from = document.querySelector('#from').value;
  const to = document.querySelector('#to').value;
  const dateFrom = document.querySelector('#dateFrom').value;
  const dateTo = document.querySelector('#dateTo').value;
  const oneWay = document.querySelector('#oneWay').checked;
  const passengers = document.querySelector('#passengers').value;
  const travelClass = document.querySelector('#travelClass').value;
  const paymentOptions = Array.from(document.querySelector('#paymentOptions').selectedOptions).map(opt => opt.value);

  // Simulated static data for now
  const flights = [
    {
      airline: 'IndiGo',
      departure: '08:30',
      arrival: '10:45',
    },
    {
      airline: 'Air India',
      departure: '09:00',
      arrival: '11:20',
    },
    {
      airline: 'SpiceJet',
      departure: '13:15',
      arrival: '15:30',
    }
  ];

  const bestDeal = {
    portal: 'EaseMyTrip',
    discount: '5% off',
    code: 'SKYDEAL10'
  };

  const container = (flightsArray) => {
    return flightsArray.map(flight => `
      <div class="flight-result">
        <p><strong>Flight:</strong> ${flight.airline}</p>
        <p><strong>Departure:</strong> ${flight.departure}</p>
        <p><strong>Arrival:</strong> ${flight.arrival}</p>
        <p><strong>Best Deal:</strong> ${bestDeal.portal} – ${bestDeal.discount} (Use: ${bestDeal.code})
          <button class="info-button" onclick="alert('Portal Comparison Coming Soon')">i</button>
        </p>
      </div>`).join('');
  };

  document.querySelector('#outbound-flights').innerHTML = container(flights);
  document.querySelector('#return-flights').innerHTML = oneWay ? '' : container(flights);
});
