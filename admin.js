function populateSelect(selectId, values) {
  const select = document.getElementById(selectId);
  if (!select) {
    return;
  }

  select.innerHTML = "";
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

function refreshAdminCatalog(catalog) {
  populateSelect("input-user", uniqueSorted(catalog.users));
  populateSelect("input-song", uniqueSorted(catalog.songs));
  populateSelect("input-button", uniqueSorted(catalog.buttons));
  populateSelect("input-difficulty", uniqueSorted(catalog.difficulties));
}

function askAndAdd(catalog, key, label) {
  const name = window.prompt(`${label}を追加してください`);
  if (!name) {
    return null;
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }

  return {
    ...catalog,
    [key]: uniqueSorted([...(catalog[key] || []), trimmed])
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function mergeImported(currentCatalog, currentRecords, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("不正なJSONです");
  }

  const incomingCatalog = normalizeCatalog(payload.catalog);
  const incomingRecords = Array.isArray(payload.records) ? payload.records : [];

  const mergedCatalog = {
    users: uniqueSorted([...currentCatalog.users, ...incomingCatalog.users]),
    songs: uniqueSorted([...currentCatalog.songs, ...incomingCatalog.songs]),
    buttons: uniqueSorted([...currentCatalog.buttons, ...incomingCatalog.buttons]),
    difficulties: uniqueSorted([...currentCatalog.difficulties, ...incomingCatalog.difficulties])
  };

  const mergedRecordsMap = new Map();
  for (const record of [...currentRecords, ...incomingRecords]) {
    if (!record || !record.song || !record.user || !record.difficulty || !record.button) {
      continue;
    }

    const fallbackId = `${record.user}__${record.song}__${record.button}__${record.difficulty}__${record.score}`;
    const id = record.id || fallbackId;
    mergedRecordsMap.set(id, {
      ...record,
      id,
      score: Number(record.score) || 0,
      createdAt: record.createdAt || new Date().toISOString()
    });
  }

  return {
    catalog: mergedCatalog,
    records: [...mergedRecordsMap.values()]
  };
}

async function main() {
  await initPasswordGate();

  const initial = await loadSharedState();
  let catalog = initial.catalog;
  let records = initial.records;
  refreshAdminCatalog(catalog);

  const message = document.getElementById("form-message");
  const scoreForm = document.getElementById("score-form");

  if (message && initial.source === "local-fallback") {
    message.textContent = "共有API接続失敗のためローカルデータを表示中です。";
  }

  scoreForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      id: crypto.randomUUID(),
      user: document.getElementById("input-user")?.value,
      song: document.getElementById("input-song")?.value,
      button: document.getElementById("input-button")?.value,
      difficulty: document.getElementById("input-difficulty")?.value,
      score: Number(document.getElementById("input-score")?.value || 0),
      createdAt: new Date().toISOString()
    };

    records.push(payload);

    const saveResult = await saveSharedState(catalog, records);

    if (message) {
      if (saveResult.ok) {
        message.textContent = `${payload.user} / ${payload.song} のスコアを登録しました。`;
      } else {
        message.textContent = `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`;
      }
    }

    const scoreInput = document.getElementById("input-score");
    if (scoreInput) {
      scoreInput.value = "";
      scoreInput.focus();
    }
  });

  document.getElementById("add-user")?.addEventListener("click", async () => {
    const next = askAndAdd(catalog, "users", "ユーザー名");
    if (!next) {
      return;
    }

    catalog = next;
    refreshAdminCatalog(catalog);
    const saveResult = await saveSharedState(catalog, records);
    if (message) {
      message.textContent = saveResult.ok ? "ユーザー名を追加しました。" : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`;
    }
  });

  document.getElementById("add-song")?.addEventListener("click", async () => {
    const next = askAndAdd(catalog, "songs", "曲名");
    if (!next) {
      return;
    }

    catalog = next;
    refreshAdminCatalog(catalog);
    const saveResult = await saveSharedState(catalog, records);
    if (message) {
      message.textContent = saveResult.ok ? "曲名を追加しました。" : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`;
    }
  });

  document.getElementById("export-json")?.addEventListener("click", () => {
    downloadJson("djmax-ranking-data.json", { catalog, records });
  });

  document.getElementById("import-json")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const merged = mergeImported(catalog, records, parsed);
      catalog = merged.catalog;
      records = merged.records;

      const saveResult = await saveSharedState(catalog, records);
      refreshAdminCatalog(catalog);

      if (message) {
        message.textContent = saveResult.ok ? "JSONを読み込みました。" : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`;
      }
    } catch (error) {
      if (message) {
        message.textContent = `読込失敗: ${error.message}`;
      }
    }

    event.target.value = "";
  });

  document.getElementById("clear-records")?.addEventListener("click", async () => {
    const ok = window.confirm("本当に全スコアを削除しますか？");
    if (!ok) {
      return;
    }

    records = [];
    const saveResult = await saveSharedState(catalog, records);

    if (message) {
      message.textContent = saveResult.ok ? "全スコアを削除しました。" : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`;
    }
  });
}

main();
