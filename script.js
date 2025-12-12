// script.js — stable, connects to real backend
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
document.getElementById("pmClose").onclick = ()=> $pm.close();
document.getElementById("pmDone").onclick  = ()=> $pm.close();
document.getElementById("pmClear").onclick = ()=>{
  selected.clear();
  Array.from($pmOptions.querySelectorAll('input[type="checkbox"]')).forEach(cb => cb.checked = false);
  updatePmCount();
};

// state
let paymentCatalog = {};  // { "Credit Card": [...banks] }
let selected = new Set();
let activeTab = "Credit Card";

const norm = s => String(s||"").toLowerCase().replace(/\s+/g,"").replace(/bank$/,"");

// defaults
(function initDates(){
  const toISO = (x)=> new Date(Date.now()+x*86400000).toISOString().slice(0,10);
  $depart.value = toISO(1);
  $ret.value    = toISO(3);
})();

// ---------- Payment Methods ----------
function renderTabs() {
  $pmTabs.innerHTML = "";
  const labels = Object.keys(paymentCatalog).length
    ? Object.keys(paymentCatalog)
    : ["Credit Card","Debit Card","Net Banking","UPI","Wallet","EMI"];
  if (!paymentCatalog[activeTab] && labels.length) activeTab = labels[0];

  for (const label of labels) {
    const b = document.createElement("button");
    b.className = "tab" + (label===activeTab ? " active" : "");
    b.textContent = label;
    b.onclick = () => { activeTab = label; renderOptions(); renderTabs(); };
    $pmTabs.appendChild(b);
  }
}

function renderOptions() {
  const list = paymentCatalog[activeTab] || [];
  if (!list.length) {
    $pmOptions.innerHTML = `<div class="muted" style="padding:10px">No options</div>`;
    return;
  }
  const catToken = norm(activeTab);
  const html = list.map(name => {
    const id = `pm_${catToken}_${norm(name)}`;
    const checked = selected.has(catToken) && selected.has(norm(name)) ? "checked" : "";
    return `
      <div class="pm-opt">
        <label for="${id}">${name}</label>
        <input id="${id}" type="checkbox" ${checked}
          data-cat="${catToken}" data-bank="${norm(name)}" />
      </div>`;
  }).join("");
  $pmOptions.innerHTML = html;

  Array.from($pmOptions.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
    cb.addEventListener("change", (e)=>{
      const c = e.target.getAttribute("data-cat");
      const b = e.target.getAttribute("data-bank");
      if (e.target.checked) { selected.add(c); selected.add(b); }
      else { selected.delete(b); }
      updatePmCount();
    });
  });
}

function updatePmCount() {
  const banks = [];
  for (const [cat, arr] of Object.entries(paymentCatalog)) {
    const c = norm(cat);
    for (const bank of arr) {
      if (selected.has(norm(bank)) && selected.has(c)) banks.push(bank);
    }
  }
  $pmCount.textContent = banks.length;
}

async function loadPaymentOptions() {
  try {
    const r = await fetch(`${BACKEND}/payment-options`);
    const j = await r.json();
    paymentCatalog = j.options || {};
  } catch {
    paymentCatalog = {}; // if backend returns empty, show empty gracefully
  }
  renderTabs();
  renderOptions();
}

$btnPayments.onclick = async () => {
  if (!Object.keys(paymentCatalog).length) await loadPaymentOptions();
  $pm.showModal();
};

// helper: return human bank names (and also include categories) to backend
function getSelectedValues() {
  const values = [];
  for (const [cat, arr] of Object.entries(paymentCatalog)) {
    const c = norm(cat);
    let any = false;
    for (const bank of arr) {
      if (selected.has(c) && selected.has(norm(bank))) {
        values.push(bank);   // push bank human name
        any = true;
      }
    }
    if (any) values.push(cat); // also push the category human label
  }
  return values;
}

// ---------- Search ----------
function cardHTML(f) {
  const hdr = `${f.airlineName} • ${f.flightNumber || f.airlineName}`;
  const meta = `${f.departure} → ${f.arrival} • ${f.stops ? f.stops + " stop" : "Non-stop"}`;
  const best = `Best: ₹${(f.bestDeal?.finalPrice ?? f.basePrice).toLocaleString("en-IN")} on ${f.bestDeal?.portal ?? "-"}`;
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
  Array.from(document.querySelectorAll('button[data-id]')).forEach(btn => {
    const id = btn.getAttribute("data-id");
    const f = flights.find(x => x.id === id);
    btn.onclick = () => {
      $pricesMeta.textContent = `${f.airlineName} • ${f.flightNumber || ""} • Base ₹${(f.basePrice||0).toLocaleString("en-IN")}`;
      $pricesBody.innerHTML = (f.portalPrices || []).map(p => `
        <tr><td>${p.portal}</td><td>₹${p.finalPrice.toLocaleString("en-IN")}</td><td>${p.source}</td></tr>
      `).join("");
      $whyDump.textContent = JSON.stringify(f.bestDeal || {}, null, 2);
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
    paymentMethods: getSelectedValues()
  };

  $btnSearch.disabled = true;
  const oldText = $btnSearch.textContent;
  $btnSearch.textContent = "Searching…";

  try {
    const resp = await fetch(`${BACKEND}/search`, {
      method:"POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const json = await resp.json();

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
    $btnSearch.textContent = oldText;
  }
}

$btnSearch.onclick = doSearch;

// Hide/show return date based on trip
$one.addEventListener("change", ()=> document.getElementById("returnWrap").style.opacity = 0.35);
$rt .addEventListener("change", ()=> document.getElementById("returnWrap").style.opacity = 1);

// first paint
updatePmCount();
