<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { onShow, onLoad } from "@dcloudio/uni-app";
import type { CatalogItem } from "@/types/reader";
import catalogData from "@/data/catalog.json";
import BookCover from "@/components/BookCover.vue";
import { currentTheme, setNavigationBarTheme } from "@/utils/theme";
import {
  getAllStoryProgress,
  resetStoryProgress,
  storyTotalParagraphsMap,
  type StoryProgressData,
} from "@/utils/readingProgress";
import commonUtil from "@/utils/commonUtil";

const CURRENT_STORY_STORAGE_KEY = "handy_reader_current_story_id";

// 视图切换：'grid' (3列书架网格) | 'list' (详细赏析列表)
const viewMode = ref<"grid" | "list">("grid");

// 难度分类筛选 (精简名称)
const selectedDifficulty = ref<string>("all");

// 当前在读故事 ID
const currentStoryId = ref<string>(
  uni.getStorageSync(CURRENT_STORY_STORAGE_KEY) || "the_little_match_girl"
);

// 全局书籍阅读进度字典
const progressMap = ref<Record<string, StoryProgressData>>({});

// 详情弹窗所选书籍
const previewBook = ref<CatalogItem | null>(null);

// 极简 Tab 选项 (避免长文案被裁切)
const filterTabs = [
  { label: "全部", value: "all" },
  { label: "入门级", value: "beginner" },
  { label: "进阶级", value: "intermediate" },
  { label: "挑战级", value: "advanced" },
];

// 记录 catalog.json 原始精选顺序索引，保证未读书籍严格按编辑精选序呈现（定义于组件外部或单次初始化）
const catalogOriginalIndexMap = new Map<string, number>(
  (catalogData as CatalogItem[]).map((item, idx) => [item.id, idx])
);

// 首屏秒开渲染控制：首帧仅挂载前 9 本书极速出图，随后平滑展开全量
const renderLimit = ref(9);

// 方案 1-A 智能分层排序：当前在读置顶 -> 正在读(最近阅读优先) -> 从未读过(编辑精选序) -> 已读完(归档沉底)
const filteredStories = computed(() => {
  const list = catalogData as CatalogItem[];
  const filtered =
    selectedDifficulty.value === "all"
      ? [...list]
    : list.filter((s) => s.difficulty === selectedDifficulty.value);

  return filtered.sort((a, b) => {
    const isCurrentA = a.id === currentStoryId.value;
    const isCurrentB = b.id === currentStoryId.value;

    // 梯队 0：当前在读书籍牢牢置顶
    if (isCurrentA && !isCurrentB) return -1;
    if (!isCurrentA && isCurrentB) return 1;

    const progA = progressMap.value[a.id];
    const progB = progressMap.value[b.id];

    const countA = typeof progA?.readCount === "number" ? progA.readCount : (progA?.finished ? 1 : 0);
    const countB = typeof progB?.readCount === "number" ? progB.readCount : (progB?.finished ? 1 : 0);

    const hasProgA = Boolean(progA && (progA.index ?? 0) > 0 && !progA.finished);
    const hasProgB = Boolean(progB && (progB.index ?? 0) > 0 && !progB.finished);

    const isFinA = Boolean(progA?.finished || countA > 0);
    const isFinB = Boolean(progB?.finished || countB > 0);

    // 状态梯队划分：
    // 0: 当前在读
    // 1: 正在读（有进度且未完成，含首读进行中、或二刷三刷进行中）
    // 2: 从未读过（全新书目）
    // 3: 已读完（归档沉底，含已完读且未在读中的书目）
    const tierA = isCurrentA ? 0 : hasProgA ? 1 : isFinA ? 3 : 2;
    const tierB = isCurrentB ? 0 : hasProgB ? 1 : isFinB ? 3 : 2;

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // 同为梯队 1（正在读）：按最近阅读时间倒序，最新读的在前
    if (tierA === 1) {
      const timeA = progA?.updatedAt ?? 0;
      const timeB = progB?.updatedAt ?? 0;
      if (timeA !== timeB) return timeB - timeA;
    }

    // 同为梯队 3（已读完）：按读完时间倒序，最新读完的排在归档区上方
    if (tierA === 3) {
      const timeA = progA?.updatedAt ?? 0;
      const timeB = progB?.updatedAt ?? 0;
      if (timeA !== timeB) return timeB - timeA;
    }

    // 同为梯队 2（从未读过）或同梯队无时间差异：严格按 1-A 编辑精选顺序排列
    const idxA = catalogOriginalIndexMap.get(a.id) ?? 0;
    const idxB = catalogOriginalIndexMap.get(b.id) ?? 0;
    return idxA - idxB;
  });
});

// 首屏渐进呈现数据源（分类切换时自动展开全量）
const visibleStories = computed(() => {
  return filteredStories.value.slice(0, renderLimit.value);
});

// 预计算书籍完读进度百分比字典，避免模板循环中高频重复执行函数
const storyProgressPercentMap = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {};
  const progMap = progressMap.value;
  for (const item of catalogData as CatalogItem[]) {
    const prog = progMap[item.id];
    if (!prog) {
      map[item.id] = 0;
      continue;
    }
    if (prog.finished) {
      map[item.id] = 100;
      continue;
    }
    const total = storyTotalParagraphsMap[item.id] || 30;
    if (prog.index > 0) {
      map[item.id] = Math.min(99, Math.max(1, Math.round(((prog.index + 1) / total) * 100)));
    } else {
      map[item.id] = 0;
    }
  }
  return map;
});

// 方案 1：全景通透一体画卷 (导航栏与页面底色打通，告别灰白三明治断层)
let lastNavTheme: string | null = null;

function applyBookshelfNavTheme(animated = false) {
  try {
    const isDark = currentTheme.value === "dark";
    const targetTheme = isDark ? "dark" : "light";
    if (lastNavTheme === targetTheme) return;
    lastNavTheme = targetTheme;

    if (isDark) {
      uni.setNavigationBarColor({
        frontColor: "#ffffff",
        backgroundColor: "#18181B",
        animation: animated ? { duration: 150, timingFunc: "linear" } : undefined,
      });
    } else {
      uni.setNavigationBarColor({
        frontColor: "#000000",
        backgroundColor: "#FFFFFF",
        animation: animated ? { duration: 150, timingFunc: "linear" } : undefined,
      });
    }
  } catch (e) {
    console.error("Failed to set bookshelf nav color:", e);
  }
}

// 顶层立即同步执行首帧主题同步，杜绝等待 onShow 导致的闪白
applyBookshelfNavTheme(false);

onLoad(() => {
  applyBookshelfNavTheme(false);
});

onMounted(() => {
  // 延后至转场滑动动画（约 300ms）平滑结束之后再挂载全量 25 本书，确保入场 60fps 不掉帧
  setTimeout(() => {
    renderLimit.value = 999;
  }, 350);
});

onShow(() => {
  applyBookshelfNavTheme(false);
  currentStoryId.value = uni.getStorageSync(CURRENT_STORY_STORAGE_KEY) || "the_little_match_girl";
  progressMap.value = getAllStoryProgress();
});

onUnmounted(() => {
  lastNavTheme = null;
  // 离开书架回到阅读主页时，恢复阅读主页的导航栏主题
  setNavigationBarTheme(currentTheme.value);
});

function getStoryTotalParagraphs(storyId: string): number {
  return storyTotalParagraphsMap[storyId] || 30;
}

const formatAuthor = commonUtil.formatAuthorZh;

function getStoryProgressPercent(storyId: string): number {
  return storyProgressPercentMap.value[storyId] ?? 0;
}

function getRemainingMinutes(story: CatalogItem): number {
  const prog = progressMap.value[story.id];
  const totalP = getStoryTotalParagraphs(story.id);
  const currentIdx = prog?.index ?? 0;
  const remainingP = Math.max(0, totalP - (currentIdx + 1));
  const totalMins = story.estimatedMinutes || 10;
  return Math.max(1, Math.ceil((remainingP / totalP) * totalMins));
}

// 弹窗固定按钮文案 (无杂质、固定干净，详细进度在上方独立区域展示)
function getPreviewFixedBtnText(story: CatalogItem): string {
  if (!story.hasFullText) return "排版精校中 · 敬请期待";
  const prog = progressMap.value[story.id];
  const isCurrent = story.id === currentStoryId.value;

  if (prog?.finished) {
    return isCurrent ? "从头重新精读" : "切换并重新精读";
  }
  const hasProg = Boolean(prog && (prog.index ?? 0) > 0);
  if (hasProg) {
    return isCurrent ? "继续精读" : "切换并继续精读";
  }
  return isCurrent ? "开始精读" : "切换并开始精读";
}

function handleOpenPreview(story: CatalogItem) {
  previewBook.value = story;
}

function handleClosePreview() {
  previewBook.value = null;
}

function handleSelectStory(story: CatalogItem) {
  if (!story.hasFullText) {
    uni.showToast({
      title: "《" + story.titleZh + "》排版精校中，敬请期待！",
      icon: "none",
    });
    return;
  }

  const prog = progressMap.value[story.id];
  const isFinished = Boolean(prog?.finished);

  // 如果该书已完读，用户点击重新精读，重置进度到第 0 段开始新一轮精读（保留累计完读次数 readCount）
  if (isFinished) {
    resetStoryProgress(story.id);
  }

  currentStoryId.value = story.id;
  uni.setStorageSync(CURRENT_STORY_STORAGE_KEY, story.id);
  uni.setStorageSync("handy_reader_selected_from_bookshelf", true);
  previewBook.value = null;

  const toastTitle = isFinished
    ? `已重新开启《${story.titleZh}》`
    : `已切换至《${story.titleZh}》`;

  uni.showToast({
    title: toastTitle,
    icon: "success",
    duration: 1200,
  });

  setTimeout(() => {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      uni.navigateBack();
    } else {
      uni.redirectTo({ url: "/pages/index/index" });
    }
  }, 300);
}
</script>

<template>
  <view class="bookshelf-page" :class="[currentTheme]">
    <!-- 顶部控制栏：极简下划线 Tab 栏 + 右侧紧凑视图切换 (完全无多余假导航头) -->
    <view class="bookshelf-toolbar">
      <!-- 极简下划线分类 Tab -->
      <view class="category-tabs">
        <view
          v-for="tab in filterTabs"
          :key="tab.value"
          class="tab-item"
          :class="{ active: selectedDifficulty === tab.value }"
          @tap="selectedDifficulty = tab.value"
        >
          <text class="tab-label">{{ tab.label }}</text>
          <view v-if="selectedDifficulty === tab.value" class="tab-indicator" />
        </view>
      </view>

      <!-- 右侧视图切换 (田 网格 / ☰ 列表) -->
      <view class="view-toggle-box">
        <view
          class="toggle-btn"
          :class="{ active: viewMode === 'grid' }"
          @tap="viewMode = 'grid'"
        >
          <text class="toggle-icon">田</text>
        </view>
        <view
          class="toggle-btn"
          :class="{ active: viewMode === 'list' }"
          @tap="viewMode = 'list'"
        >
          <text class="toggle-icon">☰</text>
        </view>
      </view>
    </view>

    <!-- 可滚动书库内容区 (去除了上方正在精读卡片，直奔全量书库) -->
    <scroll-view scroll-y class="bookshelf-scroll flex-1 w-full" :show-scrollbar="false">
      <view class="bookshelf-content px-4 pt-3 pb-12 box-border">
        <!-- 视图 1：实体立体书架网格 (Grid Mode · 经典 3 列实体书封排布) -->
        <view v-if="viewMode === 'grid'" class="shelf-grid-container">
          <view
            v-for="story in visibleStories"
            :key="story.id"
            class="grid-book-item"
            :class="{ 'is-disabled': !story.hasFullText }"
            @tap="handleOpenPreview(story)"
          >
            <!-- 实体立体书封 -->
            <view class="grid-cover-wrap">
              <BookCover :story="story" size="lg" :active="story.id === currentStoryId" />
              <!-- 在读书籍角标 -->
              <text v-if="story.id === currentStoryId" class="grid-active-badge">在读</text>
              <text v-else-if="!story.hasFullText" class="grid-pending-badge">排版中</text>

              <!-- 封面底部微进度线 -->
              <view
                v-if="getStoryProgressPercent(story.id) > 0"
                class="cover-micro-progress"
              >
                <view
                  class="cover-micro-fill"
                  :style="{ width: getStoryProgressPercent(story.id) + '%' }"
                />
              </view>
            </view>

            <!-- 书籍信息 -->
            <view class="grid-info-wrap">
              <text class="grid-book-title truncate">{{ story.title }}</text>
              <text class="grid-book-zh truncate">《{{ story.titleZh }}》</text>
              <view class="grid-meta-row">
                <text class="grid-diff-text" :style="{ color: story.difficultyColor }">
                  {{ story.difficultyLabel.split('·')[0].trim() }}
                </text>
                <!-- 进度展示：纯粹展示客观进度 (如 15% / 已读完 / 词数) -->
                <text
                  v-if="progressMap[story.id]?.finished"
                  class="grid-prog-text font-bold text-emerald-600 dark:text-emerald-400"
                >
                  已读完
                </text>
                <text
                  v-else-if="getStoryProgressPercent(story.id) > 0"
                  class="grid-prog-text font-bold text-[var(--ej-color-brand)]"
                >
                  {{ getStoryProgressPercent(story.id) }}%
                </text>
                <text v-else class="grid-word-text">{{ story.wordCount }}词</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 视图 2：详细赏析列表 (List Mode · 展现梗概与背景) -->
        <view v-else class="shelf-list-container flex flex-col gap-3">
          <view
            v-for="story in visibleStories"
            :key="story.id"
            class="list-book-card"
            :class="{
              active: story.id === currentStoryId,
              'is-disabled': !story.hasFullText
            }"
            @tap="handleOpenPreview(story)"
          >
            <view class="list-cover-wrap">
              <BookCover :story="story" size="md" :active="story.id === currentStoryId" />
            </view>

            <view class="list-detail-wrap flex-1 min-w-0">
              <view class="flex items-center justify-between mb-1">
                <view class="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                  <text class="list-title truncate">{{ story.title }}</text>
                  <text v-if="story.id === currentStoryId" class="reading-pill-badge">在读</text>
                  <text v-else-if="!story.hasFullText" class="pending-pill-badge">排版中</text>
                </view>
                <text class="list-diff-label" :style="{ color: story.difficultyColor }">
                  {{ story.difficultyLabel.split('·')[0].trim() }}
                </text>
              </view>

              <text class="list-subtitle truncate">《{{ story.titleZh }}》· {{ formatAuthor(story.author) }}</text>

              <text class="list-summary-clamp line-clamp-2">
                {{ story.summary }}
              </text>

              <view class="list-footer-row flex justify-between items-center mt-2 pt-2 border-t border-[var(--ej-border)]">
                <view class="flex items-center gap-1.5 text-[11px] text-[var(--ej-text-muted)]">
                  <text>共 {{ story.wordCount }} 词</text>
                  <text
                    v-if="progressMap[story.id]?.finished"
                    class="font-bold text-emerald-600 dark:text-emerald-400"
                  >
                    · 已读完
                  </text>
                  <text
                    v-else-if="getStoryProgressPercent(story.id) > 0"
                    class="font-bold text-[var(--ej-color-brand)]"
                  >
                    · 进度 {{ getStoryProgressPercent(story.id) }}%
                  </text>
                  <text v-else>
                    · 约 {{ story.estimatedMinutes }} 分钟
                  </text>
                </view>
                <text v-if="story.id === currentStoryId" class="text-xs font-bold text-[var(--ej-color-brand)]">当前在读 ›</text>
                <text v-else-if="story.hasFullText" class="text-xs font-semibold text-[var(--ej-color-brand)]">开始阅读 ›</text>
                <text v-else class="text-xs text-[var(--ej-text-sub)]">待上线</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 书籍详情预览半屏弹窗 (Book Detail Modal) -->
    <view
      v-if="previewBook"
      class="preview-overlay"
      @tap="handleClosePreview"
      @touchmove.stop.prevent
    />

    <view
      v-if="previewBook"
      class="preview-sheet"
      :class="{ show: !!previewBook }"
    >
      <view class="flex justify-between items-center mb-4">
        <text class="text-base font-bold text-[var(--ej-text-primary)]">作品详情</text>
        <view class="sheet-close-btn cursor-pointer" @tap="handleClosePreview">
          <text class="close-icon">✕</text>
        </view>
      </view>

      <view class="flex gap-4 items-start mb-4">
        <BookCover :story="previewBook" size="md" :active="previewBook.id === currentStoryId" />
        <view class="flex flex-col gap-1 flex-1 min-w-0">
          <text class="text-base font-bold text-[var(--ej-text-primary)] leading-tight">{{ previewBook.title }}</text>
          <text class="text-xs font-medium text-[var(--ej-text-muted)]">《{{ previewBook.titleZh }}》</text>
          <text class="text-xs text-[var(--ej-text-secondary)] italic">{{ previewBook.author }}</text>
          
          <view class="flex items-center gap-2 mt-1">
            <text class="text-xs font-semibold" :style="{ color: previewBook.difficultyColor }">
              {{ previewBook.difficultyLabel }}
            </text>
            <text v-if="previewBook.id === currentStoryId" class="text-[10px] font-bold text-[var(--ej-color-brand)] bg-[var(--ej-color-brand-subtle)] px-1.5 py-0.5 rounded">
              当前在读
            </text>
          </view>
          <text class="text-[11px] text-[var(--ej-text-muted)]">
            全篇 {{ previewBook.wordCount }} 词 · 预计阅读 {{ previewBook.estimatedMinutes }} 分钟
          </text>
        </view>
      </view>

      <!-- 详细阅读进度展示区 (置于导读上方，纯净固定按钮在下方) -->
      <view
        v-if="previewBook.hasFullText"
        class="mb-4 p-3 rounded-xl border border-[var(--ej-border)] bg-[var(--ej-bg-sub)]"
      >
        <view class="flex justify-between items-center mb-1.5">
          <text class="text-xs font-bold text-[var(--ej-text-primary)]">阅读进度</text>
          <text
            v-if="progressMap[previewBook.id]?.finished"
            class="text-xs font-bold text-emerald-600 dark:text-emerald-400"
          >
            🎉 {{ (progressMap[previewBook.id]?.readCount || 1) > 1 ? `已完读 ${progressMap[previewBook.id]!.readCount} 遍` : '全篇已读完' }}
          </text>
          <text
            v-else-if="(progressMap[previewBook.id]?.readCount || 0) > 0"
            class="text-xs font-bold text-amber-600 dark:text-amber-400"
          >
            🎖️ 已完读 {{ progressMap[previewBook.id]!.readCount }} 遍 · 当前进度 {{ getStoryProgressPercent(previewBook.id) }}%
          </text>
          <text
            v-else-if="getStoryProgressPercent(previewBook.id) > 0"
            class="text-xs font-bold text-[var(--ej-color-brand)]"
          >
            已读 {{ getStoryProgressPercent(previewBook.id) }}% · 剩 {{ getRemainingMinutes(previewBook) }} 分钟
          </text>
          <text v-else class="text-xs text-[var(--ej-text-muted)]">
            尚未开始阅读
          </text>
        </view>

        <!-- 胶囊进度条 -->
        <view class="w-full h-1.5 bg-[var(--ej-border)] rounded-full overflow-hidden mb-1.5">
          <view
            class="h-full bg-[var(--ej-color-brand)] rounded-full"
            :style="{ width: getStoryProgressPercent(previewBook.id) + '%' }"
          />
        </view>

        <!-- 段落详细指标 -->
        <view class="flex justify-between items-center text-[11px] text-[var(--ej-text-muted)]">
          <text>
            {{ (progressMap[previewBook.id]?.index !== undefined ? progressMap[previewBook.id]!.index + 1 : (progressMap[previewBook.id]?.finished ? getStoryTotalParagraphs(previewBook.id) : 0)) }} / {{ getStoryTotalParagraphs(previewBook.id) }} 段落
          </text>
          <text v-if="progressMap[previewBook.id]?.finished" class="text-emerald-600 font-medium">
            随时可重读
          </text>
          <text v-else-if="getStoryProgressPercent(previewBook.id) > 0" class="text-[var(--ej-color-brand)] font-medium">
            已自动保存进度
          </text>
          <text v-else>
            准备就绪
          </text>
        </view>
      </view>

      <view class="mb-5 p-3 rounded-xl bg-[var(--ej-bg-sub)] border border-[var(--ej-border)]">
        <text class="text-xs font-bold text-[var(--ej-text-primary)] mb-1 block">文学导读</text>
        <text class="text-xs leading-relaxed text-[var(--ej-text-secondary)]">
          {{ previewBook.summary }}
        </text>
      </view>

      <!-- 纯净固定按钮文字 (无括号/无段落杂质) -->
      <view class="w-full">
        <view
          v-if="previewBook.hasFullText"
          class="card-btn btn-primary w-full text-base"
          @tap="handleSelectStory(previewBook)"
        >
          {{ getPreviewFixedBtnText(previewBook) }}
        </view>
        <view
          v-else
          class="card-btn btn-disabled w-full text-base"
          @tap="handleSelectStory(previewBook)"
        >
          排版精校中 · 敬请期待
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.bookshelf-page {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.bookshelf-page.light,
.light .bookshelf-page {
  background-color: #FFFFFF;
  color: #0F172A;
}

.bookshelf-page.dark,
.dark .bookshelf-page {
  background-color: #18181B;
  color: #F4F4F5;
}

/* 顶部控制栏 (与背景一体打通，零接缝) */
.bookshelf-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px 10px 16px;
  box-sizing: border-box;
  flex-shrink: 0;
  z-index: 10;
}

.bookshelf-page.light .bookshelf-toolbar,
.light .bookshelf-toolbar {
  background-color: #FFFFFF;
  border-bottom: 1px solid #F1F5F9;
}

.bookshelf-page.dark .bookshelf-toolbar,
.dark .bookshelf-toolbar {
  background-color: #18181B;
  border-bottom: 1px solid #27272A;
}

/* 极简下划线 Tab 栏 */
.category-tabs {
  display: flex;
  align-items: center;
  gap: 20px;
}

.tab-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0;
  cursor: pointer;
}

.tab-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--ej-text-muted);
  transition: color 0.2s;
  line-height: 1.3;
}

.tab-item.active .tab-label {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--ej-text-primary);
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  width: 18px;
  height: 3px;
  border-radius: 2px;
  background-color: var(--ej-color-brand);
  animation: indicatorFade 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes indicatorFade {
  from {
    transform: scaleX(0.4);
    opacity: 0;
  }
  to {
    transform: scaleX(1);
    opacity: 1;
  }
}

/* 右侧紧凑视图切换 */
.view-toggle-box {
  display: flex;
  background-color: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 2px;
}

.dark .view-toggle-box,
.bookshelf-page.dark .view-toggle-box {
  background-color: #27272A;
  border-color: #3F3F46;
}

.toggle-btn {
  width: 26px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: var(--ej-text-muted);
  transition: all 0.2s;
}

.toggle-btn.active {
  background-color: #FFFFFF;
  color: var(--ej-color-brand);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dark .toggle-btn.active,
.bookshelf-page.dark .toggle-btn.active {
  background-color: #3F3F46;
  color: #60A5FA;
}

.toggle-icon {
  font-size: 13px;
  line-height: 1;
}

/* 滚动区 */
.bookshelf-scroll {
  box-sizing: border-box;
}

/* 视图 1：实体立体书架网格 (Grid View) */
.shelf-grid-container {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px 10px;
  box-sizing: border-box;
  width: 100%;
}

.grid-book-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.grid-cover-wrap {
  position: relative;
  margin-bottom: 8px;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  justify-content: center;
}

.grid-book-item:active .grid-cover-wrap {
  transform: scale(0.96);
}

.grid-active-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 3px;
  background-color: var(--ej-color-brand);
  color: #FFFFFF;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  z-index: 5;
}

.grid-pending-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 3px;
  background-color: rgba(0, 0, 0, 0.65);
  color: #E2E8F0;
  z-index: 5;
}

.grid-info-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0 2px;
  overflow: hidden;
}

.grid-book-title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--ej-text-primary);
  line-height: 1.3;
  width: 100%;
  max-width: 100%;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
}

.grid-book-zh {
  display: block;
  font-size: 11px;
  color: var(--ej-text-secondary);
  line-height: 1.3;
  width: 100%;
  max-width: 100%;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
  margin-top: 1px;
}

.grid-meta-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 2px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.grid-diff-text {
  font-size: 9.5px;
  font-weight: 600;
  white-space: nowrap;
}

.grid-word-text {
  font-size: 9.5px;
  color: var(--ej-text-muted);
  white-space: nowrap;
}

.grid-prog-text {
  font-size: 9.5px;
  white-space: nowrap;
}

/* 封面底部微型进度条 (贴合书封下边缘) */
.cover-micro-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: rgba(0, 0, 0, 0.45);
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  overflow: hidden;
  z-index: 6;
}

.cover-micro-fill {
  height: 100%;
  background-color: var(--ej-color-brand);
  border-radius: 6px;
}

.is-disabled {
  opacity: 0.72;
}

/* 视图 2：详细列表 (List View) */
.list-book-card {
  display: flex;
  gap: 14px;
  padding: 14px;
  border-radius: 14px;
  background-color: #FFFFFF;
  border: 1px solid #E2E8F0;
  box-shadow: 0 2px 10px -2px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;
}

.dark .list-book-card,
.bookshelf-page.dark .list-book-card {
  background-color: #27272A;
  border-color: #3F3F46;
  box-shadow: 0 4px 14px -2px rgba(0, 0, 0, 0.4);
}

.list-book-card:active {
  background-color: var(--ej-color-brand-subtle);
  border-color: var(--ej-color-brand);
}

.list-book-card.active {
  border-color: var(--ej-color-brand);
  background-color: var(--ej-color-brand-subtle);
}

.list-cover-wrap {
  flex-shrink: 0;
}

.list-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--ej-text-primary);
}

.reading-pill-badge {
  font-size: 9.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: var(--ej-color-brand);
  color: #FFFFFF;
  line-height: 1.2;
  white-space: nowrap;
}

.pending-pill-badge {
  font-size: 9.5px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: var(--ej-border);
  color: var(--ej-text-muted);
  line-height: 1.2;
  white-space: nowrap;
}

.list-diff-label {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.list-detail-wrap {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.list-subtitle {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  color: var(--ej-text-muted);
  margin-bottom: 4px;
}

.list-summary-clamp {
  font-size: 11px;
  line-height: 1.45;
  color: var(--ej-text-secondary);
}

/* 半屏详情弹窗 (Detail Preview Sheet) */
.preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 100;
}

.preview-sheet {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  background-color: var(--ej-bg-card);
  color: var(--ej-text-primary);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  padding: 20px 18px calc(18px + env(safe-area-inset-bottom)) 18px;
  box-sizing: border-box;
  z-index: 101;
  animation: slideUp 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.sheet-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--ej-bg-sub);
}

.close-icon {
  font-size: 13px;
  color: var(--ej-text-muted);
}

.card-btn {
  border-radius: 12px;
  padding: 13px 20px;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  box-sizing: border-box;
}

.btn-primary {
  color: #FFFFFF;
  background-color: var(--ej-color-brand);
}

.btn-disabled {
  color: var(--ej-text-muted);
  background-color: var(--ej-bg-sub);
  border: 1px solid var(--ej-border);
}
</style>
