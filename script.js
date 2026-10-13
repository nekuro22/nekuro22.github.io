/* ==========================================================
   Niklas-Leidert.de — Script
   - Wartungsmodus (options.json)
   - Sternenhimmel mit Sternschnuppen (Klick in den Himmel)
   - Uhr, Siegel, Präzisionsmodus (Easter Egg: "precision" tippen)
   - Projekte: Sternbild + Liste aus projects.json, Repos live von GitHub
   ========================================================== */

const GITHUB_USER = 'nekuro22';
// Repos, die unter „Mehr auf GitHub“ nicht auftauchen sollen
const REPOS_AUSBLENDEN = [];
const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Wartungsmodus ---------- */
(async function wartung() {
  if (location.pathname.endsWith('maintenance.html')) return;
  try {
    const res = await fetch('options.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const opt = await res.json();
    if (opt.maintenance_mode === true) location.replace('maintenance.html');
  } catch (_) { /* ohne options.json läuft die Seite normal */ }
})();

/* ---------- kleine Helfer ---------- */
function el(tag, attrs = {}, ...kinder) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  kinder.flat().forEach(c => c != null && node.append(c));
  return node;
}

const SVG = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

let toastTimer;
function toast(text) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(t);
  }
  t.textContent = text;
  t.classList.add('zeigen');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('zeigen'), 2600);
}

/* ---------- Sternenhimmel ---------- */
const himmel = (function () {
  const canvas = el('canvas', { id: 'sky', 'aria-hidden': 'true' });
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let w, h, dpr, sterne = [], schnuppen = [], laeuft = false;

  function aufbauen() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const anzahl = Math.round((w * h) / 2600);
    sterne = Array.from({ length: anzahl }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() < 0.08 ? Math.random() * 1.1 + 1 : Math.random() * 0.8 + 0.25,
      a: Math.random() * 0.7 + 0.2,
      p: Math.random() * Math.PI * 2,
      s: Math.random() * 0.0015 + 0.0005,
      gold: Math.random() < 0.04
    }));
    if (reduziert) zeichnen(0);
  }

  function zeichnen(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of sterne) {
      const flackern = reduziert ? 1 : 0.65 + 0.35 * Math.sin(t * s.s + s.p);
      ctx.globalAlpha = s.a * flackern;
      ctx.fillStyle = s.gold ? '#f2c66d' : '#e8ecf4';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    schnuppen = schnuppen.filter(sn => sn.leben > 0);
    for (const sn of schnuppen) {
      sn.x += sn.vx; sn.y += sn.vy; sn.leben -= 1;
      const k = sn.leben / sn.max;
      const g = ctx.createLinearGradient(sn.x, sn.y, sn.x - sn.vx * 14, sn.y - sn.vy * 14);
      g.addColorStop(0, `rgba(242,198,109,${k})`);
      g.addColorStop(1, 'rgba(242,198,109,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sn.x, sn.y);
      ctx.lineTo(sn.x - sn.vx * 14, sn.y - sn.vy * 14);
      ctx.stroke();
    }
  }

  function loop(t) {
    zeichnen(t);
    if (!document.hidden) requestAnimationFrame(loop);
    else laeuft = false;
  }

  function start() {
    if (reduziert || laeuft) return;
    laeuft = true;
    requestAnimationFrame(loop);
  }

  function schnuppe(x, y) {
    if (reduziert) return;
    const winkel = Math.PI * (0.15 + Math.random() * 0.15);
    const tempo = 9 + Math.random() * 5;
    schnuppen.push({
      x: x ?? Math.random() * w * 0.6,
      y: y ?? Math.random() * h * 0.3,
      vx: Math.cos(winkel) * tempo,
      vy: Math.sin(winkel) * tempo,
      leben: 55, max: 55
    });
  }

  aufbauen();
  start();
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(aufbauen, 150); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

  // Klick in den leeren Himmel → Sternschnuppe
  document.addEventListener('click', e => {
    if (e.target.closest('a, button, input, .projekt, .sternbild, .kontakt, .feld')) return;
    schnuppe(e.clientX - 60, e.clientY - 40);
  });

  return { schnuppe };
})();

/* ---------- Präzisionsmodus (Easter Egg) ---------- */
function praezisionUmschalten() {
  const an = document.body.classList.toggle('praezision');
  toast(an ? 'Präzisionsmodus an – jedes Pixel an seinem Platz.' : 'Präzisionsmodus aus.');
}
(function () {
  const wort = 'precision';
  let puffer = '';
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea')) return;
    puffer = (puffer + e.key.toLowerCase()).slice(-wort.length);
    if (puffer === wort) { praezisionUmschalten(); puffer = ''; }
  });
})();

/* ---------- Uhr ---------- */
(function uhr() {
  const ziel = document.querySelector('[data-uhr]');
  if (!ziel) return;
  const zeit = ziel.querySelector('time');
  const text = ziel.querySelector('[data-uhr-text]');
  const fmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  const stunde = new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Berlin' });
  function tick() {
    const jetzt = new Date();
    zeit.textContent = fmt.format(jetzt);
    zeit.dateTime = jetzt.toISOString();
    const h = Number(stunde.format(jetzt));
    text.textContent =
      h < 6 ? 'eigentlich schlafe ich gerade.' :
      h < 9 ? 'der Kaffee läuft noch an.' :
      h < 23 ? 'gut möglich, dass ich gerade etwas baue.' :
      'nur noch ein Commit, versprochen.';
  }
  tick();
  setInterval(tick, 15000);
})();

/* ---------- Siegel ---------- */
(function siegel() {
  const knopf = document.querySelector('.siegel');
  if (!knopf) return;
  const hint = document.querySelector('.siegel-hint');
  const saetze = [
    'Präzise gedreht.',
    'Noch eine Runde?',
    'Immer noch präzise.',
    'Das Siegel wird langsam schwindelig.',
    'Tipp: Tipp mal „precision“ auf der Tastatur.',
    'Okay, okay. Präzisionsmodus an.'
  ];
  let klicks = 0;
  knopf.addEventListener('click', () => {
    knopf.classList.remove('spin');
    void knopf.offsetWidth; // Animation neu starten
    knopf.classList.add('spin');
    setTimeout(() => knopf.classList.remove('spin'), 1600);
    himmel.schnuppe();
    hint.textContent = saetze[Math.min(klicks, saetze.length - 1)];
    if (klicks === saetze.length - 1) praezisionUmschalten();
    klicks = klicks >= saetze.length - 1 ? 0 : klicks + 1;
  });
})();

/* ---------- Projekte ---------- */
function hash(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

function normalisiereUrl(url) {
  if (!url) return '#';
  return /^https?:\/\//.test(url) ? url : 'https://' + url;
}

function sternbildZeichnen(container, projekte) {
  const W = 1000, H = 375, rand = 90;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Sternbild meiner Projekte' });
  const n = projekte.length;
  const punkte = projekte.map((p, i) => {
    const x = n === 1 ? W / 2 : rand + (i / (n - 1)) * (W - 2 * rand) + (hash(p.title + 'x') - 0.5) * 60;
    const y = 70 + hash(p.title) * (H - 150);
    return { x, y };
  });

  if (n > 1) {
    const pfad = svgEl('path', {
      class: 'verbindung zeichnen',
      d: punkte.map((pt, i) => `${i ? 'L' : 'M'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
    });
    svg.append(pfad);
    requestAnimationFrame(() => pfad.style.setProperty('--len', pfad.getTotalLength()));
  }

  // Hintergrundsterne im Bild
  for (let i = 0; i < 70; i++) {
    svg.append(svgEl('circle', {
      cx: (hash('s' + i) * W).toFixed(1),
      cy: (hash('t' + i) * H).toFixed(1),
      r: (hash('r' + i) * 1.2 + 0.3).toFixed(2),
      fill: '#e8ecf4',
      opacity: (hash('o' + i) * 0.5 + 0.1).toFixed(2)
    }));
  }

  projekte.forEach((p, i) => {
    const { x, y } = punkte[i];
    const a = svgEl('a', { href: normalisiereUrl(p.url), target: '_blank', rel: 'noopener', 'data-index': i });
    a.append(
      svgEl('circle', { class: 'glanz', cx: x, cy: y, r: 12 }),
      svgEl('circle', { class: 'kern-stern', cx: x, cy: y, r: 4.5 })
    );
    const label = svgEl('text', {
      class: 'name',
      x: x,
      y: y > H / 2 ? y - 22 : y + 32,
      'text-anchor': x < 140 ? 'start' : x > W - 140 ? 'end' : 'middle'
    });
    label.textContent = p.title;
    const titel = svgEl('title');
    titel.textContent = p.title;
    a.append(label, titel);
    svg.append(a);
  });

  container.replaceChildren(svg);
  return svg;
}

function projektZeile(p, i) {
  const bild = p.icon
    ? el('img', { src: p.icon, alt: '', loading: 'lazy', width: 56, height: 56 })
    : el('span', { class: 'monogramm', 'aria-hidden': 'true', text: p.title.charAt(0) });
  const wer = p.owner || 'Niklas Leidert';
  return el('li', { class: 'projekt', 'data-index': i, 'data-suche': `${p.title} ${p.text} ${wer}`.toLowerCase() },
    bild,
    el('div', {},
      el('h3', { text: p.title }),
      el('p', { text: p.text || '' }),
      el('p', { class: 'wer' }, 'Von ', el('span', { text: wer }))
    ),
    el('a', { class: 'btn', href: normalisiereUrl(p.url), target: '_blank', rel: 'noopener', text: 'Ansehen' })
  );
}

function verknuepfen(svg, liste) {
  const setze = (i, an) => {
    svg.querySelector(`a[data-index="${i}"]`)?.classList.toggle('aktiv', an);
    liste.querySelector(`.projekt[data-index="${i}"]`)?.classList.toggle('aktiv', an);
  };
  [...svg.querySelectorAll('a[data-index]'), ...liste.querySelectorAll('.projekt')].forEach(node => {
    const i = node.dataset.index;
    node.addEventListener('mouseenter', () => setze(i, true));
    node.addEventListener('mouseleave', () => setze(i, false));
    node.addEventListener('focusin', () => setze(i, true));
    node.addEventListener('focusout', () => setze(i, false));
  });
}

const SPRACHFARBEN = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  Kotlin: '#A97BFF', 'C#': '#178600', HTML: '#e34c26', CSS: '#663399', Shell: '#89e051',
  PHP: '#4F5D95', Go: '#00ADD8', Rust: '#dea584', QML: '#44a51c', Lua: '#000080'
};

async function reposLaden(ziel, bekannt) {
  try {
    const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=100`);
    if (!res.ok) throw new Error(res.status);
    const repos = (await res.json())
      .filter(r => !r.fork && !r.archived && !bekannt.has(r.html_url.toLowerCase()) && r.name !== `${GITHUB_USER}.github.io` && !REPOS_AUSBLENDEN.includes(r.name))
      .slice(0, 9);
    if (!repos.length) {
      ziel.replaceChildren(el('p', { class: 'muted', text: 'Gerade gibt es keine weiteren öffentlichen Repositories.' }));
      return;
    }
    ziel.replaceChildren(...repos.map(r => el('li', {},
      el('a', { class: 'repo', href: r.html_url, target: '_blank', rel: 'noopener' },
        el('strong', { text: r.name }),
        el('p', { text: r.description || '' }),
        el('span', { class: 'meta' },
          r.language ? el('span', { class: 'sprache', style: `--farbe:${SPRACHFARBEN[r.language] || '#8d98b0'}`, text: r.language }) : null,
          el('span', { text: 'aktualisiert ' + new Date(r.pushed_at).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }) })
        )
      )
    )));
  } catch (_) {
    ziel.replaceChildren(el('p', { class: 'muted' },
      'GitHub hat gerade nicht geantwortet. ',
      el('a', { href: `https://github.com/${GITHUB_USER}?tab=repositories`, target: '_blank', rel: 'noopener', text: 'Alle Repositories direkt ansehen' }),
      '.'));
  }
}

(async function projekte() {
  const liste = document.getElementById('projektliste');
  if (!liste) return;
  const bild = document.getElementById('sternbild');
  const suche = document.getElementById('suche');
  const repoZiel = document.getElementById('repos');

  let daten = [];
  try {
    const res = await fetch('projects.json', { cache: 'no-cache' });
    if (res.ok) daten = await res.json();
  } catch (_) { /* leer lassen */ }

  if (!Array.isArray(daten) || !daten.length) {
    liste.replaceChildren(el('li', { class: 'leer', text: 'Hier erscheinen bald meine Projekte. Bis dahin lohnt sich ein Blick auf GitHub.' }));
    bild.hidden = true;
  } else {
    const svg = sternbildZeichnen(bild, daten);
    liste.replaceChildren(...daten.map(projektZeile));
    verknuepfen(svg, liste);
  }

  const leer = el('li', { class: 'leer', hidden: '', text: 'Kein Projekt passt zu dieser Suche.' });
  liste.append(leer);
  suche?.addEventListener('input', () => {
    const q = suche.value.trim().toLowerCase();
    let treffer = 0;
    liste.querySelectorAll('.projekt').forEach(z => {
      const passt = z.dataset.suche.includes(q);
      z.hidden = !passt;
      if (passt) treffer++;
    });
    leer.hidden = treffer > 0;
  });

  if (repoZiel) {
    const bekannt = new Set(daten.map(p => normalisiereUrl(p.url).toLowerCase().replace(/\/$/, '')));
    reposLaden(repoZiel, bekannt);
  }
})();

/* ---------- Jahr im Footer ---------- */
document.querySelectorAll('[data-jahr]').forEach(n => { n.textContent = new Date().getFullYear(); });
