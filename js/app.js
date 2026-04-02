import {
  fetchBaseContent,
  loadStoredOverride,
  isEditSessionActive,
} from "./content-store.js";
import { renderPage } from "./render.js";
import { initEditor } from "./editor.js";

const root = document.getElementById("app");

let currentContent = null;

function rerender() {
  renderPage(root, currentContent);
  if (window.__portfolioEditor) window.__portfolioEditor.afterRender();
}

async function init() {
  try {
    const base = await fetchBaseContent();
    const stored = loadStoredOverride();
    currentContent = stored ?? base;
  } catch (e) {
    root.innerHTML = `<p class="error-banner">Could not load portfolio data. Serve this site from a local server (not file://) or check that data/content.json exists.</p>`;
    console.error(e);
    return;
  }

  const editor = initEditor(
    () => currentContent,
    (c) => {
      currentContent = c;
    },
    root,
    rerender
  );
  window.__portfolioEditor = editor;

  rerender();

  if (isEditSessionActive()) {
    editor.afterRender();
  }
}

init();
