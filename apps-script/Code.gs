// Deploy as Web App with access: Anyone
// Copy the Web App URL into common.js -> REMOTE_CONFIG.apiUrl

const FILE_NAME = "djmax-ranking-data.json";
const READ_TOKEN = "djmax-read-token";
const WRITE_TOKEN = "djmax-write-token";
// Optional: set folder ID to place JSON under Shared Drive folder.
// Leave empty string to use My Drive root.
const TARGET_FOLDER_ID = "";

function defaultCatalog_() {
  return {
    users: ["PLAYER-1"],
    songs: ["glory day"],
    buttons: ["4B", "5B", "6B", "8B"],
    difficulties: ["NORMAL", "HARD", "MAXIMUM", "SC"]
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

  return response_({ ok: false, error: "unknown_action" });
}
