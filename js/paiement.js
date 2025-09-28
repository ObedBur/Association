// paiement.js
// Logique pour déterminer membres éligibles (>=30 jours de paiements) et enregistrer paiements

const PAYOUTS_KEY = 'payouts'; // enregistrements des octrois
const DEPOTS_KEY = 'depots'; // clé utilisée dans epargne.html

function loadPayouts(){ try{ return JSON.parse(localStorage.getItem(PAYOUTS_KEY)||'[]'); }catch(e){ return []; } }
function savePayouts(list){ localStorage.setItem(PAYOUTS_KEY, JSON.stringify(list)); }

// Use shared save/load helpers if available elsewhere (admin/epargne), otherwise fallback to localStorage
function loadDepots(){ try{ if(typeof loadDepotsLocal === 'function') return loadDepotsLocal(); return JSON.parse(localStorage.getItem(DEPOTS_KEY)||'[]'); }catch(e){ return []; } }
function saveDepots(list){ try{ if(typeof saveDepotsLocal === 'function'){ return saveDepotsLocal(list); } localStorage.setItem(DEPOTS_KEY, JSON.stringify(list)); }catch(e){ console.error('saveDepots error', e); }
}

// Eligibility based on days since first unpaid deposit
const ELIGIBILITY_DAYS = 30;
function computeEligibility(){
  // Reuse aggregateMemberStats to compute member metrics and then filter eligible members
  const stats = aggregateMemberStats();
  // Eligible when remainingDays === 0 (or <= 0) and there is at least one unpaid deposit (count > 0)
  const eligible = (stats || []).filter(s => (s.remainingDays !== null && s.remainingDays <= 0) && (s.count && s.count > 0));
  // Sort by longest elapsed first
  eligible.sort((a,b)=> (b.daysElapsed||0) - (a.daysElapsed||0));
  // normalize fields expected by renderEligible (total/count)
  return eligible.map(e => ({ code: e.code, name: e.name, total: e.total || 0, count: e.count || 0, daysElapsed: e.daysElapsed, remainingDays: e.remainingDays }));
}

// toast helper: use global showToast if available, otherwise simple fallback
function toast(message, type){
  try{
    if(window.showToast) return window.showToast(message, type);
  }catch(e){}
  // fallback: simple floating div
  const id = 'paiement-toast';
  let c = document.getElementById(id);
  if(!c){ c = document.createElement('div'); c.id = id; c.style.position = 'fixed'; c.style.right='16px'; c.style.bottom='16px'; c.style.zIndex='13000'; document.body.appendChild(c); }
  const t = document.createElement('div'); t.textContent = message; t.style.background = (type==='error'?'#ef4444':(type==='success'?'#16a34a':'#111')); t.style.color='#fff'; t.style.padding='10px 12px'; t.style.borderRadius='8px'; t.style.marginTop='8px'; c.appendChild(t);
  setTimeout(()=>{ t.remove(); if(c.children.length===0) c.remove(); }, 4000);
}

function renderEligible(){
  const list = computeEligibility();
  const container = document.getElementById('eligibleList');
  container.innerHTML = '';
  if(!list || list.length === 0){ container.innerHTML = '<p>Aucun membre éligible pour le moment.</p>'; return; }
  list.forEach(m => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `<div><strong>${m.code}</strong><div class="muted">${m.name}</div></div><div style="text-align:right"><div>${m.count} paiements</div><div style="font-weight:700">${m.total} FC</div></div>`;
    row.addEventListener('click', ()=> showDetail(m.code));
    container.appendChild(row);
  });
}

// Aggregate unpaid deposits per member and compute stats (counts in last 90 days for monthly avg)
function aggregateMemberStats(){
  // For planning, compute first unpaid date and remaining days until ELIGIBILITY_DAYS
  const depots = loadDepots();
  const byMember = {};
  const now = new Date();
  for(const d of depots){
    if(d.paid) continue;
    const code = d.memberCode || 'UNKNOWN';
    byMember[code] = byMember[code] || { code, name: d.memberName||'', count:0, total:0, firstUnpaidDate: null };
    byMember[code].count += 1;
    byMember[code].total += Number(d.montant||0);
    const dDate = d.date ? new Date(d.date) : (d.createdAt ? new Date(d.createdAt) : null);
    if(dDate){
      if(!byMember[code].firstUnpaidDate || new Date(byMember[code].firstUnpaidDate) > dDate) byMember[code].firstUnpaidDate = d.date || d.createdAt;
    }
  }

  return Object.values(byMember).map(m => {
    let daysElapsed = null;
    let remainingDays = null;
    let projectedDateISO = null;
    if(m.firstUnpaidDate){
      const fd = new Date(m.firstUnpaidDate);
      daysElapsed = Math.floor((now - fd) / (1000*60*60*24));
      remainingDays = Math.max(0, ELIGIBILITY_DAYS - daysElapsed);
      const proj = new Date(fd.getTime() + (ELIGIBILITY_DAYS * 24 * 60 * 60 * 1000));
      projectedDateISO = proj.toISOString().slice(0,10);
    }
    return Object.assign({}, m, { daysElapsed, remainingDays, projectedDateISO });
  });
}

function renderPending(){
  const stats = aggregateMemberStats();
  const pending = stats.filter(s => s.count > 0 && s.count < 30).sort((a,b)=> a.remaining - b.remaining);
  const container = document.getElementById('pendingList');
  if(!container) return;
  container.innerHTML = '';
  if(!pending || pending.length === 0){ container.innerHTML = '<p>Aucun membre en attente.</p>'; return; }
  pending.forEach(p => {
    const row = document.createElement('div');
    row.className = 'list-row';
    const remainingLabel = (p.remainingDays === null) ? '—' : `${p.remainingDays} jours`;
    const firstDate = p.firstUnpaidDate ? `<div class="pending-date">Premier dépôt: ${p.firstUnpaidDate}</div>` : '';
    const proj = p.projectedDateISO ? p.projectedDateISO : '—';
    // projected date styled red if not yet paid, green if already paid (here unpaid focus)
    const projHtml = p.remainingDays === 0 ? `<div style="color:#16a34a;font-weight:600">${proj}</div>` : `<div style="color:#ef4444;font-weight:600">${proj}</div>`;
    row.innerHTML = `<div><strong>${p.code}</strong><div class="muted">${p.name}</div></div><div class="pending-info"><div>${p.count} paiements</div><div class="muted">reste: ${remainingLabel}</div>${firstDate}${projHtml}</div>`;
    row.addEventListener('click', ()=> showDetail(p.code));
    container.appendChild(row);
  });
}

function showDetail(code){
  const depots = loadDepots().filter(d => d.memberCode === code).slice().reverse();
  const detail = document.getElementById('paymentDetail');
  detail.innerHTML = `<h4>${code}</h4><div class="muted">Derniers dépôts (${depots.length})</div>`;
  const list = document.createElement('div');
  depots.slice(0,10).forEach(d => { const r = document.createElement('div'); r.className='muted'; r.style.padding='6px 0'; r.textContent = `${d.date} — ${d.montant} FC`; list.appendChild(r); });
  detail.appendChild(list);
  // store selected
  detail.dataset.selected = code;
}

function renderPayouts(){
  const list = loadPayouts();
  const el = document.getElementById('payoutsList');
  if(!list || list.length===0){ el.innerHTML = 'Aucun paiement enregistré.'; return; }
  el.innerHTML = '';
  list.slice().reverse().forEach(p => { const row = document.createElement('div'); row.className='muted'; row.style.padding='6px 0'; row.textContent = `${p.date} — ${p.code} — ${p.amount} FC — ${p.note||''}`; el.appendChild(row); });
}

async function paySelected(){
  const sel = document.getElementById('paymentDetail').dataset.selected;
  if(!sel){ toast('Sélectionnez un membre', 'error'); return; }
  // compute total to pay
  const depots = loadDepots();
  let total = 0; let changed = false; const nowDate = new Date().toISOString().slice(0,10);
  for(const d of depots){ if(d.memberCode === sel && !d.paid){ total += Number(d.montant||0); } }
  // check eligibility: must have remainingDays === 0 for this member
  const stats = aggregateMemberStats();
  const s = stats.find(x => x.code === sel);
  if(!s || s.remainingDays === null){ toast('Impossible de déterminer la date de paiement', 'error'); return; }
  if(s.remainingDays > 0){ toast(`Attendez ${s.remainingDays} jours avant paiement`, 'error'); return; }
  // confirmation modal
  const ok = await confirmModal(`Confirmer le paiement pour ${sel} — total ${total} FC ?`);
  if(!ok){ toast('Paiement annulé', 'info'); return; }
  // mark as paid
  for(const d of depots){ if(d.memberCode === sel && !d.paid){ d.paid = true; d.paidAt = nowDate; changed = true; } }
  if(!changed){ toast('Aucun dépôt impayé pour ce membre', 'error'); return; }
  saveDepots(depots);
  const payout = { id: Date.now(), code: sel, amount: total, date: nowDate, note: 'Octroi épargne', count: depots.filter(d=>d.memberCode===sel && d.paidAt===nowDate).length };
  const list = loadPayouts(); list.push(payout); savePayouts(list); renderPayouts(); renderEligible(); toast('Paiement enregistré', 'success');
  try{ if(window.notifyEvent) window.notifyEvent('payout', { code: sel, amount: total, count: payout.count, date: nowDate, ts: Date.now() }); }catch(e){}
}

async function payAll(){
  const list = computeEligibility();
  if(!list || list.length===0){ alert('Aucun membre éligible'); return; }
  const payouts = loadPayouts();
  const depots = loadDepots();
  const nowDate = new Date().toISOString().slice(0,10);
  for(const m of list){
    let total = 0; let count = 0;
    for(const d of depots){
      if(d.memberCode === m.code && !d.paid){ total += Number(d.montant||0); d.paid = true; d.paidAt = nowDate; count += 1; }
    }
    payouts.push({ id: Date.now() + Math.random(), code: m.code, amount: total, date: nowDate, note: 'Octroi en masse', count });
  }
  // confirmation modal
  const okAll = await confirmModal(`Confirmer paiement pour ${list.length} membres ?`);
  if(!okAll){ toast('Opération annulée', 'info'); return; }
  savePayouts(payouts); saveDepots(depots); renderPayouts(); renderEligible(); toast('Paiements effectués', 'success');
  try{ if(window.notifyEvent) window.notifyEvent('payout_bulk', { count: list.length, ts: Date.now() }); }catch(e){}
}

document.addEventListener('DOMContentLoaded', function(){
  renderEligible(); renderPayouts();
  document.getElementById('refreshList').addEventListener('click', renderEligible);
  document.getElementById('paySelected').addEventListener('click', paySelected);
  // render pending section and refresh with eligible
  renderPending();
  document.getElementById('refreshList').addEventListener('click', function(){ renderEligible(); renderPending(); });

  // Modal list handlers
  const modal = document.getElementById('listModal');
  const modalTitle = document.getElementById('listModalTitle');
  const modalContent = document.getElementById('listModalContent');
  const closeBtn = document.getElementById('closeListModal');
  if(closeBtn) closeBtn.addEventListener('click', ()=> { modal.style.display='none'; modalContent.innerHTML=''; });

  const viewPayoutsBtn = document.getElementById('viewPayouts');
  if(viewPayoutsBtn){
    viewPayoutsBtn.addEventListener('click', ()=>{
      const rows = loadPayouts();
      modalTitle.textContent = 'Historique des paiements';
      if(!rows || rows.length===0){ modalContent.innerHTML = '<p>Aucun paiement enregistré.</p>'; } else {
        const el = document.createElement('div');
        rows.slice().reverse().forEach(r => { const d = document.createElement('div'); d.style.padding='8px 0'; d.textContent = `${r.date} — ${r.code} — ${r.amount} FC — ${r.note||''}`; el.appendChild(d); });
        modalContent.innerHTML=''; modalContent.appendChild(el);
      }
      modal.style.display = 'flex';
    });
  }

  const viewPendingBtn = document.getElementById('viewPending');
  if(viewPendingBtn){
    viewPendingBtn.addEventListener('click', ()=>{
      const stats = aggregateMemberStats();
      modalTitle.textContent = 'Paiements en attente';
      if(!stats || stats.length===0){ modalContent.innerHTML = '<p>Aucun membre en attente.</p>'; } else {
        const el = document.createElement('div');
        stats.forEach(s => { const d = document.createElement('div'); d.style.padding='8px 0'; d.textContent = `${s.code} — ${s.name} — reste: ${s.remainingDays===null? '—' : s.remainingDays + ' jours'}`; el.appendChild(d); });
        modalContent.innerHTML=''; modalContent.appendChild(el);
      }
      modal.style.display = 'flex';
    });
  }
});

// support programmatic pay after credential check
document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('paySelected');
  if(btn){ btn.addEventListener('doPay', function(){ paySelected(); }); }
});

// small wrapper around existing confirmDialog (from ui.js)
function confirmModal(message){
  if(window.confirmDialog) return window.confirmDialog(message);
  return Promise.resolve(confirm(message));
}


