function applyFilters(records, filters) {
  return records.filter((record) => {
    const multiUsers = Array.isArray(filters.users)
      ? filters.users.filter(Boolean)
      : [];
    const selectedUsers = multiUsers.length > 0
      ? multiUsers
      : (filters.user ? [filters.user] : []);
    const userOk = selectedUsers.length === 0 || selectedUsers.includes(record.user);
    const songOk = !filters.song || record.song === filters.song;
    const songQuery = (filters.songQuery || "").trim().toLowerCase();
    const songQueryOk = !songQuery || String(record.song || "").toLowerCase().includes(songQuery);
    const buttonOk = !filters.button || record.button === filters.button;
    const diffOk = !filters.difficulty || record.difficulty === filters.difficulty;
    return userOk && songOk && songQueryOk && buttonOk && diffOk;
  });
}

function applyRecentUpdateLimit(records, limit) {
  const normalizedLimit = Number(limit);
  if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0) {
    return records;
  }

  return [...records]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, normalizedLimit);
}

function toRankingRows(records) {
  const bestByChartAndUser = new Map();

  for (const record of records) {
    const key = `${record.song}__${record.button}__${record.difficulty}__${record.user}`;
    const existing = bestByChartAndUser.get(key);
    if (!existing || Number(record.score) > Number(existing.score)) {
      bestByChartAndUser.set(key, record);
    }
  }

  const bestOnly = [...bestByChartAndUser.values()];
  bestOnly.sort((a, b) => Number(b.score) - Number(a.score) || (new Date(b.createdAt) - new Date(a.createdAt)));
  return bestOnly;
}

function setSelectOptions(select, values, includeAllLabel = "") {
  if (!select) {
    return;
  }

  const current = select.value;
  select.innerHTML = "";

  if (includeAllLabel) {
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = includeAllLabel;
    select.appendChild(allOption);
  }

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }

  if (values.includes(current) || (includeAllLabel && current === "")) {
    select.value = current;
  }
}

function renderTable(rows, onSongClick) {
  const body = document.getElementById("ranking-body");
  const empty = document.getElementById("empty-state");
  const count = document.getElementById("record-count");

  if (!body || !empty || !count) {
    return;
  }

  body.innerHTML = "";

  if (rows.length === 0) {
    empty.style.display = "block";
    count.textContent = "0件";
    return;
  }

  empty.style.display = "none";
  count.textContent = `${rows.length}件`;

  for (const [index, row] of rows.entries()) {
    const tr = document.createElement("tr");
    const score = Number(row.score) || 0;
    const scoreRate = (score / 10000).toFixed(2);
    const scoreRank = getScoreRank(score);
    const rankClasses = getScoreRankClasses(scoreRank, score);
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${row.user}</td>
      <td></td>
      <td><span class="button-pill ${getButtonDisplayClass(row.button)}">${row.button}</span></td>
      <td><span class="difficulty-pill ${getDifficultyDisplayClass(row.difficulty)}">${row.difficulty}</span></td>
      <td>${score.toLocaleString("ja-JP")}</td>
      <td>${scoreRate}%</td>
      <td><span class="rank-pill ${rankClasses}">${scoreRank}</span></td>
      <td>${formatDate(row.createdAt)}</td>
    `;

    const songCell = tr.children[2];
    if (songCell) {
      if (typeof onSongClick === "function") {
        const songButton = document.createElement("button");
        songButton.type = "button";
        songButton.className = "ranking-song-trigger";
        songButton.textContent = row.song;
        songButton.title = "クリックでこの譜面条件を絞り込み";
        songButton.addEventListener("click", () => {
          onSongClick({
            song: row.song,
            button: row.button,
            difficulty: row.difficulty
          });
        });
        songCell.appendChild(songButton);
      } else {
        songCell.textContent = row.song;
      }
    }

    body.appendChild(tr);
  }
}

function getScoreRank(score) {
  const normalizedScore = Number(score) || 0;

  if (normalizedScore >= 970000) {
    return "S";
  }
  if (normalizedScore >= 900000) {
    return "A";
  }
  if (normalizedScore >= 800000) {
    return "B";
  }
  return "C";
}

function getScoreRankClass(rank) {
  switch (rank) {
    case "S":
      return "rank-s";
    case "A":
      return "rank-a";
    case "B":
      return "rank-b";
    default:
      return "rank-c";
  }
}

function getScoreRankClasses(rank, score) {
  const classNames = [getScoreRankClass(rank)];

  if (score === 1000000) {
    classNames.push("rank-perfect");
  }

  return classNames.join(" ");
}

function getDifficultyDisplayClass(value) {
  switch (value) {
    case "NORMAL":
      return "difficulty-normal";
    case "HARD":
      return "difficulty-hard";
    case "MAXIMUM":
      return "difficulty-maximum";
    case "SC":
      return "difficulty-sc";
    default:
      return "";
  }
}

function renderChoiceButtons(containerId, values, selected, onSelect, hidden = []) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = "";
  for (const value of values) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn";
    button.textContent = value;
    const difficultyClass = getDifficultyButtonClass(value);
    const buttonClass = getButtonDisplayClass(value);

    if (difficultyClass) {
      button.classList.add(difficultyClass);
    }

    if (buttonClass) {
      button.classList.add(buttonClass);
    }

    if (value === selected) {
      button.classList.add("is-active");
    }

    if (hidden.includes(value)) {
      button.classList.add("is-hidden");
    }

    button.addEventListener("click", () => onSelect(value));
    container.appendChild(button);
  }
}

function getButtonDisplayClass(value) {
  switch (value) {
    case "4B":
      return "button-4b";
    case "5B":
      return "button-5b";
    case "6B":
      return "button-6b";
    case "8B":
      return "button-8b";
    default:
      return "";
  }
}

function getDifficultyButtonClass(value) {
  switch (value) {
    case "NORMAL":
      return "difficulty-normal";
    case "HARD":
      return "difficulty-hard";
    case "MAXIMUM":
      return "difficulty-maximum";
    case "SC":
      return "difficulty-sc";
    default:
      return "";
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function normalizeSongKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeOcrTypos(text) {
  return String(text || "")
    .replace(/[|]/g, "I")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\$C/gi, "SC")
    .replace(/5C/gi, "SC")
    .replace(/S\s*C/gi, "SC")
    .replace(/M4X/gi, "MAX")
    .replace(/\bAXIMUM\b/gi, "MAXIMUM")
    .replace(/\bMAXI[MN]U[MN]\b/gi, "MAXIMUM")
    .replace(/MAX1MUM/gi, "MAXIMUM")
    .replace(/N0R/gi, "NOR");
}

function toBigrams(value) {
  if (value.length < 2) {
    return [value];
  }

  const out = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    out.push(value.slice(index, index + 2));
  }
  return out;
}

function diceCoefficient(left, right) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftBigrams = toBigrams(left);
  const rightBigrams = toBigrams(right);
  const rightCounts = new Map();

  for (const token of rightBigrams) {
    rightCounts.set(token, (rightCounts.get(token) || 0) + 1);
  }

  let overlap = 0;
  for (const token of leftBigrams) {
    const count = rightCounts.get(token) || 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(token, count - 1);
    }
  }

  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

function findTopSongMatches(rawSongText, songs, limit = 3) {
  const blockedLine = /^(button|tunes|score|record|break|combo|clear|point|season|class|play|judge|details|dj\s*class|play\s*point|clear\s*point|new\s*record)$/i;
  const lineCandidates = normalizeOcrTypos(rawSongText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3)
    .filter((line) => !blockedLine.test(line.toLowerCase()))
    .filter((line) => !/^\d+[\d.,%\s-]*$/.test(line));

  const expandedCandidates = [];
  for (let index = 0; index < lineCandidates.length; index += 1) {
    expandedCandidates.push(lineCandidates[index]);
    if (lineCandidates[index + 1]) {
      expandedCandidates.push(`${lineCandidates[index]} ${lineCandidates[index + 1]}`);
    }
  }

  const candidates = expandedCandidates.length > 0
    ? expandedCandidates
    : [normalizeOcrTypos(rawSongText).trim()].filter(Boolean);

  const bestBySong = new Map();

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeSongKey(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    for (const song of songs) {
      const normalizedSong = normalizeSongKey(song);
      if (!normalizedSong) {
        continue;
      }

      let score = diceCoefficient(normalizedCandidate, normalizedSong);

      if (normalizedSong.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedSong)) {
        score = Math.max(score, 0.9);
      }

      const previous = bestBySong.get(song);
      if (!previous || score > previous.confidence) {
        bestBySong.set(song, {
          song,
          confidence: score,
          source: candidate
        });
      }
    }
  }

  return [...bestBySong.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, Math.max(1, Math.floor(limit)));
}

function extractButtonFromText(text) {
  const normalizedText = String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ");

  const match = normalizedText.match(/([4568])\s*(?:B|BUTTON|BUTON|TUNES)/i);
  if (!match) {
    return "";
  }

  return `${match[1]}B`;
}

function extractScoreFromText(text) {
  const normalizedText = String(text || "").replace(/[,\s]/g, "");
  const matches = normalizedText.match(/\d{4,7}/g) || [];
  const candidates = matches
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 10000 && value <= 1000000)
    .sort((a, b) => b - a);

  if (candidates.length > 0) {
    return candidates[0];
  }

  return 0;
}

function extractDifficultyFromText(text, availableDifficulties = []) {
  const normalizedText = normalizeOcrTypos(text)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
  const compactText = normalizedText.replace(/\s+/g, "");

  const found = [];

  if (/\bSC\b/.test(normalizedText) || /[SC$5]{2,}/.test(compactText)) {
    found.push("SC");
  }

  if (
    /\bMAX(?:IMUM)?\b/.test(normalizedText) ||
    /\bAXIMUM\b/.test(normalizedText) ||
    /M4X(?:IMUM)?/.test(compactText) ||
    /(?:MAXIMUM|AXIMUM|MAXIMU|MAXIM)/.test(compactText)
  ) {
    found.push("MAXIMUM");
  }

  if (/\bHARD\b/.test(normalizedText) || /H4RD/.test(compactText) || /HAR[D0]/.test(compactText)) {
    found.push("HARD");
  }

  if (/\bNOR(?:MAL|MAL)?\b/.test(normalizedText) || /N0RMAL/.test(compactText) || /NORMAL/.test(compactText)) {
    found.push("NORMAL");
  }

  if (availableDifficulties.length === 0) {
    return found[0] || "";
  }

  const matched = found.find((value) => availableDifficulties.includes(value));
  if (matched) {
    return matched;
  }

  if (availableDifficulties.includes("SC") && /\b[SC]{1,2}\b/.test(normalizedText)) {
    return "SC";
  }

  return "";
}

async function imageFileToCanvas(file) {
  if (!(file instanceof File)) {
    throw new Error("画像ファイルが選択されていません。");
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = imageUrl;

    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    });

    const canvas = createCanvas(image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas コンテキストを取得できませんでした。");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function setFileToInput(input, file) {
  if (!input || !(file instanceof File)) {
    return;
  }

  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  } catch {
    // Some browsers may not allow programmatic FileList updates.
  }
}

function extractImageFileFromClipboard(event) {
  const items = event?.clipboardData?.items;
  if (!items) {
    return null;
  }

  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const blob = item.getAsFile();
      if (blob) {
        const extension = (blob.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
        return new File([blob], `clipboard-${Date.now()}.${extension || "png"}`, {
          type: blob.type || "image/png"
        });
      }
    }
  }

  return null;
}

function cropCanvasRegion(canvas, region) {
  const startX = Math.floor(clamp01(region.x) * canvas.width);
  const startY = Math.floor(clamp01(region.y) * canvas.height);
  const endX = Math.ceil(clamp01(region.x + region.w) * canvas.width);
  const endY = Math.ceil(clamp01(region.y + region.h) * canvas.height);

  const width = Math.max(1, endX - startX);
  const height = Math.max(1, endY - startY);

  const out = createCanvas(width, height);
  const context = out.getContext("2d");
  if (!context) {
    return out;
  }

  context.drawImage(canvas, startX, startY, width, height, 0, 0, width, height);
  return out;
}

function expandRegion(region, expandX = 0.015, expandY = 0.02) {
  const x = clamp01((Number(region?.x) || 0) - expandX);
  const y = clamp01((Number(region?.y) || 0) - expandY);
  const right = clamp01((Number(region?.x) || 0) + (Number(region?.w) || 0) + expandX);
  const bottom = clamp01((Number(region?.y) || 0) + (Number(region?.h) || 0) + expandY);
  return {
    x,
    y,
    w: Math.max(0.01, right - x),
    h: Math.max(0.01, bottom - y)
  };
}

function offsetRegion(region, deltaX = 0, deltaY = 0) {
  const source = region || { x: 0, y: 0, w: 0.1, h: 0.1 };
  const x = clamp01((Number(source.x) || 0) + deltaX);
  const y = clamp01((Number(source.y) || 0) + deltaY);
  const w = Math.max(0.01, Math.min(Number(source.w) || 0.1, 1 - x));
  const h = Math.max(0.01, Math.min(Number(source.h) || 0.1, 1 - y));
  return { x, y, w, h };
}

function regionFromLTRB(left, top, right, bottom) {
  const x = clamp01(left);
  const y = clamp01(top);
  const safeRight = clamp01(right);
  const safeBottom = clamp01(bottom);
  return {
    x,
    y,
    w: Math.max(0.01, safeRight - x),
    h: Math.max(0.01, safeBottom - y)
  };
}

function upscaleAndEnhance(canvas, scale = 2.2) {
  const out = createCanvas(canvas.width * scale, canvas.height * scale);
  const context = out.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return canvas;
  }

  context.imageSmoothingEnabled = true;
  context.drawImage(canvas, 0, 0, out.width, out.height);

  const imageData = context.getImageData(0, 0, out.width, out.height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    const contrasted = (gray - 128) * 1.6 + 128;
    const clipped = Math.max(0, Math.min(255, contrasted));

    pixels[index] = clipped;
    pixels[index + 1] = clipped;
    pixels[index + 2] = clipped;
  }

  context.putImageData(imageData, 0, 0);
  return out;
}

function invertCanvas(canvas) {
  const out = createCanvas(canvas.width, canvas.height);
  const context = out.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return canvas;
  }

  context.drawImage(canvas, 0, 0, out.width, out.height);
  const imageData = context.getImageData(0, 0, out.width, out.height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 255 - pixels[index];
    pixels[index + 1] = 255 - pixels[index + 1];
    pixels[index + 2] = 255 - pixels[index + 2];
  }

  context.putImageData(imageData, 0, 0);
  return out;
}

async function recognizeCanvasText(canvas, options = {}, onProgress) {
  const ocr = window.Tesseract;
  if (!ocr || typeof ocr.recognize !== "function") {
    throw new Error("OCRライブラリの読み込みに失敗しました。ページを再読み込みしてください。");
  }

  const result = await ocr.recognize(canvas, "eng", {
    ...options,
    logger: (message) => {
      if (typeof onProgress !== "function") {
        return;
      }

      if (message.status === "recognizing text" && Number.isFinite(message.progress)) {
        onProgress(`${Math.round(message.progress * 100)}%`);
      }
    }
  });

  return String(result?.data?.text || "");
}

function pickOcrPresetForImage(config, width, height) {
  const normalized = normalizeOcrLayoutConfig(config);
  const targetRatio = Number(width) > 0 && Number(height) > 0 ? Number(width) / Number(height) : 16 / 9;

  const active = normalized.presets.find((preset) => preset.id === normalized.activePresetId);
  if (active && Number.isFinite(active.aspectRatio) && Math.abs(active.aspectRatio - targetRatio) <= 0.06) {
    return active;
  }

  return [...normalized.presets].sort((a, b) => {
    const diffA = Math.abs((Number(a.aspectRatio) || 0) - targetRatio);
    const diffB = Math.abs((Number(b.aspectRatio) || 0) - targetRatio);
    return diffA - diffB;
  })[0] || getActiveOcrLayoutPreset(normalized);
}

async function parseResultImage(file, catalog, onStatus) {
  const sourceCanvas = await imageFileToCanvas(file);
  const songNames = getSongNames(catalog);
  const layoutConfig = loadOcrLayoutConfig();
  const preset = pickOcrPresetForImage(layoutConfig, sourceCanvas.width, sourceCanvas.height);
  const regions = preset.regions;

  if (typeof onStatus === "function") {
    onStatus(`画像を解析しています... (preset: ${preset.label})`);
  }

  const buttonText = await recognizeCanvasText(
    upscaleAndEnhance(cropCanvasRegion(sourceCanvas, regions.button), 2.5),
    { tessedit_char_whitelist: "4568BUTTONTUNES " },
    (progress) => {
      if (typeof onStatus === "function") {
        onStatus(`ボタン数を解析中 (${progress})`);
      }
    }
  );

  const scoreText = await recognizeCanvasText(
    upscaleAndEnhance(cropCanvasRegion(sourceCanvas, regions.score), 2.6),
    { tessedit_char_whitelist: "SCORE0123456789 " },
    (progress) => {
      if (typeof onStatus === "function") {
        onStatus(`スコアを解析中 (${progress})`);
      }
    }
  );

  const difficultyText = await recognizeCanvasText(
    upscaleAndEnhance(cropCanvasRegion(sourceCanvas, regions.difficulty), 2.4),
    { tessedit_char_whitelist: "SCNORMALHARDMAXIMUM " },
    (progress) => {
      if (typeof onStatus === "function") {
        onStatus(`難易度を解析中 (${progress})`);
      }
    }
  );

  const songText = await recognizeCanvasText(
    upscaleAndEnhance(cropCanvasRegion(sourceCanvas, regions.song), 2.0),
    {},
    (progress) => {
      if (typeof onStatus === "function") {
        onStatus(`曲名を解析中 (${progress})`);
      }
    }
  );

  let resolvedSongText = songText;
  let songCandidates = findTopSongMatches(songText, songNames, 3);

  if (!songCandidates[0] || songCandidates[0].confidence < 0.35) {
    const fallbackSongText = await recognizeCanvasText(
      upscaleAndEnhance(cropCanvasRegion(sourceCanvas, expandRegion(regions.song, 0.02, 0.025)), 2.3),
      {},
      (progress) => {
        if (typeof onStatus === "function") {
          onStatus(`曲名を再解析中 (${progress})`);
        }
      }
    );

    const fallbackSongCandidates = findTopSongMatches(fallbackSongText, songNames, 3);
    if (fallbackSongCandidates[0] && fallbackSongCandidates[0].confidence >= (songCandidates[0]?.confidence || 0)) {
      resolvedSongText = fallbackSongText;
      songCandidates = fallbackSongCandidates;
    }
  }

  const button = extractButtonFromText(buttonText);
  const score = extractScoreFromText(scoreText);
  const bestSongMatch = songCandidates[0] || { song: "", confidence: 0, source: "" };
  const preferredSong = bestSongMatch.confidence >= 0.35 ? bestSongMatch.song : "";
  const availableDifficulties = preferredSong && button
    ? getDifficultiesForSong(catalog, preferredSong, button)
    : (catalog.difficulties || []);
  // Difficulty should be read from dedicated region only.
  // Mixing song text causes false positives for titles containing "MAX".
  let mergedDifficultyText = difficultyText;
  let difficulty = extractDifficultyFromText(mergedDifficultyText, availableDifficulties);

  if (!difficulty) {
    const fallbackDifficultyText = await recognizeCanvasText(
      upscaleAndEnhance(cropCanvasRegion(sourceCanvas, expandRegion(regions.difficulty, 0.012, 0.02)), 2.8),
      { tessedit_char_whitelist: "SCNORMALHARDMAXIMUM$5C " },
      (progress) => {
        if (typeof onStatus === "function") {
          onStatus(`難易度を再解析中 (${progress})`);
        }
      }
    );

    mergedDifficultyText = `${mergedDifficultyText}\n${fallbackDifficultyText}`.trim();
    difficulty = extractDifficultyFromText(mergedDifficultyText, availableDifficulties);
  }

  if (!difficulty) {
    const expandedDifficultyCanvas = upscaleAndEnhance(
      cropCanvasRegion(sourceCanvas, expandRegion(regions.difficulty, 0.02, 0.028)),
      3.0
    );

    const keywordDifficultyText = await recognizeCanvasText(
      expandedDifficultyCanvas,
      {
        tessedit_char_whitelist: "SCNORMALHARDMAXIMUM$5C ",
        tessedit_pageseg_mode: "7"
      },
      (progress) => {
        if (typeof onStatus === "function") {
          onStatus(`難易度キーワードを再解析中 (${progress})`);
        }
      }
    );

    const keywordDifficultyTextInverted = await recognizeCanvasText(
      invertCanvas(expandedDifficultyCanvas),
      {
        tessedit_char_whitelist: "SCNORMALHARDMAXIMUM$5C ",
        tessedit_pageseg_mode: "7"
      },
      (progress) => {
        if (typeof onStatus === "function") {
          onStatus(`難易度キーワード(反転)を再解析中 (${progress})`);
        }
      }
    );

    mergedDifficultyText = `${mergedDifficultyText}\n${keywordDifficultyText}\n${keywordDifficultyTextInverted}`.trim();
    difficulty = extractDifficultyFromText(mergedDifficultyText, availableDifficulties);
  }

  if (!difficulty) {
    const scProbeText = await recognizeCanvasText(
      upscaleAndEnhance(cropCanvasRegion(sourceCanvas, expandRegion(regions.difficulty, 0.018, 0.024)), 3.2),
      {
        tessedit_char_whitelist: "SC$5 ",
        tessedit_pageseg_mode: "7"
      },
      (progress) => {
        if (typeof onStatus === "function") {
          onStatus(`難易度SCを再解析中 (${progress})`);
        }
      }
    );

    mergedDifficultyText = `${mergedDifficultyText}\n${scProbeText}`.trim();
    if (availableDifficulties.includes("SC") && /[SC$5]{1,2}/i.test(normalizeOcrTypos(scProbeText))) {
      difficulty = "SC";
    }
  }

  if (!difficulty) {
    const shiftedRegionTexts = [];
    const baseDifficultyRegion = expandRegion(regions.difficulty, 0.02, 0.03);
    const shiftCandidates = [
      { dx: 0, dy: 0 },
      { dx: -0.008, dy: 0 },
      { dx: 0.008, dy: 0 },
      { dx: 0, dy: -0.008 },
      { dx: 0, dy: 0.008 }
    ];

    for (const shift of shiftCandidates) {
      const shiftedText = await recognizeCanvasText(
        upscaleAndEnhance(cropCanvasRegion(sourceCanvas, offsetRegion(baseDifficultyRegion, shift.dx, shift.dy)), 2.9),
        {
          tessedit_char_whitelist: "SCNORMALHARDMAXIMUM$5C ",
          tessedit_pageseg_mode: "7"
        }
      );
      shiftedRegionTexts.push(shiftedText);
    }

    mergedDifficultyText = `${mergedDifficultyText}\n${shiftedRegionTexts.join("\n")}`.trim();
    difficulty = extractDifficultyFromText(mergedDifficultyText, availableDifficulties);
  }

  if (!difficulty && availableDifficulties.includes("MAXIMUM")) {
    const normalizedDifficultyText = normalizeOcrTypos(mergedDifficultyText)
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ");

    // MAXIMUM label is often misread as short MAX-like fragments.
    if (/\bMAX(?:IMUM)?\b|\bM4X(?:IMUM)?\b|\bMXM\b|\bMAXIM\b/.test(normalizedDifficultyText)) {
      difficulty = "MAXIMUM";
    }
  }

  if (!difficulty) {
    const sweepRegions = [];
    const baseDifficultyRegion = expandRegion(regions.difficulty, 0.02, 0.03);
    sweepRegions.push(baseDifficultyRegion);
    sweepRegions.push(offsetRegion(baseDifficultyRegion, -0.02, 0));
    sweepRegions.push(offsetRegion(baseDifficultyRegion, 0.02, 0));
    sweepRegions.push(offsetRegion(baseDifficultyRegion, 0, -0.015));
    sweepRegions.push(offsetRegion(baseDifficultyRegion, 0, 0.015));

    // Header band around the song title where difficulty badge often appears.
    const song = regions.song;
    sweepRegions.push(regionFromLTRB(
      (song.x || 0) - 0.055,
      (song.y || 0) + 0.042,
      (song.x || 0) + 0.17,
      (song.y || 0) + 0.122
    ));
    sweepRegions.push(regionFromLTRB(
      (song.x || 0) - 0.02,
      (song.y || 0) + 0.05,
      (song.x || 0) + 0.2,
      (song.y || 0) + 0.14
    ));

    const sweepTexts = [];
    for (let index = 0; index < sweepRegions.length; index += 1) {
      const region = sweepRegions[index];
      const sweepText = await recognizeCanvasText(
        upscaleAndEnhance(cropCanvasRegion(sourceCanvas, region), 3.1),
        {
          tessedit_char_whitelist: "SCNORMALHARDMAXIMUM$5C ",
          tessedit_pageseg_mode: "7"
        },
        (progress) => {
          if (typeof onStatus === "function") {
            onStatus(`難易度バッジ探索中 (${index + 1}/${sweepRegions.length}, ${progress})`);
          }
        }
      );

      sweepTexts.push(sweepText);
      const sweepDetected = extractDifficultyFromText(sweepText, availableDifficulties);
      if (sweepDetected) {
        difficulty = sweepDetected;
        break;
      }
    }

    if (!difficulty) {
      mergedDifficultyText = `${mergedDifficultyText}\n${sweepTexts.join("\n")}`.trim();
      difficulty = extractDifficultyFromText(mergedDifficultyText, availableDifficulties);
    } else {
      mergedDifficultyText = `${mergedDifficultyText}\n${sweepTexts.join("\n")}`.trim();
    }
  }

  // If chart metadata already narrows down to one difficulty, prefer that over blank OCR.
  if (!difficulty && availableDifficulties.length === 1) {
    difficulty = availableDifficulties[0];
  }

  return {
    presetId: preset.id,
    presetLabel: preset.label,
    button,
    difficulty,
    availableDifficulties,
    score,
    song: bestSongMatch.confidence >= 0.35 ? bestSongMatch.song : "",
    songCandidates,
    songConfidence: bestSongMatch.confidence,
    rawSong: bestSongMatch.source || resolvedSongText.trim(),
    rawButton: buttonText,
    rawScore: scoreText,
    rawDifficulty: mergedDifficultyText
  };
}

function initRanking(catalog, recordsRef) {
  const userSelect = document.getElementById("filter-user");
  const userMultiToggle = document.getElementById("filter-user-multi");
  const userExtraList = document.getElementById("filter-user-extra-list");
  const userAddButton = document.getElementById("filter-user-add");
  const songSelect = document.getElementById("filter-song");
  const buttonSelect = document.getElementById("filter-button");
  const difficultySelect = document.getElementById("filter-difficulty");
  let latestUsers = [];

  const setSelectValueIfExists = (select, value) => {
    if (!select) {
      return;
    }

    const hasValue = Array.from(select.options).some((option) => option.value === value);
    select.value = hasValue ? value : "";
  };

  const getExtraUserSelects = () => {
    if (!userExtraList) {
      return [];
    }

    return Array.from(userExtraList.querySelectorAll("select"));
  };

  const updateUserAddButtonState = () => {
    if (!userAddButton) {
      return;
    }

    if (!userMultiToggle?.checked) {
      userAddButton.hidden = true;
      userAddButton.disabled = false;
      userAddButton.title = "";
      return;
    }

    const maxExtraSelectCount = Math.max(0, latestUsers.length - 1);
    const currentExtraSelectCount = getExtraUserSelects().length;
    const canAdd = currentExtraSelectCount < maxExtraSelectCount;

    userAddButton.hidden = !canAdd;
    userAddButton.disabled = false;
    userAddButton.title = "";
  };

  const addUserExtraSelect = (selectedValue = "") => {
    if (!userExtraList) {
      return;
    }

    const maxExtraSelectCount = Math.max(0, latestUsers.length - 1);
    if (getExtraUserSelects().length >= maxExtraSelectCount) {
      updateUserAddButtonState();
      return;
    }

    const row = document.createElement("div");
    row.className = "filter-user-extra-row";

    const select = document.createElement("select");
    setSelectOptions(select, latestUsers, "すべて");
    if (selectedValue && latestUsers.includes(selectedValue)) {
      select.value = selectedValue;
    }
    select.addEventListener("change", rerender);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "secondary user-remove-btn";
    removeButton.textContent = "削除";
    removeButton.addEventListener("click", () => {
      row.remove();
      updateUserAddButtonState();
      rerender();
    });

    row.appendChild(select);
    row.appendChild(removeButton);
    userExtraList.appendChild(row);
    updateUserAddButtonState();
  };

  const setUserFilterMode = (enabled) => {
    if (!userExtraList || !userAddButton) {
      return;
    }

    userExtraList.hidden = !enabled;
    userAddButton.hidden = !enabled;

    if (!enabled) {
      userExtraList.innerHTML = "";
      updateUserAddButtonState();
      return;
    }

    if (userExtraList.children.length === 0) {
      addUserExtraSelect("");
    }

    updateUserAddButtonState();
  };

  const getSelectedUsersFromDropdowns = () => {
    if (!userSelect || !userMultiToggle?.checked) {
      return [];
    }

    const users = [userSelect.value, ...getExtraUserSelects().map((select) => select.value)]
      .filter(Boolean);
    return [...new Set(users)];
  };

  const rerender = () => {
    const records = recordsRef.get();

    latestUsers = uniqueSorted([...catalog.users, ...records.map((r) => r.user)]);
    const songs = uniqueSorted([...getSongNames(catalog), ...records.map((r) => r.song)]);
    const buttons = uniqueSorted([...catalog.buttons, ...records.map((r) => r.button)]);
    const diffs = sortDifficulties([...catalog.difficulties, ...records.map((r) => r.difficulty)]);

    setSelectOptions(userSelect, latestUsers, "すべて");
    for (const extraSelect of getExtraUserSelects()) {
      setSelectOptions(extraSelect, latestUsers, "すべて");
    }
    updateUserAddButtonState();
    setSelectOptions(songSelect, songs, "すべて");
    setSelectOptions(buttonSelect, buttons, "すべて");
    setSelectOptions(difficultySelect, diffs, "すべて");

    const isUserMulti = Boolean(userMultiToggle?.checked);

    const filters = {
      users: isUserMulti ? getSelectedUsersFromDropdowns() : [],
      user: !isUserMulti ? (userSelect?.value || "") : "",
      song: songSelect?.value || "",
      songQuery: document.getElementById("filter-song-query")?.value || "",
      button: buttonSelect?.value || "",
      difficulty: difficultySelect?.value || "",
      recentLimit: document.getElementById("filter-recent-limit")?.value || ""
    };

    const filtered = applyFilters(records, filters);
    const recentOnly = applyRecentUpdateLimit(filtered, filters.recentLimit);
    const rows = toRankingRows(recentOnly);
    renderTable(rows, (chart) => {
      setSelectValueIfExists(songSelect, chart.song);
      setSelectValueIfExists(buttonSelect, chart.button);
      setSelectValueIfExists(difficultySelect, chart.difficulty);
      rerender();
    });
  };

  for (const id of ["filter-user", "filter-song", "filter-song-query", "filter-button", "filter-difficulty", "filter-recent-limit"]) {
    document.getElementById(id)?.addEventListener("change", rerender);
  }
  document.getElementById("filter-song-query")?.addEventListener("input", rerender);
  userAddButton?.addEventListener("click", () => {
    addUserExtraSelect("");
  });

  userMultiToggle?.addEventListener("change", () => {
    setUserFilterMode(Boolean(userMultiToggle.checked));
    rerender();
  });

  document.getElementById("clear-filters")?.addEventListener("click", () => {
    if (userSelect) {
      userSelect.value = "";
    }

    if (userExtraList) {
      if (userMultiToggle?.checked) {
        userExtraList.innerHTML = "";
        addUserExtraSelect("");
      } else {
        userExtraList.innerHTML = "";
      }
    }

    for (const id of ["filter-user", "filter-song", "filter-button", "filter-difficulty"]) {
      if (id === "filter-user") {
        continue;
      }
      const select = document.getElementById(id);
      if (select) {
        select.value = "";
      }
    }
    const songQueryInput = document.getElementById("filter-song-query");
    if (songQueryInput) {
      songQueryInput.value = "";
    }
    const recentLimitSelect = document.getElementById("filter-recent-limit");
    if (recentLimitSelect) {
      recentLimitSelect.value = "";
    }
    rerender();
  });

  setUserFilterMode(Boolean(userMultiToggle?.checked));
  rerender();
  return rerender;
}

function initScoreEntry(catalog, recordsRef, rerenderRanking) {
  const entryUser = document.getElementById("entry-user");
  const songFilter = document.getElementById("song-filter");
  const entrySong = document.getElementById("entry-song");
  const scoreInput = document.getElementById("entry-score");
  const resultImageInput = document.getElementById("result-image-input");
  const resultImageParseButton = document.getElementById("result-image-parse");
  const ocrSongCandidates = document.getElementById("ocr-song-candidates");
  const ocrMessage = document.getElementById("ocr-message");
  const ocrDebugOutput = document.getElementById("ocr-debug-output");
  const form = document.getElementById("user-score-form");
  const message = document.getElementById("entry-message");

  if (!entryUser || !songFilter || !entrySong || !scoreInput || !form || !message) {
    return;
  }

  setSelectOptions(entryUser, uniqueSorted(catalog.users));

  const state = {
    button: catalog.buttons[0] || "",
    difficulty: catalog.difficulties[0] || ""
  };

  const refreshDifficultyButtons = () => {
    const selectedSong = entrySong.value;
    const available = getDifficultiesForSong(catalog, selectedSong, state.button);

    if (!available.includes(state.difficulty)) {
      state.difficulty = available[0] || "";
    }

    const hidden = catalog.difficulties.filter((d) => !available.includes(d));
    renderChoiceButtons("entry-difficulty-group", catalog.difficulties, state.difficulty, (value) => {
      if (!available.includes(value)) {
        return;
      }
      state.difficulty = value;
      refreshDifficultyButtons();
    }, hidden);
  };

  const refreshSongs = () => {
    const query = songFilter.value.trim().toLowerCase();
    const allSongs = getSongNames(catalog);
    const filtered = allSongs.filter((song) => song.toLowerCase().includes(query));

    const previous = entrySong.value;
    setSelectOptions(entrySong, filtered);

    if (filtered.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "一致する曲がありません";
      entrySong.innerHTML = "";
      entrySong.appendChild(option);
      entrySong.value = "";
    } else if (filtered.includes(previous)) {
      entrySong.value = previous;
    } else {
      entrySong.value = filtered[0];
    }

    refreshDifficultyButtons();
  };

  const rerenderButtons = () => {
    renderChoiceButtons("entry-button-group", catalog.buttons, state.button, (value) => {
      state.button = value;
      rerenderButtons();
      refreshDifficultyButtons();
    });
  };
  rerenderButtons();

  refreshSongs();

  songFilter.addEventListener("input", refreshSongs);
  entrySong.addEventListener("change", refreshDifficultyButtons);

  const setButtonValue = (value) => {
    if (!value || !catalog.buttons.includes(value)) {
      return false;
    }

    state.button = value;
    rerenderButtons();
    refreshDifficultyButtons();
    return true;
  };

  const setSongValue = (value) => {
    if (!value) {
      return false;
    }

    const hasTargetSong = getSongNames(catalog).includes(value);
    if (!hasTargetSong) {
      return false;
    }

    const optionValues = Array.from(entrySong.options).map((option) => option.value);
    if (!optionValues.includes(value)) {
      songFilter.value = "";
      refreshSongs();
    }

    entrySong.value = value;
    refreshDifficultyButtons();
    return true;
  };

  const setDifficultyValue = (value) => {
    if (!value) {
      return false;
    }

    const available = getDifficultiesForSong(catalog, entrySong.value, state.button);
    if (!available.includes(value)) {
      return false;
    }

    state.difficulty = value;
    refreshDifficultyButtons();
    return true;
  };

  const renderSongCandidates = (candidates) => {
    if (!ocrSongCandidates) {
      return;
    }

    ocrSongCandidates.innerHTML = "";
    const safeCandidates = Array.isArray(candidates) ? candidates : [];

    for (const candidate of safeCandidates) {
      if (!candidate || !candidate.song) {
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "ocr-song-candidate-btn";
      const confidence = Math.round((Number(candidate.confidence) || 0) * 100);
      button.textContent = `${candidate.song} (${confidence}%)`;
      button.addEventListener("click", () => {
        const applied = setSongValue(candidate.song);
        if (ocrMessage) {
          ocrMessage.textContent = applied
            ? `候補から曲名を適用しました: ${candidate.song}`
            : "候補の適用に失敗しました。";
        }
      });
      ocrSongCandidates.appendChild(button);
    }
  };

  const runOcrImport = async (file, sourceLabel = "ファイル") => {
    if (!(file instanceof File)) {
      if (ocrMessage) {
        ocrMessage.textContent = "画像ファイルが見つかりません。";
      }
      return;
    }

    if (resultImageParseButton) {
      resultImageParseButton.disabled = true;
    }

    try {
      const parsed = await parseResultImage(file, catalog, (status) => {
        if (ocrMessage) {
          ocrMessage.textContent = status;
        }
      });

      if (ocrDebugOutput) {
        const songCandidates = (parsed.songCandidates || [])
          .map((candidate) => `${candidate.song} (${Math.round((Number(candidate.confidence) || 0) * 100)}%)`)
          .join("\n") || "-";

        ocrDebugOutput.textContent = [
          `preset: ${parsed.presetLabel || parsed.presetId || "-"}`,
          `button: ${parsed.button || "未検出"}`,
          `difficulty_detected: ${parsed.difficulty || "未検出"}`,
          `difficulty_allowed: ${(parsed.availableDifficulties || []).join(", ") || "-"}`,
          `score: ${parsed.score || 0}`,
          "",
          "[raw difficulty OCR]",
          parsed.rawDifficulty || "",
          "",
          "[raw song OCR]",
          parsed.rawSong || "",
          "",
          "[raw button OCR]",
          parsed.rawButton || "",
          "",
          "[raw score OCR]",
          parsed.rawScore || "",
          "",
          "[song candidates]",
          songCandidates
        ].join("\n");
      }

      renderSongCandidates(parsed.songCandidates);

      const applied = [];
      const notes = [];

      if (setSongValue(parsed.song)) {
        applied.push(`曲名: ${parsed.song}`);
      }

      if (setButtonValue(parsed.button)) {
        applied.push(`ボタン数: ${parsed.button}`);
      }

      const difficultyApplied = setDifficultyValue(parsed.difficulty);
      if (difficultyApplied) {
        applied.push(`難易度: ${parsed.difficulty}`);
      } else if (parsed.difficulty) {
        notes.push(`難易度候補: ${parsed.difficulty} (この曲/ボタンの候補外)`);
      } else {
        notes.push("難易度候補: 未検出");
      }

      if (Number.isFinite(parsed.score) && parsed.score > 0) {
        scoreInput.value = String(parsed.score);
        applied.push(`スコア: ${parsed.score.toLocaleString("ja-JP")}`);
      }

      if (ocrMessage) {
        if (applied.length > 0) {
          const suffix = notes.length > 0 ? ` / ${notes.join(" / ")}` : "";
          ocrMessage.textContent = `${sourceLabel}から自動入力しました (${applied.join(" / ")}${suffix})`;
        } else {
          ocrMessage.textContent = `読み取りに失敗しました。画像を変えるか手入力で修正してください。${notes.length > 0 ? ` (${notes.join(" / ")})` : ""}`;
        }
      }
    } catch (error) {
      renderSongCandidates([]);
      if (ocrMessage) {
        ocrMessage.textContent = `画像解析エラー: ${error instanceof Error ? error.message : "不明なエラー"}`;
      }
    } finally {
      if (resultImageParseButton) {
        resultImageParseButton.disabled = false;
      }
    }
  };

  resultImageParseButton?.addEventListener("click", async () => {
    const file = resultImageInput?.files?.[0];
    if (!file) {
      if (ocrMessage) {
        ocrMessage.textContent = "先に画像ファイルを選択してください。";
      }
      return;
    }
    await runOcrImport(file, "ファイル");
  });

  document.addEventListener("paste", async (event) => {
    const pastedImageFile = extractImageFileFromClipboard(event);
    if (!pastedImageFile) {
      return;
    }

    event.preventDefault();
    setFileToInput(resultImageInput, pastedImageFile);
    await runOcrImport(pastedImageFile, "クリップボード");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const user = entryUser.value;
    const song = entrySong.value;
    const button = state.button;
    const difficulty = state.difficulty;
    const score = Number(scoreInput.value || 0);

    if (!user || !song || !button || !difficulty || score < 0) {
      message.textContent = "入力内容を確認してください。";
      return;
    }

    // 登録前に同一曲+ボタン+難易度の全ユーザー最高スコアを確認
    const prevBest = recordsRef.get()
      .filter((r) => r.song === song && r.button === button && r.difficulty === difficulty)
      .reduce((max, r) => Math.max(max, Number(r.score)), -Infinity);
    const isNewBest = score > prevBest || prevBest === -Infinity;

    const payload = {
      id: crypto.randomUUID(),
      user,
      song,
      button,
      difficulty,
      score,
      createdAt: new Date().toISOString()
    };

    // Optimistically update local state before the async call.
    const nextRecords = [...recordsRef.get(), payload];
    recordsRef.set(nextRecords);

    if (isRemoteEnabled()) showLoading("保存中...");
    let saveResult;
    try {
      // Use addSharedRecord instead of saveSharedState to avoid lost-update
      // races: the server atomically appends within a lock rather than
      // overwriting the full state with potentially stale client data.
      saveResult = await addSharedRecord(payload);
      // Sync local records ref with the authoritative server state if available.
      const synced = loadRecords();
      recordsRef.set(synced);
    } finally {
      hideLoading();
    }
    message.textContent = saveResult.ok
      ? `${user} / ${song} のスコアを登録しました。`
      : `ローカル保存のみ成功。共有反映失敗: ${saveResult.error}`;

    if (isNewBest) {
      showDaikoFun();
    }

    scoreInput.value = "";
    scoreInput.focus();
    rerenderRanking();
  });
}

function showDaikoFun() {
  const overlay = document.getElementById("daiko-fun-overlay");
  if (!overlay) return;

  overlay.hidden = false;

  const dismiss = () => {
    overlay.hidden = true;
    overlay.removeEventListener("click", dismiss);
    clearTimeout(timer);
  };

  overlay.addEventListener("click", dismiss);
  const timer = setTimeout(dismiss, 4000);
}

async function main() {
  await initPasswordGate();

  if (isRemoteEnabled()) showLoading("OCRレイアウトを読み込み中...");
  let ocrLayoutLoadResult;
  try {
    ocrLayoutLoadResult = await loadSharedOcrLayoutConfig();
  } finally {
    hideLoading();
  }

  if (isRemoteEnabled()) showLoading("データを読み込み中...");
  let shared;
  try {
    shared = await loadSharedState();
  } finally {
    hideLoading();
  }
  const catalog = shared.catalog;
  let records = shared.records;

  const recordsRef = {
    get: () => records,
    set: (next) => {
      records = next;
    }
  };

  const count = document.getElementById("record-count");
  const message = document.getElementById("entry-message");
  const ocrMessage = document.getElementById("ocr-message");

  if (shared.source === "local-fallback") {
    if (count) {
      count.textContent = "ローカル表示 (共有API接続失敗)";
    }
    if (message) {
      message.textContent = "共有API接続失敗のためローカル保存モードです。";
    }
  }

  if (ocrLayoutLoadResult?.source === "local-fallback" && ocrMessage) {
    ocrMessage.textContent = "共有OCRレイアウト取得に失敗したため、ローカル設定を使用します。";
  }

  const rerenderRanking = initRanking(catalog, recordsRef);
  initScoreEntry(catalog, recordsRef, rerenderRanking);

  const scoreFormToggle = document.getElementById("score-form-toggle");
  const scoreFormBody = document.getElementById("score-form-body");
  if (scoreFormToggle && scoreFormBody) {
    scoreFormToggle.addEventListener("click", () => {
      const isOpen = scoreFormToggle.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        scoreFormBody.classList.add("is-collapsed");
        scoreFormToggle.setAttribute("aria-expanded", "false");
        scoreFormToggle.textContent = "開く";
      } else {
        scoreFormBody.classList.remove("is-collapsed");
        scoreFormToggle.setAttribute("aria-expanded", "true");
        scoreFormToggle.textContent = "閉じる";
      }
    });
  }
}

main();
