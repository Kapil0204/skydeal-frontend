document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('searchForm');
  const outboundSection = document.getElementById('outboundFlights');
  const returnSection = document.getElementById('returnFlights');
  const returnDateGroup = document.getElementById('returnDateGroup');
  const tripTypeRadios = document.getElementsByName('tripType');

  // Toggle return date input
  tripTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (document.querySelector('input[name="tripType"]:checked').value === 'round-trip') {
        returnDateGroup.style.display = 'block';
        returnSection.style.display = 'block';
      } else {
        returnDateGroup.style.display = 'none';
        returnSection.style.display = 'none';
      }
    });
  });

  // Handle form submit
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetchFlights();
  });

  async function fetchFlights() {
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const departureDate = document.getElementById('departureDate').value;
    const returnDate = document.getElementById('returnDate').value;
    const tripType = document.querySelector('input[name="tripType"]:checked').value;
    const travelClass = document.getElementById('travelClass').value;
    const passengers = document.getElementById('passengers').value;

    try {
      const res = await fetch('https://skydeal-backend.onrender.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to,
          departureDate,
          returnDate: tripType === 'round-trip' ? returnDate : '',
          travelClass,
          passengers,
          tripType
        })
      });

      if (!res.ok) throw new Error('Failed to fetch flights');

      const data = await res.json();
      displayFlights(data.outboundFlights || [], outboundSection);
      displayFlights(data.returnFlights || [], returnSection);
    } catch (error) {
      console.error('Error fetching flights:', error);
    }
  }

  function displayFlights(flights, container) {
    container.innerHTML = ''; // Clear existing
    if (flights.length === 0) {
      container.innerHTML = '<p>No flights found.</p>';
      return;
    }

    flights.forEach(flight => {
      const card = document.createElement('div');
      card.className = 'flight-card';
      card.innerHTML = `
        <h4>${flight.flightName}</h4>
        <p>Departure: ${flight.departure}</p>
        <p>Arrival: ${flight.arrival}</p>
        <p>Price: ₹${flight.price || 'N/A'}</p>
      `;
      container.appendChild(card);
    });
  }
});
