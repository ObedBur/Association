// Simple confirm dialog implemented with DOM, returns Promise<boolean>
function confirmDialog(message){
  return new Promise(resolve => {
    let container = document.getElementById('confirmDialog');
    const needsInit = !container || !container.querySelector('#confirmMessage');

    if(!container){
      container = document.createElement('div');
      container.id = 'confirmDialog';
      document.body.appendChild(container);
    }

    if(needsInit){
      container.style.position = 'fixed';
      container.style.inset = '0';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.zIndex = 12000;
      container.innerHTML = `
        <div style="background:var(--card);padding:16px;border-radius:10px;box-shadow:0 10px 40px rgba(2,6,23,0.2);max-width:420px;width:90%">
          <div id="confirmMessage" style="margin-bottom:12px;color:var(--text)"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="confirmCancel" class="btn-ghost">Annuler</button>
            <button id="confirmOk" class="btn-primary">Confirmer</button>
          </div>
        </div>
      `;
    }

    const msgEl = container.querySelector('#confirmMessage');
    if(msgEl) msgEl.textContent = message || '';
    container.style.background = 'rgba(2,6,23,0.3)';
    container.style.pointerEvents = 'auto';
    container.style.display = 'flex';

    const okBtn = container.querySelector('#confirmOk');
    const cancelBtn = container.querySelector('#confirmCancel');

    function cleanup(val){
      container.style.display = 'none';
      if(okBtn) okBtn.removeEventListener('click', onOk);
      if(cancelBtn) cancelBtn.removeEventListener('click', onCancel);
      resolve(val);
    }
    function onOk(){ cleanup(true); }
    function onCancel(){ cleanup(false); }
    if(okBtn) okBtn.addEventListener('click', onOk);
    if(cancelBtn) cancelBtn.addEventListener('click', onCancel);
  });
}

// showAuthModal: shows a reusable auth modal and returns Promise<boolean>
function showAuthModal(){
  return new Promise(resolve => {
    try{
      console.log('[ui] showAuthModal called');
      let container = document.getElementById('uiAuthModal');
      if(!container){
      container = document.createElement('div');
      container.id = 'uiAuthModal';
      container.style.position = 'fixed';
      container.style.inset = '0';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.zIndex = 13000;
      container.innerHTML = `
        <div style="background:var(--card);padding:20px;border-radius:12px;box-shadow:0 20px 60px rgba(2,6,23,0.16);max-width:480px;width:92%">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="margin:0;font-size:18px;color:var(--text);font-weight:700">Authentification requise</h3>
            <button id="authCloseSmall" style="border:none;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:var(--muted)">×</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;gap:8px;align-items:center">
              <svg width="36" height="36" aria-hidden="true" style="background:rgba(37,99,235,0.08);border-radius:8px;padding:6px;color:var(--primary)"><use xlink:href="#icon-mail" /></svg>
              <input id="authEmail" type="email" placeholder="Email" style="flex:1;padding:12px;border-radius:10px;border:1px solid #e6e9ef;font-size:14px" />
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <svg width="36" height="36" aria-hidden="true" style="background:rgba(16,163,127,0.06);border-radius:8px;padding:6px;color:var(--success)"><use xlink:href="#icon-lock" /></svg>
              <input id="authPassword" type="password" placeholder="Mot de passe" style="flex:1;padding:12px;border-radius:10px;border:1px solid #e6e9ef;font-size:14px" />
            </div>
            <div id="authError" style="color:var(--danger);font-size:13px;min-height:18px;margin-left:44px"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px">
              <button id="authCancel" class="btn-ghost">Annuler</button>
              <button id="authOk" class="btn-primary">Valider</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(container);
    }
    const emailEl = container.querySelector('#authEmail');
    const passEl = container.querySelector('#authPassword');
    const authError = container.querySelector('#authError');
    const okBtn = container.querySelector('#authOk');
    const cancelBtn = container.querySelector('#authCancel');
    function cleanup(val){ container.style.display = 'none'; okBtn.removeEventListener('click', onOk); cancelBtn.removeEventListener('click', onCancel); resolve(val); }
    function onOk(){ (async ()=>{
        try{
          const email = emailEl.value.trim(); const pwd = passEl.value;
          console.log('[auth] submit', { email });
          // clear previous error
          authError.textContent = '';
          // try server auth if available
          if(window.auth && typeof window.auth.validateCredentials === 'function'){
            try{ const res = await window.auth.validateCredentials(email, pwd);
                console.log('[auth] server res', res);
                // support boolean or {ok,errors}
                if(typeof res === 'boolean'){ if(res) { cleanup(true); return; } else { authError.textContent = 'Identifiants incorrects'; if(window.showToast) showToast(authError.textContent,'error'); emailEl.focus(); return; } }
                if(res && res.ok){ cleanup(true); return; }
                if(res && res.errors && res.errors.length){ authError.textContent = res.errors.map(e=>e.msg||e).join('; '); if(window.showToast) showToast(authError.textContent,'error'); emailEl.focus(); return; }
            }catch(e){ console.error('auth validate error', e); authError.textContent = 'Erreur lors de la validation'; if(window.showToast) showToast(authError.textContent,'error'); }
          }
          // fallback to local validation
          if(window.validateCredentials){ const res = window.validateCredentials({ email, password: pwd }); if(!res.ok){ authError.textContent = res.errors.map(x=>x.msg).join(' / '); if(window.showToast) showToast(authError.textContent,'error'); emailEl.focus(); return; } }
          // when auth succeeds, resolve true and signal auto-create if requested
          // when auth succeeds, if caller requested autoCreate, create a sample member
          const autoCreate = container.dataset.autoCreate === '1';
          cleanup(true);
          if(autoCreate){
            try{
              // open add modal and prefill test values (user can edit before saving)
              if(window.openAddModal) window.openAddModal();
              setTimeout(()=>{
                const nom = document.getElementById('nom'); if(nom) nom.value = 'Nouveau Membre';
                const montant = document.getElementById('montant'); if(montant) montant.value = '2000';
              }, 120);
            }catch(e){ console.error('autoCreate error', e); }
          }
        }catch(err){ console.error('onOk error', err); authError.textContent = 'Erreur interne'; if(window.showToast) showToast('Erreur interne', 'error'); }
    })(); }
    function onCancel(){ cleanup(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    const closeSmall = container.querySelector('#authCloseSmall'); if(closeSmall) closeSmall.addEventListener('click', onCancel);
    container.style.display = 'flex';
    // clear fields
    if(emailEl) emailEl.value=''; if(passEl) passEl.value='';
    // focus
    setTimeout(()=>{ if(emailEl) emailEl.focus(); },50);
    }catch(err){
      console.error('[ui] showAuthModal error', err);
      // fallback to prompt-based flow
      if(window.requireCredentials) {
        try{ window.requireCredentials().then(r=> resolve(!!r)); }catch(e){ console.error('fallback requireCredentials failed', e); resolve(false); }
      } else { resolve(false); }
    }
  });
}

window.showAuthModal = showAuthModal;

// Ensure SVG sprite is loaded into the document for <use> references
async function ensureIconSprite(){
  if(document.getElementById('svg-sprite')) return;
  // Try a few candidate paths because pages are served from different folders
  const candidates = [
    '/vendor/icons.svg', // root-relative (works when project is served at site root)
    '../vendor/icons.svg', // one level up (e.g. Html/*.html)
    'vendor/icons.svg', // relative to current document
    './vendor/icons.svg'
  ];
  for(const p of candidates){
    try{
      const res = await fetch(p);
      if(!res.ok) continue;
      const text = await res.text();
      const div = document.createElement('div');
      div.id = 'svg-sprite';
      div.style.display = 'none';
      div.innerHTML = text;
      document.body.insertBefore(div, document.body.firstChild);
      return;
    }catch(e){ /* try next candidate */ }
  }
  console.warn('Could not load icon sprite from any known path');
}

document.addEventListener('DOMContentLoaded', function(){ ensureIconSprite(); });

// Open add-member flow but require auth first; if auth succeeds, open add modal, prefill and submit
window.openAddWithAuth = async function(){
  try{
    // prefer modal auth
    const ok = await showAuthModal();
    if(!ok) return false;
    if(window.openAddModal) window.openAddModal();
    // prefill and submit after modal shows
    setTimeout(()=>{
      try{
        const nom = document.getElementById('nom'); if(nom) nom.value = 'Nouveau Membre';
        const montant = document.getElementById('montant'); if(montant) montant.value = '2000';
        // trigger add
        if(typeof ajouterMembre === 'function') ajouterMembre();
      }catch(e){ console.error('openAddWithAuth prefill error', e); }
    }, 200);
    return true;
  }catch(e){ console.error('openAddWithAuth error', e); return false; }
};


