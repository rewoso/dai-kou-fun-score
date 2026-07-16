const STORAGE_KEYS = {
  records: "djmax_records_v1",
  catalog: "djmax_catalog_v1"
};

const DEFAULT_CATALOG = {
  users: ["PLAYER-1"],
  songs: ["glory day"],
  buttons: ["4B", "5B", "6B", "8B"],
  difficulties: ["NORMAL", "HARD", "MAXIMUM", "SC"]
};

const PASSWORD_HASHES = {
  user: "08db71e696ce9e2d944639445ecbf0dd9930d9e3d8b8f1cea83d99fcde49fedd",
  admin: "9ff93f7009c823d174bed269b6ff4aefebe702e73f114348cefeb28d05120e08"
};

const REMOTE_CONFIG = {
  // Google Apps Script Web App URL. Empty string keeps local-only mode.
  apiUrl: "",
  readToken: "djmax-read-token",
  writeToken: "djmax-write-token",
  timeoutMs: 10000
};

if (window.DJMAX_REMOTE_CONFIG && typeof window.DJMAX_REMOTE_CONFIG === "object") {
  const override = window.DJMAX_REMOTE_CONFIG;
  if (typeof override.apiUrl === "string") {
    REMOTE_CONFIG.apiUrl = override.apiUrl;
  }
  if (typeof override.readToken === "string") {
    REMOTE_CONFIG.readToken = override.readToken;
  }
  if (typeof override.writeToken === "string") {
    REMOTE_CONFIG.writeToken = override.writeToken;
  }
  if (Number.isFinite(override.timeoutMs) && override.timeoutMs > 0) {
    REMOTE_CONFIG.timeoutMs = Number(override.timeoutMs);
  }
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeCatalog(catalog) {
  const source = catalog && typeof catalog === "object" ? catalog : {};
  return {
    users: Array.isArray(source.users) && source.users.length > 0 ? source.users : [...DEFAULT_CATALOG.users],
    songs: Array.isArray(source.songs) && source.songs.length > 0 ? source.songs : [...DEFAULT_CATALOG.songs],
    buttons: Array.isArray(source.buttons) && source.buttons.length > 0 ? source.buttons : [...DEFAULT_CATALOG.buttons],
    difficulties: Array.isArray(source.difficulties) && source.difficulties.length > 0 ? source.difficulties : [...DEFAULT_CATALOG.difficulties]
  };
}

function loadCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.catalog);
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeCatalog(parsed);
  } catch {
    return normalizeCatalog(null);
  }
}

function saveCatalog(catalog) {
  localStorage.setItem(STORAGE_KEYS.catalog, JSON.stringify(normalizeCatalog(catalog)));
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.records);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
}

function normalizeRecords(records) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .filter((record) => record && typeof record === "object")
    .map((record) => ({
      id: record.id || crypto.randomUUID(),
      user: String(record.user || ""),
      song: String(record.song || ""),
      button: String(record.button || ""),
      difficulty: String(record.difficulty || ""),
      score: Number(record.score) || 0,
      createdAt: record.createdAt || new Date().toISOString()
    }))
    .filter((record) => record.user && record.song && record.button && record.difficulty);
}

function normalizeState(state) {
  const source = state && typeof state === "object" ? state : {};
  return {
    catalog: normalizeCatalog(source.catalog),
    records: normalizeRecords(source.records)
  };
}

function buildState(catalog, records) {
  return normalizeState({ catalog, records });
}

function isRemoteEnabled() {
  return Boolean(REMOTE_CONFIG.apiUrl && REMOTE_CONFIG.apiUrl.trim());
}

async function remoteFetchJson(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_CONFIG.timeoutMs);

  try {
    const response = await fetch(REMOTE_CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadSharedState() {
  const localState = buildState(loadCatalog(), loadRecords());

  if (!isRemoteEnabled()) {
    return { ...localState, source: "local" };
  }

  try {
    const result = await remoteFetchJson({
      action: "getState",
      token: REMOTE_CONFIG.readToken
    });

    if (!result || result.ok !== true) {
      throw new Error(result?.error || "remote fetch failed");
    }

    const state = normalizeState(result.state);
    saveCatalog(state.catalog);
    saveRecords(state.records);
    return { ...state, source: "remote" };
  } catch {
    return { ...localState, source: "local-fallback" };
  }
}

async function saveSharedState(catalog, records) {
  const next = buildState(catalog, records);
  saveCatalog(next.catalog);
  saveRecords(next.records);

  if (!isRemoteEnabled()) {
    return { ok: true, source: "local" };
  }

  try {
    const result = await remoteFetchJson({
      action: "setState",
      token: REMOTE_CONFIG.writeToken,
      state: next
    });

    if (!result || result.ok !== true) {
      throw new Error(result?.error || "remote save failed");
    }

    return { ok: true, source: "remote" };
  } catch (error) {
    return {
      ok: false,
      source: "local-only",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function pickPagePasswordKey() {
  const page = document.body?.dataset.page;
  return page === "admin" ? "admin" : "user";
}

function getAuthSessionKey() {
  const type = pickPagePasswordKey();
  return `djmax_auth_${type}`;
}

function lockPage() {
  const overlay = document.getElementById("auth-overlay");
  if (overlay) {
    overlay.style.display = "grid";
  }
}

function unlockPage() {
  const overlay = document.getElementById("auth-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

async function initPasswordGate() {
  const form = document.getElementById("auth-form");
  const input = document.getElementById("auth-password");
  const error = document.getElementById("auth-error");

  if (!form || !input || !error) {
    return true;
  }

  const sessionKey = getAuthSessionKey();
  if (sessionStorage.getItem(sessionKey) === "ok") {
    unlockPage();
    return true;
  }

  lockPage();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";

    const inputHash = await sha256Hex(input.value);
    const expectedHash = PASSWORD_HASHES[pickPagePasswordKey()];

    if (inputHash === expectedHash) {
      sessionStorage.setItem(sessionKey, "ok");
      input.value = "";
      unlockPage();
      return;
    }

    error.textContent = "パスワードが違います。";
  });

  return false;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), "ja"));
}
