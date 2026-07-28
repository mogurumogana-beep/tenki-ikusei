/**
 * 機嫌の算出(仕様書§5-3〜5-5)。
 * 機嫌は独立変数ではなく、環境・体質・対処から計算される「結果」。
 *
 * §5-4 の中核設計:
 * 弱点天気は「ダメージ」ではなく「行動の要求」。
 * 対処すればペナルティなし+守ってあげた報酬。放置したときだけしょんぼり。
 */
import { FLUFF, MOOD_SCORE } from "./constants";
import type {
  CareAction,
  CharacterDef,
  DayPart,
  EnvJudgement,
  Mood,
  SpriteKey,
  WeatherKind,
} from "./types";

/** 濡れ系の弱点天気(お世話で守れる対象) */
const WET_WEATHER: readonly WeatherKind[] = [
  "rain",
  "heavyRain",
  "snow",
  "thunder",
];

export interface MoodInput {
  env: EnvJudgement;
  character: CharacterDef;
  /** 今日行ったお世話 */
  careDoneToday: readonly CareAction[];
  /** 現在の実効耐性 0..1 (基礎+ブースト、上限は RESISTANCE.MAX で制限済み) */
  effectiveResistance: { wet: number; dry: number };
  dayPart: DayPart;
}

export interface MoodResult {
  /** 生スコア(デバッグ・ふくらみ描画用) */
  score: number;
  /** 3段階の機嫌 */
  mood: Mood;
  /** ふくらみ具合 0..1 (連続値で描画する、§5-5) */
  fluff: number;
  /** 弱点天気に未対処か(=お世話の要求が出ている状態) */
  needsCare: boolean;
  /** 今日守ってもらえたか */
  protectedToday: boolean;
  /** 表示すべき表情 */
  sprite: SpriteKey;
}

/** この天気はこの子にとって対処が必要か */
export function isWeaknessWeather(
  weather: WeatherKind,
  character: CharacterDef,
): boolean {
  return character.weakWeather.includes(weather);
}

export function calcMood(input: MoodInput): MoodResult {
  const { env, character, careDoneToday, effectiveResistance, dayPart } = input;

  let score = 0;

  const weakness = isWeaknessWeather(env.weather, character);
  const cared = careDoneToday.length > 0;
  const protectedToday = weakness && cared;
  const needsCare = weakness && !cared;

  // --- 体質との相性: 好きな天気 ---
  if (character.favoriteWeather.includes(env.weather)) {
    score += MOOD_SCORE.FAVORITE_WEATHER;
  }

  // --- 平年比の環境スコア ---
  // 弱点天気を放置されている間は「快適」にはならない
  if (
    !needsCare &&
    env.humidity === "normal" &&
    env.temperature === "comfortable"
  ) {
    score += MOOD_SCORE.COMFORT;
  }
  // 体質にとって苦手な方向のズレ。耐性で軽減される
  const badBandPenalty = MOOD_SCORE.BAD_BAND;
  if (character.constitution === "cottonCandy") {
    if (env.humidity === "humid") {
      score += badBandPenalty * (1 - effectiveResistance.wet);
    }
  } else {
    // ゼリー質: 乾燥・高温に弱い(§3)
    if (env.humidity === "dry") {
      score += badBandPenalty * (1 - effectiveResistance.dry);
    }
    if (env.temperature === "hot") {
      score += badBandPenalty * (1 - effectiveResistance.dry);
    }
  }

  // --- 弱点天気: 行動の要求(§5-4) ---
  if (weakness) {
    if (cared) {
      // 対処済み: ダメージなし、むしろ報酬
      score += MOOD_SCORE.PROTECTED_BONUS;
    } else {
      // 放置: 耐性が高いほど軽くなるが、ゼロにはならない(耐性上限8割)
      const wetType = WET_WEATHER.includes(env.weather);
      const resist = wetType
        ? effectiveResistance.wet
        : effectiveResistance.dry;
      score += MOOD_SCORE.UNTREATED_WEAKNESS * (1 - resist);
    }
  }

  // --- 気圧ペナルティ(対処では消えない。のんびりする日) ---
  if (env.pressure === "falling") score += MOOD_SCORE.PRESSURE_FALLING;
  if (env.pressure === "plunging") score += MOOD_SCORE.PRESSURE_PLUNGING;

  // --- 3段階へ丸める ---
  let mood: Mood;
  if (score >= MOOD_SCORE.HAPPY_MIN) mood = "happy";
  else if (score <= MOOD_SCORE.SAD_MAX) mood = "sad";
  else mood = "neutral";

  // --- ふくらみは連続値(§5-5) ---
  const fluff = clamp01(
    (score - FLUFF.SCORE_MIN) / (FLUFF.SCORE_MAX - FLUFF.SCORE_MIN),
  );

  return {
    score,
    mood,
    fluff,
    needsCare,
    protectedToday,
    sprite: pickSprite({
      env,
      mood,
      needsCare,
      dayPart,
      lastCare: careDoneToday[careDoneToday.length - 1] ?? null,
      protectedToday,
    }),
  };
}

function pickSprite(args: {
  env: EnvJudgement;
  mood: Mood;
  needsCare: boolean;
  dayPart: DayPart;
  lastCare: CareAction | null;
  protectedToday: boolean;
}): SpriteKey {
  const { env, mood, needsCare, dayPart, lastCare, protectedToday } = args;

  // 濡れ系の弱点を放置されているときは wet が最優先
  if (needsCare && WET_WEATHER.includes(env.weather)) return "wet";

  // 守ってもらった姿を見せる(お世話の手応え)
  if (protectedToday && lastCare === "umbrella") return "umbrella";
  if (protectedToday && (lastCare === "indoor" || lastCare === "wipe")) {
    return "blanket";
  }

  // 気圧が下がっている日はぐったり(§5-3の気圧ペナルティを絵でも見せる)
  if (env.pressure !== "stable") return "gloomy";

  if (mood === "sad") return "sad";
  if (dayPart === "night") return "sleepy";
  if (mood === "happy") return "happy";
  return "normal";
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
