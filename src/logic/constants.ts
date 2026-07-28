/**
 * 判定に使う閾値・係数はすべてここに集約する(仕様書§12)。
 * ゲームバランス調整はこのファイルの編集だけで完結させること。
 */

/** 気圧トレンドの閾値(hPa / 6時間)。医学的確定値はなく暫定(仕様書§5-2) */
export const PRESSURE = {
  /** これ以上の低下で「下降中」 */
  FALLING_DROP_HPA: 3,
  /** これ以上の低下で「急降下」 */
  PLUNGING_DROP_HPA: 6,
} as const;

/** 平年比の閾値 */
export const BASELINE_DELTA = {
  /** 気温: 平年比±この値(℃)を超えたら 寒い/暑い */
  TEMP_C: 4,
  /** 湿度: 平年比±この値(%)を超えたら 乾燥/多湿 */
  HUMIDITY_PCT: 15,
} as const;

/** 基準値に使う移動平均の日数(仕様書§5-1: 7〜14日) */
export const BASELINE_WINDOW_DAYS = 14;

/** 取得する予報の日数(週間予報の表示に使う) */
export const FORECAST_DAYS = 7;

/** 画面に出す時間別予報のコマ数(1コマ=1時間) */
export const FORECAST_HOURS = 24;

/**
 * この降水確率(%)以上なら「かさ、いるかも」と先回りで知らせる。
 * 仕様書§5-4の「今日雨だって、傘だしとこ」を予報から出すための閾値。
 */
export const RAIN_HINT_CHANCE_PCT = 40;

/** 機嫌スコアの係数(仕様書§5-3) */
export const MOOD_SCORE = {
  /** 好きな天気ボーナス */
  FAVORITE_WEATHER: 2,
  /** 環境(湿度・気温)が平年並みのときの快適ボーナス */
  COMFORT: 1,
  /** 弱点天気で未対処のときのペナルティ(§5-4: 対処すれば発生しない) */
  UNTREATED_WEAKNESS: -3,
  /** 弱点天気に対処してもらえたときの報酬(むしろプラス) */
  PROTECTED_BONUS: 2,
  /** 平年比で苦手方向(わたがし質なら多湿)のペナルティ */
  BAD_BAND: -1,
  /** 気圧ペナルティ */
  PRESSURE_FALLING: -1,
  PRESSURE_PLUNGING: -2,
  /** 3段階への丸め閾値: これ以上で ごきげん */
  HAPPY_MIN: 2,
  /** これ以下で しょんぼり */
  SAD_MAX: -2,
} as const;

/** ふくらみ具合の描画用パラメータ(§5-5: 連続値で描画) */
export const FLUFF = {
  /** スコアをふくらみ(0..1)に変換するときのスコア範囲 */
  SCORE_MIN: -5,
  SCORE_MAX: 5,
} as const;

/** 耐性(仕様書§6-2) */
export const RESISTANCE = {
  /** 耐性の上限。完全耐性にはしない */
  MAX: 0.8,
  /** 素材1個で上がる量 */
  FEED_GAIN: 0.15,
  /** 1時間あたりの減衰量(時間経過で徐々に戻る) */
  DECAY_PER_HOUR: 0.01,
} as const;

/** 採取量 */
export const HARVEST = {
  NORMAL_AMOUNT: 3,
  /** 大雨はしずくも大量(§6-1) */
  HEAVY_RAIN_AMOUNT: 6,
  /** 災害級の天気に家の中で備えたとき、翌日庭で採れる量(§7) */
  DISASTER_INDOOR_REWARD: 5,
} as const;

/** 天気データの鮮度: これより古ければ再取得を試みる(ms) */
export const WEATHER_STALE_MS = 60 * 60 * 1000;

/**
 * 外部APIに送る座標の精度(小数点以下の桁数)。
 * 2桁 ≒ 約1km。天気の取得にはこれで十分なため、
 * それ以上の精度を第三者に送らない(プライバシー配慮)。
 */
export const LOCATION_PRECISION_DECIMALS = 2;

/** 時間帯の区切り(時) */
export const DAY_PARTS = {
  MORNING_START: 5,
  DAYTIME_START: 10,
  EVENING_START: 16,
  NIGHT_START: 20,
} as const;
