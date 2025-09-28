// rapport page JS (extracted from Html/rapport.html)
async function loadMembersForReport(){
  let members = [];
  try{ members = window.useIndexedDB ? await window.idbGetAll() : window.loadMembersLocal(); }catch(e){ members = window.loadMembersLocal ? window.loadMembersLocal() : []; }
  const sel = document.getElementById('memberReportSelect'); if(!sel) return;
  sel.innerHTML = '<option value="">-- Choisir --</option>';
  members.forEach(m => { const opt = document.createElement('option'); opt.value = m.code; opt.textContent = `${m.code} — ${m.nom}`; sel.appendChild(opt); });
}

function computeBalanceForMember(code){
  try{
    const depots = JSON.parse(localStorage.getItem('depots') || '[]');
    const payouts = JSON.parse(localStorage.getItem('payouts') || '[]');
    let bal = 0;
    depots.filter(d=>d.memberCode===code).forEach(d=> bal += Number(d.montant||0));
    // subtract payouts (treated as outgoing money) if applicable
    payouts.filter(p=>p.code===code).forEach(p=> bal -= Number(p.amount||0));
    return bal;
  }catch(e){ console.error('computeBalanceForMember error', e); return 0; }
}

// helper: monthly sums grouped by YYYY-MM
function getMonthlySums(items, dateKey){ const months = {}; (items||[]).forEach(it => { const d = new Date(it[dateKey] || it.createdAt || new Date().toISOString()); if(isNaN(d.getTime())) return; const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; months[k] = (months[k]||0) + (parseFloat(it.montant||it.amount)||0); }); return Object.keys(months).sort().map(k=>({ month:k, value: months[k] })); }

// load Chart.js if missing
function ensureChart(){ return new Promise(async (resolve,reject)=>{ if(typeof Chart !== 'undefined') return resolve(); try{ const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/chart.js'; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); }catch(e){ reject(e); } }); }

document.addEventListener('DOMContentLoaded', async function(){
  await loadMembersForReport();
  // DOM nodes
  const repMembers = document.getElementById('reportMembers');
  const repDepots = document.getElementById('reportDepots');
  const repPayouts = document.getElementById('reportRetraits') || document.getElementById('reportPayouts');
  const repSoldes = document.getElementById('reportSoldes');
  const sel = document.getElementById('memberReportSelect');
  const out = document.getElementById('memberBalance');

  // data
  const members = window._membersCache || (window.loadMembersLocal ? window.loadMembersLocal() : []);
  const depots = JSON.parse(localStorage.getItem('depots') || '[]');
  const payouts = JSON.parse(localStorage.getItem('payouts') || '[]');

  if(repMembers) repMembers.textContent = String((members||[]).length || 0);
  if(repDepots) repDepots.textContent = String((depots||[]).reduce((s,i)=> s + (parseFloat(i.montant)||0),0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FC';
  if(repPayouts) repPayouts.textContent = String((payouts||[]).reduce((s,i)=> s + (parseFloat(i.amount)||0),0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FC';
  if(repSoldes) repSoldes.textContent = String(((depots||[]).reduce((s,i)=> s + (parseFloat(i.montant)||0),0) - (payouts||[]).reduce((s,i)=> s + (parseFloat(i.amount)||0),0))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FC';

  if(sel && out){ sel.addEventListener('change', function(){ const code = this.value; if(!code){ out.textContent = '—'; return; } const b = computeBalanceForMember(code); out.textContent = b.toLocaleString('fr-FR') + ' FC'; }); }

  // prepare monthly series and render chart
  const monthlyDep = getMonthlySums(depots,'date');
  const monthlyPay = getMonthlySums(payouts,'date');
  const labels = Array.from(new Set([...(monthlyDep||[]).map(d=>d.month), ...(monthlyPay||[]).map(d=>d.month)])).sort();
  const depMap = Object.fromEntries((monthlyDep||[]).map(d=>[d.month,d.value]));
  const payMap = Object.fromEntries((monthlyPay||[]).map(d=>[d.month,d.value]));
  const dataDep = labels.map(l => depMap[l]||0);
  const dataPay = labels.map(l => payMap[l]||0);

  // render Chart.js
  try{
    await ensureChart();
    const ctx = document.getElementById('reportChart');
    if(ctx && window.Chart){
      // clear previous canvas content
      ctx.getContext('2d').clearRect(0,0,ctx.width, ctx.height);
      new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [ { label:'Dépôts', data: dataDep, backgroundColor:'#10b981' }, { label:'Paiements', data: dataPay, backgroundColor:'#ef4444' } ] },
        options: { responsive:true, plugins:{ legend:{ position:'top' } }, scales:{ x:{ stacked:false }, y:{ beginAtZero:true } } }
      });
    }
  }catch(e){ console.warn('Chart rendering failed', e); const container = document.getElementById('reportChart'); if(container) container.parentNode.innerHTML = '<div style="text-align:center;color:var(--muted)">Graphique indisponible</div>'; }
});