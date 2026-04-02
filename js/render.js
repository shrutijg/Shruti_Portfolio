const CATEGORY_LABEL = {
  professional: "Professional",
  leadership: "Leadership & activities",
  education: "Education",
};

function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function linkifyParagraph(text) {
  const t = esc(text);
  return t.replace(
    /(https?:\/\/[^\s<]+[^\s<.,);!?])/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

export function renderPage(root, data) {
  const { meta, about, experiences, publishedWorks, skillGroups, volunteering } =
    data;

  const byCat = { professional: [], leadership: [], education: [] };
  for (const exp of experiences || []) {
    const c = exp.category in byCat ? exp.category : "professional";
    byCat[c].push(exp);
  }

  const worksHtml = (publishedWorks || [])
    .map(
      (w) => `
    <article class="work-card" data-id="${esc(w.id)}">
      <div class="work-card__top">
        <h3 class="work-card__title">${esc(w.title)}</h3>
        ${(w.url || "").trim() ? `<a class="work-card__link" href="${esc(w.url.trim())}" target="_blank" rel="noopener">View →</a>` : ""}
      </div>
      <p class="work-card__meta">${esc(w.outlet)} · ${esc(w.date)}</p>
      ${w.summary ? `<p class="work-card__summary">${linkifyParagraph(w.summary)}</p>` : ""}
    </article>`
    )
    .join("");

  const expBlock = (title, list) => {
    if (!list.length) return "";
    const cards = list
      .map(
        (e) => `
      <article class="exp-card" data-id="${esc(e.id)}">
        <header class="exp-card__head">
          <div>
            <h3 class="exp-card__role">${esc(e.role)}</h3>
            <p class="exp-card__org">${esc(e.organization)}</p>
          </div>
          <div class="exp-card__aside">
            <span class="exp-card__dates">${esc(e.dates)}</span>
            <span class="exp-card__loc">${esc(e.location)}</span>
          </div>
        </header>
        <ul class="exp-card__bullets">
          ${(e.bullets || []).map((b) => `<li>${linkifyParagraph(b)}</li>`).join("")}
        </ul>
      </article>`
      )
      .join("");
    return `
    <div class="exp-group">
      <h2 class="section-label">${esc(title)}</h2>
      <div class="exp-grid">${cards}</div>
    </div>`;
  };

  const skillsHtml = (skillGroups || [])
    .map(
      (g) => `
    <div class="skill-group">
      <h3 class="skill-group__title">${esc(g.title)}</h3>
      <ul class="skill-pills">
        ${(g.items || []).map((it) => `<li>${esc(it)}</li>`).join("")}
      </ul>
    </div>`
    )
    .join("");

  const volunteerHtml = (volunteering || []).length
    ? `<ul class="volunteer-list">${volunteering
        .map((v) => `<li>${linkifyParagraph(v)}</li>`)
        .join("")}</ul>`
    : "";

  const statsHtml = (about.highlightStats || [])
    .map(
      (s) => `
    <div class="stat">
      <span class="stat__value">${esc(s.value)}</span>
      <span class="stat__label">${esc(s.label)}</span>
    </div>`
    )
    .join("");

  const linkItems = (meta.links || [])
    .filter((l) => l && (l.url || "").trim() && (l.label || "").trim())
    .map(
      (l) =>
        `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`
    )
    .join("");

  const resumeHref = meta.resumeFile
    ? esc(meta.resumeFile)
    : "#";

  root.innerHTML = `
    <header class="hero">
      <div class="hero__inner">
        <p class="hero__eyebrow">Portfolio</p>
        <h1 class="hero__name">${esc(meta.name)}</h1>
        <p class="hero__title">${esc(meta.title)}</p>
        <p class="hero__tagline">${esc(meta.tagline)}</p>
        <div class="hero__stats">${statsHtml}</div>
        <div class="hero__actions">
          <a class="btn btn--primary" href="${resumeHref}" download>Download résumé</a>
          <a class="btn btn--ghost" href="#contact">Contact</a>
        </div>
      </div>
      <div class="hero__accent" aria-hidden="true"></div>
    </header>

    <main class="main" id="main">
      <section class="section section--about" id="about">
        <div class="section__head">
          <h2 class="section-label">About</h2>
        </div>
        <div class="about-grid">
          <div class="about-copy">
            <h3 class="about-headline">${esc(about.headline)}</h3>
            ${(about.paragraphs || [])
              .map((p) => `<p class="about-p">${linkifyParagraph(p)}</p>`)
              .join("")}
          </div>
          <aside class="about-aside">
            ${skillsHtml ? `<div class="skills-block">${skillsHtml}</div>` : ""}
            ${volunteerHtml ? `<div class="volunteer-block"><h3 class="skill-group__title">Volunteering</h3>${volunteerHtml}</div>` : ""}
          </aside>
        </div>
      </section>

      <section class="section section--experience" id="experience">
        <div class="section__head">
          <h2 class="section-label">Experience</h2>
        </div>
        ${expBlock(CATEGORY_LABEL.professional, byCat.professional)}
        ${expBlock(CATEGORY_LABEL.leadership, byCat.leadership)}
        ${expBlock(CATEGORY_LABEL.education, byCat.education)}
      </section>

      <section class="section section--works" id="works">
        <div class="section__head">
          <h2 class="section-label">Published work</h2>
          <p class="section__sub">Articles, essays, and other public writing.</p>
        </div>
        <div class="works-grid">${worksHtml}</div>
      </section>
    </main>

    <footer class="footer" id="contact">
      <div class="footer__inner">
        <div>
          <p class="footer__name">${esc(meta.name)}</p>
          <p class="footer__line">${esc(meta.email)} · ${esc(meta.phone)}</p>
          <p class="footer__line">${esc(meta.location)}</p>
        </div>
        <ul class="footer__links">${linkItems}</ul>
      </div>
      <button type="button" class="footer-edit-hint" id="open-edit-hint" aria-label="Open edit mode">
        Studio
      </button>
    </footer>
  `;
}
