import {
	getMicroTrendHtml,
	getModalPlaceholderRowHtml,
} from "./kpop-banner-105-render-utils";
import { translateChartName } from "./kpop-banner-105-utils";

function buildSongTableDetails(detailRows) {
	const groups = new Map();

	(Array.isArray(detailRows) ? detailRows : []).forEach((row) => {
		const platform = row?.platform || "iChart";
		if (!groups.has(platform)) {
			groups.set(platform, {
				platform,
				colorClass: row?.colorClass || "color-ichart",
				rows: [],
			});
		}

		groups.get(platform).rows.push({
			name: translateChartName(row?.chartName),
			rank: row?.rank === "-" ? "-" : `${row?.rank}位`,
			score: row?.score || "-",
			multi: row?.multi || "-",
			trend: row?.trend || "same",
			trendVal: row?.trendVal || "",
		});
	});

	return Array.from(groups.values());
}

export function buildCircleModalTableHtml(song) {
	let tableHtml = "";

	tableHtml += `<tr><td class="platform-col">专辑</td><td>${song.circleMeta?.album || "-"}</td></tr>`;
	tableHtml += `<tr><td class="platform-col">发行商</td><td>${song.circleMeta?.companyDist || "-"}</td></tr>`;
	tableHtml += `<tr><td class="platform-col">制作公司</td><td>${song.circleMeta?.companyMake || "-"}</td></tr>`;

	if (song.chartFamily === "album") {
		tableHtml += `<tr><td class="platform-col">专辑销量</td><td>${song.circleMeta?.albumCnt || "-"}</td></tr>`;
		tableHtml += `<tr><td class="platform-col">总销量</td><td>${song.circleMeta?.totalCnt || "-"}</td></tr>`;
	} else if (song.chartFamily === "onoff") {
		tableHtml += `<tr><td class="platform-col">Circle 指数</td><td>${song.circleMeta?.count || "-"}</td></tr>`;
	}

	if (song.circleMeta?.cert) {
		tableHtml += `<tr><td class="platform-col">认证</td><td>🏅 ${song.circleMeta.cert}</td></tr>`;
	}

	return tableHtml || getModalPlaceholderRowHtml(2, "暂无明细数据");
}

export function buildMusicShowModalTableHtml(song) {
	const meta = song?.musicShowMeta || {};
	let tableHtml = "";
	tableHtml += `<tr><td class="platform-col">歌曲</td><td>${song?.title || "-"}</td></tr>`;
	tableHtml += `<tr><td class="platform-col">艺人</td><td>${song?.artist || "-"}</td></tr>`;
	tableHtml += `<tr><td class="platform-col">节目</td><td>${meta.showName || "-"} EP.${meta.episodeNumber || "-"}</td></tr>`;
	tableHtml += `<tr><td class="platform-col">播出日期</td><td>${meta.airDate || "-"}</td></tr>`;
	return tableHtml;
}

export function buildMusicShowRankModalTableHtml(song) {
	const meta = song?.musicShowRankMeta || {};
	let tableHtml = "";
	tableHtml += `<tr><td class="platform-col">榜单</td><td>${song.chartLabel || "打歌获奖榜"}</td></tr>`;
	tableHtml += `<tr><td class="platform-col">一位总数</td><td>${meta.wins || "-"}</td></tr>`;
	if (Array.isArray(meta.showBreakdown) && meta.showBreakdown.length) {
		tableHtml += `<tr><td class="platform-col">节目分布</td><td>${meta.showBreakdown.map((item) => `${item.show}: ${item.wins}`).join(" / ")}</td></tr>`;
	}
	if (Array.isArray(meta.songs) && meta.songs.length) {
		tableHtml += `<tr><td class="platform-col">夺冠歌曲</td><td>${meta.songs.join(" / ")}</td></tr>`;
	}
	if (meta.winningSongs) {
		tableHtml += `<tr><td class="platform-col">代表曲一位</td><td>${meta.winningSongs}</td></tr>`;
	}
	if (Array.isArray(meta.yearBreakdown) && meta.yearBreakdown.length) {
		tableHtml += `<tr><td class="platform-col">年度分布</td><td>${meta.yearBreakdown.slice(0, 12).map((item) => `${item.year}: ${item.wins}`).join(" / ")}</td></tr>`;
	}
	if ((!Array.isArray(meta.showBreakdown) || !meta.showBreakdown.length) && Array.isArray(meta.shows) && meta.shows.length) {
		tableHtml += `<tr><td class="platform-col">相关节目</td><td>${meta.shows.join(", ")}</td></tr>`;
	}
	return tableHtml || getModalPlaceholderRowHtml(2, "暂无明细数据");
}

export function buildIchartModalTableHtml(song) {
	const tableDetails = Array.isArray(song.tableDetails)
		? song.tableDetails
		: buildSongTableDetails(song.detailRows);
	if (!Array.isArray(song.tableDetails) && tableDetails.length) {
		song.tableDetails = tableDetails;
	}

	if (!tableDetails.length) {
		return getModalPlaceholderRowHtml(5, "暂无明细数据");
	}

	let tableHtml = "";
	tableDetails.forEach((platform) => {
		platform.rows.forEach((row, idx) => {
			tableHtml += "<tr>";
			if (idx === 0) {
				tableHtml += `<td rowspan="${platform.rows.length}" class="platform-col ${platform.colorClass}">${platform.platform}</td>`;
			}
			const rankContent = row.rank
				? `<div class="rank-cell-wrapper"><span class="rank-highlight">${row.rank}</span>${getMicroTrendHtml(row.trend, row.trendVal)}</div>`
				: "-";
			tableHtml += `<td>${row.name}</td><td>${rankContent}</td><td>${row.score}</td><td>${row.multi}</td></tr>`;
		});
	});
	return tableHtml;
}
