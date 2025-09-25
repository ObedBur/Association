// deposits page script (extracted from Html/epargne.html) - now using api wrapper if available
const DEPOTS_KEY = 'depots';

function loadDepotsLocal(){ try{ return JSON.parse(localStorage.getItem(DEPOTS_KEY) || '[]'); }catch(e){ return []; } }
function saveDepotsLocal(list){ localStorage.setItem(DEPOTS_KEY, JSON.stringify(list)); }

async function loadMembers(){
  if(window.api && typeof window.api.getMembers === 'function'){
    try{ return await window.api.getMembers(); }catch(e){ /* fallback to local */ }
  }
  if(window.useIndexedDB){ try{ return await window.idbGetAll(); }catch(e){ return window.loadMembersLocal ? window.loadMembersLocal() : []; } }
  return window.loadMembersLocal ? window.loadMembersLocal() : [];
}

async function renderDepots(){
  const container = document.getElementById('depotsContainer');
  let list = [];
  if(window.api && typeof window.api.getDepots === 'function'){
    try{ list = await window.api.getDepots(); }catch(e){ list = loadDepotsLocal(); }
  } else { list = loadDepotsLocal(); }
  if(!container) return;
  if(list.length === 0){ container.innerHTML = '<p>Aucun dépôt enregistré.</p>'; const el = document.getElementById('depotCount'); if(el) el.textContent = '0'; return; }
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

async function populateMembers(){
  const sel = document.getElementById('memberSelect');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Choisir --</option>';
  let members = await loadMembers();
  if(!members || members.length === 0){
    // fallback to localStorage/IDB
    members = window.loadMembersLocal ? window.loadMembersLocal() : [];
    if(window.showToast) window.showToast('Aucun membre trouvé via l\'API, utilisation du stockage local', 'info');
  }
  // normalize fields (support both {code,nom} and {id,name})
  const normalized = (members||[]).map(m => ({
    code: m.code || m.id || m.email || '',
    nom: m.nom || m.name || m.nom || m.fullName || '' ,
    raw: m
  }));
  window._membersCache = normalized.map(n => Object.assign({}, n.raw, { code: n.code, nom: n.nom }));
  normalized.forEach(m => {
    if(!m.code) return; // skip invalid
    const opt = document.createElement('option'); opt.value = m.code; opt.textContent = `${m.code} — ${m.nom}`; sel.appendChild(opt);
  });
  if((normalized||[]).filter(x=>x.code).length === 0){ if(window.showToast) window.showToast('Aucun membre disponible', 'info'); }
}

function showMemberDetails(code){
  const members = window._membersCache || (window.loadMembersLocal ? window.loadMembersLocal() : []);
  const nameEl = document.getElementById('memberName');
  const metaEl = document.getElementById('memberMeta');
  if(!code){ if(nameEl) nameEl.textContent = 'Aucun membre sélectionné'; if(metaEl) metaEl.textContent = 'Détails affichés ici'; return; }
  let m = (members || []).find(x=>String(x.code).trim() === String(code).trim());
  // fallback: try to match by option label (in case value differs)
  if(!m){
    m = (members || []).find(x => (`${x.code} — ${x.nom}`).toLowerCase().indexOf(String(code).toLowerCase()) !== -1);
  }
  if(!m){
    // last resort: try loading from local storage directly
    const local = window.loadMembersLocal ? window.loadMembersLocal() : [];
    m = local.find(x=>String(x.code).trim() === String(code).trim()) || null;
  }
  if(!m){ console.debug('showMemberDetails: member not found', { code, members }); if(nameEl) nameEl.textContent = 'Aucun membre sélectionné'; if(metaEl) metaEl.textContent = 'Détails affichés ici'; return; }
  if(nameEl) nameEl.textContent = `${m.nom}`;
  if(metaEl) metaEl.innerHTML = `Code: <strong>${m.code}</strong><br>Tel: ${m.telephone||'—'} — Montant choisi: ${m.montant||0} FC`;
}

// init
async function initEpargne(){
  await populateMembers();
  await renderDepots();
  // set default date to today
  const depotDateInput = document.getElementById('depotDate');
  if(depotDateInput) depotDateInput.value = new Date().toISOString().slice(0,10);

  const sel = document.getElementById('memberSelect');
  if(sel) sel.addEventListener('change', function(){ showMemberDetails(this.value || this.options[this.selectedIndex].text); });

  const btn = document.getElementById('btnDepot');
  if(btn) btn.addEventListener('click', async function(){
    const memberCode = document.getElementById('memberSelect').value;
    const montant = document.getElementById('montantSel').value;
    const date = document.getElementById('depotDate').value || new Date().toISOString().slice(0,10);
    if(!memberCode){ if(window.showToast) window.showToast('Choisissez un membre', 'error'); return; }
    const members = window.loadMembersLocal ? window.loadMembersLocal() : [];
    const m = members.find(x=>x.code===memberCode);
    const dep = { id: Date.now(), memberCode: memberCode, memberName: m ? m.nom : '', montant: parseInt(montant,10), date: date, createdAt: new Date().toISOString() };
    if(window.api && typeof window.api.addDepot === 'function'){
      try{ await window.api.addDepot(dep); await renderDepots(); if(window.showToast) window.showToast('Dépôt enregistré', 'success'); return; }catch(e){ console.error('api addDepot error', e); }
    }
    const list = loadDepotsLocal(); list.push(dep); saveDepotsLocal(list); await renderDepots(); if(window.showToast) window.showToast('Dépôt enregistré', 'success');
  });

  const exportBtn = document.getElementById('exportDepot');
  if(exportBtn) exportBtn.addEventListener('click', function(){
    const rows = loadDepotsLocal();
    if(rows.length===0){ if(window.showToast) showToast('Aucun dépôt à exporter', 'info'); return; }
    const csv = ['Date,Code,Nom,Montant'];
    rows.forEach(r=> csv.push([r.date,r.memberCode,'"'+(r.memberName||'')+'"', r.montant].join(',')));
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download='depots.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  const clearBtn = document.getElementById('clearDepot');
  if(clearBtn) clearBtn.addEventListener('click', async function(){
    if(!await confirmDialog('Supprimer tous les dépôts ?')) return;
    if(window.api && typeof window.api.clearDepots === 'function'){
      try{ await window.api.clearDepots(); await renderDepots(); return; }catch(e){ console.error('api clearDepots error', e); }
    }
    saveDepotsLocal([]); await renderDepots();
  });
}

document.addEventListener('DOMContentLoaded', initEpargne); 