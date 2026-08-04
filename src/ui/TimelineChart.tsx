/**
 * きょうの流れ(統合タイムライン)。
 *
 * 設計上の約束:
 * 気温(℃)と降水量(mm)は単位が違うので、**同じプロットに重ねない**。
 * ひとつの時間軸を共有したまま、気温レーンと降水レーンを上下に分ける。
 * 2本のy軸を1枚に重ねると、実際には無い相関を目が作ってしまうため。
 *
 * 数値そのものは HourlyStrip(数字の一覧)でも読めるようにしてあり、
 * このグラフは「形を掴む」ための補助という位置づけ。
 */
import { useRef, useState } from "react";
import type { HourlyForecast } from "../logic/types";
import { WeatherIcon } from "./WeatherIcon";

interface Props {
  hours: HourlyForecast[];
  /** 現在の気温(左端の「いま」に使う) */
  nowTemperatureC: number;
  nowWeather: HourlyForecast["weather"];
}

/** 1時間あたりの横幅(px) */
const SLOT = 44;
/** レーンの高さ */
const LANE = {
  icon: 30,
  temp: 78,
  rain: 40,
  axis: 20,
};
const PAD_TOP = 16;
const HEIGHT = PAD_TOP + LANE.icon + LANE.temp + LANE.rain + LANE.axis;

/** 降水量スケールの下限(mm)。弱い雨も見えるように上限を張りすぎない */
const RAIN_SCALE_MIN_MM = 3;

const COLOR = {
  temp: "#e59a4e",
  tempWash: "rgba(229, 154, 78, 0.14)",
  rain: "#5aa8d8",
  night: "rgba(86, 108, 148, 0.11)",
  grid: "#e6edf3",
  now: "#f0a35c",
};

export function TimelineChart({ hours, nowTemperatureC, nowWeather }: Props) {
  const [focus, setFocus] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!hours || hours.length === 0) {
    return <p className="note">予報が とれたら ここに出るよ</p>;
  }

  // 先頭に「いま」を差し込んで、現在地点から線が始まるようにする
  const points: { label: string; item: HourlyForecast | null; temp: number }[] =
    [
      { label: "いま", item: null, temp: nowTemperatureC },
      ...hours.map((h) => ({ label: `${h.hour}`, item: h, temp: h.temperatureC })),
    ];

  const width = points.length * SLOT;
  const temps = points.map((p) => p.temp);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  // 平坦な日に線が潰れないよう最低幅を確保する
  const tSpan = Math.max(4, tMax - tMin);
  const tBase = (tMin + tMax) / 2 - tSpan / 2;

  const maxRain = Math.max(
    RAIN_SCALE_MIN_MM,
    ...points.map((p) => p.item?.precipitationMm ?? 0),
  );

  const tempTop = PAD_TOP + LANE.icon;
  const rainTop = tempTop + LANE.temp;
  const rainBottom = rainTop + LANE.rain;

  const x = (i: number) => i * SLOT + SLOT / 2;
  const yTemp = (t: number) =>
    tempTop + LANE.temp - 14 - ((t - tBase) / tSpan) * (LANE.temp - 26);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)} ${yTemp(p.temp)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(points.length - 1)} ${rainTop} L${x(0)} ${rainTop} Z`;

  // 気温の目印は「最高・最低・いま」だけに絞る(全点に数字を置くと読まれない)
  const iMax = temps.indexOf(tMax);
  const iMin = temps.indexOf(tMin);
  const labelled = new Set([0, iMax, iMin]);

  const handlePointer = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const i = Math.round(((clientX - rect.left) / rect.width) * width - SLOT / 2) / SLOT;
    setFocus(Math.max(0, Math.min(points.length - 1, Math.round(i))));
  };

  const focused = focus === null ? null : points[focus];

  return (
    <div className="timeline-wrap">
      <div className="timeline-readout">
        {focused ? (
          <>
            <strong>
              {focused.label === "いま" ? "いま" : `${focused.label}時`}
            </strong>
            <span>{focused.temp.toFixed(1)}℃</span>
            {focused.item && (
              <>
                <span className="ro-rain">
                  雨 {focused.item.precipitationChance}%
                </span>
                {focused.item.precipitationMm > 0 && (
                  <span className="ro-mm">
                    {focused.item.precipitationMm.toFixed(1)}mm
                  </span>
                )}
              </>
            )}
          </>
        ) : (
          <span className="ro-hint">グラフを なぞると くわしく見えるよ</span>
        )}
      </div>

      <div className="timeline-scroll">
        <svg
          ref={svgRef}
          className="timeline-svg"
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label="これからの気温と降水量の推移"
          onMouseMove={(e) => handlePointer(e.clientX)}
          onMouseLeave={() => setFocus(null)}
          onTouchStart={(e) => handlePointer(e.touches[0].clientX)}
          onTouchMove={(e) => handlePointer(e.touches[0].clientX)}
        >
          {/* 夜の帯 */}
          {points.map((p, i) =>
            p.item && !p.item.isDay ? (
              <rect
                key={`n${i}`}
                x={i * SLOT}
                y={PAD_TOP}
                width={SLOT}
                height={rainBottom - PAD_TOP}
                fill={COLOR.night}
              />
            ) : null,
          )}

          {/* 気温レーンと降水レーンの区切り(実線のヘアライン) */}
          <line
            x1={0}
            y1={rainTop}
            x2={width}
            y2={rainTop}
            stroke={COLOR.grid}
            strokeWidth={1}
          />
          <line
            x1={0}
            y1={rainBottom}
            x2={width}
            y2={rainBottom}
            stroke={COLOR.grid}
            strokeWidth={1}
          />

          {/* --- 気温レーン --- */}
          <path d={areaPath} fill={COLOR.tempWash} />
          <path
            d={linePath}
            fill="none"
            stroke={COLOR.temp}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) =>
            labelled.has(i) ? (
              <g key={`t${i}`}>
                <circle
                  cx={x(i)}
                  cy={yTemp(p.temp)}
                  r={4}
                  fill={COLOR.temp}
                  stroke="#fff"
                  strokeWidth={2}
                />
                <text
                  className="tl-temp-label"
                  x={x(i)}
                  y={yTemp(p.temp) - 9}
                  textAnchor="middle"
                >
                  {Math.round(p.temp)}°
                </text>
              </g>
            ) : null,
          )}

          {/* --- 降水レーン(気温とは別スケール) --- */}
          {points.map((p, i) => {
            const mm = p.item?.precipitationMm ?? 0;
            if (mm <= 0) return null;
            const h = Math.max(3, (mm / maxRain) * (LANE.rain - 6));
            return (
              <rect
                key={`r${i}`}
                x={i * SLOT + 2}
                y={rainBottom - h}
                width={SLOT - 4}
                height={h}
                rx={4}
                fill={COLOR.rain}
              />
            );
          })}

          {/* --- 天気アイコン(3時間おき) --- */}
          {points.map((p, i) =>
            i % 3 === 0 ? (
              <g key={`i${i}`} transform={`translate(${x(i) - 13} ${PAD_TOP})`}>
                <WeatherIconInSvg
                  weather={p.item?.weather ?? nowWeather}
                  night={p.item ? !p.item.isDay : false}
                />
              </g>
            ) : null,
          )}

          {/* --- 時刻ラベル --- */}
          {points.map((p, i) =>
            i === 0 || i % 3 === 0 ? (
              <text
                key={`x${i}`}
                className={`tl-axis ${i === 0 ? "is-now" : ""}`}
                x={x(i)}
                y={rainBottom + 14}
                textAnchor="middle"
              >
                {p.label}
              </text>
            ) : null,
          )}

          {/* --- なぞった位置 --- */}
          {focus !== null && (
            <g pointerEvents="none">
              <line
                x1={x(focus)}
                y1={PAD_TOP}
                x2={x(focus)}
                y2={rainBottom}
                stroke={COLOR.now}
                strokeWidth={2}
                opacity={0.75}
              />
              <circle
                cx={x(focus)}
                cy={yTemp(points[focus].temp)}
                r={5}
                fill={COLOR.temp}
                stroke="#fff"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      </div>
      <p className="chart-caption">
        上のレーンが気温、下のレーンが降水量(mm)。灰色の帯は夜。
      </p>
    </div>
  );
}

/** SVG内に置くための天気アイコン(サイズ固定) */
function WeatherIconInSvg({
  weather,
  night,
}: {
  weather: HourlyForecast["weather"];
  night: boolean;
}) {
  return (
    <foreignObject width={26} height={26}>
      <WeatherIcon weather={weather} size={26} night={night} />
    </foreignObject>
  );
}
