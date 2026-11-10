(function () {
  var els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  els.forEach(function (e) { io.observe(e); });
  // Höhe des Tagesplans für die Zeitleiste
  document.querySelectorAll('.day').forEach(function (d) {
    var set = function () { d.style.setProperty('--scan-h', (d.offsetHeight - 2) + 'px'); };
    set(); addEventListener('resize', set);
  });
})();
