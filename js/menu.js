// mobile menu toggle
document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('navToggle');
  const nav = document.querySelector('.site-nav');
  if(!btn || !nav) return;
  btn.addEventListener('click', function(){ nav.classList.toggle('show'); });
});


