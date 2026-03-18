import type { AlertEvent, SessionRecord, TelemetrySnapshot } from "../types/telemetry";
import type { AppSettingsSnapshot, AppSettingsUpdate } from "../types/appSettings";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function buildUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

function buildWebSocketUrl(path: string): string {
  const url = new URL(apiBaseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = path;
  url.search = "";
  return url.toString();
}

export async function fetchLatestTelemetry(): Promise<TelemetrySnapshot | null> {
  const response = await fetch(buildUrl("/api/v1/telemetry/latest"));
  if (!response.ok) {
    throw new Error(`Failed to fetch latest telemetry: ${response.status}`);
  }
  return response.json();
}

export async function fetchRecentAlerts(limit = 20): Promise<AlertEvent[]> {
  const response = await fetch(buildUrl(`/api/v1/alerts/recent?limit=${limit}`));
  if (!response.ok) {
    throw new Error(`Failed to fetch recent alerts: ${response.status}`);
  }
  return response.json();
}

export async function fetchCurrentSession(): Promise<SessionRecord | null> {
  const response = await fetch(buildUrl("/api/v1/session/current"));
  if (!response.ok) {
    throw new Error(`Failed to fetch current session: ${response.status}`);
  }
  return response.json();
}

export async function fetchAppSettings(): Promise<AppSettingsSnapshot> {
  const response = await fetch(buildUrl("/api/v1/settings"));
  if (!response.ok) {
    throw new Error(`Failed to fetch app settings: ${response.status}`);
  }
  return response.json();
}

export async function updateAppSettings(payload: AppSettingsUpdate): Promise<AppSettingsSnapshot> {
  const response = await fetch(buildUrl("/api/v1/settings"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to update app settings: ${response.status}`);
  }
  return response.json();
}

export function openTelemetrySocket(): WebSocket {
  return new WebSocket(buildWebSocketUrl("/ws/telemetry"));
}
