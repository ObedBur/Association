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
    const retraits = JSON.parse(localStorage.getItem('retraits') || '[]');
    let bal = 0;
    depots.filter(d=>d.memberCode===code).forEach(d=> bal += Number(d.montant||0));
    retraits.filter(r=>r.memberCode===code).forEach(r=> bal -= Number(r.montant||0));
    return bal;
  }catch(e){ console.error('computeBalanceForMember error', e); return 0; }
}

document.addEventListener('DOMContentLoaded', async function(){
  await loadMembersForReport();
  const sel = document.getElementById('memberReportSelect');
  const out = document.getElementById('memberBalance');
  if(!sel || !out) return;
  sel.addEventListener('change', function(){ const code = this.value; if(!code){ out.textContent = '—'; return; } const b = computeBalanceForMember(code); out.textContent = b.toLocaleString('fr-FR') + ' FC'; });
}); 