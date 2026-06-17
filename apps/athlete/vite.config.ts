import react from "@vitejs/plugin-react";
import { API_PROXY, createDevServer } from "@sport-app/vite-config";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devHost = env.VITE_DEV_HOST;
  const port = 5173;

  return {
    build: { minify: "esbuild" },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg"],
        manifest: {
          id: "/",
          name: "sport-app — Атлет",
          short_name: "Атлет",
          description: "Тренировки и прогресс для атлета",
          theme_color: "#080506",
          background_color: "#ff3355",
          display: "standalone",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "icon.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "icon.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    server: createDevServer({ port, devHost, proxy: API_PROXY }),
  };
});
