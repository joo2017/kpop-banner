import {
  normalizePlatformName,
  trendFromChange,
  trendFromMovement,
} from "./kpop-banner-105-utils";

export function mapSong(item) {
  const rows = Array.isArray(item?.platformBreakdown) ? item.platformBreakdown : [];
  const seen = new Set();
  const platforms = [];
  const detailRows = [];

  rows.forEach((row) => {
    const info = normalizePlatformName(row?.platform);
    const rowTrend = trendFromChange(row?.change);
    const key = info.name.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      platforms.push({
        name: info.name,
        rank: Number.isFinite(Number(row?.rank)) ? Number(row.rank) : "-",
        class: info.class,
        trend: rowTrend.trend,
        trendVal: rowTrend.trendVal,
      });
    }

    detailRows.push({
      platform: info.name,
      colorClass: info.colorClass,
      chartName: row?.chartName || "",
      rank: Number.isFinite(Number(row?.rank)) ? Number(row.rank) : "-",
      score: Number.isFinite(Number(row?.originScore)) ? `${Number(row.originScore)}` : Number.isFinite(Number(row?.score)) ? `${Number(row.score)}` : "-",
      multi: row?.extra || "-",
      trend: rowTrend.trend,
      trendVal: rowTrend.trendVal,
    });
  });

  const pakCount = Number(item?.pakCount) || 0;
  const rakCount = Number(item?.rakCount) || 0;
  const movementTrend = trendFromMovement(item?.movement);

  return {
    rank: Number.isFinite(Number(item?.rank)) ? Number(item.rank) : "-",
    title: item?.title || "-",
    artist: item?.artist || "-",
    currentScore: Number(item?.score) || 0,
    totalScore: Number.isFinite(Number(item?.totalScore)) ? Number(item.totalScore).toLocaleString("en-US") : "",
    points: Number.isFinite(Number(item?.score)) ? Number(item.score).toLocaleString("en-US") : "-",
    pakCount,
    rakCount,
    imageUrl: item?.albumImage || "",
    detailUrl: item?.detailUrl || "",
    mvUrl: item?.mvUrl || item?.videoUrl || item?.youtubeUrl || "",
    trend: movementTrend.trend,
    trendVal: movementTrend.trendVal,
    platforms: platforms.length ? platforms : [{ name: "Melon", rank: "-", class: "is-melon", trend: "same", trendVal: "" }],
    detailRows,
    tableDetails: null,
  };
}

export function mapCircleSong(item, family, period, label) {
  const movementTrend = trendFromMovement(item?.movement);
  const song = {
    rank: Number.isFinite(Number(item?.rank)) ? Number(item.rank) : "-",
    title: item?.title || "-",
    artist: item?.artist || "-",
    currentScore: 0,
    points: "-",
    pointsLabel: "CIRCLE",
    pakCount: 0,
    rakCount: 0,
    imageUrl: item?.albumImage || "",
    detailUrl: "",
    mvUrl: "",
    trend: movementTrend.trend,
    trendVal: movementTrend.trendVal,
    platforms: [],
    tableDetails: null,
    chartFamily: family,
    chartLabel: label,
    chartPeriod: period,
    circleMeta: {
      album: item?.album || "",
      companyMake: item?.companyMake || "",
      companyDist: item?.companyDist || "",
      cert: item?.raw?.cert || "",
      count: item?.raw?.count || "",
      albumCnt: item?.raw?.albumCnt || "",
      totalCnt: item?.raw?.totalCnt || "",
    },
  };

  if (family === "global") {
    song.pointsLabel = "CIRCLE GLOBAL";
    song.points = "GLOBAL";
    song.platforms = [
      { name: "Global", rank: song.rank, class: "is-youtube", trend: song.trend, trendVal: song.trendVal },
    ];
    return song;
  }

  if (family === "onoff") {
    const count = Number(item?.raw?.count || 0);
    song.currentScore = Number.isFinite(count) ? count : 0;
    song.points = Number.isFinite(count) && count > 0 ? count.toLocaleString("en-US") : "-";
    song.pointsLabel = "CIRCLE INDEX";
    song.platforms = [
      { name: "Digital", rank: song.rank, class: "is-genie", trend: song.trend, trendVal: song.trendVal },
    ];
    return song;
  }

  const albumCnt = Number(item?.raw?.albumCnt || 0);
  song.currentScore = Number.isFinite(albumCnt) ? albumCnt : 0;
  song.points = Number.isFinite(albumCnt) && albumCnt > 0 ? albumCnt.toLocaleString("en-US") : "-";
  song.pointsLabel = "ALBUM SALES";
  song.platforms = [
    { name: "Album", rank: song.rank, class: "is-bugs", trend: song.trend, trendVal: song.trendVal },
  ];
  return song;
}

function normalizeKpoppingThumbnail(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    const nested = parsed.searchParams.get("url");
    if (nested) {
      return decodeURIComponent(nested);
    }
  } catch {
    return raw;
  }

  return raw;
}

function mapKpoppingPerformance(performance, episode) {
  const badges = Array.isArray(performance?.badges)
    ? performance.badges.map((badge) => String(badge || "").toUpperCase()).filter((badge) => badge && badge !== "PLAYING")
    : [];
  const videoId = String(performance?.youtube_video_id || "").trim();
  const songTitle = performance?.song || "-";
  const artist = performance?.artist || "-";

  return {
    rank: Number.isFinite(Number(performance?.order)) ? Number(performance.order) : "-",
    title: songTitle,
    artist,
    currentScore: 0,
    points: Number.isFinite(Number(performance?.order)) ? `#${Number(performance.order)}` : "STAGE",
    pointsLabel: "STAGE ORDER",
    pakCount: 0,
    rakCount: 0,
    imageUrl: normalizeKpoppingThumbnail(performance?.thumbnail) || normalizeKpoppingThumbnail(episode?.thumbnail),
    detailUrl: episode?.source_url || "",
    mvUrl: videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : episode?.source_url || "",
    trend: performance?.is_winner ? "up" : "same",
    trendVal: performance?.is_winner ? "WIN" : "",
    platforms: [],
    tableDetails: null,
    chartFamily: "music_show",
    chartLabel: "Kpopping 打歌节目",
    chartPeriod: "stages",
    musicShowMeta: {
      sourceUrl: episode?.source_url || "",
      showName: episode?.show_name || "-",
      episodeNumber: episode?.episode_number || "-",
      airDate: episode?.air_date || "-",
      winnerSong: episode?.winner_song || "-",
      winnerArtist: episode?.winner_artist || "-",
      winnerPerformed: !!episode?.winner_performed,
      reportedPerformanceCount: episode?.reported_performance_count || episode?.parsed_performance_count || "-",
      stageOrder: Number.isFinite(Number(performance?.order)) ? Number(performance.order) : "-",
      youtubeVideoId: videoId,
      badges,
      isWinner: !!performance?.is_winner || badges.includes("WINNER"),
      isComeback: !!performance?.is_comeback || badges.includes("COMEBACK"),
      isDebut: !!performance?.is_debut || badges.includes("DEBUT"),
    },
  };
}

export function getKpoppingEpisodeLabel(episode, fallbackIndex) {
  const showName = episode?.show_name || "Kpopping";
  const episodeNumber = episode?.episode_number ? ` EP.${episode.episode_number}` : "";
  const airDate = episode?.air_date ? ` · ${episode.air_date}` : "";
  return `${showName}${episodeNumber}${airDate}` || `往期节目 ${fallbackIndex + 1}`;
}

export function mapKpoppingEpisode(episode, period = "stages") {
  const performances = Array.isArray(episode?.performances) ? episode.performances : [];
  return performances
    .filter((performance) => performance?.song && performance?.artist)
    .map((performance) => ({
      ...mapKpoppingPerformance(performance, episode),
      chartPeriod: period,
    }));
}

export function buildKpoppingHistoryItem(episode, index) {
  const period = `ep${index}`;
  return {
    period,
    title: `${episode?.show_name || "Kpopping"} EP.${episode?.episode_number || "-"}`,
    date: episode?.air_date || "-",
    winner: `${episode?.winner_artist || "-"} - ${episode?.winner_song || "-"}`,
  };
}

export function buildKpoppingWinRankings(episodes) {
  const songWins = new Map();
  const artistWins = new Map();

  (Array.isArray(episodes) ? episodes : []).forEach((episode) => {
    const winnerArtist = String(episode?.winner_artist || "").trim();
    const winnerSong = String(episode?.winner_song || "").trim();
    if (!winnerArtist || !winnerSong) {
      return;
    }

    const songKey = `${winnerArtist}|||${winnerSong}`;
    const currentSong = songWins.get(songKey) || {
      artist: winnerArtist,
      title: winnerSong,
      wins: 0,
      shows: new Set(),
      imageUrl: normalizeKpoppingThumbnail(episode?.thumbnail),
    };
    currentSong.wins += 1;
    currentSong.shows.add(episode?.show_name || "Kpopping");
    songWins.set(songKey, currentSong);

    const currentArtist = artistWins.get(winnerArtist) || {
      artist: winnerArtist,
      title: winnerArtist,
      totalWins: 0,
      winningSongs: new Set(),
      shows: new Set(),
      imageUrl: normalizeKpoppingThumbnail(episode?.thumbnail),
    };
    currentArtist.totalWins += 1;
    currentArtist.winningSongs.add(winnerSong);
    currentArtist.shows.add(episode?.show_name || "Kpopping");
    artistWins.set(winnerArtist, currentArtist);
  });

  const songRows = Array.from(songWins.values())
    .sort((left, right) => right.wins - left.wins || left.title.localeCompare(right.title))
    .map((item, index) => ({
      rank: index + 1,
      title: item.title,
      artist: item.artist,
      points: `🏆 ${item.wins}`,
      pointsLabel: "TOTAL WINS",
      imageUrl: item.imageUrl,
      trend: "same",
      trendVal: "",
      platforms: [],
      chartFamily: "music_show_rank",
      chartLabel: "歌曲一位榜",
      chartPeriod: "song-wins",
      musicShowRankMeta: {
        wins: item.wins,
        shows: Array.from(item.shows),
        winningSongs: 1,
      },
    }));

  const artistRows = Array.from(artistWins.values())
    .sort((left, right) => right.totalWins - left.totalWins || left.artist.localeCompare(right.artist))
    .map((item, index) => ({
      rank: index + 1,
      title: item.artist,
      artist: `${item.winningSongs.size} 首夺冠歌曲`,
      points: `🏆 ${item.totalWins}`,
      pointsLabel: "TOTAL WINS",
      imageUrl: item.imageUrl,
      trend: "same",
      trendVal: "",
      platforms: [],
      chartFamily: "music_show_rank",
      chartLabel: "艺人总榜",
      chartPeriod: "artist-wins",
      musicShowRankMeta: {
        wins: item.totalWins,
        shows: Array.from(item.shows),
        winningSongs: item.winningSongs.size,
        songs: Array.from(item.winningSongs),
      },
    }));

  return { songRows, artistRows };
}

export function buildSoridataWinRankings(summary) {
  const songRows = (Array.isArray(summary?.songWins) ? summary.songWins : [])
    .filter((item) => item?.title && item?.artist && Number(item?.wins) > 0)
    .map((item, index) => ({
      rank: index + 1,
      title: item.title,
      artist: item.artist,
      points: `🏆 ${Number(item.wins)}`,
      pointsLabel: summary?.year ? `${summary.year} WINS` : "TOTAL WINS",
      imageUrl: "",
      trend: "same",
      trendVal: "",
      platforms: [],
      chartFamily: "music_show_rank",
      chartLabel: "歌曲一位榜",
      chartPeriod: "song-wins",
      musicShowRankMeta: {
        wins: Number(item.wins),
        shows: Array.isArray(item.awardDetails?.byShow) && item.awardDetails.byShow.length
          ? item.awardDetails.byShow.map((show) => `${show.show} ${show.wins}`)
          : [],
        showBreakdown: Array.isArray(item.awardDetails?.byShow) ? item.awardDetails.byShow : [],
        yearBreakdown: Array.isArray(item.awardDetails?.byYear) ? item.awardDetails.byYear : [],
        winningSongs: 1,
      },
    }));

  const artistRows = (Array.isArray(summary?.artistWins) ? summary.artistWins : [])
    .filter((item) => item?.artist && Number(item?.wins) > 0)
    .map((item, index) => ({
      rank: index + 1,
      title: item.artist,
      artist: item.mostAwardedSong
        ? `代表曲：${item.mostAwardedSong}`
        : "Soridata 累计一位",
      points: `🏆 ${Number(item.wins)}`,
      pointsLabel: "TOTAL WINS",
      imageUrl: "",
      trend: "same",
      trendVal: "",
      platforms: [],
      chartFamily: "music_show_rank",
      chartLabel: "艺人总榜",
      chartPeriod: "artist-wins",
      musicShowRankMeta: {
        wins: Number(item.wins),
        shows: Array.isArray(item.awardDetails?.byShow) && item.awardDetails.byShow.length
          ? item.awardDetails.byShow.map((show) => `${show.show} ${show.wins}`)
          : [],
        showBreakdown: Array.isArray(item.awardDetails?.byShow) ? item.awardDetails.byShow : [],
        yearBreakdown: Array.isArray(item.awardDetails?.byYear) ? item.awardDetails.byYear : [],
        winningSongs: Number(item.mostAwardedSongWins) || 0,
        songs: Array.isArray(item.awardDetails?.topSongs) && item.awardDetails.topSongs.length
          ? item.awardDetails.topSongs.map((song) => `${song.title} ${song.wins}`)
          : item.mostAwardedSong ? [item.mostAwardedSong] : [],
        songBreakdown: Array.isArray(item.awardDetails?.topSongs) ? item.awardDetails.topSongs : [],
        detailUrl: item.detailUrl || "",
      },
    }));

  return { songRows, artistRows };
}

export function selectLatestKpoppingEpisode(episodes) {
  return (Array.isArray(episodes) ? episodes : []).find((episode) => Array.isArray(episode?.performances) && episode.performances.length > 0) || null;
}
