(function () {
  // Scroll-Reveal
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.15 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));

  // Maus-Tilt auf dem Mockup
  const stage = document.querySelector('.stage');
  const mock = document.querySelector('.mock');
  if (stage && mock && matchMedia('(hover:hover)').matches) {
    stage.addEventListener('mousemove', e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      mock.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 12}deg)`;
    });
    stage.addEventListener('mouseleave', () => mock.style.transform = '');
  }

  // Spotlight auf Feature-Karten
  document.querySelectorAll('.feat').forEach(c => c.addEventListener('mousemove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  // Zähler
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = +el.dataset.count, t0 = performance.now();
    const step = t => {
      const p = Math.min((t - t0) / 1600, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + (el.dataset.suffix || '');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step); cio.unobserve(el);
  }), { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

  // Tipp-Effekt für rotierende Schlagwörter
  const tw = document.getElementById('typed');
  if (tw) {
    const words = ['Projekte.', 'Ideen.', 'Tools.', 'Alles.'];
    let w = 0, i = 0, del = false;
    (function tick() {
      const word = words[w];
      tw.textContent = word.slice(0, i);
      if (!del && i === word.length) { del = true; return setTimeout(tick, 1400); }
      if (del && i === 0) { del = false; w = (w + 1) % words.length; }
      i += del ? -1 : 1;
      setTimeout(tick, del ? 45 : 90);
    })();
  }
})();
