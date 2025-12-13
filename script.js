const API_BASE = "https://skydeal-backend.onrender.com";

/* ---------- State ---------- */
let paymentOptions = {};              // { "Credit Card":[...], "Debit Card":[...], ... }
let selectedCategory = null;          // "Credit Card" | ...
let selectedBanks = new Set();        // "HDFC Bank", ...
let currentSearchBody = null;         // last search body

/* ---------- DOM ---------- */
const modal = document.getElementById("paymentModal");
const openBtn = document.getElementById("openPaymentModal");
const closeBtn = document.getElementById("closePaymentModal");
const saveBtn  = document.getElementById("savePayments");
const clearBtn = document.getElementById("clearPayments");

const chipsWrap = document.getElementById("payment-category-chips");
const optionsList = document.getElementById("payment-options-list");
const selectedCountEl = document.getElementById("selectedCount");

const outList = document.getElementById("outbound");
const retList = document.getElementById("return");
const tpl = document.getElementById("flight-card-tpl");

/* ---------- Helpers ---------- */
const fmtINR = v => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(v);

/* ---------- Modal ---------- */
openBtn.addEventListener("click", async () => {
  modal.classList.remove("hidden");
  await ensurePaymentOptionsLoaded();
  renderCategoryChips();
  renderBankList();
});

closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
saveBtn.addEventListener("click", () => modal.classList.add("hidden"));
clearBtn.addEventListener("click", () => {
  selectedBanks.clear();
  renderBankList();
  updateSelectedCount();
});

function updateSelectedCount(){
  selectedCountEl.textContent = `(${selectedBanks.size})`;
}

/* ---------- Fetch payment options (Mongo-backed) ---------- */
async function ensurePaymentOptionsLoaded(){
  if (Object.keys(paymentOptions).length) return;
  const res = await fetch(`${API_BASE}/payment-options`);
  const data = await res.json();       // { usedFallback, options: { "Credit Card":[...], ... } }
  paymentOptions = data.options || {};

  // Normalize canonical 5 categories only
  const order = ["Credit Card","Debit Card","Net Banking","UPI","Wallet"];
  const normalized = {};
  order.forEach(k => normalized[k] = [...new Set(paymentOptions[k] || [])]);
  paymentOptions = normalized;

  // default category
  if (!selectedCategory) selectedCategory = order[0];
}

/* ---------- Render category chips ---------- */
function renderCategoryChips(){
  chipsWrap.innerHTML = "";
  Object.keys(paymentOptions).forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = cat;
    if (cat === selectedCategory) btn.style.outline = "2px solid #0f1f38";

    btn.onclick = () => { selectedCategory = cat; renderBankList(); };
    chipsWrap.appendChild(btn);
  });
}

/* ---------- Render bank list ---------- */
function renderBankList(){
  optionsList.innerHTML = "";
  const banks = paymentOptions[selectedCategory] || [];
  if (!banks.length){
    const p = document.createElement("p");
    p.style.color = "#6b7280";
    p.textContent = "No options";
    optionsList.appendChild(p);
    return;
  }

  banks.forEach(bank => {
    const row = document.createElement("div");
    row.className = "bank-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedBanks.has(bank);
    cb.onchange = () => {
      if (cb.checked) selectedBanks.add(bank);
      else selectedBanks.delete(bank);
      updateSelectedCount();
    };

    const label = document.createElement("span");
    label.textContent = bank;

    row.appendChild(cb);
    row.appendChild(label);
    optionsList.appendChild(row);
  });
}

/* ---------- Search ---------- */
document.getElementById("searchBtn").addEventListener("click", async () => {
  const body = {
    from: document.getElementById("from").value.trim() || "BOM",
    to: document.getElementById("to").value.trim() || "DEL",
    departureDate: document.getElementById("departDate").value,
    returnDate: document.getElementById("returnDate").value,
    tripType: document.getElementById("returnDate").value ? "round-trip" : "one-way",
    passengers: Number(document.getElementById("passengers").value || 1),
    travelClass: document.getElementById("cabin").value || "economy",
    paymentMethods: Array.from(selectedBanks)  // banks only; backend applies offers
  };

  currentSearchBody = body;

  outList.innerHTML = "";
  retList.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    // meta.debug is logged silently if present
    console.log("[SkyDeal] /search meta", data.meta);

    renderFlights(outList, data.outboundFlights || []);
    renderFlights(retList, data.returnFlights || []);
  } catch (e){
    outList.innerHTML = `<div class="flight-card">Failed to fetch flights.</div>`;
    retList.innerHTML = `<div class="flight-card">Failed to fetch flights.</div>`;
  }
});

/* ---------- Render flight cards ---------- */
function renderFlights(container, flights){
  container.innerHTML = "";
  if (!flights.length){
    container.innerHTML = `<div class="flight-card">No flights found for your search.</div>`;
    return;
  }

  flights.forEach(f => {
    const node = tpl.content.cloneNode(true);
    node.querySelector(".airline").textContent =
      [f.airlineName, f.flightNumber].filter(Boolean).join(" • ");

    const t1 = [f.departureTime, f.arrivalTime].filter(Boolean).join(" → ");
    const stops = (f.stops === 0 || f.stops === "0") ? "Non-stop" :
                  (typeof f.stops === "number" ? `${f.stops} stop(s)` : (f.stops || ""));
    node.querySelector(".meta").textContent =
      [t1, stops, f.duration].filter(Boolean).join(" • ");

    const best = node.querySelector(".best");
    if (f.bestDeal && f.bestDeal.portal && f.bestDeal.finalPrice){
      best.textContent = `Best: ${fmtINR(f.bestDeal.finalPrice)} on ${f.bestDeal.portal}`;
    } else if (typeof f.price === "number") {
      best.textContent = `Base: ${fmtINR(f.price)}`;
    } else {
      best.textContent = "Best price unavailable";
    }

    node.querySelector(".pricesBtn").onclick = () => {
      // show a lightweight breakdown from backend (if you later add popup, wire here)
      alert(
        [
          f.airlineName || "Flight",
          f.flightNumber ? `#${f.flightNumber}` : "",
          f.bestDeal?.portal ? `\nBest via ${f.bestDeal.portal}: ${fmtINR(f.bestDeal.finalPrice)}` : "",
          typeof f.price === "number" ? `\nBase fare: ${fmtINR(f.price)}` : ""
        ].join("")
      );
    };

    container.appendChild(node);
  });
}
