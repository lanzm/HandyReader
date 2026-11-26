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
  },
  /**
   * 获取离线分享卡片封面路径
   * 解决微信开发者工具模拟器及部分微信版本无法解析代码包相对路径导致裂图的问题
   */
  getShareCoverPath(): string {
    // #ifdef MP-WEIXIN
    try {
      if (typeof wx !== 'undefined' && wx.getFileSystemManager && wx.env && wx.env.USER_DATA_PATH) {
        const fs = wx.getFileSystemManager();
        const targetPath = `${wx.env.USER_DATA_PATH}/handyreader_share_cover_v1.jpg`;
        let existingSize = -1;
        try {
          const stat = fs.statSync(targetPath);
          existingSize = stat?.size ?? -1;
        } catch {
          existingSize = -1;
        }

        const candidatePaths = ['static/share-cover.jpg', '/static/share-cover.jpg'];
        for (const p of candidatePaths) {
          try {
            const buf = fs.readFileSync(p);
            if (buf) {
              if (existingSize !== buf.byteLength) {
                fs.writeFileSync(targetPath, buf);
              }
              return targetPath;
            }
          } catch {
            // try next
          }
        }

        if (existingSize > 0) {
          return targetPath;
        }
      }
    } catch (e) {
      console.warn('[commonUtil] getShareCoverPath fail:', e);
    }
    // #endif
    return '/static/share-cover.jpg';
  }
};

export default commonUtil;
