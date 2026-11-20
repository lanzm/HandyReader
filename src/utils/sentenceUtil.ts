export interface SentenceItem {
  index: number;
  en: string;
  zh: string;
}

export function splitIntoSentences(enText: string, zhText: string): SentenceItem[] {
  if (!enText) return [];
  if (!zhText) {
    return [{ index: 0, en: enText, zh: "" }];
  }

  // 英文句切分，处理末尾标点
  const enSentences = enText.match(/[^.!?]+(?:[.!?]+['"”’]?|\s*$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [enText];
  // 中文句切分
  const zhSentences = zhText.match(/[^。！？]+(?:[。！？]+['"”’]?|\s*$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [zhText];

  // 修复英文常见缩写造成的误切
  const repairedEn: string[] = [];
  for (let i = 0; i < enSentences.length; i++) {
    const cur = enSentences[i];
    if (/^(Mr|Mrs|Ms|Dr|Prof|St)\.$/i.test(cur) || /^(Mr|Mrs|Ms|Dr|Prof|St)\.\s*$/i.test(cur)) {
      if (i + 1 < enSentences.length) {
        repairedEn.push(`${cur} ${enSentences[i + 1]}`);
        i++;
        continue;
      }
    }
    repairedEn.push(cur);
  }

  if (repairedEn.length === zhSentences.length) {
    return repairedEn.map((en, i) => ({ index: i, en, zh: zhSentences[i] }));
  }

  // 数量不同时的映射保护
  const result: SentenceItem[] = [];
  const ratio = repairedEn.length / zhSentences.length;
  for (let i = 0; i < repairedEn.length; i++) {
    const zhIdx = Math.min(zhSentences.length - 1, Math.floor(i / ratio));
    result.push({
      index: i,
      en: repairedEn[i],
      zh: zhSentences[zhIdx] ?? "",
    });
  }
  return result;
}

export default splitIntoSentences;
