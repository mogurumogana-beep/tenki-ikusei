/**
 * 配信URLの解決。
 * GitHub Pages のようなサブパス配信(/tenki-ikusei/)でも壊れないよう、
 * キャラJSONの画像パスは先頭スラッシュなしで持ち、ここで base を足す。
 */
export function assetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${relativePath.replace(/^\//, "")}`;
}
