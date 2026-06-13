import react from "@vitejs/plugin-react";
import { API_PROXY, createDevServer } from "@sport-app/vite-config";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devHost = env.VITE_DEV_HOST;
  const port = 5175;

  return {
    plugins: [react()],
    server: createDevServer({ port, devHost, proxy: API_PROXY }),
  };
});
