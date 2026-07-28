/**
 * 天気アイコン(SVG)。
 * 絵文字は端末ごとに絵柄が変わってしまうため、見た目を揃えるために自前で描く。
 */
import type { WeatherKind } from "../logic/types";

interface Props {
  weather: WeatherKind;
  size?: number;
  /** 夜間は太陽を月に差し替える */
  night?: boolean;
}

export function WeatherIcon({ weather, size = 40, night = false }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className="weather-icon"
      aria-hidden="true"
    >
      {renderWeather(weather, night)}
    </svg>
  );
}

function renderWeather(weather: WeatherKind, night: boolean) {
  switch (weather) {
    case "sunny":
      return night ? <Moon /> : <Sun />;
    case "cloudy":
      return (
        <>
          {night ? <Moon cx={17} cy={16} r={7} /> : <Sun cx={17} cy={16} r={7} />}
          <Cloud />
        </>
      );
    case "rain":
      return (
        <>
          <Cloud dark />
          <Drops count={3} />
        </>
      );
    case "heavyRain":
      return (
        <>
          <Cloud dark />
          <Drops count={5} heavy />
        </>
      );
    case "snow":
      return (
        <>
          <Cloud />
          <Flakes />
        </>
      );
    case "thunder":
      return (
        <>
          <Cloud dark />
          <path
            d="M25 30 L20 40 L24 40 L21 47 L30 36 L25 36 L28 30 Z"
            fill="#ffd23f"
            stroke="#e0a800"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </>
      );
    case "fog":
      return (
        <>
          <Cloud />
          <g stroke="#b9c9d6" strokeWidth="3" strokeLinecap="round">
            <line x1="10" y1="36" x2="34" y2="36" />
            <line x1="14" y1="42" x2="38" y2="42" />
          </g>
        </>
      );
    case "strongWind":
      return (
        <>
          <Cloud />
          <g
            stroke="#8fb3c9"
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
          >
            <path d="M8 36 h18 a4 4 0 1 0 -4 -4" />
            <path d="M12 43 h14 a3.5 3.5 0 1 1 -3 3" />
          </g>
        </>
      );
  }
}

function Sun({ cx = 24, cy = 22, r = 10 }: { cx?: number; cy?: number; r?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4;
    const inner = r + 3;
    const outer = r + 7;
    return (
      <line
        key={i}
        x1={cx + Math.cos(angle) * inner}
        y1={cy + Math.sin(angle) * inner}
        x2={cx + Math.cos(angle) * outer}
        y2={cy + Math.sin(angle) * outer}
      />
    );
  });
  return (
    <>
      <g stroke="#ffc93c" strokeWidth="2.6" strokeLinecap="round">
        {rays}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="#ffd75e" />
      <circle cx={cx} cy={cy} r={r * 0.68} fill="#ffe89a" opacity="0.75" />
    </>
  );
}

function Moon({ cx = 24, cy = 22, r = 10 }: { cx?: number; cy?: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#f5e9c8" />
      <circle cx={cx + r * 0.42} cy={cy - r * 0.28} r={r * 0.9} fill="#dfe9f6" />
      <circle cx={cx - r * 0.3} cy={cy + r * 0.25} r={r * 0.16} fill="#e6d9b4" />
    </g>
  );
}

function Cloud({ dark = false }: { dark?: boolean }) {
  const fill = dark ? "#9aacba" : "#ffffff";
  const stroke = dark ? "#7e93a4" : "#dfe9f0";
  return (
    <g fill={fill} stroke={stroke} strokeWidth="1.5">
      <ellipse cx="18" cy="28" rx="9" ry="8" />
      <ellipse cx="30" cy="27" rx="10" ry="9" />
      <rect x="15" y="27" width="20" height="9" rx="4.5" stroke="none" />
    </g>
  );
}

function Drops({ count, heavy = false }: { count: number; heavy?: boolean }) {
  const xs = [15, 22, 29, 36, 18];
  return (
    <g fill={heavy ? "#4d8fc0" : "#7ab6dd"}>
      {Array.from({ length: count }, (_, i) => (
        <path
          key={i}
          d={`M${xs[i]} ${38 + (i % 2) * 3} q2.4 4.4 0 6 q-2.4 -1.6 0 -6z`}
        />
      ))}
    </g>
  );
}

function Flakes() {
  return (
    <g stroke="#9fd0ee" strokeWidth="1.8" strokeLinecap="round">
      {[16, 24, 32].map((x, i) => (
        <g key={x} transform={`translate(${x} ${40 + (i % 2) * 3})`}>
          <line x1="-3" y1="0" x2="3" y2="0" />
          <line x1="0" y1="-3" x2="0" y2="3" />
          <line x1="-2" y1="-2" x2="2" y2="2" />
          <line x1="-2" y1="2" x2="2" y2="-2" />
        </g>
      ))}
    </g>
  );
}
