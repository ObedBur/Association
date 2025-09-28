// App bundle containing page-specific scripts (extracted from HTML pages)

// ---- liste.html script ----
document.addEventListener('DOMContentLoaded', function(){
  try{
    const search = document.getElementById('search');
    const exportBtn = document.getElementById('exportCsv');
    const pageCount = document.getElementById('pageCount');

    function updatePageCount(){
      const rows = document.querySelectorAll('#membersContainer table tbody tr');
      if(pageCount) pageCount.textContent = String(rows.length || 0);
    }

    if(search) search.addEventListener('input', function(){
      const q = this.value.trim().toLowerCase();
      const rows = document.querySelectorAll('#membersContainer table tbody tr');
      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = q === '' || text.indexOf(q) !== -1 ? '' : 'none';
      });
    });

    if(exportBtn) exportBtn.addEventListener('click', function(){
      const rows = Array.from(document.querySelectorAll('#membersContainer table tbody tr'))
        .filter(r => r.style.display !== 'none');
      if(rows.length === 0){ if(window.showToast) showToast('Aucun membre à exporter', 'info'); return; }
      const csv = [];
      const headers = Array.from(document.querySelectorAll('#membersContainer table thead th')).map(h=>h.textContent.trim());
      csv.push(headers.join(','));
      rows.forEach(r => {
        const cols = Array.from(r.querySelectorAll('td')).map(td => '"'+td.textContent.trim().replace(/"/g,'""')+'"');
        csv.push(cols.join(','));
      });
      const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'membres.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });

    setTimeout(function(){ updatePageCount(); const observer = new MutationObserver(()=> updatePageCount()); const container = document.getElementById('membersContainer'); if(container) observer.observe(container, { childList:true, subtree:true }); }, 300);
  }catch(e){ console.error('liste page bundle error', e); }
});

// ---- epargne.html script ----
(function(){
  async function loadMembers(){
    if(window.useIndexedDB){ try{ return await window.useIndexedDB() ? await window.idbGetAll() : window.loadMembersLocal(); }catch(e){ return window.loadMembersLocal ? window.loadMembersLocal() : []; } }
    return window.loadMembersLocal ? window.loadMembersLocal() : [];
  }
  function loadDepots(){ try{ return JSON.parse(localStorage.getItem('depots') || '[]'); }catch(e){ return []; } }
  function saveDepots(list){ localStorage.setItem('depots', JSON.stringify(list)); }

  async function populateMembers(){
    const sel = document.getElementById('memberSelect'); if(!sel) return;
    sel.innerHTML = '<option value="">-- Choisir --</option>';
    const members = await loadMembers();
    window._membersCache = members || [];
    members.forEach(m => {
      const opt = document.createElement('option'); opt.value = m.code; opt.textContent = `${m.code} — ${m.nom}`; sel.appendChild(opt);
    });
  }

  function renderDepots(){
    const container = document.getElementById('depotsContainer');
    if(!container) return;
    const list = loadDepots();
    if(list.length === 0){ container.innerHTML = '<p>Aucun dépôt enregistré.</p>'; const el=document.getElementById('depotCount'); if(el) el.textContent='0'; return; }
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Date</th><th>Code</th><th>Nom</th><th>Montant</th></tr></thead>';
    const tbody = document.createElement('tbody');
    list.slice().reverse().forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.date}</td><td>${d.memberCode}</td><td>${d.memberName}</td><td>${d.montant} FC</td>`;
      tbody.appendChild(tr);
    });
    container.innerHTML = '';
    table.appendChild(tbody);
    container.appendChild(table);
    const el = document.getElementById('depotCount'); if(el) el.textContent = String(list.length);
  }

  function showMemberDetails(code){
    const members = window._membersCache || (window.loadMembersLocal ? window.loadMembersLocal() : []);
    const nameEl = document.getElementById('memberName');
    const metaEl = document.getElementById('memberMeta');
    if(!code){ if(nameEl) nameEl.textContent = 'Aucun membre sélectionné'; if(metaEl) metaEl.textContent = 'Détails affichés ici'; return; }
    let m = (members || []).find(x=>String(x.code).trim() === String(code).trim());
    if(!m){ m = (members || []).find(x => (`${x.code} — ${x.nom}`).toLowerCase().indexOf(String(code).toLowerCase()) !== -1); }
    if(!m){ const local = window.loadMembersLocal ? window.loadMembersLocal() : []; m = local.find(x=>String(x.code).trim() === String(code).trim()) || null; }
    if(!m){ console.debug('showMemberDetails: member not found', { code, members }); if(nameEl) nameEl.textContent = 'Aucun membre sélectionné'; if(metaEl) metaEl.textContent = 'Détails affichés ici'; return; }
    if(nameEl) nameEl.textContent = `${m.nom}`;
    if(metaEl) metaEl.innerHTML = `Code: <strong>${m.code}</strong><br>Tel: ${m.telephone||'—'} — Montant choisi: ${m.montant||0} FC`;
  }

  document.addEventListener('DOMContentLoaded', async function(){
    try{
      await populateMembers(); renderDepots();
      const sel = document.getElementById('memberSelect'); if(sel) sel.addEventListener('change', function(){ showMemberDetails(this.value || this.options[this.selectedIndex].text); });
      const btn = document.getElementById('btnDepot'); if(btn) btn.addEventListener('click', function(){
        const memberCode = document.getElementById('memberSelect').value;
        const montant = document.getElementById('montantSel').value;
        const date = document.getElementById('depotDate').value || new Date().toISOString().slice(0,10);
        if(!memberCode){ if(window.showToast) showToast('Choisissez un membre','error'); return; }
        const members = window.loadMembersLocal ? window.loadMembersLocal() : [];
        const m = members.find(x=>x.code===memberCode);
        const dep = { id: Date.now(), memberCode: memberCode, memberName: m ? m.nom : '', montant: parseInt(montant,10), date: date, createdAt: new Date().toISOString() };
        const list = loadDepots(); list.push(dep); saveDepots(list);
        renderDepots(); if(window.showToast) window.showToast('Dépôt enregistré', 'success');
      });
      const exportBtn = document.getElementById('exportDepot'); if(exportBtn) exportBtn.addEventListener('click', function(){ const rows = loadDepots(); if(rows.length===0){ if(window.showToast) showToast('Aucun dépôt à exporter','info'); return; } const csv = ['Date,Code,Nom,Montant']; rows.forEach(r=> csv.push([r.date,r.memberCode,'"'+(r.memberName||'')+'"', r.montant].join(','))); const blob = new Blob([csv.join('\n')], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download='depots.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); });
      const clearBtn = document.getElementById('clearDepot'); if(clearBtn) clearBtn.addEventListener('click', async function(){ if(!await confirmDialog('Supprimer tous les dépôts ?')) return; saveDepots([]); renderDepots(); });
    }catch(e){ console.error('epargne bundle error', e); }
  });
})();

// ---- retrait.html script ----
// Removed: retrait page and script (file deleted)

// ---- rapport.html script ----
document.addEventListener('DOMContentLoaded', function(){
  try{
    function sum(list, key){ return (list||[]).reduce((s,i)=> s + (parseFloat(i[key])||0),0); }
    function formatFc(v){ return String(v) + ' FC'; }
    function getMonthlySums(items, dateKey){ const months = {}; (items||[]).forEach(it => { const d = new Date(it[dateKey] || it.createdAt || new Date().toISOString()); const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; months[k] = (months[k]||0) + (parseFloat(it.montant)||0); }); return Object.keys(months).sort().map(k=>({ month:k, value: months[k] })); }
    const members = window._membersCache || (window.loadMembersLocal ? window.loadMembersLocal() : []);
    const depots = JSON.parse(localStorage.getItem('depots') || '[]');
    const retraits = [];
    const repMembers = document.getElementById('reportMembers'); if(repMembers) repMembers.textContent = String((members||[]).length || 0);
    const repDepots = document.getElementById('reportDepots'); if(repDepots) repDepots.textContent = formatFc(sum(depots,'montant'));
    const repRet = document.getElementById('reportRetraits'); if(repRet) repRet.textContent = formatFc(sum(retraits,'montant'));
    const repSoldes = document.getElementById('reportSoldes'); if(repSoldes) repSoldes.textContent = formatFc(sum(depots,'montant') - sum(retraits,'montant'));
    const monthlyDep = getMonthlySums(depots,'date'); const monthlyRet = getMonthlySums(retraits,'date');
    const labels = Array.from(new Set([...monthlyDep.map(d=>d.month), ...monthlyRet.map(d=>d.month)])).sort();
    if(labels.length === 0){ const chart = document.getElementById('chartContainer'); if(chart) chart.textContent = 'Pas encore de données.'; return; }
    const depMap = Object.fromEntries(monthlyDep.map(d=>[d.month,d.value])); const retMap = Object.fromEntries(monthlyRet.map(d=>[d.month,d.value])); const max = Math.max(...labels.map(l => Math.max(depMap[l]||0, retMap[l]||0, 1)));
    const svgWidth = Math.min(900, labels.length * 70); const svgHeight = 300; let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
    const padding = 40; const plotW = svgWidth - padding*2; const plotH = svgHeight - padding*2;
    labels.forEach((lab,i)=>{ const x = padding + i * (plotW / labels.length) + 8; const w = 18; const dv = depMap[lab]||0; const rv = retMap[lab]||0; const dh = (dv / max) * plotH; const rh = (rv / max) * plotH; svg += `<rect x="${x}" y="${padding + (plotH - dh)}" width="${w}" height="${dh}" fill="#10b981" opacity="0.9"></rect>`; svg += `<rect x="${x+20}" y="${padding + (plotH - rh)}" width="${w}" height="${rh}" fill="#ef4444" opacity="0.9"></rect>`; svg += `<text x="${x+10}" y="${svgHeight - 6}" font-size="10" text-anchor="middle" fill="#64748b">${lab}</text>`; });
    svg += `</svg>`; const chart = document.getElementById('chartContainer'); if(chart) chart.innerHTML = svg;
  }catch(e){ console.error('rapport bundle error', e); }
});


