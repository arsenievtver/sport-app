import type { ProxyOptions, ServerOptions } from "vite";

export declare const API_PROXY: Record<string, ProxyOptions>;

export declare function createDevServer(options: {
  port: number;
  devHost?: string;
  proxy?: Record<string, ProxyOptions>;
}): ServerOptions;

export declare function devUsesHttps(): boolean;
