document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('flight-search-form');
  const tripTypeInputs = document.getElementsByName('tripType');
  const returnDateGroup = document.getElementById('return-date-group');
  const outboundResultsDiv = document.getElementById('outbound-results');
  const returnResultsDiv = document.getElementById('return-results');

  tripTypeInputs.forEach(input => {
    input.addEventListener('change', () => {
      if (input.value === 'round-trip') {
        returnDateGroup.style.display = 'block';
      } else {
        returnDateGroup.style.display = 'none';
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous results
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

      const showFlights = (flights, container) => {
        if (!flights.length) {
          container.innerHTML = '<p>No flights found.</p>';
          return;
        }

        flights.forEach((flight, index) => {
          const div = document.createElement('div');
          div.className = 'flight-card';
          div.innerHTML = `
            <p><strong>${flight.airline}</strong> - ${flight.flightNumber}</p>
            <p>Depart: ${flight.departure} → Arrive: ${flight.arrival}</p>
            <p>Price: ₹${flight.price}</p>
            <button class="price-btn" data-price="${flight.price}" data-airline="${flight.airline}" data-number="${flight.flightNumber}">View Prices</button>
          `;
          container.appendChild(div);
        });
      };

      showFlights(data.outboundFlights, outboundResultsDiv);
      showFlights(data.returnFlights, returnResultsDiv);

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
