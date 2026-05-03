const chartDataCacheVersion = 6;
const unifiedDataCacheKey = "kpop_banner_unified_cache_v1";
const circleMultiDataCacheKey = "kpop_banner_circle_multi_cache_v1";
const kpoppingDataCacheKey = "kpop_banner_kpopping_cache_v1";
const soridataDataCacheKey = "kpop_banner_soridata_cache_v1";

function cacheStorageKey(kind) {
  if (kind === "kpopping") {
    return kpoppingDataCacheKey;
  }
  if (kind === "soridata") {
    return soridataDataCacheKey;
  }
  return kind === "circleMulti" ? circleMultiDataCacheKey : unifiedDataCacheKey;
}

export function createKpopBanner105DataCache({ cloneSongsBySource }) {
  const memoryDataCache = { unified: null, circleMulti: null };

  function readCachePayload(kind) {
    const memory = memoryDataCache[kind];
    if (memory?.version === chartDataCacheVersion && memory?.data) {
      return memory;
    }

    try {
      const raw = window?.localStorage?.getItem(cacheStorageKey(kind));
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== chartDataCacheVersion || !parsed.data) {
        return null;
      }

      memoryDataCache[kind] = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeCachePayload(kind, bucketKey, data) {
    const payload = {
      version: chartDataCacheVersion,
      bucketKey,
      cachedAt: Date.now(),
      data: cloneSongsBySource(data),
    };

    memoryDataCache[kind] = payload;

    try {
      window?.localStorage?.setItem(cacheStorageKey(kind), JSON.stringify(payload));
    } catch {
      return;
    }
  }

  function getCachedSourceData(kind, bucketKey) {
    const cached = readCachePayload(kind);
    if (!cached?.data) {
      return { fresh: null, stale: null };
    }

    const normalized = cloneSongsBySource(cached.data);
    if (cached.bucketKey === bucketKey) {
      return { fresh: normalized, stale: null };
    }

    return { fresh: null, stale: normalized };
  }

  return {
    getCachedSourceData,
    readCachePayload,
    writeCachePayload,
  };
}
