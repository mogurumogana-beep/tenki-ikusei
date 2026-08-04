/**
 * アプリ内部の型定義。
 * 天気APIのレスポンスはアダプタ層(src/adapters)でこの型に変換する(仕様書§12)。
 */

/** 天気カテゴリ(仕様書§5-2) */
export type WeatherKind =
  | "sunny"
  | "cloudy"
  | "rain"
  | "heavyRain"
  | "snow"
  | "thunder"
  | "fog"
  | "strongWind";

/** 湿度3段階(平年比) */
export type HumidityBand = "dry" | "normal" | "humid";

/** 気温3段階(平年比) */
export type TempBand = "cold" | "comfortable" | "hot";

/** 気圧トレンド(変化率で判定) */
export type PressureTrend = "stable" | "falling" | "plunging";

/** 機嫌3段階 */
export type Mood = "happy" | "neutral" | "sad";

/** 時間帯 */
export type DayPart = "morning" | "daytime" | "evening" | "night";

/** 体質 */
export type Constitution = "cottonCandy" | "jelly";

/**
 * キャラの表情画像キー(仕様書§4)。
 * umbrella / blanket はお世話をしてもらった直後の姿、
 * gloomy は気圧低下でぐったりしている姿。
 */
export type SpriteKey =
  | "normal"
  | "happy"
  | "sad"
  | "wet"
  | "sleepy"
  | "umbrella"
  | "blanket"
  | "gloomy";

/** お世話アクション3種(仕様書§10) */
export type CareAction = "umbrella" | "indoor" | "wipe";

/** 素材(仕様書§6-1) */
export type MaterialId =
  | "watagumo"
  | "haigumo"
  | "shizukumo"
  | "konagumo"
  | "pirigumo"
  | "moyagumo"
  | "kazegumo";

/**
 * 時間別の予報1コマ。
 * 公式発表の予報をそのまま提示するためのもの(仕様書§9: 独自予報をしない)。
 */
export interface HourlyForecast {
  /** 予報時刻(epoch ms) */
  time: number;
  /** ローカル時(0-23) */
  hour: number;
  weather: WeatherKind;
  temperatureC: number;
  /** 降水確率(%) */
  precipitationChance: number;
  /** 降水量(mm)。確率だけでは雨の強さが分からないため併せて持つ */
  precipitationMm: number;
  /** 海面気圧(hPa)。気圧グラフに使う */
  pressureHpa: number;
  /** 昼か(グラフの昼夜帯に使う) */
  isDay: boolean;
}

/** 日別の予報1日分 */
export interface DailyForecast {
  /** YYYY-MM-DD(ローカル) */
  date: string;
  weather: WeatherKind;
  tempMaxC: number;
  tempMinC: number;
  /** その日の最大降水確率(%) */
  precipitationChance: number;
}

/**
 * アダプタ層が返す正規化済みの天気スナップショット。
 * 「平年比」判定に必要な基準値もアダプタが用意する。
 */
export interface WeatherSnapshot {
  /** 取得時刻(epoch ms) */
  fetchedAt: number;
  /** 対象地点名(表示用) */
  locationLabel: string;
  weather: WeatherKind;
  /** 現在気温(℃) */
  temperatureC: number;
  /** 現在湿度(%) */
  humidityPct: number;
  /** 現在海面気圧(hPa) */
  pressureHpa: number;
  /**
   * 気圧の6時間変化量(hPa)。負なら低下。
   * 予報ではなく実況の変化から算出する(仕様書§9: 独自予報をしない)。
   */
  pressureChange6hHpa: number;
  /**
   * 暫定基準値: 過去7〜14日の移動平均(仕様書§5-1)。
   * 公式平年値が使える場合はアダプタがそちらを返してよい。
   */
  baseline: {
    temperatureC: number;
    humidityPct: number;
    /** 基準値の算出に使った日数(表示・デバッグ用) */
    windowDays: number;
  };
  /** 前日の値(前日比の演出用、仕様書§5-5) */
  yesterday: {
    temperatureC: number;
    humidityPct: number;
  } | null;
  /** これから先の時間別予報(直近24時間程度) */
  hourly: HourlyForecast[];
  /** 今日を含む日別予報 */
  daily: DailyForecast[];
  /**
   * 災害級の天気か。アダプタが公式情報(警報等)から判定できる場合に true。
   * MVPでは天気カテゴリからの機械判定(§7)。
   */
  severe: boolean;
}

/** 平年比で丸めた環境判定の結果 */
export interface EnvJudgement {
  weather: WeatherKind;
  humidity: HumidityBand;
  temperature: TempBand;
  pressure: PressureTrend;
  severe: boolean;
}

/** キャラ定義(JSONで外部定義、仕様書§12) */
export interface CharacterDef {
  id: string;
  name: string;
  constitution: Constitution;
  /** 表情ごとの画像パス。差し替え可能(仕様書§4) */
  sprites: Record<SpriteKey, string>;
  /** 好きな天気(機嫌ボーナス) */
  favoriteWeather: WeatherKind[];
  /** 苦手な天気(対処が必要になる) */
  weakWeather: WeatherKind[];
  /** 基礎耐性 0..1 (雨=湿気系、乾燥系) */
  baseResistance: {
    wet: number;
    dry: number;
  };
}

/** セーブデータ(端末内のみ、仕様書§2) */
export interface SaveData {
  version: number;
  characterId: string;
  /** 素材の所持数 */
  inventory: Partial<Record<MaterialId, number>>;
  /** 食べさせた素材の累積(進化分岐用の記録のみ、仕様書§6-2) */
  fedTotals: Partial<Record<MaterialId, number>>;
  /** 一時的な耐性ブースト(食べた素材で上がり、時間で減衰) */
  resistanceBoost: {
    wet: number;
    dry: number;
    /** 最終更新時刻(epoch ms)。減衰計算に使う */
    updatedAt: number;
  };
  /** その日行ったお世話(日付キー: YYYY-MM-DD) */
  careLog: Record<string, CareAction[]>;
  /** その日の採取が済んだか(日付キー)。翌日ボーナスは "aftermath:日付" キーで記録 */
  harvestedDates: Record<string, boolean>;
  /** 災害級だった日の記録(日付キー→その日の天気)。翌日の庭ボーナス判定に使う(§7) */
  severeDays: Record<string, WeatherKind>;
  /** 守ってあげた回数(表彰用の記録) */
  protectCount: number;
  /** 防災タスク完了回数(§7 表彰) */
  disasterCareCount: number;
  /** 最後に見た天気スナップショット(オフライン動作用、仕様書§2) */
  lastWeather: WeatherSnapshot | null;
  /** 地点設定 */
  location: {
    latitude: number;
    longitude: number;
    label: string;
  } | null;
}
