export interface KeyWord {
  word: string;
  phonetic?: string;
  meaning: string;
}

export interface Paragraph {
  index: number;
  en: string;
  zh: string;
  keyWords?: KeyWord[];
  isChapterHeader?: boolean;
  isBookCover?: boolean;
  titleEn?: string;
  titleZh?: string;
  author?: string;
  tagline?: string;
  chapterNum?: string;
  chapterTitleEn?: string;
  chapterTitleZh?: string;
}

export interface Story {
  id: string;
  title: string;
  titleZh?: string;
  author: string;
  coverEmoji?: string;
  coverBg?: string;
  coverAccent?: string;
  coverBorder?: string;
  tagline?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  difficultyLabel: string;
  difficultyColor?: string;
  wordCount: number;
  estimatedMinutes: number;
  summary: string;
  hasFullText?: boolean;
  paragraphs: Paragraph[];
}

export interface CatalogItem {
  id: string;
  title: string;
  titleZh: string;
  author: string;
  coverEmoji?: string;
  coverBg?: string;
  coverAccent?: string;
  coverBorder?: string;
  tagline?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  difficultyLabel: string;
  difficultyColor?: string;
  wordCount: number;
  estimatedMinutes: number;
  summary: string;
  hasFullText: boolean;
}

export type ThemeMode = "light" | "dark";
export type FontSizeLevel = "sm" | "md" | "lg" | "xl";

export interface ReaderSettings {
  theme: ThemeMode;
  fontSize: FontSizeLevel;
  autoPronounce: boolean;
}
