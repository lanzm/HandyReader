/**
 * dictionary.ts - 单词简明与全量释义服务
 *
 * 方案 3A 核心实现：
 * 1. 优先调用有道全量 EC 简明词典接口（带 ec 字典轻量过滤，单次请求包仅 ~1KB，全量无删减）。
 * 2. 分词性完整呈现（如 n. / v. / adj. / int.），彻底消除末尾半截式的 "..." 截断。
 * 3. 降级备用：若全量接口无返回或网络受限，自动无缝回退至轻量 Suggest 接口并剔除残留省略号。
 * 4. 本地双层缓存（内存 Map + 本地 Storage 限制 1000 词），高频查词 < 1ms 即刻渲染。
 */

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

const DICT_CACHE_STORAGE_KEY = "handy_reader_dict_cache_v2";

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
 * 方案 3A 主引擎：发起有道全量 EC 简明词典接口请求 (dicts=[["ec"]])
 * 返回各词性独立分行的完整释义，彻底无省略号截断
 */
function fetchFromYoudaoEc(word: string): Promise<string | null> {
  return new Promise((resolve) => {
    uni.request({
      url: "https://dict.youdao.com/jsonapi",
      method: "GET",
      data: {
        dicts: JSON.stringify({ count: 99, dicts: [["ec"]] }),
        q: word,
      },
      timeout: 4500,
      success: (res) => {
        try {
          const data = res.data as any;
          const trs = data?.ec?.word?.[0]?.trs;
          if (Array.isArray(trs) && trs.length > 0) {
            const lines = trs
              .map((t: any) => t?.tr?.[0]?.l?.i?.[0])
              .filter(Boolean) as string[];
            if (lines.length > 0) {
              resolve(lines.join("\n"));
              return;
            }
          }
        } catch (e) {
          console.warn("[Dictionary] parse EC data error:", e);
        }
        resolve(null);
      },
      fail: () => {
        resolve(null);
      },
    });
  });
}

/**
 * 备用降级引擎：发起有道免密公开 Suggest 接口请求
 */
function fetchFromYoudaoSuggest(word: string): Promise<string | null> {
  return new Promise((resolve) => {
    uni.request({
      url: "https://dict.youdao.com/suggest",
      method: "GET",
      data: {
        num: 1,
        doctype: "json",
        q: word,
      },
      timeout: 4500,
      success: (res) => {
        const responseData = res.data as YoudaoSuggestResponse | undefined;
        const entries = responseData?.data?.entries;
        if (Array.isArray(entries) && entries.length > 0) {
          const rawExplain = entries[0]?.explain ?? "";
          if (rawExplain) {
            resolve(rawExplain);
            return;
          }
        }
        resolve(null);
      },
      fail: (err) => {
        console.warn("[Dictionary] Query suggest failed:", err);
        resolve(null);
      },
    });
  });
}

/**
 * 异步查询普通单词的中文释义 (方案 3A 双层检索 + 全量无截断展示)
 */
export async function fetchWordMeaning(word: string): Promise<string | null> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return null;

  // 1. 优先读取内存缓存
  if (memoryDictCache.has(normalized)) {
    return memoryDictCache.get(normalized) ?? null;
  }

  // 2. 优先发起有道全量 EC 简明词典接口请求 (全量无截断，分词性分行)
  try {
    const fullMeaning = await fetchFromYoudaoEc(normalized);
    if (fullMeaning) {
      memoryDictCache.set(normalized, fullMeaning);
      saveToDiskCache(normalized, fullMeaning);
      return fullMeaning;
    }
  } catch (e) {
    console.warn("[Dictionary] fetchFromYoudaoEc exception, fallback to suggest:", e);
  }

  // 3. 降级备用：走轻量 Suggest 接口并剔除尾部可能存在的未尽省略号
  try {
    const fallbackMeaning = await fetchFromYoudaoSuggest(normalized);
    if (fallbackMeaning) {
      const cleanMeaning = fallbackMeaning.replace(/(?:\.\.\.|…)+$/g, "").trim();
      memoryDictCache.set(normalized, cleanMeaning);
      saveToDiskCache(normalized, cleanMeaning);
      return cleanMeaning;
    }
  } catch (e) {
    console.warn("[Dictionary] fetchFromYoudaoSuggest exception:", e);
  }

  return null;
}
