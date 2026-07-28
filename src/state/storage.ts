/**
 * 端末内保存(仕様書§2: サーバーなし、localStorageで完結)。
 */
import type { SaveData } from "../logic/types";

const KEY = "tenki-ikusei/save";
const CURRENT_VERSION = 1;

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

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed.version !== CURRENT_VERSION) {
      // 将来のマイグレーション地点。MVPでは初期化で十分
      return { ...defaultSave(), ...parsed, version: CURRENT_VERSION };
    }
    return parsed;
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

/** 日付キー(端末ローカル時刻の YYYY-MM-DD) */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
