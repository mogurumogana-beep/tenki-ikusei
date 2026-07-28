/**
 * アップロードされた透過PNGを、余白トリム + リサイズ + WebP化して
 * public/assets/moko/ に取り込む。
 *
 * 使い方: node scripts/import-art.mjs
 *
 * WebPを使う理由: 透過を保ったままPNGの半分以下になる。
 * iOS Safari 14+ / Android Chrome で対応済みのため、フォールバックは持たない。
 */
import sharp from "sharp";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC =
  process.argv[2] ??
  "C:/Users/masaya/.claude/uploads/0c4f1487-25fb-4fd3-a3f3-f38627691574";
const DEST = path.join(here, "..", "public", "assets", "moko");

/** 元ファイル名 → 状態名 */
const MAP = {
  "c32e6968-1426.png": "normal", // ふつうに立っている
  "1dbef2d0-1423.png": "happy", // ふくらんで にっこり
  "31ce3ecf-1425.png": "sad", // しぼんで ぺたん
  "9cf05f2f-1428.png": "wet", // 溶けかけ、水たまり
  "ca62f1b1-1430.png": "sleepy", // ねむり
  "73fe22ce-1424.png": "umbrella", // かさをさしてもらった
  "4ee954fb-1427.png": "blanket", // くるまれた(拭いた/室内)
  "e7b7bfea-1429.png": "gloomy", // 気圧でぐったり
};

const MAX_WIDTH = 620;

await mkdir(DEST, { recursive: true });
const available = new Set(await readdir(SRC));

for (const [file, name] of Object.entries(MAP)) {
  if (!available.has(file)) {
    console.warn(`skip (not found): ${file}`);
    continue;
  }
  const input = sharp(path.join(SRC, file));

  // 透過部分を削って、キャラの実寸に合わせる
  const trimmed = input.trim({ threshold: 2 });
  const buf = await trimmed.toBuffer();
  const meta = await sharp(buf).metadata();

  const resized = sharp(buf).resize({
    width: Math.min(MAX_WIDTH, meta.width ?? MAX_WIDTH),
    withoutEnlargement: true,
  });

  const info = await resized
    .webp({ quality: 86, effort: 6 })
    .toFile(path.join(DEST, `${name}.webp`));

  console.log(
    `${name.padEnd(9)} ${info.width}x${info.height}  ${(
      info.size / 1024
    ).toFixed(0)}KB`,
  );
}
