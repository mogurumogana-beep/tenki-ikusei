import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages等のサブパス配信用。例: VITE_BASE=/tenki-ikusei/ npm run build
  base: process.env.VITE_BASE || "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "くもそだて",
        short_name: "くもそだて",
        description: "天気と連動する育成アプリ",
        theme_color: "#aee1f9",
        background_color: "#f2f8fc",
        display: "standalone",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        // 天気APIのレスポンスはアプリ側でlocalStorageにキャッシュするため
        // SWでは静的アセットのみ扱う
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
      },
    }),
  ],
  test: {
    environment: "node",
  },
} as Parameters<typeof defineConfig>[0]);
