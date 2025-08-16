// script.js

// === GLOBALS ===
const BACKEND_URL = "https://skydeal-backend.onrender.com";
let paymentMethodsLoaded = false;
let paymentMethodsCache = [];

// === UTILS ===
async function fetchJSONWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// === PAYMENT METHODS ===
function renderPaymentMethods(methods) {
  const drop = document.getElementById("paymentDropdown");
  if (!drop) return;

  drop.innerHTML = "";
  const frag = document.createDocumentFragment();

  methods.forEach((label, i) => {
    const id = `pm_${i}`;
    const row = document.createElement("label");
    row.className = "pm-item"; // style with CSS
    row.innerHTML = `
      <input type="checkbox" value="${label}" id="${id}" />
      <span>${label}</span>
    `;
    frag.appendChild(row);
  });

  drop.appendChild(frag);
}

async function loadPaymentMethods() {
  const drop = document.getElementById("paymentDropdown");
  if (!drop) return;

  drop.innerHTML = `<div class="pm-loading">Loading payment methods...</div>`;

  try {
    if (!paymentMethodsLoaded) {
      const data = await fetchJSONWithTimeout(
        `${BACKEND_URL}/payment-methods`,
        15000
      );
      const raw = Array.isArray(data?.methods) ? data.methods : [];

      // dedupe + normalize
      const map = new Map();
      raw.forEach((m) => {
        if (typeof m === "string") {
          const key = m.toLowerCase().replace(/\s+/g, " ").trim();
          if (key && !map.has(key)) map.set(key, m.trim());
        }
      });

      paymentMethodsCache = Array.from(map.values()).sort((a, b) =>
        a.localeCompare(b)
      );
      paymentMethodsLoaded = true;
    }

    renderPaymentMethods(paymentMethodsCache);
  } catch (err) {
    console.error("payment-methods load error:", err);
    drop.innerHTML = `
      <div class="pm-error">
        Couldn't load payment methods.
        <button id="pmRetry" type="button">Retry</button>
      </div>`;
    document
      .getElementById("pmRetry")
      ?.addEventListener("click", loadPaymentMethods);
  }
}

function setupDropdown() {
  const toggle = document.getElementById("paymentToggle");
  const wrap = toggle?.parentElement;
  if (!toggle || !wrap) return;

  toggle.addEventListener("click", () => {
    wrap.classList.toggle("open");
    if (wrap.classList.contains("open") && !paymentMethodsLoaded) {
      loadPaymentMethods();
    }
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) wrap.classList.remove("open");
  });
}

// === SEARCH ===
async function onSearch(e) {
  e.preventDefault();

  const origin = document.getElementById("origin").value.trim();
  const destination = document.getElementById("destination").value.trim();
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const cabinClass = document.getElementById("cabin-class").value;
  const tripType = document.querySelector(
    "input[name='tripType']:checked"
  )?.value;

  const selectedPaymentMethods = Array.from(
    document.querySelectorAll("#paymentDropdown input:checked")
  ).map((el) => el.value);

  const body = {
    origin,
    destination,
    departureDate,
    returnDate: tripType === "round-trip" ? returnDate : null,
    cabinClass,
    tripType,
    passengers: 1,
    paymentMethods: selectedPaymentMethods,
  };

  try {
    const res = await fetch(`${BACKEND_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderFlights(data);
  } catch (err) {
    console.error("Search error:", err);
    alert("Search failed. Please try again.");
  }
}

// === RENDER FLIGHTS ===
function renderFlights(data) {
  const outboundDiv = document.getElementById("outbound-flights");
  const returnDiv = document.getElementById("return-flights");
  outboundDiv.innerHTML = "";
  returnDiv.innerHTML = "";

  if (!data || (!data.outbound?.length && !data.return?.length)) {
    outboundDiv.innerHTML = "<p>No results found.</p>";
    return;
  }

  function makeCard(f) {
    const card = document.createElement("div");
    card.className = "flight-card";
    card.innerHTML = `
      <h3>${f.carrier} ${f.flightNumber}</h3>
      <p>Departure: ${f.departure} | Arrival: ${f.arrival}</p>
      <p>Stops: ${f.stops}</p>
      ${
        f.bestOffer
          ? `<div class="best-offer">
              Best deal: <strong>${f.bestOffer.portal}</strong> ₹${f.bestOffer.price} 
              (${f.bestOffer.paymentMethod}, Coupon: ${f.bestOffer.coupon || "-"})
              <button class="info-btn" data-offers='${JSON.stringify(
                f.allOffers
              )}'>i</button>
            </div>`
          : ""
      }
    `;
    return card;
  }

  data.outbound?.forEach((f) => outboundDiv.appendChild(makeCard(f)));
  data.return?.forEach((f) => returnDiv.appendChild(makeCard(f)));

  document.querySelectorAll(".info-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const offers = JSON.parse(e.target.dataset.offers || "[]");
      showOffersModal(offers);
    });
  });
}

// === MODAL ===
function showOffersModal(offers) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <button class="close-btn">&times;</button>
      <h3>Prices on Different Portals</h3>
      <ul>
        ${offers
          .map(
            (o) =>
              `<li><strong>${o.portal}</strong>: ₹${o.price} (${o.paymentMethod}${
                o.coupon ? `, Coupon: ${o.coupon}` : ""
              })</li>`
          )
          .join("")}
      </ul>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".close-btn").addEventListener("click", () =>
    modal.remove()
  );
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

// === INIT ===
document.addEventListener("DOMContentLoaded", () => {
  setupDropdown();
  document
    .getElementById("searchForm")
    .addEventListener("submit", onSearch);
});

