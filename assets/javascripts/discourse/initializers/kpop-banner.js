import { apiInitializer } from "discourse/lib/api";
import {
	createEmptySongsBySource,
	createPeriodLabels,
	defaultPeriodForSource,
	availablePeriods as getAvailablePeriods,
	getPeriodLabel as getChartPeriodLabel,
	resolveAvailableView as getResolvedAvailableView,
	kpoppingEpisodePeriodCount,
	kpoppingPeriodOptions,
	normalizeSelectedPeriod,
	normalizeSelectedSource,
} from "../lib/kpop-banner-105-chart-model";
import { fireMultipleCannons } from "../lib/kpop-banner-105-confetti";
import { createKpopBanner105DataCache } from "../lib/kpop-banner-105-data-cache";
import {
	buildKpoppingHistoryItem,
	buildKpoppingWinRankings,
	buildSoridataWinRankings,
	getKpoppingEpisodeLabel,
	mapCircleSong,
	mapKpoppingEpisode,
	mapSong,
	selectLatestKpoppingEpisode,
} from "../lib/kpop-banner-105-data-mappers";
import { createKpopBanner105InteractionController } from "../lib/kpop-banner-105-interaction-controller";
import fallbackKpoppingEpisodes from "../lib/kpop-banner-105-kpopping-data";
import {
	buildCircleModalTableHtml,
	buildIchartModalTableHtml,
	buildMusicShowModalTableHtml,
	buildMusicShowRankModalTableHtml,
} from "../lib/kpop-banner-105-modal-content";
import {
	getCircleMultiBucketKey,
	getIchartBucketKey,
	getKpoppingBucketKey,
	getSoridataBucketKey,
} from "../lib/kpop-banner-105-refresh-buckets";
import { createKpopBanner105RenderController } from "../lib/kpop-banner-105-render-controller";
import {
	buildMvSearchUrl,
	getCountBadgeHtml,
	getModalPlaceholderRowHtml,
	getPlatformPillsHtml,
	loadingPlatformMarqueeHtml,
} from "../lib/kpop-banner-105-render-utils";
import fallbackSoridataMusicShowWins from "../lib/kpop-banner-105-soridata-data";
import { createKpopBanner105Storage } from "../lib/kpop-banner-105-storage";
import {
	isAllKillChartRow,
	matchesSongIdentity,
} from "../lib/kpop-banner-105-utils";
import { createKpopBanner105ViewController } from "../lib/kpop-banner-105-view-controller";

let songsBySource = createEmptySongsBySource();
let hydrated = false;
const prefersReducedMotion =
	window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
const periodLabels = createPeriodLabels();
const bannerStorage = createKpopBanner105Storage({ kpoppingPeriodOptions });
let kpoppingHistoryEpisodes = [];
const sourceRefreshPromises = new Map();
const jsonRequestPromises = new Map();
let hydratePromise = null;
let lastHydratedSignature = "";
const bannerDataUpdatedEvent = "kpop-banner:data-updated";
let bannerDataCache = null;
let kpopBannerSiteSettings = {};

function getKpopBannerSetting(name, fallback = "") {
	return kpopBannerSiteSettings?.[name] ?? fallback;
}

function getKpopBannerDataUrl(source, extraParams = {}) {
	const endpoint = String(
		getKpopBannerSetting("kpop_banner_data_endpoint", "/kpop/banner-data"),
	).trim() || "/kpop/banner-data";
	const url = new URL(endpoint, window.location.origin);
	url.searchParams.set("source", source);
	Object.entries(extraParams).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== "") {
			url.searchParams.set(key, String(value));
		}
	});
	return `${url.pathname}${url.search}`;
}

function getPeriodLabel(period) {
	return getChartPeriodLabel(period, periodLabels);
}

function createBannerInstance(root) {
	return {
		root,
		allSongs: [],
		currentSource: "ichart",
		currentPeriod: "day",
		currentSongIndex: 0,
		modalDetailRenderToken: 0,
		previousBodyOverflow: "",
		lastFocusedElement: null,
		lastRenderedSongKey: "",
	};
}

function getStoredSource() {
	return bannerStorage.getStoredSource();
}

function setStoredSource(source) {
	bannerStorage.setStoredSource(source);
}

function getStoredPeriod() {
	return bannerStorage.getStoredPeriod();
}

function setStoredPeriod(period) {
	bannerStorage.setStoredPeriod(period);
}

function availablePeriods(mainSource) {
	return getAvailablePeriods(songsBySource, mainSource);
}

function resolveAvailableView(source, period) {
	return getResolvedAvailableView(songsBySource, source, period);
}

function applyCurrentView(view, options = {}) {
	const instance = options.instance;
	if (!instance) {
		return;
	}
	instance.currentSource = view?.source || "ichart";
	instance.currentPeriod =
		view?.period || defaultPeriodForSource(instance.currentSource);
	instance.allSongs = Array.isArray(view?.songs) ? view.songs : [];

	if (options.persist) {
		setStoredSource(instance.currentSource);
		setStoredPeriod(instance.currentPeriod);
	}
}

function resolveIchartAggregatePoints(song) {
	if (!song || song.chartFamily) {
		return song?.points || "-";
	}

	const weekMatch = findMatchingWeekSong(song);
	if (weekMatch?.points) {
		return weekMatch.points;
	}

	return song.points || "-";
}

function songIdentity(song) {
	return `${song?.detailUrl || ""}|${song?.title || ""}|${song?.artist || ""}`;
}

function currentTopSongKey() {
	const topSong =
		(songsBySource["ichart-day"] || []).find(
			(song) => Number(song?.rank) === 1,
		) ||
		(songsBySource["ichart-week"] || []).find(
			(song) => Number(song?.rank) === 1,
		) ||
		null;
	return topSong ? songIdentity(topSong) : "";
}

function readLikeCelebrationState() {
	return bannerStorage.readLikeCelebrationState();
}

function isSongLiked(song) {
	const state = readLikeCelebrationState();
	return !!state[songIdentity(song)]?.liked;
}

function setSongLiked(song, liked) {
	const state = readLikeCelebrationState();
	const key = songIdentity(song);
	const current = state[key] || {
		activeTopRun: false,
		celebrated: false,
		liked: false,
	};
	current.liked = liked;
	if (!liked) {
		current.celebrated = false;
	}
	state[key] = current;
	writeLikeCelebrationState(state);
}

function writeLikeCelebrationState(state) {
	bannerStorage.writeLikeCelebrationState(state);
}

function syncTopRunState(song) {
	const state = readLikeCelebrationState();
	const key = songIdentity(song);
	Object.keys(state).forEach((songKey) => {
		if (songKey !== key && state[songKey]?.activeTopRun) {
			state[songKey].activeTopRun = false;
			state[songKey].celebrated = false;
		}
	});

	if (!song || song.chartFamily || Number(song.rank) !== 1) {
		writeLikeCelebrationState(state);
		return;
	}

	const current = state[key] || {
		activeTopRun: false,
		celebrated: false,
		liked: false,
	};
	current.activeTopRun = true;
	state[key] = current;
	writeLikeCelebrationState(state);
}

function maybeCelebrateOnTopSongChange(instance) {
	const nextTopKey = currentTopSongKey();
	if (!instance || !nextTopKey || nextTopKey === instance.lastRenderedSongKey) {
		return;
	}
	instance.lastRenderedSongKey = nextTopKey;

	const topSong =
		(songsBySource["ichart-day"] || []).find(
			(song) => songIdentity(song) === nextTopKey,
		) ||
		(songsBySource["ichart-week"] || []).find(
			(song) => songIdentity(song) === nextTopKey,
		) ||
		null;
	if (!topSong || !shouldCelebrateOnUserLike(topSong)) {
		return;
	}

	const pakColors = [
		"#f472b6",
		"#60a5fa",
		"#4ade80",
		"#fb7185",
		"#c084fc",
		"#fcd34d",
		"#ffffff",
	];
	fireMultipleCannons(pakColors);
}

function shouldCelebrateOnUserLike(song) {
	if (!song || song.chartFamily || Number(song.rank) !== 1) {
		return false;
	}

	const state = readLikeCelebrationState();
	const key = songIdentity(song);
	const current = state[key] || {
		activeTopRun: false,
		celebrated: false,
		liked: false,
	};
	if (!current.liked) {
		state[key] = current;
		writeLikeCelebrationState(state);
		return false;
	}
	if (!current.activeTopRun) {
		current.activeTopRun = true;
		current.celebrated = false;
	}
	if (current.celebrated) {
		state[key] = current;
		writeLikeCelebrationState(state);
		return false;
	}
	current.celebrated = true;
	state[key] = current;
	writeLikeCelebrationState(state);
	return true;
}

function updateLikeButtonState(button, song) {
	if (!(button instanceof HTMLElement)) {
		return;
	}
	const activeButton = button.id
		? button.ownerDocument?.getElementById(button.id) || button
		: button;
	if (!(activeButton instanceof HTMLElement)) {
		return;
	}
	const liked = isSongLiked(song);
	activeButton.classList.toggle("is-liked", liked);
	activeButton.dataset.liked = liked ? "1" : "0";
	activeButton.setAttribute("aria-pressed", liked ? "true" : "false");
	activeButton.setAttribute("aria-label", liked ? "取消点赞" : "点赞");
	activeButton.setAttribute("title", liked ? "取消点赞" : "点赞");
	const icon = activeButton.querySelector(".kpop-celebration__like-icon");
	if (icon instanceof HTMLElement) {
		icon.textContent = liked ? "♥" : "♡";
	}
}

function setBannerStorageScope(userId) {
	bannerStorage.setBannerStorageScope(userId);
}

function getReappearMinutes() {
	const raw = Number(getKpopBannerSetting("kpop_banner_reappear_minutes", 60));
	if (!Number.isFinite(raw) || raw <= 0) {
		return 60;
	}
	return Math.floor(raw);
}

function getHiddenUntil() {
	return bannerStorage.getHiddenUntil();
}

function setHiddenUntil(timestamp) {
	bannerStorage.setHiddenUntil(timestamp);
}

function clearHiddenUntil() {
	bannerStorage.clearHiddenUntil();
}

function isBannerHiddenNow() {
	const hiddenUntil = getHiddenUntil();
	if (!hiddenUntil) {
		return false;
	}
	if (Date.now() >= hiddenUntil) {
		clearHiddenUntil();
		return false;
	}
	return true;
}

function findMatchingWeekSong(song) {
	return (
		(songsBySource["ichart-week"] || []).find((item) =>
			matchesSongIdentity(item, song),
		) || null
	);
}

function hasRealtimeRankOne(song, platformName) {
	return (Array.isArray(song?.detailRows) ? song.detailRows : []).some(
		(row) =>
			row?.platform === platformName &&
			Number(row?.rank) === 1 &&
			isAllKillChartRow(platformName, row?.chartName),
	);
}

function hasIchartWeeklyRankOne(song) {
	const detailMatch = (
		Array.isArray(song?.detailRows) ? song.detailRows : []
	).some(
		(row) =>
			row?.platform === "iChart" &&
			Number(row?.rank) === 1 &&
			String(row?.chartName || "").includes("周榜"),
	);

	if (detailMatch) {
		return true;
	}

	return Number(findMatchingWeekSong(song)?.rank) === 1;
}

function getIchartAchievement(song) {
	if (!song || song.chartFamily) {
		return "";
	}

	const requiredPlatforms = [
		"YouTube",
		"Melon",
		"Genie",
		"Flo",
		"VIBE",
		"Bugs",
	];
	const hasAllKill = requiredPlatforms.every((platformName) =>
		hasRealtimeRankOne(song, platformName),
	);
	if (!hasAllKill) {
		return "";
	}

	return hasIchartWeeklyRankOne(song) ? "PAK" : "AK";
}

function setImageSource(img, src, alt) {
	if (!(img instanceof HTMLImageElement)) {
		return;
	}

	img.alt = alt || "";
	img.onload = null;
	img.classList.remove("is-visible");

	if (!src) {
		img.removeAttribute("src");
		return;
	}

	img.onload = () => {
		img.classList.add("is-visible");
	};
	img.src = src;

	if (img.complete && img.naturalWidth > 0) {
		img.classList.add("is-visible");
	}
}

function getHeroCoverBadgeHtml(song) {
	const achievementLevel = getIchartAchievement(song);
	if (achievementLevel === "PAK") {
		return '<div class="kpop-celebration__cover-badge"><span class="kpop-celebration__cover-badge-main">PAK</span><span class="kpop-celebration__cover-badge-sub">ALL KILL</span></div>';
	}
	if (achievementLevel === "AK") {
		return '<div class="kpop-celebration__cover-badge"><span class="kpop-celebration__cover-badge-main is-rak">AK</span><span class="kpop-celebration__cover-badge-sub">ALL KILL</span></div>';
	}
	return "";
}

function getCircleHeroMetaHtml(song) {
	const familyLabel =
		song.chartFamily === "global"
			? "Global K-pop"
			: song.chartFamily === "album"
				? "Album Chart"
				: "Digital Chart";
	const periodLabel =
		song.chartPeriod === "year"
			? "年榜"
			: song.chartPeriod === "month"
				? "月榜"
				: song.chartPeriod === "week"
					? "周榜"
					: "日榜";
	const certLabel = song.circleMeta?.cert
		? `<span class="circle-badge cert">🏅 ${song.circleMeta.cert}</span>`
		: "";

	return `<div class="kpop-celebration__circle-meta"><div class="circle-badges-row"><span class="circle-badge ${song.chartFamily}">${familyLabel}</span><span class="circle-badge period">${periodLabel}</span>${certLabel}</div></div>`;
}

function applyBannerLayoutStyles(elements) {
	if (elements.modalContent instanceof HTMLElement) {
		elements.modalContent.style.backgroundColor = "var(--secondary)";
		elements.modalContent.style.border = "2px solid var(--primary-low-mid)";
		elements.modalContent.style.boxShadow =
			"0 16px 40px -12px rgba(0, 0, 0, 0.35)";
	}
	if (elements.sidebar instanceof HTMLElement) {
		elements.sidebar.style.display = "flex";
		elements.sidebar.style.visibility = "visible";
		elements.sidebar.style.opacity = "1";
	}
	if (elements.modalTableWrapper instanceof HTMLElement) {
		elements.modalTableWrapper.style.backgroundColor = "var(--bg-sidebar)";
	}

	elements.heroLeft.style.position = "relative";
	elements.heroLeft.style.display = "flex";
	elements.heroLeft.style.alignItems = "center";
	elements.heroLeft.style.height = "72px";
	elements.heroLeft.style.minHeight = "72px";
	elements.heroCoverLink.style.position = "relative";
	elements.heroCoverLink.style.display = "block";
	elements.heroCoverLink.style.width = "100%";
	elements.heroCoverLink.style.height = "100%";

	if (elements.mainRow instanceof HTMLElement) {
		elements.mainRow.style.height = "";
		elements.mainRow.style.backgroundColor = "var(--secondary)";
		elements.mainRow.style.borderColor = "var(--primary-low)";
		elements.mainRow.style.color = "var(--primary)";
		elements.mainRow.style.boxShadow = "none";
	}
	if (elements.heroMain instanceof HTMLElement) {
		elements.heroMain.style.alignItems = "stretch";
		elements.heroMain.style.gap = "10px";
		elements.heroMain.style.padding = "8px 10px";
	}
	if (elements.heroCenter instanceof HTMLElement) {
		elements.heroCenter.style.minHeight = "72px";
		elements.heroCenter.style.justifyContent = "center";
	}
	if (elements.heroInfoHeader instanceof HTMLElement) {
		elements.heroInfoHeader.style.gap = "2px";
		elements.heroInfoHeader.style.marginBottom = "8px";
	}
	if (elements.heroRight instanceof HTMLElement) {
		elements.heroRight.style.minHeight = "72px";
		elements.heroRight.style.justifyContent = "center";
		elements.heroRight.style.paddingLeft = "8px";
		elements.heroRight.style.paddingRight = "10px";
		elements.heroRight.style.gap = "8px";
	}
	if (elements.heroRankBadge instanceof HTMLElement) {
		elements.heroRankBadge.style.boxShadow = "none";
	}
	if (elements.heroGlow instanceof HTMLElement) {
		elements.heroGlow.style.display = "none";
	}

	elements.controlsRow.style.display = "flex";
	elements.controlsRow.style.alignItems = "center";
	elements.controlsRow.style.gap = "10px";
	elements.controlsRow.style.marginBottom = "12px";
	elements.controlsRow.style.width = "100%";
}

function cloneSongsBySource(input) {
	const next = createEmptySongsBySource();
	Object.keys(next).forEach((key) => {
		next[key] = Array.isArray(input?.[key]) ? input[key] : [];
	});
	return next;
}

function getBannerDataCache() {
	if (!bannerDataCache) {
		bannerDataCache = createKpopBanner105DataCache({ cloneSongsBySource });
	}

	return bannerDataCache;
}

function hasAnySongs(input) {
	return Object.values(input || {}).some(
		(items) => Array.isArray(items) && items.length,
	);
}

function readCachePayload(kind) {
	return getBannerDataCache().readCachePayload(kind);
}

function writeCachePayload(kind, bucketKey, data) {
	getBannerDataCache().writeCachePayload(kind, bucketKey, data);
}

function getCachedSourceData(kind, bucketKey) {
	return getBannerDataCache().getCachedSourceData(kind, bucketKey);
}

function mergeSongsBySource(...sources) {
	const next = createEmptySongsBySource();

	sources.forEach((source) => {
		if (!source) {
			return;
		}

		Object.keys(next).forEach((key) => {
			if (Array.isArray(source[key]) && source[key].length) {
				next[key] = source[key];
			}
		});
	});

	return next;
}

function normalizeImageLookupText(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

function hydrateMusicShowRankImages(nextSongsBySource) {
	const songImageMap = new Map();
	const artistImageMap = new Map();

	Object.entries(nextSongsBySource || {}).forEach(([key, songs]) => {
		if (key === "kpopping-song-wins" || key === "kpopping-artist-wins" || !Array.isArray(songs)) {
			return;
		}

		songs.forEach((song) => {
			const imageUrl = String(song?.imageUrl || "").trim();
			const artist = normalizeImageLookupText(song?.artist);
			const title = normalizeImageLookupText(song?.title);
			if (!imageUrl || !artist) {
				return;
			}

			if (title && !songImageMap.has(`${artist}|||${title}`)) {
				songImageMap.set(`${artist}|||${title}`, imageUrl);
			}
			if (!artistImageMap.has(artist)) {
				artistImageMap.set(artist, imageUrl);
			}
		});
	});

	["kpopping-song-wins", "kpopping-artist-wins"].forEach((key) => {
		if (!Array.isArray(nextSongsBySource?.[key])) {
			return;
		}

		nextSongsBySource[key] = nextSongsBySource[key].map((song) => {
			if (song?.imageUrl) {
				return song;
			}

			const artist = normalizeImageLookupText(song?.artist);
			const title = normalizeImageLookupText(song?.title);
			const imageUrl = key === "kpopping-song-wins"
				? songImageMap.get(`${artist}|||${title}`) || artistImageMap.get(artist) || ""
				: artistImageMap.get(title) || artistImageMap.get(artist) || "";

			return imageUrl ? { ...song, imageUrl } : song;
		});
	});

	return nextSongsBySource;
}

function applyHydratedSongs(nextSongsBySource) {
	songsBySource = cloneSongsBySource(hydrateMusicShowRankImages(nextSongsBySource));
	kpoppingHistoryEpisodes = Array.isArray(songsBySource["kpopping-history"])
		? songsBySource["kpopping-history"]
		: [];
	hydrated = true;
}

function getKpoppingHistoryItems() {
	return Array.isArray(kpoppingHistoryEpisodes) ? kpoppingHistoryEpisodes : [];
}

function resolveKpoppingHistoryView(period) {
	const songs = songsBySource[`kpopping-${period}`] || [];
	const historyItem = getKpoppingHistoryItems().find(
		(item) => item?.period === period,
	);
	if (historyItem?.title) {
		periodLabels.set(period, `📺 往期节目: ${historyItem.title}`);
	}
	return songs.length ? { source: "kpopping", period, songs } : null;
}

async function fetchJsonWithDedup(url) {
	const promiseKey = `json:${url}`;
	if (jsonRequestPromises.has(promiseKey)) {
		return jsonRequestPromises.get(promiseKey);
	}

	const promise = (async () => {
		const resp = await fetch(url, {
			headers: { accept: "application/json" },
			cache: "no-store",
		});
		if (!resp.ok) {
			return null;
		}
		return resp.json();
	})()
		.catch(() => null)
		.finally(() => {
			jsonRequestPromises.delete(promiseKey);
		});

	jsonRequestPromises.set(promiseKey, promise);
	return promise;
}

async function fetchUnifiedSongsFromNetwork(candidates) {
	const nextSongsBySource = createEmptySongsBySource();

	for (const url of candidates) {
		const data = await fetchJsonWithDedup(url);
		if (!data) {
			continue;
		}

		const ichartCharts = data?.charts?.ichart || data?.charts || null;
		const ichartPeriods = ichartCharts?.periods || ichartCharts;
		const mappedIchartDay = (
			Array.isArray(ichartPeriods?.day?.items)
				? ichartPeriods.day.items
				: Array.isArray(data?.charts?.ichart?.items)
					? data.charts.ichart.items
					: []
		)
			.map(mapSong)
			.filter((s) => s?.title && s?.artist);
		const mappedIchartWeek = (
			Array.isArray(ichartPeriods?.week?.items) ? ichartPeriods.week.items : []
		)
			.map(mapSong)
			.filter((s) => s?.title && s?.artist);
		const mappedCircle = (
			Array.isArray(data?.charts?.circlechart?.items)
				? data.charts.circlechart.items
				: []
		)
			.map((item) => mapCircleSong(item, "global", "day", "Circle Global"))
			.filter((s) => s?.title && s?.artist);
		const mappedSingle = (Array.isArray(data?.items) ? data.items : [])
			.map(mapSong)
			.filter((s) => s?.title && s?.artist);

		if (mappedIchartDay.length) {
			nextSongsBySource["ichart-day"] = mappedIchartDay;
		} else if (!nextSongsBySource["ichart-day"].length && mappedSingle.length) {
			nextSongsBySource["ichart-day"] = mappedSingle;
		}

		if (mappedIchartWeek.length) {
			nextSongsBySource["ichart-week"] = mappedIchartWeek;
		}

		if (mappedCircle.length) {
			nextSongsBySource["circle-global-day"] = mappedCircle;
		}
	}

	return nextSongsBySource;
}

async function fetchCircleMultiSongsFromNetwork() {
	const nextSongsBySource = createEmptySongsBySource();
	const multi = await fetchJsonWithDedup(getKpopBannerDataUrl("circle"));

	if (!multi) {
		return nextSongsBySource;
	}

	const charts = Array.isArray(multi?.charts) ? multi.charts : [];
	charts.forEach((chart) => {
		const period = String(
			chart?.params?.termGbn || chart?.id?.split("_").pop() || "",
		).toLowerCase();
		if (!["day", "week", "month", "year"].includes(period)) {
			return;
		}

		let key = "";
		if (chart?.family === "global") {
			key = `circle-global-${period}`;
		} else if (chart?.family === "album") {
			key = `circle-album-${period}`;
		} else if (chart?.family === "onoff") {
			const service = String(chart?.params?.serviceGbn || "").toUpperCase();
			if (service !== "ALL") {
				return;
			}
			key = `circle-digital-${period}`;
		}

		if (!key || !(key in nextSongsBySource)) {
			return;
		}

		const mapped = (Array.isArray(chart?.items) ? chart.items : [])
			.map((item) =>
				mapCircleSong(
					item,
					chart.family,
					period,
					chart.label || chart.id || "Circle",
				),
			)
			.filter((s) => s?.title && s?.artist);

		if (mapped.length) {
			nextSongsBySource[key] = mapped;
		}
	});

	return nextSongsBySource;
}

async function fetchKpoppingSongsFromNetwork(candidates) {
	const nextSongsBySource = createEmptySongsBySource();
	const applyKpoppingEpisodes = (episodes) => {
		const usableEpisodes = (Array.isArray(episodes) ? episodes : [])
			.filter(
				(episode) =>
					Array.isArray(episode?.performances) &&
					episode.performances.length > 0,
			)
			.slice(0, kpoppingEpisodePeriodCount);
		const latestEpisode = selectLatestKpoppingEpisode(usableEpisodes);
		const mapped = mapKpoppingEpisode(latestEpisode, "stages");

		if (!mapped.length) {
			return false;
		}

		const rankings = buildKpoppingWinRankings(usableEpisodes);
		nextSongsBySource["kpopping-stages"] = mapped;
		nextSongsBySource["kpopping-song-wins"] = rankings.songRows;
		nextSongsBySource["kpopping-artist-wins"] = rankings.artistRows;
		nextSongsBySource["kpopping-history"] = usableEpisodes.map(
			buildKpoppingHistoryItem,
		);
		kpoppingHistoryEpisodes = nextSongsBySource["kpopping-history"];

		usableEpisodes.forEach((episode, index) => {
			const period = `ep${index}`;
			const episodeMapped = mapKpoppingEpisode(episode, period);
			if (episodeMapped.length) {
				nextSongsBySource[`kpopping-${period}`] = episodeMapped;
				periodLabels.set(period, getKpoppingEpisodeLabel(episode, index));
			}
		});
		return true;
	};

	for (const url of candidates) {
		const data = await fetchJsonWithDedup(url);
		if (!data) {
			continue;
		}

		const episodes = Array.isArray(data)
			? data
			: Array.isArray(data?.data)
				? data.data
			: Array.isArray(data?.episodes)
				? data.episodes
				: Array.isArray(data?.charts?.kpopping?.episodes)
					? data.charts.kpopping.episodes
					: [];

		if (applyKpoppingEpisodes(episodes)) {
			break;
		}
	}

	if (!hasAnySongs(nextSongsBySource)) {
		applyKpoppingEpisodes(fallbackKpoppingEpisodes);
	}

	return nextSongsBySource;
}

async function fetchSoridataRankingsFromNetwork(candidates) {
	const nextSongsBySource = createEmptySongsBySource();
	const applySoridataSummary = (summary) => {
		const rankings = buildSoridataWinRankings(summary);
		if (!rankings.songRows.length && !rankings.artistRows.length) {
			return false;
		}

		nextSongsBySource["kpopping-song-wins"] = rankings.songRows;
		nextSongsBySource["kpopping-artist-wins"] = rankings.artistRows;
		return true;
	};

	for (const url of candidates) {
		const data = await fetchJsonWithDedup(url);
		if (data && applySoridataSummary(data)) {
			break;
		}
	}

	if (!hasAnySongs(nextSongsBySource)) {
		applySoridataSummary(fallbackSoridataMusicShowWins);
	}

	return nextSongsBySource;
}

async function refreshSourceData(kind, bucketKey, fetcher) {
	const promiseKey = `${kind}:${bucketKey}`;
	if (sourceRefreshPromises.has(promiseKey)) {
		return sourceRefreshPromises.get(promiseKey);
	}

	const promise = (async () => {
		const data = await fetcher();
		if (hasAnySongs(data)) {
			writeCachePayload(kind, bucketKey, data);
			return cloneSongsBySource(data);
		}

		const cached = readCachePayload(kind);
		return cloneSongsBySource(cached?.data);
	})().finally(() => {
		sourceRefreshPromises.delete(promiseKey);
	});

	sourceRefreshPromises.set(promiseKey, promise);
	return promise;
}

function dispatchBannerDataUpdated(signature) {
	if (typeof window === "undefined") {
		return;
	}

	window.dispatchEvent(
		new CustomEvent(bannerDataUpdatedEvent, {
			detail: { signature },
		}),
	);
}

function refreshRenderedSongsFromCache(signature) {
	const merged = mergeSongsBySource(
		readCachePayload("unified")?.data,
		readCachePayload("circleMulti")?.data,
		readCachePayload("kpopping")?.data,
		readCachePayload("soridata")?.data,
	);

	if (!hasAnySongs(merged)) {
		return;
	}

	applyHydratedSongs(merged);
	lastHydratedSignature = signature || lastHydratedSignature;
	dispatchBannerDataUpdated(signature || lastHydratedSignature);
}

function refreshSourceDataInBackground(kind, bucketKey, fetcher, signature) {
	void refreshSourceData(kind, bucketKey, fetcher)
		.then(() => {
			refreshRenderedSongsFromCache(signature);
		})
		.catch(() => {});
}

function sourceNeedsCircleMultiData(source, period) {
	if (source === "ichart" || source === "kpopping") {
		return false;
	}

	return !(source === "circle-global" && period === "day");
}

async function ensureCircleMultiDataAvailable() {
	const circleBucketKey = getCircleMultiBucketKey();
	const signature = `${getIchartBucketKey()}|${circleBucketKey}`;
	const circleCache = getCachedSourceData("circleMulti", circleBucketKey);

	if (hasAnySongs(circleCache.fresh)) {
		applyHydratedSongs(mergeSongsBySource(songsBySource, circleCache.fresh));
		lastHydratedSignature = signature;
		return circleCache.fresh;
	}

	if (hasAnySongs(circleCache.stale)) {
		applyHydratedSongs(mergeSongsBySource(songsBySource, circleCache.stale));
		refreshSourceDataInBackground(
			"circleMulti",
			circleBucketKey,
			() => fetchCircleMultiSongsFromNetwork(),
			signature,
		);
		return circleCache.stale;
	}

	const freshCircle = await refreshSourceData(
		"circleMulti",
		circleBucketKey,
		() => fetchCircleMultiSongsFromNetwork(),
	);
	if (hasAnySongs(freshCircle)) {
		applyHydratedSongs(mergeSongsBySource(songsBySource, freshCircle));
		lastHydratedSignature = signature;
	}

	return freshCircle;
}

async function ensureKpoppingDataAvailable() {
	const kpoppingCandidates = [getKpopBannerDataUrl("kpopping")];
	const soridataCandidates = [getKpopBannerDataUrl("soridata")];

	const kpoppingBucketKey = getKpoppingBucketKey();
	const soridataBucketKey = getSoridataBucketKey();
	const signature = `${getIchartBucketKey()}|${getCircleMultiBucketKey()}|${kpoppingBucketKey}|${soridataBucketKey}`;
	const kpoppingCache = getCachedSourceData("kpopping", kpoppingBucketKey);
	const soridataCache = getCachedSourceData("soridata", soridataBucketKey);

	if (hasAnySongs(kpoppingCache.fresh)) {
		applyHydratedSongs(
			mergeSongsBySource(
				songsBySource,
				kpoppingCache.fresh,
				soridataCache.fresh || soridataCache.stale,
			),
		);
		lastHydratedSignature = signature;
		return kpoppingCache.fresh;
	}

	if (hasAnySongs(kpoppingCache.stale)) {
		applyHydratedSongs(
			mergeSongsBySource(
				songsBySource,
				kpoppingCache.stale,
				soridataCache.fresh || soridataCache.stale,
			),
		);
		refreshSourceDataInBackground(
			"kpopping",
			kpoppingBucketKey,
			() => fetchKpoppingSongsFromNetwork(kpoppingCandidates),
			signature,
		);
		return kpoppingCache.stale;
	}

	const [freshKpopping, freshSoridata] = await Promise.all([
		refreshSourceData("kpopping", kpoppingBucketKey, () =>
			fetchKpoppingSongsFromNetwork(kpoppingCandidates),
		),
		refreshSourceData("soridata", soridataBucketKey, () =>
			fetchSoridataRankingsFromNetwork(soridataCandidates),
		),
	]);
	if (hasAnySongs(freshKpopping)) {
		applyHydratedSongs(
			mergeSongsBySource(songsBySource, freshKpopping, freshSoridata),
		);
		lastHydratedSignature = signature;
	}

	return freshKpopping;
}

async function hydrateSongs() {
	const candidates = [
		getKpopBannerDataUrl("unified"),
		getKpopBannerDataUrl("ichart"),
	];
	const kpoppingCandidates = [getKpopBannerDataUrl("kpopping")];
	const soridataCandidates = [getKpopBannerDataUrl("soridata")];

	const unifiedBucketKey = getIchartBucketKey();
	const circleBucketKey = getCircleMultiBucketKey();
	const kpoppingBucketKey = getKpoppingBucketKey();
	const soridataBucketKey = getSoridataBucketKey();
	const signature = `${unifiedBucketKey}|${circleBucketKey}|${kpoppingBucketKey}|${soridataBucketKey}`;

	if (
		hydrated &&
		hasAnySongs(songsBySource) &&
		lastHydratedSignature === signature
	) {
		return;
	}

	if (hydratePromise) {
		return hydratePromise;
	}

	hydratePromise = (async () => {
		const unifiedCache = getCachedSourceData("unified", unifiedBucketKey);
		const circleCache = getCachedSourceData("circleMulti", circleBucketKey);
		const kpoppingCache = getCachedSourceData("kpopping", kpoppingBucketKey);
		const soridataCache = getCachedSourceData("soridata", soridataBucketKey);
		const cachedMerged = mergeSongsBySource(
			unifiedCache.fresh || unifiedCache.stale,
			circleCache.fresh || circleCache.stale,
			kpoppingCache.fresh || kpoppingCache.stale,
			soridataCache.fresh || soridataCache.stale,
		);

		if (hasAnySongs(cachedMerged)) {
			applyHydratedSongs(cachedMerged);
			lastHydratedSignature = signature;

			if (!unifiedCache.fresh) {
				refreshSourceDataInBackground(
					"unified",
					unifiedBucketKey,
					() => fetchUnifiedSongsFromNetwork(candidates),
					signature,
				);
			}

			if (!kpoppingCache.fresh) {
				refreshSourceDataInBackground(
					"kpopping",
					kpoppingBucketKey,
					() => fetchKpoppingSongsFromNetwork(kpoppingCandidates),
					signature,
				);
			}

			if (!soridataCache.fresh) {
				refreshSourceDataInBackground(
					"soridata",
					soridataBucketKey,
					() => fetchSoridataRankingsFromNetwork(soridataCandidates),
					signature,
				);
			}

			return;
		}

		const [freshUnified, freshKpopping, freshSoridata] = await Promise.all([
			refreshSourceData("unified", unifiedBucketKey, () =>
				fetchUnifiedSongsFromNetwork(candidates),
			),
			refreshSourceData("kpopping", kpoppingBucketKey, () =>
				fetchKpoppingSongsFromNetwork(kpoppingCandidates),
			),
			refreshSourceData("soridata", soridataBucketKey, () =>
				fetchSoridataRankingsFromNetwork(soridataCandidates),
			),
		]);
		const merged = mergeSongsBySource(
			freshUnified,
			circleCache.fresh || circleCache.stale,
			freshKpopping,
			freshSoridata,
		);
		applyHydratedSongs(merged);
		lastHydratedSignature = signature;
	})().finally(() => {
		hydratePromise = null;
	});

	return hydratePromise;
}

async function hydrateStoredViewData() {
	const storedSource = normalizeSelectedSource(getStoredSource());
	const storedPeriod = normalizeSelectedPeriod(getStoredPeriod(), storedSource);

	if (sourceNeedsCircleMultiData(storedSource, storedPeriod)) {
		await ensureCircleMultiDataAvailable();
	}

	if (storedSource === "kpopping" && !availablePeriods("kpopping").length) {
		await ensureKpoppingDataAvailable();
	}
}

function ensureSingleBannerRoot() {
	const roots = Array.from(document.querySelectorAll("[data-kpop-banner]"));
	if (roots.length <= 1) {
		return;
	}

	const preferred =
		roots.find(
			(root) =>
				root.closest(".above-main-container") ||
				root.closest(".above-main-container-outlet"),
		) || roots[0];

	roots.forEach((root) => {
		if (root !== preferred) {
			root.remove();
		}
	});
}

const bannerCleanupRegistry = new WeakMap();

function bindBanner(root, hooks = {}) {
	if (!root) return;

	const instance = createBannerInstance(root);
	const setHeroState =
		typeof hooks.setHeroState === "function" ? hooks.setHeroState : () => {};
	const setSidebarState =
		typeof hooks.setSidebarState === "function"
			? hooks.setSidebarState
			: () => {};
	const setModalState =
		typeof hooks.setModalState === "function" ? hooks.setModalState : () => {};
	const setHistoryState =
		typeof hooks.setHistoryState === "function"
			? hooks.setHistoryState
			: () => {};

	if (isBannerHiddenNow()) {
		root.dataset.kpopHidden = "1";
		return;
	}

	if (root.dataset.kpopHidden === "1") {
		root.dataset.kpopHidden = "0";
	}

	if (root.dataset.kpopBound === "1") return;

	const sidebar = root.querySelector(".kpop-celebration__mini-sidebar");
	const heroTitle = root.querySelector("#hero-title");
	const heroRank = root.querySelector("#hero-rank");
	const heroArtist = root.querySelector("#hero-artist");
	const heroCover = root.querySelector("#hero-cover");
	const heroCoverLink = root.querySelector(".kpop-celebration__cover-link");
	const heroLeft = root.querySelector(".kpop-celebration__left");
	const heroPoints = root.querySelector("#hero-points");
	const heroPointsLabel = root.querySelector("#hero-points-label");
	const heroStatusWrap = root.querySelector("#hero-status-wrap");
	const heroExtraInfo = root.querySelector("#hero-extra-info");
	const heroRankBadge = root.querySelector(".kpop-celebration__rank-badge");
	const heroGlow = root.querySelector(".kpop-celebration__glow");
	const heroCoverBadgeContainer = root.querySelector(
		"#hero-cover-badge-container",
	);
	const modal = root.querySelector("#details-modal");
	const historyModal = root.querySelector("#history-modal");
	const openModalBtn = root.querySelector("#open-modal-btn");
	const closeModalBtn = root.querySelector("#close-modal-btn");
	const closeHistoryBtn = root.querySelector("#close-history-btn");
	const dismissBannerBtn = root.querySelector("#close-banner-btn");
	const confettiBtn = root.querySelector("#confetti-btn");
	const controlsRow = root.querySelector(".kpop-controls-row");
	const sourceSelect = root.querySelector("#kpop-source-select");
	const periodSelect = root.querySelector("#kpop-period-select");
	const mainRow = root.querySelector(".kpop-celebration__main-row");
	const heroMain = root.querySelector(".kpop-celebration__hero-main");
	const heroCenter = root.querySelector(".kpop-celebration__center");
	const heroInfoHeader = root.querySelector(".kpop-celebration__info-header");
	const heroRight = root.querySelector(".kpop-celebration__right");
	const likeIcon = root.querySelector(".kpop-celebration__like-icon");
	const modalTableHead = root.querySelector("#modal-table-head");
	const modalTableTitle = root.querySelector("#modal-table-title");
	const modalPointsSummary = root.querySelector("#modal-points-summary");
	const modalTableBody = root.querySelector("#modal-table-body");
	const modalContent = modal?.querySelector(".kpop-modal-content");
	const modalTableWrapper = modal?.querySelector(".kpop-modal-table-wrapper");
	const modalCover = modal?.querySelector("#modal-cover");
	const modalTitle = modal?.querySelector("#modal-title");
	const modalArtist = modal?.querySelector("#modal-artist");
	const modalTotalPoints = modal?.querySelector("#modal-total-points");
	const modalBadgeContainer = modal?.querySelector("#modal-badge-container");

	if (
		!sidebar ||
		!heroTitle ||
		!heroRank ||
		!heroArtist ||
		!heroCover ||
		!heroCoverLink ||
		!heroLeft ||
		!heroPoints ||
		!heroPointsLabel ||
		!heroStatusWrap ||
		!heroExtraInfo ||
		!modal ||
		!historyModal ||
		!openModalBtn ||
		!closeModalBtn ||
		!closeHistoryBtn ||
		!modalCover ||
		!modalTitle ||
		!modalArtist ||
		!modalTotalPoints ||
		!modalBadgeContainer ||
		!modalTableBody ||
		!modalTableHead ||
		!modalTableTitle ||
		!modalPointsSummary ||
		!dismissBannerBtn ||
		!controlsRow ||
		!sourceSelect ||
		!periodSelect
	) {
		return;
	}

	applyBannerLayoutStyles({
		sidebar,
		modalContent,
		modalTableWrapper,
		heroLeft,
		heroCoverLink,
		mainRow,
		heroMain,
		heroCenter,
		heroInfoHeader,
		heroRight,
		heroRankBadge,
		heroGlow,
		controlsRow,
	});

	const renderController = createKpopBanner105RenderController({
		instance,
		sidebar,
		heroTitle,
		heroArtist,
		heroPoints,
		heroCover,
		heroRank,
		heroCoverLink,
		heroLeft,
		heroMain,
		heroCenter,
		heroRight,
		heroPointsLabel,
		heroStatusWrap,
		heroExtraInfo,
		heroCoverBadgeContainer,
		confettiBtn,
		likeIcon,
		prefersReducedMotion,
		setImageSource,
		buildMvSearchUrl,
		getCountBadgeHtml,
		getCircleHeroMetaHtml,
		getHeroCoverBadgeHtml,
		getPlatformPillsHtml,
		updateLikeButtonState,
		syncTopRunState,
		setHeroState,
		setSidebarState,
	});

	const viewController = createKpopBanner105ViewController({
		instance,
		sourceSelect,
		periodSelect,
		getPeriodLabel,
		getKpoppingHistoryItems,
		resolveKpoppingHistoryView,
		setHistoryState,
		root,
		bannerDataUpdatedEvent,
		renderController,
		applyCurrentView,
		resolveAvailableView,
		getStoredSource,
		getStoredPeriod,
		availablePeriods,
		normalizeSelectedSource,
		normalizeSelectedPeriod,
		defaultPeriodForSource,
		sourceNeedsCircleMultiData,
		ensureCircleMultiDataAvailable,
		ensureKpoppingDataAvailable,
		maybeCelebrateOnTopSongChange,
	});

	const renderLoadingState = () => {
		root.dataset.kpopLoading = "1";
		heroRank.textContent = "-";
		heroTitle.textContent = "加载中...";
		heroArtist.textContent = "排行榜数据加载中";
		heroPoints.textContent = "--";
		heroPointsLabel.textContent = "LOADING";
		setHeroState({
			rank: "-",
			title: "加载中...",
			artist: "排行榜数据加载中",
			points: "--",
			pointsLabel: "LOADING",
			isMusicShow: false,
			hideLikeButton: false,
			winnerArtist: "",
			winnerSong: "",
			coverSrc: "",
			coverAlt: "",
			coverHref: "#",
			coverAriaLabel: "Open music video in a new tab",
			badgeHtml: "",
			extraInfoHtml: loadingPlatformMarqueeHtml,
		});
		heroStatusWrap.innerHTML =
			'<div class="kpop-celebration__badge kpop-celebration__badge--loading"><span class="kpop-celebration__badge-text">SYNC</span></div>';
		heroExtraInfo.innerHTML = loadingPlatformMarqueeHtml;
		heroCover.removeAttribute("src");
		heroCoverLink.removeAttribute("href");
		if (heroCoverBadgeContainer) heroCoverBadgeContainer.innerHTML = "";
		setSidebarState([
			{
				index: 0,
				rank: "1",
				title: "加载中...",
				trend: "same",
				trendVal: "...",
				isTop: true,
				isActive: true,
				isUp: false,
				isDown: false,
			},
			{
				index: 1,
				rank: "2",
				title: "加载中...",
				trend: "same",
				trendVal: "...",
				isTop: false,
				isActive: false,
				isUp: false,
				isDown: false,
			},
			{
				index: 2,
				rank: "3",
				title: "加载中...",
				trend: "same",
				trendVal: "...",
				isTop: false,
				isActive: false,
				isUp: false,
				isDown: false,
			},
		]);
		setModalState({
			title: "",
			artist: "",
			totalPoints: "0",
			coverSrc: "",
			coverAlt: "",
			badgeHtml: "",
			tableTitle: "各平台实时排名数据",
			tableHeadHtml: "",
			tableBodyHtml: "",
			pointsTitle: "iChart 综合总分",
			pointsSummaryVisible: true,
		});
		openModalBtn.disabled = true;
		viewController.setSelectControls();
		root.dataset.kpopBound = "pending";
	};

	viewController.seedInstanceView();

	if (!instance.allSongs.length) {
		renderLoadingState();
		return;
	}

	root.dataset.kpopLoading = "0";
	openModalBtn.disabled = false;

	if (modal.parentElement !== document.body) document.body.appendChild(modal);
	if (historyModal.parentElement !== document.body)
		document.body.appendChild(historyModal);

	viewController.handleSidebarClick = (event) => {
		const target =
			event.target instanceof Element
				? event.target.closest(".kpop-celebration__mini-item")
				: null;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		viewController.showSongAt(
			Number.parseInt(target.getAttribute("data-index") || "0", 10),
		);
	};

	const removeSidebarClick = () =>
		sidebar.removeEventListener("click", viewController.handleSidebarClick);
	sidebar.addEventListener("click", viewController.handleSidebarClick);

	if (root.dataset.kpopDataListener !== "1") {
		window.addEventListener(
			bannerDataUpdatedEvent,
			viewController.handleDataUpdated,
		);
		root.dataset.kpopDataListener = "1";
	}
	const removeDataUpdated = () => {
		window.removeEventListener(
			bannerDataUpdatedEvent,
			viewController.handleDataUpdated,
		);
		root.dataset.kpopDataListener = "0";
	};

	const interactionController = createKpopBanner105InteractionController({
		instance,
		root,
		modal,
		historyModal,
		modalCover,
		modalTitle,
		modalArtist,
		modalTotalPoints,
		modalContent,
		modalBadgeContainer,
		modalTableTitle,
		modalTableHead,
		modalTableBody,
		modalPointsSummary,
		openModalBtn,
		closeModalBtn,
		closeHistoryBtn,
		dismissBannerBtn,
		confettiBtn,
		likeIcon,
		heroCoverLink,
		viewController,
		setImageSource,
		resolveIchartAggregatePoints,
		buildCircleModalTableHtml,
		buildMusicShowModalTableHtml,
		buildMusicShowRankModalTableHtml,
		buildIchartModalTableHtml,
		getCountBadgeHtml,
		getModalPlaceholderRowHtml,
		isBannerHiddenNow,
		getReappearMinutes,
		setHiddenUntil,
		setModalState,
		isSongLiked,
		setSongLiked,
		updateLikeButtonState,
		shouldCelebrateOnUserLike,
		fireMultipleCannons,
		buildMvSearchUrl,
	});
	openModalBtn.addEventListener("click", interactionController.openModal);
	closeModalBtn.addEventListener("click", interactionController.closeModal);
	closeHistoryBtn.addEventListener(
		"click",
		interactionController.closeHistoryModal,
	);
	modal.addEventListener(
		"click",
		interactionController.handleModalBackdropClick,
	);
	historyModal.addEventListener(
		"click",
		interactionController.handleHistoryModalClick,
	);
	modal.addEventListener("keydown", interactionController.handleModalKeydown);
	root.addEventListener("click", interactionController.handleRootClick);
	dismissBannerBtn.addEventListener(
		"click",
		interactionController.hideBannerTemporarily,
	);

	sourceSelect.addEventListener("change", viewController.handleSourceChange);
	periodSelect.addEventListener("change", viewController.handlePeriodChange);
	heroCoverLink.addEventListener(
		"click",
		interactionController.openCurrentSongVideo,
	);

	viewController.renderCurrentSelection();
	root.style.display = "";
	root.dataset.kpopBound = "1";

	const cleanup = () => {
		removeSidebarClick();
		removeDataUpdated();
		openModalBtn.removeEventListener("click", interactionController.openModal);
		closeModalBtn.removeEventListener(
			"click",
			interactionController.closeModal,
		);
		closeHistoryBtn.removeEventListener(
			"click",
			interactionController.closeHistoryModal,
		);
		modal.removeEventListener(
			"click",
			interactionController.handleModalBackdropClick,
		);
		historyModal.removeEventListener(
			"click",
			interactionController.handleHistoryModalClick,
		);
		modal.removeEventListener(
			"keydown",
			interactionController.handleModalKeydown,
		);
		root.removeEventListener("click", interactionController.handleRootClick);
		dismissBannerBtn.removeEventListener(
			"click",
			interactionController.hideBannerTemporarily,
		);
		sourceSelect.removeEventListener(
			"change",
			viewController.handleSourceChange,
		);
		periodSelect.removeEventListener(
			"change",
			viewController.handlePeriodChange,
		);
		heroCoverLink.removeEventListener(
			"click",
			interactionController.openCurrentSongVideo,
		);
		root.dataset.kpopBound = "0";
	};

	bannerCleanupRegistry.set(root, cleanup);
	return cleanup;
}

export async function mountKpopBanner(root, hooks = {}) {
	if (!root) return () => {};
	const existingCleanup = bannerCleanupRegistry.get(root);
	if (typeof existingCleanup === "function") {
		existingCleanup();
	}
	ensureSingleBannerRoot();
	await hydrateSongs();
	await hydrateStoredViewData();
	return bindBanner(root, hooks) || (() => {});
}

export function unmountKpopBanner(root) {
	if (!root) {
		return;
	}
	const existingCleanup = bannerCleanupRegistry.get(root);
	if (typeof existingCleanup === "function") {
		existingCleanup();
	}
	bannerCleanupRegistry.delete(root);
}

export default apiInitializer("0.8", (api) => {
	kpopBannerSiteSettings = api.container.lookup("service:site-settings") || {};
	if (!kpopBannerSiteSettings.kpop_banner_enabled || !kpopBannerSiteSettings.kpop_banner_ui_enabled) {
		return;
	}

	const currentUser =
		typeof api.getCurrentUser === "function" ? api.getCurrentUser() : null;
	setBannerStorageScope(currentUser?.id || null);
	void hydrateSongs();
	api.onPageChange(() => {
		void hydrateSongs();
	});
});
