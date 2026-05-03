const sourceStorageKey = "kpop_banner_chart_source_v1";
const periodStorageKey = "kpop_banner_chart_period_v1";
const sourceOptions = ["circle-global", "circle-digital", "circle-album", "kpopping"];
const basePeriodOptions = ["day", "week", "month", "year"];

export function createKpopBanner105Storage({ kpoppingPeriodOptions = [] } = {}) {
  let bannerCloseUntilKey = "kpop_banner_hidden_until_v2:anon";
  let likeCelebrationStateKey = "kpop_banner_like_celebration_v1:anon";
  const periodOptions = [...basePeriodOptions, ...kpoppingPeriodOptions];

  return {
    setBannerStorageScope(userId) {
      const scope = userId ? `u${userId}` : "anon";
      bannerCloseUntilKey = `kpop_banner_hidden_until_v2:${scope}`;
      likeCelebrationStateKey = `kpop_banner_like_celebration_v1:${scope}`;
    },

    getStoredSource() {
      try {
        const raw = String(window?.localStorage?.getItem(sourceStorageKey) || "");
        if (sourceOptions.includes(raw)) {
          return raw;
        }
        return "ichart";
      } catch {
        return "ichart";
      }
    },

    setStoredSource(source) {
      try {
        const next = sourceOptions.includes(source) ? source : "ichart";
        window?.localStorage?.setItem(sourceStorageKey, next);
      } catch {
        return;
      }
    },

    getStoredPeriod() {
      try {
        const raw = String(window?.localStorage?.getItem(periodStorageKey) || "");
        return periodOptions.includes(raw) ? raw : "day";
      } catch {
        return "day";
      }
    },

    setStoredPeriod(period) {
      try {
        const next = periodOptions.includes(period) ? period : "day";
        window?.localStorage?.setItem(periodStorageKey, next);
      } catch {
        return;
      }
    },

    readLikeCelebrationState() {
      try {
        const raw = window?.localStorage?.getItem(likeCelebrationStateKey);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    },

    writeLikeCelebrationState(state) {
      try {
        window?.localStorage?.setItem(likeCelebrationStateKey, JSON.stringify(state));
      } catch {
        return;
      }
    },

    getHiddenUntil() {
      try {
        const value = Number(window?.localStorage?.getItem(bannerCloseUntilKey) || 0);
        return Number.isFinite(value) ? value : 0;
      } catch {
        return 0;
      }
    },

    setHiddenUntil(timestamp) {
      try {
        window?.localStorage?.setItem(bannerCloseUntilKey, String(timestamp));
      } catch {
        return;
      }
    },

    clearHiddenUntil() {
      try {
        window?.localStorage?.removeItem(bannerCloseUntilKey);
      } catch {
        return;
      }
    },
  };
}
