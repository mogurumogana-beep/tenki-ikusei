/**
 * Open-Meteo アダプタ(開発検証用の暫定実装)。
 *
 * ⚠ 仕様書§9: 天気APIの選定は利用規約確認が済むまで確定しない。
 *   Open-Meteo は非商用無料・APIキー不要のため開発検証に採用しているだけで、
 *   リリース時のAPIとして確定したわけではない。
 *
 * §9遵守メモ:
 * - 表示するのは取得した実況/公式予報値のみ。独自の予測計算は行わない。
 * - 気圧の「変化」は過去実況の差分であり予報ではない。
 * - 平年値の代わりに過去14日の実測移動平均を基準値として使う(§5-1の代用ルール)。
 */
import {
  BASELINE_WINDOW_DAYS,
  FORECAST_DAYS,
  FORECAST_HOURS,
} from "../logic/constants";
import { roundCoordinate } from "../logic/geo";
import type {
  DailyForecast,
  HourlyForecast,
  WeatherKind,
  WeatherSnapshot,
} from "../logic/types";
import type { WeatherProvider } from "./weatherProvider";

/** 強風判定の風速閾値(m/s)。天気コードに強風がないためアダプタ側で判定 */
const STRONG_WIND_MS = 10;

interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    pressure_msl: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    pressure_msl: number[];
    weather_code: number[];
    precipitation_probability: (number | null)[];
    wind_speed_10m: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max: number[];
  };
}

export class OpenMeteoProvider implements WeatherProvider {
  async fetchSnapshot(
    latitude: number,
    longitude: number,
    locationLabel: string,
  ): Promise<WeatherSnapshot> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    // 正確な位置を第三者へ送らない(約1kmに丸める)
    url.searchParams.set("latitude", String(roundCoordinate(latitude)));
    url.searchParams.set("longitude", String(roundCoordinate(longitude)));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,pressure_msl,weather_code,wind_speed_10m",
    );
    url.searchParams.set(
      "hourly",
      "temperature_2m,relative_humidity_2m,pressure_msl,weather_code,precipitation_probability,wind_speed_10m",
    );
    url.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    );
    url.searchParams.set("past_days", String(BASELINE_WINDOW_DAYS));
    url.searchParams.set("forecast_days", String(FORECAST_DAYS));
    url.searchParams.set("wind_speed_unit", "ms");
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`天気の取得に失敗しました (HTTP ${res.status})`);
    }
    const data = (await res.json()) as OpenMeteoResponse;
    return toSnapshot(data, locationLabel, Date.now());
  }
}

/** レスポンス→内部型への変換(テスト可能なようにexport) */
export function toSnapshot(
  data: OpenMeteoResponse,
  locationLabel: string,
  now: number,
): WeatherSnapshot {
  const { current, hourly, daily } = data;

  const weather = mapWeather(current.weather_code, current.wind_speed_10m);

  // 現在時刻に一番近い hourly インデックスを探す
  const currentIdx = nearestTimeIndex(hourly.time, current.time);

  // 気圧の6時間変化(実況の差分。予報ではない)
  const idx6hAgo = Math.max(0, currentIdx - 6);
  const pressureChange6hHpa =
    current.pressure_msl - hourly.pressure_msl[idx6hAgo];

  // 過去14日の移動平均を暫定基準値に(§5-1)
  const start = Math.max(0, currentIdx - BASELINE_WINDOW_DAYS * 24);
  const tempWindow = hourly.temperature_2m.slice(start, currentIdx + 1);
  const humWindow = hourly.relative_humidity_2m.slice(start, currentIdx + 1);

  // 前日の同時刻
  const idxYesterday = currentIdx - 24;
  const yesterday =
    idxYesterday >= 0
      ? {
          temperatureC: hourly.temperature_2m[idxYesterday],
          humidityPct: hourly.relative_humidity_2m[idxYesterday],
        }
      : null;

  // --- これから先の時間別予報(公式予報をそのまま提示する) ---
  const hourlyForecast: HourlyForecast[] = [];
  for (
    let i = currentIdx + 1;
    i < hourly.time.length && hourlyForecast.length < FORECAST_HOURS;
    i++
  ) {
    hourlyForecast.push({
      time: Date.parse(hourly.time[i]),
      hour: hourOfLocalIsoString(hourly.time[i]),
      weather: mapWeather(hourly.weather_code[i], hourly.wind_speed_10m[i]),
      temperatureC: hourly.temperature_2m[i],
      precipitationChance: hourly.precipitation_probability[i] ?? 0,
    });
  }

  // --- 日別予報。過去日(past_days分)は捨てて今日以降だけ残す ---
  const todayKey = data.current.time.slice(0, 10);
  const dailyForecast: DailyForecast[] = [];
  for (let i = 0; i < daily.time.length; i++) {
    if (daily.time[i] < todayKey) continue;
    dailyForecast.push({
      date: daily.time[i],
      weather: mapWeather(daily.weather_code[i], daily.wind_speed_10m_max[i]),
      tempMaxC: daily.temperature_2m_max[i],
      tempMinC: daily.temperature_2m_min[i],
      precipitationChance: daily.precipitation_probability_max[i] ?? 0,
    });
  }

  return {
    fetchedAt: now,
    locationLabel,
    weather,
    temperatureC: current.temperature_2m,
    humidityPct: current.relative_humidity_2m,
    pressureHpa: current.pressure_msl,
    pressureChange6hHpa,
    baseline: {
      temperatureC: mean(tempWindow),
      humidityPct: mean(humWindow),
      windowDays: Math.round((currentIdx + 1 - start) / 24),
    },
    yesterday,
    hourly: hourlyForecast,
    daily: dailyForecast,
    severe: isSevereCode(current.weather_code),
  };
}

/**
 * Open-Meteo は timezone=auto のとき現地時刻をオフセットなしの
 * "2026-07-29T15:00" 形式で返す。Date に通すと環境依存になるため、
 * 文字列から直接「時」を取り出す。
 */
function hourOfLocalIsoString(iso: string): number {
  return Number(iso.slice(11, 13));
}

/**
 * WMO weather code → 内部カテゴリ。
 * https://open-meteo.com/en/docs の Weather variable documentation 参照。
 */
export function mapWeather(code: number, windSpeedMs: number): WeatherKind {
  if (code >= 95) return "thunder";
  if ([65, 67, 82].includes(code)) return "heavyRain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 81) ||
    code === 82
  ) {
    return "rain";
  }
  if (code === 45 || code === 48) return "fog";
  // 降水がない場合のみ風で上書き(天気コードに強風カテゴリが無いため)
  if (windSpeedMs >= STRONG_WIND_MS) return "strongWind";
  if (code <= 1) return "sunny";
  return "cloudy";
}

/**
 * 災害級か(§7)。
 * MVPでは激しい降水・雷・激しい降雪のコードから機械判定。
 * TODO: 公式の警報・注意報(気象庁防災情報XML等)との連携はAPI選定確定後に検討。
 */
export function isSevereCode(code: number): boolean {
  return code >= 95 || [65, 67, 75, 82, 86].includes(code);
}

function nearestTimeIndex(times: string[], target: string): number {
  const t = Date.parse(target);
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(Date.parse(times[i]) - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
