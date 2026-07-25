const STORAGE_KEYS = {
  records: "djmax_records_v1",
  catalog: "djmax_catalog_v1",
  ocrLayout: "djmax_ocr_layout_v1"
};

const DEFAULT_CATALOG = {
  users: ["PLAYER-1"],
  songs: [
    {
      name: "glory day",
      difficulties: ["NORMAL", "HARD", "MAXIMUM"],
      difficultiesByButton: {
        "4B": ["NORMAL", "HARD", "MAXIMUM"],
        "5B": ["NORMAL", "HARD", "MAXIMUM"],
        "6B": ["NORMAL", "HARD", "MAXIMUM"],
        "8B": ["NORMAL", "HARD", "MAXIMUM"]
      }
    },
    {
      name: "OBLIVION",
      difficulties: ["NORMAL", "HARD", "MAXIMUM", "SC"],
      difficultiesByButton: {
        "4B": ["NORMAL", "HARD", "MAXIMUM", "SC"],
        "5B": ["NORMAL", "HARD", "MAXIMUM", "SC"],
        "6B": ["NORMAL", "HARD", "MAXIMUM", "SC"],
        "8B": ["NORMAL", "HARD", "MAXIMUM", "SC"]
      }
    },
    {
      name: "Ask to Wind",
      difficulties: ["NORMAL", "HARD"],
      difficultiesByButton: {
        "4B": ["NORMAL", "HARD"],
        "5B": ["NORMAL", "HARD"],
        "6B": ["NORMAL", "HARD"],
        "8B": ["NORMAL", "HARD"]
      }
    }
  ],
  buttons: ["4B", "5B", "6B", "8B"],
  difficulties: ["NORMAL", "HARD", "MAXIMUM", "SC"]
};

const PASSWORD_HASHES = {
  user: "fc1f09ab08ebdd072ea6da53a5691abcc18c9163b1be1f0921a5adb50e3f5077",
  admin: "9ff93f7009c823d174bed269b6ff4aefebe702e73f114348cefeb28d05120e08"
};

const DIFFICULTY_ORDER = ["NORMAL", "HARD", "MAXIMUM", "SC"];

const OCR_REGION_KEYS = ["button", "song", "difficulty", "score"];

const DEFAULT_OCR_LAYOUT_CONFIG = {
  activePresetId: "default-16-9",
  presets: [
    {
      id: "default-16-9",
      label: "Default 16:9",
      aspectRatio: 16 / 9,
      regions: {
        button: { x: 0.01, y: 0.01, w: 0.24, h: 0.16 },
        song: { x: 0.32, y: 0.0, w: 0.48, h: 0.14 },
        difficulty: { x: 0.37, y: 0.03, w: 0.16, h: 0.12 },
        score: { x: 0.35, y: 0.58, w: 0.32, h: 0.23 }
      }
    }
  ]
};

const REMOTE_CONFIG = {
  // Google Apps Script Web App URL. Empty string keeps local-only mode.
  apiUrl: "",
  readToken: "djmax-read-token",
  writeToken: "djmax-write-token",
  // "state": use catalog from shared state file, "drive-file": use separate song catalog JSON.
  catalogMode: "drive-file",
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
  if (override.catalogMode === "state" || override.catalogMode === "drive-file") {
    REMOTE_CONFIG.catalogMode = override.catalogMode;
  }
  if (Number.isFinite(override.timeoutMs) && override.timeoutMs > 0) {
    REMOTE_CONFIG.timeoutMs = Number(override.timeoutMs);
  }
}

function pickSongCatalog(catalog) {
  const normalized = normalizeCatalog(catalog);
  return {
    songs: normalized.songs,
    buttons: normalized.buttons,
    difficulties: normalized.difficulties
  };
}

function mergeCatalogWithSongCatalog(baseCatalog, songCatalog) {
  const base = normalizeCatalog(baseCatalog);
  const songsOnly = songCatalog && typeof songCatalog === "object"
    ? {
      songs: songCatalog.songs,
      buttons: songCatalog.buttons,
      difficulties: songCatalog.difficulties
    }
    : {};

  return normalizeCatalog({
    ...base,
    ...songsOnly,
    users: base.users
  });
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeCatalog(catalog) {
  const source = catalog && typeof catalog === "object" ? catalog : {};
  const buttons = Array.isArray(source.buttons) && source.buttons.length > 0
    ? uniqueSorted(source.buttons)
    : [...DEFAULT_CATALOG.buttons];

  const difficulties = Array.isArray(source.difficulties) && source.difficulties.length > 0
    ? sortDifficulties(source.difficulties)
    : [...DEFAULT_CATALOG.difficulties];

  const rawSongs = Array.isArray(source.songs) && source.songs.length > 0
    ? source.songs
    : [...DEFAULT_CATALOG.songs];

  const songs = rawSongs
    .map((song) => {
      if (typeof song === "string") {
        const difficultiesByButton = Object.fromEntries(
          buttons.map((button) => [button, [...difficulties]])
        );

        return {
          name: song,
          difficulties: [...difficulties],
          difficultiesByButton
        };
      }

      if (song && typeof song === "object" && song.name) {
        const diffs = Array.isArray(song.difficulties) && song.difficulties.length > 0
          ? sortDifficulties(song.difficulties)
          : [...difficulties];

        const incomingByButton = song.difficultiesByButton && typeof song.difficultiesByButton === "object"
          ? song.difficultiesByButton
          : {};

        const normalizedByButton = Object.fromEntries(
          buttons.map((button) => {
            const buttonDiffs = Array.isArray(incomingByButton[button]) && incomingByButton[button].length > 0
              ? sortDifficulties(incomingByButton[button])
              : [...diffs];
            return [button, buttonDiffs];
          })
        );

        const mergedDiffs = uniqueSorted(
          buttons.flatMap((button) => normalizedByButton[button] || [])
        );

        return {
          name: String(song.name),
          difficulties: mergedDiffs.length > 0 ? mergedDiffs : diffs,
          difficultiesByButton: normalizedByButton
        };
      }

      return null;
    })
    .filter((song) => song && song.name);

  const uniqueSongsMap = new Map();
  for (const song of songs) {
    const existing = uniqueSongsMap.get(song.name);
    if (!existing) {
      uniqueSongsMap.set(song.name, song);
      continue;
    }

    uniqueSongsMap.set(song.name, {
      name: song.name,
      difficulties: sortDifficulties([...(existing.difficulties || []), ...(song.difficulties || [])]),
      difficultiesByButton: Object.fromEntries(
        buttons.map((button) => [
          button,
          sortDifficulties([
            ...((existing.difficultiesByButton && existing.difficultiesByButton[button]) || []),
            ...((song.difficultiesByButton && song.difficultiesByButton[button]) || [])
          ])
        ])
      )
    });
  }

  const normalizedSongs = [...uniqueSongsMap.values()].map((song) => {
    const byButton = song.difficultiesByButton && typeof song.difficultiesByButton === "object"
      ? song.difficultiesByButton
      : {};

    const normalizedByButton = Object.fromEntries(
      buttons.map((button) => {
        const buttonDiffs = Array.isArray(byButton[button]) && byButton[button].length > 0
          ? sortDifficulties(byButton[button])
          : sortDifficulties(song.difficulties || difficulties);
        return [button, buttonDiffs];
      })
    );

    const mergedDiffs = sortDifficulties(buttons.flatMap((button) => normalizedByButton[button] || []));

    return {
      name: song.name,
      difficulties: mergedDiffs.length > 0 ? mergedDiffs : [...difficulties],
      difficultiesByButton: normalizedByButton
    };
  });

  return {
    users: Array.isArray(source.users) && source.users.length > 0 ? source.users : [...DEFAULT_CATALOG.users],
    songs: normalizedSongs,
    buttons,
    difficulties
  };
}

function clampToUnit(value, fallback = 0) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, normalized));
}

function cloneRegions(regions) {
  const source = regions && typeof regions === "object" ? regions : {};
  return Object.fromEntries(
    OCR_REGION_KEYS.map((key) => {
      const region = source[key] && typeof source[key] === "object" ? source[key] : {};
      return [key, {
        x: Number(region.x) || 0,
        y: Number(region.y) || 0,
        w: Number(region.w) || 0,
        h: Number(region.h) || 0
      }];
    })
  );
}

function normalizeOcrRegion(region, fallbackRegion) {
  const source = region && typeof region === "object" ? region : {};
  const fallback = fallbackRegion && typeof fallbackRegion === "object" ? fallbackRegion : { x: 0, y: 0, w: 0.1, h: 0.1 };

  const x = clampToUnit(source.x, clampToUnit(fallback.x, 0));
  const y = clampToUnit(source.y, clampToUnit(fallback.y, 0));
  const rawW = clampToUnit(source.w, clampToUnit(fallback.w, 0.1));
  const rawH = clampToUnit(source.h, clampToUnit(fallback.h, 0.1));
  const w = Math.max(0.01, Math.min(rawW, 1 - x));
  const h = Math.max(0.01, Math.min(rawH, 1 - y));

  return { x, y, w, h };
}

function normalizeOcrLayoutConfig(config) {
  const source = config && typeof config === "object" ? config : {};
  const defaultPreset = DEFAULT_OCR_LAYOUT_CONFIG.presets[0];
  const defaultRegions = cloneRegions(defaultPreset.regions);
  const rawPresets = Array.isArray(source.presets) ? source.presets : DEFAULT_OCR_LAYOUT_CONFIG.presets;

  const presets = rawPresets
    .map((preset, index) => {
      if (!preset || typeof preset !== "object") {
        return null;
      }

      const id = String(preset.id || `preset-${index + 1}`);
      const label = String(preset.label || id);
      const aspectRatio = Number(preset.aspectRatio);
      const normalizedAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : defaultPreset.aspectRatio;

      const incomingRegions = preset.regions && typeof preset.regions === "object" ? preset.regions : {};
      const regions = Object.fromEntries(
        OCR_REGION_KEYS.map((key) => [
          key,
          normalizeOcrRegion(incomingRegions[key], defaultRegions[key])
        ])
      );

      return {
        id,
        label,
        aspectRatio: normalizedAspectRatio,
        regions
      };
    })
    .filter(Boolean);

  const safePresets = presets.length > 0 ? presets : [
    {
      id: defaultPreset.id,
      label: defaultPreset.label,
      aspectRatio: defaultPreset.aspectRatio,
      regions: Object.fromEntries(
        OCR_REGION_KEYS.map((key) => [key, normalizeOcrRegion(defaultRegions[key], defaultRegions[key])])
      )
    }
  ];

  const activePresetId = safePresets.some((preset) => preset.id === source.activePresetId)
    ? source.activePresetId
    : safePresets[0].id;

  return {
    activePresetId,
    presets: safePresets
  };
}

function loadOcrLayoutConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ocrLayout);
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeOcrLayoutConfig(parsed);
  } catch {
    return normalizeOcrLayoutConfig(null);
  }
}

function saveOcrLayoutConfig(config) {
  const normalized = normalizeOcrLayoutConfig(config);
  localStorage.setItem(STORAGE_KEYS.ocrLayout, JSON.stringify(normalized));
  return normalized;
}

function getActiveOcrLayoutPreset(config = loadOcrLayoutConfig()) {
  const normalized = normalizeOcrLayoutConfig(config);
  const found = normalized.presets.find((preset) => preset.id === normalized.activePresetId);
  return found || normalized.presets[0];
}

function getSongNames(catalog) {
  return uniqueSorted((catalog.songs || []).map((song) => song.name));
}

function getDifficultiesForSong(catalog, songName, button) {
  const matched = (catalog.songs || []).find((song) => song.name === songName);

  if (!matched) {
    return [...catalog.difficulties];
  }

  if (!button) {
    return [...matched.difficulties];
  }

  const byButton = matched.difficultiesByButton && typeof matched.difficultiesByButton === "object"
    ? matched.difficultiesByButton
    : null;

  if (byButton && Array.isArray(byButton[button]) && byButton[button].length > 0) {
    return [...byButton[button]];
  }

  return [...matched.difficulties];
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

function showLoading(message = "通信中...") {
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) {
    return;
  }
  const label = overlay.querySelector(".loading-label");
  if (label) {
    label.textContent = message;
  }
  overlay.style.display = "grid";
}

function hideLoading() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

async function remoteFetchJson(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_CONFIG.timeoutMs);

  try {
    const response = await fetch(REMOTE_CONFIG.apiUrl, {
      method: "POST",
      headers: {
        // Use a simple request to reduce CORS preflight issues on Apps Script.
        "Content-Type": "text/plain;charset=utf-8"
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

    if (REMOTE_CONFIG.catalogMode === "drive-file") {
      const catalogResult = await remoteFetchJson({
        action: "getSongCatalog",
        token: REMOTE_CONFIG.readToken
      });

      if (!catalogResult || catalogResult.ok !== true) {
        throw new Error(catalogResult?.error || "remote song catalog fetch failed");
      }

      state.catalog = mergeCatalogWithSongCatalog(state.catalog, catalogResult.catalog);
    }

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

    if (REMOTE_CONFIG.catalogMode === "drive-file") {
      await remoteFetchJson({
        action: "setSongCatalog",
        token: REMOTE_CONFIG.writeToken,
        catalog: pickSongCatalog(next.catalog)
      });
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

/**
 * Atomically add a single record to the remote state using the addRecord
 * action, which performs a server-side read-append-write inside a lock.
 * This prevents lost-update races that occur when two clients read the same
 * stale state, each append locally, and the later writer overwrites the other.
 *
 * On success the local cache is refreshed with the server's authoritative state.
 * Falls back to local-only storage if remote is unavailable.
 */
async function addSharedRecord(record) {
  // Always persist locally first so the UI reflects the change immediately.
  const localRecords = loadRecords();
  const alreadyLocal = localRecords.some((r) => r.id === record.id);
  if (!alreadyLocal) {
    saveRecords([...localRecords, record]);
  }

  if (!isRemoteEnabled()) {
    return { ok: true, source: "local" };
  }

  try {
    const result = await remoteFetchJson({
      action: "addRecord",
      token: REMOTE_CONFIG.writeToken,
      record
    });

    if (!result || result.ok !== true) {
      throw new Error(result?.error || "remote addRecord failed");
    }

    // Sync local cache with authoritative server state.
    if (result.state) {
      saveRecords(normalizeState(result.state).records);
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

async function loadSharedOcrLayoutConfig() {
  const localConfig = loadOcrLayoutConfig();

  if (!isRemoteEnabled()) {
    return { config: localConfig, source: "local" };
  }

  try {
    const result = await remoteFetchJson({
      action: "getOcrLayout",
      token: REMOTE_CONFIG.readToken
    });

    if (!result || result.ok !== true) {
      throw new Error(result?.error || "remote ocr layout fetch failed");
    }

    const remoteConfig = normalizeOcrLayoutConfig(result.config);
    saveOcrLayoutConfig(remoteConfig);
    return { config: remoteConfig, source: "remote" };
  } catch {
    return { config: localConfig, source: "local-fallback" };
  }
}

async function saveSharedOcrLayoutConfig(config) {
  const normalized = saveOcrLayoutConfig(config);

  if (!isRemoteEnabled()) {
    return { ok: true, source: "local", config: normalized };
  }

  try {
    const result = await remoteFetchJson({
      action: "setOcrLayout",
      token: REMOTE_CONFIG.writeToken,
      config: normalized
    });

    if (!result || result.ok !== true) {
      throw new Error(result?.error || "remote ocr layout save failed");
    }

    const saved = normalizeOcrLayoutConfig(result.config);
    saveOcrLayoutConfig(saved);
    return { ok: true, source: "remote", config: saved };
  } catch (error) {
    return {
      ok: false,
      source: "local-only",
      config: normalized,
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

function sortDifficulties(values) {
  const uniqueValues = [...new Set(values.map((value) => String(value)))];

  return uniqueValues.sort((a, b) => {
    const aIndex = DIFFICULTY_ORDER.indexOf(a);
    const bIndex = DIFFICULTY_ORDER.indexOf(b);

    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) {
        return 1;
      }
      if (bIndex === -1) {
        return -1;
      }
      return aIndex - bIndex;
    }

    return String(a).localeCompare(String(b), "ja");
  });
}
