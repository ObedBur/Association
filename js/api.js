// API wrapper: tries REST at / (json-server), falls back to localStorage/IndexedDB
const IS_LOCALHOST = (window && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
let API_BASE = IS_LOCALHOST ? 'http://localhost:3000' : null;
// Probe state to avoid repeated failed network requests when json-server is not running
let API_PROBED = false;
let apiProbePromise = null;

function probeApi(){
  if(!API_BASE){ API_PROBED = true; return Promise.resolve(false); }
  if(apiProbePromise) return apiProbePromise;
  apiProbePromise = (async ()=>{
    try{
      // try a quick GET with the safeFetch timeout; if it succeeds, keep API_BASE
      await safeFetch(API_BASE + '/members');
      API_PROBED = true;
      return true;
    }catch(e){
      // backend unreachable -> disable API and fall back to local storage
      API_BASE = null;
      API_PROBED = true;
      console.info('[api] backend unreachable, falling back to local storage');
      return false;
    }
  })();
  return apiProbePromise;
}

async function safeFetch(url, opts){
  if(!API_BASE) throw new Error('API disabled in this environment');
  const controller = new AbortController();
  const signal = controller.signal;
  const timeoutMs = 1500; // fail fast so UI falls back to local storage
  const timer = setTimeout(()=> controller.abort(), timeoutMs);
  try{
    const res = await fetch(url, Object.assign({}, opts || {}, { signal }));
    clearTimeout(timer);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }catch(e){
    clearTimeout(timer);
    throw e;
  }
}

async function getMembers(){
  // ensure we probed the API once to avoid repeated network errors
  if(API_BASE && !API_PROBED) await probeApi();
  if(!API_BASE){ try{ return await (window.useIndexedDB ? (await window.idbGetAll()) : window.loadMembersLocal()); }catch(err){ return window.loadMembersLocal ? window.loadMembersLocal() : []; } }
  try{ return await safeFetch(API_BASE + '/members'); }catch(e){ try{ return await (window.useIndexedDB ? (await window.idbGetAll()) : window.loadMembersLocal()); }catch(err){ return window.loadMembersLocal ? window.loadMembersLocal() : []; } }
}

async function addMember(member){
  if(!API_BASE){ // directly fallback local
    if(window.useIndexedDB && window.idbAdd){ await window.idbAdd(member); return member; }
    const list = window.loadMembersLocal ? window.loadMembersLocal() : []; list.push(member); window.saveMembersLocal ? window.saveMembersLocal(list) : localStorage.setItem('membres', JSON.stringify(list)); return member; }
  try{ return await safeFetch(API_BASE + '/members', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(member) }); }catch(e){ // fallback local
    if(window.useIndexedDB && window.idbAdd){ await window.idbAdd(member); return member; }
    const list = window.loadMembersLocal ? window.loadMembersLocal() : []; list.push(member); window.saveMembersLocal ? window.saveMembersLocal(list) : localStorage.setItem('membres', JSON.stringify(list)); return member; }
}

async function putMember(id, patch){
  try{ return await safeFetch(API_BASE + '/members/' + encodeURIComponent(id), { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch) }); }catch(e){ // fallback local
    const list = window.loadMembersLocal ? window.loadMembersLocal() : []; const idx = list.findIndex(x=>x.code===id); if(idx>=0){ list[idx] = { ...list[idx], ...patch }; window.saveMembersLocal ? window.saveMembersLocal(list) : localStorage.setItem('membres', JSON.stringify(list)); return list[idx]; } return null; }
}

// Depots
async function getDepots(){ try{ return await safeFetch(API_BASE + '/depots'); }catch(e){ return JSON.parse(localStorage.getItem('depots') || '[]'); } }
async function addDepot(dep){ try{ return await safeFetch(API_BASE + '/depots', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(dep) }); }catch(e){ const list = JSON.parse(localStorage.getItem('depots') || '[]'); list.push(dep); localStorage.setItem('depots', JSON.stringify(list)); return dep; } }
async function clearDepots(){ try{ // json-server delete all doesn't exist; replace with PUT of empty array via file or use batch delete; fallback to local
    localStorage.removeItem('depots'); return []; }catch(e){ localStorage.removeItem('depots'); return []; } }

// Retraits
// retraits endpoints removed — provide safe fallbacks so existing callers won't throw
async function getRetraits(){ try{ return await safeFetch(API_BASE + '/retraits'); }catch(e){ return JSON.parse(localStorage.getItem('retraits') || '[]'); } }
async function addRetrait(r){ try{ return await safeFetch(API_BASE + '/retraits', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(r) }); }catch(e){ const list = JSON.parse(localStorage.getItem('retraits') || '[]'); list.push(r); localStorage.setItem('retraits', JSON.stringify(list)); return r; } }
async function clearRetraits(){ try{ localStorage.removeItem('retraits'); return []; }catch(e){ localStorage.removeItem('retraits'); return []; } }

// Payouts (paiements) — used by paiement.js
async function getPayouts(){ try{ return await safeFetch(API_BASE + '/payouts'); }catch(e){ return JSON.parse(localStorage.getItem('payouts') || '[]'); } }
async function addPayout(p){ try{ return await safeFetch(API_BASE + '/payouts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(p) }); }catch(e){ const list = JSON.parse(localStorage.getItem('payouts') || '[]'); list.push(p); localStorage.setItem('payouts', JSON.stringify(list)); return p; } }
async function clearPayouts(){ try{ localStorage.removeItem('payouts'); return []; }catch(e){ localStorage.removeItem('payouts'); return []; } }

window.api = { getMembers, addMember, putMember, getDepots, addDepot, clearDepots, getRetraits, addRetrait, clearRetraits, getPayouts, addPayout, clearPayouts };