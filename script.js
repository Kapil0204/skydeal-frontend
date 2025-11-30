<!-- script.js — payment modal + search wiring -->
<script>
const BACKEND = "https://skydeal-backend.onrender.com"; // your Render URL

// Inputs (adjust IDs only if yours differ)
const fromEl   = document.getElementById("fromInput");
const toEl     = document.getElementById("toInput");
const depEl    = document.getElementById("departureDateInput");
const retEl    = document.getElementById("returnDateInput");
const paxEl    = document.getElementById("passengersSelect");
const clsEl    = document.getElementById("classSelect");
const tripRoundEl = document.getElementById("tripTypeRound"); // radio
const tripOneEl   = document.getElementById("tripTypeOne");   // radio

// Buttons
const btnPM   = document.getElementById("btnOpenPaymentModal");
const btnSearch = document.getElementById("btnSearch");

// Modal bits
const modal      = document.getElementById("paymentModal");
const backdrop   = document.getElementById("paymentModalBackdrop");
const pmTabs     = document.getElementById("pmTabs");
const pmBody     = document.getElementById("pmBody");
const pmClose    = document.getElementById("pmClose");
const pmCancel   = document.getElementById("pmCancel");
const pmApply    = document.getElementById("pmApply");
const pmCount    = document.getElementById("pmCount");

// Results containers (fill later)
const outboundBox = document.getElementById("outboundBox");
const returnBox   = document.getElementById("returnBox");

// State
let paymentOptions = {
  "Credit Card": [],
  "Debit Card": [],
  "Wallet": [],
  "UPI": [],
  "NetBanking": [],
  "EMI": [],
};
let selectedKeys = new Set(); // e.g. "Credit Card::ICICI Bank"

// ---- modal helpers
function openModal(){ modal.classList.remove("hidden"); backdrop.classList.remove("hidden"); }
function closeModal(){ modal.classList.add("hidden"); backdrop.classList.add("hidden"); }
function setPMLabel(){
  const n = selectedKeys.size;
  pmCount.textContent = n ? `${n} selected` : "Select Payment Methods";
}

const TYPE_ORDER = ["Credit Card","Debit Card","Wallet","UPI","NetBanking","EMI"];

function renderTabs(active=TYPE_ORDER[0]){
  pmTabs.innerHTML = "";
  TYPE_ORDER.forEach(type => {
    const b = document.createElement("button");
    b.className =
      "px-3 py-1 rounded-md text-sm font-medium " +
      (type===active ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200 hover:bg-gray-600");
    b.textContent = type;
    b.addEventListener("click", () => { renderTabs(type); renderOptions(type); });
    pmTabs.appendChild(b);
  });
}

function renderOptions(type){
  const list = paymentOptions[type] || [];
  pmBody.innerHTML = "";
  if (!list.length) { pmBody.innerHTML = `<div class="text-gray-300 text-sm">No options</div>`; return; }

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-2 md:grid-cols-3 gap-3";
  list.forEach(label => {
    const key = `${type}::${label}`;
    const wrap = document.createElement("label");
    wrap.className = "flex items-center gap-2 px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 cursor-pointer";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "h-4 w-4";
    cb.checked = selectedKeys.has(key);
    cb.addEventListener("change", () => {
      if (cb.checked) selectedKeys.add(key); else selectedKeys.delete(key);
      setPMLabel();
    });
    const span = document.createElement("span");
    span.className = "text-gray-100 text-sm";
    span.textContent = label;
    wrap.appendChild(cb); wrap.appendChild(span);
    grid.appendChild(wrap);
  });
  pmBody.appendChild(grid);
}

async function loadPaymentOptions(){
  const r = await fetch(`${BACKEND}/payment-options`);
  const j = await r.json();
  paymentOptions = j?.options || paymentOptions;
}

// -> structure backend expects: [{ bank:"ICICI Bank", type:"credit" }, ...]
function getSelectedPaymentMethods(){
  const out = [];
  selectedKeys.forEach(key => {
    const [typeHuman, bank] = key.split("::");
    let typeKey = null;
    if (typeHuman === "Credit Card") typeKey = "credit";
    else if (typeHuman === "Debit Card") typeKey = "debit";
    else if (typeHuman === "NetBanking") typeKey =
