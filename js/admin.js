// Admin page script (moved from Html/admin.html)
// Uses existing helpers in /js/membre.js when present; falls back to localStorage

const adminState = { members: [], ops: [] };

function loadDepots(){ try{ return JSON.parse(localStorage.getItem('depots') || '[]'); }catch(e){ return []; } }
function saveDepots(list){ localStorage.setItem('depots', JSON.stringify(list)); }
// retraits feature removed — no-op placeholders removed

async function loadAllAdmin(){
  let members = [];
  try{
    if(window.api && typeof window.api.getMembers === 'function'){
      try{ members = await window.api.getMembers(); }catch(e){ /* fallback below */ }
    }
    if(!members || members.length === 0){
      members = (window.useIndexedDB && await window.useIndexedDB()) ? await window.idbGetAll() : window.loadMembersLocal();
    }
  }catch(e){ members = window.loadMembersLocal ? window.loadMembersLocal() : []; }
  let depots = [];
  let payouts = [];
  try{
    if(window.api && typeof window.api.getDepots === 'function'){
      try{ depots = await window.api.getDepots(); }catch(e){ depots = loadDepots(); }
    } else { depots = loadDepots(); }
    // retraits removed from admin workflow
    // payouts (paiements) stored locally
    try{ payouts = typeof loadPayouts === 'function' ? loadPayouts() : JSON.parse(localStorage.getItem('payouts')||'[]'); }catch(e){ payouts = []; }
  }catch(e){ depots = loadDepots(); retraits = loadRetraits(); }

  const balanceMap = {};
  members.forEach(m => { balanceMap[m.code] = 0; });
  depots.forEach(d => { if(d.memberCode) balanceMap[d.memberCode] = (balanceMap[d.memberCode]||0) + (parseFloat(d.montant)||0); });

  const ops = [];
  depots.forEach(d => ops.push({ id: d.id || d.createdAt || Date.now(), memberId: d.memberCode, type: 'epargne', amount: Number(d.montant||0), time: new Date(d.createdAt || d.date || Date.now()).getTime() }));
  // retraits no longer produced here
  // include payouts as separate op type
  (payouts||[]).forEach(p => ops.push({ id: p.id || Date.now(), memberId: p.code, type: 'payout', amount: Number(p.amount||0), time: new Date(p.date || p.createdAt || Date.now()).getTime() }));

  ops.sort((a,b)=>a.time - b.time);
  const running = {};
  ops.forEach(op => {
    running[op.memberId] = running[op.memberId] || 0;
    if(op.type === 'epargne') running[op.memberId] += op.amount; else running[op.memberId] -= op.amount;
    op.afterBalance = running[op.memberId];
  });

  adminState.members = (members||[]).map(m=> ({ id: m.code, name: m.nom, phone: m.telephone || '', balance: balanceMap[m.code] || 0 }));
  adminState.ops = ops;
}

function formatNumberAdmin(n){ return Number(n||0).toLocaleString('fr-FR'); }

function renderMembersAdmin(){
  const membersTable = document.getElementById('membersTable');
  if(!membersTable) return;
  membersTable.innerHTML = '';
  adminState.members.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="display:flex;align-items:center;gap:10px"><div class="avatar">${(m.name||'').split(' ').map(s=>s[0]||'').slice(0,2).join('')}</div><div><strong style="color:#fff">${m.name}</strong><div class="muted">${m.id}</div></div></td>
      <td>${m.phone||'—'}</td>
      <td><strong>${formatNumberAdmin(m.balance)} FC</strong></td>
      <td><button class="btn btn-ghost" data-id="${m.id}" onclick="openQuickOp('${m.id}')">Opérations</button></td>
    `;
    tr.ondblclick = ()=> window.editMember ? window.editMember(m.id) : null;
    membersTable.appendChild(tr);
  });
  const totalMembers = document.getElementById('totalMembers'); if(totalMembers) totalMembers.textContent = adminState.members.length;
  const avgBalance = document.getElementById('avgBalance'); const avg = adminState.members.length ? Math.round(adminState.members.reduce((a,b)=>a+(b.balance||0),0)/adminState.members.length) : 0; if(avgBalance) avgBalance.textContent = formatNumberAdmin(avg) + ' FC';
}

function renderStatsAdmin(){
  const totalSavings = document.getElementById('totalSavings');
  const totalWithdrawals = document.getElementById('totalWithdrawals');
  const totalSave = adminState.ops.filter(o=>o.type==='epargne').reduce((a,b)=>a+b.amount,0);
  const totalWith = adminState.ops.filter(o=>o.type==='retrait').reduce((a,b)=>a+b.amount,0);
  const totalPay = adminState.ops.filter(o=>o.type==='payout').reduce((a,b)=>a+b.amount,0);
  if(totalSavings) totalSavings.textContent = formatNumberAdmin(totalSave) + ' FC';
  if(totalWithdrawals) totalWithdrawals.textContent = formatNumberAdmin(totalWith) + ' FC';
  const totalPayments = document.getElementById('totalPayments'); if(totalPayments) totalPayments.textContent = formatNumberAdmin(totalPay) + ' FC';
}

function renderOpsAdmin(){
  const historyTable = document.getElementById('historyTable'); if(!historyTable) return; historyTable.innerHTML = '';
  const recent = [...adminState.ops].sort((a,b)=>b.time - a.time);
  recent.forEach(op => {
    const m = adminState.members.find(x=>x.id===op.memberId) || { name: '(supprimé)' };
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${new Date(op.time).toLocaleString()}</td><td>${m.name}</td><td>${op.type}</td><td>${formatNumberAdmin(op.amount)} FC</td><td>${formatNumberAdmin(op.afterBalance||0)} FC</td>`;
    historyTable.appendChild(tr);
  });
}

function populateMemberSelectAdmin(){ const opMember = document.getElementById('opMember'); if(!opMember) return; opMember.innerHTML = ''; adminState.members.forEach(m=>{ const opt = document.createElement('option'); opt.value = m.id; opt.textContent = `${m.name} — ${m.id}`; opMember.appendChild(opt); }); }

function initTabsAdmin(){
  const navButtons = document.querySelectorAll('.nav button[data-tab]');
  if(!navButtons || navButtons.length===0) return;
  function showTab(tab){
    navButtons.forEach(b=> b.classList.toggle('active', b.dataset.tab===tab));
    document.querySelectorAll('.panel').forEach(p=> p.style.display = 'none');
    if(tab === 'members'){
      const mp = document.getElementById('membersPanel'); if(mp) mp.style.display = 'block';
      const frm = document.getElementById('forms'); if(frm && frm.parentElement) frm.parentElement.style.display = 'block';
      const hp = document.getElementById('historyPanel'); if(hp) hp.style.display = 'block';
    } else {
      const panelId = tab + 'Panel'; const panel = document.getElementById(panelId);
      if(panel){ panel.style.display = 'block'; }
      else {
        const pageMap = { epargne: './epargne.html', retraits: './retrait.html', rapports: './rapport.html' };
        const url = pageMap[tab]; if(url) window.location.href = url;
      }
    }
  }
  navButtons.forEach(b=> b.addEventListener('click', ()=> showTab(b.dataset.tab)));
  const initial = document.querySelector('.nav button.active') ? document.querySelector('.nav button.active').dataset.tab : 'members';
  showTab(initial);
}

function bindAdminActions(){
  const exportBtn = document.getElementById('exportBtn'); if(exportBtn) exportBtn.addEventListener('click', ()=>{ let csv = 'id,nom,telephone,solde\n'; adminState.members.forEach(m=> csv += `${m.id},"${m.name}",${m.phone||''},${m.balance||0}\n`); const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'membres.csv'; a.click(); URL.revokeObjectURL(url); });

  // Clear all stored data (uses confirmDialog)
  const clearBtn = document.getElementById('clearAllData');
  if(clearBtn) clearBtn.addEventListener('click', async ()=>{
    if(typeof confirmDialog === 'function'){
      if(!await confirmDialog('Supprimer toutes les données (membres, dépôts, retraits, comptes) ? Cette action est irréversible.')) return;
    } else {
      if(!confirm('Supprimer toutes les données (membres, dépôts, retraits, comptes) ? Cette action est irréversible.')) return;
    }
    try{
      // If API available, attempt to delete server-side records
      if(window.api){
        try{
          // members
          if(typeof window.api.getMembers === 'function'){
            const ms = await window.api.getMembers();
            if(Array.isArray(ms)){
              for(const item of ms){
                if(item && (item.id || item.code)){
                  const id = item.id || item.code;
                  try{ await fetch((typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:3000') + '/members/' + id, { method: 'DELETE' }); }catch(e){}
                }
              }
            }
          }
          // depots
          if(typeof window.api.getDepots === 'function'){
            const ds = await window.api.getDepots(); if(Array.isArray(ds)){ for(const d of ds){ try{ await fetch((typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:3000') + '/depots/' + (d.id || d._id || ''), { method:'DELETE' }); }catch(e){} } }
          }
          // retraits
          if(typeof window.api.getRetraits === 'function'){
            const rs = await window.api.getRetraits(); if(Array.isArray(rs)){ for(const r of rs){ try{ await fetch((typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:3000') + '/retraits/' + (r.id || r._id || ''), { method:'DELETE' }); }catch(e){} } }
          }
        }catch(e){ console.warn('API deletion attempts failed', e); }
      }

      // Clear IndexedDB if present (try to clear all known stores, then delete DB)
      if(window.useIndexedDB && await window.useIndexedDB()){
        try{
          if(window.idbClear) {
            await window.idbClear();
          } else if(window.getDB){
            const db = await window.getDB();
            if(db){
              try{
                const stores = Array.from(db.objectStoreNames || []);
                for(const s of stores){ try{ const tx = db.transaction(s,'readwrite'); tx.objectStore(s).clear(); }catch(e){} }
              }catch(e){}
            }
          }
          // attempt to remove the entire IDB database if present
          try{ if(typeof indexedDB !== 'undefined'){ const delReq = indexedDB.deleteDatabase(typeof IDB_DB !== 'undefined' ? IDB_DB : 'AssociationDB'); delReq.onsuccess = function(){ /* deleted */ }; delReq.onerror = function(){ /* ignore */ }; } }catch(e){}
        }catch(e){ console.warn('indexeddb clear failed', e); }
      }

      // Clear localStorage keys (members, depots, payouts, notifications, counters, users and auth)
      localStorage.removeItem('membres');
      localStorage.removeItem('depots');
      localStorage.removeItem('payouts');
      localStorage.removeItem('notifications');
      localStorage.removeItem('notif_cursor');
      localStorage.removeItem('membreCounter');
      localStorage.removeItem('users');
      localStorage.removeItem('authToken');

      await refreshAdmin();
      if(typeof showToast === 'function') showToast('Toutes les données ont été supprimées', 'success');
      else console.log('Données supprimées');
    }catch(err){ console.error('Erreur nettoyage', err); if(typeof showToast === 'function') showToast('Erreur lors du nettoyage des données', 'error'); else console.error('Erreur lors du nettoyage des données'); }
  });

  const addMemberBtn = document.getElementById('addMemberBtn'); if(addMemberBtn) addMemberBtn.addEventListener('click', async ()=>{
    // require admin credentials before allowing member creation
    if(typeof requireCredentials === 'function'){
      const ok = await requireCredentials(); if(!ok){ if(typeof showToast === 'function') showToast('Authentification requise', 'error'); return; }
    }
    if(typeof ajouterMembre === 'function'){ try{ await ajouterMembre(); await refreshAdmin(); }catch(e){ console.error(e); if(typeof showToast === 'function') showToast('Erreur création membre', 'error'); } return; }
    const nameEl = document.getElementById('memberName'); const phoneEl = document.getElementById('memberPhone'); const idEl = document.getElementById('memberId');
    const name = nameEl ? nameEl.value.trim() : '';
    if(!name){ if(typeof showToast === 'function') showToast('Nom requis', 'error'); else console.warn('Nom requis'); return; }
    const m = { code: idEl?.value.trim() || String(Date.now()), nom: name, telephone: phoneEl?.value.trim() || '', createdAt: new Date().toISOString() };
    try{
      if(window.api && typeof window.api.addMember === 'function'){
        await window.api.addMember(m);
      } else if(window.useIndexedDB && await window.useIndexedDB()){ const db = await window.getDB(); if(db){ const tx = db.transaction('membres','readwrite'); const store = tx.objectStore('membres'); store.put(m); } }
      else { const list = window.loadMembersLocal ? window.loadMembersLocal() : []; list.push(m); window.saveMembersLocal ? window.saveMembersLocal(list) : localStorage.setItem('membres', JSON.stringify(list)); }
      await refreshAdmin(); if(nameEl) nameEl.value=''; if(phoneEl) phoneEl.value=''; if(idEl) idEl.value='';
      if(typeof showToast === 'function') showToast('Membre ajouté', 'success');
    }catch(err){ console.error(err); if(typeof showToast === 'function') showToast('Erreur création membre', 'error'); else console.error('Erreur création membre'); }
  });

  // Import local -> server
  const importBtn = document.getElementById('importLocalBtn');
  if(importBtn) importBtn.addEventListener('click', async ()=>{
    if(!confirm('Importer les données locales vers le serveur API ?')) return;
    try{
      // members
      const localMembers = window.loadMembersLocal ? window.loadMembersLocal() : JSON.parse(localStorage.getItem('membres')||'[]');
      for(const m of (localMembers||[])){
        const payload = { code: m.code || m.id || ('M-'+Date.now()), nom: m.nom || m.name || m.fullName || '', telephone: m.telephone||m.phone||'' };
        try{ if(window.api && typeof window.api.addMember === 'function'){ await window.api.addMember(payload); } else { await fetch('http://localhost:3000/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); } }catch(e){ console.error('member import failed', e); }
      }
      // depots
      const localDepots = JSON.parse(localStorage.getItem('depots')||'[]');
      for(const d of (localDepots||[])){
        try{ if(window.api && typeof window.api.addDepot === 'function'){ await window.api.addDepot(d); } else { await fetch('http://localhost:3000/depots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); } }catch(e){ console.error('depot import failed', e); }
      }
      // retraits
      const localRetraits = JSON.parse(localStorage.getItem('retraits')||'[]');
      for(const r of (localRetraits||[])){
        try{ if(window.api && typeof window.api.addRetrait === 'function'){ await window.api.addRetrait(r); } else { await fetch('http://localhost:3000/retraits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)}); } }catch(e){ console.error('retrait import failed', e); }
      }
      if(typeof showToast === 'function') showToast('Import local → serveur terminé', 'success');
      await refreshAdmin();
    }catch(err){ console.error('importLocal error', err); if(typeof showToast === 'function') showToast('Import échoué', 'error'); }
  });

  const doOp = document.getElementById('doOp'); if(doOp) doOp.addEventListener('click', async ()=>{
    const type = document.getElementById('opType').value;
    const memberId = document.getElementById('opMember').value;
    const amount = Number(document.getElementById('opAmount').value);
    if(!memberId){ if(typeof showToast === 'function') showToast('Sélectionner un membre', 'error'); else console.warn('Sélectionner un membre'); return; }
    if(!amount || amount <= 0){ if(typeof showToast === 'function') showToast('Montant invalide', 'error'); else console.warn('Montant invalide'); return; }
    const m = adminState.members.find(x=>x.id===memberId); if(!m){ if(typeof showToast === 'function') showToast('Membre introuvable', 'error'); else console.warn('Membre introuvable'); return; }
    if(type==='retrait' && amount > (m.balance||0)){ if(typeof showToast === 'function') showToast('Solde insuffisant', 'error'); else console.warn('Solde insuffisant'); return; }
    if(type === 'epargne'){
      const dep = { id: Date.now(), memberCode: memberId, memberName: m.name, montant: amount, date: new Date().toISOString().slice(0,10), createdAt: new Date().toISOString() };
      if(window.api && typeof window.api.addDepot === 'function'){
        try{ await window.api.addDepot(dep); }catch(e){ const list = loadDepots(); list.push(dep); saveDepots(list); }
      } else { const list = loadDepots(); list.push(dep); saveDepots(list); }
    } else {
      const r = { id: Date.now(), memberCode: memberId, memberName: m.name, montant: amount, date: new Date().toISOString().slice(0,10), createdAt: new Date().toISOString() };
      if(window.api && typeof window.api.addRetrait === 'function'){
        try{ await window.api.addRetrait(r); }catch(e){ const list = loadRetraits(); list.push(r); saveRetraits(list); }
      } else { const list = loadRetraits(); list.push(r); saveRetraits(list); }
    }
    await refreshAdmin(); const amtEl = document.getElementById('opAmount'); if(amtEl) amtEl.value=''; if(typeof showToast === 'function') showToast('Opération enregistrée', 'success');
  });

  const q = document.getElementById('q'); if(q) q.addEventListener('input', function(){ const v = this.value.trim().toLowerCase(); if(!v){ renderMembersAdmin(); return; } const rows = adminState.members.filter(m=> (m.name+m.id+(m.phone||'')).toLowerCase().includes(v)); const membersTable = document.getElementById('membersTable'); if(!membersTable) return; membersTable.innerHTML=''; rows.forEach(m=>{ const tr = document.createElement('tr'); tr.innerHTML = `<td style="display:flex;align-items:center;gap:10px"><div class="avatar">${(m.name||'').split(' ').map(s=>s[0]||'').slice(0,2).join('')}</div><div><strong style="color:#fff">${m.name}</strong><div class="muted">${m.id}</div></div></td><td>${m.phone||'—'}</td><td><strong>${formatNumberAdmin(m.balance||0)} FC</strong></td><td><button class="btn btn-ghost" data-id="${m.id}" onclick="openQuickOp('${m.id}')">Opérations</button></td>`; membersTable.appendChild(tr); }); });
}

async function refreshAdmin(){ await loadAllAdmin(); renderMembersAdmin(); renderStatsAdmin(); renderOpsAdmin(); populateMemberSelectAdmin(); if(window.updateMemberCount) window.updateMemberCount();
  // show logged-in user in sidebar
  try{
    if(window.auth && typeof window.auth.getCurrentUserEmail === 'function'){
      const email = window.auth.getCurrentUserEmail(); const el = document.getElementById('authUser'); if(el) el.textContent = email || '—';
    } else if(window.auth && typeof window.auth.getUsers === 'function'){
      const email = localStorage.getItem('authToken'); const el = document.getElementById('authUser'); if(el) el.textContent = email || '—';
    }
    // add logout control (always create/replace button)
    const authUserEl = document.getElementById('authUser');
    if(authUserEl){
      const existingLogout = document.getElementById('authLogoutBtn');
      if(existingLogout) existingLogout.remove();
      const logout = document.createElement('button');
      logout.id = 'authLogoutBtn';
      logout.textContent = 'Déconnexion';
      logout.className = 'btn-ghost';
      logout.style.marginLeft = '8px';
      logout.addEventListener('click', ()=>{
        if(window.auth && typeof window.auth.clearToken === 'function') window.auth.clearToken();
        // immediate redirect to home after logout
        window.location.href = '/index.html';
      });
      authUserEl.parentNode.appendChild(logout);
    }
  }catch(e){ console.error('show auth user', e); }
}

// expose open/edit
window.openQuickOp = function(id){ const t = document.getElementById('opType'); if(t) t.value='epargne'; const sel = document.getElementById('opMember'); if(sel) sel.value=id; const amt = document.getElementById('opAmount'); if(amt) amt.focus(); };
window.editMember = async function(id){
  const membersRaw = (window.useIndexedDB && await window.useIndexedDB()) ? await window.idbGetAll() : window.loadMembersLocal();
  const m = (membersRaw||[]).find(x=>x.code===id);
  if(!m){ if(typeof showToast === 'function') showToast('Membre introuvable', 'error'); else console.warn('Membre introuvable'); return; }
  const newName = prompt('Modifier le nom', m.nom); if(newName===null) return; m.nom = newName.trim() || m.nom;
  const newPhone = prompt('Modifier le téléphone', m.telephone); if(newPhone!==null) m.telephone = newPhone.trim();
  try{
    if(window.api && typeof window.api.putMember === 'function'){
      await window.api.putMember(m.code, { name: m.nom, phone: m.telephone });
    } else if(window.useIndexedDB && await window.useIndexedDB()){
      const db = await window.getDB(); if(db){ const tx = db.transaction('membres','readwrite'); const store = tx.objectStore('membres'); store.put(m); }
    } else { const list = window.loadMembersLocal(); const idx = list.findIndex(x=>x.code===m.code); if(idx>=0){ list[idx]=m; window.saveMembersLocal ? window.saveMembersLocal(list) : localStorage.setItem('membres', JSON.stringify(list)); } }
    await refreshAdmin(); if(typeof showToast === 'function') showToast('Modification enregistrée', 'success');
  }catch(err){ console.error(err); if(typeof showToast === 'function') showToast('Erreur sauvegarde', 'error'); else console.error('Erreur sauvegarde'); }
};

// init
// mobile sidebar toggle (header hamburger)
document.addEventListener('DOMContentLoaded', function(){
  try{
    const navBtn = document.getElementById('navToggleAdmin');
    const sidebar = document.querySelector('.sidebar');
    if(navBtn && sidebar){
      navBtn.addEventListener('click', function(e){ sidebar.classList.toggle('show'); e.stopPropagation(); });
      document.addEventListener('click', function(e){ if(sidebar.classList.contains('show') && !sidebar.contains(e.target) && e.target !== navBtn) sidebar.classList.remove('show'); });
    }
  }catch(err){ console.error('nav toggle init', err); }
});

(async ()=>{ try{ initTabsAdmin(); bindAdminActions(); await refreshAdmin(); }catch(e){ console.error('admin init error', e); } })(); 