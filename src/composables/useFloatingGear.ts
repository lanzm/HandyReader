import { ref, watch, onMounted, onUnmounted, nextTick, type Ref } from 'vue';
import commonUtil from '@/utils/commonUtil';

export function useFloatingGear(showDrawer: Ref<boolean>) {
  const gearX = ref(300);
  const gearY = ref(350);
  const lastDragX = ref(300);
  const lastDragY = ref(350);
  const gearReady = ref(false);
  const isHiding = ref(true);
  const dockSide = ref<'left' | 'right'>('right');
  let gearIntroTimer: ReturnType<typeof setTimeout> | null = null;

  const GEAR_WIDTH = 50;
  const VISIBLE_GAP = 16;

  let cachedScreenWidth = 0;
  let cachedScreenHeight = 0;
  let cachedStatusBarHeight = 44;

  const getScreenDimensions = () => {
    if (cachedScreenWidth > 0) {
      return {
        screenWidth: cachedScreenWidth,
        screenHeight: cachedScreenHeight,
        statusBarHeight: cachedStatusBarHeight,
      };
    }
    const win = commonUtil.getWindowDimensions();
    cachedScreenWidth = win.windowWidth;
    cachedScreenHeight = win.windowHeight;
    cachedStatusBarHeight = win.statusBarHeight;
    return {
      screenWidth: cachedScreenWidth,
      screenHeight: cachedScreenHeight,
      statusBarHeight: cachedStatusBarHeight,
    };
  };

  const startAutoHideTimer = (delay = 1500) => {
    if (gearIntroTimer) {
      clearTimeout(gearIntroTimer);
      gearIntroTimer = null;
    }
    gearIntroTimer = setTimeout(() => {
      if (!showDrawer.value) {
        dockGear();
      }
      gearIntroTimer = null;
    }, delay);
  };

  const wakeUpGear = () => {
    if (gearIntroTimer) {
      clearTimeout(gearIntroTimer);
      gearIntroTimer = null;
    }
    try {
      const { screenWidth } = getScreenDimensions();
      if (dockSide.value === 'left') {
        gearX.value = VISIBLE_GAP;
        lastDragX.value = VISIBLE_GAP;
      } else {
        const visibleX = Math.max(screenWidth - GEAR_WIDTH - VISIBLE_GAP, 0);
        gearX.value = visibleX;
        lastDragX.value = visibleX;
      }
      isHiding.value = false;
    } catch {
      isHiding.value = false;
    }
  };

  const dockGear = () => {
    try {
      const { screenWidth } = getScreenDimensions();
      if (dockSide.value === 'left') {
        gearX.value = 0;
        lastDragX.value = 0;
      } else {
        const dockedX = screenWidth - GEAR_WIDTH;
        gearX.value = dockedX;
        lastDragX.value = dockedX;
      }
      isHiding.value = true;
    } catch {
      isHiding.value = true;
    }
  };

  const onGearChange = (e: any) => {
    if (e.detail?.source === 'touch') {
      lastDragX.value = e.detail.x;
      lastDragY.value = e.detail.y;
      isHiding.value = false;
    }
  };

  const onGearTouchStart = () => {
    if (gearIntroTimer) {
      clearTimeout(gearIntroTimer);
      gearIntroTimer = null;
    }
    isHiding.value = false;
  };

  const onGearTouchEnd = () => {
    try {
      const { screenWidth, screenHeight, statusBarHeight } = getScreenDimensions();
      const centerX = (screenWidth - GEAR_WIDTH) / 2;

      if (lastDragX.value < centerX) {
        dockSide.value = 'left';
        gearX.value = VISIBLE_GAP;
        lastDragX.value = VISIBLE_GAP;
      } else {
        dockSide.value = 'right';
        const visibleX = Math.max(screenWidth - GEAR_WIDTH - VISIBLE_GAP, 0);
        gearX.value = visibleX;
        lastDragX.value = visibleX;
      }

      const minY = Math.max(statusBarHeight + 10, 50);
      const maxY = Math.max(minY, screenHeight - 100);
      const clampedY = Math.min(Math.max(lastDragY.value, minY), maxY);

      gearY.value = clampedY;
      lastDragY.value = clampedY;
      isHiding.value = false;

      startAutoHideTimer(1500);
    } catch (e) {
      console.error(e);
    }
  };

  const initGearPosition = () => {
    gearReady.value = false;
    if (gearIntroTimer) {
      clearTimeout(gearIntroTimer);
      gearIntroTimer = null;
    }
    try {
      const { screenWidth, screenHeight, statusBarHeight } = getScreenDimensions();
      const visibleX = Math.max(screenWidth - GEAR_WIDTH - VISIBLE_GAP, 0);
      const initialY = Math.min(Math.max(screenHeight * 0.4, statusBarHeight + 20), screenHeight - 100);

      dockSide.value = 'right';
      gearX.value = visibleX;
      gearY.value = initialY;
      lastDragX.value = visibleX;
      lastDragY.value = initialY;
      isHiding.value = false;

      startAutoHideTimer(1400);
    } catch (e) {
      gearX.value = 350;
      gearY.value = 300;
      isHiding.value = false;
    }
    nextTick(() => {
      gearReady.value = true;
    });
  };

  watch(showDrawer, (isOpen) => {
    if (isOpen) {
      wakeUpGear();
    } else {
      startAutoHideTimer(1500);
    }
  });

  onMounted(() => {
    initGearPosition();
  });

  onUnmounted(() => {
    if (gearIntroTimer) {
      clearTimeout(gearIntroTimer);
      gearIntroTimer = null;
    }
  });

  return {
    gearX,
    gearY,
    gearReady,
    isHiding,
    dockSide,
    onGearChange,
    onGearTouchStart,
    onGearTouchEnd,
    wakeUpGear,
    initGearPosition,
  };
}
