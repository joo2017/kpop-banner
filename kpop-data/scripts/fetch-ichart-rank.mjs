import { mkdir, writeFile } from "node:fs/promises";
import { load } from "cheerio";
import { localizeImage } from "./lib/localize-image.mjs";

const SOURCE_URL = "https://ichart.kr/rank";
const API_BASE_URL = "https://api.instiz.net";
const OUTPUT_DIR = new URL("../dist/", import.meta.url);
const OUTPUT_FILE = new URL("../dist/ichart-banner.json", import.meta.url);
const REQUEST_TIMEOUT_MS = 15000;

function kstNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const pick = (type) => parts.find((p) => p.type === type)?.value || "00";
  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

function timeoutSignal(ms = REQUEST_TIMEOUT_MS) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function nowKstIso() {
  const { year, month, day, hour, minute, second } = kstNowParts();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hour}:${minute}:${second}+09:00`;
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseMovement(rowHtml, movementTextRaw) {
  const movementText = normalizeText(movementTextRaw || "");
  let type = "unknown";

  if (/no-change\.svg/.test(rowHtml)) {
    type = "no_change";
  } else if (/up\.svg/.test(rowHtml)) {
    type = "up";
  } else if (/down\.svg/.test(rowHtml)) {
    type = "down";
  }

  const valueMatch = movementText.match(/\d+/);
  const value = valueMatch ? Number(valueMatch[0]) : 0;

  return {
    type,
    value,
    raw: movementText,
  };
}

async function fetchScoreDetail(songId) {
  try {
    const response = await fetch(`${API_BASE_URL}/v2/ichart/score/detail/${songId}`, {
      headers: {
        accept: "application/json",
        origin: "https://ichart.kr",
        referer: "https://ichart.kr/rank",
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      signal: timeoutSignal(),
    });

    if (!response.ok) {
      return { headers: [], rows: [] };
    }

    return response.json();
  } catch {
    return { headers: [], rows: [] };
  }
}

async function fetchRealTimeChartData() {
  try {
    const response = await fetch(`${API_BASE_URL}/v2/ichart/score/real`, {
      headers: {
        accept: "application/json",
        origin: "https://ichart.kr",
        referer: "https://ichart.kr/rank",
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      signal: timeoutSignal(),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

async function fetchWeeklyChartData(yearWeek) {
  try {
    const url = yearWeek
      ? `${API_BASE_URL}/v2/ichart/score/week?year_week=${yearWeek}`
      : `${API_BASE_URL}/v2/ichart/score/week`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        origin: "https://ichart.kr",
        referer: "https://ichart.kr/rank",
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      signal: timeoutSignal(),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

function normalizeScoreDetail(scoreDetail) {
  const headers = Array.isArray(scoreDetail?.headers) ? scoreDetail.headers : [];
  const rows = Array.isArray(scoreDetail?.rows) ? scoreDetail.rows : [];

  const platformBreakdown = rows.flatMap((platformRow) => {
    const platform = platformRow?.label || "unknown";
    const dataRows = Array.isArray(platformRow?.data) ? platformRow.data : [];

    return dataRows.map((entry) => ({
      platform,
      chartName: entry?.chart || "",
      rank: Number(entry?.rank) || null,
      score: Number(entry?.score) || null,
      originScore: Number(entry?.originScore) || null,
      advantage: Number(entry?.advantage) || null,
      change: Number(entry?.change) || 0,
      rankText: entry?.rank ? `${entry.rank}위` : "",
      scoreText: entry?.originScore ? `${entry.originScore}` : "",
      extra: entry?.advantage ? `x ${entry.advantage}` : "-",
    }));
  });

  return {
    headers,
    platformBreakdown,
    rawRows: rows,
  };
}

function toSongItem($, rowElement) {
  const row = $(rowElement);
  const rowHtml = row.prop("outerHTML") || "";

  const songAnchor = row.find("a[href^='/song/']").first();
  if (!songAnchor.length) {
    return null;
  }

  const href = songAnchor.attr("href") || "";
  const songIdMatch = href.match(/\/song\/(\d+)/);
  const songId = songIdMatch ? Number(songIdMatch[1]) : null;

  const title = normalizeText(songAnchor.find("h3[id^='song-title-']").first().text());
  const artist = normalizeText(songAnchor.find("p").first().text());
  const scoreText = normalizeText(songAnchor.find("strong.title-feed").first().text());
  const score = Number(scoreText.replace(/[^\d]/g, "")) || 0;

  const rankText = normalizeText(row.find("span").first().text());
  const rank = Number(rankText.replace(/[^\d]/g, "")) || 0;

  const albumImage =
    songAnchor.find("img[src*='upload_ichart/album']").first().attr("src") ||
    songAnchor.find("img").first().attr("src") ||
    "";

  const movementRaw = normalizeText(
    songAnchor
      .find("span")
      .eq(1)
      .text()
  );

  const movement = parseMovement(rowHtml, movementRaw);

  if (!songId || !title || !artist || !rank) {
    return null;
  }

  return {
    rank,
    songId,
    title,
    artist,
    score,
    totalScore: score,
    albumImage,
    movement,
    platformBreakdown: [],
    rakCount: 0,
    pakCount: 0,
    scoreDetailHeaders: [],
    scoreDetailRows: [],
    detailUrl: `https://ichart.kr/song/${songId}`,
  };
}

function toSongItemFromApi(entry) {
  const songId = Number(entry?.songId) || Number(entry?.song?.id) || null;
  const title = normalizeText(entry?.song?.name || "");
  const artist = normalizeText(
    Array.isArray(entry?.song?.artists) ? entry.song.artists.map((a) => a?.name || "").join(", ") : ""
  );
  const rank = Number(entry?.rank) || 0;
  const score = Number(entry?.score) || 0;
  const albumImage = entry?.song?.album?.albumImageUrl || "";
  const rankChange = Number(entry?.rankChange) || 0;

  if (!songId || !title || !artist || !rank) {
    return null;
  }

  const movement = {
    type: rankChange === 0 ? "no_change" : rankChange > 0 ? "up" : "down",
    value: Math.abs(rankChange),
    raw: rankChange === 0 ? "-" : `${rankChange > 0 ? "+" : "-"}${Math.abs(rankChange)}`,
  };

  return {
    rank,
    songId,
    title,
    artist,
    score,
    totalScore: null,
    albumImage,
    movement,
    platformBreakdown: [],
    rakCount: Number(entry?.song?.akCount ?? entry?.akCount) || 0,
    pakCount: Number(entry?.song?.pakCount ?? entry?.pakCount) || 0,
    scoreDetailHeaders: [],
    scoreDetailRows: [],
    yearWeek: entry?.yearWeek ? String(entry.yearWeek) : null,
    detailUrl: `https://ichart.kr/song/${songId}`,
  };
}

function buildBanner(items) {
  const top = items[0];
  const second = items[1];
  const third = items[2];

  return {
    headline: top ? `1위 ${top.title} - ${top.artist}` : "iChart 실시간 순위",
    subline:
      second && third
        ? `2위 ${second.title} | 3위 ${third.title}`
        : "최신 통합차트 데이터를 불러오는 중입니다.",
    updatedAt: nowKstIso(),
  };
}

async function fetchHtml() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    signal: timeoutSignal(),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function main() {
  const realTimeRows = await fetchRealTimeChartData();
  let daySongs = realTimeRows.map((entry) => toSongItemFromApi(entry)).filter(Boolean);
  const html = await fetchHtml();
  const $ = load(html);
  const rows = $("div.border-b-border-line").toArray();
  const htmlSongs = rows.map((rowElement) => toSongItem($, rowElement)).filter(Boolean);
  const totalScoreBySongId = new Map(htmlSongs.map((song) => [song.songId, song.totalScore]));

  if (!daySongs.length) {
    daySongs = htmlSongs;
  }

  daySongs.sort((a, b) => a.rank - b.rank);

  const weekSongs = fetchWeeklyChartData()
    .then((rows) => rows.map((entry) => toSongItemFromApi(entry)).filter(Boolean).sort((a, b) => a.rank - b.rank));

  const [daySongsWithDetails, weekSongsWithDetails] = await Promise.all([
    Promise.all(daySongs.map(async (song) => {
      const scoreDetail = await fetchScoreDetail(song.songId);
      const normalized = normalizeScoreDetail(scoreDetail);
      const albumImage = await localizeImage(song.albumImage, "ichart", song.songId);
      return {
        ...song,
        albumImage,
        totalScore: totalScoreBySongId.get(song.songId) || null,
        scoreDetailHeaders: normalized.headers,
        scoreDetailRows: normalized.rawRows,
        platformBreakdown: normalized.platformBreakdown,
      };
    })),
    weekSongs.then((songs) => Promise.all(songs.map(async (song) => {
      const scoreDetail = await fetchScoreDetail(song.songId);
      const normalized = normalizeScoreDetail(scoreDetail);
      const albumImage = await localizeImage(song.albumImage, "ichart", song.songId);
      return {
        ...song,
        albumImage,
        totalScore: totalScoreBySongId.get(song.songId) || null,
        scoreDetailHeaders: normalized.headers,
        scoreDetailRows: normalized.rawRows,
        platformBreakdown: normalized.platformBreakdown,
      };
    }))),
  ]);

  if (!daySongsWithDetails.length) {
    throw new Error("iChart day chart returned no rows; refusing to overwrite existing data");
  }

  if (!weekSongsWithDetails.length) {
    throw new Error("iChart week chart returned no rows; refusing to overwrite existing data");
  }

  const yearWeek = weekSongsWithDetails[0]?.yearWeek
    ? String(weekSongsWithDetails[0].yearWeek)
    : null;

  const payload = {
    source: SOURCE_URL,
    apiBaseUrl: API_BASE_URL,
    fetchedAt: nowKstIso(),
    total: daySongsWithDetails.length,
    banner: buildBanner(daySongsWithDetails),
    items: daySongsWithDetails,
    charts: {
      day: {
        fetchedAt: nowKstIso(),
        total: daySongsWithDetails.length,
        banner: buildBanner(daySongsWithDetails),
        items: daySongsWithDetails,
      },
      week: {
        fetchedAt: nowKstIso(),
        yearWeek,
        total: weekSongsWithDetails.length,
        banner: buildBanner(weekSongsWithDetails),
        items: weekSongsWithDetails,
      },
    },
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  console.log(`Saved iChart day=${daySongsWithDetails.length}, week=${weekSongsWithDetails.length} to ${OUTPUT_FILE.pathname}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
