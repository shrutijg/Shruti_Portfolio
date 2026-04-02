import {
  fetchBaseContent,
  loadStoredOverride,
  isEditSessionActive,
} from "./content-store.js";
import { renderPage } from "./render.js";
import { initEditor } from "./editor.js";

const root = document.getElementById("app");

let currentContent = null;

function isValidPortfolioData(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    obj.meta &&
    typeof obj.meta === "object" &&
    obj.about &&
    typeof obj.about === "object" &&
    Array.isArray(obj.experiences)
  );
}

function rerender() {
  if (!root) return;
  try {
    renderPage(root, currentContent);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<p class="error-banner">Could not render the page. Open Edit → Reset site default, or clear site data for this URL. <small>${String(
      e.message || e
    )}</small></p>`;
    return;
  }
  if (window.__portfolioEditor) window.__portfolioEditor.afterRender();
}

async function init() {
  if (!root) {
    console.error("Missing #app container");
    return;
  }
  try {
    const base = await fetchBaseContent();
    if (!isValidPortfolioData(base)) {
      throw new Error("content.json is missing required fields (meta, about, experiences).");
    }
    const stored = loadStoredOverride();
    currentContent = isValidPortfolioData(stored) ? stored : base;
  } catch (e) {
    root.innerHTML = `<p class="error-banner">Could not load portfolio data. If you use Vercel, set the project <strong>Root Directory</strong> to the folder that contains <code>index.html</code>, and ensure <code>data/content.json</code> is committed. <small>${String(
      e.message || e
    )}</small></p>`;
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
