// ====== CONFIG ======
const BACKEND_URL = "https://skydeal-backend.onrender.com/search"; // Your Render backend /search

// EXPECTED HTML IDs / names (match these in your HTML):
// - Inputs: #from, #to, #departureDate, #returnDate, #passengers, #travelClass
// - Trip type radios: name="tripType" values: "one-way" | "round-trip"
// - Return date wrapper: #returnDateGroup (shown/hidden by trip type)
// - Buttons: #searchBtn
// - Result containers: #outboundContainer, #returnContainer
// - Filters / sort host: #filtersContainer (we'll inject sort controls here)

// ====== UTIL ======
const qs  = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];

function fmtTime(isoOrHM) {
  // Accepts "HH:mm" or ISO. Return "HH:mm"
  if (!isoOrHM) return "";
  if (/^\d{2}:\d{2}$/.test(isoOrHM)) return isoOrHM;
  const d = new Date(isoOrHM);
  if (isNaN(d)) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function safeText(v, fallback = "") {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string" && v.trim() === "") return fallback;
  return v;
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// ====== MODAL (built dynamically so we don't rely on specific HTML) ======
let modalEl = null;
function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement("div");
  modalEl.id = "skydealModal";
  Object.assign(modalEl.style, {
    position: "fixed", inset: "0", background: "rgba(0,0,0,0.35)",
    display: "none", alignItems: "center", justifyContent: "center",
    zIndex: "9999"
  });

  const content = document.createElement("div");
  content.id = "skydealModalContent";
  Object.assign(content.style, {
    background: "#fff", borderRadius: "12px", padding: "16px",
    maxWidth: "560px", width: "92%", boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
  });

  const header = createEl("div", "modal-header");
  Object.assign(header.style, { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" });

  const title = createEl("h3", "", "Price Comparison");
  Object.assign(title.style, { margin: 0, fontSize: "18px" });

  const closeBtn = createEl("button", "", "×");
  Object.assign(closeBtn.style, { fontSize: "20px", lineHeight: "20px", border: "none", background: "transparent", cursor: "pointer" });
  closeBtn.addEventListener("click", hideModal);

  header.append(title, closeBtn);

  const body = createEl("div"); body.id = "skydealModalBody";
  Object.assign(body.style, { display: "grid", gap: "8px" });

  content.append(header, body);
  modalEl.appendChild(content);
  modalEl.addEventListener("click", (e) => { if (e.target === modalEl) hideModal(); });
  document.body.appendChild(modalEl);
  return modalEl;
}
function showModal(htmlBody, heading = "Price Comparison") {
  ensureModal();
  qs("#skydealModalBody").innerHTML = htmlBody;
  qs("#skydealModalContent h3").textContent = heading;
  modalEl.style.display = "flex";
}
function hideModal() {
  if (modalEl) modalEl.style.display = "none";
}

// ====== SORT CONTROLS ======
let currentSortKey = "price"; // default after results
function renderSortControls(onChange) {
  const host = qs("#filtersContainer");
  if (!host) return;

  let wrap = qs("#skydealSortWrap");
  if (!wrap) {
    wrap = createEl("div");
    wrap.id = "skydealSortWrap";
    wrap.style.display = "flex";
    wrap.style.gap = "8px";
    wrap.style.alignItems = "center";
    wrap.style.margin = "8px 0 12px";
    const label = createEl("span", "", "Sort by:");
    const select = document.createElement("select");
    select.id = "skydealSortSelect";
    ["Price (asc)", "Departure time (asc)"].forEach((opt, i) => {
      const o = createEl("option", "", opt);
      o.value = i === 0 ? "price" : "depTime";
      select.appendChild(o);
    });
    select.addEventListener("change", (e) => {
      currentSortKey = e.target.value;
      if (typeof onChange === "function") onChange(currentSortKey);
    });
    wrap.append(label, select);
    host.innerHTML = ""; // ensure no duplicates
    host.appendChild(wrap);
  }
}

// ====== RENDERING ======
function sortFlights(flights, key) {
  const copy = [...flights];
  if (key === "depTime") {
    copy.sort((a, b) => new Date(a.departureTime || a.departure || 0) - new Date(b.departureTime || b.departure || 0));
  } else {
    copy.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  }
  return copy;
}

function renderFlightList(container, flights, sideLabel) {
  container.innerHTML = "";
  if (!flights || flights.length === 0) {
    const empty = createEl("div", "", `No ${sideLabel} flights found.`);
    Object.assign(empty.style, { padding: "8px", opacity: "0.8" });
    container.appendChild(empty);
    return;
  }

  const list = createEl("div");
  Object.assign(list.style, { display: "grid", gap: "10px" });

  flights.forEach((f) => {
    const card = createEl("div", "flight-card");
    Object.assign(card.style, {
      border: "1px solid #e6e6e6", borderRadius: "10px", padding: "10px", cursor: "pointer"
    });

    const airlineName = safeText(f.airlineName || f.carrierName || f.airline || f.carrier || "", "—");
    const flightNo    = safeText(f.flightNumber || f.number || "", "");
    const dep         = fmtTime(f.departureTime || f.departure);
    const arr         = fmtTime(f.arrivalTime || f.arrival);
    const stops       = (f.stops !== undefined && f.stops !== null) ? f.stops :
                        (f.numberOfStops !== undefined ? f.numberOfStops : (f.itineraries?.[0]?.segments?.length ? (f.itineraries[0].segments.length - 1) : 0));
    const price       = (typeof f.price === "number") ? f.price : (parseFloat(f.price?.total || f.price?.base) || NaN);

    const title = createEl("div", "");
    title.innerHTML = `<strong>${airlineName}${flightNo ? " " + flightNo : ""}</strong>`;
    const times = createEl("div", "", `${dep} → ${arr}`);
    const meta  = createEl("div", "", `Stops: ${isNaN(stops) ? "—" : stops}`);
    const cost  = createEl("div", "", isNaN(price) ? "" : `₹${Math.round(price).toLocaleString("en-IN")}`);

    [title, times, meta, cost].forEach(el => { el.style.margin = "2px 0"; });

    card.append(title, times, meta, cost);
    card.addEventListener("click", () => openComparisonModal({ airlineName, flightNo, dep, arr, price }));
    list.appendChild(card);
  });

  container.appendChild(list);
}

function openComparisonModal({ airlineName, flightNo, dep, arr, price }) {
  // Simulated OTA prices = Amadeus price + ₹100 each (no original/base shown)
  const portals = ["MakeMyTrip", "Goibibo", "Cleartrip", "Yatra", "EaseMyTrip"];
  const rows = portals.map(p => {
    const finalPrice = isNaN(price) ? "—" : `₹${(Math.round(price) + 100).toLocaleString("en-IN")}`;
    return `<div style="display:flex;justify-content:space-between;gap:8px;border:1px solid #eee;border-radius:8px;padding:8px;">
      <div><strong>${p}</strong><div style="font-size:12px;opacity:0.8;">${airlineName}${flightNo ? " " + flightNo : ""} • ${dep} → ${arr}</div></div>
      <div style="font-weight:600;">${finalPrice}</div>
    </div>`;
  }).join("");

  const body = `
    <div style="display:grid;gap:8px;">
      ${rows}
      <div style="font-size:12px;opacity:0.75;">(Simulated pricing: Amadeus fare + ₹100 per portal)</div>
    </div>
  `;
  showModal(body, "Compare prices across portals");
}

// ====== MAIN SEARCH FLOW ======
document.addEventListener("DOMContentLoaded", () => {
  const fromInput        = qs("#from");
  const toInput          = qs("#to");
  const depInput         = qs("#departureDate");
  const retInput         = qs("#returnDate");
  const returnGroup      = qs("#returnDateGroup");
  const paxInput         = qs("#passengers");
  const classInput       = qs("#travelClass");
  const searchBtn        = qs("#searchBtn");
  const outboundContainer= qs("#outboundContainer");
  const returnContainer  = qs("#returnContainer");

  // Trip type toggle: hide/show return date neatly
  const tripTypeRadios = qsa('input[name="tripType"]');
  function applyTripTypeUI() {
    const value = (qs('input[name="tripType"]:checked')?.value) || "one-way";
    if (value === "round-trip") {
      if (returnGroup) returnGroup.style.display = "block";
    } else {
      if (returnGroup) returnGroup.style.display = "none";
      if (retInput) retInput.value = "";
    }
  }
  tripTypeRadios.forEach(r => r.addEventListener("change", applyTripTypeUI));
  applyTripTypeUI(); // initial

  async function doSearch() {
    // minimal guard
    const from  = fromInput?.value?.trim();
    const to    = toInput?.value?.trim();
    const date  = depInput?.value;
    const trip  = (qs('input[name="tripType"]:checked')?.value) || "one-way";
    const ret   = retInput?.value || "";

    if (!from || !to || !date) {
      alert("Please fill From, To, and Departure Date.");
      return;
    }

    // Build payload expected by your backend (/search already handles round trips)
    const payload = {
      from, to,
      departureDate: date,
      returnDate: (trip === "round-trip" ? ret : ""),
      passengers: (paxInput?.value ? Number(paxInput.value) : 1) || 1,
      travelClass: (classInput?.value || "ECONOMY")
    };

    // Fetch
    outboundContainer.innerHTML = "Loading…";
    if (returnContainer) returnContainer.innerHTML = "";

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = await res.json();
      // Expected shape: { outboundFlights: [...], returnFlights: [...] }
      // If your backend returns a different shape, map here.
      let outbound = data?.outboundFlights || data?.flights || [];
      let returns  = data?.returnFlights || [];

      // Show sort controls AFTER having results
      renderSortControls((key) => {
        const s1 = sortFlights(outbound, key);
        renderFlightList(outboundContainer, s1, "outbound");
        if (retInput?.value && returns?.length) {
          const s2 = sortFlights(returns, key);
          renderFlightList(returnContainer, s2, "return");
        }
      });

      // Initial paint, sorted by price asc
      const s1 = sortFlights(outbound, currentSortKey);
      renderFlightList(outboundContainer, s1, "outbound");

      if (retInput?.value && returns?.length) {
        const s2 = sortFlights(returns, currentSortKey);
        renderFlightList(returnContainer, s2, "return");
      } else if (returnContainer) {
        // Keep the second column clean on one-way
        returnContainer.innerHTML = "";
      }
    } catch (err) {
      console.error("Search error:", err);
      outboundContainer.innerHTML = "<div style='color:#b00020;'>Failed to fetch flights. Please try again.</div>";
      if (returnContainer) returnContainer.innerHTML = "";
    }
  }

  if (searchBtn) searchBtn.addEventListener("click", doSearch);
});
