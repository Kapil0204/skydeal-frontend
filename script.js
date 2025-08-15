document.addEventListener("DOMContentLoaded", () => {
  // ====== dropdown open/close ======
  window.toggleDropdown = function () {
    const menu = document.getElementById("dropdownMenu");
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  };
  window.addEventListener("click", (e) => {
    const dropdown = document.getElementById("paymentDropdown");
    if (!dropdown.contains(e.target)) {
      document.getElementById("dropdownMenu").style.display = "none";
    }
  });

  // ====== DOM refs ======
  const searchForm = document.getElementById("searchForm");
  const outboundContainer = document.getElementById("outboundContainer");
  const returnContainer = document.getElementById("returnContainer");
  const returnDateInput = document.getElementById("returnDate");
  const tripTypeRadios = document.getElementsByName("tripType");
  const sortControls = document.getElementById("sortControls");

  // hide return date by default
  returnDateInput.style.display = "none";
  tripTypeRadios.forEach((r) => {
    r.addEventListener("change", () => {
      returnDateInput.style.display = r.value === "round-trip" && r.checked ? "" : "none";
    });
  });

  // state for sorting
  let currentOutboundFlights = [];
  let currentReturnFlights = [];

  // ====== helpers ======
  const rupee = (n) =>
    "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  function normaliseLabel(s) {
    return s.toLowerCase().replace(/\s+/g, " ").trim();
  }

  // labels we consider “too generic” for the dropdown
  const GENERIC_PM = new Set(
    ["credit card", "debit card", "upi", "netbanking", "bank offers", "dbs bank", "wallets"].map(
      normaliseLabel
    )
  );

  // render the PM table with dedupe & generic filtering
  function renderPaymentMethodsTable(methods) {
    const tbl = document.getElementById("pmTableBody");
    if (!tbl) return;

    // dedupe (case/space-insensitive) and filter
    const seen = new Set();
    const cleaned = [];
    methods.forEach((label) => {
      const key = normaliseLabel(label);
      if (!key || GENERIC_PM.has(key)) return;
      if (seen.has(key)) return;
      seen.add(key);
      cleaned.push(label.trim());
    });

    // bucket by heuristics (credit / debit / upi / netbanking / wallet)
    const buckets = {
      credit: [],
      debit: [],
      upi: [],
      netbanking: [],
      wallet: [],
    };
    cleaned.forEach((label) => {
      const L = label.toLowerCase();
      if (L.includes("wallet")) buckets.wallet.push(label);
      else if (L.includes("upi")) buckets.upi.push(label);
      else if (L.includes("netbank")) buckets.netbanking.push(label);
      else if (L.includes("debit")) buckets.debit.push(label);
      else buckets.credit.push(label); // default to credit
    });

    // helper to make a cell of checkboxes
    const mkCell = (list, groupName) => {
      const div = document.createElement("div");
      list.forEach((text) => {
        const id = `pm_${groupName}_${normaliseLabel(text).replace(/\W+/g, "_")}`;
        const label = document.createElement("label");
        label.className = "pm-item";
        label.innerHTML = `<input type="checkbox" value="${text}" id="${id}"> ${text}`;
        div.appendChild(label);
      });
      // add “Other”
      const otherId = `pm_${groupName}__other`;
      const otherLabel = document.createElement("label");
      otherLabel.className = "pm-item";
      otherLabel.innerHTML = `<input type="checkbox" value="Other ${groupName}" id="${otherId}"> Other`;
      div.appendChild(otherLabel);

      const td = document.createElement("td");
      td.appendChild(div);
      return td;
    };

    // build one table row with 5 columns
    tbl.innerHTML = "";
    const tr = document.createElement("tr");
    tr.appendChild(mkCell(buckets.credit, "Credit"));
    tr.appendChild(mkCell(buckets.debit, "Debit"));
    tr.appendChild(mkCell(buckets.upi, "UPI"));
    tr.appendChild(mkCell(buckets.netbanking, "Netbanking"));
    tr.appendChild(mkCell(buckets.wallet, "Wallets"));
    tbl.appendChild(tr);
  }

  // ====== fetch payment methods from backend ======
  async function loadPaymentMethods() {
    try {
      const resp = await fetch("https://skydeal-backend.onrender.com/payment-methods");
      const data = await resp.json();
      renderPaymentMethodsTable(data.methods || []);
    } catch (e) {
      console.error("Failed to load payment methods", e);
      renderPaymentMethodsTable([]);
    }
  }
  loadPaymentMethods();

  // ====== modal ======
  const modal = document.getElementById("priceModal");
  const modalList = document.getElementById("portalPriceList");
  const closeModalBtn = document.getElementById("closeModal");

  function openModal() {
    modal.style.display = "flex";
  }
  function closeModal() {
    modal.style.display = "none";
  }
  closeModalBtn.addEventListener("click", closeModal);
  window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  function fillModal(portalPrices) {
    modalList.innerHTML = "";
    portalPrices.forEach((p) => {
      const li = document.createElement("li");
      if (p.appliedOffer && p.appliedOffer.couponCode) {
        const base = rupee(p.basePrice);
        const final = rupee(p.finalPrice);
        const titleHint =
          p.appliedOffer.title && p.appliedOffer.title.length > 60
            ? p.appliedOffer.title.slice(0, 60) + "…"
            : p.appliedOffer.title || "";
        li.innerHTML = `<strong>${p.portal}</strong>: ${base} → <strong>${final}</strong><br><span class="coupon-hint">(Coupon: ${p.appliedOffer.couponCode}${titleHint ? ` · ${titleHint}` : ""})</span>`;
      } else {
        li.innerHTML = `<strong>${p.portal}</strong>: ${rupee(p.basePrice)}`;
      }
      modalList.appendChild(li);
    });
  }

  // ====== best deal helper ======
  function pickBestDeal(portalPrices = []) {
    if (!portalPrices.length) return null;
    let best = portalPrices[0];
    for (let i = 1; i < portalPrices.length; i++) {
      if (portalPrices[i].finalPrice < best.finalPrice) best = portalPrices[i];
    }
    return best;
  }

  // ====== results rendering ======
  function displayFlights(flights, container) {
    container.innerHTML = "";
    if (!flights || flights.length === 0) {
      container.innerHTML = "<p>No flights found.</p>";
      return;
    }

    flights.forEach((flight) => {
      const card = document.createElement("div");
      card.className = "flight-card";

      // compute best deal
      const best = pickBestDeal(flight.portalPrices || []);
      const bestLine = best
        ? `<div class="best-deal">Best deal: <span class="best-portal">${best.portal}</span> <span class="best-price">${rupee(best.finalPrice)}</span>${best.appliedOffer?.couponCode ? ` <span class="best-coupon">(Coupon: ${best.appliedOffer.couponCode})</span>` : ""}</div>`
        : `<div class="best-deal">Best deal: <span class="best-price">${rupee(flight.price)}</span></div>`;

      // info button
      const infoBtn = `<button class="info-btn" title="See all portals" aria-label="See all portal prices">i</button>`;

      card.innerHTML = `
        <div class="flight-header">
          <div class="flight-title">${flight.airlineName} <span class="flight-num">(${flight.flightNumber})</span></div>
          ${infoBtn}
        </div>
        <p class="times">Departure: ${flight.departure} | Arrival: ${flight.arrival}</p>
        <p class="stops">Stops: ${flight.stops}</p>
        ${bestLine}
      `;

      // info click -> modal
      card.querySelector(".info-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        fillModal(flight.portalPrices || []);
        openModal();
      });

      container.appendChild(card);
    });
  }

  // ====== sorting ======
  window.sortFlights = function (key) {
    const sortByDeparture = (a, b) => a.departure.localeCompare(b.departure);
    const sortByPrice = (a, b) =>
      parseFloat(pickBestDeal(a.portalPrices)?.finalPrice ?? a.price) -
      parseFloat(pickBestDeal(b.portalPrices)?.finalPrice ?? b.price);

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

  // ====== submit handler ======
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const from = document.getElementById("from").value.trim().toUpperCase();
    const to = document.getElementById("to").value.trim().toUpperCase();
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = document.getElementById("passengers").value;
    const travelClass = document.getElementById("travelClass").value;
    const tripType = [...tripTypeRadios].find((r) => r.checked)?.value || "one-way";

    // collect checked PMs from table
    const selectedPaymentMethods = Array.from(
      document.querySelectorAll("#pmTableBody input[type='checkbox']:checked")
    ).map((el) => el.value);

    outboundContainer.innerHTML = "";
    returnContainer.innerHTML = "";
    sortControls.style.display = "none";

    try {
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
          paymentMethods: selectedPaymentMethods,
        }),
      });

      const data = await response.json();

      currentOutboundFlights = data.outboundFlights || [];
      currentReturnFlights = data.returnFlights || [];

      displayFlights(currentOutboundFlights, outboundContainer);
      displayFlights(currentReturnFlights, returnContainer);

      sortControls.style.display = "block";
    } catch (err) {
      console.error(err);
      alert("Failed to fetch flights. Please try again.");
    }
  });
});
