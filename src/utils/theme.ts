import { ref } from "vue";
import type { ThemeMode, FontSizeLevel } from "@/types/reader";

const THEME_STORAGE_KEY = "handy_reader_theme";
const FONT_STORAGE_KEY = "handy_reader_font_size";

export const getInitialTheme = (): ThemeMode => {
  try {
    const saved = uni.getStorageSync(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") {
      return saved;
    }
    const appBase = typeof (uni as any).getAppBaseInfo === "function" ? (uni as any).getAppBaseInfo() : null;
    const systemTheme = appBase?.theme ?? uni.getSystemInfoSync?.()?.theme;
    return systemTheme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

export const getInitialFontSize = (): FontSizeLevel => {
  try {
    const saved = uni.getStorageSync(FONT_STORAGE_KEY);
    if (saved === "sm" || saved === "md" || saved === "lg" || saved === "xl") {
      return saved;
    }
  } catch {}
  return "md";
};

export const currentTheme = ref<ThemeMode>(getInitialTheme());

export const currentFontSize = ref<FontSizeLevel>(getInitialFontSize());

export function setNavigationBarTheme(theme: ThemeMode): void {
  try {
    if (theme === "dark") {
      uni.setNavigationBarColor({
        frontColor: "#ffffff",
        backgroundColor: "#09090B",
        animation: { duration: 200, timingFunc: "linear" },
      });
    } else {
      uni.setNavigationBarColor({
        frontColor: "#000000",
        backgroundColor: "#E9EEF4",
        animation: { duration: 200, timingFunc: "linear" },
      });
    }
  } catch (error) {
    console.error("Failed to set navigation bar color:", error);
  }
}

export function setTheme(theme: ThemeMode): void {
  currentTheme.value = theme;
  setNavigationBarTheme(theme);
  try {
    uni.setStorageSync(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.error("Failed to save theme:", error);
  }
}

export function setFontSize(size: FontSizeLevel): void {
  currentFontSize.value = size;
  try {
    uni.setStorageSync(FONT_STORAGE_KEY, size);
  } catch (error) {
    console.error("Failed to save font size:", error);
  }
}

/**
 * 全局统一难度等级三色体系（经典交通灯递进）
 * - 入门级 (Beginner): 翡翠绿 (#10B981)
 * - 进阶级 (Intermediate): 琥珀黄 (#F59E0B)
 * - 挑战级 (Advanced): 玫瑰红 (#F43F5E)
 */
export const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "#10B981",
  intermediate: "#F59E0B",
  advanced: "#F43F5E",
};

export function getDifficultyColor(diff?: string): string {
  if (!diff) return "#10B981";
  return DIFFICULTY_COLORS[diff] || "#10B981";
}
