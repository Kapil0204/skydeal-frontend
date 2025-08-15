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

  // IMPORTANT: use your deployed backend base
  const BACKEND = "https://skydeal-backend.onrender.com";

  // ---------- State ----------
  let currentOutboundFlights = [];
  let currentReturnFlights = [];

  // Airline map to print "Airline Name + Flight No"
  const AIRLINE_MAP = {
    "AI": "Air India",
    "6E": "IndiGo",
    "UK": "Vistara",
    "SG": "SpiceJet",
    "G8": "Go First",
    "IX": "Air India Express",
    "I5": "AirAsia India",
    "QP": "Akasa Air"
  };

  // ---------- Trip type (show/hide return date) ----------
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

  // ---------- Dropdown open/close ----------
  window.toggleDropdown = function () {
    const menu = document.getElementById("dropdownMenu");
    menu.style.display = (menu.style.display === "block") ? "none" : "block";
  };
  window.addEventListener("click", (e) => {
    const dd = document.getElementById("paymentDropdown");
    if (!dd.contains(e.target)) dropdownMenu.style.display = "none";
  });

  // ---------- Utils ----------
  const numberINR = (n) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  function getSelectedPaymentMethods() {
    const checked = dropdownMenu.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checked).map(cb => cb.value);
  }

  function bestDealFromPortalPrices(portalPrices) {
    if (!Array.isArray(portalPrices) || !portalPrices.length) return null;
    let best = portalPrices[0];
    for (const p of portalPrices) {
      if ((p.finalPrice ?? p.basePrice) < (best.finalPrice ?? best.basePrice)) best = p;
    }
    return best;
  }

  function airlineLine(airlineName, flightNumber) {
    // flightNumber looks like "AI 9485"
    let code = "";
    let num = flightNumber;
    const m = String(flightNumber || "").match(/^([A-Z0-9]{1,3})\s*(.+)$/);
    if (m) { code = m[1]; num = m[2]; }
    const prettyAirline = AIRLINE_MAP[airlineName] || AIRLINE_MAP[code] || airlineName || code || "";
    return `${prettyAirline} ${code ? code + " " : ""}${num}`;
  }

  // ---------- Payment Methods: render + dedupe ----------
  function renderPaymentMethodsTable(methods = []) {
    try {
      const normalize = (s) => String(s || "")
        .toLowerCase()
        .replace(/ease ?my ?trip|easemytrip|emt/g, "")        // remove brand word
        .replace(/\b(small\s+finance|ltd|limited)\b/g, "")
        .replace(/\b(credit|debit|cards?|card|bank|green|infinite|visa|travelone|emi)\b/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

      const GENERIC = new Set(["other", "wallet", "wallets", "upi", "netbanking", "bank offers"]);
      const seen = new Set();
      const cleaned = [];

      for (const raw of (Array.isArray(methods) ? methods : [])) {
        const label = String(raw || "").trim();
        const key = normalize(label);
        if (!key || GENERIC.has(key)) continue;          // drop generic & empty
        if (seen.has(key)) continue;                     // drop duplicates
        seen.add(key);
        cleaned.push(label);
      }

      // Buckets
      const buckets = { credit: [], debit: [], upi: [], netbanking: [], wallet: [] };
      for (const label of cleaned) {
        const L = label.toLowerCase();
        if (L.includes("wallet")) buckets.wallet.push(label);
        else if (L.includes("upi")) buckets.upi.push(label);
        else if (L.includes("netbank")) buckets.netbanking.push(label);
        else if (L.includes("debit")) buckets.debit.push(label);
        else buckets.credit.push(label);
      }

      // Sort each bucket alphabetically (natural-ish)
      const cmp = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });
      Object.keys(buckets).forEach(k => buckets[k].sort(cmp));

      const mkCell = (list, groupName) => {
        const wrap = document.createElement("div");
        for (const text of list) {
          const id = `pm_${groupName}_${normalize(text).replace(/\W+/g, "_")}`;
          const label = document.createElement("label");
          label.className = "pm-item";
          label.innerHTML = `<input type="checkbox" value="${text}" id="${id}"> ${text}`;
          wrap.appendChild(label);
        }
        // Single “Other” at the end of each column
        const otherLabel = document.createElement("label");
        otherLabel.className = "pm-item";
        otherLabel.innerHTML = `<input type="checkbox" value="Other ${groupName}"> Other`;
        wrap.appendChild(otherLabel);

        const td = document.createElement("td");
        td.appendChild(wrap);
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
      pmTableBody.innerHTML = `<tr><td colspan="5" style="padding:8px">Unable to load payment methods.</td></tr>`;
    }
  }

  async function loadPaymentMethods() {
    // render blank structure immediately
    renderPaymentMethodsTable([]);
    try {
      const resp = await fetch(`${BACKEND}/payment-methods`, { headers: { Accept: "application/json" } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      renderPaymentMethodsTable(data?.methods || []);
    } catch (e) {
      console.error("Failed to load payment methods:", e);
    }
  }

  // ---------- Display Flights ----------
  function buildBestDealLine(best) {
    if (!best) return "";
    const p = numberINR(best.finalPrice ?? best.basePrice);
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
      const header = airlineLine(flight.airlineName, flight.flightNumber);

      card.innerHTML = `
        <p><strong>${header}</strong></p>
        <p>Departure: ${flight.departure} | Arrival: ${flight.arrival}</p>
        <p>Stops: ${flight.stops}</p>
        <p class="best-deal">${buildBestDealLine(best)}</p>
        <button class="info-btn" title="See prices across portals" aria-label="More info"></button>
      `;

      card.querySelector(".info-btn").addEventListener("click", (ev) => {
        ev.stopPropagation();
        showPortalPrices(flight);
      });

      container.appendChild(card);
    });
  }

  // ---------- Sorting ----------
  window.sortFlights = function (key) {
    const byDeparture = (a, b) => a.departure.localeCompare(b.departure);
    const byBestPrice = (a, b) => {
      const ab = bestDealFromPortalPrices(a.portalPrices || []);
      const bb = bestDealFromPortalPrices(b.portalPrices || []);
      const av = ab ? (ab.finalPrice ?? ab.basePrice) : parseFloat(a.price);
      const bv = bb ? (bb.finalPrice ?? bb.basePrice) : parseFloat(b.price);
      return av - bv;
    };

    const out = [...currentOutboundFlights];
    const ret = [...currentReturnFlights];
    if (key === "departure") {
      out.sort(byDeparture); ret.sort(byDeparture);
    } else if (key === "price") {
      out.sort(byBestPrice); ret.sort(byBestPrice);
    }
    displayFlights(out, outboundContainer);
    displayFlights(ret, returnContainer);
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
        const base = numberINR(p.basePrice);
        const finalVal = p.finalPrice ?? p.basePrice;

        if (p.appliedOffer && (p.discountApplied ?? 0) > 0) {
          li.innerHTML = `${p.portal}: ${base} → ${numberINR(finalVal)}${
            p.appliedOffer.couponCode ? ` (Coupon: ${p.appliedOffer.couponCode})` : ""
          }`;
        } else if (finalVal !== p.basePrice) {
          li.textContent = `${p.portal}: ${base} → ${numberINR(finalVal)}`;
        } else {
          li.textContent = `${p.portal}: ${base}`;
        }
        portalPriceList.appendChild(li);
      });
    }

    priceModal.style.display = "flex";
  }

  closeModalBtn.addEventListener("click", () => { priceModal.style.display = "none"; });
  window.addEventListener("click", (e) => { if (e.target === priceModal) priceModal.style.display = "none"; });

  // ---------- Search ----------
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const from = document.getElementById("from").value.trim().toUpperCase();
    const to = document.getElementById("to").value.trim().toUpperCase();
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const passengers = parseInt(document.getElementById("passengers").value || "1", 10);
    const travelClass = document.getElementById("travelClass").value;
    const tripType = Array.from(tripTypeRadios).find(r => r.checked)?.value || "one-way";

    sortControls.style.display = "none";
    outboundContainer.innerHTML = "";
    returnContainer.innerHTML = "";

    try {
      const selectedPaymentMethods = getSelectedPaymentMethods();

      const response = await fetch(`${BACKEND}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from, to, departureDate, returnDate, passengers, travelClass, tripType,
          paymentMethods: selectedPaymentMethods
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      currentOutboundFlights = data.outboundFlights || [];
      currentReturnFlights = data.returnFlights || [];

      displayFlights(currentOutboundFlights, outboundContainer);
      displayFlights(currentReturnFlights, returnContainer);
      sortControls.style.display = "block";
    } catch (err) {
      console.error("Search error:", err);
      alert("Failed to fetch flights. Please try again.");
    }
  });

  // ---------- Init ----------
  loadPaymentMethods();
});
