/**
 * セリフ合成(仕様書§8)。
 * ランタイムでAI APIは呼ばない — 全セリフは事前生成してJSONに同梱(§8-1)。
 *
 * 3層構造(§8-2):
 *   基本層: 天気 × 状態 のセリフ(キャラJSONに定義)
 *   修飾層: 気圧・気温・時間帯の短句を前後に付加(共通プール)
 *   人格層: 語尾等の変換ルール(キャラJSONに定義。MVPのもこは変換なし)
 */
import type {
  CareAction,
  DayPart,
  EnvJudgement,
  Mood,
  WeatherKind,
} from "./types";

/** キャラJSON内のセリフ定義 */
export interface DialogueDef {
  /** 基本層: 天気ごとのセリフ。状態キーで分ける */
  base: Partial<Record<WeatherKind, WeatherLines>>;
  /** 弱点天気を放置されているとき(最優先) */
  untreated: string[];
  /** お世話をしてもらった直後 */
  cared: Partial<Record<CareAction, string[]>>;
  /** 災害警報時(トーンを変えて、はっきり伝える。§7・§8-3) */
  severe: string[];
  /** 修飾層: 短句プール */
  modifiers: {
    pressureFalling: string[];
    pressurePlunging: string[];
    hot: string[];
    cold: string[];
    dry: string[];
    humid: string[];
    night: string[];
    morning: string[];
    /** 前日比(§5-5)。{delta} は使わず定型文 */
    humidThanYesterday: string[];
    dryThanYesterday: string[];
  };
  /** 人格層: 単純置換ルール(例: "です"→"") */
  personality: { replace: [string, string][] };
}

export interface WeatherLines {
  /** 機嫌ごとのセリフ。無い機嫌は neutral にフォールバック */
  happy?: string[];
  neutral?: string[];
  sad?: string[];
}

export interface DialogueInput {
  env: EnvJudgement;
  mood: Mood;
  dayPart: DayPart;
  needsCare: boolean;
  /** 直前に行われたお世話(演出用)。通常表示では null */
  justCared: CareAction | null;
  yesterdayDiff: { humidityDeltaPct: number } | null;
  /** 同じ状況で毎回同じセリフにならないための種(例: 日付+時間帯のハッシュ) */
  seed: number;
}

/**
 * セリフを1つ合成して返す。
 * 災害時 > お世話直後 > 放置 > 通常 の優先順。
 */
export function composeDialogue(def: DialogueDef, input: DialogueInput): string {
  const { env, mood, needsCare, justCared, seed } = input;

  // 災害警報時は修飾を付けず、はっきり伝える(§7: 盛り上げない)
  if (env.severe) {
    return applyPersonality(def, pick(def.severe, seed));
  }

  if (justCared) {
    const lines = def.cared[justCared];
    if (lines && lines.length > 0) {
      return applyPersonality(def, pick(lines, seed));
    }
  }

  let baseLine: string;
  if (needsCare) {
    baseLine = pick(def.untreated, seed);
  } else {
    const weatherLines = def.base[env.weather];
    const byMood =
      weatherLines?.[mood] ?? weatherLines?.neutral ?? ["......"];
    baseLine = pick(byMood, seed);
  }

  // 修飾層: 該当する短句プールから確率的に1つだけ付ける(付けすぎない)
  const modifier = pickModifier(def, input);
  const line =
    modifier === null
      ? baseLine
      : modifier.position === "before"
        ? `${modifier.text}\n${baseLine}`
        : `${baseLine}\n${modifier.text}`;

  return applyPersonality(def, line);
}

function pickModifier(
  def: DialogueDef,
  input: DialogueInput,
): { text: string; position: "before" | "after" } | null {
  const { env, dayPart, yesterdayDiff, seed } = input;
  const pools: string[][] = [];

  if (env.pressure === "plunging") pools.push(def.modifiers.pressurePlunging);
  else if (env.pressure === "falling") pools.push(def.modifiers.pressureFalling);
  if (env.temperature === "hot") pools.push(def.modifiers.hot);
  if (env.temperature === "cold") pools.push(def.modifiers.cold);
  if (env.humidity === "dry") pools.push(def.modifiers.dry);
  if (env.humidity === "humid") pools.push(def.modifiers.humid);
  if (dayPart === "night") pools.push(def.modifiers.night);
  if (dayPart === "morning") pools.push(def.modifiers.morning);
  if (yesterdayDiff && yesterdayDiff.humidityDeltaPct >= 10) {
    pools.push(def.modifiers.humidThanYesterday);
  }
  if (yesterdayDiff && yesterdayDiff.humidityDeltaPct <= -10) {
    pools.push(def.modifiers.dryThanYesterday);
  }

  const candidates = pools.filter((p) => p.length > 0);
  if (candidates.length === 0) return null;
  // 半分の確率で修飾なし(短さが脱力系の肝、§8-3)
  if (hash(seed, 977) % 2 === 0) return null;

  const pool = candidates[hash(seed, 131) % candidates.length];
  return {
    text: pick(pool, hash(seed, 313)),
    position: hash(seed, 541) % 2 === 0 ? "before" : "after",
  };
}

function applyPersonality(def: DialogueDef, line: string): string {
  return def.personality.replace.reduce(
    (acc, [from, to]) => acc.split(from).join(to),
    line,
  );
}

function pick(lines: string[], seed: number): string {
  if (lines.length === 0) return "......";
  return lines[hash(seed, 7919) % lines.length];
}

/** 単純な整数ハッシュ(セリフ選択が描画ごとに揺れないよう決定的にする) */
function hash(seed: number, salt: number): number {
  let h = (seed ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** 日付+時間帯からセリフ選択用の種を作る */
export function dialogueSeed(date: Date, dayPart: DayPart): number {
  const dayNum =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const partNum = { morning: 1, daytime: 2, evening: 3, night: 4 }[dayPart];
  return dayNum * 10 + partNum;
}
