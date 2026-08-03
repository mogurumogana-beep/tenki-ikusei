import { describe, expect, it } from "vitest";
import { judgeHumidity, judgePressure, judgeTemperature } from "./judge";
import { calcMood } from "./mood";
import {
  disasterAftermathHarvest,
  harvest,
  harvestAllowed,
} from "./materials";
import { decayedBoost, effectiveResistance, feed } from "./resistance";
import { composeDialogue } from "./dialogue";
import { roundCoordinate } from "./geo";
import { buildOutlook } from "./outlook";
import { normalizeSnapshot } from "../state/storage";
import type { DialogueDef } from "./dialogue";
import type { CharacterDef, EnvJudgement, SaveData } from "./types";
import { RESISTANCE } from "./constants";

const moko: CharacterDef = {
  id: "moko",
  name: "もこ",
  constitution: "cottonCandy",
  sprites: {
    normal: "n.webp",
    happy: "h.webp",
    sad: "s.webp",
    wet: "w.webp",
    sleepy: "z.webp",
    umbrella: "u.webp",
    blanket: "b.webp",
    gloomy: "g.webp",
  },
  favoriteWeather: ["sunny", "cloudy"],
  weakWeather: ["rain", "heavyRain", "snow", "thunder"],
  baseResistance: { wet: 0.1, dry: 0.5 },
};

const calmEnv = (over: Partial<EnvJudgement> = {}): EnvJudgement => ({
  weather: "sunny",
  humidity: "normal",
  temperature: "comfortable",
  pressure: "stable",
  severe: false,
  ...over,
});

describe("平年比の判定(§5-1)", () => {
  it("冬の5℃は平年並み(絶対値で判定しない)", () => {
    expect(judgeTemperature(5, 5.5)).toBe("comfortable");
  });
  it("冬の15℃は平年より暑い(変な陽気)", () => {
    expect(judgeTemperature(15, 5.5)).toBe("hot");
  });
  it("沖縄の湿度70%は日常、乾燥地域の70%は多湿", () => {
    expect(judgeHumidity(70, 72)).toBe("normal");
    expect(judgeHumidity(70, 50)).toBe("humid");
  });
});

describe("気圧は変化率で判定(§5-2)", () => {
  it("6hで-3hPa以上は下降中、-6hPa以上は急降下", () => {
    expect(judgePressure(0)).toBe("stable");
    expect(judgePressure(-2.9)).toBe("stable");
    expect(judgePressure(-3)).toBe("falling");
    expect(judgePressure(-6)).toBe("plunging");
  });
});

describe("弱点は行動の要求(§5-4)", () => {
  const rainEnv = calmEnv({ weather: "rain" });
  const base = {
    character: moko,
    effectiveResistance: { wet: 0.1, dry: 0.5 },
    dayPart: "daytime" as const,
  };

  it("雨を放置するとしょんぼり+お世話要求", () => {
    const r = calcMood({ ...base, env: rainEnv, careDoneToday: [] });
    expect(r.mood).toBe("sad");
    expect(r.needsCare).toBe(true);
    expect(r.sprite).toBe("wet");
  });

  it("傘をさしてもらえばダメージなし、むしろプラス", () => {
    const r = calcMood({
      ...base,
      env: rainEnv,
      careDoneToday: ["umbrella"],
    });
    expect(r.score).toBeGreaterThan(0);
    expect(r.needsCare).toBe(false);
    expect(r.protectedToday).toBe(true);
  });

  it("晴れの日は好きな天気でごきげん", () => {
    const r = calcMood({ ...base, env: calmEnv(), careDoneToday: [] });
    expect(r.mood).toBe("happy");
  });

  it("ふくらみは連続値(§5-5)", () => {
    const happy = calcMood({ ...base, env: calmEnv(), careDoneToday: [] });
    const wet = calcMood({ ...base, env: rainEnv, careDoneToday: [] });
    expect(happy.fluff).toBeGreaterThan(wet.fluff);
    expect(happy.fluff).toBeLessThanOrEqual(1);
    expect(wet.fluff).toBeGreaterThanOrEqual(0);
  });
});

describe("耐性(§6-2)", () => {
  const save = (): SaveData => ({
    version: 1,
    characterId: "moko",
    inventory: { shizukumo: 10 },
    fedTotals: {},
    resistanceBoost: { wet: 0, dry: 0, updatedAt: 0 },
    careLog: {},
    harvestedDates: {},
    severeDays: {},
    protectCount: 0,
    disasterCareCount: 0,
    lastWeather: null,
    location: null,
  });

  it("しずくもを食べると湿気耐性が上がり、累積が記録される", () => {
    const next = feed(save(), "shizukumo", 0);
    expect(next.resistanceBoost.wet).toBeCloseTo(RESISTANCE.FEED_GAIN);
    expect(next.fedTotals.shizukumo).toBe(1);
    expect(next.inventory.shizukumo).toBe(9);
  });

  it("時間経過で減衰する", () => {
    const boost = { wet: 0.3, dry: 0, updatedAt: 0 };
    const after10h = decayedBoost(boost, 10 * 60 * 60 * 1000);
    expect(after10h.wet).toBeCloseTo(0.3 - 10 * RESISTANCE.DECAY_PER_HOUR);
  });

  it("実効耐性は上限8割を超えない(完全耐性にしない)", () => {
    const r = effectiveResistance(
      { wet: 0.5, dry: 0.5 },
      { wet: 0.8, dry: 0.8, updatedAt: 0 },
      0,
    );
    expect(r.wet).toBe(RESISTANCE.MAX);
    expect(r.dry).toBe(RESISTANCE.MAX);
  });

  it("在庫がなければ食べさせられない", () => {
    const s = { ...save(), inventory: {} };
    expect(feed(s, "shizukumo", 0)).toBe(s);
  });
});

describe("採取と災害時の反転(§6-1・§7)", () => {
  it("天気ごとに素材が決まり、大雨は大量+レア枠", () => {
    expect(harvest("sunny").material).toBe("watagumo");
    const heavy = harvest("heavyRain");
    expect(heavy.material).toBe("shizukumo");
    expect(heavy.amount).toBeGreaterThan(harvest("rain").amount);
    expect(heavy.bonus).not.toBeNull();
  });

  it("災害級の日は採取不可(外出を促さない)", () => {
    expect(harvestAllowed(true)).toBe(false);
    expect(harvestAllowed(false)).toBe(true);
  });

  it("家で備えた翌日は庭でボーナス", () => {
    const r = disasterAftermathHarvest("heavyRain");
    expect(r.material).toBe("shizukumo");
    expect(r.amount).toBeGreaterThan(0);
  });
});

describe("保存データの読み込み(壊れていても動くこと)", () => {
  // 一度配ったPWAには古い形のデータが残る。読み込みで落ちると
  // 画面が真っ白になり利用者が復旧できないため、ここは必ず守る。
  it("予報を持たない旧データでも空配列で補う", () => {
    const old = {
      fetchedAt: 1,
      locationLabel: "東京",
      weather: "cloudy",
      temperatureC: 23,
      humidityPct: 90,
      pressureHpa: 1006,
      pressureChange6hHpa: 0,
      baseline: { temperatureC: 27, humidityPct: 88, windowDays: 14 },
      yesterday: null,
      severe: false,
    };
    const normalized = normalizeSnapshot(old);
    expect(normalized).not.toBeNull();
    expect(normalized!.hourly).toEqual([]);
    expect(normalized!.daily).toEqual([]);
  });

  it("空配列に補われた天気でも見通しの計算が落ちない", () => {
    const normalized = normalizeSnapshot({
      fetchedAt: 1,
      locationLabel: "東京",
      weather: "sunny",
      temperatureC: 20,
      humidityPct: 50,
      pressureHpa: 1013,
      baseline: { temperatureC: 20, humidityPct: 50, windowDays: 14 },
    })!;
    const outlook = buildOutlook(normalized);
    expect(outlook.shouldPrepare).toBe(false);
    expect(outlook.maxRainChance).toBe(0);
  });

  it("判定に必要な値が欠けたデータは捨てる(取得し直させる)", () => {
    expect(normalizeSnapshot(null)).toBeNull();
    expect(normalizeSnapshot({ weather: "sunny" })).toBeNull();
    expect(normalizeSnapshot("こわれたデータ")).toBeNull();
  });
});

describe("座標のプライバシー", () => {
  it("正確な座標を約1kmに丸める", () => {
    expect(roundCoordinate(35.68123456)).toBe(35.68);
    expect(roundCoordinate(139.76719)).toBe(139.77);
  });

  it("南半球・西経(負の値)でも丸まる", () => {
    expect(roundCoordinate(-33.86887)).toBe(-33.87);
    expect(roundCoordinate(-151.20929)).toBe(-151.21);
  });

  it("丸めた座標を再度丸めても変わらない", () => {
    const once = roundCoordinate(35.68123456);
    expect(roundCoordinate(once)).toBe(once);
  });
});

describe("セリフ(§7・§8)", () => {
  const def: DialogueDef = {
    base: {
      sunny: { happy: ["ふくらむ〜"], neutral: ["はれ"] },
      rain: { neutral: ["あめ だねえ"] },
    },
    untreated: ["…しみてきた"],
    cared: { umbrella: ["かさ、ありがと"] },
    severe: ["そとには でないでね"],
    modifiers: {
      pressureFalling: [],
      pressurePlunging: [],
      hot: [],
      cold: [],
      dry: [],
      humid: [],
      night: [],
      morning: [],
      humidThanYesterday: [],
      dryThanYesterday: [],
    },
    personality: { replace: [] },
  };
  const input = {
    mood: "neutral" as const,
    dayPart: "daytime" as const,
    needsCare: false,
    justCared: null,
    yesterdayDiff: null,
    seed: 42,
  };

  it("災害時は必ず注意喚起のセリフになる(キャラに安全宣言をさせない)", () => {
    const line = composeDialogue(def, {
      ...input,
      env: calmEnv({ weather: "sunny", severe: true }),
    });
    expect(def.severe).toContain(line);
  });

  it("放置時は untreated、お世話直後は cared のセリフ", () => {
    expect(
      composeDialogue(def, {
        ...input,
        env: calmEnv({ weather: "rain" }),
        needsCare: true,
      }),
    ).toBe("…しみてきた");
    expect(
      composeDialogue(def, {
        ...input,
        env: calmEnv({ weather: "rain" }),
        justCared: "umbrella",
      }),
    ).toBe("かさ、ありがと");
  });

  it("同じ種なら同じセリフ(描画ごとに揺れない)", () => {
    const a = composeDialogue(def, { ...input, env: calmEnv() });
    const b = composeDialogue(def, { ...input, env: calmEnv() });
    expect(a).toBe(b);
  });
});
