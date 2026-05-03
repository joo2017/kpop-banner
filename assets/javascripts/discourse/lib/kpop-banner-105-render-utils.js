export const loadingPlatformMarqueeHtml = '<div class="kpop-celebration__platform-marquee kpop-celebration__platform-marquee--placeholder"><div class="kpop-celebration__platform-track"><div class="kpop-celebration__pill"><div class="kpop-celebration__pill-name">Loading</div><div class="kpop-celebration__pill-rank">...</div></div><div class="kpop-celebration__pill"><div class="kpop-celebration__pill-name">Loading</div><div class="kpop-celebration__pill-rank">...</div></div><div class="kpop-celebration__pill"><div class="kpop-celebration__pill-name">Loading</div><div class="kpop-celebration__pill-rank">...</div></div></div></div>';
export const loadingSidebarHtml = '<button class="kpop-celebration__mini-item is-active" type="button"><div class="kpop-celebration__mini-left"><span class="kpop-celebration__mini-rank is-top">1</span><span class="kpop-celebration__mini-title">加载中...</span></div><span class="kpop-celebration__mini-trend is-same">...</span></button><button class="kpop-celebration__mini-item" type="button"><div class="kpop-celebration__mini-left"><span class="kpop-celebration__mini-rank">2</span><span class="kpop-celebration__mini-title">加载中...</span></div><span class="kpop-celebration__mini-trend is-same">...</span></button><button class="kpop-celebration__mini-item" type="button"><div class="kpop-celebration__mini-left"><span class="kpop-celebration__mini-rank">3</span><span class="kpop-celebration__mini-title">加载中...</span></div><span class="kpop-celebration__mini-trend is-same">...</span></button>';

export function buildMvSearchUrl(title, artist) {
  const query = `${title || ""} ${artist || ""} mv`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
}

export function getTrendIconHtml(trend) {
  if (trend === "up") return '<span class="kpop-celebration__mini-trend-icon"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></span>';
  if (trend === "down") return '<span class="kpop-celebration__mini-trend-icon"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></span>';
  return '<span class="kpop-celebration__mini-trend-icon"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg></span>';
}

export function getMicroTrendHtml(trend, val) {
  if (trend === "up") return `<span class="micro-trend is-up"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>${val || ""}</span>`;
  if (trend === "down") return `<span class="micro-trend is-down"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>${val || ""}</span>`;
  return '<span class="micro-trend is-same"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg></span>';
}

export function getCountBadgeHtml(song) {
  const pakCount = Number(song?.pakCount) || 0;
  const rakCount = Number(song?.rakCount) || 0;
  const level = pakCount > 0 ? "PAK" : rakCount > 0 ? "AK" : "";

  if (!level) return "";

  const badgeClass = level === "PAK" ? "kpop-celebration__badge--pak" : "kpop-celebration__badge--rak";
  const text = level === "PAK" && pakCount ? `PAK ${pakCount}次` : level === "AK" && rakCount ? `AK ${rakCount}次` : level;
  return `<div class="kpop-celebration__badge ${badgeClass}"><span class="kpop-celebration__badge-text">${text}</span></div>`;
}

export function getModalPlaceholderRowHtml(colspan, text) {
  return `<tr><td colspan="${colspan}">${text}</td></tr>`;
}

export function getPlatformPillsHtml(platforms) {
  if (!Array.isArray(platforms) || !platforms.length) {
    return "";
  }

  const singleSet = platforms.map((platform) => `
      <div class="kpop-celebration__pill ${platform.class}">
        <div class="kpop-celebration__pill-name">${platform.name}</div>
        <div class="kpop-celebration__pill-rank">#${platform.rank}${getMicroTrendHtml(platform.trend, platform.trendVal)}</div>
      </div>
    `).join("");
  return singleSet + singleSet;
}
