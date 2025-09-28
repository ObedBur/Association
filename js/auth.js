// Lightweight local auth with registration + profile editing
// Users are stored in localStorage under key 'users' as [{ email, name, pwdHash }]
// Token is simply the logged-in email stored at 'authToken'

(function(){
  const TOKEN_KEY = 'authToken';
  const USERS_KEY = 'users';

  function isAuthenticated(){ return !!localStorage.getItem(TOKEN_KEY); }
  function getCurrentUserEmail(){ return localStorage.getItem(TOKEN_KEY); }
  function setToken(email){ localStorage.setItem(TOKEN_KEY, email); }
  function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

  function getUsers(){
    try{ return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }catch(e){ return []; }
  }
  function saveUsers(list){ localStorage.setItem(USERS_KEY, JSON.stringify(list)); }

  async function hashPassword(password){
    if(window.crypto && window.crypto.subtle){
      const enc = new TextEncoder().encode(password);
      const hashBuf = await crypto.subtle.digest('SHA-256', enc);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      return hashArr.map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    // fallback (less secure)
    return btoa(password);
  }

  async function findUserByEmail(email){
    const users = getUsers();
    return users.find(u=>u.email.toLowerCase()===String(email).toLowerCase()) || null;
  }

  async function registerUser(email, password, name){
    email = (email||'').trim().toLowerCase(); name = (name||'').trim();
    if(!email || !password) throw new Error('Email et mot de passe requis');
    const existing = await findUserByEmail(email);
    if(existing) throw new Error('Un compte existe déjà avec cet email');
    const pwdHash = await hashPassword(password);
    const users = getUsers();
    users.push({ email, name: name || email, pwdHash });
    saveUsers(users);
    setToken(email);
    return { email, name: name || email };
  }

  async function loginUser(email, password){
    const u = await findUserByEmail(email);
    if(!u) throw new Error('Utilisateur introuvable');
    const h = await hashPassword(password);
    if(h !== u.pwdHash) throw new Error('Mot de passe incorrect');
    setToken(u.email);
    return u;
  }

  async function updateProfile(email, newName, newPassword){
    const users = getUsers();
    const idx = users.findIndex(u=>u.email.toLowerCase()===email.toLowerCase());
    if(idx === -1) throw new Error('Utilisateur introuvable');
    if(newName) users[idx].name = newName;
    if(newPassword){ users[idx].pwdHash = await hashPassword(newPassword); }
    saveUsers(users);
    return users[idx];
  }

  // UI: login / register / profile modal
  function createAuthModal(mode){ // mode: 'login' | 'register' | 'profile'
    if(document.getElementById('authBackdrop')) return;
    const backdrop = document.createElement('div'); backdrop.id = 'authBackdrop'; backdrop.className = 'modal-backdrop show';
    const modal = document.createElement('div'); modal.id = 'authModal'; modal.className='modal small';
    document.body.appendChild(backdrop); backdrop.appendChild(modal);

    function renderLogin(){
      modal.innerHTML = `
        <div class="modal-header">
          <h2 style="font-size: 24px; color: #333; margin: 0; text-align:center "> Connexion </h2>
          <button class="close-btn" id="authClose" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          <div style="margin-bottom: 20px; text-align: center;">
            <div style="font-size: 16px; color: #666;">Connectez-vous pour accéder à votre espace</div>
          </div>
          
          <div style="position: relative; margin-bottom: 16px;">
            <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #666;">📧</div>
            <input id="authEmail" type="text" value="admin@asso.cd" placeholder="Votre email" 
                   style="width: 100%; padding: 12px 12px 12px 40px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;">
          </div>
          
          <div style="position: relative; margin-bottom: 20px;">
            <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #666;">🔒</div>
            <input id="authPassword" type="password" placeholder="Votre mot de passe" 
                   style="width: 100%; padding: 12px 12px 12px 40px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;">
          </div>

          <button id="authSubmit" style="width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; margin-bottom: 16px;">
            Se connecter
          </button>

          <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 16px;">
            <button id="authCancel" style="padding: 8px 16px; background: none; border: 1px solid #e0e0e0; border-radius: 6px; color: #666; cursor: pointer; transition: all 0.3s ease;">
              Annuler
            </button>
          </div>

          <div style="text-align: center;">
            <a href="#" id="toRegister" style="color: #2563eb; text-decoration: none; font-size: 14px; transition: all 0.3s ease;">
              Nouveau ? Créer un compte
            </a>
          </div>

          <div id="authMsg" style="min-height: 18px; margin-top: 16px; color: #dc2626; text-align: center; font-size: 14px;"></div>
        </div>
      `;
    }

    function renderRegister(){
      modal.innerHTML = `
        <div class="modal-header">
          <h2 style="font-size: 24px; color: #333; margin: 0;"> Créer un compte</h2>
          <button class="close-btn" id="authClose" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          <div style="margin-bottom: 20px; text-align: center;">
            <div style="font-size: 16px; color: #666;">Remplissez les champs pour vous inscrire</div>
          </div>
          <div style="position: relative; margin-bottom: 16px;">
            <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #666;">👤</div>
            <input id="regName" type="text" placeholder="Votre nom" 
                   style="width: 100%; padding: 12px 12px 12px 40px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;">
          </div>
          <div style="position: relative; margin-bottom: 16px;">
            <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #666;">📧</div>
            <input id="regEmail" type="text" placeholder="Votre email" 
                   style="width: 100%; padding: 12px 12px 12px 40px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;">
          </div>
          <div style="position: relative; margin-bottom: 20px;">
            <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #666;">🔒</div>
            <input id="regPassword" type="password" placeholder="Mot de passe" 
                   style="width: 100%; padding: 12px 12px 12px 40px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;">
          </div>
          <button id="regSubmit" style="width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; margin-bottom: 16px;">
            Créer mon compte
          </button>
          <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 16px;">
            <button id="authCancel" style="padding: 8px 16px; background: none; border: 1px solid #e0e0e0; border-radius: 6px; color: #666; cursor: pointer; transition: all 0.3s ease;">
              Annuler
            </button>
          </div>
          <div style="text-align: center;">
            <a href="#" id="toLogin" style="color: #2563eb; text-decoration: none; font-size: 14px; transition: all 0.3s ease;">
              J'ai déjà un compte
            </a>
          </div>
          <div id="authMsg" style="min-height: 18px; margin-top: 16px; color: #dc2626; text-align: center; font-size: 14px;"></div>
        </div>
      `;
    }

    function renderProfile(user){
      modal.innerHTML = `
        <div class="modal-header"><h2>Mon profil</h2><button class="close-btn" id="authClose">×</button></div>
        <div class="modal-body">
          <label>Nom affiché</label><input id="profName" type="text" value="${user.name||''}">
          <label>Modifier le mot de passe (laisser vide pour ne pas changer)</label><input id="profPassword" type="password">
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px"><button class="btn-ghost" id="authCancel">Annuler</button><button class="btn-primary" id="profSave">Enregistrer</button></div>
          <div id="authMsg" style="min-height:18px;margin-top:8px;color:var(--danger)"></div>
        </div>
      `;
    }

    function close(){ backdrop.remove(); }

    async function bindLogin(){
      modal.querySelector('#authClose').addEventListener('click', close);
      modal.querySelector('#authCancel').addEventListener('click', close);
      modal.querySelector('#toRegister').addEventListener('click', (e)=>{ e.preventDefault(); renderRegister(); bindRegister(); });
      modal.querySelector('#authSubmit').addEventListener('click', async ()=>{
        const email = modal.querySelector('#authEmail').value.trim(); const pass = modal.querySelector('#authPassword').value;
        const msg = modal.querySelector('#authMsg'); msg.textContent = '';
        try{ await loginUser(email, pass); if(typeof showToast === 'function') showToast('Connecté', 'success'); close(); const next = sessionStorage.getItem('auth_next'); if(next){ sessionStorage.removeItem('auth_next'); window.location.href = next; } }catch(err){ msg.textContent = err.message; }
      });
    }
    async function bindRegister(){
      modal.querySelector('#authClose').addEventListener('click', close);
      modal.querySelector('#authCancel').addEventListener('click', close);
      modal.querySelector('#toLogin').addEventListener('click', (e)=>{ e.preventDefault(); renderLogin(); bindLogin(); });
      modal.querySelector('#regSubmit').addEventListener('click', async ()=>{
        const email = modal.querySelector('#regEmail').value.trim(); const pass = modal.querySelector('#regPassword').value; const name = modal.querySelector('#regName').value.trim(); const msg = modal.querySelector('#authMsg'); msg.textContent = '';
        try{ await registerUser(email, pass, name); if(typeof showToast === 'function') showToast('Compte créé et connecté', 'success'); close(); const next = sessionStorage.getItem('auth_next'); if(next){ sessionStorage.removeItem('auth_next'); window.location.href = next; } }catch(err){ msg.textContent = err.message; }
      });
    }
    async function bindProfile(){
      modal.querySelector('#authClose').addEventListener('click', close);
      modal.querySelector('#authCancel').addEventListener('click', close);
      modal.querySelector('#profSave').addEventListener('click', async ()=>{
        const newName = modal.querySelector('#profName').value.trim(); const newPass = modal.querySelector('#profPassword').value; const msg = modal.querySelector('#authMsg'); msg.textContent = '';
        try{ const email = getCurrentUserEmail(); await updateProfile(email, newName || undefined, newPass || undefined); if(typeof showToast === 'function') showToast('Profil mis à jour', 'success'); close(); }catch(err){ msg.textContent = err.message; }
      });
    }

    if(mode === 'register') { renderRegister(); bindRegister(); }
    else if(mode === 'profile'){ const email = getCurrentUserEmail(); const user = getUsers().find(u=>u.email===email) || { name: '' }; renderProfile(user); bindProfile(); }
    else{ renderLogin(); bindLogin(); }
  }

  function showLogin(next){
    sessionStorage.setItem('auth_next', next || window.location.href);
    createAuthModal('login');
  }
  function showRegister(next){ sessionStorage.setItem('auth_next', next || window.location.href); createAuthModal('register'); }
  function showProfile(){ createAuthModal('profile'); }

  // Intercept clicks on admin links (robust)
  document.addEventListener('click', function(e){
    try{
      // find nearest anchor (support environments without closest)
      let node = e.target;
      while(node && node.nodeType === 1 && node.tagName !== 'A') node = node.parentElement;
      const a = (node && node.tagName === 'A') ? node : null;
      if(!a) return;

      const href = a.getAttribute('href') || '';
      // allow explicit protection via data-protect="auth" or by matching admin.html
      const protectedLink = a.dataset && a.dataset.protect === 'auth';
      if(!protectedLink && href.indexOf('admin.html') === -1) return;

      if(!isAuthenticated()){
        e.preventDefault();
        // store the desired destination and open login modal
        const next = a.href || href || window.location.href;
        console.debug('[auth] protected link clicked, redirecting to login, next=', next);
        showLogin(next);
      }
    }catch(err){
      console.error('auth click handler error', err);
    }
  });

  // Protect admin.html on direct access
  document.addEventListener('DOMContentLoaded', function(){
    const path = window.location.pathname || window.location.href;
    if(path.indexOf('admin.html') !== -1){
      if(!isAuthenticated()){
        const app = document.querySelector('.app'); if(app) app.style.filter = 'blur(4px)';
        showLogin(window.location.href);
      }
    }
  });

  // expose API
  // create default admin account if missing
  (async function ensureDefaultAdmin(){
    try{
      const existing = await findUserByEmail('admin@asso.cd');
      if(!existing){
        const pwdHash = await hashPassword('admin');
        const users = getUsers();
        users.push({ email: 'admin@asso.cd', name: 'Admin', pwdHash });
        saveUsers(users);
      }
    }catch(e){ console.error('ensureDefaultAdmin error', e); }
  })();

  window.auth = { isAuthenticated, getCurrentUserEmail, setToken, clearToken, showLogin, showRegister, showProfile, getUsers };
})(); 