document.getElementById('searchForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const flyFrom = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const date = document.getElementById('date').value;
  const returnDate = document.getElementById('returnDate').value;
  const passengers = document.getElementById('passengers').value;
  const travelClass = document.getElementById('travelClass').value;
  const oneWay = document.getElementById('oneWay').checked;
  const paymentOptions = Array.from(document.getElementById('paymentMethod').selectedOptions).map(opt => opt.value);

  const resultsOutbound = document.getElementById('outboundFlights');
  const resultsReturn = document.getElementById('returnFlights');
  resultsOutbound.innerHTML = '';
  resultsReturn.innerHTML = '';

  const dummyFlights = [
    { name: "IndiGo", dep: "08:30", arr: "10:45" },
    { name: "Air India", dep: "09:00", arr: "11:20" },
    { name: "SpiceJet", dep: "13:15", arr: "15:30" },
    { name: "Vistara", dep: "18:00", arr: "20:15" }
  ];

  const portals = [
    { name: "MakeMyTrip", offers: { ICICI: "10% off", HDFC: "8% off" } },
    { name: "Goibibo", offers: { SBI: "₹500 off", Kotak: "7% off" } },
    { name: "EaseMyTrip", offers: { HDFC: "₹300 off", Axis: "5% off" } }
  ];

  function getBestDeal(paymentOptions) {
    for (const portal of portals) {
      for (const pay of paymentOptions) {
        if (portal.offers[pay]) {
          return {
            portal: portal.name,
            offer: portal.offers[pay],
            code: "SKYDEAL10"
          };
        }
      }
    }
    return {
      portal: "SkyDeal",
      offer: "Standard Fare",
      code: "N/A"
    };
  }

  function showFlights(sectionEl) {
    dummyFlights.forEach((flight, idx) => {
      const deal = getBestDeal(paymentOptions);

      const card = document.createElement('div');
      card.className = 'flight-card';
      card.innerHTML = `
        <p><strong>Flight:</strong> ${flight.name}</p>
        <p><strong>Departure:</strong> ${flight.dep}</p>
        <p><strong>Arrival:</strong> ${flight.arr}</p>
        <p><strong>Best Deal:</strong> ${deal.portal} - ${deal.offer} <span class="offer-code">(Use: ${deal.code})</span></p>
        <button class="info-btn" data-index="${idx}">i</button>
      `;
      sectionEl.appendChild(card);
    });
  }

  showFlights(resultsOutbound);
  if (!oneWay) {
    showFlights(resultsReturn);
  }

  // Modal logic
  document.querySelectorAll('.info-btn').forEach(button => {
    button.addEventListener('click', function () {
      const modal = document.getElementById('portalModal');
      const modalContent = document.getElementById('modalContent');
      modalContent.innerHTML = '';

      portals.forEach(portal => {
        const li = document.createElement('li');
        const offers = Object.entries(portal.offers)
          .map(([bank, offer]) => `${bank}: ${offer}`)
          .join(', ');
        li.innerHTML = `<strong>${portal.name}</strong>: ${offers} <button onclick="alert('Go to ${portal.name}')">🔗</button>`;
        modalContent.appendChild(li);
      });

      modal.style.display = 'block';
    });
  });

  document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('portalModal').style.display = 'none';
  });

  window.onclick = function (event) {
    const modal = document.getElementById('portalModal');
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
});
