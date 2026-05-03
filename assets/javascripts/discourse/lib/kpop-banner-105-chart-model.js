export const kpoppingEpisodePeriodCount = 30;
export const kpoppingPeriodOptions = ["stages", "song-wins", "artist-wins"];

const defaultPeriodLabels = new Map([
  ["stages", "📺 最新打歌舞台"],
  ["song-wins", "🏆 歌曲一位榜"],
  ["artist-wins", "🏆 艺人总榜"],
]);

const fallbackPeriodLabels = {
  day: "日榜 (Daily)",
  week: "周榜 (Weekly)",
  month: "月榜 (Monthly)",
  year: "年榜 (Yearly)",
};

const sourceViewFallbacks = [
  { source: "kpopping", period: "stages" },
  { source: "ichart", period: "day" },
  { source: "circle-global", period: "day" },
  { source: "circle-digital", period: "week" },
  { source: "circle-album", period: "week" },
];

const sourcePeriods = {
  ichart: ["day", "week", "month", "year"],
	"circle-global": ["day"],
  "circle-digital": ["day", "week", "month", "year"],
  "circle-album": ["day", "week", "month", "year"],
  kpopping: kpoppingPeriodOptions,
};

export function createPeriodLabels() {
  return new Map(defaultPeriodLabels);
}

export function getPeriodLabel(period, periodLabels) {
  if (periodLabels?.has(period)) {
    return periodLabels.get(period);
  }

  return fallbackPeriodLabels[period] || period;
}

export function sourceKey(mainSource, period) {
  const periods = sourcePeriods[mainSource] || sourcePeriods.ichart;
  const safePeriod = periods.includes(period) ? period : defaultPeriodForSource(mainSource);
  return `${mainSource}-${safePeriod}`;
}

export function availablePeriods(songsBySource, mainSource) {
  const keyPrefix = `${mainSource}-`;
  return (sourcePeriods[mainSource] || sourcePeriods.ichart).filter((period) => {
    const songs = songsBySource?.[`${keyPrefix}${period}`];
    return Array.isArray(songs) && songs.length > 0;
  });
}

export function resolveSongs(songsBySource, mainSource, period) {
  const direct = songsBySource?.[sourceKey(mainSource, period)] || [];
  if (direct.length) {
    return direct;
  }

  const periods = availablePeriods(songsBySource, mainSource);
  if (periods.length) {
    return songsBySource?.[sourceKey(mainSource, periods[0])] || [];
  }

  return [];
}

export function normalizeSelectedSource(source) {
  return ["circle-global", "circle-digital", "circle-album", "kpopping"].includes(source) ? source : "ichart";
}

export function normalizeSelectedPeriod(period, source = "ichart") {
  const periods = sourcePeriods[source] || sourcePeriods.ichart;
  return periods.includes(period) ? period : defaultPeriodForSource(source);
}

export function defaultPeriodForSource(source) {
  if (source === "kpopping") {
    return "stages";
  }
  return source === "ichart" || source === "circle-global" ? "day" : "week";
}

export function firstAvailableView(songsBySource) {
  for (const fallback of sourceViewFallbacks) {
    const songs = resolveSongs(songsBySource, fallback.source, fallback.period);
    if (songs.length) {
      return { source: fallback.source, period: fallback.period, songs };
    }
  }

  return null;
}

export function resolveAvailableView(songsBySource, source, period) {
  const nextSource = normalizeSelectedSource(source);
  let nextPeriod = normalizeSelectedPeriod(period, nextSource);
  const periods = availablePeriods(songsBySource, nextSource);

  if (!periods.includes(nextPeriod)) {
    nextPeriod = periods[0] || defaultPeriodForSource(nextSource);
  }

  const nextSongs = resolveSongs(songsBySource, nextSource, nextPeriod);
  if (nextSongs.length) {
    return { source: nextSource, period: nextPeriod, songs: nextSongs };
  }

  return firstAvailableView(songsBySource) || { source: nextSource, period: nextPeriod, songs: [] };
}

export function createEmptySongsBySource() {
  const next = {
    "ichart-day": [],
    "ichart-week": [],
    "circle-global-day": [],
    "circle-global-week": [],
    "circle-global-month": [],
    "circle-global-year": [],
    "circle-digital-week": [],
    "circle-digital-month": [],
    "circle-digital-year": [],
    "circle-album-week": [],
    "circle-album-month": [],
    "circle-album-year": [],
    "kpopping-stages": [],
  };

  next["kpopping-song-wins"] = [];
  next["kpopping-artist-wins"] = [];
  next["kpopping-history"] = [];
  Array.from({ length: kpoppingEpisodePeriodCount }, (_, index) => `ep${index}`).forEach((period) => {
    next[`kpopping-${period}`] = [];
  });

  return next;
}
