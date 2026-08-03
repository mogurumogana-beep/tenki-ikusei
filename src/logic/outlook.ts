/**
 * これから先の見通し(仕様書§5-4)。
 *
 * 「今日雨だって、傘だしとこ」を成立させるための層。
 * 雨が降ってから知らせるのでは遅く、**降る前に知らせて備えさせる**ことが
 * 習慣化の要になる。ここは予報の提示であって独自予測ではない(§9)。
 */
import { RAIN_HINT_CHANCE_PCT } from "./constants";
import type { HourlyForecast, WeatherKind, WeatherSnapshot } from "./types";

/** 濡れる系の天気(かさ・室内が有効なもの) */
const WET_KINDS: readonly WeatherKind[] = [
  "rain",
  "heavyRain",
  "snow",
  "thunder",
];

export interface Outlook {
  /** この先で最も高い降水確率(%) */
  maxRainChance: number;
  /** 雨(雪)が降り出しそうな最初のコマ。無ければ null */
  firstWetHour: HourlyForecast | null;
  /** 先回りで備えを促すべきか */
  shouldPrepare: boolean;
  /** この先の最高/最低気温(今から24時間) */
  tempMaxC: number | null;
  tempMinC: number | null;
  /** 今より暖かくなるか寒くなるか(上着の判断用) */
  trend: "warming" | "cooling" | "steady";
}

/**
 * 直近の予報から見通しを組み立てる。
 * hoursAhead で何時間先まで見るかを変えられる(既定は12時間 = 今日これから)。
 */
export function buildOutlook(
  snapshot: WeatherSnapshot,
  hoursAhead = 12,
): Outlook {
  // 予報を持たない古い保存データでも落ちないようにする
  const window = (snapshot.hourly ?? []).slice(0, hoursAhead);
  if (window.length === 0) {
    return {
      maxRainChance: 0,
      firstWetHour: null,
      shouldPrepare: false,
      tempMaxC: null,
      tempMinC: null,
      trend: "steady",
    };
  }

  const maxRainChance = Math.max(...window.map((h) => h.precipitationChance));
  const firstWetHour =
    window.find(
      (h) =>
        WET_KINDS.includes(h.weather) ||
        h.precipitationChance >= RAIN_HINT_CHANCE_PCT,
    ) ?? null;

  const temps = window.map((h) => h.temperatureC);
  const tempMaxC = Math.max(...temps);
  const tempMinC = Math.min(...temps);

  // 数時間後との比較で寒暖の向きを見る(上着いる? の判断材料)
  const later = window[Math.min(window.length - 1, 5)];
  const delta = later.temperatureC - snapshot.temperatureC;
  const trend = delta >= 3 ? "warming" : delta <= -3 ? "cooling" : "steady";

  return {
    maxRainChance,
    firstWetHour,
    // すでに降っている場合はお世話UIが出るので、ここでは「これから降る」ときだけ
    shouldPrepare:
      firstWetHour !== null && !WET_KINDS.includes(snapshot.weather),
    tempMaxC,
    tempMinC,
    trend,
  };
}

/** 見通しを一言にする(先回りの声かけ) */
export function outlookHint(outlook: Outlook): string | null {
  if (outlook.shouldPrepare && outlook.firstWetHour) {
    const h = outlook.firstWetHour.hour;
    return `${h}時ごろ 雨みたい。かさ、だしとこ`;
  }
  if (outlook.trend === "cooling") return "このあと 冷えるみたい。上着 いるかも";
  if (outlook.trend === "warming") return "このあと あったかくなるみたい";
  return null;
}
