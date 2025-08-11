document.addEventListener("DOMContentLoaded", () => {
// Load all active payment methods from backend and fill the dropdown
async function loadPaymentMethods() {
  try {
    const resp = await fetch("https://skydeal-backend.onrender.com/payment-methods");
    const { methods = [] } = await resp.json();
    const menu = document.getElementById("dropdownMenu");
    if (!menu) return;

    // Clear current items, then build fresh from backend
    menu.innerHTML = "";
    methods.forEach((label) => {
      const lbl = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = label;
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(" " + label));
      menu.appendChild(lbl);
    });
  } catch (err) {
    console.error("Failed to load payment methods:", err);
    // Fallback (optional): keep any existing static entries
  }
}

loadPaymentMethods();

  // Toggle dropdown menu
window.toggleDropdown = function () {
  const menu = document.getElementById("dropdownMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
};

// Hide dropdown if clicking outside
window.addEventListener("click", function (e) {
  const dropdown = document.getElementById("paymentDropdown");
  if (!dropdown.contains(e.target)) {
    document.getElementById("dropdownMenu").style.display = "none";
  }
});

  const searchForm = document.getElementById("searchForm");
  const outboundContainer = document.getElementById("outboundContainer");
  const returnContainer = document.getElementById("returnContainer");
  const returnDateInput = document.getElementById("returnDate");
  const tripTypeRadios = document.getElementsByName("tripType");

  let currentOutboundFlights = [];
  let currentReturnFlights = [];

  // Hide return date by default
  returnDateInput.style.display = "none";

  // Toggle return date input
  tripTypeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      const selectedType = document.querySelector('input[name="tripType"]:checked').value;
      returnDateInput.style.display = selectedType === "round-trip" ? "inline" : "none";
    });
  });

  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const from = document.getElementById("from").value.toUpperCase();
    const to = document.getElementById("to").value.toUpperCase();
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = parseInt(document.getElementById("passengers").value);
    const travelClass = document.getElementById("travelClass").value;
    const tripType = document.querySelector('input[name="tripType"]:checked').value;

    outboundContainer.innerHTML = "";
    returnContainer.innerHTML = "";
    document.getElementById("sortControls").style.display = "none";

    try {
      // Get selected payment methods
const selectedPaymentMethods = Array.from(
  document.querySelectorAll('#dropdownMenu input[type="checkbox"]:checked')
).map(cb => cb.value);

const response = await fetch("https://skydeal-backend.onrender.com/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    from,
    to,
    departureDate,
    returnDate,
    passengers,
    travelClass,
    tripType,
    paymentMethods: selectedPaymentMethods
  })
});


      const data = await response.json();

      // Save flights for sorting
      currentOutboundFlights = data.outboundFlights || [];
      currentReturnFlights = data.returnFlights || [];

      displayFlights(currentOutboundFlights, outboundContainer);
      displayFlights(currentReturnFlights, returnContainer);

      // Show sort buttons
      document.getElementById("sortControls").style.display = "block";
    } catch (error) {
      console.error("Error fetching flights:", error);
      alert("Failed to fetch flights. Please try again.");
    }
  });

  function displayFlights(flights, container) {
    container.innerHTML = "";

    if (!flights || flights.length === 0) {
      container.innerHTML = "<p>No flights found.</p>";
      return;
    }

    flights.forEach((flight) => {
      const card = document.createElement("div");
card.className = "flight-card";
card.innerHTML = `
  <p><strong>${flight.flightNumber}</strong> (${flight.airlineName})</p>
  <p>Departure: ${flight.departure} | Arrival: ${flight.arrival}</p>
  <p>Stops: ${flight.stops}</p>
  <p>Price: ₹${parseFloat(flight.price).toFixed(2)}</p>
`;
card.addEventListener("click", () => showPortalPrices(flight));
container.appendChild(card);
    });
  }

  // Sorting handler
  window.sortFlights = function (key) {
    const sortByDeparture = (a, b) => a.departure.localeCompare(b.departure);
    const sortByPrice = (a, b) => parseFloat(a.price) - parseFloat(b.price);

    const outboundSorted = [...currentOutboundFlights];
    const returnSorted = [...currentReturnFlights];

    if (key === "departure") {
      outboundSorted.sort(sortByDeparture);
      returnSorted.sort(sortByDeparture);
    } else if (key === "price") {
      outboundSorted.sort(sortByPrice);
      returnSorted.sort(sortByPrice);
    }

    displayFlights(outboundSorted, outboundContainer);
    displayFlights(returnSorted, returnContainer);
  };
});
function showPortalPrices(flight) {
  const basePrice = parseFloat(flight.price);
  const portalPrices = [
    { portal: "MakeMyTrip", price: basePrice + 100 },
    { portal: "Goibibo", price: basePrice + 150 },
    { portal: "EaseMyTrip", price: basePrice + 200 },
    { portal: "Yatra", price: basePrice + 250 },
    { portal: "Cleartrip", price: basePrice + 300 },
  ];

  const list = document.getElementById("portalPriceList");
  list.innerHTML = "";
  portalPrices.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.portal}: ₹${p.price.toFixed(2)}`;
    list.appendChild(li);
  });

  document.getElementById("priceModal").style.display = "flex";
}

document.getElementById("closeModal").addEventListener("click", () => {
  document.getElementById("priceModal").style.display = "flex";
});

window.addEventListener("click", (event) => {
  const modal = document.getElementById("priceModal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
});

