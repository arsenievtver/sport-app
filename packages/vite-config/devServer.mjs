import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CERT_DIR = path.join(REPO_ROOT, ".dev/certs");

/** @type {Record<string, import('vite').ProxyOptions>} */
export const API_PROXY = {
  "/api/v1": {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
  },
};

function readHttpsCredentials() {
  const certPath = path.join(CERT_DIR, "cert.pem");
  const keyPath = path.join(CERT_DIR, "key.pem");
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return undefined;
  }
  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
}

/**
 * @param {{ port: number; devHost?: string; proxy?: Record<string, import('vite').ProxyOptions> }} options
 * @returns {import('vite').ServerOptions}
 */
export function createDevServer(options) {
  const { port, devHost, proxy } = options;
  const https = readHttpsCredentials();

  return {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    ...(https ? { https } : {}),
    ...(proxy ? { proxy } : {}),
    ...(devHost
      ? {
          hmr: {
            host: devHost,
            clientPort: port,
            ...(https ? { protocol: "wss" } : {}),
          },
        }
      : {}),
  };
}

export function devUsesHttps() {
  return fs.existsSync(path.join(CERT_DIR, "cert.pem"));
}
