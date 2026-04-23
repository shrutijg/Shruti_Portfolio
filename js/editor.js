import { sha256Hex } from "./crypto-utils.js";
import {
  getEditPasswordHash,
  isEditSessionActive,
  setEditSession,
  saveFullContent,
  clearStoredContent,
} from "./content-store.js";
import { renderPage } from "./render.js";

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function initEditor(getContent, setContent, rootEl, rerender) {
  const hintBtn = () => document.getElementById("open-edit-hint");
  let panelEl = null;
  let overlayEl = null;
  let modalEl = null;

  function ensureShell() {
    if (modalEl) return;
    modalEl = document.createElement("div");
    modalEl.className = "modal";
    modalEl.setAttribute("hidden", "");
    modalEl.innerHTML = `
      <div class="modal__backdrop" data-close></div>
      <div class="modal__card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" class="modal__title">Edit mode</h2>
        <p class="modal__text">Enter the portfolio password to add or change content on this device.</p>
        <label class="modal__label">Password
          <input type="password" class="modal__input" id="edit-password-input" autocomplete="current-password" />
        </label>
        <p class="modal__error" id="edit-password-error" hidden>That password did not match.</p>
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" data-close>Cancel</button>
          <button type="button" class="btn btn--primary" id="edit-password-submit">Unlock</button>
        </div>
      </div>`;
    document.body.appendChild(modalEl);

    modalEl.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]")) closeModal();
    });
    modalEl.querySelector("#edit-password-submit").addEventListener("click", onUnlock);
    modalEl
      .querySelector("#edit-password-input")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter") onUnlock();
      });
  }

  function openModal() {
    ensureShell();
    modalEl.removeAttribute("hidden");
    const input = modalEl.querySelector("#edit-password-input");
    input.value = "";
    modalEl.querySelector("#edit-password-error").hidden = true;
    input.focus();
  }

  function closeModal() {
    if (modalEl) modalEl.setAttribute("hidden", "");
  }

  async function onUnlock() {
    const input = modalEl.querySelector("#edit-password-input");
    const err = modalEl.querySelector("#edit-password-error");
    const hash = await sha256Hex(input.value.trim());
    if (hash !== getEditPasswordHash()) {
      err.hidden = false;
      return;
    }
    err.hidden = true;
    setEditSession(true);
    closeModal();
    openPanel();
  }

  function showEditChrome() {
    if (overlayEl) overlayEl.removeAttribute("hidden");
    if (panelEl) panelEl.removeAttribute("hidden");
  }

  function openPanel() {
    if (panelEl) {
      showEditChrome();
      syncFormFromState();
      return;
    }
    panelEl = document.createElement("aside");
    panelEl.className = "edit-panel";
    panelEl.innerHTML = `
      <div class="edit-panel__bar">
        <span class="edit-panel__badge">Edit mode</span>
        <div class="edit-panel__bar-actions">
          <button type="button" class="btn btn--sm btn--ghost" id="edit-save">Save</button>
          <button type="button" class="btn btn--sm btn--primary" id="edit-export">Export JSON</button>
          <label class="btn btn--sm btn--ghost edit-import-label">Import
            <input type="file" id="edit-import" accept="application/json" hidden />
          </label>
          <button type="button" class="btn btn--sm btn--ghost" id="edit-reset">Reset site default</button>
          <button type="button" class="btn btn--sm btn--ghost" id="edit-done">Done</button>
        </div>
      </div>
      <div class="edit-panel__help">
        <strong>Maintaining your portfolio:</strong> Click <em>Save</em> to keep changes in this browser.
        Use <em>Export JSON</em> to download a backup or send updates to whoever publishes your site—replace the file <code>data/content.json</code> with your export, then refresh.
      </div>
      <div class="edit-tabs" role="tablist">
        <button type="button" class="edit-tab is-active" data-tab="about" role="tab" aria-selected="true">About</button>
        <button type="button" class="edit-tab" data-tab="profile" role="tab">Profile & contact</button>
        <button type="button" class="edit-tab" data-tab="experience" role="tab">Experience</button>
        <button type="button" class="edit-tab" data-tab="works" role="tab">Published work</button>
        <button type="button" class="edit-tab" data-tab="skills" role="tab">Skills & volunteer</button>
      </div>
      <div class="edit-panels">
        <div class="edit-panel-page is-active" data-page="about">
          <label>Headline
            <input type="text" id="fld-about-headline" class="edit-input" />
          </label>
          <label>About paragraphs (separate with a blank line)
            <textarea id="fld-about-paras" class="edit-textarea" rows="8"></textarea>
          </label>
          <div class="edit-subblock">
            <h4>Highlight stats</h4>
            <div id="fld-stats-rows"></div>
            <button type="button" class="btn btn--sm btn--ghost" id="add-stat">Add stat</button>
          </div>
        </div>
        <div class="edit-panel-page" data-page="profile">
          <label>Name <input type="text" id="fld-meta-name" class="edit-input" /></label>
          <label>Title line <input type="text" id="fld-meta-title" class="edit-input" /></label>
          <label>Tagline <input type="text" id="fld-meta-tagline" class="edit-input" /></label>
          <label>Email <input type="text" id="fld-meta-email" class="edit-input" /></label>
          <label>Phone <input type="text" id="fld-meta-phone" class="edit-input" /></label>
          <label>Location <input type="text" id="fld-meta-location" class="edit-input" /></label>
          <label>Résumé file name <input type="text" id="fld-meta-resume" class="edit-input" placeholder="Garapati_Shruti_Resume_2.pdf" /></label>
          <div class="edit-subblock">
            <h4>Links</h4>
            <div id="fld-links-rows"></div>
            <button type="button" class="btn btn--sm btn--ghost" id="add-link">Add link</button>
          </div>
        </div>
        <div class="edit-panel-page" data-page="experience">
          <p class="edit-hint">Use bullet lines starting with “- ” or “• ” — one bullet per line.</p>
          <div id="fld-exp-rows"></div>
          <button type="button" class="btn btn--sm btn--ghost" id="add-exp">Add experience</button>
        </div>
        <div class="edit-panel-page" data-page="works">
          <div id="fld-work-rows"></div>
          <button type="button" class="btn btn--sm btn--ghost" id="add-work">Add published work</button>
        </div>
        <div class="edit-panel-page" data-page="skills">
          <label>Skill groups (use <strong>Group name: item1, item2</strong> — one group per line)
            <textarea id="fld-skill-groups" class="edit-textarea" rows="8"></textarea>
          </label>
          <label>Volunteering (one line each)
            <textarea id="fld-volunteer" class="edit-textarea" rows="6"></textarea>
          </label>
        </div>
      </div>`;
    overlayEl = document.createElement("div");
    overlayEl.className = "edit-overlay";
    document.body.appendChild(overlayEl);

    document.body.appendChild(panelEl);
    showEditChrome();

    panelEl.querySelectorAll(".edit-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const name = tab.getAttribute("data-tab");
        panelEl.querySelectorAll(".edit-tab").forEach((t) => {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });
        panelEl.querySelectorAll(".edit-panel-page").forEach((p) => {
          p.classList.toggle("is-active", p.getAttribute("data-page") === name);
        });
      });
    });

    panelEl.querySelector("#edit-save").addEventListener("click", () => {
      readFormToState();
      saveFullContent(getContent());
      rerender();
    });
    panelEl.querySelector("#edit-export").addEventListener("click", () => {
      readFormToState();
      const blob = new Blob([JSON.stringify(getContent(), null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "content.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    panelEl.querySelector("#edit-import").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.meta || !data.about) throw new Error("Invalid file");
        setContent(data);
        saveFullContent(data);
        rerender();
        syncFormFromState();
      } catch {
        alert("Could not import that file. Use a portfolio JSON export.");
      }
      e.target.value = "";
    });
    panelEl.querySelector("#edit-reset").addEventListener("click", () => {
      if (!confirm("Remove all saved edits in this browser? The site will reload defaults from data/content.json."))
        return;
      clearStoredContent();
      setEditSession(false);
      window.location.reload();
    });
    panelEl.querySelector("#edit-done").addEventListener("click", () => {
      readFormToState();
      saveFullContent(getContent());
      setEditSession(false);
      if (panelEl) panelEl.setAttribute("hidden", "");
      if (overlayEl) overlayEl.setAttribute("hidden", "");
      rerender();
    });

    panelEl.querySelector("#add-stat").addEventListener("click", addStatRow);
    panelEl.querySelector("#add-link").addEventListener("click", addLinkRow);
    panelEl.querySelector("#add-exp").addEventListener("click", () =>
      addExpRow(emptyExperience())
    );
    panelEl.querySelector("#add-work").addEventListener("click", () =>
      addWorkRow(emptyWork())
    );

    syncFormFromState();
  }

  function emptyExperience() {
    return {
      id: uid("exp"),
      category: "professional",
      organization: "",
      location: "",
      role: "",
      dates: "",
      bullets: [""],
    };
  }

  function emptyWork() {
    return {
      id: uid("work"),
      title: "",
      outlet: "",
      date: "",
      url: "",
      summary: "",
    };
  }

  function syncFormFromState() {
    const c = getContent();
    const m = c.meta || {};
    const a = c.about || {};

    panelEl.querySelector("#fld-about-headline").value = a.headline || "";
    panelEl.querySelector("#fld-about-paras").value = (a.paragraphs || []).join(
      "\n\n"
    );
    panelEl.querySelector("#fld-meta-name").value = m.name || "";
    panelEl.querySelector("#fld-meta-title").value = m.title || "";
    panelEl.querySelector("#fld-meta-tagline").value = m.tagline || "";
    panelEl.querySelector("#fld-meta-email").value = m.email || "";
    panelEl.querySelector("#fld-meta-phone").value = m.phone || "";
    panelEl.querySelector("#fld-meta-location").value = m.location || "";
    panelEl.querySelector("#fld-meta-resume").value = m.resumeFile || "";

    const statsHost = panelEl.querySelector("#fld-stats-rows");
    statsHost.innerHTML = "";
    (a.highlightStats || []).forEach((s) => addStatRow(s.label, s.value));

    const linksHost = panelEl.querySelector("#fld-links-rows");
    linksHost.innerHTML = "";
    (m.links || []).forEach((l) => addLinkRow(l.label, l.url));

    const expHost = panelEl.querySelector("#fld-exp-rows");
    expHost.innerHTML = "";
    (c.experiences || []).forEach((e) => addExpRow(e));

    const workHost = panelEl.querySelector("#fld-work-rows");
    workHost.innerHTML = "";
    (c.publishedWorks || []).forEach((w) => addWorkRow(w));

    const sgLines = (c.skillGroups || []).map(
      (g) => `${g.title}: ${(g.items || []).join(", ")}`
    );
    panelEl.querySelector("#fld-skill-groups").value = sgLines.join("\n");
    panelEl.querySelector("#fld-volunteer").value = (c.volunteering || []).join(
      "\n"
    );
  }

  function addStatRow(label = "", value = "") {
    const host = panelEl.querySelector("#fld-stats-rows");
    const row = document.createElement("div");
    row.className = "edit-row";
    row.innerHTML = `
      <input type="text" class="edit-input edit-stat-label" placeholder="Label" value="${label.replace(/"/g, "&quot;")}" />
      <input type="text" class="edit-input edit-stat-value" placeholder="Value" value="${value.replace(/"/g, "&quot;")}" />
      <button type="button" class="btn btn--sm btn--ghost edit-remove" title="Remove">×</button>`;
    row.querySelector(".edit-remove").addEventListener("click", () => row.remove());
    host.appendChild(row);
  }

  function addLinkRow(label = "", url = "") {
    const host = panelEl.querySelector("#fld-links-rows");
    const row = document.createElement("div");
    row.className = "edit-row";
    row.innerHTML = `
      <input type="text" class="edit-input edit-link-label" placeholder="Label" value="${label.replace(/"/g, "&quot;")}" />
      <input type="text" class="edit-input edit-link-url" placeholder="https://" value="${url.replace(/"/g, "&quot;")}" />
      <button type="button" class="btn btn--sm btn--ghost edit-remove" title="Remove">×</button>`;
    row.querySelector(".edit-remove").addEventListener("click", () => row.remove());
    host.appendChild(row);
  }

  function addExpRow(e) {
    const host = panelEl.querySelector("#fld-exp-rows");
    const row = document.createElement("div");
    row.className = "edit-card";
    row.dataset.expId = e.id;
    const bulletsText = (e.bullets || []).join("\n");
    row.innerHTML = `
      <div class="edit-card__head">
        <select class="edit-input edit-exp-cat">
          <option value="professional">Professional</option>
          <option value="leadership">Leadership / activities</option>
          <option value="education">Education</option>
        </select>
        <button type="button" class="btn btn--sm btn--ghost edit-remove-card">Remove card</button>
      </div>
      <label>Organization <input type="text" class="edit-input edit-exp-org" value="${(e.organization || "").replace(/"/g, "&quot;")}" /></label>
      <label>Role / degree line <input type="text" class="edit-input edit-exp-role" value="${(e.role || "").replace(/"/g, "&quot;")}" /></label>
      <div class="edit-row">
        <label class="flex-1">Location <input type="text" class="edit-input edit-exp-loc" value="${(e.location || "").replace(/"/g, "&quot;")}" /></label>
        <label class="flex-1">Dates <input type="text" class="edit-input edit-exp-dates" value="${(e.dates || "").replace(/"/g, "&quot;")}" /></label>
      </div>
      <label>Bullets (one per line)
        <textarea class="edit-textarea edit-exp-bullets" rows="5">${bulletsText.replace(/</g, "&lt;")}</textarea>
      </label>`;
    row.querySelector(".edit-exp-cat").value = e.category || "professional";
    row.querySelector(".edit-remove-card").addEventListener("click", () =>
      row.remove()
    );
    host.appendChild(row);
  }

  function addWorkRow(w) {
    const host = panelEl.querySelector("#fld-work-rows");
    const row = document.createElement("div");
    row.className = "edit-card";
    row.dataset.workId = w.id;
    row.innerHTML = `
      <div class="edit-card__head">
        <span class="edit-card__title-sm">Published item</span>
        <button type="button" class="btn btn--sm btn--ghost edit-remove-card">Remove</button>
      </div>
      <label>Title <input type="text" class="edit-input edit-work-title" value="${(w.title || "").replace(/"/g, "&quot;")}" /></label>
      <label>Outlet <input type="text" class="edit-input edit-work-outlet" value="${(w.outlet || "").replace(/"/g, "&quot;")}" /></label>
      <div class="edit-row">
        <label class="flex-1">Date <input type="text" class="edit-input edit-work-date" value="${(w.date || "").replace(/"/g, "&quot;")}" /></label>
        <label class="flex-1">URL (optional) <input type="text" class="edit-input edit-work-url" value="${(w.url || "").replace(/"/g, "&quot;")}" /></label>
      </div>
      <label>Summary
        <textarea class="edit-textarea edit-work-summary" rows="3">${(w.summary || "").replace(/</g, "&lt;")}</textarea>
      </label>`;
    row.querySelector(".edit-remove-card").addEventListener("click", () =>
      row.remove()
    );
    host.appendChild(row);
  }

  function parseBullets(text) {
    return text
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*[-•]\s*/, "").trim())
      .filter(Boolean);
  }

  function readFormToState() {
    const c = clone(getContent());
    c.about = c.about || {};
    c.meta = c.meta || {};

    c.about.headline = panelEl.querySelector("#fld-about-headline").value.trim();
    c.about.paragraphs = panelEl
      .querySelector("#fld-about-paras")
      .value.split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    c.about.highlightStats = [];
    panelEl.querySelectorAll("#fld-stats-rows .edit-row").forEach((row) => {
      const label = row.querySelector(".edit-stat-label").value.trim();
      const value = row.querySelector(".edit-stat-value").value.trim();
      if (label || value) c.about.highlightStats.push({ label, value });
    });

    c.meta.name = panelEl.querySelector("#fld-meta-name").value.trim();
    c.meta.title = panelEl.querySelector("#fld-meta-title").value.trim();
    c.meta.tagline = panelEl.querySelector("#fld-meta-tagline").value.trim();
    c.meta.email = panelEl.querySelector("#fld-meta-email").value.trim();
    c.meta.phone = panelEl.querySelector("#fld-meta-phone").value.trim();
    c.meta.location = panelEl.querySelector("#fld-meta-location").value.trim();
    c.meta.resumeFile = panelEl.querySelector("#fld-meta-resume").value.trim();

    c.meta.links = [];
    panelEl.querySelectorAll("#fld-links-rows .edit-row").forEach((row) => {
      const label = row.querySelector(".edit-link-label").value.trim();
      const url = row.querySelector(".edit-link-url").value.trim();
      if (label || url) c.meta.links.push({ label, url });
    });

    c.experiences = [];
    panelEl.querySelectorAll("#fld-exp-rows .edit-card").forEach((row) => {
      c.experiences.push({
        id: row.dataset.expId || uid("exp"),
        category: row.querySelector(".edit-exp-cat").value,
        organization: row.querySelector(".edit-exp-org").value.trim(),
        role: row.querySelector(".edit-exp-role").value.trim(),
        location: row.querySelector(".edit-exp-loc").value.trim(),
        dates: row.querySelector(".edit-exp-dates").value.trim(),
        bullets: parseBullets(
          row.querySelector(".edit-exp-bullets").value
        ),
      });
    });

    c.publishedWorks = [];
    panelEl.querySelectorAll("#fld-work-rows .edit-card").forEach((row) => {
      c.publishedWorks.push({
        id: row.dataset.workId || uid("work"),
        title: row.querySelector(".edit-work-title").value.trim(),
        outlet: row.querySelector(".edit-work-outlet").value.trim(),
        date: row.querySelector(".edit-work-date").value.trim(),
        url: row.querySelector(".edit-work-url").value.trim(),
        summary: row.querySelector(".edit-work-summary").value.trim(),
      });
    });

    const sgRaw = panelEl.querySelector("#fld-skill-groups").value.split(/\n/);
    c.skillGroups = [];
    for (const line of sgRaw) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf(":");
      if (idx === -1) {
        c.skillGroups.push({ title: trimmed, items: [] });
        continue;
      }
      const title = trimmed.slice(0, idx).trim();
      const items = trimmed
        .slice(idx + 1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      c.skillGroups.push({ title, items });
    }

    c.volunteering = panelEl
      .querySelector("#fld-volunteer")
      .value.split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    c.version = 1;
    setContent(c);
  }

  function wireHint() {
    const el = hintBtn();
    if (el && !el.dataset.wired) {
      el.dataset.wired = "1";
      el.addEventListener("click", () => {
        if (isEditSessionActive()) {
          openPanel();
          if (overlayEl) overlayEl.removeAttribute("hidden");
          panelEl.removeAttribute("hidden");
        } else openModal();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {});
  const obs = new MutationObserver(wireHint);
  obs.observe(rootEl, { childList: true, subtree: true });
  wireHint();

  if (isEditSessionActive()) {
    openPanel();
  }

  return {
    afterRender() {
      wireHint();
      if (isEditSessionActive() && panelEl) {
        panelEl.removeAttribute("hidden");
        if (overlayEl) overlayEl.removeAttribute("hidden");
        syncFormFromState();
      }
    },
  };
}
