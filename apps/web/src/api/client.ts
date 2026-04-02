import type { AlertEvent, SessionRecord, SystemEvent, TelemetrySnapshot } from "../types/telemetry";
import type {
  AppSettingsSnapshot,
  AppSettingsUpdate,
  DeviceHeartbeatReport,
  DeviceStateSnapshot,
  SyncTestControls,
} from "../types/appSettings";
import {
  buildApiUrl,
  resolveApiMediaUrl as resolveApiMediaUrlFromConfig,
  resolveTelemetryWebSocketUrl,
  type ApiRuntimeConfig,
} from "./network";

const runtimeApiConfig: ApiRuntimeConfig = {
  explicitApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  apiPort: import.meta.env.VITE_API_PORT,
};

function buildUrl(path: string): string {
  return buildApiUrl(path, runtimeApiConfig);
}

export function resolveApiMediaUrl(path: string | null | undefined): string | null {
  return resolveApiMediaUrlFromConfig(path, runtimeApiConfig);
}

function extractErrorDetail(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim() !== "") {
    return payload;
  }

  if (Array.isArray(payload)) {
    const messages = payload
      .map((item) => extractErrorDetail(item))
      .filter((message): message is string => Boolean(message));
    return messages.length > 0 ? messages.join(" ") : null;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.msg === "string" && record.msg.trim() !== "") {
      return record.msg;
    }
    if ("detail" in record) {
      return extractErrorDetail(record.detail);
    }
  }

  return null;
}

async function buildResponseError(response: Response, fallback: string): Promise<Error> {
  let detail: string | null = null;

  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      detail = extractErrorDetail((await response.json()) as unknown);
    } else {
      detail = extractErrorDetail(await response.text());
    }
  } catch {
    detail = null;
  }

  return new Error(detail ? `${fallback} ${detail}` : `${fallback} (${response.status})`);
}

export async function fetchLatestTelemetry(): Promise<TelemetrySnapshot | null> {
  const response = await fetch(buildUrl("/api/v1/telemetry/latest"));
  if (!response.ok) {
    throw await buildResponseError(response, "Failed to fetch latest telemetry.");
  }
  return response.json();
}

export async function fetchRecentAlerts(limit = 20): Promise<AlertEvent[]> {
  const response = await fetch(buildUrl(`/api/v1/alerts/recent?limit=${limit}`));
  if (!response.ok) {
    throw await buildResponseError(response, "Failed to fetch recent alerts.");
  }
  return response.json();
}

export async function fetchRecentEvents(limit = 20): Promise<SystemEvent[]> {
  const response = await fetch(buildUrl(`/api/v1/events/recent?limit=${limit}`));
  if (!response.ok) {
    throw await buildResponseError(response, "Failed to fetch recent events.");
  }
  return response.json();
}

export async function fetchCurrentSession(): Promise<SessionRecord | null> {
  const response = await fetch(buildUrl("/api/v1/session/current"));
  if (!response.ok) {
    throw await buildResponseError(response, "Failed to fetch current session.");
  }
  return response.json();
}

export async function fetchAppSettings(): Promise<AppSettingsSnapshot> {
  const response = await fetch(buildUrl("/api/v1/settings"));
  if (!response.ok) {
    throw await buildResponseError(response, "Failed to fetch app settings.");
  }
  return response.json();
}

export async function fetchDeviceRuntime(): Promise<DeviceStateSnapshot> {
  const response = await fetch(buildUrl("/api/v1/device/runtime"));
  if (!response.ok) {
    throw await buildResponseError(response, "Failed to fetch device runtime.");
  }
  return response.json();
}

export async function fetchDefaultAppSettings(): Promise<AppSettingsUpdate> {
  const response = await fetch(buildUrl("/api/v1/settings/defaults"));
  if (!response.ok) {
    throw await buildResponseError(response, "Failed to fetch default app settings.");
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
    throw await buildResponseError(response, "Failed to update app settings.");
  }
  return response.json();
}

export async function updateSettingsSyncTestControls(
  payload: SyncTestControls,
): Promise<AppSettingsSnapshot> {
  const response = await fetch(buildUrl("/api/v1/settings/sync-test"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await buildResponseError(response, "Failed to update sync test controls.");
  }
  return response.json();
}

export async function applyPendingSettingsToDevice(): Promise<AppSettingsSnapshot> {
  const response = await fetch(buildUrl("/api/v1/settings/sync-test/apply"), {
    method: "POST",
  });
  if (!response.ok) {
    throw await buildResponseError(response, "Failed to apply pending device settings.");
  }
  return response.json();
}

export async function postDeviceRuntimeHeartbeat(
  payload: DeviceHeartbeatReport,
): Promise<DeviceStateSnapshot> {
  const response = await fetch(buildUrl("/api/v1/device/runtime/heartbeat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await buildResponseError(response, "Failed to report device runtime heartbeat.");
  }
  return response.json();
}

export function openTelemetrySocket(): WebSocket {
  return new WebSocket(resolveTelemetryWebSocketUrl("/ws/telemetry", runtimeApiConfig));
}
