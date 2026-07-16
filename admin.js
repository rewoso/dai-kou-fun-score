function populatePlayers(catalog) {
  const select = document.getElementById("player-select");
  if (!select) {
    return;
  }

  select.innerHTML = "";
  for (const user of uniqueSorted(catalog.users)) {
    const option = document.createElement("option");
    option.value = user;
    option.textContent = user;
    select.appendChild(option);
  }
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

  const mergedCatalog = normalizeCatalog({
    ...currentCatalog,
    users: uniqueSorted([...currentCatalog.users, ...incomingCatalog.users]),
    songs: [...currentCatalog.songs, ...incomingCatalog.songs],
    buttons: uniqueSorted([...(currentCatalog.buttons || []), ...(incomingCatalog.buttons || [])]),
    difficulties: sortDifficulties([...(currentCatalog.difficulties || []), ...(incomingCatalog.difficulties || [])])
  });

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
  populatePlayers(catalog);

  const message = document.getElementById("form-message");

  if (message && initial.source === "local-fallback") {
    message.textContent = "共有API接続失敗のためローカルデータを表示中です。";
  }

  document.getElementById("add-player")?.addEventListener("click", async () => {
    const input = document.getElementById("new-player-name");
    const playerName = input?.value?.trim();

    if (!playerName) {
      if (message) {
        message.textContent = "プレイヤー名を入力してください。";
      }
      return;
    }

    if (catalog.users.includes(playerName)) {
      if (message) {
        message.textContent = "同名のプレイヤーが既に存在します。";
      }
      return;
    }

    catalog = {
      ...catalog,
      users: uniqueSorted([...catalog.users, playerName])
    };

    const saveResult = await saveSharedState(catalog, records);
    populatePlayers(catalog);

    if (input) {
      input.value = "";
    }

    if (message) {
      message.textContent = saveResult.ok
        ? `${playerName} を追加しました。`
        : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`;
    }
  });

  document.getElementById("delete-player")?.addEventListener("click", async () => {
    const select = document.getElementById("player-select");
    const selected = select?.value;

    if (!selected) {
      if (message) {
        message.textContent = "削除するプレイヤーを選択してください。";
      }
      return;
    }

    const inUse = records.some((record) => record.user === selected);
    if (inUse) {
      const confirmed = window.confirm("このプレイヤーのスコアが存在します。プレイヤーと関連スコアを削除しますか？");
      if (!confirmed) {
        return;
      }
      records = records.filter((record) => record.user !== selected);
    }

    catalog = {
      ...catalog,
      users: catalog.users.filter((user) => user !== selected)
    };

    const saveResult = await saveSharedState(catalog, records);
    populatePlayers(catalog);

    if (message) {
      message.textContent = saveResult.ok
        ? `${selected} を削除しました。`
        : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`;
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
      populatePlayers(catalog);

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
