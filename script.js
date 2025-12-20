// === KONFIGURATION ===
const GITHUB_USERNAME = "nekuro22"; // 👈 ÄNDERN falls nötig
const GITHUB_ORG = "Junior-RoboAg-GHG ";    // 👈 ÄNDERN auf deinen Org-Namen

// === Partikel Hintergrund ===
tsParticles.load({
  id: "tsparticles",
  options: {
    fpsLimit: 60,
    particles: {
      number: { value: 80, density: { enable: true, area: 800 } },
      color: { value: "#007bff" },
      shape: { type: "circle" },
      opacity: { value: 0.5 },
      size: { value: { min: 1, max: 5 } },
      links: {
        enable: true,
        distance: 150,
        color: "#007bff",
        opacity: 0.4,
        width: 1
      },
      move: {
        enable: true,
        speed: 2,
        direction: "none",
        random: false,
        straight: false,
        outModes: { default: "bounce" }
      }
    },
    interactivity: {
      detectsOn: "canvas",
      events: {
        onHover: { enable: true, mode: "grab" },
        onClick: { enable: true, mode: "push" }
      }
    },
    background: { color: "#0f0f14" }
  }
});

// === GitHub API – Repos laden ===
async function fetchRepos(type, targetId) {
  const url =
    type === "user"
      ? `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=8`
      : `https://api.github.com/orgs/${GITHUB_ORG}/repos?sort=updated&per_page=8`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fehler: ${res.status}`);
    const repos = await res.json();

    const container = document.getElementById(targetId);
    container.innerHTML = repos
      .filter(repo => !repo.fork) // Optional: Forks ausblenden
      .map(repo => `
        <div class="repo-card">
          <h3>${repo.name}</h3>
          <p>${repo.description || "Keine Beschreibung verfügbar."}</p>
          <a href="${repo.html_url}" target="_blank" rel="noopener">Zum Repo →</a>
        </div>
      `).join('');
  } catch (err) {
    console.error(err);
    document.getElementById(targetId).innerHTML = `<p style="color:#ff6b6b;">Fehler beim Laden der Repos. Prüfe den Org-Namen oder API-Limit.</p>`;
  }
}

// === Swiper initialisieren ===
const swiper = new Swiper('#repoSwiper', {
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
  loop: false,
  slidesPerView: 1,
  spaceBetween: 30
});

// === Daten laden ===
document.addEventListener('DOMContentLoaded', () => {
  fetchRepos("user", "user-repos");
  fetchRepos("org", "org-repos");
});
