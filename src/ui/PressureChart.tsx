/**
 * 気圧ともこの体調。
 *
 * 一般の天気アプリは気圧をほとんど扱わないが、このアプリは気圧で
 * もこの機嫌が変わる設計(§5-3)なので、気圧の線の上に「そのとき
 * もこがどうなるか」を顔で重ねると、数字を読まずに先が分かる。
 *
 * 色だけで状態を伝えないよう、顔と文字を必ず添える。
 * ここで出しているのは取得した公式の気圧予測値そのままで、
 * 体調の断定はしない(仕様書§9)。
 */
import { judgePressure } from "../logic/judge";
import type { HourlyForecast, PressureTrend, SpriteKey } from "../logic/types";
import { assetUrl } from "./assets";

interface Props {
  hours: HourlyForecast[];
  nowPressureHpa: number;
  /** キャラの表情画像パス(キャラJSONから渡す) */
  sprites: Record<SpriteKey, string>;
  characterName: string;
}

const SLOT = 40;
const PAD = { top: 34, bottom: 26 };
const PLOT_H = 74;
const HEIGHT = PAD.top + PLOT_H + PAD.bottom;

/** 何時間おきに顔を置くか */
const FACE_EVERY = 6;
/** 変化を見るさかのぼり時間(§5-2の判定と揃える) */
const LOOKBACK_H = 6;

const COLOR = {
  line: "#7f93bf",
  wash: "rgba(127, 147, 191, 0.14)",
  grid: "#e6edf3",
  warn: "rgba(232, 168, 58, 0.16)",
};

const TREND_TEXT: Record<PressureTrend | "rising", string> = {
  stable: "おだやか",
  falling: "さがる",
  plunging: "ぐっと さがる",
  rising: "もどる",
};

export function PressureChart({
  hours,
  nowPressureHpa,
  sprites,
  characterName,
}: Props) {
  if (!hours || hours.length === 0) {
    return <p className="note">予報が とれたら ここに出るよ</p>;
  }

  const series = [
    { label: "いま", hpa: nowPressureHpa, hour: null as number | null },
    ...hours.map((h) => ({ label: `${h.hour}`, hpa: h.pressureHpa, hour: h.hour })),
  ];

  const width = series.length * SLOT;
  const values = series.map((s) => s.hpa);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // 変化が小さい日でも線が真っ平らにならないよう最低幅を持たせる
  const span = Math.max(8, max - min);
  const base = (min + max) / 2 - span / 2;

  const x = (i: number) => i * SLOT + SLOT / 2;
  const y = (hpa: number) =>
    PAD.top + PLOT_H - ((hpa - base) / span) * PLOT_H;

  const linePath = series
    .map((s, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(s.hpa)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(series.length - 1)} ${PAD.top + PLOT_H} L${x(0)} ${PAD.top + PLOT_H} Z`;

  /** i時点の傾向(6時間さかのぼった差で見る) */
  const trendAt = (i: number): PressureTrend | "rising" => {
    const prev = series[Math.max(0, i - LOOKBACK_H)].hpa;
    const change = series[i].hpa - prev;
    if (change >= 3) return "rising";
    return judgePressure(change);
  };

  const spriteFor = (t: PressureTrend | "rising"): SpriteKey => {
    if (t === "plunging" || t === "falling") return "gloomy";
    if (t === "rising") return "happy";
    return "normal";
  };

  const faceIndexes = series
    .map((_, i) => i)
    .filter((i) => i % FACE_EVERY === 0);

  // 気圧が下がる区間を薄く塗って、顔の理由を見せる
  const warnSpans: { from: number; to: number }[] = [];
  for (let i = 1; i < series.length; i++) {
    const t = trendAt(i);
    if (t === "falling" || t === "plunging") {
      const last = warnSpans[warnSpans.length - 1];
      if (last && last.to === i - 1) last.to = i;
      else warnSpans.push({ from: i, to: i });
    }
  }

  const worst = series.reduce(
    (acc, _, i) => {
      const t = trendAt(i);
      const rank = t === "plunging" ? 3 : t === "falling" ? 2 : 1;
      return rank > acc.rank ? { rank, i, t } : acc;
    },
    { rank: 0, i: 0, t: "stable" as PressureTrend | "rising" },
  );

  return (
    <div className="pressure-wrap">
      <div className="pressure-lead">
        {worst.rank >= 2 ? (
          <>
            <img
              className="lead-face"
              src={assetUrl(sprites.gloomy)}
              alt=""
              width={40}
            />
            <span>
              {series[worst.i].hour !== null
                ? `${series[worst.i].hour}時ごろ`
                : "いま"}
              、気圧が{TREND_TEXT[worst.t]}みたい。
              <br />
              {characterName}は のんびりする ひ かも
            </span>
          </>
        ) : (
          <>
            <img
              className="lead-face"
              src={assetUrl(sprites.normal)}
              alt=""
              width={40}
            />
            <span>
              しばらく 気圧は おだやか。
              <br />
              {characterName}も いつもどおり
            </span>
          </>
        )}
      </div>

      <div className="pressure-scroll">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label="これからの気圧の推移"
        >
          {warnSpans.map((s, k) => (
            <rect
              key={k}
              x={s.from * SLOT}
              y={PAD.top - 6}
              width={(s.to - s.from + 1) * SLOT}
              height={PLOT_H + 6}
              fill={COLOR.warn}
            />
          ))}

          <line
            x1={0}
            y1={PAD.top + PLOT_H}
            x2={width}
            y2={PAD.top + PLOT_H}
            stroke={COLOR.grid}
            strokeWidth={1}
          />

          <path d={areaPath} fill={COLOR.wash} />
          <path
            d={linePath}
            fill="none"
            stroke={COLOR.line}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* もこの顔。色だけに頼らないための主役 */}
          {faceIndexes.map((i) => {
            const t = trendAt(i);
            return (
              <g key={`f${i}`}>
                <circle
                  cx={x(i)}
                  cy={y(series[i].hpa)}
                  r={4}
                  fill={COLOR.line}
                  stroke="#fff"
                  strokeWidth={2}
                />
                <foreignObject
                  x={x(i) - 17}
                  y={Math.max(0, y(series[i].hpa) - 40)}
                  width={34}
                  height={34}
                >
                  <img
                    src={assetUrl(sprites[spriteFor(t)])}
                    alt=""
                    style={{ width: 34, height: 34, objectFit: "contain" }}
                  />
                </foreignObject>
              </g>
            );
          })}

          {/* 目盛りと時刻 */}
          {series.map((s, i) =>
            i === 0 || i % 3 === 0 ? (
              <text
                key={`x${i}`}
                className={`tl-axis ${i === 0 ? "is-now" : ""}`}
                x={x(i)}
                y={PAD.top + PLOT_H + 15}
                textAnchor="middle"
              >
                {s.label}
              </text>
            ) : null,
          )}
          <text className="tl-axis" x={4} y={PAD.top - 12} textAnchor="start">
            {Math.round(max)}hPa
          </text>
        </svg>
      </div>

      <ul className="pressure-legend">
        {(["stable", "falling", "plunging"] as PressureTrend[]).map((t) => (
          <li key={t}>
            <img src={assetUrl(sprites[spriteFor(t)])} alt="" width={22} />
            {TREND_TEXT[t]}
          </li>
        ))}
      </ul>
      <p className="chart-caption">
        気圧の予測値をそのまま表示しています。体調のことは お医者さんに 相談してね
      </p>
    </div>
  );
}
