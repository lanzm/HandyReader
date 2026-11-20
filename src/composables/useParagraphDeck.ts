import { ref, computed, nextTick, onUnmounted } from "vue";
import type { Story, Paragraph } from "@/types/reader";
import commonUtil from "@/utils/commonUtil";
import { getStoryProgress, saveStoryProgress, resetStoryProgress } from "@/utils/readingProgress";

export function useParagraphDeck(storyRef: { value: Story }) {
  // 从本地持久化缓存中恢复历史阅读进度
  const initialProg = getStoryProgress(storyRef.value.id);
  const totalCount = storyRef.value.paragraphs?.length ?? 0;
  const initialIdx = (initialProg.index >= 0 && initialProg.index < totalCount) ? initialProg.index : 0;

  const currentIndex = ref(initialIdx);
  const isRevealed = ref(false);
  const isRevealing = ref(false);
  const isFinished = ref(initialProg.finished === true && totalCount > 0);
  const readCount = ref(initialProg.readCount ?? (initialProg.finished ? 1 : 0));

  // 屏幕高度获取
  const screenHeight = ref(commonUtil.getWindowDimensions().windowHeight);

  // 堆叠卡片动效与手势
  const isTransitioning = ref(false);
  const cardTransitionClass = ref("");
  const bgCardTransitionClass = ref("");
  const isSwiping = ref(false);
  const isSwipingDownActive = ref(false);
  const preventClick = ref(false);

  const startY = ref(0);
  const startX = ref(0);
  const cardY = ref(0);
  const detailScrollTop = ref(0);
  const scrollTop = ref(0);

  let transitionTimer: ReturnType<typeof setTimeout> | null = null;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const totalParagraphs = computed(() => storyRef.value.paragraphs?.length ?? 0);

  const getParagraphAt = (idx: number): Paragraph | null => {
    const list = storyRef.value.paragraphs ?? [];
    if (idx >= 0 && idx < list.length) {
      return list[idx];
    }
    return null;
  };

  const currentParagraph = computed<Paragraph | null>(() => getParagraphAt(currentIndex.value));

  // 底层堆叠卡片内容 (向上滑时为下一段，向下滑时为上一段)
  const bgParagraph = ref<Paragraph | null>(null);

  // 底层是否呈现“完读成就卡”（当处于全书最后一段且未完成时，作为第 N+1 张物理卡片在底层候场）
  const isBgFinished = computed(() => {
    return (
      !isFinished.value &&
      currentIndex.value >= totalParagraphs.value - 1 &&
      !isSwipingDownActive.value
    );
  });

  const syncBgCard = () => {
    if (isSwipingDownActive.value) return;
    if (isFinished.value) {
      bgParagraph.value = null;
      return;
    }
    bgParagraph.value = getParagraphAt(currentIndex.value + 1);
  };

  // 动态内联变换样式 (100% 对齐 EnglishJoy useCardSwipe 物理交互)
  const cardStyle = computed(() => {
    if (isSwiping.value) {
      if (cardY.value < 0) {
        // 向上拖拽
        return `transform: translate3d(0, ${cardY.value}px, 0); z-index: 10; transition: none !important;`;
      } else {
        // 向下拖拽
        if (isSwipingDownActive.value) {
          const progress = Math.min(cardY.value / 80, 1);
          const scale = 1.0 - progress * 0.06;
          const translateY = progress * 18;
          const opacity = 1.0 - progress * 0.12;
          return `transform: scale(${scale}) translate3d(0, ${translateY}px, 0); opacity: ${opacity}; z-index: 5; transition: none !important;`;
        } else {
          return `transform: translate3d(0, 0, 0); z-index: 10; transition: none !important;`;
        }
      }
    }
    return "z-index: 10;";
  });

  const bgCardStyle = computed(() => {
    if (isSwiping.value) {
      const threshold = 80;
      if (cardY.value < 0) {
        // 向上拖拽激活底层卡片逐渐放大复位
        const progress = Math.min(Math.abs(cardY.value) / threshold, 1);
        const scale = 0.88 + progress * 0.12;
        const translateY = 32 - progress * 32;
        const opacity = 0.7 + progress * 0.3;
        return `transform: scale(${scale}) translate3d(0, ${translateY}px, 0); opacity: ${opacity}; z-index: 5; transition: none !important;`;
      } else {
        // 向下拖拽激活上一张卡片从顶部落下
        if (isSwipingDownActive.value) {
          const translateY = -screenHeight.value + cardY.value;
          return `transform: translate3d(0, ${translateY}px, 0); opacity: 1; z-index: 10; transition: none !important;`;
        }
      }
    }
    return "";
  });

  function clearTimers() {
    if (transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
  }

  const resetCardScrollTop = () => {
    scrollTop.value = detailScrollTop.value || 1;
    nextTick(() => {
      scrollTop.value = 0;
      detailScrollTop.value = 0;
    });
  };

  // 方向性切段状态机 (100% 对齐 EnglishJoy useWordDeck)
  function nextParagraphDirectional(dir: "up" | "down") {
    if (isTransitioning.value) return;

    if (dir === "down") {
      if (currentIndex.value <= 0) {
        commonUtil.msg("已经是第一段了");
        return;
      }
      isRevealed.value = false;
      isRevealing.value = false;
      commonUtil.vibrateCardSwitch();
      isSwipingDownActive.value = true;
      bgParagraph.value = getParagraphAt(currentIndex.value - 1);

      isTransitioning.value = true;
      clearTimers();

      cardTransitionClass.value = "active-card-to-back-instant";
      bgCardTransitionClass.value = "prev-card-to-active-instant";

      transitionTimer = setTimeout(() => {
        currentIndex.value -= 1;
        isRevealed.value = false;
        isRevealing.value = false;
        resetCardScrollTop();
        saveStoryProgress(storyRef.value.id, currentIndex.value, false);

        cardTransitionClass.value = "card-reset-center";
        bgCardTransitionClass.value = "bg-card-reset-back";
        isSwipingDownActive.value = false;
        cardY.value = 0;

        resetTimer = setTimeout(() => {
          cardTransitionClass.value = "";
          bgCardTransitionClass.value = "";
          isTransitioning.value = false;
          syncBgCard();
        }, 30);
      }, 200);
    } else {
      // 向上切换下一段
      if (currentIndex.value >= totalParagraphs.value - 1) {
        if (isFinished.value) return; // 完读后禁止再上滑

        // 像翻出第 N+1 张卡片一样，执行标准物理滑出动效！
        isRevealed.value = false;
        isRevealing.value = false;
        commonUtil.vibrateCardSwitch();
        isSwipingDownActive.value = false;

        isTransitioning.value = true;
        clearTimers();

        cardTransitionClass.value = "card-slide-out-up";
        bgCardTransitionClass.value = "bg-card-to-active";

        transitionTimer = setTimeout(() => {
          readCount.value += 1;
          isFinished.value = true;
          isRevealed.value = false;
          isRevealing.value = false;
          resetCardScrollTop();
          saveStoryProgress(storyRef.value.id, currentIndex.value, true);

          cardTransitionClass.value = "card-reset-center";
          bgCardTransitionClass.value = "bg-card-to-back-instant";

          resetTimer = setTimeout(() => {
            cardTransitionClass.value = "";
            bgCardTransitionClass.value = "";
            isTransitioning.value = false;
            cardY.value = 0;
            syncBgCard();
          }, 30);
        }, 200);
        return;
      }

      isRevealed.value = false;
      isRevealing.value = false;
      commonUtil.vibrateCardSwitch();
      isSwipingDownActive.value = false;
      bgParagraph.value = getParagraphAt(currentIndex.value + 1);

      isTransitioning.value = true;
      clearTimers();

      cardTransitionClass.value = "card-slide-out-up";
      bgCardTransitionClass.value = "bg-card-to-active";

      transitionTimer = setTimeout(() => {
        currentIndex.value += 1;
        isRevealed.value = false;
        isRevealing.value = false;
        resetCardScrollTop();
        saveStoryProgress(storyRef.value.id, currentIndex.value, false);

        cardTransitionClass.value = "card-reset-center";
        bgCardTransitionClass.value = "bg-card-to-back-instant";

        resetTimer = setTimeout(() => {
          cardTransitionClass.value = "";
          bgCardTransitionClass.value = "";
          isTransitioning.value = false;
          cardY.value = 0;
          syncBgCard();
        }, 30);
      }, 200);
    }
  }

  function nextParagraph() {
    nextParagraphDirectional("up");
  }

  function prevParagraph() {
    nextParagraphDirectional("down");
  }

  function toggleTranslation() {
    if (preventClick.value) return;
    isRevealing.value = true;
    isRevealed.value = !isRevealed.value;
  }

  function resetStory(forceZero = false) {
    if (forceZero) {
      currentIndex.value = 0;
      isFinished.value = false;
      resetStoryProgress(storyRef.value.id);
      const saved = getStoryProgress(storyRef.value.id);
      readCount.value = saved.readCount ?? 0;
    } else {
      // 载入当前书籍所存储的历史进度
      const saved = getStoryProgress(storyRef.value.id);
      readCount.value = saved.readCount ?? 0;
      const total = storyRef.value.paragraphs?.length ?? 0;
      if (saved.finished) {
        currentIndex.value = Math.max(0, total - 1);
        isFinished.value = true;
      } else if (saved.index >= 0 && saved.index < total) {
        currentIndex.value = saved.index;
        isFinished.value = false;
      } else {
        currentIndex.value = 0;
        isFinished.value = false;
      }
    }
    isRevealed.value = false;
    isRevealing.value = false;
    resetCardScrollTop();
    syncBgCard();
  }

  function returnFromFinished() {
    if (isTransitioning.value) return;
    isRevealed.value = false;
    isRevealing.value = false;
    commonUtil.vibrateCardSwitch();
    isSwipingDownActive.value = true;
    bgParagraph.value = getParagraphAt(currentIndex.value);

    isTransitioning.value = true;
    clearTimers();

    cardTransitionClass.value = "active-card-to-back-instant";
    bgCardTransitionClass.value = "prev-card-to-active-instant";

    transitionTimer = setTimeout(() => {
      isFinished.value = false;
      isRevealed.value = false;
      isRevealing.value = false;
      resetCardScrollTop();
      saveStoryProgress(storyRef.value.id, currentIndex.value, false);

      cardTransitionClass.value = "card-reset-center";
      bgCardTransitionClass.value = "bg-card-reset-back";
      isSwipingDownActive.value = false;
      cardY.value = 0;

      resetTimer = setTimeout(() => {
        cardTransitionClass.value = "";
        bgCardTransitionClass.value = "";
        isTransitioning.value = false;
        syncBgCard();
      }, 30);
    }, 200);
  }

  // 触控手势监听 (支持内容滚动与卡片翻转平滑解耦；完读页支持下滑返回上一页，禁止上滑)
  function onCardTouchStart(e: TouchEvent) {
    if (isTransitioning.value) return;
    preventClick.value = false;
    if (e.touches && e.touches[0]) {
      startX.value = e.touches[0].clientX;
      startY.value = e.touches[0].clientY;
      cardY.value = 0;
      isSwiping.value = false;
      isSwipingDownActive.value = false;
    }
  }

  function onCardTouchMove(e: TouchEvent) {
    if (isTransitioning.value || !e.touches || !e.touches[0]) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startX.value;
    const deltaY = currentY - startY.value;

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      preventClick.value = true;
    }

    if (!isSwiping.value) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        if (deltaY < 0) {
          // 向上滑切下一段：若已是完读状态，绝对禁止往上滑动！
          if (isFinished.value) {
            return;
          }
          isSwiping.value = true;
          isSwipingDownActive.value = false;
          syncBgCard();
        } else if (deltaY > 0) {
          // 向下滑切上一段：完读页允许向下滑动翻回全篇末尾段落
          if (isFinished.value) {
            isSwiping.value = true;
            isSwipingDownActive.value = true;
            bgParagraph.value = getParagraphAt(currentIndex.value);
          } else if (detailScrollTop.value <= 5) {
            if (currentIndex.value > 0) {
              isSwiping.value = true;
              isSwipingDownActive.value = true;
              bgParagraph.value = getParagraphAt(currentIndex.value - 1);
            } else {
              isSwiping.value = false;
              commonUtil.msg("已经是第一段了");
            }
          }
        }
      }
    }

    if (isSwiping.value) {
      // 完读状态下只允许向下位移，忽略上滑
      if (isFinished.value && deltaY < 0) {
        cardY.value = 0;
      } else {
        cardY.value = deltaY;
      }
    }
  }

  function onCardTouchEnd() {
    if (!isSwiping.value) {
      isSwiping.value = false;
      isSwipingDownActive.value = false;
      return;
    }

    const threshold = 80;
    if (cardY.value < -threshold) {
      isSwiping.value = false;
      if (!isFinished.value) {
        nextParagraphDirectional("up");
      }
    } else if (cardY.value > threshold && isSwipingDownActive.value) {
      isSwiping.value = false;
      if (isFinished.value) {
        returnFromFinished();
      } else {
        nextParagraphDirectional("down");
      }
    } else {
      isSwiping.value = false;
      if (isSwipingDownActive.value) {
        cardTransitionClass.value = "";
        bgCardTransitionClass.value = "";
        isSwipingDownActive.value = false;
        cardY.value = 0;
        syncBgCard();
      } else {
        cardY.value = 0;
      }
    }
  }

  function onDetailScroll(e: any) {
    detailScrollTop.value = e.detail?.scrollTop ?? 0;
  }

  onUnmounted(() => {
    clearTimers();
  });

  // 初始化预加载下一张底层卡片
  syncBgCard();

  return {
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
    syncBgCard,
  };
}
