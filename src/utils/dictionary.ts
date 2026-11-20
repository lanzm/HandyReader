export interface YoudaoSuggestEntry {
  entry: string;
  explain: string;
}

export interface YoudaoSuggestData {
  entries?: YoudaoSuggestEntry[];
  query?: string;
  language?: string;
  type?: string;
}

export interface YoudaoSuggestResult {
  code: number;
  msg: string;
}

export interface YoudaoSuggestResponse {
  result?: YoudaoSuggestResult;
  data?: YoudaoSuggestData;
}

const DICT_CACHE_STORAGE_KEY = "handy_reader_dict_cache";

// 内存二级缓存，提升同会话高频查词速度
const memoryDictCache = new Map<string, string>();

function loadStorageCache(): Record<string, string> {
  try {
    const raw = uni.getStorageSync(DICT_CACHE_STORAGE_KEY);
    return typeof raw === "object" && raw !== null ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// 初始化时预热内存缓存
try {
  const diskCache = loadStorageCache();
  for (const [key, value] of Object.entries(diskCache)) {
    memoryDictCache.set(key.toLowerCase(), value);
  }
} catch {
  // ignore
}

function saveToDiskCache(word: string, explain: string) {
  try {
    const diskCache = loadStorageCache();
    diskCache[word.toLowerCase()] = explain;
    // 限制本地缓存条目数上限（如 1000 词），避免 Storage 膨胀
    const keys = Object.keys(diskCache);
    if (keys.length > 1000) {
      delete diskCache[keys[0]];
    }
    uni.setStorageSync(DICT_CACHE_STORAGE_KEY, diskCache);
  } catch (error) {
    console.warn("[Dictionary] Failed to persist cache:", error);
  }
}

/**
 * 同步检查内存缓存中是否已有该词释义
 */
export function getCachedMeaning(word: string): string | null {
  const normalized = word.trim().toLowerCase();
  return memoryDictCache.get(normalized) ?? null;
}

/**
 * 异步查询普通单词的中文释义 (有道简明 Suggest 开放接口 + 双层缓存)
 */
export async function fetchWordMeaning(word: string): Promise<string | null> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return null;

  // 1. 优先读取内存缓存
  if (memoryDictCache.has(normalized)) {
    return memoryDictCache.get(normalized) ?? null;
  }

  // 2. 发起有道免密公开接口请求
  return new Promise((resolve) => {
    uni.request({
      url: "https://dict.youdao.com/suggest",
      method: "GET",
      data: {
        num: 1,
        doctype: "json",
        q: normalized,
      },
      timeout: 4500,
      success: (res) => {
        const responseData = res.data as YoudaoSuggestResponse | undefined;
        const entries = responseData?.data?.entries;
        if (Array.isArray(entries) && entries.length > 0) {
          const rawExplain = entries[0]?.explain ?? "";
          if (rawExplain) {
            memoryDictCache.set(normalized, rawExplain);
            saveToDiskCache(normalized, rawExplain);
            resolve(rawExplain);
            return;
          }
        }
        resolve(null);
      },
      fail: (err) => {
        console.warn("[Dictionary] Query failed:", err);
        resolve(null);
      },
    });
  });
}
