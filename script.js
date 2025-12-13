const API_BASE = "https://skydeal-backend.onrender.com";

let paymentOptions = {};
let selectedCategory = null;
let selectedBanks = new Set();

/* ------------------------------
   PAYMENT MODAL HANDLING
-------------------------------- */

const modal = document.getElementById("paymentModal");
const openBtn = document.getElementById("openPaymentModal");
const closeBtn = document.getElementById("closePaymentModal");
const clearBtn = document.getElementById("clearPayments");

openBtn.onclick = async () => {
  modal.classList.remove("hidden");
  await fetchPaymentOptions();
};

closeBtn.onclick = () => {
  modal.classList.add("hidden");
};

clearBtn.onclick = () => {
  selectedBanks.clear();
  renderBankList();
};

/* ------------------------------
   FETCH PAYMENT OPTIONS
-------------------------------- */

async function fetchPaymentOptions() {
  const res = await fetch(`${API_BASE}/payment-options`);
  const data = await res.json();

  paymentOptions = data.options || {};
  renderCategoryChips();
}

/* ------------------------------
   CATEGORY CHIPS
-------------------------------- */

function renderCategoryChips() {
  const chipContainer = document.getElementById("payment-category-chips");
  if (!chipContainer) return;

  chipContainer.innerHTML = "";

  Object.keys(paymentOptions).forEach(category => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.innerText = category;

    chip.onclick = () => {
      selectedCategory = category;
      renderBankList();
    };

    chipContainer.appendChild(chip);
  });
}

/* ------------------------------
   BANK LIST
-------------------------------- */

function renderBankList() {
  const list = document.getElementById("payment-options-list");
  if (!list) return;

  list.innerHTML = "";

  if (!selectedCategory || !paymentOptions[selectedCategory]) {
    list.innerHTML = "<p>No options</p>";
    return;
  }

  const banks = [...new Set(paymentOptions[selectedCategory])];

  banks.forEach(bank => {
    const row = document.createElement("div");
    row.className = "bank-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedBanks.has(bank);

    checkbox.onchange = () => {
      checkbox.checked
        ? selectedBanks.add(bank)
        : selectedBanks.delete(bank);
    };

    const label = document.createElement("span");
    label.innerText = bank;

    row.appendChild(checkbox);
    row.appendChild(label);
    list.appendChild(row);
  });
}

/* ------------------------------
   SEARCH
-------------------------------- */

document.getElementById("searchBtn").onclick = async () => {
  const body = {
    from: document.getElementById("from").value,
    to: document.getElementById("to").value,
    departureDate: document.getElementById("departDate").value,
    returnDate: document.getElementById("returnDate").value,
    tripType: document.getElementById("returnDate").value ? "round-trip" : "one-way",
    passengers: 1,
    travelClass: "economy",
    paymentMethods: [...selectedBanks]
  };

  const res = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  console.log("Search result:", data);
};
