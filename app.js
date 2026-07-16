function applyFilters(records, filters) {
  return records.filter((record) => {
    const userOk = !filters.user || record.user === filters.user;
    const songOk = !filters.song || record.song === filters.song;
    const buttonOk = !filters.button || record.button === filters.button;
    const diffOk = !filters.difficulty || record.difficulty === filters.difficulty;
    return userOk && songOk && buttonOk && diffOk;
  });
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

function fillFilterOptions(catalog, records) {
  const users = uniqueSorted([...catalog.users, ...records.map((r) => r.user)]);
  const songs = uniqueSorted([...catalog.songs, ...records.map((r) => r.song)]);
  const buttons = uniqueSorted([...catalog.buttons, ...records.map((r) => r.button)]);
  const difficulties = uniqueSorted([...catalog.difficulties, ...records.map((r) => r.difficulty)]);

  const mappings = [
    ["filter-user", users],
    ["filter-song", songs],
    ["filter-button", buttons],
    ["filter-difficulty", difficulties]
  ];

  for (const [id, options] of mappings) {
    const select = document.getElementById(id);
    if (!select) {
      continue;
    }

    for (const value of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
  }
}

function renderTable(rows) {
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
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${row.user}</td>
      <td>${row.song}</td>
      <td>${row.button}</td>
      <td>${row.difficulty}</td>
      <td>${Number(row.score).toLocaleString("ja-JP")}</td>
      <td>${formatDate(row.createdAt)}</td>
    `;
    body.appendChild(tr);
  }
}

function initFilters(catalog, records) {
  const filterIds = ["filter-user", "filter-song", "filter-button", "filter-difficulty"];
  fillFilterOptions(catalog, records);

  const getFilters = () => ({
    user: document.getElementById("filter-user")?.value || "",
    song: document.getElementById("filter-song")?.value || "",
    button: document.getElementById("filter-button")?.value || "",
    difficulty: document.getElementById("filter-difficulty")?.value || ""
  });

  const rerender = () => {
    const filtered = applyFilters(records, getFilters());
    const rows = toRankingRows(filtered);
    renderTable(rows);
  };

  for (const id of filterIds) {
    const select = document.getElementById(id);
    select?.addEventListener("change", rerender);
  }

  document.getElementById("clear-filters")?.addEventListener("click", () => {
    for (const id of filterIds) {
      const select = document.getElementById(id);
      if (select) {
        select.value = "";
      }
    }
    rerender();
  });

  rerender();
}

async function main() {
  await initPasswordGate();

  const shared = await loadSharedState();
  const catalog = shared.catalog;
  const records = shared.records;

  const count = document.getElementById("record-count");
  if (count && shared.source === "local-fallback") {
    count.textContent = "ローカル表示 (共有API接続失敗)";
  }

  initFilters(catalog, records);
}

main();
