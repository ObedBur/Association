
// Members management with IndexedDB (fallback to localStorage)
const MEMBERS_KEY = 'membres';
const COUNTER_KEY = 'membreCounter';
const IDB_DB = 'AssociationDB';
const IDB_STORE = 'membres';
let dbPromise = null;

function useIndexedDB(){
  return 'indexedDB' in window;
}

function getDB(){
  if(dbPromise) return dbPromise;
  if(!useIndexedDB()) return Promise.resolve(null);
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(IDB_STORE)){
        db.createObjectStore(IDB_STORE, { keyPath: 'code' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

async function idbGetAll(){
  const db = await getDB();
  if(!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbAdd(member){
  const db = await getDB();
  if(!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.add(member);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(code){
  const db = await getDB();
  if(!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(code);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbClear(){
  const db = await getDB();
  if(!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function loadMembersLocal(){
  return JSON.parse(localStorage.getItem(MEMBERS_KEY) || '[]');
}

function saveMembersLocal(list){
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(list));
}

function getNextCode(){
  let n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10);
  n = n + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return 'M-' + String(n).padStart(5, '0');
}

async function ajouterMembre(){
  // basic validation
  const nomEl = document.getElementById('nom');
  const sexeEl = document.getElementById('sexe');
  const telephoneEl = document.getElementById('telephone');
  const montantEl = document.getElementById('montant');
  const errors = [];
  // clear previous errors
  document.querySelectorAll('.field-error-message').forEach(e=>e.remove());
  [nomEl, sexeEl, telephoneEl, montantEl].forEach(el=>el && el.classList && el.classList.remove('input-error'));

  const nom = nomEl.value.trim();
  if(!nom){ errors.push({el:nomEl, msg:'Le nom est requis'}); }
  const telephone = telephoneEl.value.trim();
  if(telephone && !/^\+?[0-9\s\-]{6,20}$/.test(telephone)){ errors.push({el:telephoneEl, msg:'Numéro invalide'}); }
  const montant = parseInt(montantEl.value || '0',10);
  if(!montant || isNaN(montant) || montant <= 0){ errors.push({el:montantEl, msg:'Montant invalide'}); }

  if(errors.length){
    errors.forEach(err => {
      if(err.el){ err.el.classList.add('input-error'); const msg = document.createElement('div'); msg.className='field-error-message'; msg.textContent = err.msg; err.el.parentNode.insertBefore(msg, err.el.nextSibling); }
    });
    showToast('Corrigez les champs en erreur', 'error');
    return;
  }
  const membre = {
    code: getNextCode(),
    nom: nom,
    sexe: document.getElementById('sexe').value,
    dateNaissance: document.getElementById('dateNaissance').value || null,
    lieuNaissance: document.getElementById('lieuNaissance').value || '',
    adresse: document.getElementById('adresse').value || '',
    commune: document.getElementById('commune').value || '',
    telephone: document.getElementById('telephone').value || '',
    whatsapp: document.getElementById('whatsapp').value || '',
    montant: parseInt(document.getElementById('montant').value || '0',10),
    dateAdhesion: document.getElementById('dateAdhesion').value || '',
    profession: document.getElementById('profession').value || '',
    observations: document.getElementById('observations') ? document.getElementById('observations').value : '',
    createdAt: new Date().toISOString()
  };

  try{
    // try API first
    if(window.api && typeof window.api.addMember === 'function'){
      await window.api.addMember(membre);
    } else if(useIndexedDB()){
      await idbAdd(membre);
    } else {
      const list = loadMembersLocal();
      list.push(membre);
      saveMembersLocal(list);
    }
    await renderMembersTable();
    showToast('Membre ajouté avec succès', 'success');
    if(window.closeAddModal) window.closeAddModal();
    Array.from(document.querySelectorAll('#addModal input,#addModal textarea')).forEach(i=>i.value='');
    updateMemberCount();
    try{ if(window.notifyEvent) window.notifyEvent('member_added', { name: membre.nom, code: membre.code, ts: Date.now() }); }catch(e){}
  }catch(err){
    console.error('Erreur en sauvegardant le membre', err);
    showToast('Impossible de sauvegarder le membre', 'error');
  }
}

async function deleteMember(code){
  const ok = await confirmDialog('Supprimer le membre ' + code + ' ?');
  if(!ok) return;
  try{
    if(useIndexedDB()){
      await idbDelete(code);
    } else {
      let list = loadMembersLocal();
      list = list.filter(m => m.code !== code);
      saveMembersLocal(list);
    }
    renderMembersTable();
    showToast('Membre supprimé', 'info');
    updateMemberCount();
    try{ if(window.notifyEvent) window.notifyEvent('member_deleted', { code: code, ts: Date.now() }); }catch(e){}
  }catch(err){
    console.error('Erreur en supprimant', err);
    showToast('Impossible de supprimer', 'error');
  }
}

async function renderMembersTable(){
  const container = document.getElementById('membersContainer');
  let list = [];
  try{
    if(window.api && typeof window.api.getMembers === 'function'){
      try{ list = await window.api.getMembers(); }catch(e){ /* fallback below */ }
    }
    if(!list || !list.length){
      if(useIndexedDB()){
        list = await idbGetAll();
      } else {
        list = loadMembersLocal();
      }
    }
  }catch(err){
    console.error('Erreur en chargeant les membres', err);
    list = loadMembersLocal();
  }

  if(!container) return;
  if(list.length === 0){ container.innerHTML = '<p>Aucun membre enregistré.</p>'; return; }

  const table = document.createElement('table');
  table.innerHTML = `
    <thead><tr><th>Code</th><th>Nom</th><th>Sexe</th><th>Téléphone</th><th>Montant</th><th>Adhésion</th><th>Actions</th></tr></thead>
  `;
  const tbody = document.createElement('tbody');
  list.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="badge-code">${m.code}</span></td>
      <td>${m.nom}</td>
      <td>${m.sexe||''}</td>
      <td>${m.telephone||''}</td>
      <td>${m.montant||0} FC</td>
      <td>${m.dateAdhesion || ''}</td>
      <td>
        <button onclick="deleteMember('${m.code}')">Supprimer</button>
      </td>`;
    tbody.appendChild(tr);
  });
  container.innerHTML = '';
  table.appendChild(tbody);
  container.appendChild(table);
}

// helper to clear all members (UI can call this)
async function clearAllMembers(){
  if(!confirm('Supprimer tous les membres ? Cette action est irréversible.')) return;
  try{
    if(window.api && typeof window.api.getMembers === 'function'){
      // json-server doesn't provide bulk delete; fallback to clearing local and idb
    }
    if(useIndexedDB()){
      await idbClear();
    }
    localStorage.removeItem(MEMBERS_KEY);
    localStorage.removeItem(COUNTER_KEY);
    await renderMembersTable();
    showToast('Tous les membres ont été supprimés', 'info');
    updateMemberCount();
    try{ if(window.notifyEvent) window.notifyEvent('members_cleared', { ts: Date.now() }); }catch(e){}
  }catch(err){
    console.error('Erreur en nettoyant les membres', err);
    showToast('Impossible de nettoyer les membres', 'error');
  }
}

// Simple toast notifications
function showToast(message, type){
  let container = document.getElementById('toastContainer');
  if(!container){
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (type || 'info');
  t.textContent = message;
  container.appendChild(t);
  setTimeout(()=>{ t.classList.add('hide'); t.addEventListener('transitionend', ()=> t.remove()); }, 2500);
}

// init
document.addEventListener('DOMContentLoaded', function(){ renderMembersTable(); });

// update the counter in the toolbar
async function updateMemberCount(){
  let list = [];
  try{
    if(window.api && typeof window.api.getMembers === 'function'){
      try{ list = await window.api.getMembers(); }catch(e){ /* fallback */ }
    }
    if(!list || !list.length){ list = useIndexedDB() ? await idbGetAll() : loadMembersLocal(); }
  }catch(e){ list = loadMembersLocal(); }
  const el = document.getElementById('memberCount');
  if(el) el.textContent = String((list && list.length) || 0);
}

// expose helper to open modal
function openAddModal(){ if(window.openAddModal) window.openAddModal(); }

// refresh count after render
const originalRender = renderMembersTable;
renderMembersTable = async function(){ await originalRender(); updateMemberCount(); };
  