// script.js — FULL FILE (no layout changes)
const backend = (location.hostname.includes("vercel.app"))
  ? "https://skydeal-backend.onrender.com"
  : "http://localhost:10000";

/* elements */
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

/* default dates */
function todayPlus(d=0){ const t=new Date(); t.setDate(t.getDate()+d); return t.toISOString().slice(0,10); }
if (el.dep && !el.dep.value) el.dep.value = todayPlus(1);
if (el.ret && !el.ret.value) el.ret.value = todayPlus(4);

/* state */
let paymentOptions = null;
let selectedPayments = [];     // user-selected banks (strings)
let lastMeta = null;

/* payment modal */
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

    // order: checkbox then label — left aligned
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

/* results rendering + paging */
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
  (f.portalPrices || []).forEach(p=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.portal}</td><td>₹${fmt(p.finalPrice)}</td><td>${p.source}</td>`;
    el.modalBody.appendChild(tr);
  });
  el.whyJson.textContent = JSON.stringify(meta?.offerDebug || {}, null, 2);
  el.modal.classList.remove("hidden");
}
el.modalClose?.addEventListener("click", ()=> el.modal.classList.add("hidden"));
el.modalClose2?.addEventListener("click", ()=> el.modal.classList.add("hidden"));

async function doSearch(){
  try {
    // if payment modal is open, close it to avoid overlay blocking clicks
    el.pmModal.classList.add("hidden");

    const body = {
      from: el.from.value.trim().toUpperCase(),
      to: el.to.value.trim().toUpperCase(),
      departureDate: el.dep.value,
      returnDate: el.roundtrip.checked ? el.ret.value : "",
      tripType: el.roundtrip.checked ? "round-trip" : "one-way",
      passengers: Number(el.pax.value || 1),
      travelClass: el.cabin.value,
      paymentMethods: selectedPayments.slice(0, 20)
    };

    const r = await fetch(`${backend}/search`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    lastMeta = data.meta || {};

    window._outbound = Array.isArray(data.outboundFlights) ? data.outboundFlights : [];
    window._return = Array.isArray(data.returnFlights) ? data.returnFlights : [];

    OUT_PAGE = 1; RET_PAGE = 1;
    renderLists();
  } catch (e) {
    console.error("search failed:", e);
    alert("Search failed. Please try again.");
  }
}

function renderLists(){
  const O = window._outbound || [];
  const R = window._return || [];
  const maxOut = setPager(el.outPage, OUT_PAGE, O.length);
  const maxRet = setPager(el.retPage, RET_PAGE, R.length);

  const out = paged(O, OUT_PAGE);
  const ret = paged(R, RET_PAGE);

  el.outList.innerHTML = out.map(cardHTML).join("");
  el.retList.innerHTML = ret.map(cardHTML).join("");

  bindCardButtons(el.outList, out, lastMeta);
  bindCardButtons(el.retList, ret, lastMeta);

  el.outPrev.onclick = ()=>{ if(OUT_PAGE>1){ OUT_PAGE--; renderLists(); } };
  el.outNext.onclick = ()=>{ if(OUT_PAGE<maxOut){ OUT_PAGE++; renderLists(); } };
  el.retPrev.onclick = ()=>{ if(RET_PAGE>1){ RET_PAGE--; renderLists(); } };
  el.retNext.onclick = ()=>{ if(RET_PAGE<maxRet){ RET_PAGE++; renderLists(); } };
}

/* ensure Search works even if DOM loaded earlier */
el.searchBtn?.addEventListener("click", (e)=>{ e.preventDefault(); doSearch(); });

/* init */
loadPaymentOptions().catch(()=>{});
