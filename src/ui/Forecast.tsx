/**
 * 予報の表示。
 * ここに出しているのは取得した公式予報そのままで、独自の予測はしない(仕様書§9)。
 */
import type { DailyForecast, HourlyForecast } from "../logic/types";
import { WEATHER_LABELS } from "./labels";
import { WeatherIcon } from "./WeatherIcon";

/** 時間別(横スクロール)。「このあとどうなる?」を一目で */
export function HourlyStrip({
  hours,
  nowTemperatureC,
  nowWeather,
}: {
  hours: HourlyForecast[];
  nowTemperatureC: number;
  nowWeather: HourlyForecast["weather"];
}) {
  if (!hours || hours.length === 0) return null;
  return (
    <div className="hourly-strip">
      <div className="hour-cell now">
        <span className="hour-label">いま</span>
        <WeatherIcon weather={nowWeather} size={30} />
        <span className="hour-temp">{Math.round(nowTemperatureC)}°</span>
        <span className="hour-rain" />
      </div>
      {hours.slice(0, 12).map((h) => (
        <div key={h.time} className="hour-cell">
          <span className="hour-label">{h.hour}時</span>
          <WeatherIcon
            weather={h.weather}
            size={30}
            night={h.hour >= 19 || h.hour < 5}
          />
          <span className="hour-temp">{Math.round(h.temperatureC)}°</span>
          <span
            className={`hour-rain ${h.precipitationChance >= 40 ? "alert" : ""}`}
          >
            {h.precipitationChance > 0 ? `${h.precipitationChance}%` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 週間予報 */
export function WeeklyForecast({ days }: { days: DailyForecast[] }) {
  if (!days || days.length === 0) {
    return <p className="note">予報データがまだありません</p>;
  }
  const allMin = Math.min(...days.map((d) => d.tempMinC));
  const allMax = Math.max(...days.map((d) => d.tempMaxC));
  const span = Math.max(1, allMax - allMin);

  return (
    <ul className="weekly">
      {days.map((d, i) => {
        const date = new Date(`${d.date}T00:00:00`);
        const left = ((d.tempMinC - allMin) / span) * 100;
        const width = ((d.tempMaxC - d.tempMinC) / span) * 100;
        return (
          <li key={d.date} className="week-row">
            <span className={`week-day ${dayColor(date.getDay())}`}>
              {i === 0 ? "きょう" : i === 1 ? "あす" : formatDay(date)}
            </span>
            <WeatherIcon weather={d.weather} size={28} />
            <span
              className={`week-rain ${d.precipitationChance >= 40 ? "alert" : ""}`}
            >
              {d.precipitationChance}%
            </span>
            <span className="week-min">{Math.round(d.tempMinC)}°</span>
            <span className="week-bar">
              <span
                className="week-bar-fill"
                style={{ left: `${left}%`, width: `${Math.max(6, width)}%` }}
              />
            </span>
            <span className="week-max">{Math.round(d.tempMaxC)}°</span>
          </li>
        );
      })}
    </ul>
  );
}

/** きょうの素材が何になるかを予報から見せる(仕様書§6-1の動機づけ) */
export function MaterialOutlook({ days }: { days: DailyForecast[] }) {
  if (!days || days.length === 0) {
    return <p className="note">予報が とれたら ここに出るよ</p>;
  }
  return (
    <ul className="material-outlook">
      {days.slice(0, 5).map((d, i) => (
        <li key={d.date}>
          <span className="mo-day">
            {i === 0 ? "きょう" : formatDay(new Date(`${d.date}T00:00:00`))}
          </span>
          <WeatherIcon weather={d.weather} size={24} />
          <span className="mo-name">{WEATHER_LABELS[d.weather].name}</span>
        </li>
      ))}
    </ul>
  );
}

function formatDay(date: Date): string {
  const w = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}(${w})`;
}

function dayColor(day: number): string {
  if (day === 0) return "sun";
  if (day === 6) return "sat";
  return "";
}
