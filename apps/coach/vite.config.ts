import react from "@vitejs/plugin-react";
import { API_PROXY, createDevServer } from "@sport-app/vite-config";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devHost = env.VITE_DEV_HOST;
  const port = 5174;

  return {
    build: { minify: "esbuild" },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "sport-app — Coach",
          short_name: "Coach",
          description: "Мобильный кабинет тренера",
          theme_color: "#0c0f14",
          background_color: "#0c0f14",
          display: "standalone",
          start_url: "/",
          icons: [{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" }],
        },
      }),
    ],
    server: createDevServer({ port, devHost, proxy: API_PROXY }),
  };
});
