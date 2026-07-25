// Deploy as Web App with access: Anyone
// Copy the Web App URL into common.js -> REMOTE_CONFIG.apiUrl

const FILE_NAME = "djmax-ranking-data.json";
const SONG_CATALOG_FILE_NAME = "djmax-song-catalog.json";
const OCR_LAYOUT_FILE_NAME = "djmax-ocr-layout.json";
const READ_TOKEN = "djmax-read-token";
const WRITE_TOKEN = "djmax-write-token";
// Optional: set folder ID to place JSON under Shared Drive folder.
// Leave empty string to use My Drive root.
const TARGET_FOLDER_ID = "djmax-ranking-data";

function defaultCatalog_() {
  return {
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
      }
    ],
    buttons: ["4B", "5B", "6B", "8B"],
    difficulties: ["NORMAL", "HARD", "MAXIMUM", "SC"]
  };
}

function defaultSongCatalog_() {
  const base = defaultCatalog_();
  return {
    songs: base.songs,
    buttons: base.buttons,
    difficulties: base.difficulties
  };
}

function normalizeCatalog_(catalog) {
  const source = catalog && typeof catalog === "object" ? catalog : {};
  return {
    users: Array.isArray(source.users) && source.users.length ? source.users : defaultCatalog_().users,
    songs: Array.isArray(source.songs) && source.songs.length ? source.songs : defaultCatalog_().songs,
    buttons: Array.isArray(source.buttons) && source.buttons.length ? source.buttons : defaultCatalog_().buttons,
    difficulties: Array.isArray(source.difficulties) && source.difficulties.length ? source.difficulties : defaultCatalog_().difficulties
  };
}

function normalizeSongCatalog_(catalog) {
  const source = catalog && typeof catalog === "object" ? catalog : {};
  return {
    songs: Array.isArray(source.songs) && source.songs.length ? source.songs : defaultSongCatalog_().songs,
    buttons: Array.isArray(source.buttons) && source.buttons.length ? source.buttons : defaultSongCatalog_().buttons,
    difficulties: Array.isArray(source.difficulties) && source.difficulties.length ? source.difficulties : defaultSongCatalog_().difficulties
  };
}

function normalizeRecords_(records) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .filter((r) => r && typeof r === "object")
    .map((r) => ({
      id: String(r.id || Utilities.getUuid()),
      user: String(r.user || ""),
      song: String(r.song || ""),
      button: String(r.button || ""),
      difficulty: String(r.difficulty || ""),
      score: Number(r.score) || 0,
      createdAt: r.createdAt || new Date().toISOString()
    }))
    .filter((r) => r.user && r.song && r.button && r.difficulty);
}

function defaultOcrLayout_() {
  return {
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
}

function normalizeUnit_(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, numeric));
}

function normalizeRegion_(region, fallback) {
  const source = region && typeof region === "object" ? region : {};
  const base = fallback && typeof fallback === "object" ? fallback : { x: 0, y: 0, w: 0.1, h: 0.1 };
  const x = normalizeUnit_(source.x, normalizeUnit_(base.x, 0));
  const y = normalizeUnit_(source.y, normalizeUnit_(base.y, 0));
  const w = Math.max(0.01, Math.min(normalizeUnit_(source.w, normalizeUnit_(base.w, 0.1)), 1 - x));
  const h = Math.max(0.01, Math.min(normalizeUnit_(source.h, normalizeUnit_(base.h, 0.1)), 1 - y));
  return { x: x, y: y, w: w, h: h };
}

function normalizeOcrLayout_(config) {
  const source = config && typeof config === "object" ? config : {};
  const fallback = defaultOcrLayout_();
  const fallbackPreset = fallback.presets[0];
  const keys = ["button", "song", "difficulty", "score"];
  const rawPresets = Array.isArray(source.presets) ? source.presets : fallback.presets;

  const presets = rawPresets
    .map((preset, index) => {
      if (!preset || typeof preset !== "object") {
        return null;
      }

      const aspectRatio = Number(preset.aspectRatio);
      const incomingRegions = preset.regions && typeof preset.regions === "object" ? preset.regions : {};

      const regions = {};
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        regions[key] = normalizeRegion_(incomingRegions[key], fallbackPreset.regions[key]);
      }

      return {
        id: String(preset.id || `preset-${index + 1}`),
        label: String(preset.label || `Preset ${index + 1}`),
        aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : fallbackPreset.aspectRatio,
        regions: regions
      };
    })
    .filter((preset) => preset !== null);

  const safePresets = presets.length > 0 ? presets : fallback.presets;
  const activePresetId = safePresets.some((preset) => preset.id === source.activePresetId)
    ? source.activePresetId
    : safePresets[0].id;

  return {
    activePresetId: activePresetId,
    presets: safePresets
  };
}

function normalizeState_(state) {
  const source = state && typeof state === "object" ? state : {};
  return {
    catalog: normalizeCatalog_(source.catalog),
    records: normalizeRecords_(source.records)
  };
}

function getOrCreateFile_() {
  const folder = getTargetFolder_();
  const files = folder ? folder.getFilesByName(FILE_NAME) : DriveApp.getFilesByName(FILE_NAME);
  if (files.hasNext()) {
    return files.next();
  }

  const initial = normalizeState_({});
  if (folder) {
    return folder.createFile(FILE_NAME, JSON.stringify(initial));
  }

  return DriveApp.createFile(FILE_NAME, JSON.stringify(initial));
}

function getOrCreateSongCatalogFile_() {
  const folder = getTargetFolder_();
  const files = folder ? folder.getFilesByName(SONG_CATALOG_FILE_NAME) : DriveApp.getFilesByName(SONG_CATALOG_FILE_NAME);
  if (files.hasNext()) {
    return files.next();
  }

  const initial = normalizeSongCatalog_({});
  if (folder) {
    return folder.createFile(SONG_CATALOG_FILE_NAME, JSON.stringify(initial));
  }

  return DriveApp.createFile(SONG_CATALOG_FILE_NAME, JSON.stringify(initial));
}

function getOrCreateOcrLayoutFile_() {
  const folder = getTargetFolder_();
  const files = folder ? folder.getFilesByName(OCR_LAYOUT_FILE_NAME) : DriveApp.getFilesByName(OCR_LAYOUT_FILE_NAME);
  if (files.hasNext()) {
    return files.next();
  }

  const initial = normalizeOcrLayout_(defaultOcrLayout_());
  if (folder) {
    return folder.createFile(OCR_LAYOUT_FILE_NAME, JSON.stringify(initial));
  }

  return DriveApp.createFile(OCR_LAYOUT_FILE_NAME, JSON.stringify(initial));
}

function getTargetFolder_() {
  if (!TARGET_FOLDER_ID) {
    return null;
  }

  try {
    return DriveApp.getFolderById(TARGET_FOLDER_ID);
  } catch (_error) {
    return null;
  }
}

function readState_() {
  const file = getOrCreateFile_();
  const text = file.getBlob().getDataAsString("UTF-8");

  try {
    return normalizeState_(JSON.parse(text));
  } catch (_e) {
    return normalizeState_({});
  }
}

function writeState_(state) {
  const file = getOrCreateFile_();
  const normalized = normalizeState_(state);
  file.setContent(JSON.stringify(normalized));
  return normalized;
}

function readSongCatalog_() {
  const file = getOrCreateSongCatalogFile_();
  const text = file.getBlob().getDataAsString("UTF-8");

  try {
    return normalizeSongCatalog_(JSON.parse(text));
  } catch (_e) {
    return normalizeSongCatalog_({});
  }
}

function writeSongCatalog_(catalog) {
  const file = getOrCreateSongCatalogFile_();
  const normalized = normalizeSongCatalog_(catalog);
  file.setContent(JSON.stringify(normalized));
  return normalized;
}

function readOcrLayout_() {
  const file = getOrCreateOcrLayoutFile_();
  const text = file.getBlob().getDataAsString("UTF-8");

  try {
    return normalizeOcrLayout_(JSON.parse(text));
  } catch (_e) {
    return normalizeOcrLayout_(defaultOcrLayout_());
  }
}

function writeOcrLayout_(config) {
  const file = getOrCreateOcrLayoutFile_();
  const normalized = normalizeOcrLayout_(config);
  file.setContent(JSON.stringify(normalized));
  return normalized;
}

function response_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body;

  try {
    body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  } catch (_error) {
    return response_({ ok: false, error: "invalid_json" });
  }

  const action = body.action;
  if (action === "getState") {
    if (body.token !== READ_TOKEN) {
      return response_({ ok: false, error: "unauthorized_read" });
    }

    return response_({ ok: true, state: readState_() });
  }

  if (action === "setState") {
    if (body.token !== WRITE_TOKEN) {
      return response_({ ok: false, error: "unauthorized_write" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const saved = writeState_(body.state);
      return response_({ ok: true, state: saved });
    } finally {
      lock.releaseLock();
    }
  }

  if (action === "getSongCatalog") {
    if (body.token !== READ_TOKEN) {
      return response_({ ok: false, error: "unauthorized_read" });
    }

    return response_({ ok: true, catalog: readSongCatalog_() });
  }

  if (action === "setSongCatalog") {
    if (body.token !== WRITE_TOKEN) {
      return response_({ ok: false, error: "unauthorized_write" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const saved = writeSongCatalog_(body.catalog);
      return response_({ ok: true, catalog: saved });
    } finally {
      lock.releaseLock();
    }
  }

  if (action === "getOcrLayout") {
    if (body.token !== READ_TOKEN) {
      return response_({ ok: false, error: "unauthorized_read" });
    }

    return response_({ ok: true, config: readOcrLayout_() });
  }

  if (action === "setOcrLayout") {
    if (body.token !== WRITE_TOKEN) {
      return response_({ ok: false, error: "unauthorized_write" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const saved = writeOcrLayout_(body.config);
      return response_({ ok: true, config: saved });
    } finally {
      lock.releaseLock();
    }
  }

  // Atomically append a single record to the current state.
  // This avoids lost-update races where two clients both read stale state,
  // each add their record locally, and the second write overwrites the first.
  if (action === "addRecord") {
    if (body.token !== WRITE_TOKEN) {
      return response_({ ok: false, error: "unauthorized_write" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const current = readState_();
      const incoming = normalizeRecords_([body.record]);
      if (incoming.length === 0) {
        return response_({ ok: false, error: "invalid_record" });
      }

      // Deduplicate by id to prevent replayed requests from adding duplicates.
      const existingIds = new Set(current.records.map((r) => r.id));
      const toAdd = incoming.filter((r) => !existingIds.has(r.id));
      if (toAdd.length === 0) {
        return response_({ ok: true, state: current, duplicate: true });
      }

      current.records = current.records.concat(toAdd);
      const saved = writeState_(current);
      return response_({ ok: true, state: saved });
    } finally {
      lock.releaseLock();
    }
  }

  return response_({ ok: false, error: "unknown_action" });
}
