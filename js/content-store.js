const STORAGE_KEY = "shruti_portfolio_content_v1";
const EDIT_SESSION_KEY = "shruti_portfolio_edit_session";

/** Hash of edit password — do not commit the plain password in this file. */
const EDIT_PASSWORD_HASH =
  "34983188c4fe042f241fceba2f2547159748021128665ce21a469bae83b2ea99";

export async function fetchBaseContent() {
  const url = new URL("../data/content.json", import.meta.url);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load content.json");
  return res.json();
}

export function loadStoredOverride() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveFullContent(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearStoredContent() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isEditSessionActive() {
  return sessionStorage.getItem(EDIT_SESSION_KEY) === "1";
}

export function setEditSession(active) {
  if (active) sessionStorage.setItem(EDIT_SESSION_KEY, "1");
  else sessionStorage.removeItem(EDIT_SESSION_KEY);
}

export function getEditPasswordHash() {
  return EDIT_PASSWORD_HASH;
}

export { STORAGE_KEY, EDIT_SESSION_KEY };
