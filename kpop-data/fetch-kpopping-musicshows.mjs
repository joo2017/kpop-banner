#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { load } from "cheerio";

const BASE_URL = "https://kpopping.com";
const EPISODES_API = `${BASE_URL}/api/musicshows?episodes=true&includeLikes=true`;
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const BADGE_VALUES = new Set(["playing", "winner", "comeback", "debut"]);
const DEFAULT_OUTPUT_DIR = "/root/alldongtai";
const DEFAULT_PUBLIC_DIR = new URL("../public-download/", import.meta.url).pathname;
const DEFAULT_THEME_LIGHT_OUTPUT = "";
const PUBLIC_IMAGE_URL_PREFIX = "/kpop-images";
const REQUEST_TIMEOUT_MS = 60000;

function parseArgs(argv) {
  const args = {
    outputDir: DEFAULT_OUTPUT_DIR,
    detailsInput: "",
    limit: 0,
    workers: 8,
    publicDir: DEFAULT_PUBLIC_DIR,
    publicUrlBase: "",
    lightLimit: 30,
    lightOutput: "",
    themeLightOutput: DEFAULT_THEME_LIGHT_OUTPUT,
    skipLocalImages: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const next = argv[index + 1];
    if (key === "--output-dir") { args.outputDir = next; index += 1; }
    else if (key === "--details-input") { args.detailsInput = next; index += 1; }
    else if (key === "--limit") { args.limit = Number(next) || 0; index += 1; }
    else if (key === "--workers") { args.workers = Number(next) || 8; index += 1; }
    else if (key === "--public-dir") { args.publicDir = next; index += 1; }
    else if (key === "--public-url-base") { args.publicUrlBase = next; index += 1; }
    else if (key === "--light-limit") { args.lightLimit = Number(next) || 0; index += 1; }
    else if (key === "--light-output") { args.lightOutput = next; index += 1; }
    else if (key === "--theme-light-output") { args.themeLightOutput = next; index += 1; }
    else if (key === "--skip-local-images") args.skipLocalImages = true;
    else if (key === "--help" || key === "-h") {
      console.log(`Usage: node scripts/fetch-kpopping-musicshows.mjs [options]\n\nOptions:\n  --details-input <path>       Rebuild lightweight output from an existing full details JSON\n  --output-dir <path>          Full scrape output directory (default: ${DEFAULT_OUTPUT_DIR})\n  --limit <n>                  Limit episode scrape count; 0 means all\n  --workers <n>                Concurrent scrape/image jobs (default: 8)\n  --public-dir <path>          Public download root (default: ${DEFAULT_PUBLIC_DIR})\n  --public-url-base <url>      Absolute URL base for localized images\n  --light-limit <n>            Recent episodes in lightweight JSON (default: 30)\n  --light-output <path>        Lightweight JSON output; defaults to <public-dir>/kpopping-musicshows-details.json\n  --theme-light-output <path>  Optional theme copy path\n  --skip-local-images          Do not download/localize images`);
      process.exit(0);
    }
  }

  return args;
}

function timeoutSignal(ms = REQUEST_TIMEOUT_MS) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function headers(accept = "text/html") {
  return {
    accept,
    referer: `${BASE_URL}/musicshows`,
    "user-agent": USER_AGENT,
  };
}

async function fetchText(url, accept = "text/html") {
  const response = await fetch(url, { headers: headers(accept), signal: timeoutSignal() });
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  return response.text();
}

async function fetchEpisodeSummaries() {
  const payload = await fetchText(EPISODES_API, "application/json");
  const parsed = JSON.parse(payload);
  if (!Array.isArray(parsed?.episodes)) throw new Error("Kpopping API response did not contain an episodes list");
  return parsed.episodes;
}

function cleanText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function sourceImageUrl(url) {
  try {
    const parsed = new URL(url);
    const nested = parsed.searchParams.get("url");
    return nested ? decodeURIComponent(nested) : url;
  } catch {
    return url;
  }
}

function youtubeIdFromImg(imgSrc) {
  if (!imgSrc) return null;
  const decoded = sourceImageUrl(imgSrc);
  return decoded.match(/\/vi\/([^/]+)\//)?.[1] || null;
}

function parsePerformanceEntry($, element, fallbackOrder) {
  const children = $(element).children("div").toArray();
  if (children.length < 3) return null;

  const orderText = cleanText($(children[0]).text());
  const order = orderText && /^\d+$/.test(orderText) ? Number(orderText) : fallbackOrder;
  const titleArtistText = $(children[2])
    .text()
    .split("\n")
    .map(cleanText)
    .filter(Boolean);
  const song = titleArtistText[0] || null;
  const artist = titleArtistText[1] || null;

  const badges = children.length >= 4
    ? $(children[3]).text().split("\n").map(cleanText).filter(Boolean).filter((badge) => BADGE_VALUES.has(badge.toLowerCase())).map((badge) => badge.toUpperCase())
    : [];
  const img = $(element).find("img").first();
  let thumbnail = img.attr("src") || null;
  if (thumbnail?.startsWith("/")) thumbnail = `${BASE_URL}${thumbnail}`;
  const videoId = youtubeIdFromImg(thumbnail);

  if (!song && !artist) return null;
  return {
    order,
    song,
    artist,
    badges,
    is_winner: badges.includes("WINNER"),
    is_playing: badges.includes("PLAYING"),
    is_comeback: badges.includes("COMEBACK"),
    is_debut: badges.includes("DEBUT"),
    youtube_video_id: videoId,
    thumbnail,
  };
}

function parseDetailHtml(html) {
  const $ = load(html);
  const heading = $("h2,h3").toArray().find((node) => $(node).text().includes("Stage Performances"));
  const performances = [];
  if (heading) {
    const header = $(heading).parent("div");
    const headerWrapper = header.parent("div");
    const card = headerWrapper.parent();
    const container = card.children("div").eq(1);
    container.children("div").each((index, entry) => {
      const parsed = parsePerformanceEntry($, entry, index + 1);
      if (parsed) performances.push(parsed);
    });
  }
  return {
    page_title: cleanText($("title").first().text()),
    performances,
    parsed_performance_count: performances.length,
  };
}

function normalizeSummary(summary) {
  const slug = summary?.slug || null;
  return {
    source: "kpopping",
    type: "music_show_episode_summary",
    source_url: slug ? `${BASE_URL}/musicshows/${slug}` : null,
    id: summary?.id,
    slug,
    show_name: summary?.showName,
    episode_number: summary?.episodeNumber,
    air_date: summary?.airDate,
    winner_song: summary?.winnerSong,
    winner_artist: summary?.winnerArtist,
    winner_type: summary?.winnerType,
    winner_idol_id: summary?.winnerIdolId,
    winner_group_id: summary?.winnerGroupId,
    winner_video_id: summary?.winnerVideoId,
    winner_performed: Boolean(summary?.winnerVideoId),
    is_winner_episode: Boolean(summary?.isWinner),
    performance_count: summary?.performanceCount,
    thumbnail: summary?.thumbnail,
    submitted_by: summary?.submittedBy,
    submitted_by_name: summary?.submittedByName,
    created_at: summary?.createdAt,
  };
}

async function scrapeDetail(summary) {
  const slug = String(summary?.slug || "");
  if (!slug) return { ok: false, slug: "", error: "missing slug" };
  const sourceUrl = `${BASE_URL}/musicshows/${slug}`;
  try {
    const html = await fetchText(sourceUrl);
    return {
      ok: true,
      slug,
      data: {
        source: "kpopping",
        type: "music_show_episode_detail",
        source_url: sourceUrl,
        id: summary?.id,
        slug,
        show_name: summary?.showName,
        episode_number: summary?.episodeNumber,
        air_date: summary?.airDate,
        winner_song: summary?.winnerSong,
        winner_artist: summary?.winnerArtist,
        winner_type: summary?.winnerType,
        winner_idol_id: summary?.winnerIdolId,
        winner_group_id: summary?.winnerGroupId,
        winner_video_id: summary?.winnerVideoId,
        winner_performed: Boolean(summary?.winnerVideoId),
        is_winner_episode: Boolean(summary?.isWinner),
        reported_performance_count: summary?.performanceCount,
        thumbnail: summary?.thumbnail,
        submitted_by: summary?.submittedBy,
        submitted_by_name: summary?.submittedByName,
        created_at: summary?.createdAt,
        ...parseDetailHtml(html),
      },
    };
  } catch (error) {
    return { ok: false, slug, error: String(error?.message || error) };
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function lightweightEpisode(episode) {
  return {
    source: episode?.source,
    type: episode?.type,
    source_url: episode?.source_url,
    slug: episode?.slug,
    show_name: episode?.show_name,
    episode_number: episode?.episode_number,
    air_date: episode?.air_date,
    winner_song: episode?.winner_song,
    winner_artist: episode?.winner_artist,
    winner_video_id: episode?.winner_video_id,
    winner_performed: episode?.winner_performed,
    reported_performance_count: episode?.reported_performance_count,
    thumbnail: episode?.thumbnail,
    performances: Array.isArray(episode?.performances) ? episode.performances : [],
  };
}

function isLocalPublicImage(url, publicUrlBase) {
  if (!url) return false;
  const prefix = publicUrlBase ? `${publicUrlBase.replace(/\/$/, "")}${PUBLIC_IMAGE_URL_PREFIX}/` : `${PUBLIC_IMAGE_URL_PREFIX}/`;
  return String(url).startsWith(prefix);
}

function withPublicUrlBase(path, publicUrlBase) {
  if (!path || !String(path).startsWith(PUBLIC_IMAGE_URL_PREFIX)) return path;
  return publicUrlBase ? `${publicUrlBase.replace(/\/$/, "")}${path}` : path;
}

async function localizeLightweightImages(episodes, workers, publicUrlBase, localizeImage) {
  const light = episodes.map((episode) => lightweightEpisode(JSON.parse(JSON.stringify(episode))));
  const jobs = [];
  for (const episode of light) {
    const slug = String(episode?.slug || episode?.id || "episode");
    if (episode.thumbnail) {
      episode.remote_thumbnail = episode.thumbnail;
      jobs.push({ target: episode, key: "thumbnail", url: episode.thumbnail, idHint: `${slug}-episode` });
    }
    for (const performance of episode.performances || []) {
      if (!performance?.thumbnail) continue;
      const order = performance.order || "stage";
      const videoId = performance.youtube_video_id || performance.song || order;
      performance.remote_thumbnail = performance.thumbnail;
      jobs.push({ target: performance, key: "thumbnail", url: performance.thumbnail, idHint: `${slug}-${order}-${videoId}` });
    }
  }

  await mapLimit(jobs, workers, async (job, index) => {
    const localized = await localizeImage(sourceImageUrl(job.url), "kpopping-musicshows", job.idHint);
    job.target[job.key] = withPublicUrlBase(localized, publicUrlBase);
    if ((index + 1) % 50 === 0 || index + 1 === jobs.length) {
      console.log(`localized ${index + 1}/${jobs.length} images`);
    }
  });

  for (const episode of light) {
    let episodeThumbnail = episode.thumbnail;
    if (!isLocalPublicImage(episodeThumbnail, publicUrlBase)) {
      episodeThumbnail = (episode.performances || []).find((performance) => isLocalPublicImage(performance?.thumbnail, publicUrlBase))?.thumbnail || episodeThumbnail;
      episode.thumbnail = episodeThumbnail;
    }
    for (const performance of episode.performances || []) {
      if (!isLocalPublicImage(performance?.thumbnail, publicUrlBase) && isLocalPublicImage(episodeThumbnail, publicUrlBase)) {
        performance.thumbnail = episodeThumbnail;
      }
    }
  }

  return light;
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  process.env.KPOP_IMAGE_ROOT ||= `${args.publicDir.replace(/\/$/, "")}/kpop-images`;
  const { localizeImage } = await import("./scripts/lib/localize-image.mjs");

  await mkdir(args.outputDir, { recursive: true });
  await mkdir(args.publicDir, { recursive: true });

  const summariesPath = `${args.outputDir.replace(/\/$/, "")}/kpopping_musicshows_episodes.json`;
  let detailsPath = `${args.outputDir.replace(/\/$/, "")}/kpopping_musicshows_details.json`;
  const errorsPath = `${args.outputDir.replace(/\/$/, "")}/kpopping_musicshows_errors.json`;
  let summaries = [];
  let details = [];
  let errors = [];

  if (args.detailsInput) {
    detailsPath = args.detailsInput;
    details = JSON.parse(await readFile(detailsPath, "utf8"));
    if (!Array.isArray(details)) throw new Error("--details-input must point to a JSON list");
  } else {
    let rawSummaries = await fetchEpisodeSummaries();
    if (args.limit > 0) rawSummaries = rawSummaries.slice(0, args.limit);
    summaries = rawSummaries.map(normalizeSummary);
    await writeJson(summariesPath, summaries);

    const results = await mapLimit(rawSummaries, args.workers, async (summary, index) => {
      const result = await scrapeDetail(summary);
      if ((index + 1) % 100 === 0 || index + 1 === rawSummaries.length) {
        console.log(`scraped ${index + 1}/${rawSummaries.length} details`);
      }
      return result;
    });
    const orderBySlug = new Map(rawSummaries.map((item, index) => [String(item?.slug || ""), index]));
    details = results.filter((result) => result.ok && result.data).map((result) => result.data);
    errors = results.filter((result) => !result.ok).map((result) => ({ slug: result.slug, error: result.error || "unknown error" }));
    details.sort((left, right) => (orderBySlug.get(String(left?.slug || "")) ?? 1e9) - (orderBySlug.get(String(right?.slug || "")) ?? 1e9));
    await writeJson(detailsPath, details);
    await writeJson(errorsPath, errors);
  }

  const lightOutput = args.lightOutput || `${args.publicDir.replace(/\/$/, "")}/kpopping-musicshows-details.json`;
  const lightCount = Math.max(0, args.lightLimit);
  let lightweight = details.slice(0, lightCount).map(lightweightEpisode);
  if (!args.skipLocalImages && lightweight.length) {
    lightweight = await localizeLightweightImages(details.slice(0, lightCount), args.workers, args.publicUrlBase, localizeImage);
  }
  await writeJson(lightOutput, lightweight);
  if (args.themeLightOutput) await writeJson(args.themeLightOutput, lightweight);

  const validation = {
    episode_summaries: summaries.length,
    episode_details: details.length,
    errors: errors.length,
    total_parsed_performances: details.reduce((sum, item) => sum + (Array.isArray(item?.performances) ? item.performances.length : 0), 0),
    lightweight_episodes: lightweight.length,
    lightweight_file: lightOutput,
    theme_lightweight_file: args.themeLightOutput || null,
    summary_file: summariesPath,
    details_file: detailsPath,
    errors_file: errorsPath,
    used_details_input: Boolean(args.detailsInput),
  };
  await writeJson(`${args.outputDir.replace(/\/$/, "")}/kpopping_musicshows_validation.json`, validation);
  console.log(JSON.stringify(validation, null, 2));
  process.exit(errors.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
