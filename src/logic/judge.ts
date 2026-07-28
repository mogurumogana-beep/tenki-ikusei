/**
 * 環境判定(仕様書§5)。
 * 大原則: 絶対値ではなく「平年比」で判定する(§5-1)。
 */
import { BASELINE_DELTA, DAY_PARTS, PRESSURE } from "./constants";
import type {
  DayPart,
  EnvJudgement,
  HumidityBand,
  PressureTrend,
  TempBand,
  WeatherSnapshot,
} from "./types";

/** 気温を平年比で3段階に丸める */
export function judgeTemperature(
  currentC: number,
  baselineC: number,
): TempBand {
  const delta = currentC - baselineC;
  if (delta <= -BASELINE_DELTA.TEMP_C) return "cold";
  if (delta >= BASELINE_DELTA.TEMP_C) return "hot";
  return "comfortable";
}

/** 湿度を平年比で3段階に丸める */
export function judgeHumidity(
  currentPct: number,
  baselinePct: number,
): HumidityBand {
  const delta = currentPct - baselinePct;
  if (delta <= -BASELINE_DELTA.HUMIDITY_PCT) return "dry";
  if (delta >= BASELINE_DELTA.HUMIDITY_PCT) return "humid";
  return "normal";
}

/** 気圧は絶対値でなく変化率で判定する(§5-2) */
export function judgePressure(change6hHpa: number): PressureTrend {
  if (change6hHpa <= -PRESSURE.PLUNGING_DROP_HPA) return "plunging";
  if (change6hHpa <= -PRESSURE.FALLING_DROP_HPA) return "falling";
  return "stable";
}

/** スナップショット全体から環境判定を作る */
export function judgeEnvironment(snapshot: WeatherSnapshot): EnvJudgement {
  return {
    weather: snapshot.weather,
    humidity: judgeHumidity(
      snapshot.humidityPct,
      snapshot.baseline.humidityPct,
    ),
    temperature: judgeTemperature(
      snapshot.temperatureC,
      snapshot.baseline.temperatureC,
    ),
    pressure: judgePressure(snapshot.pressureChange6hHpa),
    severe: snapshot.severe,
  };
}

/** 時間帯(朝と夕方で表情が変わる、§5-5) */
export function judgeDayPart(hour: number): DayPart {
  if (hour >= DAY_PARTS.NIGHT_START || hour < DAY_PARTS.MORNING_START) {
    return "night";
  }
  if (hour >= DAY_PARTS.EVENING_START) return "evening";
  if (hour >= DAY_PARTS.DAYTIME_START) return "daytime";
  return "morning";
}

/** 前日比の一言に使う差分(§5-5「昨日より湿気てる」) */
export function diffFromYesterday(
  snapshot: WeatherSnapshot,
): { tempDeltaC: number; humidityDeltaPct: number } | null {
  if (!snapshot.yesterday) return null;
  return {
    tempDeltaC: snapshot.temperatureC - snapshot.yesterday.temperatureC,
    humidityDeltaPct: snapshot.humidityPct - snapshot.yesterday.humidityPct,
  };
}
