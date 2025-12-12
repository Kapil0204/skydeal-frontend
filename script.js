// script.js — SkyDeal frontend
const BACKEND = "https://skydeal-backend.onrender.com";

// form nodes
const $from   = document.getElementById("from");
const $to     = document.getElementById("to");
const $depart = document.getElementById("depart");
const $ret    = document.getElementById("ret");
const $pax    = document.getElementById("pax");
const $cabin  = document.getElementById("cabin");
const $one    = document.getElementById("one");
const $rt     = document.getElementById("rt");

const $btnSearch   = document.getElementById("btnSearch");
const $btnPayments = document.getElementById("btnPayments");
const $pmCount     = document.getElementById("pmCount");

// lists
const $outList = document.getElementById("outboundList");
const $retList = document.getElementById("returnList");

// prices modal
const $prices     = document.getElementById("pricesModal");
const $pricesMeta = document.getElementById("pricesMeta");
const $pricesBody = document.getElementById("pricesBody");
const $whyDump    = document.getElementById("whyDump");
document.getElementById("closePrices").onclick  = () => $prices.close();
document.getElementById("closePrices2").onclick = () => $prices.close();

// payments modal
const $pm         = document.getElementById("paymentsModal");
const $pmTabs     = document.getElementById("pmTabs");
const $pmOptions  = document.getElementById("pmOptions");
const $pmCloseBtn = document.getElementById("pmClose");
const $pmDoneBtn  = document.getElementById("pmDone");
const $pmClearBtn = document.getElementById("pmClear");

// state
let paymentCatalog = {}; // { "Credit Card": [...banks], ... }
let selectedBanks = new Set(); // bank names as-is (human, not normalized)
let activeTab = "Credit Card";

function openPm() { $pm.showModal(); }
function closePm(){ $pm.close(); }

$pmCloseBtn.addEventListener("click", e=>{e.preventDefault(); closePm();});
$pmDoneBtn .addEventListener("click", e=>{e.preventDefault(); closePm();});
$pmClearBtn.addEventListener("click", ()=>{
  selectedBanks.clear();
  updatePmCount();
  renderOptions();
});

const tabs = ["Credit Card","Debit Card","Net Banking","UPI","Wallet"];

function renderTabs() {
  $pmTabs.innerHTML = "";
  for (const t of tabs) {
    const b = document.createElement("button");
    b.className = "tab" + (t===activeTab ? " active":"");
    b.textContent = t;
    b.onclick = () => { activeTab = t; renderTabs(); renderOptions(); };
    $pmTabs.appendChild(b);
  }
}

function renderOptions() {
  const banks = paymentCatalog[activeTab] || [];
  if (!banks.length) {
    $pmOptions.innerHTML = `<div class="muted" style="padding:10px">No options</div>`;
    return;
  }
  const html = banks.map(b => {
    const id = `pm_${activeTab.replace(/\s+/g,"").toLowerCase()}_${b.replace(/\s+/g,"").toLowerCase()}`;
    const checked = selectedBanks.has(b) ? "checked" : "";
    return `
      <div class="pm-opt">
        <label for="${id}">${b}</label>
        <input id="${id}" type="checkbox" ${checked} data-bank="${b}" />
      </div>`;
  }).join("");
  $pmOptions.innerHTML = html;

  Array.from($pmOptions.querySelectorAll('input[type="checkbox"]')).forEach(cb=>{
    cb.addEventListener("change", e=>{
      const bank = e.target.getAttribute("data-bank");
      if (e.target.checked) selectedBanks.add(bank);
      else selectedBanks.delete(bank);
      updatePmCount();
    });
  });
}

function updatePmCount() { $pmCount.textContent = selectedBanks.size; }

async function loadPaymentOptions() {
  const r = await fetch(`${BACKEND}/payment-options`);
  const j = await r.json();
  paymentCatalog = j.options || {};
  // Guarantee presence of 5 categories
  for (const t of tabs) if (!paymentCatalog[t]) paymentCatalog[t] = [];
  renderTabs();
  renderOptions();
}

$btnPayments.onclick = async ()=>{
  if (!Object.keys(paymentCatalog).length) await loadPaymentOptions();
  openPm();
};

// defaults: tomorrow & +2 days
(function setDates(){
  const toISO = d => d.toISOString().slice(0,10);
  const today = new Date();
  const dep = new Date(today.getFullYear(), today.getMonth(), today.getDate()+1);
  const ret = new Date(today.getFullYear(), today.getMonth(), today.getDate()+3);
  $depart.value = toISO(dep);
  $ret.value    = toISO(ret);
})();

// card
function cardHTML(f) {
  const hdr  = `${f.airlineName} • ${f.flightNumber}`;
  const meta = `${f.departure} → ${f.arrival} • ${f.stops ? f.stops + " stop" : "Non-stop"}`;
  const best = `Best: ₹${(f.bestDeal?.finalPrice||f.basePrice).toLocaleString("en-IN")} on ${f.bestDeal?.portal||"—"}`;
  const why  = f.bestDeal?.note || "";
  return `
    <div class="card">
      <div class="top">
        <div>
          <div class="airline">${hdr}</div>
          <div class="meta">${meta}</div>
          <div class="best">${best}</div>
          <div class="meta">${why}</div>
        </div>
        <div>
          <button class="btn-ghost" data-id="${f.id}">Prices & breakdown</button>
        </div>
      </div>
    </div>
  `;
}

function bindPriceButtons(flights) {
  Array.from(document.querySelectorAll('button[data-id]')).forEach(btn=>{
    const id = btn.getAttribute("data-id");
    const f = flights.find(x => x.id === id);
    btn.onclick = () => {
      $pricesMeta.textContent = `${f.airlineName} • ${f.flightNumber} • Base ₹${f.basePrice.toLocaleString("en-IN")}`;
      $pricesBody.innerHTML = (f.portalPrices||[]).map(p => `
        <tr><td>${p.portal}</td><td>₹${p.finalPrice.toLocaleString("en-IN")}</td><td>${p.source}</td></tr>
      `).join("");
      $whyDump.textContent = JSON.stringify(f.bestDeal, null, 2);
      $prices.showModal();
    };
  });
}

async function doSearch() {
  const tripType = $rt.checked ? "round-trip" : "one-way";

  const payload = {
    from: $from.value.trim().toUpperCase(),
    to: $to.value.trim().toUpperCase(),
    departureDate: $depart.value,
    returnDate: $ret.value,
    tripType,
    passengers: Number($pax.value || 1),
    travelClass: $cabin.value,
    paymentMethods: Array.from(selectedBanks) // send human bank names; backend matches loosely
  };

  // UX
  $btnSearch.disabled = true;
  const old = $btnSearch.textContent;
  $btnSearch.textContent = "Searching…";

  try {
    const resp = await fetch(`${BACKEND}/search`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const json = await resp.json();

    // Render (already sorted asc by backend)
    const out = json.outboundFlights || [];
    const ret = json.returnFlights || [];
    $outList.innerHTML = out.length ? out.map(cardHTML).join("") : `<div class="card meta">No flights found for your search.</div>`;
    $retList.innerHTML = ret.length ? ret.map(cardHTML).join("") : `<div class="card meta">No flights found for your search.</div>`;
    bindPriceButtons(out.concat(ret));

    console.log("[SkyDeal] /search meta ->", json.meta);
  } catch (e) {
    console.error(e);
    $outList.innerHTML = `<div class="card meta">Failed to fetch flights.</div>`;
    $retList.innerHTML = `<div class="card meta">Failed to fetch flights.</div>`;
  } finally {
    $btnSearch.disabled = false;
    $btnSearch.textContent = old;
  }
}

$btnSearch.onclick = doSearch;

// Trip toggle
document.getElementById("one").addEventListener("change", ()=> document.getElementById("returnWrap").style.opacity = 0.35);
document.getElementById("rt") .addEventListener("change", ()=> document.getElementById("returnWrap").style.opacity = 1);

// init
updatePmCount();
