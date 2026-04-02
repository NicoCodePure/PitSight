import { useEffect } from "react";

import { postDeviceRuntimeHeartbeat } from "../api/client";
import type { DashboardMode } from "../types/appSettings";
import type { TelemetrySnapshot } from "../types/telemetry";

const HEARTBEAT_INTERVAL_MS = 5000;

function isDeviceRuntimeEnabled(search: string): boolean {
  if (import.meta.env.VITE_DEVICE_RUNTIME_ENABLED === "true") {
    return true;
  }
  const params = new URLSearchParams(search);
  return params.get("deviceRuntime") === "1";
}

interface DeviceRuntimeHeartbeatArgs {
  activeDashboardMode: DashboardMode | null;
  snapshot: TelemetrySnapshot | null;
  search: string;
}

export function useDeviceRuntimeHeartbeat({
  activeDashboardMode,
  snapshot,
  search,
}: DeviceRuntimeHeartbeatArgs): void {
  useEffect(() => {
    if (activeDashboardMode === null || !isDeviceRuntimeEnabled(search)) {
      return;
    }

    let active = true;

    const sendHeartbeat = async () => {
      try {
        await postDeviceRuntimeHeartbeat({
          current_dashboard_mode: activeDashboardMode,
          active_source_provider: snapshot?.source.provider ?? null,
          source_connection_state: snapshot?.source.connection_state ?? null,
          source_connected: snapshot?.source.connected ?? null,
        });
      } catch {
        if (!active) {
          return;
        }
      }
    };

    void sendHeartbeat();
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    activeDashboardMode,
    search,
    snapshot?.source.connected,
    snapshot?.source.connection_state,
    snapshot?.source.provider,
  ]);
}
