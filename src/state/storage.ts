/**
 * 端末内保存(仕様書§2: サーバーなし、localStorageで完結)。
 *
 * 重要: 一度インストールされたPWAには古い形のデータが残り続ける。
 * 型が変わったときに読み込みで落ちると画面が真っ白になり、
 * ユーザーは自力で復旧できない。読み込みは必ず「壊れていても動く」形にすること。
 */
import type { SaveData, WeatherSnapshot } from "../logic/types";

const KEY = "tenki-ikusei/save";
/** 2: 天気スナップショットに hourly / daily(予報)を追加 */
const CURRENT_VERSION = 2;

export function defaultSave(): SaveData {
  return {
    version: CURRENT_VERSION,
    characterId: "moko",
    inventory: {},
    fedTotals: {},
    resistanceBoost: { wet: 0, dry: 0, updatedAt: Date.now() },
    careLog: {},
    harvestedDates: {},
    severeDays: {},
    protectCount: 0,
    disasterCareCount: 0,
    lastWeather: null,
    location: null,
  };
}

/**
 * 保存されていた天気スナップショットを現在の型に揃える。
 * 予報を持たない旧データでも落ちないように配列を補う。
 * 判定に必要な値が欠けている場合は捨てて、取得し直させる。
 */
export function normalizeSnapshot(value: unknown): WeatherSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snap = value as Partial<WeatherSnapshot>;
  if (
    typeof snap.weather !== "string" ||
    typeof snap.temperatureC !== "number" ||
    typeof snap.humidityPct !== "number" ||
    !snap.baseline
  ) {
    return null;
  }
  return {
    ...(snap as WeatherSnapshot),
    hourly: Array.isArray(snap.hourly) ? snap.hourly : [],
    daily: Array.isArray(snap.daily) ? snap.daily : [],
    pressureChange6hHpa: snap.pressureChange6hHpa ?? 0,
    yesterday: snap.yesterday ?? null,
    severe: snap.severe ?? false,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;

    // 既定値で埋めてから、入っている値で上書きする。
    // これで将来キーが増えても undefined にならない。
    const base = defaultSave();
    return {
      ...base,
      ...parsed,
      version: CURRENT_VERSION,
      inventory: parsed.inventory ?? base.inventory,
      fedTotals: parsed.fedTotals ?? base.fedTotals,
      resistanceBoost: parsed.resistanceBoost ?? base.resistanceBoost,
      careLog: parsed.careLog ?? base.careLog,
      harvestedDates: parsed.harvestedDates ?? base.harvestedDates,
      severeDays: parsed.severeDays ?? base.severeDays,
      lastWeather: normalizeSnapshot(parsed.lastWeather),
      location: parsed.location ?? null,
    };
  } catch {
    return defaultSave();
  }
}

export function persistSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // 容量超過等。MVPでは黙って続行(ゲーム進行を止めない)
  }
}

/** 保存データを消す(復旧用) */
export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 消せなくても呼び出し側で初期化するので続行
  }
}

/** 日付キー(端末ローカル時刻の YYYY-MM-DD) */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
