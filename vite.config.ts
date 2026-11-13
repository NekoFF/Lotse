/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages: Projektseite unter https://nekoff.github.io/Lotse/, die App unter /Lotse/app/.
export default defineConfig({
  base: "/Lotse/app/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Die KI-Bibliothek (~6 MB) wird nur geladen, wenn jemand die KI einschaltet – nicht für alle vorab speichern
      workbox: { globIgnores: ["**/ki-*.js"] },
      includeAssets: ["apple-touch-icon.png", "favicon.png"],
      manifest: {
        name: "Lotse",
        short_name: "Lotse",
        description: "Vom Anliegen bis zur Tür.",
        lang: "de",
        start_url: "/Lotse/app/",
        scope: "/Lotse/app/",
        display: "standalone",
        background_color: "#f2f2f7",
        theme_color: "#2447e6",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes("@mlc-ai") ? "ki" : undefined) },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
