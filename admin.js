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

function initOcrLayoutEditor() {
  const imageInput = document.getElementById("ocr-layout-image");
  const presetSelect = document.getElementById("ocr-layout-preset");
  const regionSelect = document.getElementById("ocr-layout-region");
  const rangeX = document.getElementById("ocr-range-x");
  const rangeY = document.getElementById("ocr-range-y");
  const rangeW = document.getElementById("ocr-range-w");
  const rangeH = document.getElementById("ocr-range-h");
  const rangeXValue = document.getElementById("ocr-range-x-value");
  const rangeYValue = document.getElementById("ocr-range-y-value");
  const rangeWValue = document.getElementById("ocr-range-w-value");
  const rangeHValue = document.getElementById("ocr-range-h-value");
  const overlay = document.getElementById("ocr-layout-overlay");
  const previewImage = document.getElementById("ocr-layout-preview-image");
  const message = document.getElementById("ocr-layout-message");
  const saveButton = document.getElementById("ocr-layout-save");
  const resetButton = document.getElementById("ocr-layout-reset");
  const newPresetButton = document.getElementById("ocr-layout-new");
  const exportButton = document.getElementById("ocr-layout-export");
  const importInput = document.getElementById("ocr-layout-import");

  if (!imageInput || !presetSelect || !regionSelect || !rangeX || !rangeY || !rangeW || !rangeH || !rangeXValue || !rangeYValue || !rangeWValue || !rangeHValue || !overlay || !previewImage || !saveButton || !resetButton || !newPresetButton || !exportButton || !importInput) {
    return;
  }

  const regionLabels = {
    button: "ボタン数",
    song: "曲名",
    difficulty: "難易度",
    score: "スコア"
  };

  let config = loadOcrLayoutConfig();
  let currentPresetId = config.activePresetId;
  let currentRegionKey = "button";
  let previewImageUrl = "";

  const setMessage = (text) => {
    if (message) {
      message.textContent = text;
    }
  };

  const getCurrentPreset = () => {
    const found = config.presets.find((preset) => preset.id === currentPresetId);
    if (found) {
      return found;
    }
    return config.presets[0];
  };

  const getCurrentRegion = () => {
    const preset = getCurrentPreset();
    const region = preset?.regions?.[currentRegionKey];
    return region || { x: 0, y: 0, w: 0.1, h: 0.1 };
  };

  const renderOverlay = () => {
    overlay.innerHTML = "";
    const preset = getCurrentPreset();
    if (!preset) {
      return;
    }

    for (const key of OCR_REGION_KEYS) {
      const region = preset.regions[key];
      if (!region) {
        continue;
      }

      const box = document.createElement("div");
      box.className = "ocr-region-box";
      if (key === currentRegionKey) {
        box.classList.add("is-active");
      }
      box.style.left = `${region.x * 100}%`;
      box.style.top = `${region.y * 100}%`;
      box.style.width = `${region.w * 100}%`;
      box.style.height = `${region.h * 100}%`;

      const label = document.createElement("span");
      label.className = "ocr-region-label";
      label.textContent = regionLabels[key] || key;
      box.appendChild(label);
      overlay.appendChild(box);
    }
  };

  const updateRangeLabels = () => {
    const region = getCurrentRegion();
    rangeXValue.textContent = region.x.toFixed(3);
    rangeYValue.textContent = region.y.toFixed(3);
    rangeWValue.textContent = region.w.toFixed(3);
    rangeHValue.textContent = region.h.toFixed(3);
  };

  const syncRangesFromPreset = () => {
    const region = getCurrentRegion();
    rangeX.value = String(Math.round(region.x * 1000));
    rangeY.value = String(Math.round(region.y * 1000));
    rangeW.value = String(Math.round(region.w * 1000));
    rangeH.value = String(Math.round(region.h * 1000));
    updateRangeLabels();
    renderOverlay();
  };

  const renderPresetOptions = () => {
    presetSelect.innerHTML = "";
    for (const preset of config.presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = `${preset.label} (${preset.id})`;
      presetSelect.appendChild(option);
    }

    if (!config.presets.some((preset) => preset.id === currentPresetId)) {
      currentPresetId = config.presets[0]?.id || "";
    }

    presetSelect.value = currentPresetId;
  };

  const renderRegionOptions = () => {
    regionSelect.innerHTML = "";
    for (const key of OCR_REGION_KEYS) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = regionLabels[key] || key;
      regionSelect.appendChild(option);
    }
    regionSelect.value = currentRegionKey;
  };

  const applyRangeToRegion = () => {
    const preset = getCurrentPreset();
    if (!preset || !preset.regions[currentRegionKey]) {
      return;
    }

    const x = Number(rangeX.value) / 1000;
    const y = Number(rangeY.value) / 1000;
    const w = Number(rangeW.value) / 1000;
    const h = Number(rangeH.value) / 1000;

    preset.regions[currentRegionKey] = normalizeOcrRegion(
      { x, y, w, h },
      preset.regions[currentRegionKey]
    );

    syncRangesFromPreset();
  };

  const normalizeAndRefresh = () => {
    config = normalizeOcrLayoutConfig(config);
    renderPresetOptions();
    renderRegionOptions();
    syncRangesFromPreset();
  };

  presetSelect.addEventListener("change", () => {
    currentPresetId = presetSelect.value;
    syncRangesFromPreset();
  });

  regionSelect.addEventListener("change", () => {
    currentRegionKey = regionSelect.value;
    syncRangesFromPreset();
  });

  for (const range of [rangeX, rangeY, rangeW, rangeH]) {
    range.addEventListener("input", applyRangeToRegion);
  }

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
    }
    previewImageUrl = URL.createObjectURL(file);
    previewImage.src = previewImageUrl;
    setMessage("プレビュー画像を読み込みました。領域を調整して保存してください。");
  });

  newPresetButton.addEventListener("click", () => {
    const basePreset = getCurrentPreset();
    const label = window.prompt("新しいプリセット名を入力してください", "Custom Layout");
    if (!label) {
      return;
    }

    const idSeed = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const generatedBaseId = idSeed || `preset-${Date.now()}`;
    let generatedId = generatedBaseId;
    let suffix = 1;
    while (config.presets.some((preset) => preset.id === generatedId)) {
      generatedId = `${generatedBaseId}-${suffix}`;
      suffix += 1;
    }

    const clonedRegions = Object.fromEntries(
      OCR_REGION_KEYS.map((key) => [key, { ...basePreset.regions[key] }])
    );

    config.presets.push({
      id: generatedId,
      label: label.trim(),
      aspectRatio: basePreset.aspectRatio,
      regions: clonedRegions
    });

    currentPresetId = generatedId;
    normalizeAndRefresh();
    setMessage(`プリセット ${generatedId} を作成しました。`);
  });

  saveButton.addEventListener("click", async () => {
    config.activePresetId = currentPresetId;
    if (isRemoteEnabled()) showLoading("OCRレイアウト保存中...");
    let saveResult;
    try {
      saveResult = await saveSharedOcrLayoutConfig(config);
    } finally {
      hideLoading();
    }

    config = saveResult.config;
    normalizeAndRefresh();
    setMessage(saveResult.ok
      ? "OCRレイアウト設定を保存しました。全利用者へ反映されます。"
      : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`);
  });

  resetButton.addEventListener("click", async () => {
    const ok = window.confirm("OCRレイアウト設定を初期化しますか？");
    if (!ok) {
      return;
    }

    if (isRemoteEnabled()) showLoading("OCRレイアウト初期化中...");
    let saveResult;
    try {
      saveResult = await saveSharedOcrLayoutConfig(null);
    } finally {
      hideLoading();
    }

    config = saveResult.config;
    currentPresetId = config.activePresetId;
    currentRegionKey = "button";
    normalizeAndRefresh();
    setMessage(saveResult.ok
      ? "初期レイアウトへ戻しました。"
      : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`);
  });

  exportButton.addEventListener("click", () => {
    downloadJson("djmax-ocr-layout.json", normalizeOcrLayoutConfig(config));
    setMessage("OCRレイアウトJSONを書き出しました。");
  });

  importInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      config = normalizeOcrLayoutConfig(parsed);
      currentPresetId = config.activePresetId;

      if (isRemoteEnabled()) showLoading("OCRレイアウト反映中...");
      let saveResult;
      try {
        saveResult = await saveSharedOcrLayoutConfig(config);
      } finally {
        hideLoading();
      }

      config = saveResult.config;
      normalizeAndRefresh();
      setMessage(saveResult.ok
        ? "OCRレイアウトJSONを読み込みました。"
        : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`);
    } catch (error) {
      setMessage(`OCRレイアウト読込失敗: ${error instanceof Error ? error.message : "不明なエラー"}`);
    }

    event.target.value = "";
  });

  window.addEventListener("beforeunload", () => {
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
      previewImageUrl = "";
    }
  });

  (async () => {
    if (isRemoteEnabled()) showLoading("OCRレイアウト読込中...");
    let loaded;
    try {
      loaded = await loadSharedOcrLayoutConfig();
    } finally {
      hideLoading();
    }

    config = loaded.config;
    currentPresetId = config.activePresetId;
    normalizeAndRefresh();

    if (loaded.source === "local-fallback") {
      setMessage("共有OCRレイアウト取得に失敗したため、ローカル設定を表示しています。");
    } else if (loaded.source === "remote") {
      setMessage("共有OCRレイアウトを読み込みました。");
    }
  })();
}

async function main() {
  await initPasswordGate();

  if (isRemoteEnabled()) showLoading("データを読み込み中...");
  let initial;
  try {
    initial = await loadSharedState();
  } finally {
    hideLoading();
  }
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

    if (isRemoteEnabled()) showLoading("保存中...");
    let saveResult;
    try {
      saveResult = await saveSharedState(catalog, records);
    } finally {
      hideLoading();
    }
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

    if (isRemoteEnabled()) showLoading("保存中...");
    let saveResult;
    try {
      saveResult = await saveSharedState(catalog, records);
    } finally {
      hideLoading();
    }
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

      if (isRemoteEnabled()) showLoading("保存中...");
      let saveResult;
      try {
        saveResult = await saveSharedState(catalog, records);
      } finally {
        hideLoading();
      }
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
    if (isRemoteEnabled()) showLoading("保存中...");
    let saveResult;
    try {
      saveResult = await saveSharedState(catalog, records);
    } finally {
      hideLoading();
    }

    if (message) {
      message.textContent = saveResult.ok
        ? "全スコアを削除しました。"
        : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`;
    }
  });

  initOcrLayoutEditor();
}

main();
