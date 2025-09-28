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
  // Preload members into cache for client-side search fallback
  let members = await loadMembers();
  if(!members || members.length === 0){
    members = window.loadMembersLocal ? window.loadMembersLocal() : [];
  }
  const normalized = (members||[]).map(m => ({ code: m.code || m.id || m.email || '', nom: m.nom || m.name || m.fullName || '', raw: m }));
  window._membersCache = normalized.map(n => Object.assign({}, n.raw, { code: n.code, nom: n.nom }));
}

// Search helper: try API, then IDB, then in-memory cache. Returns array of normalized {code,nom}
async function searchMembers(query, limit = 50, offset = 0){
  const q = String(query||'').trim().toLowerCase();
  if(window.api && typeof window.api.searchMembers === 'function'){
    try{ const res = await window.api.searchMembers(q, limit, offset); return (res||[]).map(m=>({ code: m.code||m.id||'', nom: m.nom||m.name||'' })); }catch(e){}
  }
  if(window.useIndexedDB){ try{ const all = await window.idbGetAll(); const filtered = (all||[]).filter(m => (m.code||m.nom||m.name||'').toString().toLowerCase().indexOf(q) !== -1); return filtered.slice(offset, offset+limit).map(m=>({ code: m.code||'', nom: m.nom||m.name||'' })); }catch(e){}
  }
  // fallback to in-memory cache
  const cache = window._membersCache || [];
  const filtered = (cache||[]).filter(m => (`${m.code} ${m.nom}`).toLowerCase().indexOf(q) !== -1);
  return filtered.slice(offset, offset+limit).map(m=>({ code: m.code, nom: m.nom }));
}

// Debounce utility
function debounce(fn, wait){ let t = null; return function(...args){ clearTimeout(t); t = setTimeout(()=> fn.apply(this, args), wait); }; }

// Render limited list into container
function renderMemberList(items, container){ container.innerHTML = ''; if(!items || items.length===0){ container.innerHTML = '<div class="muted-small" style="padding:8px">Aucun résultat</div>'; return; } items.forEach((it, idx) => { const d = document.createElement('div'); d.className = 'member-item'; d.setAttribute('role','option'); d.setAttribute('data-code', it.code); d.style.padding = '8px'; d.style.borderBottom = '1px solid #f1f5f9'; d.style.cursor = 'pointer'; d.textContent = `${it.code} — ${it.nom}`; d.addEventListener('click', ()=> { selectMemberFromList(it.code, it.nom); }); container.appendChild(d); }); }

function selectMemberFromList(code, name){ const hidden = document.getElementById('memberSelectedCode'); const search = document.getElementById('memberSearch'); const list = document.getElementById('memberList'); if(hidden) hidden.value = code; if(search) search.value = `${code} — ${name}`; if(list){ list.classList.add('hidden'); list.setAttribute('aria-expanded','false'); } const nameEl = document.getElementById('memberName'); const metaEl = document.getElementById('memberMeta'); if(nameEl) nameEl.textContent = name || code; if(metaEl) metaEl.textContent = `Code: ${code}`; }

// Setup search input handlers
function setupMemberSearch(){
  const input = document.getElementById('memberSearch');
  const list = document.getElementById('memberList');
  if(!input || !list) return;
  let offset = 0; let loadingMore = false;
  const loadAndRender = async (q, reset=true) => {
    if(reset){ offset = 0; }
    const items = await searchMembers(q, 50, offset);
    if(reset) renderMemberList(items, list); else { items.forEach(it => { const d = document.createElement('div'); d.className='member-item'; d.setAttribute('role','option'); d.setAttribute('data-code', it.code); d.style.padding='8px'; d.style.borderBottom='1px solid #f1f5f9'; d.style.cursor='pointer'; d.textContent = `${it.code} — ${it.nom}`; d.addEventListener('click', ()=> selectMemberFromList(it.code, it.nom)); list.appendChild(d); }); }
    list.classList.toggle('hidden', !items || items.length===0);
    list.setAttribute('aria-expanded', list.classList.contains('hidden') ? 'false' : 'true');
    loadingMore = false;
    if(items.length === 50) offset += 50;
  };

  const debounced = debounce(async function(e){ const q = this.value; if(!q){ list.classList.add('hidden'); list.setAttribute('aria-expanded','false'); return; } await loadAndRender(q, true); }, 180);
  input.addEventListener('input', debounced);

  // keyboard navigation
  let focusedIdx = -1;
  input.addEventListener('keydown', function(e){ const visible = Array.from(list.querySelectorAll('.member-item')); if(e.key === 'ArrowDown'){ focusedIdx = Math.min(focusedIdx + 1, visible.length - 1); visible.forEach((el,i)=> el.style.background = i===focusedIdx ? '#f1f5ff' : ''); visible[focusedIdx] && visible[focusedIdx].scrollIntoView({ block:'nearest' }); e.preventDefault(); }
    else if(e.key === 'ArrowUp'){ focusedIdx = Math.max(focusedIdx - 1, 0); visible.forEach((el,i)=> el.style.background = i===focusedIdx ? '#f1f5ff' : ''); visible[focusedIdx] && visible[focusedIdx].scrollIntoView({ block:'nearest' }); e.preventDefault(); }
    else if(e.key === 'Enter'){ if(focusedIdx >=0){ const el = visible[focusedIdx]; selectMemberFromList(el.getAttribute('data-code'), el.textContent.split(' — ').slice(1).join(' — ')); } e.preventDefault(); }
    else if(e.key === 'Escape'){ list.classList.add('hidden'); list.setAttribute('aria-expanded','false'); }
  });

  // infinite scroll inside list
  list.addEventListener('scroll', async function(){ if(loadingMore) return; if(this.scrollTop + this.clientHeight >= this.scrollHeight - 40){ loadingMore = true; const q = input.value; await loadAndRender(q, false); } });
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
  // attach member search handlers (new searchable dropdown)
  setupMemberSearch();
  // set default date to today
  const depotDateInput = document.getElementById('depotDate');
  if(depotDateInput) depotDateInput.value = new Date().toISOString().slice(0,10);

  const sel = document.getElementById('memberSelect');
  const searchInput = document.getElementById('memberSearch');
  // when using new search input, update details from the hidden selected code
  if(searchInput) searchInput.addEventListener('change', function(){ const code = document.getElementById('memberSelectedCode').value; if(code) showMemberDetails(code); });
  if(sel) sel.addEventListener('change', function(){ showMemberDetails(this.value || this.options[this.selectedIndex].text); });

  const btn = document.getElementById('btnDepot');
  if(btn) btn.addEventListener('click', async function(){
    const hidden = document.getElementById('memberSelectedCode');
    const selEl = document.getElementById('memberSelect');
    const memberCode = (hidden && hidden.value) ? hidden.value : (selEl ? selEl.value : '');
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
    try{ if(window.notifyEvent) window.notifyEvent('depot', { memberCode: memberCode, memberName: m ? m.nom : '', montant: parseInt(montant,10), date: date, ts: Date.now() }); }catch(e){}
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
    try{ if(window.notifyEvent) window.notifyEvent('depots_cleared', { ts: Date.now() }); }catch(e){}
  });
}

document.addEventListener('DOMContentLoaded', initEpargne); 