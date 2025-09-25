// Simple confirm dialog implemented with DOM, returns Promise<boolean>
function confirmDialog(message){
  return new Promise(resolve => {
    let container = document.getElementById('confirmDialog');
    if(!container){
      container = document.createElement('div');
      container.id = 'confirmDialog';
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
      document.body.appendChild(container);
    }
    container.querySelector('#confirmMessage').textContent = message || '';
    container.style.background = 'rgba(2,6,23,0.3)';
    container.style.pointerEvents = 'auto';
    container.style.display = 'flex';
    const okBtn = container.querySelector('#confirmOk');
    const cancelBtn = container.querySelector('#confirmCancel');
    function cleanup(val){
      container.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(val);
    }
    function onOk(){ cleanup(true); }
    function onCancel(){ cleanup(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}


