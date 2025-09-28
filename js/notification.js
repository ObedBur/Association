// notification.js
// Simple notification center that watches localStorage / API / IndexedDB for
// member/depot/retrait/payout events and renders a chronological list.
// It also exposes window.notifyEvent(type, payload) for other scripts to push events.

async function tryGetMembers(){
  try{ if(window.api && typeof window.api.getMembers === 'function') return await window.api.getMembers(); }catch(e){}
  try{ if(window.useIndexedDB && window.idbGetAll) return await window.idbGetAll(); }catch(e){}
  try{ return JSON.parse(localStorage.getItem('membres') || '[]'); }catch(e){ return []; }
}

async function tryGetDepots(){
  try{ if(window.api && typeof window.api.getDepots === 'function') return await window.api.getDepots(); }catch(e){}
  try{ return JSON.parse(localStorage.getItem('depots') || '[]'); }catch(e){ return []; }
}

async function tryGetRetraits(){
  // retraits feature removed — return empty list
  return [];
}

function loadPayoutsLocal(){ try{ return JSON.parse(localStorage.getItem('payouts')||'[]'); }catch(e){ return []; } }

function parseTs(v){ if(!v) return 0; const t = Date.parse(v); if(isNaN(t)) return Number(v) || 0; return t; }

function getItemUid(item, prefix){
  if(!item) return prefix + '-' + String(Date.now());
  if(item.id) return String(item.id);
  if(item.code) return String(item.code);
  if(item.memberCode) return String((item.memberCode || '') + '::' + (item.date||item.createdAt||''));
  try{ return prefix + '-' + btoa(unescape(encodeURIComponent(JSON.stringify(item)))).slice(0,12); }catch(e){ return prefix + '-' + String(Math.random()).slice(2,10); }
}

function getCursor(){ try{ return JSON.parse(localStorage.getItem('notif_cursor')||'{}'); }catch(e){ return {}; } }
function setCursor(c){ try{ localStorage.setItem('notif_cursor', JSON.stringify(c)); }catch(e){} }

function loadNotificationsStore(){ try{ return JSON.parse(localStorage.getItem('notifications')||'[]'); }catch(e){ return []; } }
function saveNotificationsStore(list){ try{ localStorage.setItem('notifications', JSON.stringify(list)); }catch(e){} }

function pushNotification(obj){ const list = loadNotificationsStore(); list.push(obj); // keep max 500
  if(list.length > 500) list.splice(0, list.length - 500);
  saveNotificationsStore(list);
  renderNotifications();
}

function formatDateShort(ts){ try{ const d = new Date(ts); return d.toLocaleString(); }catch(e){ return String(ts); } }

function renderNotifications(){
  const list = loadNotificationsStore().slice().reverse();
  const container = document.getElementById('notifications-list');
  const none = document.getElementById('no-notif');
  if(!container) return;
  container.innerHTML = '';
  if(!list || list.length === 0){ if(none) none.style.display = ''; return; }
  if(none) none.style.display = 'none';
  list.forEach(n => {
    const card = document.createElement('div'); card.className = 'notification'; card.style.border = '1px solid #e0e0e0'; card.style.padding = '12px'; card.style.marginBottom = '10px'; card.style.borderRadius = '8px'; card.style.background = '#fff';
    const title = document.createElement('div'); title.style.fontWeight = '600'; title.style.marginBottom = '6px'; title.textContent = n.title || n.msg || '(Notification)';
    const meta = document.createElement('div'); meta.style.fontSize='13px'; meta.style.color='#888'; meta.textContent = n.ts ? formatDateShort(n.ts) : '';
    const body = document.createElement('div'); body.style.marginTop='6px'; body.textContent = n.detail || '';
    card.appendChild(title); if(n.detail) card.appendChild(body); card.appendChild(meta);
    container.appendChild(card);
  });
}

// scan known stores and generate notifications for new items since last cursor
async function scanStores(){
  const cursor = getCursor();
  // ensure id sets
  cursor._ids = cursor._ids || {};
  // members (detect adds/removes by id and by timestamp)
  try{
    const members = await tryGetMembers();
    const lastMemTs = parseTs(cursor.members);
    let maxMem = lastMemTs;
    // build current id list (prefer code/id)
    const currentIds = (members||[]).map(m => (m.code || m.id || getItemUid(m,'mem'))).filter(Boolean);
    cursor._ids.members = cursor._ids.members || [];
    // on first run, initialize seen ids without emitting
    if(!Array.isArray(cursor._ids.members) || cursor._ids.members.length === 0){ cursor._ids.members = currentIds.slice(); }
    else {
      // added
      const added = currentIds.filter(id => cursor._ids.members.indexOf(id) === -1);
      added.forEach(id => {
        const m = (members||[]).find(x => (x.code === id || x.id === id || getItemUid(x,'mem') === id));
        pushNotification({ id: 'mem-added-'+id, type: 'member_added', title: 'Nouveau membre: ' + (m && (m.nom || m.name) || id), detail: `Code: ${m && (m.code || m.id) || id}`, ts: Date.now() });
      });
      // removed
      const removed = (cursor._ids.members||[]).filter(id => currentIds.indexOf(id) === -1);
      removed.forEach(id => { pushNotification({ id: 'mem-removed-'+id, type:'member_deleted', title: 'Membre supprimé: ' + id, detail: `Code: ${id}`, ts: Date.now() }); });
      // replace stored ids
      cursor._ids.members = currentIds.slice();
    }

    // timestamp-based detection (for sources that set createdAt)
    (members||[]).forEach(m => {
      const ts = parseTs(m.createdAt || m.created_at || m.created || m.date);
      if(ts && ts > lastMemTs){ pushNotification({ id: 'mem-'+(m.code||m.id||Date.now())+'-'+ts, type:'member', title: 'Nouveau membre: ' + (m.nom||m.name||m.code||''), detail: `Code: ${m.code||m.id||''}`, ts }); if(ts > maxMem) maxMem = ts; }
    });
    if(maxMem > lastMemTs) cursor.members = maxMem;
  }catch(e){ console.error('scan members', e); }

  // depots (detect by id and timestamp)
  try{
    const depots = await tryGetDepots();
    const lastDepTs = parseTs(cursor.depots);
    let maxDep = lastDepTs;
    const currentDepIds = (depots||[]).map(d => (d.id || getItemUid(d,'dep'))).filter(Boolean);
    cursor._ids.depots = cursor._ids.depots || [];
    if(!cursor._ids.depots.length) cursor._ids.depots = currentDepIds.slice();
    else {
      const added = currentDepIds.filter(id => cursor._ids.depots.indexOf(id) === -1);
      added.forEach(id => { const d = (depots||[]).find(x => (x.id === id || getItemUid(x,'dep') === id)); pushNotification({ id: 'dep-added-'+id, type:'depot_added', title: `Dépôt: ${d ? (d.montant||0) : ''} FC — ${d ? d.memberCode : id}`, detail: `Membre: ${d ? d.memberName : ''}`, ts: Date.now() }); });
      cursor._ids.depots = currentDepIds.slice();
    }
    (depots||[]).forEach(d => { const ts = parseTs(d.createdAt || d.created_at || d.created || d.date); if(ts && ts > lastDepTs){ pushNotification({ id: 'dep-'+(d.id||Date.now())+'-'+ts, type:'depot', title: `Dépôt: ${d.montant || 0} FC — ${d.memberCode || ''}`, detail: `Membre: ${d.memberName || ''}`, ts }); if(ts > maxDep) maxDep = ts; } });
    if(maxDep > lastDepTs) cursor.depots = maxDep;
  }catch(e){ console.error('scan depots', e); }

  // retraits
  // retraits removed — skip

  // payouts (paiements)
  try{
    const payouts = loadPayoutsLocal();
    const lastPayTs = parseTs(cursor.payouts);
    let maxPay = lastPayTs;
    const currentPayIds = (payouts||[]).map(p => (p.id || getItemUid(p,'pay'))).filter(Boolean);
    cursor._ids.payouts = cursor._ids.payouts || [];
    if(!cursor._ids.payouts.length) cursor._ids.payouts = currentPayIds.slice();
    else {
      const added = currentPayIds.filter(id => cursor._ids.payouts.indexOf(id) === -1);
      added.forEach(id => { const p = (payouts||[]).find(x => (x.id === id || getItemUid(x,'pay') === id)); pushNotification({ id: 'pay-added-'+id, type:'payout_added', title: `Paiement: ${p ? (p.amount||0) : ''} FC — ${p ? p.code : id}`, detail: `${p ? p.count : 0} dépôts`, ts: Date.now() }); });
      cursor._ids.payouts = currentPayIds.slice();
    }
    (payouts||[]).forEach(p => { const ts = parseTs(p.date || p.createdAt || p.created_at); if(ts && ts > lastPayTs){ pushNotification({ id: 'pay-'+(p.id||Date.now())+'-'+ts, type:'payout', title: `Paiement: ${p.amount || 0} FC — ${p.code || ''}`, detail: `${p.count || 0} dépôts`, ts }); if(ts > maxPay) maxPay = ts; } });
    if(maxPay > lastPayTs) cursor.payouts = maxPay;
  }catch(e){ console.error('scan payouts', e); }

  setCursor(cursor);
}

// public API for other scripts to push events
window.notifyEvent = function(type, payload){
  const ts = Date.now();
  let title = payload && payload.title ? payload.title : '';
  let detail = payload && payload.detail ? payload.detail : '';
  if(!title){
    if(type === 'member_deleted') title = `Membre supprimé: ${payload.code || ''}`;
    if(type === 'member_added') title = `Nouveau membre: ${payload.name || payload.nom || ''}`;
    if(type === 'depot') title = `Dépôt: ${payload.amount || payload.montant || 0} FC`;
    if(type === 'payout') title = `Paiement: ${payload.amount || payload.amount || 0} FC`;
  }
  pushNotification({ id: (type||'evt')+'-'+ts, type, title, detail, ts });
};

// init
document.addEventListener('DOMContentLoaded', function(){ renderNotifications(); // initial render
  // initial scan (non-blocking)
  scanStores().catch(e=>console.error(e));
  // poll stores every 10s
  setInterval(()=>{ scanStores().catch(e=>console.error(e)); }, 10000);
  // expose manual refresh
  const refreshBtns = document.querySelectorAll('button[onclick*="location.reload"]');
  refreshBtns.forEach(b=> b.addEventListener('click', function(e){ e.preventDefault(); scanStores().then(()=> renderNotifications()); }));
});


