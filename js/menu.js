// mobile menu toggle
document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('navToggle');
  const nav = document.querySelector('.site-nav');
  if(!btn || !nav) return;

  // Toggle menu visibility on button click
  btn.addEventListener('click', function(e){
    nav.classList.toggle('show');
    // Prevent this click from immediately triggering document click handler
    e.stopPropagation();
  });

  // When a link inside the nav is clicked, close the menu
  nav.addEventListener('click', function(e){
    let node = e.target;
    while(node && node.nodeType === 1 && node.tagName !== 'A') node = node.parentElement;
    const a = (node && node.tagName === 'A') ? node : null;
    if(a && nav.classList.contains('show')){
      nav.classList.remove('show');
    }
  });

  // Close the menu when clicking outside of it
  document.addEventListener('click', function(e){
    if(nav.classList.contains('show') && !nav.contains(e.target) && e.target !== btn){
      nav.classList.remove('show');
    }
  });

  // Hide menu on wider screens (optional cleanup)
  window.addEventListener('resize', function(){ if(window.innerWidth > 720 && nav.classList.contains('show')) nav.classList.remove('show'); });
});


