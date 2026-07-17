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

      const mobileSongMeta = document.createElement("div");
      mobileSongMeta.className = "mobile-song-meta";
      mobileSongMeta.innerHTML = `
        <span class="button-pill ${getButtonDisplayClass(row.button)}">${row.button}</span>
        <span class="difficulty-pill ${getDifficultyDisplayClass(row.difficulty)}">${row.difficulty}</span>
      `;
      songCell.appendChild(mobileSongMeta);
    }

    const scoreCell = tr.children[5];
    if (scoreCell) {
      const mobileScoreRate = document.createElement("div");
      mobileScoreRate.className = "mobile-score-rate";
      mobileScoreRate.textContent = `(${scoreRate}%)`;
      scoreCell.appendChild(mobileScoreRate);
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

  if (shared.source === "local-fallback") {
    if (count) {
      count.textContent = "ローカル表示 (共有API接続失敗)";
    }
    if (message) {
      message.textContent = "共有API接続失敗のためローカル保存モードです。";
    }
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
