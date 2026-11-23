import phrasesData from "../data/phrases.json";

// 高频动词屈折变形与不规则动词原型映射
const IRREGULAR_VERBS: Record<string, string> = {
  am: "be",
  is: "be",
  are: "be",
  was: "be",
  were: "be",
  been: "be",
  being: "be",
  has: "have",
  had: "have",
  having: "have",
  does: "do",
  did: "do",
  done: "do",
  doing: "do",
  went: "go",
  gone: "go",
  going: "go",
  goes: "go",
  made: "make",
  making: "make",
  makes: "make",
  took: "take",
  taken: "take",
  taking: "take",
  takes: "take",
  came: "come",
  coming: "come",
  comes: "come",
  saw: "see",
  seen: "see",
  seeing: "see",
  sees: "see",
  knew: "know",
  known: "know",
  got: "get",
  gotten: "get",
  getting: "get",
  gets: "get",
  gave: "give",
  given: "give",
  giving: "give",
  gives: "give",
  found: "find",
  finding: "find",
  finds: "find",
  thought: "think",
  thinking: "think",
  thinks: "think",
  told: "tell",
  telling: "tell",
  tells: "tell",
  became: "become",
  becoming: "become",
  becomes: "become",
  left: "leave",
  leaving: "leave",
  leaves: "leave",
  felt: "feel",
  feeling: "feel",
  feels: "feel",
  brought: "bring",
  bringing: "bring",
  brings: "bring",
  began: "begin",
  begun: "begin",
  beginning: "begin",
  begins: "begin",
  kept: "keep",
  keeping: "keep",
  keeps: "keep",
  held: "hold",
  holding: "hold",
  holds: "hold",
  wrote: "write",
  written: "write",
  writing: "write",
  writes: "write",
  stood: "stand",
  standing: "stand",
  stands: "stand",
  heard: "hear",
  hearing: "hear",
  hears: "hear",
  let: "let",
  lets: "let",
  letting: "let",
  meant: "mean",
  meaning: "mean",
  means: "mean",
  set: "set",
  setting: "set",
  sets: "set",
  met: "meet",
  meeting: "meet",
  meets: "meet",
  ran: "run",
  running: "run",
  runs: "run",
  paid: "pay",
  paying: "pay",
  pays: "pay",
  sat: "sit",
  sitting: "sit",
  sits: "sit",
  spoke: "speak",
  spoken: "speak",
  speaking: "speak",
  speaks: "speak",
  lost: "lose",
  losing: "lose",
  loses: "lose",
  fell: "fall",
  fallen: "fall",
  falling: "fall",
  falls: "fall",
  sent: "send",
  sending: "send",
  sends: "send",
  built: "build",
  building: "build",
  builds: "build",
  drew: "draw",
  drawn: "draw",
  drawing: "draw",
  draws: "draw",
  broke: "break",
  broken: "break",
  breaking: "break",
  breaks: "break",
  spent: "spend",
  spending: "spend",
  spends: "spend",
  cut: "cut",
  cutting: "cut",
  cuts: "cut",
  rose: "rise",
  risen: "rise",
  rising: "rise",
  rises: "rise",
  drove: "drive",
  driven: "drive",
  driving: "drive",
  drives: "drive",
  bought: "buy",
  buying: "buy",
  buys: "buy",
  wore: "wear",
  worn: "wear",
  wearing: "wear",
  wears: "wear",
  chose: "choose",
  chosen: "choose",
  choosing: "choose",
  chooses: "choose",
  hung: "hang",
  hanging: "hang",
  hangs: "hang",
  shook: "shake",
  shaken: "shake",
  shaking: "shake",
  shakes: "shake",
  struck: "strike",
  stricken: "strike",
  striking: "strike",
  strikes: "strike",
  laid: "lay",
  laying: "lay",
  lays: "lay",
  slept: "sleep",
  sleeping: "sleep",
  sleeps: "sleep",
  burst: "burst",
  bursting: "burst",
  bursts: "burst",
  shut: "shut",
  shutting: "shut",
  shuts: "shut",
  hit: "hit",
  hitting: "hit",
  hits: "hit",
  put: "put",
  putting: "put",
  puts: "put",
  led: "lead",
  leading: "lead",
  leads: "lead",
  caught: "catch",
  catching: "catch",
  catches: "catch",
  taught: "teach",
  teaching: "teach",
  teaches: "teach",
  fought: "fight",
  fighting: "fight",
  fights: "fight",
  threw: "throw",
  thrown: "throw",
  throwing: "throw",
  throws: "throw",
  passed: "pass",
  passing: "pass",
  passes: "pass",
  flopped: "flop",
  flopping: "flop",
  flops: "flop",
  turned: "turn",
  turning: "turn",
  turns: "turn",
  looked: "look",
  looking: "look",
  looks: "look",
};

// 常见代词（用于映射 one's 或分离式动词短语中继词）
const POSSESSIVE_PRONOUNS = new Set(["my", "your", "his", "her", "its", "our", "their", "one's"]);
const OBJECT_PRONOUNS = new Set(["it", "him", "her", "them", "me", "us", "you"]);

export interface DetectedPhrase {
  phrase: string;
  meaning: string;
  startIndex: number;
  endIndex: number;
  rawText: string;
}

export interface TokenItem {
  raw: string;
  isWord: boolean;
  cleanWord: string;
  tokenIndex: number;
}

const phrasesMap: Record<string, string> = phrasesData as Record<string, string>;

/**
 * 单词形态轻量还原（Lemmatization）
 */
export function lemmatizeWord(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (IRREGULAR_VERBS[lower]) {
    return IRREGULAR_VERBS[lower];
  }
  if (lower.endsWith("ies") && lower.length > 4) {
    return lower.slice(0, -3) + "y";
  }
  if (lower.endsWith("ied") && lower.length > 4) {
    return lower.slice(0, -3) + "y";
  }
  if (lower.endsWith("ing") && lower.length > 4) {
    const base = lower.slice(0, -3);
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    if (base.endsWith("v") || base.endsWith("c") || base.endsWith("m") || base.endsWith("k")) {
      // e.g. caring, loving -> check e
    }
    return base;
  }
  if (lower.endsWith("ed") && lower.length > 3) {
    const base = lower.slice(0, -2);
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    if (lower.endsWith("e")) {
      return lower.slice(0, -1);
    }
    return base;
  }
  if (lower.endsWith("es") && lower.length > 3) {
    return lower.slice(0, -2);
  }
  if (lower.endsWith("s") && lower.length > 3 && !lower.endsWith("ss")) {
    return lower.slice(0, -1);
  }
  return lower;
}

/**
 * 全自动语境词组嗅探算法
 * @param tokens 全段落分词数组
 * @param targetIndex 用户点击的 token 在数组中的索引
 * @returns 命中词组或 null
 */
export function detectContextPhrase(tokens: TokenItem[], targetIndex: number): DetectedPhrase | null {
  if (!tokens || targetIndex < 0 || targetIndex >= tokens.length) return null;

  // 1. 过滤出有效单词序列，并保留原 token 索引映射
  const wordTokens: Array<{ word: string; lemma: string; originalIndex: number }> = [];
  let clickedWordPos = -1;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.isWord && t.cleanWord) {
      const lowerWord = t.cleanWord.toLowerCase();
      const lemma = lemmatizeWord(lowerWord);
      const currentPos = wordTokens.length;
      wordTokens.push({
        word: lowerWord,
        lemma,
        originalIndex: i,
      });
      if (i === targetIndex) {
        clickedWordPos = currentPos;
      }
    }
  }

  if (clickedWordPos === -1) return null;

  // 2. 窗口长度从大到小贪婪扫描 (5, 4, 3, 2 词)
  const maxLen = Math.min(5, wordTokens.length);

  for (let len = maxLen; len >= 2; len--) {
    // 确定合法的起始位置 s：必须让 [s, s + len - 1] 包含 clickedWordPos
    const minStart = Math.max(0, clickedWordPos - len + 1);
    const maxStart = Math.min(clickedWordPos, wordTokens.length - len);

    for (let s = minStart; s <= maxStart; s++) {
      const slice = wordTokens.slice(s, s + len);

      // 短语不得跨越标点界限（如句号、感叹号、问号、分号、冒号、长破折号等）
      const startIdx = slice[0].originalIndex;
      const endIdx = slice[slice.length - 1].originalIndex;
      const hasBoundary = tokens.slice(startIdx, endIdx).some((t) => {
        if (!t.isWord && /[—–―/]/.test(t.raw)) return true;
        if (t.isWord && /[.!?;:—–―]$/.test(t.raw)) return true;
        return false;
      });
      if (hasBoundary) continue;

      // 候选 1：原型拼接 (lemma)
      const candLemma = slice.map((w) => w.lemma).join(" ");
      if (phrasesMap[candLemma]) {
        return createResult(candLemma, slice, tokens);
      }

      // 候选 2：原词拼接 (word)
      const candWord = slice.map((w) => w.word).join(" ");
      if (phrasesMap[candWord]) {
        return createResult(candWord, slice, tokens);
      }

      // 候选 3：动词用原型，后续词用原词 (如 turned out -> turn out)
      const candMixed = [slice[0].lemma, ...slice.slice(1).map((w) => w.word)].join(" ");
      if (phrasesMap[candMixed]) {
        return createResult(candMixed, slice, tokens);
      }

      // 候选 4：物主代词归一化为 one's (如 made up her mind -> make up one's mind)
      const candPossessive = slice
        .map((w, idx) => {
          if (idx === 0) return w.lemma;
          if (POSSESSIVE_PRONOUNS.has(w.word)) return "one's";
          return w.word;
        })
        .join(" ");
      if (phrasesMap[candPossessive]) {
        return createResult(candPossessive, slice, tokens);
      }

      // 候选 5：be 动词被动语态匹配 (如 was made up of -> be made up of 或 make up of)
      if (slice[0].lemma === "be" && len >= 3) {
        const subSlice = slice.slice(1);
        const candSub = [subSlice[0].lemma, ...subSlice.slice(1).map((w) => w.word)].join(" ");
        if (phrasesMap[candSub]) {
          return createResult(candSub, slice, tokens);
        }
      }

      // 候选 6：分离式动词短语跨跳检测 (如 turn it off -> turn off)
      if (len === 3 && OBJECT_PRONOUNS.has(slice[1].word)) {
        const candSeparable = `${slice[0].lemma} ${slice[2].word}`;
        if (phrasesMap[candSeparable]) {
          return createResult(candSeparable, slice, tokens);
        }
      }
    }
  }

  return null;
}

function createResult(
  phraseKey: string,
  slice: Array<{ originalIndex: number }>,
  tokens: TokenItem[]
): DetectedPhrase {
  const startIdx = slice[0].originalIndex;
  const endIdx = slice[slice.length - 1].originalIndex;
  const rawText = tokens
    .slice(startIdx, endIdx + 1)
    .map((t) => t.raw)
    .join("");

  return {
    phrase: phraseKey,
    meaning: phrasesMap[phraseKey],
    startIndex: startIdx,
    endIndex: endIdx,
    rawText,
  };
}
