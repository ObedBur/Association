// Modal helper: center modal, show backdrop, blur background
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('addModal');
  if (!modal) return;

  // create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  document.body.appendChild(backdrop);
  backdrop.appendChild(modal);

  function openModal() {
    backdrop.classList.add('show');
    // ensure modal is visible (remove any inline hide)
    modal.style.display = 'block';
    // ensure backdrop is visible and centers content
    backdrop.style.display = 'flex';
    backdrop.style.position = 'fixed';
    backdrop.style.left = '0';
    backdrop.style.top = '0';
    backdrop.style.right = '0';
    backdrop.style.bottom = '0';
    // bring to front
    backdrop.style.zIndex = 2000;
    modal.style.zIndex = 2001;
    // force visible styles (in case CSS specificity causes issues)
    modal.style.opacity = '1';
    modal.style.transform = 'translateY(0) scale(1)';
    modal.style.transition = 'all 260ms cubic-bezier(.2,.8,.2,1)';
    // set default adhesion date to today
    const dateInput = modal.querySelector('#dateAdhesion');
    if (dateInput) {
      dateInput.value = new Date().toISOString().slice(0,10);
    }
    // focus first input
    const first = modal.querySelector('input, select, textarea');
    if (first) first.focus();
    const app = document.querySelector('.app');
    if (app && app.classList) app.classList.add('blurred');
  }
  function closeModal() {
    // animate out
    modal.style.opacity = '0';
    modal.style.transform = 'translateY(-10px) scale(0.98)';
    // remove blur immediately so it doesn't persist if other DOM changes occur
    const app = document.querySelector('.app');
    if (app && app.classList) app.classList.remove('blurred');
    setTimeout(() => {
      backdrop.classList.remove('show');
      modal.style.display = 'none';
      // also hide backdrop to ensure no overlay remains
      backdrop.style.display = 'none';
    }, 260);
  }

  // open link
  const open = document.getElementById('openAdd');
  if (open) open.addEventListener('click', e => { e.preventDefault(); openModal(); });
  // close button
  const closeBtn = document.getElementById('closeModalBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => closeModal());
  // close on ESC
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // close on backdrop click
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  // expose for other scripts
  window.openAddModal = openModal;
  window.closeAddModal = closeModal;
});


