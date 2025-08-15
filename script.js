// ===== Config =====
const BACKEND_URL = "https://skydeal-backend.onrender.com"; // your deployed backend

// Keep track of results for sorting
let currentOutboundFlights = [];
let currentReturnFlights = [];

// ===== Dropdown toggle + click-outside =====
window.toggleDropdown = function () {
  const menu = document.getElementById("dropdownMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
};

window.addEventListener("click", (e) => {
  const dropdown = document.getElementById("dropdownMenu");
  const toggle = e.target.closest(".dropdown-toggle");
  if (!toggle && dropdown && !dropdown.contains(e.target)) {
    dropdown.style.display = "none";
  }
});

// ===== Helpers to build the payment methods table =====
function filterGenericMethods(list) {
  const GENERIC = /^(credit card|debit card|bank offers?|netbanking|upi|wallet)$/i;
  return list.filter(label => !GENERIC.test(label.trim()));
}

function classify(label) {
  const s = label.toLowerCase();
  const isUPI = /\bupi\b/.test(s);
  const isNB = /\bnet\s*banking|netbanking\b/.test(s);
  const isWallet = /\bwallet\b/.test(s);
  const isCC = /\bcredit\b/.test(s);
  const isEMI = /\bemi\b/.test(s); // we won't display EMI separately, but bucket to credit
  const isDC = /\bdebit\b/.test(s);

  let type = null;
  if (isUPI) type = "upi";
  else if (isNB) type = "netbanking";
  else if (isWallet) type = "wallet";
  else if (isCC || isEMI) type = "credit";
  else if (isDC) type = "debit";
  else type = "credit";

  let bank = label.replace(/(credit|debit)\s*card.*$/i, "")
                  .replace(/\bemi\b.*$/i, "")
                  .replace(/\bnet\s*banking|netbanking|wallet|upi/i, "")
                  .trim();
  bank = bank || label;
  return { type, bank, label };
}

function renderPaymentMethodsTable(methods) {
  const groups = { credit: [], debit: [], upi: [], netbanking: [], wallet: [] };
  methods.forEach(m => {
    const c = classify(m);
    if (groups[c.type]) groups[c.type].push(c);
  });

  Object.keys(groups).forEach(k => {
    groups[k].sort((a,b) => a.bank.localeCompare(b.bank));
  });

  const menu = document.getElementById("dropdownMenu");
  if (!menu) return;
  menu.innerHTML = "";

  const table = document.createElement("table");
  table.className = "pm-table";
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Credit Cards</th>
      <th>Debit Cards</th>
      <th>UPI</th>
      <th>Netbanking</th>
      <th>Wallets</th>
    </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const row = document.createElement("tr");

  function colFor(kind, items) {
    const td = document.createElement("td");
    td.className = "pm-col";
    items.forEach(({ label }) => {
      const lbl = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = label; // keep original label -> backend fuzzy matches
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(" " + label));
      td.appendChild(lbl);
    });
    const other = document.createElement("label");
    const ocb = document.createElement("input");
    ocb.type = "checkbox";
    ocb.value = `Other ${kind}`;
    other.appendChild(ocb);
    other.appendChild(document.createTextNode(" Other"));
    td.appendChild(other);
    return td;
  }

  row.appendChild(colFor("Credit Card", groups.credit));
  row.appendChild(colFor("Debit Card", groups.debit));
  row.appendChild(colFor("UPI", groups.upi));
  row.appendChild(colFor("Netbanking", groups.netbanking));
  row.appendChild(colFor("Wallet", groups.wallet));

  tbody.appendChild(row);
  table.appendChild(tbody);
  menu.appendChild(table);
}

async function loadPaymentMethods() {
  try {
    const resp = await fetch(`${BACKEND_URL}/payment-methods`);
    const { methods = [] } = await resp.json();
    renderPaymentMethodsTable(filterGenericMethods(methods));
  } catch (e) {
    console.error("Failed to load payment methods", e);
    renderPaymentMethodsTable([]);
  }
}

// ===== Modal (portal prices) =====
function showPortalPrices(flight) {
  const modal = document.getElementById("priceModal");
  const list = document.getElementById("portalPriceList");
  list.innerHTML = "";

  const rows = Array.isArray(flight.portalPrices) && flight.portalPrices.length
    ? flight.portalPrices.map(p => {
        const applied = p.appliedOffer;
        const coupon = applied && applied.couponCode ? ` (Coupon: ${applied.couponCode})` : "";
        const final = applied ? ` → ₹${Number(p.finalPrice).toLocaleString()}` : "";
        return `${p.portal}: ₹${Number(p.basePrice).toLocaleString()}${final}${coupon}`;
      })
    : [
        `MakeMyTrip: ₹${(parseFloat(flight.price) + 100).toFixed(0)}`,
        `Goibibo: ₹${(parseFloat(flight.price) + 150).toFixed(0)}`,
        `EaseMyTrip: ₹${(parseFloat(flight.price) + 200).toFixed(0)}`,
        `Yatra: ₹${(parseFloat(flight.price) + 250).toFixed(0)}`,
        `Cleartrip: ₹${(parseFloat(flight.price) + 300).toFixed(0)}`
      ];

  rows.forEach(text => {
    const li = document.createElement("li");
    li.textContent = text;
    list.appendChild(li);
  });

  modal.style.display = "flex";
}

// close modal (X or outside)
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("priceModal");
  const closeBtn = document.getElementById("closeModal");
  if (closeBtn) closeBtn.addEventListener("click", () => { modal.style.display = "none"; });
  window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
});

// ===== Flight rendering & sorting =====
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

window.sortFlights = function (key) {
  const sortByDeparture = (a, b) => a.departure.localeCompare(b.departure);
  const sortByPrice = (a, b) => parseFloat(a.price) - parseFloat(b.price);

  let outboundSorted = [...currentOutboundFlights];
  let returnSorted = [...currentReturnFlights];

  if (key === "departure") {
    outboundSorted.sort(sortByDeparture);
    returnSorted.sort(sortByDeparture);
  } else if (key === "price") {
    outboundSorted.sort(sortByPrice);
    returnSorted.sort(sortByPrice);
  }

  displayFlights(outboundSorted, document.getElementById("outboundContainer"));
  displayFlights(returnSorted, document.getElementById("returnContainer"));
};

// ===== Search handler =====
document.addEventListener("DOMContentLoaded", () => {
  // default hide return date
  const returnDateInput = document.getElementById("returnDate");
  returnDateInput.style.display = "none";

  // Toggle return date by trip type
  const tripTypeRadios = document.getElementsByName("tripType");
  tripTypeRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      returnDateInput.style.display = radio.value === "round-trip" && radio.checked ? "" : "none";
    });
  });

  // Load dynamic payment methods table
  loadPaymentMethods();

  const searchForm = document.getElementById("searchForm");
  const outboundContainer = document.getElementById("outboundContainer");
  const returnContainer = document.getElementById("returnContainer");

  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const from = document.getElementById("from").value.trim().toUpperCase();
    const to = document.getElementById("to").value.trim().toUpperCase();
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value || null;
    const passengers = parseInt(document.getElementById("passengers").value, 10) || 1;
    const travelClass = document.getElementById("travelClass").value;
    const tripType = Array.from(document.getElementsByName("tripType")).find(r => r.checked)?.value || "one-way";

    // Collect selected methods, skip “Other …”
    const selectedPaymentMethods = Array.from(
      document.querySelectorAll('#dropdownMenu input[type="checkbox"]:checked')
    ).map(cb => cb.value).filter(v => !/^Other\b/i.test(v));

    outboundContainer.innerHTML = "";
    returnContainer.innerHTML = "";
    document.getElementById("sortControls").style.display = "none";

    try {
      const response = await fetch(`${BACKEND_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from, to, departureDate, returnDate,
          passengers, travelClass, tripType,
          paymentMethods: selectedPaymentMethods
        })
      });

      const data = await response.json();

      currentOutboundFlights = data.outboundFlights || [];
      currentReturnFlights = data.returnFlights || [];

      displayFlights(currentOutboundFlights, outboundContainer);
      displayFlights(currentReturnFlights, returnContainer);

      // Show sort controls only if we have results
      if ((currentOutboundFlights.length + currentReturnFlights.length) > 0) {
        document.getElementById("sortControls").style.display = "";
      }
    } catch (err) {
      console.error(err);
      alert("Failed to fetch flights. Please try again.");
    }
  });
});


