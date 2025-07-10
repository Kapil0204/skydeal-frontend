document.addEventListener('DOMContentLoaded', () => {
  const roundTripCheckbox = document.getElementById('roundTrip');
  const returnDateField = document.getElementById('returnDate');
  const dropdownBtn = document.getElementById('dropdownButton');
  const dropdownOptions = document.getElementById('dropdownOptions');

  roundTripCheckbox.addEventListener('change', () => {
    returnDateField.disabled = roundTripCheckbox.checked;
    returnDateField.value = '';
  });

  dropdownBtn.addEventListener('click', () => {
    dropdownOptions.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.multiselect-wrapper')) {
      dropdownOptions.classList.add('hidden');
    }
  });

  document.getElementById('searchForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const date = document.getElementById('date').value;
    const returnDate = document.getElementById('returnDate').value;
    const passengers = document.getElementById('passengers').value;
    const travelClass = document.getElementById('travelClass').value;
    const oneWay = roundTripCheckbox.checked;

    const selectedPayments = Array.from(dropdownOptions.querySelectorAll('input:checked')).map(i => i.value);

    const bestPortal = {
      "ICICI Bank": { portal: "MakeMyTrip", discount: "10%", code: "SKYICICI10", price: 4900 },
      "HDFC Bank": { portal: "Goibibo", discount: "7%", code: "SKYHDFC7", price: 5100 },
      "SBI": { portal: "EaseMyTrip", discount: "5%", code: "SKYDEAL10", price: 5200 },
      "Axis Bank": { portal: "Yatra", discount: "6%", code: "SKYAXIS6", price: 5050 },
      "Kotak Bank": { portal: "ClearTrip", discount: "8%", code: "SKYKOTAK8", price: 4950 }
    };

    const flights = [
      { name: 'IndiGo', dep: '08:30', arr: '10:45' },
      { name: 'Air India', dep: '09:00', arr: '11:20' },
      { name: 'SpiceJet', dep: '13:15', arr: '15:30' }
    ];

    const outbound = document.getElementById('outboundResults');
    const inbound = document.getElementById('returnResults');
    outbound.innerHTML = '';
    inbound.innerHTML = '';

    flights.forEach(flight => {
      const best = selectedPayments.length ? bestPortal[selectedPayments[0]] : bestPortal["SBI"];
      const div = document.createElement('div');
      div.className = 'flight-card';
      div.innerHTML = `
        <p><strong>Flight:</strong> ${flight.name}</p>
        <p><strong>Departure:</strong> ${flight.dep}</p>
        <p><strong>Arrival:</strong> ${flight.arr}</p>
        <p><strong>Best Deal:</strong> ${best.portal} – ${best.discount} off (Use: ${best.code}) ₹${best.price}
        <button class="info-button" onclick="alert('Portal pricing comparison coming soon')">i</button></p>
      `;
      outbound.appendChild(div);

      if (!oneWay) {
        const div2 = div.cloneNode(true);
        inbound.appendChild(div2);
      }
    });
  });
});
