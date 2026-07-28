/** 表示用ラベル(UI層のみで使用) */
import type {
  CareAction,
  HumidityBand,
  Mood,
  PressureTrend,
  TempBand,
  WeatherKind,
} from "../logic/types";

export const WEATHER_LABELS: Record<WeatherKind, { name: string; emoji: string }> = {
  sunny: { name: "晴れ", emoji: "☀️" },
  cloudy: { name: "くもり", emoji: "☁️" },
  rain: { name: "雨", emoji: "🌧️" },
  heavyRain: { name: "大雨", emoji: "⛈️" },
  snow: { name: "雪", emoji: "❄️" },
  thunder: { name: "雷", emoji: "⚡" },
  fog: { name: "霧", emoji: "🌫️" },
  strongWind: { name: "強風", emoji: "💨" },
};

export const MOOD_LABELS: Record<Mood, string> = {
  happy: "ごきげん",
  neutral: "ふつう",
  sad: "しょんぼり",
};

export const HUMIDITY_LABELS: Record<HumidityBand, string> = {
  dry: "乾燥ぎみ",
  normal: "ふつう",
  humid: "多湿ぎみ",
};

export const TEMP_LABELS: Record<TempBand, string> = {
  cold: "平年より寒い",
  comfortable: "平年並み",
  hot: "平年より暑い",
};

export const PRESSURE_LABELS: Record<PressureTrend, string> = {
  stable: "安定",
  falling: "下降中",
  plunging: "急降下",
};

export const CARE_LABELS: Record<CareAction, { label: string; emoji: string }> = {
  umbrella: { label: "かさをさす", emoji: "☂️" },
  indoor: { label: "おうちに入れる", emoji: "🏠" },
  wipe: { label: "ふいてあげる", emoji: "🧺" },
};

/** 災害級の日の防災タスク(§7: キャラにしてあげる=プレイヤーが防災知識を得る) */
export const DISASTER_TASKS: {
  action: CareAction;
  label: string;
  /** 出典: 気象庁・内閣府の一般的な防災広報の内容に基づく(§7) */
  tip: string;
}[] = [
  {
    action: "indoor",
    label: "おうちに入れて、まどをしめる",
    tip: "強い雨や風のときは外に出ず、窓や雨戸をしめて窓から離れましょう(出典: 気象庁 防災情報)",
  },
  {
    action: "wipe",
    label: "タオルとおみずを よういする",
    tip: "停電や断水にそなえて、飲み水と生活用品を確認しておきましょう(出典: 内閣府 防災情報)",
  },
];
