// script.js
document.addEventListener("DOMContentLoaded", () => {
  // ---------- Elements ----------
  const searchForm = document.getElementById("searchForm");
  const outboundContainer = document.getElementById("outboundContainer");
  const returnContainer = document.getElementById("returnContainer");
  const returnDateInput = document.getElementById("returnDate");
  const tripTypeRadios = document.getElementsByName("tripType");
  const sortControls = document.getElementById("sortControls");
  const dropdownMenu = document.getElementById("dropdownMenu");
  const pmTableBody = document.getElementById("pmTableBody");

  const priceModal = document.getElementById("priceModal");
  const closeModalBtn = document.getElementById("closeModal");
  const portalPriceList = document.getElementById("portalPriceList");

  const BACKEND = "https://skydeal-backend.onrender.com";

  // ---------- State ----------
  let currentOutboundFlights = [];
  let currentReturnFlights = [];

  // ---------- Trip type: toggle return date ----------
  returnDateInput.style.display = "none";
  tripTypeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (radio.checked && radio.value === "round-trip") {
        returnDateInput.style.display = "";
      } else if (radio.checked && radio.value === "one-way") {
        returnDateInput.style.display = "none";
      }
    });
  });

  // ---------- Payment dropdown behavior ----------
  window.toggleDropdown = function () {
    const menu = document.getElementById("dropdownMenu");
    menu.style.display = (menu.style.display === "block") ? "none" : "block";
  };

  window.addEventListener("click", (e) => {
    const dropdown = document.getElementById("paymentDropdown");
    if (!dropdown.contains(e.target)) {
      document.getElementById("dropdownMenu").style.display = "none";
    }
  });

  // ---------- Helpers ----------
  const numberINR = (n) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  function getSelectedPaymentMethods() {
    const checked = dropdownMenu.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checked).map(cb => cb.value);
  }

  function bestDealFromPortalPrices(portalPrices) {
    if (!Array.isArray(portalPrices) || portalPrices.length === 0) return null;
    // choose minimum finalPrice; if tie keep first
    let best = portalPrices[0];
    for (const p of portalPrices) {
      if (p.finalPrice < best.finalPrice) best = p;
    }
    return best;
  }

  // ---------- Render Payment Methods Table ----------
  function renderPaymentMethodsTable(methods = []) {
    try {
      if (!Array.isArray(methods)) methods = [];

      const normaliseLabel = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

      // filter very generic labels
      const GENERIC_PM = new Set(
        ["credit card", "debit card", "upi", "netbanking", "bank offers", "wallets"].map(normaliseLabel)
      );

      // dedupe
      const seen = new Set();
      const cleaned = [];
      for (const raw of methods) {
        const label = String(raw || "").trim();
        const key = normaliseLabel(label);
        if (!key || GENERIC_PM.has(key)) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(label);
      }

      const buckets = { credit: [], debit: [], upi: [], netbanking: [], wallet: [] };
      for (const label of cleaned) {
        const L = label.toLowerCase();
        if (L.includes("wallet")) buckets.wallet.push(label);
        else if (L.includes("upi")) buckets.upi.push(label);
        else if (L.includes("netbank")) buckets.netbanking.push(label);
        else if (L.includes("debit")) buckets.debit.push(label);
        else buckets.credit.push(label); // default bucket
      }

      const mkCell = (list, groupName) => {
        const div = document.createElement("div");
        for (const text of list) {
          const id = `pm_${groupName}_${normaliseLabel(text).replace(/\W+/g, "_")}`;
          const label = document.createElement("label");
          label.className = "pm-item";
          label.innerHTML = `<input type="checkbox" value="${text}" id="${id}"> ${text}`;
          div.appendChild(label);
        }
        // Always add "Other"
        const otherId = `pm_${groupName}__other`;
        const otherLabel = document.createElement("label");
        otherLabel.className = "pm-item";
        otherLabel.innerHTML = `<input type="checkbox" value="Other ${groupName}" id="${otherId}"> Other`;
        div.appendChild(otherLabel);

        const td = document.createElement("td");
        td.appendChild(div);
        return td;
      };

      pmTableBody.innerHTML = "";
      const tr = document.createElement("tr");
      tr.appendChild(mkCell(buckets.credit, "Credit"));
      tr.appendChild(mkCell(buckets.debit, "Debit"));
      tr.appendChild(mkCell(buckets.upi, "UPI"));
      tr.appendChild(mkCell(buckets.netbanking, "Netbanking"));
      tr.appendChild(mkCell(buckets.wallet, "Wallets"));
      pmTableBody.appendChild(tr);
    } catch (err) {
      console.error("renderPaymentMethodsTable error:", err);
      // Fallback: just render Other cells
      pmTableBody.innerHTML = `
        <tr>
          <td><label class="pm-item"><input type="checkbox" value="Other Credit"> Other</label></td>
          <td><label class="pm-item"><input type="checkbox" value="Other Debit"> Other</label></td>
          <td><label class="pm-item"><input type="checkbox" value="Other UPI"> Other</label></td>
          <td><label class="pm-item"><input type="checkbox" value="Other Netbanking"> Other</label></td>
          <td><label class="pm-item"><input type="checkbox" value="Other Wallets"> Other</label></td>
        </tr>`;
    }
  }

  async function loadPaymentMethods() {
    // Render skeleton quickly
    renderPaymentMethodsTable([]);
    try {
      const resp = await fetch(`${BACKEND}/payment-methods`, { headers: { Accept: "application/json" } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      renderPaymentMethodsTable(data?.methods || []);
    } catch (e) {
      console.error("Failed to load payment methods:", e);
      // Keep skeleton with “Other”
    }
  }

  // ---------- Display Flights ----------
  function buildInfoLine(best) {
    if (!best) return "";
    const p = numberINR(best.finalPrice);
    let line = `Best deal: <strong>${best.portal}</strong> ${p}`;
    if (best.appliedOffer) {
      const methodHint =
        (best.appliedOffer.paymentMethodLabel ? ` with ${best.appliedOffer.paymentMethodLabel}` : "");
      const couponHint =
        (best.appliedOffer.couponCode ? ` (Coupon: ${best.appliedOffer.couponCode})` : "");
      line += `${methodHint}${couponHint}`;
    }
    return line;
  }

  function displayFlights(flights, container) {
    container.innerHTML = "";

    if (!flights || flights.length === 0) {
      container.innerHTML = "<p>No flights found.</p>";
      return;
    }

    flights.forEach((flight) => {
      const card = document.createElement("div");
      card.className = "flight-card";

      const best = bestDealFromPortalPrices(flight.portalPrices || []);

      card.innerHTML = `
        <p><strong>${flight.airlineName} ${flight.flightNumber}</strong></p>
        <p>Departure: ${flight.departure} | Arrival: ${flight.arrival}</p>
        <p>Stops: ${flight.stops}</p>
        <p class="best-deal">${buildInfoLine(best)}</p>
        <button class="info-btn" title="See prices across portals" aria-label="More info">i</button>
      `;

      // Open modal with portal prices
      const infoBtn = card.querySelector(".info-btn");
      infoBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        showPortalPrices(flight);
      });

      container.appendChild(card);
    });
  }

  // ---------- Sorting ----------
  window.sortFlights = function (key) {
    const sortByDeparture = (a, b) => a.departure.localeCompare(b.departure);
    const sortByPrice = (a, b) => {
      // sort by best deal price if available, else by original price
      const aBest = bestDealFromPortalPrices(a.portalPrices || []);
      const bBest = bestDealFromPortalPrices(b.portalPrices || []);
      const aVal = aBest ? aBest.finalPrice : parseFloat(a.price);
      const bVal = bBest ? bBest.finalPrice : parseFloat(b.price);
      return aVal - bVal;
    };

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

  // ---------- Modal ----------
  function showPortalPrices(flight) {
    const prices = flight.portalPrices || [];
    portalPriceList.innerHTML = "";

    if (!prices.length) {
      portalPriceList.innerHTML = "<li>No portal prices found.</li>";
    } else {
      prices.forEach((p) => {
        const li = document.createElement("li");
        let line = `${p.portal}: ${numberINR(p.basePrice)}`;
        if (p.appliedOffer && p.discountApplied > 0) {
          line = `${p.portal}: ${numberINR(p.basePrice)} → ${numberINR(p.finalPrice)}`;
          const c = p.appliedOffer.couponCode ? ` (Coupon: ${p.appliedOffer.couponCode})` : "";
          li.innerHTML = `${line}${c}`;
        } else if (p.finalPrice !== p.basePrice) {
          // safety: show final if differs
          line = `${p.portal}: ${numberINR(p.basePrice)} → ${numberINR(p.finalPrice)}`;
          li.textContent = line;
        } else {
          li.textContent = line;
        }
        portalPriceList.appendChild(li);
      });
    }

    priceModal.style.display = "flex";
  }

  closeModalBtn.addEventListener("click", () => {
    priceModal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    if (event.target === priceModal) {
      priceModal.style.display = "none";
    }
  });

  // ---------- Search handler ----------
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const from = document.getElementById("from").value.trim().toUpperCase();
    const to = document.getElementById("to").value.trim().toUpperCase();
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = parseInt(document.getElementById("passengers").value || "1", 10);
    const travelClass = document.getElementById("travelClass").value;
    const tripType = Array.from(tripTypeRadios).find(r => r.checked)?.value || "one-way";

    // hide sort until results
    sortControls.style.display = "none";
    outboundContainer.innerHTML = "";
    returnContainer.innerHTML = "";

    try {
      const selectedPaymentMethods = getSelectedPaymentMethods();

      const response = await fetch(`${BACKEND}/search`, {
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
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      currentOutboundFlights = data.outboundFlights || [];
      currentReturnFlights = data.returnFlights || [];

      displayFlights(currentOutboundFlights, outboundContainer);
      displayFlights(currentReturnFlights, returnContainer);

      sortControls.style.display = "block";
    } catch (error) {
      console.error("Search error:", error);
      alert("Failed to fetch flights. Please try again.");
    }
  });

  // ---------- Init ----------
  loadPaymentMethods();
});
