import type { Story } from "@/types/reader";

// 自动扫描引入分级目录 (beginner/intermediate/advanced) 下所有的故事 JSON 文件 (Vite 原生支持)
const storyModules = import.meta.glob<Story>(
  ["../beginner/*.json", "../intermediate/*.json", "../advanced/*.json"],
  { eager: true }
);

export const storiesMap: Record<string, Story> = {};
export const storyTotalParagraphsMap: Record<string, number> = {};

for (const path in storyModules) {
  const mod = storyModules[path] as { default?: Story } | Story;
  const story = ((mod as { default?: Story })?.default ?? mod) as Story;
  if (story?.id) {
    storiesMap[story.id] = story;
    storyTotalParagraphsMap[story.id] = story.paragraphs?.length ?? 0;
  }
}
