/**
 * 座標の扱い。
 *
 * プライバシー方針: 天気の取得に必要な精度は約1kmで足りるため、
 * 端末の正確な位置をそのまま外部APIへ送らない。
 * 取得直後と送信直前の両方で丸めることで、精度の高い座標が
 * 保存も送信もされないようにしている。
 */
import { LOCATION_PRECISION_DECIMALS } from "./constants";

/** 座標を規定の精度に丸める */
export function roundCoordinate(value: number): number {
  const factor = 10 ** LOCATION_PRECISION_DECIMALS;
  return Math.round(value * factor) / factor;
}
