export interface BrowserLocationLike {
  protocol: string;
  hostname: string;
}

export interface ApiRuntimeConfig {
  explicitApiBaseUrl?: string | null;
  apiPort?: string | number | null;
  location?: BrowserLocationLike | null;
}

const DEFAULT_API_PORT = "8000";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function normalizePort(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return DEFAULT_API_PORT;
  }

  const trimmed = String(value).trim();
  return trimmed === "" ? DEFAULT_API_PORT : trimmed;
}

function currentBrowserLocation(): BrowserLocationLike | null {
  if (typeof window === "undefined" || !window.location) {
    return null;
  }

  return {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
  };
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, `${normalizeBaseUrl(baseUrl)}/`).toString();
}

export function resolveApiBaseUrl(config: ApiRuntimeConfig = {}): string {
  const explicitApiBaseUrl = config.explicitApiBaseUrl?.trim();
  if (explicitApiBaseUrl) {
    return normalizeBaseUrl(explicitApiBaseUrl);
  }

  const location = config.location ?? currentBrowserLocation();
  const apiPort = normalizePort(config.apiPort);

  if (location?.protocol && location.hostname) {
    return normalizeBaseUrl(`${location.protocol}//${location.hostname}:${apiPort}`);
  }

  return normalizeBaseUrl(`http://localhost:${apiPort}`);
}

export function buildApiUrl(path: string, config: ApiRuntimeConfig = {}): string {
  return joinUrl(resolveApiBaseUrl(config), path);
}

export function resolveApiMediaUrl(
  path: string | null | undefined,
  config: ApiRuntimeConfig = {},
): string | null {
  if (!path) {
    return null;
  }

  return joinUrl(resolveApiBaseUrl(config), path);
}

export function resolveTelemetryWebSocketUrl(
  path = "/ws/telemetry",
  config: ApiRuntimeConfig = {},
): string {
  const url = new URL(buildApiUrl(path, config));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
