document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('flight-search-form');
  const tripTypeInputs = document.getElementsByName('tripType');
  const returnDateGroup = document.getElementById('return-date-group');
  const outboundResultsDiv = document.getElementById('outbound-results');
  const returnResultsDiv = document.getElementById('return-results');

  tripTypeInputs.forEach(input => {
    input.addEventListener('change', () => {
      returnDateGroup.style.display = input.value === 'round-trip' ? 'block' : 'none';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    outboundResultsDiv.innerHTML = '';
    returnResultsDiv.innerHTML = '';

    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const departureDate = document.getElementById('departure-date').value;
    const returnDate = document.getElementById('return-date').value;
    const passengers = parseInt(document.getElementById('passengers').value);
    const travelClass = document.getElementById('travel-class').value;
    const tripType = document.querySelector('input[name="tripType"]:checked').value;

    try {
      const response = await fetch('https://skydeal-backend.onrender.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: from,
          destination: to,
          departureDate,
          returnDate,
          passengers,
          travelClass,
          tripType
        })
      });

      const data = await response.json();
      const flights = data.flights || [];

      if (!flights.length) {
        outboundResultsDiv.innerHTML = '<p>No flights found.</p>';
        return;
      }

      flights.forEach((flight, index) => {
        const segment = flight.itineraries[0].segments[0];
        const airline = segment.carrierCode;
        const flightNumber = segment.number;
        const departure = segment.departure.at.slice(11, 16); // "HH:MM"
        const arrival = segment.arrival.at.slice(11, 16);
        const price = parseFloat(flight.price.total);

        const div = document.createElement('div');
        div.className = 'flight-card';
        div.innerHTML = `
          <p><strong>${airline}</strong> - ${flightNumber}</p>
          <p>Depart: ${departure} → Arrive: ${arrival}</p>
          <p>Price: ₹${price}</p>
          <button class="price-btn" data-price="${price}" data-airline="${airline}" data-number="${flightNumber}">View Prices</button>
        `;
        outboundResultsDiv.appendChild(div);
      });

      document.querySelectorAll('.price-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const basePrice = parseFloat(btn.dataset.price);
          const airline = btn.dataset.airline;
          const number = btn.dataset.number;

          alert(
            `Pricing for ${airline} ${number}:\n` +
            `• MakeMyTrip: ₹${basePrice + 100}\n` +
            `• Goibibo: ₹${basePrice + 100}\n` +
            `• Yatra: ₹${basePrice + 100}\n` +
            `• Cleartrip: ₹${basePrice + 100}\n` +
            `• EaseMyTrip: ₹${basePrice + 100}`
          );
        });
      });

    } catch (error) {
      console.error('Error fetching flights:', error);
      alert('Failed to fetch flights.');
    }
  });
});

