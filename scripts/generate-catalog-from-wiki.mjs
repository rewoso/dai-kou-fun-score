#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const BUTTONS = ["4B", "5B", "6B", "8B"];
const DIFF_LABELS = {
  N: "NORMAL",
  H: "HARD",
  M: "MAXIMUM",
  S: "SC"
};

function parseArgs(argv) {
  const args = { in: "", out: "catalog.from-wiki.json" };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--in" && argv[i + 1]) {
      args.in = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--out" && argv[i + 1]) {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--help" || a === "-h") {
      args.help = true;
      continue;
    }
  }

  return args;
}

function printHelp() {
  console.log("Usage: node scripts/generate-catalog-from-wiki.mjs --in <saved-wiki-html> [--out <output-json>]");
  console.log("");
  console.log("Example:");
  console.log("  node scripts/generate-catalog-from-wiki.mjs --in ./wiki-169.html --out ./catalog.from-wiki.json");
}

function decodeHtmlEntities(text) {
  const named = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'"
  };

  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in named ? named[name] : m));
}

function textFromHtml(html) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<\/?(span|b|strong|em|i|u|small|font|div)\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractTableRows(tableHtml) {
  const rows = [];
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    const rowHtml = trMatch[1];
    const cells = [];
    const cellRegex = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(textFromHtml(cellMatch[2]));
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  return rows;
}

function normalizeHeader(text) {
  return text.replace(/\s+/g, "").toUpperCase();
}

function findTargetTable(html) {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((m) => m[0]);

  let best = null;
  for (const tableHtml of tables) {
    const rows = extractTableRows(tableHtml);
    if (rows.length === 0) {
      continue;
    }

    const header = rows[0].map(normalizeHeader);
    const hasSong = header.some((h) => h.includes("曲名") || h === "MUSIC" || h.includes("SONG"));
    if (!hasSong) {
      continue;
    }

    const chartCols = header.filter((h) => /^(4|5|6|8)(N|H|M|S)$/.test(h)).length;
    const score = chartCols * 10 + (hasSong ? 5 : 0);

    if (!best || score > best.score) {
      best = { score, rows };
    }
  }

  return best ? best.rows : null;
}

function isExistingChart(value) {
  const v = String(value || "").trim();
  if (!v) {
    return false;
  }
  if (/^(-|--|---|―|×|X|x|N\/A)$/i.test(v)) {
    return false;
  }
  return true;
}

function buildCatalogPayload(rows, sourcePath) {
  const header = rows[0];
  const normalizedHeader = header.map(normalizeHeader);

  const songCol = normalizedHeader.findIndex((h) => h.includes("曲名") || h === "MUSIC" || h.includes("SONG"));
  if (songCol < 0) {
    throw new Error("曲名列を見つけられませんでした。");
  }

  const colMap = {};
  for (const button of ["4", "5", "6", "8"]) {
    for (const diffCode of Object.keys(DIFF_LABELS)) {
      const key = `${button}${diffCode}`;
      const index = normalizedHeader.findIndex((h) => h === key);
      if (index >= 0) {
        colMap[key] = index;
      }
    }
  }

  const songs = [];
  for (const row of rows.slice(1)) {
    const name = String(row[songCol] || "").trim();
    if (!name) {
      continue;
    }

    const difficultiesByButton = {};

    for (const button of ["4", "5", "6", "8"]) {
      const buttonKey = `${button}B`;
      const diffs = [];

      for (const diffCode of Object.keys(DIFF_LABELS)) {
        const key = `${button}${diffCode}`;
        const col = colMap[key];
        if (col === undefined) {
          continue;
        }

        if (isExistingChart(row[col])) {
          diffs.push(DIFF_LABELS[diffCode]);
        }
      }

      if (diffs.length > 0) {
        difficultiesByButton[buttonKey] = diffs;
      }
    }

    const difficulties = [...new Set(Object.values(difficultiesByButton).flat())];
    if (difficulties.length === 0) {
      continue;
    }

    songs.push({
      name,
      difficulties,
      difficultiesByButton
    });
  }

  const deduped = [];
  const byName = new Map();

  for (const song of songs) {
    const existing = byName.get(song.name);
    if (!existing) {
      const next = {
        name: song.name,
        difficulties: [...song.difficulties],
        difficultiesByButton: { ...song.difficultiesByButton }
      };
      byName.set(song.name, next);
      deduped.push(next);
      continue;
    }

    for (const button of BUTTONS) {
      const merged = [
        ...((existing.difficultiesByButton && existing.difficultiesByButton[button]) || []),
        ...((song.difficultiesByButton && song.difficultiesByButton[button]) || [])
      ];
      if (merged.length > 0) {
        existing.difficultiesByButton[button] = [...new Set(merged)];
      }
    }

    existing.difficulties = [...new Set([
      ...existing.difficulties,
      ...song.difficulties
    ])];
  }

  const payload = {
    metadata: {
      source: sourcePath,
      generatedAt: new Date().toISOString(),
      songCount: deduped.length
    },
    catalog: {
      users: ["PLAYER-1"],
      buttons: [...BUTTONS],
      difficulties: ["NORMAL", "HARD", "MAXIMUM", "SC"],
      songs: deduped
    },
    records: []
  };

  return payload;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help || !args.in) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = path.resolve(process.cwd(), args.in);
  const outputPath = path.resolve(process.cwd(), args.out);

  const html = await fs.readFile(inputPath, "utf8");
  const rows = findTargetTable(html);

  if (!rows) {
    throw new Error("対象テーブルを見つけられませんでした。保存したHTMLが正しいか確認してください。");
  }

  const payload = buildCatalogPayload(rows, inputPath);
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Generated: ${outputPath}`);
  console.log(`Songs: ${payload.catalog.songs.length}`);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
