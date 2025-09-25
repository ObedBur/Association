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
(function(){
  function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
  function addMonths(dateStr, n){ const d = new Date(dateStr); const y = d.getFullYear(); const m = d.getMonth(); const day = d.getDate(); const targetMonth = m + n; const newYear = y + Math.floor(targetMonth/12); const newMonth = targetMonth % 12; const maxDay = daysInMonth(newYear, newMonth); const newDay = Math.min(day, maxDay); return new Date(newYear, newMonth, newDay); }
  function loadRetraits(){ try{ return JSON.parse(localStorage.getItem('retraits') || '[]'); }catch(e){ return []; } }
  function saveRetraits(list){ localStorage.setItem('retraits', JSON.stringify(list)); }
  function getLastDepositForMember(code){ try{ const depots = JSON.parse(localStorage.getItem('depots') || '[]'); const memberDepots = depots.filter(d => d.memberCode === code).sort((a,b)=> new Date(b.date) - new Date(a.date)); return memberDepots.length ? memberDepots[0] : null; }catch(e){ return null; } }
  function renderRetraits(){ const container = document.getElementById('retraitsContainer'); if(!container) return; const list = loadRetraits(); if(list.length === 0){ container.innerHTML = '<p>Aucun retrait enregistré.</p>'; const el=document.getElementById('retraitCount'); if(el) el.textContent='0'; return; } const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>Date</th><th>Code</th><th>Nom</th><th>Montant</th></tr></thead>'; const tbody = document.createElement('tbody'); list.slice().reverse().forEach(r => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${r.date}</td><td>${r.memberCode}</td><td>${r.memberName}</td><td>${r.montant} FC</td>`; tbody.appendChild(tr); }); container.innerHTML=''; table.appendChild(tbody); container.appendChild(table); const el=document.getElementById('retraitCount'); if(el) el.textContent = String(list.length); }
  function isWithdrawalAllowed(memberCode){ const last = getLastDepositForMember(memberCode); if(!last) return { allowed:false, reason:'Aucun dépôt trouvé pour ce membre' }; const allowedDate = addMonths(last.date, 1); const now = new Date(); if(now >= allowedDate) return { allowed:true, allowedDate }; return { allowed:false, allowedDate }; }
  document.addEventListener('DOMContentLoaded', function(){ try{ loadMembersForSelect = async function(){ const sel = document.getElementById('memberSelect'); if(!sel) return; sel.innerHTML = '<option value="">-- Choisir --</option>'; let members = window._membersCache || []; if(!members || members.length===0){ try{ if(window.idbGetAll) members = await window.idbGetAll(); }catch(e){} members = members || (window.loadMembersLocal ? window.loadMembersLocal() : []); } window._membersCache = members || []; (members || []).forEach(m => { const opt = document.createElement('option'); opt.value = m.code; opt.textContent = `${m.code} — ${m.nom}`; sel.appendChild(opt); }); };
    (async ()=>{ await loadMembersForSelect(); renderRetraits(); const btnRetrait = document.getElementById('btnRetrait'); if(btnRetrait) btnRetrait.disabled = true; const initialSel = document.getElementById('memberSelect'); if(initialSel && initialSel.options && initialSel.options.length > 1){ initialSel.selectedIndex = 1; initialSel.dispatchEvent(new Event('change')); }
      const sel = document.getElementById('memberSelect'); if(sel) sel.addEventListener('change', function(){ const raw = this.value || this.options[this.selectedIndex].text; const members = window._membersCache || (window.loadMembersLocal ? window.loadMembersLocal() : []); let m = (members || []).find(x=>String(x.code).trim() === String(raw).trim()); if(!m){ m = (members || []).find(x => (`${x.code} — ${x.nom}`).toLowerCase().indexOf(String(raw).toLowerCase()) !== -1); } document.getElementById('memberName').textContent = m ? m.nom : 'Aucun membre sélectionné'; document.getElementById('memberMeta').textContent = m ? `Code: ${m.code} — Tel: ${m.telephone||'—'}` : 'Détails affichés ici'; const info = document.getElementById('retraitInfo'); if(!raw){ info.textContent = 'Sélectionnez un membre pour voir si le retrait est autorisé.'; return; } const codeToCheck = m ? m.code : raw; const check = isWithdrawalAllowed(codeToCheck); if(check.allowed){ info.innerHTML = `<strong style="color:var(--success)">Retrait autorisé</strong> — Vous pouvez retirer maintenant.`; document.getElementById('btnRetrait').disabled = false; } else{ const allowedDate = check.allowedDate ? new Date(check.allowedDate) : null; const adStr = allowedDate ? allowedDate.toLocaleDateString() : '—'; info.innerHTML = `<span style="color:var(--danger)">Retrait bloqué</span> — prochain retrait possible le <strong>${adStr}</strong>`; document.getElementById('btnRetrait').disabled = true; } });
      const btn = document.getElementById('btnRetrait'); if(btn) btn.addEventListener('click', async function(){ const raw = document.getElementById('memberSelect').value || document.getElementById('memberSelect').options[document.getElementById('memberSelect').selectedIndex].text; if(!raw){ if(window.showToast) showToast('Sélectionnez un membre','error'); return; } const members = window._membersCache || (window.loadMembersLocal ? window.loadMembersLocal() : []); const m = (members || []).find(x=>String(x.code).trim() === String(raw).trim()) || (members || []).find(x => (`${x.code} — ${x.nom}`).toLowerCase().indexOf(String(raw).toLowerCase()) !== -1) || null; const code = m ? m.code : raw; const check = isWithdrawalAllowed(code); if(!check.allowed){ if(window.showToast) showToast('Retrait non autorisé avant: ' + (check.allowedDate ? new Date(check.allowedDate).toLocaleDateString() : '—'), 'error'); return; } const montant = parseInt(document.getElementById('montantRetrait').value || '0',10); if(!montant || montant <= 0){ if(window.showToast) showToast('Montant invalide','error'); return; } const retrait = { id: Date.now(), memberCode: code, memberName: m ? m.nom : '', montant: montant, date: new Date().toISOString().slice(0,10), createdAt: new Date().toISOString() }; const list = loadRetraits(); list.push(retrait); saveRetraits(list); renderRetraits(); if(window.showToast) window.showToast('Retrait enregistré','success'); });
      const exportBtn = document.getElementById('exportRetrait'); if(exportBtn) exportBtn.addEventListener('click', function(){ const rows = loadRetraits(); if(rows.length===0){ if(window.showToast) showToast('Aucun retrait à exporter','info'); return; } const csv=['Date,Code,Nom,Montant']; rows.forEach(r=> csv.push([r.date,r.memberCode,'"'+(r.memberName||'')+'"', r.montant].join(','))); const blob=new Blob([csv.join('\n')],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='retraits.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); });
      const clearBtn = document.getElementById('clearRetrait'); if(clearBtn) clearBtn.addEventListener('click', async function(){ if(!await confirmDialog('Supprimer tous les retraits ?')) return; saveRetraits([]); renderRetraits(); });
    })();
  }catch(e){ console.error('retrait bundle error', e); }
  });
})();

// ---- rapport.html script ----
document.addEventListener('DOMContentLoaded', function(){
  try{
    function sum(list, key){ return (list||[]).reduce((s,i)=> s + (parseFloat(i[key])||0),0); }
    function formatFc(v){ return String(v) + ' FC'; }
    function getMonthlySums(items, dateKey){ const months = {}; (items||[]).forEach(it => { const d = new Date(it[dateKey] || it.createdAt || new Date().toISOString()); const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; months[k] = (months[k]||0) + (parseFloat(it.montant)||0); }); return Object.keys(months).sort().map(k=>({ month:k, value: months[k] })); }
    const members = window._membersCache || (window.loadMembersLocal ? window.loadMembersLocal() : []);
    const depots = JSON.parse(localStorage.getItem('depots') || '[]');
    const retraits = JSON.parse(localStorage.getItem('retraits') || '[]');
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


