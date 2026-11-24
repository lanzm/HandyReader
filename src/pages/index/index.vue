<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { onShow, onLoad, onHide, onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import type { Story } from "@/types/reader";
import { storiesMap } from "@/data/stories";
import SettingsDrawer from "@/components/SettingsDrawer.vue";
import BookCover from "@/components/BookCover.vue";
import { currentTheme, currentFontSize, setTheme, setFontSize, setNavigationBarTheme } from "@/utils/theme";
import { useFloatingGear } from "@/composables/useFloatingGear";
import { useParagraphDeck } from "@/composables/useParagraphDeck";
import { fetchWordMeaning, getCachedMeaning } from "@/utils/dictionary";
import { detectContextPhrase, type DetectedPhrase, type TokenItem } from "@/utils/phraseDetector";
import { playPronunciation, stopAudio } from "@/utils/audioPlayer";

const CURRENT_STORY_STORAGE_KEY = "handy_reader_current_story_id";

// 当前选中的故事数据 (支持持久化，默认故事：《卖火柴的小女孩》)
const savedInitialStoryId = uni.getStorageSync(CURRENT_STORY_STORAGE_KEY) || "the_little_match_girl";
const currentStory = ref<Story>(storiesMap[savedInitialStoryId] ?? storiesMap["the_little_match_girl"]);
const currentStoryId = ref<string>(currentStory.value.id);

// 翻卡 Deck 管理器 (上下堆叠 + 物理拖拽翻页)
const {
  currentIndex,
  isRevealed,
  isRevealing,
  isFinished,
  isBgFinished,
  readCount,
  totalParagraphs,
  currentParagraph,
  bgParagraph,
  cardTransitionClass,
  bgCardTransitionClass,
  cardStyle,
  bgCardStyle,
  scrollTop,
  preventClick,
  nextParagraph,
  prevParagraph,
  toggleTranslation,
  resetStory,
  onCardTouchStart,
  onCardTouchMove,
  onCardTouchEnd,
  onDetailScroll,
} = useParagraphDeck(currentStory);

function handleGoToBookshelf() {
  uni.navigateTo({
    url: "/pages/bookshelf/index",
  });
}

// 候场卡片预估轮次 (防止翻出时数字闪跳)
const nextReadCount = computed(() => (readCount.value || 0) + 1);

// 微信小程序一键转发分享卡片
onShareAppMessage(() => {
  const isFin = isFinished.value;
  const count = readCount.value || 1;
  const title = isFin
    ? `🎉 我刚精读读完了《${currentStory.value.titleZh}》（${currentStory.value.wordCount}词），快来一起读名著！`
    : `📖 正在精读英文原著《${currentStory.value.titleZh}》，与你共读经典`;
  return {
    title,
    path: `/pages/index/index?storyId=${currentStory.value.id}`,
    imageUrl: "/static/share-cover.jpg",
  };
});

// 微信小程序朋友圈分享
onShareTimeline(() => {
  return {
    title: `📖 英语名著精读《${currentStory.value.titleZh}》· HandyReader`,
    query: `storyId=${currentStory.value.id}`,
  };
});

// 全文双语与阅读进度设置 (支持本地存储持久化)
const ALL_TRANS_STORAGE_KEY = "handy_reader_show_all_trans";
const SHOW_PROGRESS_STORAGE_KEY = "handy_reader_show_reading_progress";

const showAllTranslations = ref(uni.getStorageSync(ALL_TRANS_STORAGE_KEY) === true);
const savedShowProgress = uni.getStorageSync(SHOW_PROGRESS_STORAGE_KEY);
const showReadingProgress = ref(
  savedShowProgress === "" || savedShowProgress === null || savedShowProgress === undefined
    ? true
    : savedShowProgress === true || savedShowProgress === "true"
);

function handleAllTranslationsChange(val: boolean) {
  showAllTranslations.value = val;
  try {
    uni.setStorageSync(ALL_TRANS_STORAGE_KEY, val);
  } catch (e) {
    console.error("Failed to save all translations setting", e);
  }
}

function handleReadingProgressChange(val: boolean) {
  showReadingProgress.value = val;
  try {
    uni.setStorageSync(SHOW_PROGRESS_STORAGE_KEY, val);
  } catch (e) {
    console.error("Failed to save reading progress setting", e);
  }
}

// 方案 A：通用段落进度百分比与剩余时间计算（单卡数据直接绑定，杜绝全局索引引起的切换缩回与闪烁）
function getProgressPercent(pIndex?: number): number {
  if (!pIndex || !totalParagraphs.value || totalParagraphs.value <= 0) return 0;
  const pct = Math.round((pIndex / totalParagraphs.value) * 100);
  return Math.min(100, Math.max(1, pct));
}

function getRemainingMinutesText(pIndex?: number): string {
  if (!pIndex || !totalParagraphs.value || totalParagraphs.value <= 1) return "";
  const totalMins = currentStory.value?.estimatedMinutes ?? 10;
  const remaining = totalParagraphs.value - pIndex;
  if (remaining <= 0) return "即将完成";
  const minsLeft = Math.ceil((remaining / totalParagraphs.value) * totalMins);
  return minsLeft > 0 ? `约剩 ${minsLeft} 分钟` : "< 1 分钟";
}

// 轻量查词气泡状态 (替代全屏弹窗)
const bubbleVisible = ref(false);
const bubbleLeft = ref(0);
const bubbleTop = ref(0);
const bubbleBottom = ref(0);
const bubbleArrowLeft = ref(0);
const bubblePlacement = ref<"placement-top" | "placement-bottom">("placement-top");
interface WordBubbleData {
  word: string;
  meaning: string;
}

const activeWord = ref("");
const activeTokenIndex = ref<number>(-1);
const activePhrase = ref<DetectedPhrase | null>(null);
const selectedWordData = ref<WordBubbleData | null>(null);

// 气泡底部高斯模糊与滚动探针
const hasScrollableContent = ref(false);

function checkBubbleScrollOverflow() {
  hasScrollableContent.value = false;
  nextTick(() => {
    setTimeout(() => {
      // #ifdef MP-WEIXIN || MP
      const query = uni.createSelectorQuery();
      const selector = activePhrase.value ? ".flow-word-section" : ".bubble-meaning";
      query
        .select(selector)
        .fields({ size: true, scrollOffset: true }, (res: any) => {
          if (res && typeof res.scrollHeight === "number" && typeof res.height === "number") {
            hasScrollableContent.value = res.scrollHeight > res.height + 4;
          }
        })
        .exec();
      // #endif
      // #ifndef MP-WEIXIN || MP
      try {
        const el = document.querySelector(activePhrase.value ? ".flow-word-section" : ".bubble-meaning");
        if (el) {
          hasScrollableContent.value = el.scrollHeight > el.clientHeight + 4;
        }
      } catch {}
      // #endif
    }, 60);
  });
}


const bubbleStyle = computed(() => {
  const style: Record<string, string> = {
    left: `${bubbleLeft.value}px`,
  };
  if (bubblePlacement.value === "placement-top") {
    style.bottom = `${bubbleBottom.value}px`;
    style.top = "auto";
  } else {
    style.top = `${bubbleTop.value}px`;
    style.bottom = "auto";
  }
  return style;
});

// 音频播放控制 (基于方案一 Web Audio 动态响度均衡 + 原生双引擎保底，支持单字与词组)
const isAudioPlaying = ref(false);
const currentPlayingWord = ref<string>("");

function closeBubble() {
  bubbleVisible.value = false;
  activeWord.value = "";
  activeTokenIndex.value = -1;
  activePhrase.value = null;
  currentPlayingWord.value = "";
  hasScrollableContent.value = false;
  stopAudio();
  isAudioPlaying.value = false;
}

function handlePlayBubbleAudio(targetWord?: string) {
  const wordToPlay = (typeof targetWord === "string" && targetWord ? targetWord : (selectedWordData.value?.word || "")).trim();
  if (!wordToPlay) return;

  // 若当前正在播放此词，再次点击可立即停止
  if (isAudioPlaying.value && currentPlayingWord.value === wordToPlay) {
    stopAudio();
    isAudioPlaying.value = false;
    currentPlayingWord.value = "";
    return;
  }

  isAudioPlaying.value = true;
  currentPlayingWord.value = wordToPlay;

  playPronunciation(wordToPlay, {
    onPlay: () => {
      isAudioPlaying.value = true;
      currentPlayingWord.value = wordToPlay;
    },
    onEnded: () => {
      isAudioPlaying.value = false;
      if (currentPlayingWord.value === wordToPlay) {
        currentPlayingWord.value = "";
      }
    },
    onError: () => {
      isAudioPlaying.value = false;
      if (currentPlayingWord.value === wordToPlay) {
        currentPlayingWord.value = "";
      }
    },
    onStop: () => {
      isAudioPlaying.value = false;
      if (currentPlayingWord.value === wordToPlay) {
        currentPlayingWord.value = "";
      }
    },
  });
}

// 设置抽屉与悬浮齿轮
const showDrawer = ref(false);
const {
  gearX,
  gearY,
  gearReady,
  isHiding,
  dockSide,
  onGearChange,
  onGearTouchStart,
  onGearTouchEnd,
} = useFloatingGear(showDrawer);

const onSystemThemeChange = (res: UniApp.OnThemeChangeCallbackResult) => {
  const saved = uni.getStorageSync("handy_reader_theme");
  if (saved !== "dark" && saved !== "light") {
    if (res.theme === "dark" || res.theme === "light") {
      setTheme(res.theme);
    }
  }
};

onMounted(() => {
  setNavigationBarTheme(currentTheme.value);
  uni.setNavigationBarTitle({ title: "随手读本" });
  uni.onThemeChange(onSystemThemeChange);
});

onHide(() => {
  closeBubble();
});

onUnmounted(() => {
  uni.offThemeChange(onSystemThemeChange);
  stopAudio();
});

// 计算正文字体样式 (针对文学原著优化字号与行高黄金比例)
const fontSizeStyle = computed(() => {
  switch (currentFontSize.value) {
    case "sm": return { fontSize: "17px", lineHeight: "1.72" };
    case "md": return { fontSize: "19px", lineHeight: "1.80" };
    case "lg": return { fontSize: "21px", lineHeight: "1.88" };
    case "xl": return { fontSize: "23px", lineHeight: "1.95" };
    default: return { fontSize: "19px", lineHeight: "1.80" };
  }
});

// 方案 A 自然分词（将文本按空白符、破折号 Em/En-dash、双连字符及斜杠切分为单词和标点空格流，无缝还原排版并支持独立单词点击）
const SPLIT_PUNCTUATION_REGEX = /(\s+|—|–|―|--+|\/)/;

function tokenizeParagraph(text: string): TokenItem[] {
  if (!text) return [];
  const rawTokens = text.split(SPLIT_PUNCTUATION_REGEX).filter((t) => t.length > 0);
  return rawTokens.map((token, index) => {
    const isSpace = /^\s+$/.test(token);
    if (isSpace) {
      return { raw: token, isWord: false, cleanWord: "", tokenIndex: index };
    }
    const cleanWord = token.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
    return {
      raw: token,
      isWord: !!cleanWord,
      cleanWord,
      tokenIndex: index,
    };
  });
}

// 处理单词点击弹出轻量气泡 (全量统一走词典接口与本地双层缓存，并全自动嗅探语境词组)
function handleWordTap(event: any, rawWord: string, tokenIndex?: number) {
  if (preventClick.value) return;
  const cleaned = rawWord.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
  if (!cleaned) return;

  // 若已激活当前词，再次点击则收起
  if (bubbleVisible.value && activeTokenIndex.value === tokenIndex) {
    closeBubble();
    return;
  }

  activeTokenIndex.value = typeof tokenIndex === "number" ? tokenIndex : -1;
  activeWord.value = cleaned;

  // 1. 全自动智能嗅探当前段落语境下的词组搭配 (0ms 离线匹配)
  if (typeof tokenIndex === "number" && currentParagraph.value?.en) {
    const allTokens = tokenizeParagraph(currentParagraph.value.en);
    activePhrase.value = detectContextPhrase(allTokens, tokenIndex);
  } else {
    activePhrase.value = null;
  }

  // 2. 统一单词点击气泡查词：走统一词典接口 + 本地双层缓存机制
  const cached = getCachedMeaning(cleaned);

  if (cached) {
    selectedWordData.value = {
      word: cleaned,
      meaning: cached,
    };
    checkBubbleScrollOverflow();
  } else {
    selectedWordData.value = {
      word: cleaned,
      meaning: "查询中...",
    };
    const queryTarget = cleaned;
    fetchWordMeaning(cleaned).then((result) => {
      if (activeWord.value.toLowerCase() === queryTarget.toLowerCase() && selectedWordData.value) {
        selectedWordData.value.meaning = result ?? "暂未收录该词释义";
        checkBubbleScrollOverflow();
      }
    });
  }

  // 3. 获取视口尺寸并精确计算气泡位置
  const sysInfo = uni.getSystemInfoSync();
  const screenWidth = sysInfo.windowWidth || 375;
  const screenHeight = sysInfo.windowHeight || 667;

  // 提取精确触点坐标 (优先取有值的有效数值)
  const rawX = typeof event?.detail?.x === "number" && event.detail.x > 0
    ? event.detail.x
    : (event?.changedTouches?.[0]?.clientX ?? event?.touches?.[0]?.clientX ?? screenWidth / 2);
  const rawY = typeof event?.detail?.y === "number" && event.detail.y > 0
    ? event.detail.y
    : (event?.changedTouches?.[0]?.clientY ?? event?.touches?.[0]?.clientY ?? 200);

  const touchX = Math.round(rawX);
  const touchY = Math.round(rawY);

  // 命中词组时气泡宽度适度拓展以容纳词组释义 (256px vs 242px)
  const bubbleW = activePhrase.value ? 256 : 242;
  let left = Math.round(touchX - bubbleW / 2);
  if (left < 16) left = 16;
  if (left + bubbleW > screenWidth - 16) left = screenWidth - bubbleW - 16;

  bubbleLeft.value = left;
  // 箭头中心严格对齐触点 X，且限制在圆角安全范围内 (16px ~ bubbleW - 26px)
  bubbleArrowLeft.value = Math.max(16, Math.min(bubbleW - 26, touchX - left - 5));

  // 垂直方向判断：命中词组时卡片略高，触发高度阈值适度调整为 210px
  const triggerTopHeight = activePhrase.value ? 210 : 180;
  if (touchY >= triggerTopHeight) {
    bubblePlacement.value = "placement-top";
    bubbleBottom.value = Math.max(16, screenHeight - touchY + 12);
  } else {
    // 距离顶部过近时在单词下方弹出 (placement-bottom)，顶部锚定在触点下方 14px
    bubblePlacement.value = "placement-bottom";
    bubbleTop.value = touchY + 14;
  }

  bubbleVisible.value = true;
}

function handleCardTouchStart(e: any) {
  if (bubbleVisible.value) closeBubble();
  onCardTouchStart(e);
}

function handleDetailScroll(e: any) {
  if (bubbleVisible.value) closeBubble();
  onDetailScroll(e);
}

function handleNextParagraph() {
  closeBubble();
  nextParagraph();
}

function handleGearClick() {
  showDrawer.value = true;
}

// 提取精简作者名（如 "安徒生" 或 "柯南·道尔"）
const displayAuthor = computed(() => {
  const raw = currentStory.value.author || "";
  const match = raw.match(/[(（](.*?)[)）]/);
  return match && match[1] ? match[1].trim() : raw;
});

function handleStoryChange(storyId: string) {
  const target = storiesMap[storyId];
  if (target) {
    currentStory.value = target;
    currentStoryId.value = storyId;
    uni.setStorageSync(CURRENT_STORY_STORAGE_KEY, storyId);
    resetStory();
  }
}

onLoad((query?: { storyId?: string }) => {
  if (query?.storyId && storiesMap[query.storyId]) {
    handleStoryChange(query.storyId);
  }
});

onShow(() => {
  setNavigationBarTheme(currentTheme.value);
  const savedStoryId = uni.getStorageSync(CURRENT_STORY_STORAGE_KEY);
  const selectedFromBookshelf = uni.getStorageSync("handy_reader_selected_from_bookshelf");

  if (selectedFromBookshelf) {
    try {
      uni.removeStorageSync("handy_reader_selected_from_bookshelf");
    } catch {}
    // 用户在书架中确认选择了书籍，关闭设置抽屉直达阅读
    showDrawer.value = false;
    if (savedStoryId) {
      if (savedStoryId !== currentStoryId.value) {
        handleStoryChange(savedStoryId);
      } else {
        // 用户选中的是当前同一本书（如点击开启二刷重读），重新载入最新进度并重置卡片状态
        resetStory();
      }
    }
  } else if (savedStoryId && savedStoryId !== currentStoryId.value) {
    handleStoryChange(savedStoryId);
    showDrawer.value = false;
  }
  // 若未选择新书直接返回，showDrawer 维持原有状态不变（保留设置弹窗现场）
});
</script>

<template>
  <movable-area class="page-container" :class="[currentTheme]">
    <!-- 底层堆叠卡片 (Background Stack Card · 对齐极简规范 堆叠视觉) -->
    <view
      v-if="bgParagraph || isBgFinished"
      class="app-card-bg"
      :class="[bgCardTransitionClass]"
      :style="bgCardStyle"
    >
      <!-- 底层为完读成就卡 (像第 N+1 张物理卡片一样在底层候场就位) -->
      <view v-if="isBgFinished" class="finish-card-view px-6 flex-1 flex flex-col justify-between">
        <view class="finish-body flex-1 flex flex-col items-center justify-center">
          <view class="finish-cover-box">
            <BookCover :story="currentStory" size="lg" />
          </view>
          <text class="finish-title-zh">《{{ currentStory.titleZh }}》</text>
          <text class="finish-title-en">{{ currentStory.title }} · {{ displayAuthor }}</text>
          <view class="finish-stats-line">
            <text class="finish-celebrate-mark">🎉</text>
            <text class="finish-stats-text">
              {{ nextReadCount > 1 ? `已完成第 ${nextReadCount} 遍精读` : '全篇精读完成' }} · {{ currentStory.wordCount }} 词 · {{ totalParagraphs }} 段落
            </text>
            <text class="finish-celebrate-mark">🎉</text>
          </view>
        </view>
        <view class="finish-footer w-full pb-1">
          <view class="finish-btn-row flex gap-2.5 w-full pointer-events-none">
            <view class="card-btn-half btn-primary flex-1">
              分享给好友
            </view>
            <view class="card-btn-half btn-secondary flex-1">
              挑选新书 ›
            </view>
          </view>
        </view>
      </view>

      <!-- 普通段落底层预览 -->
      <template v-else-if="bgParagraph">
        <!-- 场景 A：独立封面页 / 章节扉页（垂直水平居中排版） -->
        <view
          v-if="bgParagraph.isBookCover || bgParagraph.isChapterHeader"
          class="chapter-cover-view"
        >
          <view v-if="bgParagraph.chapterNum || bgParagraph.tagline" class="chapter-badge">
            {{ bgParagraph.chapterNum || bgParagraph.tagline }}
          </view>
          <text class="chapter-title-en">
            {{ bgParagraph.titleEn || bgParagraph.chapterTitleEn || bgParagraph.en }}
          </text>
          <view class="chapter-decor-line" />
          <text class="chapter-title-zh">
            {{ bgParagraph.titleZh ? `《${bgParagraph.titleZh}》` : (bgParagraph.chapterTitleZh || bgParagraph.zh) }}
          </text>
          <text v-if="bgParagraph.author" class="chapter-author">
            {{ bgParagraph.author }}
          </text>
        </view>

        <!-- 场景 B：中间正文内容 (静态预览 · 自然排版) -->
        <view v-else class="card-scroll-view px-6 flex-1 w-full box-border">
          <view class="en-text-box" :style="fontSizeStyle">
            <template v-for="(token, tIdx) in tokenizeParagraph(bgParagraph.en)" :key="tIdx">
              <text v-if="!token.isWord">{{ token.raw }}</text>
              <text v-else class="word-token">
                {{ token.raw }}
              </text>
            </template>
          </view>

          <!-- 方案 1：双语分割区域 -->
          <!-- 默认折叠：居中嵌入式查看译文胶囊按钮 -->
          <view v-if="!showAllTranslations" class="divider-btn-row">
            <view class="divider-line" />
            <view class="divider-pill-btn pointer-events-none">
              <text class="divider-btn-text">查看译文</text>
              <text class="divider-btn-arrow">▾</text>
            </view>
            <view class="divider-line" />
          </view>

          <!-- 始终显示：纯净极简细分割线（无任何折叠按钮，中英双语自然对照） -->
          <view v-else class="divider-simple-row">
            <view class="divider-line" />
          </view>

          <!-- 底层预览卡片译文：始终显示时直接渲染中文，保证滑卡视觉连续 -->
          <view
            v-if="showAllTranslations"
            class="zh-collapse-wrapper is-expanded"
          >
            <view class="zh-content-inner">
              <text class="zh-text">{{ bgParagraph.zh }}</text>
            </view>
          </view>
        </view>

        <!-- 底部操作栏 (方案 A：微进度条 + 对称平衡) -->
        <view class="card-footer px-6 mt-3 shrink-0">
          <!-- 方案 A：阅读进度指示模块 (可开启/关闭，直接绑定底层卡片自身的段落序号) -->
          <view v-if="showReadingProgress && bgParagraph" class="reading-progress-block">
            <view class="progress-meta-row flex justify-between items-center mb-1.5">
              <text class="progress-label-index">段落 {{ bgParagraph.index }} / {{ totalParagraphs }}</text>
              <text class="progress-label-percent">{{ getProgressPercent(bgParagraph.index) }}% · {{ getRemainingMinutesText(bgParagraph.index) }}</text>
            </view>
            <view class="progress-track">
              <view class="progress-fill" :style="{ width: getProgressPercent(bgParagraph.index) + '%' }" />
            </view>
          </view>

          <view class="w-full">
            <view class="card-btn btn-primary w-full text-base">下一段</view>
          </view>
        </view>
      </template>
    </view>

    <!-- 顶层主活动卡片 (Active Card · 对齐极简规范 物理卡片交互) -->
    <view
      class="app-card"
      :class="[cardTransitionClass]"
      :style="cardStyle"
      @touchstart="handleCardTouchStart"
      @touchmove="onCardTouchMove"
      @touchend="onCardTouchEnd"
    >
      <!-- 完读成就状态 (高级极简留白，统一按钮与零冗余信息) -->
      <view v-if="isFinished" class="finish-card-view px-6 flex-1 flex flex-col justify-between">
        <!-- 核心内容区：大尺寸 3D 实体书封与典雅书名，充裕留白 -->
        <view class="finish-body flex-1 flex flex-col items-center justify-center">
          <!-- 3D 实体书封 -->
          <view class="finish-cover-box">
            <BookCover :story="currentStory" size="lg" />
          </view>

          <!-- 书名与作者 -->
          <text class="finish-title-zh">《{{ currentStory.titleZh }}》</text>
          <text class="finish-title-en">{{ currentStory.title }} · {{ displayAuthor }}</text>

          <!-- 极简单行完读成就指标 (前后均带 🎉 庆祝微标) -->
          <view class="finish-stats-line">
            <text class="finish-celebrate-mark">🎉</text>
            <text class="finish-stats-text">
              {{ (readCount || 1) > 1 ? `已完成第 ${readCount} 遍精读` : '全篇精读完成' }} · {{ currentStory.wordCount }} 词 · {{ totalParagraphs }} 段落
            </text>
            <text class="finish-celebrate-mark">🎉</text>
          </view>
        </view>

        <!-- 底部固定操作栏：方案一（双主并排：分享好友 + 挑选新书） -->
        <view class="finish-footer w-full pb-1">
          <view class="finish-btn-row flex gap-2.5 w-full">
            <button open-type="share" class="card-btn-half btn-primary flex-1">
              分享给好友
            </button>
            <view class="card-btn-half btn-secondary flex-1" @tap.stop="handleGoToBookshelf">
              挑选新书 ›
            </view>
          </view>
        </view>
      </view>

      <!-- 正常段落卡片内容 -->
      <template v-else-if="currentParagraph">
        <!-- 场景 A：独立封面页 / 章节扉页（垂直水平居中排版） -->
        <view
          v-if="currentParagraph.isBookCover || currentParagraph.isChapterHeader"
          class="chapter-cover-view"
        >
          <view v-if="currentParagraph.chapterNum || currentParagraph.tagline" class="chapter-badge">
            {{ currentParagraph.chapterNum || currentParagraph.tagline }}
          </view>
          <text class="chapter-title-en">
            {{ currentParagraph.titleEn || currentParagraph.chapterTitleEn || currentParagraph.en }}
          </text>
          <view class="chapter-decor-line" />
          <text class="chapter-title-zh">
            {{ currentParagraph.titleZh ? `《${currentParagraph.titleZh}》` : (currentParagraph.chapterTitleZh || currentParagraph.zh) }}
          </text>
          <text v-if="currentParagraph.author" class="chapter-author">
            {{ currentParagraph.author }}
          </text>
        </view>

        <!-- 场景 B：卡片可滚动正文内容区 (card-scroll-view) -->
        <scroll-view
          v-else
          scroll-y
          class="card-scroll-view px-6 flex-1 w-full box-border"
          :show-scrollbar="false"
          :scroll-top="scrollTop"
          @scroll="handleDetailScroll"
        >
          <!-- 英文正文文本流 (100% 完整连贯自然段落，两端齐行，零多余切断) -->
          <view class="en-text-box" :style="fontSizeStyle">
            <template v-for="(token, tIdx) in tokenizeParagraph(currentParagraph.en)" :key="tIdx">
              <!-- 空格与标点 -->
              <text v-if="!token.isWord">{{ token.raw }}</text>

              <!-- 单词节点：轻触弹出气泡 (支持单字与语境词组联动) -->
              <text
                v-else
                class="word-token"
                :class="{
                  'is-active': activeTokenIndex === tIdx,
                  'is-phrase-companion': activePhrase && tIdx >= activePhrase.startIndex && tIdx <= activePhrase.endIndex && activeTokenIndex !== tIdx
                }"
                @tap.stop="handleWordTap($event, token.raw, tIdx)"
              >
                {{ token.raw }}
              </text>
            </template>
          </view>

          <!-- 方案 1：双语分割区域 (始终显示时隐藏操作胶囊按钮，零歧义；默认折叠时展示交互胶囊) -->
          <!-- 默认折叠：居中嵌入式微按钮 (查看/收起译文) -->
          <view v-if="!showAllTranslations" class="divider-btn-row">
            <view class="divider-line" />
            <view
              class="divider-pill-btn"
              hover-class="divider-pill-btn-hover"
              :hover-stay-time="100"
              @tap.stop="toggleTranslation"
            >
              <text class="divider-btn-text">
                {{ isRevealed ? '收起译文' : '查看译文' }}
              </text>
              <text class="divider-btn-arrow">
                {{ isRevealed ? '▴' : '▾' }}
              </text>
            </view>
            <view class="divider-line" />
          </view>

          <!-- 始终显示：纯净极简细分割线（无任何折叠按钮，中英双语自然对照） -->
          <view v-else class="divider-simple-row">
            <view class="divider-line" />
          </view>

          <!-- 中文译文：纯净折叠展开，平滑过渡，零模糊浑浊感 -->
          <view
            :key="'zh-' + currentParagraph.index"
            class="zh-collapse-wrapper"
            :class="{ 'is-expanded': showAllTranslations || isRevealed }"
          >
            <view class="zh-content-inner">
              <text class="zh-text">{{ currentParagraph.zh }}</text>
            </view>
          </view>

          <!-- 底部缓冲空间 -->
          <view class="h-6 w-full shrink-0" />
        </scroll-view>

        <!-- 卡片底部固定操作栏 (方案 A：微进度条 + 对称平衡) -->
        <view class="card-footer px-6 mt-3 shrink-0">
          <!-- 方案 A：阅读进度指示模块 (可开启/关闭，直接绑定顶层卡片自身的段落序号) -->
          <view v-if="showReadingProgress && currentParagraph" class="reading-progress-block">
            <view class="progress-meta-row flex justify-between items-center mb-1.5">
              <text class="progress-label-index">段落 {{ currentParagraph.index }} / {{ totalParagraphs }}</text>
              <text class="progress-label-percent">{{ getProgressPercent(currentParagraph.index) }}% · {{ getRemainingMinutesText(currentParagraph.index) }}</text>
            </view>
            <view class="progress-track">
              <view class="progress-fill" :style="{ width: getProgressPercent(currentParagraph.index) + '%' }" />
            </view>
          </view>

          <!-- 操作按钮 (单主按钮全宽，对齐极简规范 的下一个按钮) -->
          <view class="w-full">
            <view
              class="card-btn btn-primary w-full text-base"
              hover-class="btn-primary-hover"
              :hover-stay-time="100"
              @tap.stop="handleNextParagraph"
            >
              {{ currentIndex === totalParagraphs - 1 ? '完成本篇' : '下一段' }}
            </view>
          </view>
        </view>
      </template>
    </view>

    <!-- 贴边悬浮设置齿轮 (贴边悬浮，设置抽屉入口) -->
    <movable-view
      v-if="gearReady"
      class="floating-gear"
      direction="all"
      :x="gearX"
      :y="gearY"
      :animation="true"
      @change="onGearChange"
      @touchstart="onGearTouchStart"
      @touchend="onGearTouchEnd"
    >
      <view
        class="gear-btn flex-center"
        :class="{
          'gear-hidden': isHiding,
          'dock-left': isHiding && dockSide === 'left',
          'dock-right': isHiding && dockSide === 'right',
        }"
        @tap="handleGearClick"
      >
        <text class="gear-icon">⚙</text>
      </view>
    </movable-view>

    <!-- 单词轻量释义气泡 (替代大遮罩半屏弹窗) -->
    <view v-if="bubbleVisible" class="bubble-backdrop" @tap.stop="closeBubble" />

    <view
      v-if="bubbleVisible && selectedWordData"
      class="word-bubble-popover"
      :class="[bubblePlacement, { 'has-phrase': !!activePhrase }]"
      :style="bubbleStyle"
      @tap.stop
    >
      <!-- 指向触点的三角指针 -->
      <view class="bubble-arrow" :style="{ left: bubbleArrowLeft + 'px' }" />

      <view class="bubble-content">
        <!-- 头部行：短语优先呈现为标题 (无短语时展示单字) + 动态发音喇叭 -->
        <view class="bubble-header">
          <view
            class="bubble-word-group"
            @tap.stop="handlePlayBubbleAudio(activePhrase ? activePhrase.phrase : selectedWordData.word)"
          >
            <text class="bubble-word">{{ activePhrase ? activePhrase.phrase : selectedWordData.word }}</text>
          </view>
          <view
            class="phonetic-speaker-box"
            :class="{ playing: isAudioPlaying && (currentPlayingWord === (activePhrase ? activePhrase.phrase : selectedWordData.word)) }"
            @tap.stop="handlePlayBubbleAudio(activePhrase ? activePhrase.phrase : selectedWordData.word)"
          >
            <text class="speaker-horn"></text>
            <text class="speaker-arc arc-1"></text>
            <text class="speaker-arc arc-2"></text>
          </view>
        </view>

        <!-- 场景 A：命中语境词组 (主标题已展示短语，此处直接呈现释义，彻底去重) -->
        <template v-if="activePhrase">
          <!-- 1. 词组释义 -->
          <view class="flow-phrase-section" @tap.stop="handlePlayBubbleAudio(activePhrase.phrase)">
            <text class="flow-phrase-meaning">{{ activePhrase.meaning }}</text>
          </view>

          <!-- 词典微细分割线 -->
          <view class="flow-divider" />

          <!-- 2. 下方紧随单字原义对照 -->
          <scroll-view
            scroll-y
            class="flow-word-section"
            :class="{ 'has-overflow': hasScrollableContent }"
            @tap.stop="handlePlayBubbleAudio(selectedWordData.word)"
          >
            <text class="flow-word-label">{{ selectedWordData.word }}：</text>
            <text class="flow-word-meaning">{{ selectedWordData.meaning }}</text>
            <view v-if="hasScrollableContent" class="bubble-bottom-spacer" />
          </scroll-view>
        </template>

        <!-- 场景 B：未命中词组 (纯净极简单字模式) -->
        <template v-else>
          <scroll-view
            scroll-y
            class="bubble-meaning"
            :class="{ 'has-overflow': hasScrollableContent }"
            @tap.stop="handlePlayBubbleAudio(selectedWordData.word)"
          >
            <text class="bubble-meaning-text">{{ selectedWordData.meaning }}</text>
            <view v-if="hasScrollableContent" class="bubble-bottom-spacer" />
          </scroll-view>
        </template>
      </view>
    </view>

    <!-- 设置与切书抽屉 (从底部弹出) -->
    <SettingsDrawer
      v-model:show="showDrawer"
      :current-theme="currentTheme"
      :current-font-size="currentFontSize"
      :show-all-translations="showAllTranslations"
      :show-reading-progress="showReadingProgress"
      :current-story-id="currentStoryId"
      @change-theme="setTheme"
      @change-font-size="setFontSize"
      @change-all-translations="handleAllTranslationsChange"
      @change-reading-progress="handleReadingProgressChange"
      @change-story="handleStoryChange"
    />
  </movable-area>
</template>

<style>
/* Global tap-highlight reset for mobile webviews to prevent white/grey flashing on tap */
view, text, button, image, scroll-view, movable-area, movable-view {
  -webkit-tap-highlight-color: transparent !important;
}

/* 全屏页面容器 (对齐极简规范 ) */
.page-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  padding: 0;
  transition: background-color 0.3s, color 0.3s;
  background-color: var(--ej-bg-page);
  color: var(--ej-text-primary);
}

/* 核心活动大卡片 (根据视口精确自适应居中，严防高度溢出导致上下边距裁切) */
.app-card {
  width: calc(100% - 36px);
  max-width: 400px;
  height: calc(100% - 36px);
  border-radius: 18px;
  padding: 24px 0 18px 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  overflow: hidden;
  transition: background-color 0.3s, border-color 0.3s, box-shadow 0.3s, transform 0.25s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.25s ease, color 0.3s;
  background-color: var(--ej-bg-card);
  border: 1px solid var(--ej-border-card);
  box-shadow: var(--ej-shadow-card);
  color: var(--ej-text-primary);
  z-index: 10;
}

/* 底层堆叠卡片 (与主卡片保持一致的自适应宽高，露出底部立体层次) */
.app-card-bg {
  position: absolute;
  top: 18px;
  left: 18px;
  right: 18px;
  margin: 0 auto;
  width: calc(100% - 36px);
  max-width: 400px;
  height: calc(100% - 36px);
  border-radius: 18px;
  padding: 24px 0 18px 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  overflow: hidden;
  background-color: var(--ej-bg-card-bg);
  border: 1px solid var(--ej-border-card);
  box-shadow: var(--ej-shadow-card-bg);
  color: var(--ej-text-primary);
  
  /* Layered Stack appearance default */
  transform: scale(0.94) translateY(20px);
  opacity: 0.85;
  z-index: 5;
  pointer-events: none;
}

/* 舒适内边距体系：统一 22px 左右边距，呈现自然书页质感 */
.px-6 {
  padding-left: 22px;
  padding-right: 22px;
}

.mt-3 {
  margin-top: 12px;
}

.shrink-0 {
  flex-shrink: 0;
}

.flex-1 {
  flex: 1;
}

.w-full {
  width: 100%;
}

/* 可滚动正文区域与顶部微内边距、底部渐隐蒙版 */
.card-scroll-view {
  overflow-y: auto;
  padding-top: 6px;
  width: 100%;
  box-sizing: border-box;
  -webkit-mask-image: linear-gradient(to bottom, #000000 0%, #000000 calc(100% - 36px), rgba(0, 0, 0, 0.4) calc(100% - 14px), transparent 100%);
  mask-image: linear-gradient(to bottom, #000000 0%, #000000 calc(100% - 36px), rgba(0, 0, 0, 0.4) calc(100% - 14px), transparent 100%);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

/* 英文正文排版：经典衬线文学字体 + 两端齐行，保持纯正完整的连贯自然段落 */
.en-text-box {
  color: var(--ej-text-primary);
  text-align: justify;
  text-justify: inter-word;
  font-family: Georgia, "Times New Roman", Palatino, serif;
  letter-spacing: 0.005em;
  word-spacing: 0.04em;
  line-height: 1.85;
}

/* 方案 1：分割线居中嵌入式微按钮 */
.divider-btn-row {
  display: flex;
  align-items: center;
  width: 100%;
  margin: 16px 0 10px 0;
}

/* 始终显示模式下的纯净双语细分割线 (无折叠按钮) */
.divider-simple-row {
  display: flex;
  align-items: center;
  width: 100%;
  margin: 16px 0 12px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--ej-border);
  opacity: 0.65;
}

.divider-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 10px;
  margin: 0 10px;
  border-radius: 9999px;
  background-color: var(--ej-card-bg);
  border: 1px solid var(--ej-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.15s ease;
}

.divider-pill-btn-hover {
  background-color: var(--ej-color-brand-light);
  border-color: rgba(37, 99, 235, 0.3);
}

.divider-btn-text {
  font-size: 11.5px;
  color: var(--ej-text-secondary);
  letter-spacing: 0.2px;
}

.divider-btn-arrow {
  font-size: 10px;
  color: var(--ej-text-muted);
  margin-left: 1px;
}

/* 中文译文折叠展开区 */
.zh-collapse-wrapper {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.24s ease, margin 0.24s ease;
}

.zh-collapse-wrapper.is-expanded {
  max-height: 800px;
  opacity: 1;
  margin-top: 6px;
  margin-bottom: 8px;
}

/* 当卡片处于翻页重置或瞬移归位时，禁用折叠过渡，彻底消除翻页闪现中文 */
.card-reset-center .zh-collapse-wrapper,
.card-slide-out-up .zh-collapse-wrapper,
.active-card-to-back-instant .zh-collapse-wrapper,
.bg-card-to-back-instant .zh-collapse-wrapper,
.prev-card-to-active-instant .zh-collapse-wrapper,
.bg-card-reset-back .zh-collapse-wrapper {
  transition: none !important;
}

.zh-content-inner {
  text-align: justify;
  text-justify: inter-word;
}

.zh-text {
  font-size: 14.5px;
  line-height: 1.85;
  color: var(--ej-text-secondary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  letter-spacing: 0.02em;
  word-break: break-word;
}

.word-token {
  display: inline;
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.15s;
}

.word-token:active {
  background-color: var(--ej-color-brand-light);
  color: var(--ej-color-brand);
}

/* 方案 A：阅读进度条与元数据 (对齐极简规范 质感) */
.reading-progress-block {
  width: 100%;
  margin-bottom: 12px;
}

.progress-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  line-height: 1.2;
}

.progress-label-index {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ej-text-secondary);
  letter-spacing: 0.3px;
}

.progress-label-percent {
  font-size: 11px;
  color: var(--ej-text-muted);
}

.progress-track {
  width: 100%;
  height: 3px;
  background-color: var(--ej-border);
  border-radius: 9999px;
  overflow: hidden;
  margin-top: 6px;
}

.progress-fill {
  height: 100%;
  background-color: var(--ej-color-brand);
  border-radius: 9999px;
}

/* 底部操作区与序列编号 */
.card-seq-text {
  font-size: 13px;
  font-style: italic;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--ej-text-muted);
  opacity: 0.85;
  line-height: 1.1;
  letter-spacing: 0.5px;
}

/* 卡片按钮 (对齐极简规范 card-btn) */
.card-btn {
  border-radius: 12px;
  padding: 13px 20px;
  font-size: 15.5px;
  font-weight: 700;
  text-align: center;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  cursor: pointer;
}

.btn-primary {
  color: #FFFFFF;
  background-color: var(--ej-color-brand);
}

.btn-primary:active,
.btn-primary-hover {
  background-color: var(--ej-color-brand-active);
  transform: scale(0.985);
}

.btn-secondary {
  color: var(--ej-text-secondary);
  background-color: var(--ej-bg-pill);
  border: 1px solid var(--ej-border);
}

.btn-secondary:active,
.btn-secondary-hover {
  background-color: var(--ej-bg-sub);
  transform: scale(0.985);
}

/* 章节独立居中扉页卡片 */
.chapter-cover-view {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 48rpx;
  box-sizing: border-box;
}

.chapter-badge {
  font-family: ui-monospace, monospace;
  font-size: 26rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
  text-transform: uppercase;
  color: var(--ej-text-secondary);
  opacity: 0.85;
  margin-bottom: 24rpx;
}

.chapter-title-en {
  font-family: "Noto Serif SC", Georgia, "Times New Roman", serif;
  font-size: 44rpx;
  font-weight: 700;
  color: var(--ej-text-primary);
  line-height: 1.35;
  margin-bottom: 32rpx;
  max-width: 90%;
  word-break: break-word;
}

.chapter-decor-line {
  width: 96rpx;
  height: 2rpx;
  background-color: var(--ej-border, #E7E4DC);
  margin-bottom: 32rpx;
  opacity: 0.8;
}

.chapter-title-zh {
  font-family: "Noto Serif SC", "Songti SC", STSong, serif;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ej-text-secondary);
  letter-spacing: 1rpx;
  max-width: 90%;
}

.chapter-author {
  font-family: "Noto Serif SC", "Songti SC", STSong, serif;
  font-size: 26rpx;
  color: var(--ej-text-secondary);
  opacity: 0.75;
  margin-top: 18rpx;
  letter-spacing: 0.5rpx;
}

/* 完读成就卡片 (高级极简留白、沉静书香质感) */
.finish-card-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
}

.finish-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 0 64px 0; /* 视觉中心黄金分割上提 (Optical Centering)，消除底部操作按钮带来的下沉感 */
}

.finish-cover-box {
  margin-bottom: 22px;
  filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.22));
  transition: transform 0.2s;
}

.finish-title-zh {
  font-size: 20px;
  font-weight: 700;
  color: var(--ej-text-primary);
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  text-align: center;
}

.finish-title-en {
  font-size: 13px;
  font-style: italic;
  font-family: Georgia, "Times New Roman", serif;
  color: var(--ej-text-secondary);
  margin-bottom: 14px;
  text-align: center;
  max-width: 90%;
}

.finish-stats-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--ej-text-secondary);
  letter-spacing: 0.3px;
  font-weight: 500;
  text-align: center;
}

.finish-celebrate-mark {
  font-size: 13px;
  line-height: 1;
}

.finish-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding-bottom: 4px;
}

.finish-btn-row {
  display: flex;
  gap: 10px;
  width: 100%;
}

.card-btn-half {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  font-size: 14.5px;
  font-weight: 700;
  text-align: center;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.card-btn-half:active {
  transform: scale(0.985);
}

/* 微信原生分享按钮对齐 card-btn-half */
button.card-btn-half {
  margin: 0;
  padding: 0;
  border: none;
  outline: none;
  line-height: normal;
}
button.card-btn-half::after {
  border: none;
}

/* 激活态单词高亮 */
.word-token.is-active {
  background-color: var(--ej-color-brand-light);
  color: var(--ej-color-brand);
  border-radius: 4px;
}

/* 语境词组伴生词高亮 (更柔和的半透明背景与下点线，提示词组边界) */
.word-token.is-phrase-companion {
  background-color: var(--ej-color-brand-light);
  opacity: 0.9;
  border-radius: 3px;
  border-bottom: 1.5px dashed var(--ej-color-brand);
}

/* 单词气泡透明点击关闭遮罩 (完全不遮挡阅读视线) */
.bubble-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 180;
  background: transparent;
}

/* 单词轻量释义气泡卡片 (100% 实体高对比，主题自适应，绝不透字) */
.word-bubble-popover {
  position: fixed;
  z-index: 190;
  width: 242px;
  background-color: #FFFFFF !important; /* 亮色模式：100% 纯白实体，完全遮光 */
  border: 1px solid #E2E8F0 !important;
  border-radius: 12px;
  padding: 10px 14px;
  box-shadow: 0 12px 30px -4px rgba(15, 23, 42, 0.16), 0 4px 10px -2px rgba(15, 23, 42, 0.08);
  animation: bubblePop 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  box-sizing: border-box;
  cursor: pointer;
  transition: transform 0.12s ease;
}

.word-bubble-popover.has-phrase {
  width: 256px;
}

.word-bubble-hover {
  transform: scale(0.985);
  opacity: 0.96;
}

.dark .word-bubble-popover,
.page-container.dark .word-bubble-popover {
  background-color: #27272A !important; /* 暗色模式：100% 实体深灰，高于卡片背景，层次分明 */
  border-color: #3F3F46 !important;
  box-shadow: 0 14px 36px -4px rgba(0, 0, 0, 0.65);
}

.word-bubble-popover.placement-top {
  transform-origin: center bottom;
}

.word-bubble-popover.placement-bottom {
  transform-origin: center top;
}

@keyframes bubblePop {
  0% {
    opacity: 0;
    transform: scale(0.92);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 气泡三角指针 (完全实体背景，精确对接气泡边框) */
.bubble-arrow {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: #FFFFFF !important;
  transform: rotate(45deg);
  box-sizing: border-box;
}

.dark .bubble-arrow,
.page-container.dark .bubble-arrow {
  background-color: #27272A !important;
}

.word-bubble-popover.placement-top .bubble-arrow {
  bottom: -6px;
  border-right: 1px solid #E2E8F0;
  border-bottom: 1px solid #E2E8F0;
  border-top: none;
  border-left: none;
}

.dark .word-bubble-popover.placement-top .bubble-arrow,
.page-container.dark .word-bubble-popover.placement-top .bubble-arrow {
  border-right-color: #3F3F46;
  border-bottom-color: #3F3F46;
}

.word-bubble-popover.placement-bottom .bubble-arrow {
  top: -6px;
  border-left: 1px solid #E2E8F0;
  border-top: 1px solid #E2E8F0;
  border-right: none;
  border-bottom: none;
}

.dark .word-bubble-popover.placement-bottom .bubble-arrow,
.page-container.dark .word-bubble-popover.placement-bottom .bubble-arrow {
  border-left-color: #3F3F46;
  border-top-color: #3F3F46;
}

/* 气泡内部排版 (双主题对比度适配) */
.bubble-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}

.bubble-word-group {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex: 1;
  overflow: hidden;
}

.bubble-word {
  font-size: 15px;
  font-weight: 700;
  color: #0F172A;
  font-family: Georgia, serif;
}

.dark .bubble-word,
.page-container.dark .bubble-word {
  color: #F4F4F5;
}

/* 动态声波喇叭 */
.phonetic-speaker-box {
  position: relative;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
  cursor: pointer;
  border-radius: 4px;
  transition: transform 0.15s ease;
  margin-left: 6px;
}

.phonetic-speaker-box:active {
  transform: scale(0.9);
}

.speaker-horn,
.speaker-arc {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  background-color: var(--ej-color-brand);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.speaker-horn {
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5'></polygon></svg>") no-repeat center / contain;
  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5'></polygon></svg>") no-repeat center / contain;
  opacity: 0.85;
}

.speaker-arc.arc-1 {
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M15.54 8.46a5 5 0 0 1 0 7.07'></path></svg>") no-repeat center / contain;
  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M15.54 8.46a5 5 0 0 1 0 7.07'></path></svg>") no-repeat center / contain;
  opacity: 0.85;
}

.speaker-arc.arc-2 {
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M19.07 4.93a10 10 0 0 1 0 14.14'></path></svg>") no-repeat center / contain;
  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M19.07 4.93a10 10 0 0 1 0 14.14'></path></svg>") no-repeat center / contain;
  opacity: 0.85;
}

/* 播放态：原生弧形音波层层扩散动效 (对齐极简规范 ) */
.phonetic-speaker-box.playing .speaker-horn {
  opacity: 1;
  animation: horn-vibrate 0.9s ease-in-out infinite;
}

.phonetic-speaker-box.playing .arc-1 {
  animation: wave-arc-1 0.9s ease-in-out infinite;
}

.phonetic-speaker-box.playing .arc-2 {
  animation: wave-arc-2 0.9s ease-in-out infinite;
}

@keyframes horn-vibrate {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

@keyframes wave-arc-1 {
  0%, 15% {
    opacity: 0.15;
    transform: scale(0.92);
  }
  35%, 80% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0.15;
    transform: scale(0.92);
  }
}

@keyframes wave-arc-2 {
  0%, 40% {
    opacity: 0.15;
    transform: scale(0.92);
  }
  60%, 85% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0.15;
    transform: scale(0.92);
  }
}

.bubble-meaning {
  font-size: 13px;
  line-height: 1.55;
  color: #334155;
  word-break: break-word;
  white-space: pre-line;
  max-height: 180px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.bubble-meaning::-webkit-scrollbar,
.flow-word-section::-webkit-scrollbar {
  width: 3px;
}

.bubble-meaning::-webkit-scrollbar-thumb,
.flow-word-section::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.4);
  border-radius: 3px;
}

.dark .bubble-meaning,
.page-container.dark .bubble-meaning {
  color: #E4E4E7;
}

/* 语境词组微徽标 */
.bubble-phrase-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--ej-color-brand);
  background-color: var(--ej-color-brand-light);
  border-radius: 4px;
  padding: 1px 5px;
  line-height: 1.3;
  margin-right: 5px;
  flex-shrink: 0;
}

/* 方案三：流式高阶词典排版 (去内嵌框，纯净一体化，零重复) */
.flow-phrase-section {
  margin-top: 1px;
  cursor: pointer;
}

.flow-phrase-meaning {
  font-size: 13px;
  line-height: 1.45;
  color: #0F172A;
  font-weight: 500;
  word-break: break-word;
  display: block;
}

.dark .flow-phrase-meaning,
.page-container.dark .flow-phrase-meaning {
  color: #F4F4F5;
}

/* 典雅的词典微细分割线 */
.flow-divider {
  height: 1px;
  background-color: #E2E8F0;
  margin: 7px 0 6px 0;
  opacity: 0.85;
}

.dark .flow-divider,
.page-container.dark .flow-divider {
  background-color: #3F3F46;
  opacity: 0.7;
}

.flow-word-section {
  font-size: 11.5px;
  line-height: 1.45;
  color: #64748B;
  word-break: break-word;
  white-space: pre-line;
  max-height: 120px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  cursor: pointer;
}

.dark .flow-word-section,
.page-container.dark .flow-word-section {
  color: #94A3B8;
}

.flow-word-label {
  font-weight: 600;
  color: #475569;
}

.dark .flow-word-label,
.page-container.dark .flow-word-label {
  color: #CBD5E1;
}

.flow-word-meaning {
  color: #64748B;
}

.dark .flow-word-meaning,
.page-container.dark .flow-word-meaning {
  color: #94A3B8;
}

/* 对齐设置抽屉与正文的底部渐隐淡化遮罩 (-webkit-mask-image 纯净自然渐变) */
.bubble-meaning.has-overflow,
.flow-word-section.has-overflow {
  -webkit-mask-image: linear-gradient(to bottom, #000000 0%, #000000 calc(100% - 24px), rgba(0, 0, 0, 0.35) calc(100% - 8px), transparent 100%);
  mask-image: linear-gradient(to bottom, #000000 0%, #000000 calc(100% - 24px), rgba(0, 0, 0, 0.35) calc(100% - 8px), transparent 100%);
}

/* 气泡底部缓冲空间，确保滚动到底部时末行释义完全滚出遮罩区、字字清晰 */
.bubble-bottom-spacer {
  height: 22px;
  width: 100%;
  flex-shrink: 0;
}
</style>
