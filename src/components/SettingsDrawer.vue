<script setup lang="ts">
import { computed } from "vue";
import type { ThemeMode, FontSizeLevel, CatalogItem } from "@/types/reader";
import catalogData from "@/data/catalog.json";
import BookCover from "@/components/BookCover.vue";
import { getStoryProgress } from "@/utils/readingProgress";
import { getDifficultyColor } from "@/utils/theme";
import commonUtil from "@/utils/commonUtil";

interface Props {
  show: boolean;
  currentTheme: ThemeMode;
  currentFontSize: FontSizeLevel;
  showAllTranslations: boolean;
  showReadingProgress?: boolean;
  currentStoryId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:show", val: boolean): void;
  (e: "change-theme", theme: ThemeMode): void;
  (e: "change-font-size", size: FontSizeLevel): void;
  (e: "change-all-translations", val: boolean): void;
  (e: "change-reading-progress", val: boolean): void;
  (e: "change-story", storyId: string): void;
}>();

// 当前在读书籍信息
const currentStory = computed(() => {
  return (
    (catalogData as CatalogItem[]).find((s) => s.id === props.currentStoryId) ??
    (catalogData[0] as CatalogItem)
  );
});

// 当前在读书籍进度摘要文案 (极简纯粹：在读显示读至第几段，完读显示已读完全篇，未读显示预计时长)
const currentProgressText = computed(() => {
  const prog = getStoryProgress(props.currentStoryId);
  if (prog.finished) {
    return "已读完全篇";
  }
  if (typeof prog.index === "number" && prog.index > 0) {
    return `读至第 ${prog.index + 1} 段`;
  }
  return `约 ${currentStory.value.estimatedMinutes} 分钟`;
});

// 有效正文字号（保底选中 'md'）
const effectiveFontSize = computed<FontSizeLevel>(() => {
  const s = props.currentFontSize;
  return (s === "sm" || s === "md" || s === "lg" || s === "xl") ? s : "md";
});

function closeDrawer() {
  emit("update:show", false);
}

function handleGoToBookshelf() {
  uni.navigateTo({
    url: "/pages/bookshelf/index",
  });
}

function handleReadingProgressSwitch(e: any) {
  emit("change-reading-progress", Boolean(e.detail?.value));
}

const GITHUB_URL = "https://github.com/lanzm/HandyReader";

const FEEDBACK_ICON_SVG =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIxIDExLjVhOC4zOCA4LjM4IDAgMCAxLS45IDMuOCA4LjUgOC41IDAgMCAxLTcuNiA0LjcgOC4zOCA4LjM4IDAgMCAxLTMuOC0uOUwzIDIxbDEuOS01LjdhOC4zOCA4LjM4IDAgMCAxLS45LTMuOCA4LjUgOC41IDAgMCAxIDQuNy03LjYgOC4zOCA4LjM4IDAgMCAxIDMuOC0uOWguNWE4LjQ4IDguNDggMCAwIDEgOCA4di41eiIvPjxsaW5lIHgxPSIxMiIgeTE9IjgiIHgyPSIxMiIgeTI9IjEyIi8+PGxpbmUgeDE9IjEyIiB5MT0iMTYiIHgyPSIxMi4wMSIgeTI9IjE2Ii8+PC9zdmc+";

const GITHUB_ICON_SVG =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZmZmZiI+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMiAyQzYuNDc3IDIgMiA2LjQ4NCAyIDEyLjAxN2MwIDQuNDI1IDIuODY1IDguMTggNi44MzkgOS41MDQuNS4wOTIuNjgyLS4yMTcuNjgyLS40ODMgMC0uMjM3LS4wMDgtLjg2OC0uMDEzLTEuNzAzLTIuNzgyLjYwNS0zLjM2OS0xLjM0My0zLjM2OS0xLjM0My0uNDU0LTEuMTU4LTEuMTEtMS40NjYtMS4xMS0xLjQ2Ni0uOTA4LS42Mi4wNjktLjYwOC4wNjktLjYwOCAxLjAwMy4wNyAxLjUzIDEuMDMyIDEuNTMgMS4wMzIuODkyIDEuNTMgMi4zNDEgMS4wODggMi45MS44MzIuMDkyLS42NDcuMzUtMS4wODguNjM2LTEuMzM4LTIuMjItLjI1My00LjU1NS0xLjExMy00LjU1NS00Ljk1MSAwLTEuMDkzLjM5LTEuOTg4IDEuMDI5LTIuNjg4LS4xMDMtLjI1My0uNDQ2LTEuMjcyLjA5OC0yLjY1IDAgMCAuODQtLjI3IDIuNzUgMS4wMjZBOS41NjQgOS41NjQgMCAwMTEyIDYuODQ0Yy44NS4wMDQgMS43MDUuMTE1IDIuNTA0LjMzNyAxLjkwOS0xLjI5NiAyLjc0Ny0xLjAyNyAyLjc0Ny0xLjAyNy41NDYgMS4zNzkuMjAyIDIuMzk4LjEgMi42NTEuNjQuNyAxLjAyOCAxLjU5NSAxLjAyOCAyLjY4OCAwIDMuODQ4LTIuMzM5IDQuNjk1LTQuNTY2IDQuOTQzLjM1OS4zMDkuNjc4LjkyLjY3OCAxLjg1NSAwIDEuMzM4LS4wMTIgMi40MTktLjAxMiAyLjc0NyAwIC4yNjguMTguNTguNjg4LjQ4MkExMC4wMTkgMTAuMDE5IDAgMDAyMiAxMi4wMTdDMjIgNi40ODQgMTcuNTIyIDIgMTIgMnoiLz48L3N2Zz4=";

function handleCopyGithub() {
  uni.setClipboardData({
    data: GITHUB_URL,
    success: () => {
      uni.showToast({
        title: "已复制项目链接",
        icon: "none",
      });
    },
  });
}
</script>

<template>
  <view class="settings-drawer-wrapper" :class="[currentTheme]">
    <!-- Settings Drawer Overlay (对齐极简规范 ) -->
    <view
      class="drawer-overlay"
      :class="{ show: show }"
      @tap="closeDrawer"
      @touchmove.stop.prevent
    />

    <!-- Settings Drawer Panel (对齐极简规范 70vh 与安全区底边距) -->
    <view class="drawer-panel" :class="{ show: show }">
      <view class="flex flex-col w-full h-full overflow-hidden">
        <!-- 头部标题栏 -->
        <view class="drawer-header">
          <text class="drawer-title">阅读设置</text>
          <view
            class="drawer-close-btn cursor-pointer"
            hover-class="drawer-close-btn-hover"
            :hover-stay-time="100"
            @tap="closeDrawer"
          >
            <text class="drawer-close-icon">✕</text>
          </view>
        </view>

        <!-- 滚动内容区 -->
        <scroll-view scroll-y class="drawer-scroll-view flex-1 min-h-0 h-full" :show-scrollbar="false">
          <view class="pr-1 box-border w-full">
            <!-- 模块 1：当前在读书籍单卡 (方案 A：整卡可点，纯净极简单箭头，对齐极简规范 ) -->
            <view class="mb-4">
              <text class="section-label-style">当前在读篇目</text>

              <!-- 当前篇目高质感卡片 (封面 + 典雅信息 + 单箭头) -->
              <view
                class="current-story-card"
                hover-class="story-card-hover"
                :hover-start-time="0"
                :hover-stay-time="150"
                @tap="handleGoToBookshelf"
              >
                <view class="story-card-left">
                  <view class="cover-wrapper">
                    <BookCover :story="currentStory" size="sm" />
                  </view>
                  <view class="story-meta-box">
                    <text class="story-title truncate">{{ currentStory.title }}</text>
                    <text class="story-subtitle truncate">《{{ currentStory.titleZh }}》· {{ commonUtil.formatAuthorZh(currentStory.author) }}</text>
                    <view class="flex items-center gap-2 text-[11px] text-[var(--ej-text-muted)] mt-0.5">
                      <text class="font-medium" :style="{ color: getDifficultyColor(currentStory.difficulty) }">{{ currentStory.difficultyLabel.split('·')[0].trim() }}</text>
                      <text>·</text>
                      <text>{{ currentStory.wordCount }} 词</text>
                      <text>·</text>
                      <text>{{ currentProgressText }}</text>
                    </view>
                  </view>
                </view>
                <text class="card-arrow">›</text>
              </view>
            </view>

            <!-- 模块 2：译文展示 (方案 A · 默认折叠 vs 始终显示 · 准确直白零歧义) -->
            <view class="mb-4">
              <text class="section-label-style">译文展示</text>
              <view class="segmented-control">
                <view
                  class="theme-switch-option"
                  :class="{ active: !showAllTranslations }"
                  @tap="emit('change-all-translations', false)"
                >
                  <text class="text-sm font-medium">默认折叠</text>
                </view>
                <view
                  class="theme-switch-option"
                  :class="{ active: showAllTranslations }"
                  @tap="emit('change-all-translations', true)"
                >
                  <text class="text-sm font-medium">始终显示</text>
                </view>
              </view>
              <view class="mt-1.5 px-1 flex items-center">
                <text class="text-[11px] text-[var(--ej-text-muted)] leading-tight">
                  💡 {{ !showAllTranslations ? '默认折叠：专注纯英文阅读，需要时轻触“查看译文”展开' : '始终显示：每段直接呈现中文译文，中英对照高效速读' }}
                </text>
              </view>
            </view>

            <!-- 模块 3：色彩主题 (对齐极简规范 分段滑动药丸) -->
            <view class="mb-4">
              <text class="section-label-style">色彩主题</text>
              <view class="segmented-control">
                <view
                  class="theme-switch-option"
                  :class="{ active: currentTheme === 'light' }"
                  @tap="emit('change-theme', 'light')"
                >
                  <view class="flex items-center justify-center gap-1.5 h-full w-full">
                    <text class="theme-icon">☀️</text>
                    <text class="text-sm font-medium">浅色模式</text>
                  </view>
                </view>
                <view
                  class="theme-switch-option"
                  :class="{ active: currentTheme === 'dark' }"
                  @tap="emit('change-theme', 'dark')"
                >
                  <view class="flex items-center justify-center gap-1.5 h-full w-full">
                    <text class="theme-icon">🌙</text>
                    <text class="text-sm font-medium">深色模式</text>
                  </view>
                </view>
              </view>
            </view>

            <!-- 模块 4：正文字号 (4 段分段胶囊) -->
            <view class="mb-4">
              <text class="section-label-style">正文字号</text>
              <view class="segmented-control">
                <view
                  class="theme-switch-option"
                  :class="{ active: effectiveFontSize === 'sm' }"
                  @tap="emit('change-font-size', 'sm')"
                >
                  <text class="text-xs font-medium">小</text>
                </view>
                <view
                  class="theme-switch-option"
                  :class="{ active: effectiveFontSize === 'md' }"
                  @tap="emit('change-font-size', 'md')"
                >
                  <text class="text-sm font-medium">中</text>
                </view>
                <view
                  class="theme-switch-option"
                  :class="{ active: effectiveFontSize === 'lg' }"
                  @tap="emit('change-font-size', 'lg')"
                >
                  <text class="text-base font-medium">大</text>
                </view>
                <view
                  class="theme-switch-option"
                  :class="{ active: effectiveFontSize === 'xl' }"
                  @tap="emit('change-font-size', 'xl')"
                >
                  <text class="text-base font-semibold">特大</text>
                </view>
              </view>
              <view class="mt-1.5 px-1 flex items-center">
                <text class="text-[11px] text-[var(--ej-text-muted)] leading-tight">
                  💡 自由调节小说正文阅读排版字号
                </text>
              </view>
            </view>

            <!-- 模块 5：阅读辅助 (对齐极简规范 独立卡片与缩放 Switch) -->
            <view class="mb-4">
              <text class="section-label-style">阅读辅助</text>
              <view class="flex flex-col gap-2.5">
                <!-- 开关：阅读进度指示 (方案 A 控制开关) -->
                <view class="settings-row-card">
                  <view class="flex flex-col gap-0.5 min-w-0">
                    <text class="text-sm font-medium text-[var(--ej-text-primary)]">阅读进度指示</text>
                    <text class="text-[11px] text-[var(--ej-text-muted)] leading-tight">卡片底部显示段落序号、进度条及预计时间</text>
                  </view>
                  <switch
                    :checked="showReadingProgress !== false"
                    color="#2563EB"
                    class="settings-switch"
                    @change="handleReadingProgressSwitch"
                  />
                </view>
              </view>
            </view>

            <!-- 模块 6：支持与反馈 (对齐极简规范 官方反馈通道与开源仓库卡片) -->
            <view class="mb-4">
              <text class="section-label-style">支持与反馈</text>
              <view class="flex flex-col gap-2.5">
                <!-- 1. 微信官方反馈通道 (Native open-type="feedback") -->
                <button class="drawer-action-btn" open-type="feedback">
                  <view class="action-icon-box feedback-bg">
                    <image :src="FEEDBACK_ICON_SVG" class="action-svg-icon" mode="aspectFit" />
                  </view>
                  <view class="flex flex-col gap-0.5 flex-1 min-w-0">
                    <view class="flex items-center gap-1.5 flex-nowrap">
                      <text class="text-sm font-semibold text-[var(--ej-text-primary)] truncate">功能反馈与建议</text>
                      <text class="badge-tag feedback-tag">官方通道</text>
                    </view>
                    <text class="text-[11px] text-[var(--ej-text-muted)] truncate leading-tight">读本需求、文本勘误与体验建议</text>
                  </view>
                  <view class="action-pill feedback-pill">
                    <text class="text-[11px] font-semibold text-[#6366F1]">去反馈</text>
                  </view>
                </button>

                <!-- 2. GitHub 开源仓库卡片 (轻触复制地址) -->
                <view class="drawer-action-btn" @tap="handleCopyGithub">
                  <view class="action-icon-box github-bg">
                    <image :src="GITHUB_ICON_SVG" class="action-svg-icon" mode="aspectFit" />
                  </view>
                  <view class="flex flex-col gap-0.5 flex-1 min-w-0">
                    <view class="flex items-center gap-1.5 flex-nowrap">
                      <text class="text-sm font-semibold text-[var(--ej-text-primary)] truncate">开源项目地址</text>
                      <text class="badge-tag github-tag">CC 非商用</text>
                    </view>
                    <text class="text-[11px] text-[var(--ej-text-muted)] truncate leading-tight">github.com/lanzm/HandyReader</text>
                  </view>
                  <view class="action-pill github-pill">
                    <text class="text-[11px] font-semibold">复制链接</text>
                  </view>
                </view>
              </view>
            </view>

            <!-- 底部安全缓冲 (对齐极简规范 h-8) -->
            <view class="h-8 w-full shrink-0" />
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* 遮罩背景 (对齐极简规范 ) */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

.drawer-overlay.show {
  opacity: 1;
  pointer-events: auto;
}

/* 抽屉面板 (对齐极简规范 70vh, 20px 圆角与安全区底边距) */
.drawer-panel {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 70vh;
  background-color: var(--ej-bg-card);
  color: var(--ej-text-primary);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  z-index: 1001;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s, color 0.3s;
  box-sizing: border-box;
  padding: 20px 16px calc(16px + env(safe-area-inset-bottom)) 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-panel.show {
  transform: translateY(0);
}

/* 头部导航栏 (对齐极简规范 17px 紧凑标题与关闭按钮) */
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.drawer-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ej-text-primary);
}

.drawer-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ej-text-sub);
  background-color: transparent;
  transition: all 0.2s;
  box-sizing: border-box;
}

.drawer-close-btn-hover {
  background-color: var(--ej-border);
  opacity: 0.8;
}

.drawer-close-icon {
  font-size: 15px;
  line-height: 1;
}

/* 内容滚动区 (对齐极简规范 上下渐变淡化遮罩) */
.drawer-scroll-view {
  -webkit-mask-image: linear-gradient(to bottom, #000000 0%, #000000 calc(100% - 36px), rgba(0, 0, 0, 0.4) calc(100% - 14px), transparent 100%);
  mask-image: linear-gradient(to bottom, #000000 0%, #000000 calc(100% - 36px), rgba(0, 0, 0, 0.4) calc(100% - 14px), transparent 100%);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

/* 分组标题标签 (对齐极简规范 section-label-style: text-xs font-semibold tracking-wide mb-2 block) */
.section-label-style {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.025em;
  color: var(--ej-text-muted);
  margin-bottom: 8px;
  display: block;
}

/* 当前在读书籍大卡片 */
.current-story-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--ej-border);
  background-color: var(--ej-bg-sub);
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;
}

.story-card-hover {
  background-color: var(--ej-color-brand-subtle);
  border-color: var(--ej-color-brand);
}

.story-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.cover-wrapper {
  flex-shrink: 0;
}

.story-meta-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.story-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--ej-text-primary);
  line-height: 1.3;
}

.story-subtitle {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  color: var(--ej-text-muted);
  line-height: 1.3;
}

.reading-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: var(--ej-color-brand);
  color: #FFFFFF;
  line-height: 1.2;
  white-space: nowrap;
  flex-shrink: 0;
}

.card-arrow {
  font-size: 20px;
  line-height: 1;
  font-weight: 400;
  color: var(--ej-text-sub);
  margin-left: 8px;
  flex-shrink: 0;
  align-self: center;
}

/* 分段切换药丸 (方案 A：统一固定 42px 高度，100% 像素级对齐杜绝高低差) */
.segmented-control {
  display: flex;
  height: 42px;
  border-radius: 12px;
  border: 1px solid var(--ej-border);
  overflow: hidden;
  background-color: var(--ej-bg-sub);
  box-sizing: border-box;
}

.theme-switch-option {
  flex: 1;
  height: 100%;
  padding: 0;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  color: var(--ej-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-sizing: border-box;
}

.theme-switch-option.active {
  background-color: var(--ej-bg-card);
  color: var(--ej-color-brand);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.theme-icon {
  font-size: 14px;
}

/* 独立开关卡片 (对齐极简规范 settings-row-card 与 settings-switch) */
.settings-row-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--ej-border);
  background-color: var(--ej-bg-sub);
  transition: all 0.2s;
  box-sizing: border-box;
}

.settings-switch {
  transform: scale(0.8);
  transform-origin: right center;
  margin-right: -4px;
}

/* 操作项卡片按钮 (对齐极简规范 drawer-action-btn) */
.drawer-action-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  margin: 0;
  border-radius: 12px;
  border: 1px solid var(--ej-border);
  background-color: var(--ej-bg-sub);
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;
  font-size: inherit;
  text-align: left;
  line-height: inherit;
  color: inherit;
  outline: none;
  font-family: inherit;
}

.drawer-action-btn::after {
  border: none;
}

.drawer-action-btn:active {
  background-color: var(--ej-color-brand-subtle);
  border-color: var(--ej-color-brand);
}

.action-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-icon-box.feedback-bg {
  background-color: #6366F1;
}

.action-icon-box.github-bg {
  background-color: #24292F;
}

.action-svg-icon {
  width: 24px;
  height: 24px;
  display: block;
}

.badge-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.2;
}

.badge-tag.feedback-tag {
  background-color: rgba(99, 102, 241, 0.1);
  color: #6366F1;
}

.badge-tag.github-tag {
  background-color: rgba(36, 41, 47, 0.08);
  color: #24292F;
}

.settings-drawer-wrapper.dark .badge-tag.github-tag,
:deep(.dark) .badge-tag.github-tag {
  background-color: rgba(255, 255, 255, 0.1);
  color: #E2E8F0;
}

.action-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  flex-shrink: 0;
  align-self: center;
  box-sizing: border-box;
}

.action-pill.feedback-pill {
  background-color: rgba(99, 102, 241, 0.1);
}

.action-pill.github-pill {
  background-color: rgba(36, 41, 47, 0.08);
}

.action-pill.github-pill text {
  color: #24292F;
}

.settings-drawer-wrapper.dark .action-pill.github-pill,
:deep(.dark) .action-pill.github-pill {
  background-color: rgba(255, 255, 255, 0.1);
}

.settings-drawer-wrapper.dark .action-pill.github-pill text,
:deep(.dark) .action-pill.github-pill text {
  color: #E2E8F0;
}

.action-pill text {
  line-height: 1;
  display: block;
}
</style>
