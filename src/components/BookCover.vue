<script setup lang="ts">
import { computed } from "vue";

interface StoryCoverData {
  id?: string;
  title: string;
  titleZh?: string;
  author: string;
  coverBg?: string;
  coverAccent?: string;
  coverBorder?: string;
  tagline?: string;
}

interface Props {
  story: StoryCoverData;
  size?: "sm" | "md" | "lg";
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: "md",
  active: false,
});

const backgroundStyle = computed(() => {
  return props.story.coverBg ?? "linear-gradient(145deg, #1E293B 0%, #0F172A 100%)";
});

const accentColor = computed(() => {
  return props.story.coverAccent ?? "#FDE68A";
});

// 提取作者简短英文名
const shortAuthor = computed(() => {
  const raw = props.story.author ?? "";
  return raw.split("(")[0].trim();
});

// 方案 A：动态计算字号与排版样式，防止长单词冲破封面边框
const dynamicTitleStyle = computed(() => {
  const title = props.story.title ?? "";
  const words = title.split(/[\s-]+/).filter(Boolean);
  const maxWordLen = Math.max(...words.map((w) => w.length), 0);
  const totalLen = title.length;

  let fontSize = "9px";
  let letterSpacing = "0.5px";
  let lineClamp = 3;
  let lineHeight = 1.18;

  if (props.size === "lg") {
    if (maxWordLen >= 13 || totalLen >= 36) {
      fontSize = "6.8px";
      letterSpacing = "0px";
      lineClamp = 4;
      lineHeight = 1.15;
    } else if (maxWordLen >= 10 || totalLen >= 26) {
      fontSize = "7.5px";
      letterSpacing = "0.2px";
      lineClamp = 4;
      lineHeight = 1.15;
    } else if (maxWordLen >= 8 || totalLen >= 18) {
      fontSize = "8.5px";
      letterSpacing = "0.3px";
      lineClamp = 4;
      lineHeight = 1.18;
    } else {
      fontSize = "10.5px";
      letterSpacing = "0.5px";
      lineClamp = 3;
      lineHeight = 1.22;
    }
  } else if (props.size === "md") {
    if (maxWordLen >= 13 || totalLen >= 36) {
      fontSize = "5.8px";
      letterSpacing = "0px";
      lineClamp = 4;
      lineHeight = 1.12;
    } else if (maxWordLen >= 10 || totalLen >= 26) {
      fontSize = "6.5px";
      letterSpacing = "0.1px";
      lineClamp = 4;
      lineHeight = 1.12;
    } else if (maxWordLen >= 8 || totalLen >= 18) {
      fontSize = "7.5px";
      letterSpacing = "0.2px";
      lineClamp = 3;
      lineHeight = 1.15;
    } else {
      fontSize = "9px";
      letterSpacing = "0.4px";
      lineClamp = 3;
      lineHeight = 1.2;
    }
  } else {
    // sm (42px)
    if (maxWordLen >= 11 || totalLen >= 28) {
      fontSize = "4.8px";
      letterSpacing = "0px";
      lineClamp = 4;
      lineHeight = 1.1;
    } else if (maxWordLen >= 8 || totalLen >= 20) {
      fontSize = "5.6px";
      letterSpacing = "0.1px";
      lineClamp = 3;
      lineHeight = 1.12;
    } else {
      fontSize = "6.5px";
      letterSpacing = "0.3px";
      lineClamp = 3;
      lineHeight = 1.15;
    }
  }

  return {
    fontSize,
    letterSpacing,
    lineHeight,
    WebkitLineClamp: lineClamp,
  };
});
</script>

<template>
  <view
    class="book-cover-container"
    :class="[`cover-size-${size}`, { 'is-active-cover': active }]"
    :style="{ background: backgroundStyle }"
  >
    <!-- 左侧书脊自然立体折痕与光影 -->
    <view class="book-spine" />

    <!-- 内嵌古典烫金装饰细框 -->
    <view class="book-inner-border" :style="{ borderColor: accentColor }">
      <!-- 封面头部藏书微标 -->
      <view class="cover-header">
        <text class="cover-series-mark" :style="{ color: accentColor }">CLASSIC NOVEL</text>
      </view>

      <!-- 封面核心英文书名 (应用动态自适应字号) -->
      <view class="cover-center">
        <text
          class="cover-title-en"
          :style="[
            { color: accentColor },
            dynamicTitleStyle
          ]"
        >
          {{ story.title }}
        </text>
      </view>

      <!-- 封面底部作者名 -->
      <view class="cover-footer">
        <text class="cover-author">
          {{ shortAuthor }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.book-cover-container {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  box-sizing: border-box;
  flex-shrink: 0;
  user-select: none;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
  box-shadow: 2px 4px 12px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.15);
}

.is-active-cover {
  outline: 2px solid var(--ej-color-brand);
  outline-offset: 1px;
}

/* 左侧书脊自然立体折痕与光影 */
.book-spine {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.45) 0%,
    rgba(255, 255, 255, 0.22) 35%,
    rgba(0, 0, 0, 0.25) 70%,
    transparent 100%
  );
  z-index: 2;
  pointer-events: none;
}

/* 内嵌古典装饰细边线框 */
.book-inner-border {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.28);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  text-align: center;
  z-index: 1;
  overflow: hidden;
}

.cover-header {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.cover-series-mark {
  letter-spacing: 0.8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  opacity: 0.75;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1;
}

.cover-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0 3px;
  box-sizing: border-box;
  overflow: hidden;
}

.cover-title-en {
  font-family: Georgia, "Times New Roman", Garamond, serif;
  font-weight: 700;
  text-transform: uppercase;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  word-break: break-word;
  overflow-wrap: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: center;
  width: 100%;
}

.cover-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.cover-author {
  font-family: Georgia, "Times New Roman", serif;
  font-style: italic;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90%;
}

/* ================= 尺寸规格 ================= */

/* 小型 (42px × 58px) - 适用于抽屉/紧凑卡片列表，精致适中，强约束防变形 */
.cover-size-sm {
  width: 42px;
  min-width: 42px;
  max-width: 42px;
  height: 58px;
  min-height: 58px;
  max-height: 58px;
  border-radius: 4px;
}
.cover-size-sm .book-spine {
  width: 5px;
}
.cover-size-sm .book-inner-border {
  top: 3px;
  bottom: 3px;
  left: 6px;
  right: 3px;
  padding: 2px 1px;
}
.cover-size-sm .cover-series-mark {
  font-size: 5px;
  transform: scale(0.7);
}
.cover-size-sm .cover-author {
  font-size: 5.5px;
  transform: scale(0.85);
}

/* 中型 (68px × 96px) - 适用于书架列表卡片/抽屉篇目/作品详情，强约束防变形 */
.cover-size-md {
  width: 68px;
  min-width: 68px;
  max-width: 68px;
  height: 96px;
  min-height: 96px;
  max-height: 96px;
  border-radius: 6px;
}
.cover-size-md .book-spine {
  width: 8px;
}
.cover-size-md .book-inner-border {
  top: 5px;
  bottom: 5px;
  left: 10px;
  right: 5px;
  padding: 4px 2px;
}
.cover-size-md .cover-series-mark {
  font-size: 6px;
  transform: scale(0.8);
}
.cover-size-md .cover-author {
  font-size: 7px;
}

/* 大型 (96px × 136px) - 适用于书架主推网格/巨幅海报卡片，强约束防变形 */
.cover-size-lg {
  width: 96px;
  min-width: 96px;
  max-width: 96px;
  height: 136px;
  min-height: 136px;
  max-height: 136px;
  border-radius: 6px;
}
.cover-size-lg .book-spine {
  width: 10px;
}
.cover-size-lg .book-inner-border {
  top: 6px;
  bottom: 6px;
  left: 13px;
  right: 6px;
  padding: 6px 3px;
}
.cover-size-lg .cover-series-mark {
  font-size: 6.5px;
}
.cover-size-lg .cover-author {
  font-size: 8px;
}
</style>
