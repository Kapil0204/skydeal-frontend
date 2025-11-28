:root{
  --bg:#101720;
  --surface:#1c2632;
  --surface-2:#232f3d;
  --text:#e7eef8;
  --muted:#a9b6c6;
  --primary:#6ea8fe;
  --radius:16px;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0; background:var(--bg); color:var(--text);
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
  overflow-y:scroll; overflow-x:hidden; /* <- stops horizontal scroll */
}
.app-shell{display:flex; flex-direction:column; min-height:100vh}
.hero{padding:24px 16px 0}
.hero h1{margin:0 auto; max-width:1200px; font-size:36px; font-weight:800}

.search-card{
  margin:16px auto 0; padding:16px;
  max-width:1200px; background:var(--surface);
  border-radius:var(--radius); box-shadow:0 10px 24px rgba(0,0,0,.25);
}
.inputs-row{
  display:grid; grid-template-columns: repeat(8, minmax(0,1fr));
  gap:12px;
}
.input{
  width:100%; padding:12px 12px; border-radius:12px; border:1px solid #2b3a4c;
  background:var(--surface-2); color:var(--text);
}
.input.small{padding:8px 10px; font-size:14px}

.trip-type{
  display:flex; align-items:center; justify-content:center; gap:12px;
  background:var(--surface-2); border:1px solid #2b3a4c; border-radius:12px; padding:8px 10px;
}
.button{
  border:0; border-radius:12px; padding:12px 16px; cursor:pointer; font-weight:600;
}
.button.primary{background:var(--primary); color:#081221}
.button.ghost{background:var(--surface-2); color:var(--text); border:1px solid #2b3a4c}

.results-grid{
  margin:16px auto; max-width:1200px;
  display:grid; grid-template-columns:1fr 1fr; gap:16px;
}
.results-col{background:var(--surface); border-radius:var(--radius); padding:12px}
.results-head{display:flex; align-items:center; justify-content:space-between; gap:12px}
.results-head h2{margin:6px 0 10px; font-size:20px}
.row-controls{display:flex; gap:10px}

.card-list{
  background:var(--surface-2); border:1px solid #2b3a4c; border-radius:12px; padding:12px; min-height:180px;
}
.flight-card{
  display:flex; justify-content:space-between; align-items:center;
  border:1px solid #314256; border-radius:12px; padding:12px; margin-bottom:10px;
}
.flight-main{display:flex; gap:16px; align-items:center}
.fname{font-weight:700}
.fmeta{color:var(--muted); font-size:14px}
.price{font-weight:800}
.i-btn{
  border-radius:999px; width:36px; height:36px; line-height:36px; text-align:center;
  border:1px solid #314256; background:var(--surface); color:var(--text); cursor:pointer;
}

/* Modals */
.modal{position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.45); padding:16px; z-index:50}
.modal.hidden{display:none}
.modal-panel{max-width:760px; width:100%; background:var(--surface); border-radius:16px; border:1px solid #314256}
.modal-header{padding:12px 14px; border-bottom:1px solid #2b3a4c}
.modal-body{padding:14px}
.modal-footer{padding:12px 14px; display:flex; gap:10px; justify-content:flex-end}

.tabs{display:flex; gap:8px; flex-wrap:wrap}
.tab{
  padding:8px 12px; border-radius:10px; border:1px solid #2b3a4c;
  background:var(--surface-2); color:var(--text); cursor:pointer; font-weight:600; font-size:14px;
}
.tab.active{outline:2px solid var(--primary);}

.pm-group{margin-bottom:12px}
.pm-item{display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px}
.pm-item:hover{background:#19222d}
.pm-item input{transform:scale(1.2)}

/* Responsive: keeps everything on-screen, no overflow */
@media (max-width: 1080px){
  .inputs-row{grid-template-columns: 1fr 1fr; }
  .results-grid{grid-template-columns:1fr; }
  .hero h1, .search-card, .results-grid{padding-left:12px; padding-right:12px}
}
