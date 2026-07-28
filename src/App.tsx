import { useCallback, useEffect, useState } from "react";
import mokoData from "./data/moko.json";
import { OpenMeteoProvider } from "./adapters/openMeteo";
import { WEATHER_STALE_MS } from "./logic/constants";
import { composeDialogue, dialogueSeed } from "./logic/dialogue";
import type { DialogueDef } from "./logic/dialogue";
import { roundCoordinate } from "./logic/geo";
import { diffFromYesterday, judgeDayPart, judgeEnvironment } from "./logic/judge";
import {
  MATERIAL_NAMES,
  disasterAftermathHarvest,
  harvest,
  harvestAllowed,
} from "./logic/materials";
import { calcMood, isWeaknessWeather } from "./logic/mood";
import { MATERIAL_EFFECTS, effectiveResistance, feed } from "./logic/resistance";
import type {
  CareAction,
  CharacterDef,
  MaterialId,
  PressureTrend,
  SaveData,
  WeatherKind,
  WeatherSnapshot,
} from "./logic/types";
import { dateKey, defaultSave, loadSave, persistSave } from "./state/storage";
import {
  CARE_LABELS,
  DISASTER_TASKS,
  HUMIDITY_LABELS,
  MOOD_LABELS,
  PRESSURE_LABELS,
  TEMP_LABELS,
  WEATHER_LABELS,
} from "./ui/labels";

const character = mokoData.character as CharacterDef;
const dialogueDef = mokoData.dialogue as unknown as DialogueDef;
const provider = new OpenMeteoProvider();

/** 地点プリセット(手動選択用。位置情報許可なしでも使える) */
const PRESET_LOCATIONS = [
  { label: "札幌", latitude: 43.06, longitude: 141.35 },
  { label: "仙台", latitude: 38.27, longitude: 140.87 },
  { label: "東京", latitude: 35.68, longitude: 139.77 },
  { label: "名古屋", latitude: 35.18, longitude: 136.91 },
  { label: "大阪", latitude: 34.69, longitude: 135.5 },
  { label: "広島", latitude: 34.4, longitude: 132.46 },
  { label: "福岡", latitude: 33.59, longitude: 130.4 },
  { label: "那覇", latitude: 26.21, longitude: 127.68 },
];

/** デバッグ用の状況上書き(検証項目②: セリフと絵の切り替え確認用) */
interface DebugOverride {
  weather: WeatherKind | "";
  pressure: PressureTrend | "";
  severe: boolean;
}

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(
    () => loadSave().lastWeather,
  );
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [justCared, setJustCared] = useState<CareAction | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugOverride>({
    weather: "",
    pressure: "",
    severe: false,
  });

  const now = new Date();
  const todayKey = dateKey(now);

  // セーブは変更のたびに永続化(§2: 端末内のみ)
  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = updater(prev);
      persistSave(next);
      return next;
    });
  }, []);

  const refreshWeather = useCallback(
    async (loc: NonNullable<SaveData["location"]>) => {
      setFetchState("loading");
      try {
        const snap = await provider.fetchSnapshot(
          loc.latitude,
          loc.longitude,
          loc.label,
        );
        setSnapshot(snap);
        setFetchState("idle");
        updateSave((prev) => {
          const next = { ...prev, lastWeather: snap, location: loc };
          // 災害級の日を記録(翌日の庭ボーナス判定用、§7)
          if (snap.severe) {
            next.severeDays = {
              ...prev.severeDays,
              [dateKey(new Date())]: snap.weather,
            };
          }
          return next;
        });
      } catch {
        setFetchState("error");
      }
    },
    [updateSave],
  );

  // 起動時: 地点があれば天気を取得(古い場合のみ)。オフライン時は lastWeather で動く(§2)
  useEffect(() => {
    const loc = save.location;
    if (!loc) return;
    const stale =
      !snapshot || Date.now() - snapshot.fetchedAt > WEATHER_STALE_MS;
    if (stale) void refreshWeather(loc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 地点未設定画面 ----
  if (!save.location) {
    return (
      <div className="app setup">
        <h1>くもそだて</h1>
        <p>
          「もこ」はお天気で気分が変わる くもどうぶつ。
          <br />
          まずは住んでいる地域を教えてね。
        </p>
        <div className="preset-grid">
          {PRESET_LOCATIONS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                const loc = { ...p };
                updateSave((prev) => ({ ...prev, location: loc }));
                void refreshWeather(loc);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          className="geo-btn"
          onClick={() => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                // 端末に保存する時点で丸めておき、正確な位置は保持しない
                const loc = {
                  latitude: roundCoordinate(pos.coords.latitude),
                  longitude: roundCoordinate(pos.coords.longitude),
                  label: "現在地",
                };
                updateSave((prev) => ({ ...prev, location: loc }));
                void refreshWeather(loc);
              },
              () => setToast("位置情報が取得できませんでした。都市を選んでね"),
            );
          }}
        >
          📍 現在地を使う
        </button>
        {toast && <p className="toast">{toast}</p>}
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="app setup">
        <h1>くもそだて</h1>
        {fetchState === "error" ? (
          <>
            <p>天気が取得できませんでした。</p>
            <button onClick={() => void refreshWeather(save.location!)}>
              もういちど試す
            </button>
          </>
        ) : (
          <p>お天気を見ています…</p>
        )}
      </div>
    );
  }

  // ---- デバッグ上書きを適用したスナップショット ----
  const effectiveSnapshot: WeatherSnapshot = {
    ...snapshot,
    weather: debug.weather || snapshot.weather,
    severe: debug.severe || snapshot.severe,
    pressureChange6hHpa:
      debug.pressure === "plunging"
        ? -7
        : debug.pressure === "falling"
          ? -4
          : debug.pressure === "stable"
            ? 0
            : snapshot.pressureChange6hHpa,
  };

  const env = judgeEnvironment(effectiveSnapshot);
  const dayPart = judgeDayPart(now.getHours());
  const careDoneToday = save.careLog[todayKey] ?? [];
  const resistance = effectiveResistance(
    character.baseResistance,
    save.resistanceBoost,
    now.getTime(),
  );
  const moodResult = calcMood({
    env,
    character,
    careDoneToday,
    effectiveResistance: resistance,
    dayPart,
  });
  const dialogue = composeDialogue(dialogueDef, {
    env,
    mood: moodResult.mood,
    dayPart,
    needsCare: moodResult.needsCare,
    justCared,
    yesterdayDiff: diffFromYesterday(effectiveSnapshot),
    seed: dialogueSeed(now, dayPart) + careDoneToday.length,
  });

  const weakness = isWeaknessWeather(env.weather, character);
  const harvested = save.harvestedDates[todayKey] ?? false;
  const canHarvest = harvestAllowed(env.severe) && !harvested;

  // 昨日が災害級で、お世話していたら、今日は庭ボーナス(§7)
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yKey = dateKey(yesterdayDate);
  const aftermathWeather = save.severeDays[yKey];
  const aftermathAvailable =
    aftermathWeather !== undefined &&
    (save.careLog[yKey]?.length ?? 0) > 0 &&
    !save.harvestedDates[`aftermath:${todayKey}`];

  // ---- アクション ----
  const doCare = (action: CareAction) => {
    if (careDoneToday.includes(action)) return;
    updateSave((prev) => {
      const done = prev.careLog[todayKey] ?? [];
      const next: SaveData = {
        ...prev,
        careLog: { ...prev.careLog, [todayKey]: [...done, action] },
      };
      if (env.severe) next.disasterCareCount = prev.disasterCareCount + 1;
      else if (weakness && done.length === 0) {
        next.protectCount = prev.protectCount + 1;
      }
      return next;
    });
    setJustCared(action);
    if (env.severe) setToast("そなえてくれてありがとう。おうちで安全に🏅");
    else if (weakness) setToast("守ってあげた!もこはうれしそう");
    else setToast("お世話した!");
    window.setTimeout(() => setJustCared(null), 4000);
  };

  const doHarvest = () => {
    if (!canHarvest) return;
    const result = harvest(env.weather);
    updateSave((prev) => {
      const inv = { ...prev.inventory };
      inv[result.material] = (inv[result.material] ?? 0) + result.amount;
      if (result.bonus) {
        inv[result.bonus.material] =
          (inv[result.bonus.material] ?? 0) + result.bonus.amount;
      }
      return {
        ...prev,
        inventory: inv,
        harvestedDates: { ...prev.harvestedDates, [todayKey]: true },
      };
    });
    const bonusText = result.bonus
      ? ` と ${MATERIAL_NAMES[result.bonus.material]}×${result.bonus.amount}`
      : "";
    setToast(
      `${MATERIAL_NAMES[result.material]}×${result.amount}${bonusText} をあつめた!`,
    );
  };

  const doAftermathHarvest = () => {
    if (!aftermathAvailable || aftermathWeather === undefined) return;
    const result = disasterAftermathHarvest(aftermathWeather);
    updateSave((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        [result.material]:
          (prev.inventory[result.material] ?? 0) + result.amount,
      },
      harvestedDates: {
        ...prev.harvestedDates,
        [`aftermath:${todayKey}`]: true,
      },
    }));
    setToast(
      `きのう守ったごほうび!庭で ${MATERIAL_NAMES[result.material]}×${result.amount} をみつけた`,
    );
  };

  const doFeed = (material: MaterialId) => {
    updateSave((prev) => feed(prev, material, Date.now()));
    setToast(`${MATERIAL_NAMES[material]} をたべさせた`);
  };

  const ownedMaterials = (
    Object.entries(save.inventory) as [MaterialId, number][]
  ).filter(([, n]) => n > 0);

  return (
    <div className={`app ${env.severe ? "severe-bg" : ""}`}>
      {/* ---- 天気ヘッダー ---- */}
      <header className="weather-header">
        <div className="weather-main">
          <span className="weather-emoji">
            {WEATHER_LABELS[env.weather].emoji}
          </span>
          <div>
            <div className="weather-name">
              {WEATHER_LABELS[env.weather].name}
              <span className="location"> @ {snapshot.locationLabel}</span>
            </div>
            <div className="weather-detail">
              {effectiveSnapshot.temperatureC.toFixed(1)}℃(
              {TEMP_LABELS[env.temperature]}) / 湿度
              {Math.round(effectiveSnapshot.humidityPct)}%(
              {HUMIDITY_LABELS[env.humidity]})
            </div>
            <div className="weather-detail">
              気圧 {Math.round(effectiveSnapshot.pressureHpa)}hPa(
              {PRESSURE_LABELS[env.pressure]})
            </div>
          </div>
        </div>
        <button
          className="refresh"
          disabled={fetchState === "loading"}
          onClick={() => void refreshWeather(save.location!)}
        >
          {fetchState === "loading" ? "…" : "🔄"}
        </button>
      </header>

      {fetchState === "error" && (
        <p className="offline-note">
          ⚠ 新しい天気が取れないため、
          {new Date(snapshot.fetchedAt).toLocaleString("ja-JP")}
          時点のデータで表示中
        </p>
      )}

      {/* ---- 災害モード(§7: 通常ロジックを上書き、注意喚起トーン) ---- */}
      {env.severe && (
        <section className="severe-banner">
          <strong>⚠ 激しい天気です</strong>
          <p>
            外出はひかえて、公式の気象情報・自治体の避難情報を確認してください。
          </p>
        </section>
      )}

      {/* ---- キャラ表示 ---- */}
      <main className="character-area">
        <div className="bubble">{dialogue}</div>
        <img
          className="character"
          src={character.sprites[moodResult.sprite]}
          alt={`${character.name}(${MOOD_LABELS[moodResult.mood]})`}
          style={{
            // ふくらみは連続値で描画(§5-5)
            transform: `scale(${0.85 + moodResult.fluff * 0.3})`,
          }}
        />
        <div className="mood-line">
          {character.name} は {MOOD_LABELS[moodResult.mood]}
          {moodResult.needsCare && "(お世話してほしそう…)"}
          {moodResult.protectedToday && !env.severe && "(守ってもらえた!)"}
        </div>
      </main>

      {/* ---- お世話(§5-4: 弱点は行動の要求) ---- */}
      <section className="panel">
        <h2>{env.severe ? "🛡️ いっしょに そなえる" : "🫧 お世話"}</h2>
        {env.severe ? (
          <>
            {DISASTER_TASKS.map((task) => (
              <div key={task.action} className="disaster-task">
                <button
                  disabled={careDoneToday.includes(task.action)}
                  onClick={() => doCare(task.action)}
                >
                  {careDoneToday.includes(task.action) ? "✅ " : ""}
                  {task.label}
                </button>
                <p className="tip">{task.tip}</p>
              </div>
            ))}
            <p className="note">
              そなえた翌日は、庭で素材がみつかるよ(おうちの中でできることだけ!)
            </p>
          </>
        ) : (
          <div className="care-buttons">
            {(Object.keys(CARE_LABELS) as CareAction[]).map((action) => (
              <button
                key={action}
                disabled={careDoneToday.includes(action)}
                onClick={() => doCare(action)}
              >
                {CARE_LABELS[action].emoji} {CARE_LABELS[action].label}
                {careDoneToday.includes(action) && " ✅"}
              </button>
            ))}
          </div>
        )}
        {weakness && !env.severe && !moodResult.protectedToday && (
          <p className="note">
            {WEATHER_LABELS[env.weather].name}
            の日。わたがし質のもこはぬれると溶けそうになるよ。お世話してあげて!
          </p>
        )}
      </section>

      {/* ---- 採取(§6-1、災害日は不可§7) ---- */}
      <section className="panel">
        <h2>🧺 きょうの素材</h2>
        {env.severe ? (
          <p className="note">
            激しい天気の日は、お庭の採取はお休み。おうちでそなえよう。
          </p>
        ) : (
          <button disabled={!canHarvest} onClick={doHarvest}>
            {harvested
              ? "✅ きょうはもう あつめた"
              : `${WEATHER_LABELS[env.weather].emoji} ${
                  MATERIAL_NAMES[harvest(env.weather).material]
                } をあつめる`}
          </button>
        )}
        {aftermathAvailable && (
          <button className="aftermath" onClick={doAftermathHarvest}>
            🏡 きのうのごほうびを庭でさがす
          </button>
        )}
      </section>

      {/* ---- もちもの & ごはん(§6-2) ---- */}
      <section className="panel">
        <h2>🍽️ もちもの</h2>
        {ownedMaterials.length === 0 ? (
          <p className="note">まだ素材がないよ。お天気の日に集めよう</p>
        ) : (
          <ul className="inventory">
            {ownedMaterials.map(([id, count]) => (
              <li key={id}>
                <span>
                  {MATERIAL_NAMES[id]} ×{count}
                </span>
                <span className="effect">
                  {MATERIAL_EFFECTS[id]
                    ? MATERIAL_EFFECTS[id].stat === "wet"
                      ? "湿気につよくなる"
                      : "乾燥につよくなる"
                    : "おいしいだけ"}
                </span>
                <button onClick={() => doFeed(id)}>たべさせる</button>
              </li>
            ))}
          </ul>
        )}
        <div className="resistance">
          <ResistanceBar label="湿気たいせい" value={resistance.wet} />
          <ResistanceBar label="乾燥たいせい" value={resistance.dry} />
        </div>
      </section>

      {/* ---- きろく ---- */}
      <section className="panel">
        <h2>📖 きろく</h2>
        <p className="note">
          守ってあげた日: {save.protectCount}回 / 防災たいおう:{" "}
          {save.disasterCareCount}回
          {save.disasterCareCount >= 3 && " 🏅そなえの達人"}
        </p>
      </section>

      {/* ---- デバッグ(検証用) ---- */}
      <details className="debug">
        <summary>🔧 デバッグ(検証用)</summary>
        <label>
          天気を上書き:
          <select
            value={debug.weather}
            onChange={(e) =>
              setDebug((d) => ({
                ...d,
                weather: e.target.value as DebugOverride["weather"],
              }))
            }
          >
            <option value="">(実際の天気)</option>
            {(Object.keys(WEATHER_LABELS) as WeatherKind[]).map((w) => (
              <option key={w} value={w}>
                {WEATHER_LABELS[w].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          気圧を上書き:
          <select
            value={debug.pressure}
            onChange={(e) =>
              setDebug((d) => ({
                ...d,
                pressure: e.target.value as DebugOverride["pressure"],
              }))
            }
          >
            <option value="">(実際の気圧)</option>
            <option value="stable">安定</option>
            <option value="falling">下降中</option>
            <option value="plunging">急降下</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={debug.severe}
            onChange={(e) =>
              setDebug((d) => ({ ...d, severe: e.target.checked }))
            }
          />
          災害モード
        </label>
        <button
          onClick={() => {
            localStorage.clear();
            setSave(defaultSave());
            setSnapshot(null);
          }}
        >
          セーブデータを初期化
        </button>
      </details>

      <footer className="legal">
        天気データ: Open-Meteo(開発検証用・暫定)。
        表示している気象情報は取得した公式データの提示であり、独自の予報ではありません。
        平年比は過去{effectiveSnapshot.baseline.windowDays}
        日間の平均との比較です。
        位置情報は約1kmに丸めて送信し、それ以外のデータは端末内にのみ保存されます。
      </footer>

      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}

function ResistanceBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="resistance-bar">
      <span>{label}</span>
      <div className="bar">
        <div className="fill" style={{ width: `${value * 100}%` }} />
        {/* 上限8割の目盛り(§6-2: 完全耐性にしない) */}
        <div className="cap" style={{ left: "80%" }} />
      </div>
      <span className="pct">{Math.round(value * 100)}%</span>
    </div>
  );
}
