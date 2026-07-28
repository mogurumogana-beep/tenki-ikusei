/**
 * 可変体質(仕様書§6-2)。
 * - 素材を食べると耐性が上がる
 * - 時間経過で徐々に戻る(世話が不要にならないように)
 * - 上限8割。完全耐性にはしない
 * - 食べた累積は進化分岐用に記録のみ(分岐そのものはMVP外)
 */
import { RESISTANCE } from "./constants";
import type { MaterialId, SaveData } from "./types";

/** 素材ごとの耐性効果。effect が無い素材は食べても耐性に影響しない(累積記録のみ) */
export const MATERIAL_EFFECTS: Partial<
  Record<MaterialId, { stat: "wet" | "dry"; gain: number }>
> = {
  // しずくも→雨(湿気)耐性(§6-2の例)
  shizukumo: { stat: "wet", gain: RESISTANCE.FEED_GAIN },
  konagumo: { stat: "wet", gain: RESISTANCE.FEED_GAIN * 0.5 },
  // わたぐも→乾燥耐性
  watagumo: { stat: "dry", gain: RESISTANCE.FEED_GAIN },
  moyagumo: { stat: "dry", gain: RESISTANCE.FEED_GAIN * 0.5 },
};

export interface ResistanceBoost {
  wet: number;
  dry: number;
  updatedAt: number;
}

/** 減衰を現在時刻まで適用したブースト値を返す(純関数) */
export function decayedBoost(
  boost: ResistanceBoost,
  now: number,
): ResistanceBoost {
  const hours = Math.max(0, (now - boost.updatedAt) / (60 * 60 * 1000));
  const decay = hours * RESISTANCE.DECAY_PER_HOUR;
  return {
    wet: Math.max(0, boost.wet - decay),
    dry: Math.max(0, boost.dry - decay),
    updatedAt: now,
  };
}

/** 素材を1個食べさせる。減衰適用→加算→上限クリップ */
export function feed(
  save: SaveData,
  material: MaterialId,
  now: number,
): SaveData {
  const have = save.inventory[material] ?? 0;
  if (have <= 0) return save;

  const boost = decayedBoost(save.resistanceBoost, now);
  const effect = MATERIAL_EFFECTS[material];
  if (effect) {
    boost[effect.stat] = Math.min(
      RESISTANCE.MAX,
      boost[effect.stat] + effect.gain,
    );
  }

  return {
    ...save,
    inventory: { ...save.inventory, [material]: have - 1 },
    // 進化分岐用の累積記録(§6-2)。MVPでは記録のみ
    fedTotals: {
      ...save.fedTotals,
      [material]: (save.fedTotals[material] ?? 0) + 1,
    },
    resistanceBoost: boost,
  };
}

/**
 * 基礎耐性+ブーストの実効耐性。上限 RESISTANCE.MAX(完全耐性にしない)。
 */
export function effectiveResistance(
  base: { wet: number; dry: number },
  boost: ResistanceBoost,
  now: number,
): { wet: number; dry: number } {
  const d = decayedBoost(boost, now);
  return {
    wet: Math.min(RESISTANCE.MAX, base.wet + d.wet),
    dry: Math.min(RESISTANCE.MAX, base.dry + d.dry),
  };
}
