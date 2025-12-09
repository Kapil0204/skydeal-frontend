// Detect backend
const backend = (location.hostname.includes("vercel.app"))
  ? "https://skydeal-backend.onrender.com"
  : "http://localhost:10000";

/* elements (IDs must match index.html) */
const el = {
  from: document.getElementById("from"),
  to: document.getElementById("to"),
  dep: document.getElementById("dep"),
  ret: document.getElementById("ret"),
  pax: document.getElementById("pax"),
  cabin: document.getElementById("cabin"),
  oneway: document.getElementById("oneway"),
  roundtrip: document.getElementById("roundtrip"),
  pmBtn: document.getElementById("pmBtn"),
  searchBtn: document.getElementById("searchBtn"),
  outList: document.getElementById("outboundList"),
  retList: document.getElementById("returnList"),
  outPrev: document.getElementById("outPrev"),
  outNext: document.getElementById("outNext"),
  outPage: document.getElementById("outPage"),
  retPrev: document.getElementById("retPrev"),
  retNext: document.getElementById("retNext"),
  retPage: document.getElementById("retPage"),

  modal: document.getElementById("modal"),
  modalClose: document.getElementById("modalClose"),
  modalClose2: document.getElementById("modalClose2"),
  modalRoute: document.getElementById("modalRoute"),
  modalBody: document.getElementById("modalBody"),
  whyJson: document.getElementById("whyJson"),

  pmModal: document.getElementById("pmModal"),
  pmClose: document.getElementById("pmClose"),
  pmDone: document.getElementById("pmDone"),
  pmClear: document.getElementById("pmClear"),
  pmTabs: document.getElementById("pmTabs"),
  pmList: document.getElementById("pmList"),
};

/* defaults */
function todayPlus(d=0){ const t=new Date(); t.setDate(t.getDate()+d); return t.toISOString().slice(0,10); }
if (el.dep && !el.dep.value) el.dep.value = todayPlus(1);
if (el.ret && !el.ret.value) el.ret.value = todayPlus(4);

/* state */
let paymentOptions = null;
let selectedPayments = [];
let lastMeta = null;

/* --- Payment modal --- */
async function loadPaymentOptions() {
  const r = await fetch(`${backend}/payment-options`);
  paymentOptions = await r.json();
  buildPmUI();
}
function buildPmUI() {
  const tabs = ["CreditCard","DebitCard","NetBanking","UPI","Wallet","EMI"];
  el.pmTabs.innerHTML = "";
  tabs.forEach((t,i)=>{
    const b=document.createElement("button");
    b.type = "button";
    b.textContent = t.replace(/([A-Z])/g,' $1').trim();
    b.className = "tab-btn" + (i===0 ? " active":"");
    b.addEventListener("click", ()=>{
      [...el.pmTabs.children].forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      renderPmList(t);
    });
    el.pmTabs.appendChild(b);
  });
  renderPmList(tabs[0]);
}
function renderPmList(tab){
  el.pmList.innerHTML = "";
  const list = paymentOptions?.options?.[tab] || [];
  list.forEach(name=>{
    const row = document.createElement("div");
    row.className = "pm-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedPayments.includes(name);
    cb.addEventListener("change", ()=>{
      if(cb.checked){ if(!selectedPayments.includes(name)) selectedPayments.push(name); }
      else { selectedPayments = selectedPayments.filter(x => x!==name); }
    });

    const lab = document.createElement("label");
    lab.textContent = name;
    row.append(cb, lab);
    el.pmList.appendChild(row);
  });
}
el.pmBtn?.addEventListener("click", async ()=>{
  if(!paymentOptions) await loadPaymentOptions();
  el.pmModal.classList.remove("hidden");
});
el.pmClose?.addEventListener("click", ()=> el.pmModal.classList.add("hidden"));
el.pmDone?.addEventListener("click", ()=> el.pmModal.classList.add("hidden"));
el.pmClear?.addEventListener("click", ()=> { selectedPayments=[]; buildPmUI(); });

/* --- Results + paging --- */
let OUT_PAGE = 1, RET_PAGE = 1;
const PAGE_SIZE = 10;
function paged(arr, page){ const a = arr||[]; const start=(page-1)*PAGE_SIZE; return a.slice(start,start+PAGE_SIZE); }
function setPager(labelEl, page, total){ const pages = Math.max(1, Math.ceil((total||0)/PAGE_SIZE)); labelEl.textContent = `Page ${Math.min(page,pages)} / ${pages}`; return pages; }
function fmt(n){ return Number(n).toLocaleString("en-IN"); }

function cardHTML(f) {
  const title = `${f.airlineName || ""} • ${f.flightNumber || f.itin || ""}`.trim();
  const best = f.bestDeal || { portal:"", finalPrice: f.price };
  const appliedLine = (best?.reason?.summary)
    ? `<div class="best-reason">Applied: ${best.reason.summary}</div>`
    : "";

  return `
    <div class="card">
      <h4>${title}</h4>
      <div class="route-muted">Non-stop</div>
      <div class="best">Best: ₹${fmt(best.finalPrice)} on ${best.portal}</div>
      ${appliedLine}
      <div class="row">
        <span class="muted">Best price after applicable offers (if any)</span>
        <button class="btn" data-action="prices" type="button">Prices & breakdown</button>
      </div>
    </div>
  `;
}

function bindCardButtons(scopeEl, list, meta) {
  const btns = scopeEl.querySelectorAll("[data-action='prices']");
  btns.forEach((btn, i)=>{
    btn.addEventListener("click", ()=>{
      const f = list[i];
      openPricesModal(f, meta);
    });
  });
}

function openPricesModal(f, meta){
  el.modalRoute.textContent = `${f.airlineName || ""} • ${f.flightNumber || f.itin || ""} • Base ₹${fmt(f.price)}`;
  el.modalBody.innerHTML = "";
