// ========== STERNENGENERATOR ==========
function createStars() {
  if (document.getElementById('stars-container')) return;

  const container = document.createElement('div');
  container.id = 'stars-container';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '200%';
  container.style.height = '200%';
  container.style.zIndex = '-2';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const starCount = 900;
  const stars = [];

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    const size = Math.random() * 2.8 + 0.4;
    star.style.position = 'absolute';
    star.style.background = 'white';
    star.style.borderRadius = '50%';
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 200}%`;
    star.style.top = `${Math.random() * 200}%`;
    star.style.opacity = Math.random() * 0.85 + 0.15;
    star.style.animation = `twinkleAnim ${3 + Math.random() * 7}s infinite alternate`;
    stars.push(star);
  }

  container.append(...stars);

  if (!document.getElementById('star-anim-style')) {
    const style = document.createElement('style');
    style.id = 'star-anim-style';
    style.textContent = `
      @keyframes twinkleAnim {
        0% { opacity: 0.2; transform: scale(1); }
        100% { opacity: 1; transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);
  }
}

// ========== WARTUNGSMODUS + PROJEKTE ==========
(async function () {
  let maintenanceActive = false;
  // GitHub Pages liefert /maintenance.html unter /maintenance aus, beides zählt
  const onMaintenance = /\/maintenance(\.html)?\/?$/.test(window.location.pathname);

  try {
    const response = await fetch('options.json', {
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (response.ok) {
      const options = await response.json();
      maintenanceActive = options.maintenance_mode === true;
    }
  } catch (e) {
    maintenanceActive = false;
  }

  if (maintenanceActive && !onMaintenance) {
    window.location.replace('maintenance.html');
    return;
  }

  if (!onMaintenance) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createStars);
    } else {
      createStars();
    }
  }

  // Projekte laden – MIT OWNER
  if (document.getElementById('projects-list')) {
    fetch('projects.json')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const container = document.getElementById('projects-list');
          container.innerHTML = '';
          container.classList.remove('projects-grid');
          const list = document.createElement('ul');
          list.className = 'plist';
          const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
          data.forEach(project => {
            const owner = project.owner || 'Niklas Leidert';
            const ext = /^https?:/.test(project.url);
            const icon = project.icon ? `<img src="${esc(project.icon)}" alt="" width="48" height="48">` : `<span class="noicon" aria-hidden="true">${esc(project.title.charAt(0))}</span>`;
            const li = document.createElement('li');
            li.innerHTML = `
              ${icon}
              <div>
                <h2>${esc(project.title)}</h2>
                <p>${esc(project.text)}</p>
                <p class="owner">Von ${esc(owner)}</p>
              </div>
              <a class="go" href="${esc(project.url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>Zum Projekt</a>`;
            list.appendChild(li);
          });
          container.appendChild(list);
        }
      })
      .catch(() => { });
  }
})();