export function normalizePlatformName(raw) {
  const value = String(raw || "").toLowerCase();
  if (value.includes("melon") || value.includes("멜론")) return { name: "Melon", class: "is-melon", colorClass: "color-melon" };
  if (value.includes("genie") || value.includes("지니")) return { name: "Genie", class: "is-genie", colorClass: "color-genie" };
  if (value.includes("bugs") || value.includes("벅스")) return { name: "Bugs", class: "is-bugs", colorClass: "color-bugs" };
  if (value.includes("flo") || value.includes("플로")) return { name: "Flo", class: "is-flo", colorClass: "color-flo" };
  if (value.includes("vibe") || value.includes("바이브")) return { name: "VIBE", class: "is-vibe", colorClass: "color-vibe" };
  if (value.includes("youtube") || value.includes("유튜브")) return { name: "YouTube", class: "is-youtube", colorClass: "color-youtube" };
  return { name: "iChart", class: "is-ichart", colorClass: "color-ichart" };
}

export function trendFromChange(change) {
  const n = Number(change);
  if (!Number.isFinite(n) || n === 0) return { trend: "same", trendVal: "" };
  return { trend: n > 0 ? "up" : "down", trendVal: Math.abs(n) };
}

export function trendFromMovement(movement) {
  const type = movement?.type || "no_change";
  const value = Number(movement?.value);
  if (type === "up") return { trend: "up", trendVal: Number.isFinite(value) && value > 0 ? value : 1 };
  if (type === "down") return { trend: "down", trendVal: Number.isFinite(value) && value > 0 ? value : 1 };
  return { trend: "same", trendVal: "" };
}

export function translateChartName(raw) {
  const name = String(raw || "").trim();
  if (!name) return "-";

  if (name.includes("TOP 100")) return "TOP 100";
  if (name.includes("TOP 200")) return "TOP 200";
  if (name.includes("24시간") || name.includes("24小时")) return "24小时热门";
  if (name.includes("실시간") || name.includes("实时")) return "实时榜";
  if (name.includes("일간") || name.includes("日榜")) return "日榜";
  if (name.includes("주간") || name.includes("周榜")) return "周榜";
  if (name.includes("인기곡") || name.includes("热门歌曲")) return "热门歌曲";

  return name;
}

export function matchesSongIdentity(left, right) {
  if (!left || !right) {
    return false;
  }

  if (left?.detailUrl && right?.detailUrl) {
    return left.detailUrl === right.detailUrl;
  }

  return left?.title === right?.title && left?.artist === right?.artist;
}

export function isRealtimeChartName(raw) {
  const name = String(raw || "").toLowerCase();
  if (!name) {
    return false;
  }

  return name.includes("top 100")
    || name.includes("top100")
    || name.includes("top 200")
    || name.includes("top200")
    || name.includes("24시간")
    || name.includes("24小时")
    || name.includes("실시간")
    || name.includes("实时")
    || name.includes("realtime")
    || name.includes("real-time");
}

export function isAllKillChartRow(platformName, chartName) {
  const platform = String(platformName || "").toLowerCase();
  const name = String(chartName || "").toLowerCase();

  if (!name) {
    return false;
  }

  if (platform === "youtube") {
    return name.includes("인기곡") || name.includes("热门歌曲") || name.includes("popular songs");
  }

  if (platform === "melon" || platform === "vibe") {
    return name.includes("top 100") || name.includes("top100");
  }

  if (platform === "genie") {
    return name.includes("top 200") || name.includes("top200") || isRealtimeChartName(name);
  }

  if (platform === "flo") {
    return name.includes("24시간") || name.includes("24小时") || name.includes("24hits") || name.includes("24 hits");
  }

  if (platform === "bugs") {
    return isRealtimeChartName(name);
  }

  return isRealtimeChartName(name);
}
