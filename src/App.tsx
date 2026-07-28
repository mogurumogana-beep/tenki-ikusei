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
import { buildOutlook, outlookHint } from "./logic/outlook";
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
import { assetUrl } from "./ui/assets";
import {
  HourlyStrip,
  MaterialOutlook,
  WeeklyForecast,
} from "./ui/Forecast";
import { WeatherIcon } from "./ui/WeatherIcon";
import { WeatherScene } from "./ui/WeatherScene";
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

type Tab = "home" | "food" | "weather" | "record";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "おうち", icon: "🏡" },
  { id: "food", label: "ごはん", icon: "🍽️" },
  { id: "weather", label: "てんき", icon: "🌤️" },
  { id: "record", label: "きろく", icon: "📖" },
];

/** デバッグ用の状況上書き(検証用) */
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
  const [tab, setTab] = useState<Tab>("home");
  const [debug, setDebug] = useState<DebugOverride>({
    weather: "",
    pressure: "",
    severe: false,
  });

  const now = new Date();
  const todayKey = dateKey(now);

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

  useEffect(() => {
    const loc = save.location;
    if (!loc) return;
    const stale =
      !snapshot || Date.now() - snapshot.fetchedAt > WEATHER_STALE_MS;
    if (stale) void refreshWeather(loc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 地点未設定 ----
  if (!save.location) {
    return (
      <div className="app setup">
        <div className="setup-inner">
          <img
            className="setup-char"
            src={assetUrl(character.sprites.happy)}
            alt=""
          />
          <h1>くもそだて</h1>
          <p className="setup-lead">
            「もこ」は お天気で 気分が変わる くもどうぶつ。
            <br />
            住んでいる地域を おしえてね。
          </p>
          <div className="preset-grid">
            {PRESET_LOCATIONS.map((p) => (
              <button
                key={p.label}
                className="btn chip"
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
            className="btn primary wide"
            onClick={() => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const loc = {
                    latitude: roundCoordinate(pos.coords.latitude),
                    longitude: roundCoordinate(pos.coords.longitude),
                    label: "現在地",
                  };
                  updateSave((prev) => ({ ...prev, location: loc }));
                  void refreshWeather(loc);
                },
                () => setToast("位置情報が取れませんでした。都市を選んでね"),
              );
            }}
          >
            📍 現在地を つかう
          </button>
          {toast && <p className="toast-inline">{toast}</p>}
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="app setup">
        <div className="setup-inner">
          <img
            className="setup-char floating"
            src={assetUrl(character.sprites.sleepy)}
            alt=""
          />
          {fetchState === "error" ? (
            <>
              <p>天気が とれませんでした。</p>
              <button
                className="btn primary"
                onClick={() => void refreshWeather(save.location!)}
              >
                もういちど ためす
              </button>
            </>
          ) : (
            <p>お天気を みています…</p>
          )}
        </div>
      </div>
    );
  }

  // ---- 状態の計算 ----
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
  const outlook = buildOutlook(effectiveSnapshot);
  const hint = env.severe ? null : outlookHint(outlook);
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

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yKey = dateKey(yesterdayDate);
  const aftermathWeather = save.severeDays[yKey];
  const aftermathAvailable =
    aftermathWeather !== undefined &&
    (save.careLog[yKey]?.length ?? 0) > 0 &&
    !save.harvestedDates[`aftermath:${todayKey}`];

  const totalMaterials = Object.values(save.inventory).reduce(
    (a, b) => a + (b ?? 0),
    0,
  );

  // ---- アクション ----
  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  };

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
    if (env.severe) showToast("そなえてくれて ありがとう 🏅");
    else if (weakness) showToast("まもってあげた! もこは うれしそう ✨");
    else showToast("お世話した!");
    window.setTimeout(() => setJustCared(null), 5000);
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
    showToast(
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
    showToast(
      `きのう まもった ごほうび! ${MATERIAL_NAMES[result.material]}×${result.amount}`,
    );
  };

  const doFeed = (material: MaterialId) => {
    updateSave((prev) => feed(prev, material, Date.now()));
    showToast(`${MATERIAL_NAMES[material]} を たべさせた`);
  };

  const ownedMaterials = (
    Object.entries(save.inventory) as [MaterialId, number][]
  ).filter(([, n]) => n > 0);

  return (
    <div className={`app game ${env.severe ? "is-severe" : ""}`}>
      {/* ===== 上部シーン ===== */}
      <section className="scene">
        <WeatherScene
          weather={env.weather}
          dayPart={dayPart}
          severe={env.severe}
        />

        {/* HUD */}
        <header className="hud">
          <button
            className="hud-weather"
            onClick={() => setTab("weather")}
            aria-label="天気の詳細を見る"
          >
            <WeatherIcon
              weather={env.weather}
              size={34}
              night={dayPart === "night"}
            />
            <span className="hud-temp">
              {Math.round(effectiveSnapshot.temperatureC)}°
            </span>
            <span className="hud-meta">
              <span className="hud-place">{snapshot.locationLabel}</span>
              <span className="hud-kind">
                {WEATHER_LABELS[env.weather].name}
              </span>
            </span>
          </button>
          <div className="hud-right">
            <span className="hud-badge" title="もっている素材">
              🧺 {totalMaterials}
            </span>
            <button
              className="hud-refresh"
              disabled={fetchState === "loading"}
              onClick={() => void refreshWeather(save.location!)}
              aria-label="天気を更新"
            >
              {fetchState === "loading" ? "…" : "⟳"}
            </button>
          </div>
        </header>

        {/* 時間別予報 */}
        <HourlyStrip
          hours={effectiveSnapshot.hourly}
          nowTemperatureC={effectiveSnapshot.temperatureC}
          nowWeather={env.weather}
        />

        {/* 災害バナー(§7: 盛り上げず、はっきり伝える) */}
        {env.severe && (
          <div className="severe-banner">
            <strong>⚠ はげしい天気です</strong>
            <span>
              外出はひかえて、気象庁・自治体の最新情報を確認してください。
            </span>
          </div>
        )}

        {/* 先回りの声かけ(§5-4) */}
        {!env.severe && hint && (
          <div className="hint-chip">
            <span className="hint-icon">☂</span>
            {hint}
          </div>
        )}

        {/* キャラクター */}
        <div className="stage">
          <div className="bubble">{dialogue}</div>
          <div className="char-wrap">
            <img
              className={`character ${moodResult.mood} ${
                moodResult.needsCare ? "needs-care" : ""
              }`}
              src={assetUrl(character.sprites[moodResult.sprite])}
              alt={`${character.name}(${MOOD_LABELS[moodResult.mood]})`}
              style={{
                // ふくらみ具合は連続値で描画(§5-5)
                transform: `scale(${0.9 + moodResult.fluff * 0.22})`,
              }}
            />
            <div className="char-shadow" />
          </div>
          <div className="mood-tag">
            <span className={`mood-dot ${moodResult.mood}`} />
            {MOOD_LABELS[moodResult.mood]}
            {moodResult.needsCare && " — おせわ してほしそう"}
          </div>
        </div>

        {/* お世話ドック */}
        <div className="care-dock">
          {env.severe
            ? DISASTER_TASKS.map((t) => (
                <button
                  key={t.action}
                  className={`care-btn wide ${
                    careDoneToday.includes(t.action) ? "done" : ""
                  }`}
                  onClick={() => doCare(t.action)}
                  disabled={careDoneToday.includes(t.action)}
                >
                  <span className="care-emoji">
                    {careDoneToday.includes(t.action) ? "✅" : "🛡️"}
                  </span>
                  <span className="care-label">{t.label}</span>
                </button>
              ))
            : (Object.keys(CARE_LABELS) as CareAction[]).map((action) => (
                <button
                  key={action}
                  className={`care-btn ${
                    careDoneToday.includes(action) ? "done" : ""
                  } ${moodResult.needsCare ? "urgent" : ""}`}
                  onClick={() => doCare(action)}
                  disabled={careDoneToday.includes(action)}
                >
                  <span className="care-emoji">
                    {CARE_LABELS[action].emoji}
                  </span>
                  <span className="care-label">
                    {CARE_LABELS[action].label}
                  </span>
                  {careDoneToday.includes(action) && (
                    <span className="care-check">✓</span>
                  )}
                </button>
              ))}
        </div>
      </section>

      {/* ===== 下部パネル ===== */}
      <main className="sheet">
        {fetchState === "error" && (
          <p className="offline-note">
            ⚠ 新しい天気が とれないため、
            {new Date(snapshot.fetchedAt).toLocaleString("ja-JP")}
            時点のデータで表示中
          </p>
        )}

        {tab === "home" && (
          <>
            <Card title="きょうの さいしゅ" icon="🧺">
              {env.severe ? (
                <p className="note">
                  はげしい天気の日は、お庭の採取はおやすみ。
                  おうちの中でできる そなえを しよう。
                </p>
              ) : (
                <button
                  className="btn primary wide harvest"
                  disabled={!canHarvest}
                  onClick={doHarvest}
                >
                  {harvested ? (
                    "✅ きょうは もう あつめた"
                  ) : (
                    <>
                      <WeatherIcon weather={env.weather} size={26} />
                      {MATERIAL_NAMES[harvest(env.weather).material]} を あつめる
                    </>
                  )}
                </button>
              )}
              {aftermathAvailable && (
                <button className="btn reward wide" onClick={doAftermathHarvest}>
                  🏡 きのうの ごほうびを 庭でさがす
                </button>
              )}
            </Card>

            <Card title="この先の 素材" icon="🔮">
              <MaterialOutlook days={effectiveSnapshot.daily} />
              <p className="note">
                天気で採れるものが 変わるよ。予報を見て たのしみに待とう
              </p>
            </Card>

            <StatusCard
              env={env}
              snapshot={effectiveSnapshot}
              resistance={resistance}
            />
          </>
        )}

        {tab === "food" && (
          <>
            <Card title="もちもの" icon="🧺">
              {ownedMaterials.length === 0 ? (
                <p className="note">
                  まだ素材がないよ。「おうち」タブで あつめよう
                </p>
              ) : (
                <div className="item-grid">
                  {ownedMaterials.map(([id, count]) => (
                    <div key={id} className="item-card">
                      <span className="item-count">×{count}</span>
                      <span className="item-name">{MATERIAL_NAMES[id]}</span>
                      <span className="item-effect">
                        {MATERIAL_EFFECTS[id]
                          ? MATERIAL_EFFECTS[id]!.stat === "wet"
                            ? "湿気に つよくなる"
                            : "乾燥に つよくなる"
                          : "おいしいだけ"}
                      </span>
                      <button className="btn small" onClick={() => doFeed(id)}>
                        たべさせる
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="たいせい" icon="💪">
              <ResistanceBar label="湿気たいせい" value={resistance.wet} />
              <ResistanceBar label="乾燥たいせい" value={resistance.dry} />
              <p className="note">
                素材を食べると上がるけど、時間がたつと ゆっくり戻るよ。
                最大80%まで(完全には強くならない)
              </p>
            </Card>
          </>
        )}

        {tab === "weather" && (
          <>
            <Card title="いまの ようす" icon="🌡️">
              <dl className="detail-list">
                <div>
                  <dt>気温</dt>
                  <dd>
                    {effectiveSnapshot.temperatureC.toFixed(1)}℃
                    <span className="sub">{TEMP_LABELS[env.temperature]}</span>
                  </dd>
                </div>
                <div>
                  <dt>湿度</dt>
                  <dd>
                    {Math.round(effectiveSnapshot.humidityPct)}%
                    <span className="sub">{HUMIDITY_LABELS[env.humidity]}</span>
                  </dd>
                </div>
                <div>
                  <dt>気圧</dt>
                  <dd>
                    {Math.round(effectiveSnapshot.pressureHpa)}hPa
                    <span className={`sub ${env.pressure}`}>
                      {PRESSURE_LABELS[env.pressure]}
                    </span>
                  </dd>
                </div>
              </dl>
              {outlook.tempMaxC !== null && (
                <p className="note">
                  これから12時間: {Math.round(outlook.tempMinC!)}℃ 〜{" "}
                  {Math.round(outlook.tempMaxC)}℃ / 最大降水確率{" "}
                  {outlook.maxRainChance}%
                </p>
              )}
            </Card>

            <Card title="時間別" icon="🕐">
              <HourlyStrip
                hours={effectiveSnapshot.hourly}
                nowTemperatureC={effectiveSnapshot.temperatureC}
                nowWeather={env.weather}
              />
            </Card>

            <Card title="週間予報" icon="📅">
              <WeeklyForecast days={effectiveSnapshot.daily} />
            </Card>
          </>
        )}

        {tab === "record" && (
          <>
            <Card title="きろく" icon="📖">
              <div className="record-grid">
                <div className="record-cell">
                  <span className="record-num">{save.protectCount}</span>
                  <span className="record-label">まもった日</span>
                </div>
                <div className="record-cell">
                  <span className="record-num">{save.disasterCareCount}</span>
                  <span className="record-label">防災たいおう</span>
                </div>
                <div className="record-cell">
                  <span className="record-num">
                    {Object.values(save.fedTotals).reduce(
                      (a, b) => a + (b ?? 0),
                      0,
                    )}
                  </span>
                  <span className="record-label">たべた素材</span>
                </div>
              </div>
              {save.disasterCareCount >= 3 && (
                <p className="medal">🏅 そなえの達人</p>
              )}
              {save.protectCount >= 5 && <p className="medal">🏅 まもりびと</p>}
            </Card>

            <Card title="せってい" icon="⚙️">
              <button
                className="btn wide"
                onClick={() => {
                  updateSave((prev) => ({ ...prev, location: null }));
                  setSnapshot(null);
                }}
              >
                📍 地域を えらびなおす
              </button>
            </Card>

            <details className="debug-card">
              <summary>🔧 デバッグ(検証用)</summary>
              <label>
                天気を上書き
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
                気圧を上書き
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
              <label className="check">
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
                className="btn small danger"
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
              表示している気象情報は取得した公式予報の提示であり、
              独自の予報ではありません。平年比は過去
              {effectiveSnapshot.baseline.windowDays}日間の平均との比較です。
              位置情報は約1kmに丸めて送信し、それ以外のデータは端末内にのみ保存されます。
            </footer>
          </>
        )}
      </main>

      {/* ===== タブバー ===== */}
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
            {t.id === "home" && canHarvest && <span className="tab-dot" />}
            {t.id === "home" && moodResult.needsCare && (
              <span className="tab-dot urgent" />
            )}
          </button>
        ))}
      </nav>

      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <h2>
        <span className="card-icon">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusCard({
  env,
  snapshot,
  resistance,
}: {
  env: ReturnType<typeof judgeEnvironment>;
  snapshot: WeatherSnapshot;
  resistance: { wet: number; dry: number };
}) {
  return (
    <section className="card">
      <h2>
        <span className="card-icon">📊</span>
        もこの ちょうし
      </h2>
      <div className="chip-row">
        <span className="stat-chip">
          {TEMP_LABELS[env.temperature]}
          <em>{snapshot.temperatureC.toFixed(1)}℃</em>
        </span>
        <span className="stat-chip">
          {HUMIDITY_LABELS[env.humidity]}
          <em>{Math.round(snapshot.humidityPct)}%</em>
        </span>
        <span className={`stat-chip ${env.pressure}`}>
          気圧{PRESSURE_LABELS[env.pressure]}
        </span>
      </div>
      <ResistanceBar label="湿気たいせい" value={resistance.wet} />
      <ResistanceBar label="乾燥たいせい" value={resistance.dry} />
    </section>
  );
}

function ResistanceBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="resistance-bar">
      <span className="rb-label">{label}</span>
      <span className="bar">
        <span className="fill" style={{ width: `${value * 100}%` }} />
        {/* 上限8割の目盛り(§6-2: 完全耐性にしない) */}
        <span className="cap" style={{ left: "80%" }} />
      </span>
      <span className="rb-pct">{Math.round(value * 100)}%</span>
    </div>
  );
}
