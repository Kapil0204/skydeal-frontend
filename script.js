// script.js

document.getElementById("flight-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  const origin = document.getElementById("from").value;
  const destination = document.getElementById("to").value;
  const departDate = document.getElementById("departDate").value;
  const returnDate = document.getElementById("returnDate").value;
  const isOneWay = document.getElementById("oneWay").checked;
  const passengers = document.getElementById("passengers").value;
  const travelClass = document.getElementById("travelClass").value;

  const selectedPayments = Array.from(document.getElementById("paymentOptions").selectedOptions).map(
    (opt) => opt.value
  );

  const paymentMethod = selectedPayments.join(",");

  const outboundResults = document.getElementById("outbound-results");
  const returnResults = document.getElementById("return-results");
  outboundResults.innerHTML = "<p>Searching...</p>";
  returnResults.innerHTML = "<p>Searching...</p>";

  const fetchSimulatedFlights = async (direction) => {
    const response = await fetch(
      `https://skydeal-backend.onrender.com/simulated-flights?direction=${direction}`
    );
    return await response.json();
  };

  const simulatedOffers = await fetch("https://skydeal-backend.onrender.com/simulated-offers").then((res) =>
    res.json()
  );

  const getBestOffer = (portalPrices) => {
    let best = null;
    portalPrices.forEach((p) => {
      if (
        selectedPayments.some((method) =>
          p.offers?.some((offer) => offer.paymentMethod.toLowerCase() === method.toLowerCase())
        )
      ) {
        if (!best || p.price < best.price) best = p;
      }
    });
    return best;
  };

  const displayFlights = (flights, containerId) => {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    flights.forEach((flight, idx) => {
      const bestPortal = getBestOffer(flight.portalPrices);
      const offerText = bestPortal
        ? `${bestPortal.name}: ₹${bestPortal.price} \n${bestPortal.offers
            .filter((o) =>
              selectedPayments.includes(o.paymentMethod.toLowerCase())
            )
            .map((o) => `${o.paymentMethod.toUpperCase()}: ${o.discount}% off - Code: ${o.code}`)
            .join("\n")}`
        : "No offers";

      const el = document.createElement("div");
      el.className = "flight-result";
      el.innerHTML = `
        <p><strong>${flight.name}</strong></p>
        <p>${flight.from} → ${flight.to}</p>
        <p>Departure: ${flight.departure} | Arrival: ${flight.arrival}</p>
        <p class="deal-highlight">Best Deal: ${offerText.split("\n")[0]}</p>
        <button onclick="showPopup(${idx}, '${containerId}')">i</button>
        <div id="popup-${containerId}-${idx}" class="popup" style="display:none">
          <div class="popup-header">
            <h3>${flight.name}</h3>
            <span class="close-popup" onclick="closePopup('${containerId}-${idx}')">×</span>
          </div>
          <p>Compare Deals:</p>
          <ul>
            ${flight.portalPrices
              .map(
                (p) => `
              <li>
                <strong>${p.name}</strong>: ₹${p.price}<br/>
                ${p.offers
                  .map(
                    (o) =>
                      `${o.paymentMethod.toUpperCase()}: ${o.discount}% off - Code: ${o.code}`
                  )
                  .join("<br/>")}
              </li>`
              )
              .join("")}
          </ul>
        </div>
      `;
      container.appendChild(el);
    });
  };

  const [outboundFlights, returnFlights] = await Promise.all([
    fetchSimulatedFlights("outbound"),
    isOneWay ? Promise.resolve([]) : fetchSimulatedFlights("return"),
  ]);

  displayFlights(outboundFlights, "outbound-results");
  if (!isOneWay) displayFlights(returnFlights, "return-results");
});

function showPopup(index, type) {
  document.getElementById(`popup-${type}-${index}`).style.display = "block";
}

function closePopup(id) {
  document.getElementById(`popup-${id}`).style.display = "none";
}
