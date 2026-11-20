export interface StoryProgressData {
  index: number; // 0-based currentIndex
  finished?: boolean;
  readCount?: number; // 累计完读次数（>= 1 说明至少完整读完过一遍）
  lastFinishedAt?: number; // 最近一次完读的时间戳
  updatedAt?: number;
}

const STORY_PROGRESS_STORAGE_KEY = "handy_reader_story_progress";

/**
 * 获取所有书籍的历史阅读进度字典
 */
export function getAllStoryProgress(): Record<string, StoryProgressData> {
  try {
    const raw = uni.getStorageSync(STORY_PROGRESS_STORAGE_KEY);
    if (raw && typeof raw === "object") {
      return raw as Record<string, StoryProgressData>;
    }
  } catch (e) {
    console.error("Failed to read reading progress from storage", e);
  }
  return {};
}

/**
 * 获取指定书籍的历史阅读进度
 */
export function getStoryProgress(storyId: string): StoryProgressData {
  if (!storyId) return { index: 0, finished: false, readCount: 0 };
  const all = getAllStoryProgress();
  const found = all[storyId];
  if (found && typeof found.index === "number") {
    const isFin = Boolean(found.finished);
    const readCount = typeof found.readCount === "number" ? found.readCount : (isFin ? 1 : 0);
    return {
      index: found.index,
      finished: isFin,
      readCount,
      lastFinishedAt: found.lastFinishedAt,
      updatedAt: found.updatedAt,
    };
  }
  return { index: 0, finished: false, readCount: 0 };
}

/**
 * 实时保存指定书籍的阅读进度
 * 当某次阅读到达全篇结尾（finished === true），自动使累计完读次数 readCount + 1
 */
export function saveStoryProgress(storyId: string, index: number, finished = false): void {
  if (!storyId) return;
  try {
    const all = getAllStoryProgress();
    const prev = all[storyId];
    const prevFinished = Boolean(prev?.finished);
    let readCount = typeof prev?.readCount === "number" ? prev.readCount : (prevFinished ? 1 : 0);
    let lastFinishedAt = prev?.lastFinishedAt;

    // 当本次触发完成，且之前并未处于本轮完成状态时，累计完读次数 +1
    if (finished && !prevFinished) {
      readCount += 1;
      lastFinishedAt = Date.now();
    }

    all[storyId] = {
      index: Math.max(0, index),
      finished,
      readCount,
      lastFinishedAt,
      updatedAt: Date.now(),
    };
    uni.setStorageSync(STORY_PROGRESS_STORAGE_KEY, all);
  } catch (e) {
    console.error("Failed to save reading progress to storage", e);
  }
}

/**
 * 重置指定书籍的阅读进度（从头开始开启新一轮精读）
 * 注意：必须严格保留已完读次数 readCount 与 lastFinishedAt，绝不清零历史成就！
 */
export function resetStoryProgress(storyId: string): void {
  if (!storyId) return;
  try {
    const all = getAllStoryProgress();
    const prev = all[storyId];
    const prevFinished = Boolean(prev?.finished);
    const readCount = typeof prev?.readCount === "number" ? prev.readCount : (prevFinished ? 1 : 0);

    all[storyId] = {
      index: 0,
      finished: false,
      readCount, // 保持已读完次数不变！
      lastFinishedAt: prev?.lastFinishedAt,
      updatedAt: Date.now(),
    };
    uni.setStorageSync(STORY_PROGRESS_STORAGE_KEY, all);
  } catch (e) {
    console.error("Failed to reset reading progress in storage", e);
  }
}

/**
 * 获取友好的阅读轮次与多刷状态展示
 */
export function getReadingRoundInfo(prog?: StoryProgressData, totalParagraphs = 1): {
  isUnread: boolean;
  isFinished: boolean;
  isReReading: boolean;
  readCount: number;
  percent: number;
  badgeLabel: string;
  statusText: string;
} {
  const readCount = typeof prog?.readCount === "number" ? prog.readCount : (prog?.finished ? 1 : 0);
  const isFinished = Boolean(prog?.finished);
  const index = prog?.index ?? 0;
  const isUnread = !isFinished && readCount === 0 && index === 0;
  const isReReading = readCount > 0 && !isFinished;

  let percent = 0;
  if (isFinished) {
    percent = 100;
  } else if (index > 0 && totalParagraphs > 0) {
    percent = Math.min(99, Math.max(1, Math.round(((index + 1) / totalParagraphs) * 100)));
  }

  let badgeLabel = "";
  let statusText = "";

  if (isFinished) {
    badgeLabel = readCount > 1 ? `已读${readCount}遍` : "已读完";
    statusText = readCount > 1 ? `已完读 ${readCount} 遍` : "已读完全篇";
  } else if (isReReading) {
    const roundNumber = readCount + 1;
    const roundName = roundNumber === 2 ? "二刷" : roundNumber === 3 ? "三刷" : `${roundNumber}刷`;
    badgeLabel = percent > 0 ? `${roundName} ${percent}%` : `${roundName}中`;
    statusText = `已完读 ${readCount} 遍 · 正在${roundName}`;
  } else if (index > 0) {
    badgeLabel = `${percent}%`;
    statusText = `首读中 · ${percent}%`;
  } else {
    badgeLabel = "未读";
    statusText = "从未读过";
  }

  return {
    isUnread,
    isFinished,
    isReReading,
    readCount,
    percent,
    badgeLabel,
    statusText,
  };
}

/**
 * 25 部传世经典全篇段落统计字典（轻量静态元数据，仅 500 字节）
 * 解耦书架列表与全书正文，实现书架秒开
 */
export const storyTotalParagraphsMap: Record<string, number> = {
  the_emperors_new_clothes: 16,
  the_happy_prince: 34,
  the_little_match_girl: 14,
  the_model_millionaire: 26,
  the_nightingale_and_the_rose: 28,
  the_selfish_giant: 22,
  after_twenty_years: 22,
  a_retrieved_reformation: 29,
  how_much_land_does_a_man_need: 29,
  one_thousand_dollars: 17,
  the_cop_and_the_anthem: 32,
  the_gift_of_the_magi: 32,
  the_last_leaf: 30,
  the_necklace: 36,
  the_ransom_of_red_chief: 20,
  the_tell_tale_heart: 24,
  scandal_in_bohemia: 44,
  strange_case_of_dr_jekyll_and_mr_hyde: 15,
  the_canterville_ghost: 20,
  the_curious_case_of_benjamin_button: 14,
  the_legend_of_sleepy_hollow: 14,
  the_metamorphosis: 14,
  the_million_pound_bank_note: 20,
  the_speckled_band: 20,
  to_build_a_fire: 18,
};
