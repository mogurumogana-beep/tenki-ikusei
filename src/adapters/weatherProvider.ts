/**
 * 天気プロバイダのインターフェース(仕様書§12)。
 * APIレスポンスは必ずこの層で WeatherSnapshot に変換し、
 * アプリ本体は特定のAPIに依存しないこと。
 *
 * ⚠ APIの選定は未確定(仕様書§9の要確認事項)。
 * 現在の openMeteo.ts は開発検証用の暫定実装。
 * 商用リリース前に利用規約・気象業務法の観点で選定を確定し、
 * 必要ならこのインターフェースの実装を差し替える。
 */
import type { WeatherSnapshot } from "../logic/types";

export interface WeatherProvider {
  /** 現況+基準値をまとめたスナップショットを取得する */
  fetchSnapshot(
    latitude: number,
    longitude: number,
    locationLabel: string,
  ): Promise<WeatherSnapshot>;
}
