/**
 * 背景シーン。実際の天気と時間帯で空の色と降りものが変わる。
 * 「今日はどんな空か」を一目で伝えるのが役目。
 */
import type { DayPart, WeatherKind } from "../logic/types";

interface Props {
  weather: WeatherKind;
  dayPart: DayPart;
  severe: boolean;
}

/** 粒の位置は固定値で持つ(描画のたびに動くと目が疲れるため) */
const PARTICLE_SEEDS = [
  4, 12, 19, 27, 34, 41, 48, 56, 63, 71, 78, 85, 92, 8, 23, 38, 52, 67, 81, 95,
];

export function WeatherScene({ weather, dayPart, severe }: Props) {
  const night = dayPart === "night";
  const sky = skyClass(weather, dayPart, severe);

  return (
    <div className={`scene-bg ${sky}`} aria-hidden="true">
      {/* 太陽・月 */}
      {!severe && (weather === "sunny" || weather === "cloudy") && (
        <div className={`celestial ${night ? "moon" : "sun"}`} />
      )}

      {/* 星(夜だけ) */}
      {night && !severe && weather !== "rain" && weather !== "heavyRain" && (
        <div className="stars">
          {PARTICLE_SEEDS.slice(0, 14).map((s, i) => (
            <span
              key={s}
              className="star"
              style={{
                left: `${s}%`,
                top: `${(s * 7 + i * 3) % 45}%`,
                animationDelay: `${(s % 10) * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ながれる雲 */}
      <div className="clouds">
        <span className="cloud c1" />
        <span className="cloud c2" />
        <span className="cloud c3" />
      </div>

      {/* 降りもの */}
      {(weather === "rain" || weather === "heavyRain") && (
        <div className={`rain ${weather === "heavyRain" ? "heavy" : ""}`}>
          {PARTICLE_SEEDS.map((s, i) => (
            <span
              key={s}
              className="drop"
              style={{
                left: `${s}%`,
                animationDelay: `${((s * 3) % 20) / 10}s`,
                animationDuration: `${0.6 + ((i % 4) * 0.15)}s`,
              }}
            />
          ))}
        </div>
      )}

      {weather === "snow" && (
        <div className="snow">
          {PARTICLE_SEEDS.map((s, i) => (
            <span
              key={s}
              className="flake"
              style={{
                left: `${s}%`,
                animationDelay: `${((s * 7) % 30) / 10}s`,
                animationDuration: `${5 + (i % 5)}s`,
              }}
            />
          ))}
        </div>
      )}

      {weather === "thunder" && <div className="lightning" />}

      {weather === "fog" && (
        <div className="fog-layer">
          <span />
          <span />
        </div>
      )}

      {weather === "strongWind" && (
        <div className="wind">
          {PARTICLE_SEEDS.slice(0, 8).map((s, i) => (
            <span
              key={s}
              className="gust"
              style={{
                top: `${15 + s * 0.6}%`,
                animationDelay: `${(i % 5) * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* 晴れの日のきらきら */}
      {weather === "sunny" && !night && (
        <div className="sparkles">
          {PARTICLE_SEEDS.slice(0, 8).map((s, i) => (
            <span
              key={s}
              className="sparkle"
              style={{
                left: `${s}%`,
                top: `${20 + ((s * 5) % 50)}%`,
                animationDelay: `${(i % 6) * 0.7}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function skyClass(
  weather: WeatherKind,
  dayPart: DayPart,
  severe: boolean,
): string {
  if (severe) return "sky-severe";
  if (dayPart === "night") return "sky-night";
  if (dayPart === "evening") return "sky-evening";
  switch (weather) {
    case "sunny":
      return "sky-sunny";
    case "cloudy":
      return "sky-cloudy";
    case "rain":
    case "heavyRain":
      return "sky-rain";
    case "thunder":
      return "sky-thunder";
    case "snow":
      return "sky-snow";
    case "fog":
      return "sky-fog";
    case "strongWind":
      return "sky-wind";
  }
}
