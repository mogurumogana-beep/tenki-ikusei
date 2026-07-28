/**
 * 素材と採取(仕様書§6-1)と、災害時の反転ルール(§7)。
 *
 * 厳守事項(§7):
 * 危険な天気の日に採取のため外出を促す導線を作らない。
 * 危険な天気ほど「家の中で備えると手に入る」方向に反転させる。
 */
import { HARVEST } from "./constants";
import type { MaterialId, WeatherKind } from "./types";

export const MATERIAL_NAMES: Record<MaterialId, string> = {
  watagumo: "わたぐも",
  haigumo: "はいぐも",
  shizukumo: "しずくも",
  konagumo: "こなぐも",
  pirigumo: "ぴりぐも",
  moyagumo: "もやぐも",
  kazegumo: "かぜぐも",
};

/** 天気→素材(§6-1) */
export const WEATHER_MATERIAL: Record<WeatherKind, MaterialId> = {
  sunny: "watagumo",
  cloudy: "haigumo",
  rain: "shizukumo",
  heavyRain: "shizukumo",
  snow: "konagumo",
  thunder: "pirigumo",
  fog: "moyagumo",
  strongWind: "kazegumo",
};

export interface HarvestResult {
  material: MaterialId;
  amount: number;
  /** レア枠(大雨のとき、§6-1)。MVPではぴりぐもを1個 */
  bonus: { material: MaterialId; amount: number } | null;
}

/**
 * 通常採取。
 * severe(災害級)の日は絶対に呼ばないこと — UI側は harvestAllowed() で分岐する。
 */
export function harvest(weather: WeatherKind): HarvestResult {
  const material = WEATHER_MATERIAL[weather];
  if (weather === "heavyRain") {
    return {
      material,
      amount: HARVEST.HEAVY_RAIN_AMOUNT,
      bonus: { material: "pirigumo", amount: 1 },
    };
  }
  return { material, amount: HARVEST.NORMAL_AMOUNT, bonus: null };
}

/**
 * 今日、庭での採取ができるか。
 * 災害級の天気の日は採取不可(§7)。代わりに防災タスク→翌日の庭採取になる。
 */
export function harvestAllowed(severe: boolean): boolean {
  return !severe;
}

/**
 * 災害級の日に家で備えた翌日の報酬(§7「引きこもらせた翌日、庭で素材が採取できる」)。
 * その日の天気の素材を多めに得る。
 */
export function disasterAftermathHarvest(
  yesterdayWeather: WeatherKind,
): HarvestResult {
  return {
    material: WEATHER_MATERIAL[yesterdayWeather],
    amount: HARVEST.DISASTER_INDOOR_REWARD,
    bonus: null,
  };
}
