export const commonUtil = {
  getWindowDimensions() {
    try {
      if (typeof (uni as any).getWindowInfo === 'function') {
        const win = (uni as any).getWindowInfo();
        if (win?.windowWidth) {
          return {
            windowWidth: win.windowWidth,
            windowHeight: win.windowHeight,
            statusBarHeight: win.statusBarHeight ?? 44,
          };
        }
      }
      const sys = uni.getSystemInfoSync();
      return {
        windowWidth: sys.windowWidth,
        windowHeight: sys.windowHeight,
        statusBarHeight: sys.statusBarHeight ?? 44,
      };
    } catch {
      return {
        windowWidth: 375,
        windowHeight: 800,
        statusBarHeight: 44,
      };
    }
  },
  vibrateCardSwitch() {
    try {
      // #ifdef MP-WEIXIN
      uni.vibrateShort({
        type: 'medium',
        fail: () => {
          try {
            uni.vibrateShort({});
          } catch {
            // ignore
          }
        }
      });
      // #endif
      // #ifndef MP-WEIXIN
      uni.vibrateShort({});
      // #endif
    } catch {
      // ignore
    }
  },
  msg(title: string, icon: 'none' | 'success' | 'loading' | 'error' = "none", duration = 2000) {
    uni.showToast({
      title,
      icon,
      duration,
    });
  },
  /**
   * 提取精简中文作者名（如 "Hans Christian Andersen (安徒生)" -> "安徒生"）
   * 适配括号中英文混排，避免长作者名撑破单行布局
   */
  formatAuthorZh(raw?: string): string {
    if (!raw) return "";
    const match = raw.match(/[(（](.*?)[)）]/);
    if (match?.[1]) {
      return match[1].trim();
    }
    return raw;
  }
};

export default commonUtil;
