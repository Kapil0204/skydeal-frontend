document.getElementById('searchForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const departure = document.getElementById('departure').value;
  const passengers = document.getElementById('passengers').value;
  const travelClass = document.getElementById('travelClass').value;
  const tripType = document.querySelector('input[name="tripType"]:checked').value;

  const payload = {
    from,
    to,
    departureDate: departure,
    returnDate: tripType === 'round-trip' ? departure : '',
    passengers,
    travelClass,
    tripType
  };

  try {
    const res = await fetch('https://skydeal-backend.onrender.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    document.getElementById('results').innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  } catch (err) {
    console.error(err);
    alert("Something went wrong. Check network and backend CORS.");
  }
});
