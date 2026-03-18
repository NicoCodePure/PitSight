import type { AppSettingsSnapshot, DisplayPreferences } from "../types/appSettings";
import type { AlertEvent, SessionRecord, TelemetrySnapshot } from "../types/telemetry";
import {
  buildDriverNormalViewModel,
  type DriverAlertView,
  type FocusClusterView,
  type FooterItemView,
  type StatusBadgeView,
  type TelemetryCardView,
  type TelemetryVisualState,
  type TimingMetricView,
} from "./lemonsTelemetry";
import { formatDuration, formatMetric } from "./format";

export interface PitMetricGroup {
  id: string;
  label: string;
  metrics: TelemetryCardView[];
}

export interface PitCameraView {
  title: string;
  detail: string;
  state: TelemetryVisualState;
}

export interface PitRecentEventView {
  id: string;
  title: string;
  detail: string;
  timestamp?: string | null;
  state: TelemetryVisualState;
}

export interface PitDashboardViewModel {
  topStatuses: StatusBadgeView[];
  alerts: DriverAlertView[];
  focus: FocusClusterView;
  summary: string;
  footerItems: FooterItemView[];
  metricGroups: PitMetricGroup[];
  timingMetrics: TimingMetricView[];
  recentEvents: PitRecentEventView[];
  camera: PitCameraView;
}

interface BuildPitDashboardArgs {
  snapshot: TelemetrySnapshot | null;
  alerts: AlertEvent[];
  session: SessionRecord | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  displayPreferences: DisplayPreferences;
  settings: AppSettingsSnapshot;
}

function toCardFromFocus(
  id: string,
  focusValue: FocusClusterView["gear"] | FocusClusterView["speed"] | FocusClusterView["rpm"],
): TelemetryCardView {
  return {
    id,
    label: focusValue.label,
    value: focusValue.value,
    unit: focusValue.unit,
    state: focusValue.state,
    detail: focusValue.detail,
  };
}

function unavailableCard(
  id: string,
  label: string,
  detail: string,
  unit?: string,
): TelemetryCardView {
  return {
    id,
    label,
    value: "--",
    unit,
    state: "unavailable",
    detail,
  };
}

function infoCard(
  id: string,
  label: string,
  value: string,
  detail: string,
  state: TelemetryVisualState = "normal",
  unit?: string,
): TelemetryCardView {
  return {
    id,
    label,
    value,
    unit,
    state,
    detail,
  };
}

function buildRecentEvents(
  alerts: AlertEvent[],
  snapshot: TelemetrySnapshot | null,
  streamStatus: "connecting" | "connected" | "disconnected",
): PitRecentEventView[] {
  const systemEvents: PitRecentEventView[] = [];

  if (!snapshot || streamStatus === "disconnected") {
    systemEvents.push({
      id: "telemetry-lost",
      title: "Telemetry Signal Lost",
      detail: "No live pit-side telemetry snapshot is available.",
      timestamp: snapshot?.timestamp ?? null,
      state: "critical",
    });
  } else if (streamStatus === "connecting" || snapshot.source.connection_state === "connecting") {
    systemEvents.push({
      id: "telemetry-connecting",
      title: "Telemetry Reconnecting",
      detail: "Waiting for the live source to stabilize.",
      timestamp: snapshot.timestamp,
      state: "advisory",
    });
  } else if (snapshot.source.connection_state === "degraded") {
    systemEvents.push({
      id: "telemetry-degraded",
      title: "Telemetry Degraded",
      detail: "Source is connected but data quality is reduced.",
      timestamp: snapshot.timestamp,
      state: "warning",
    });
  }

  const alertEvents: PitRecentEventView[] = alerts.slice(0, 6).map((alert, index) => ({
    id: `${alert.code}-${index}`,
    title: alert.message,
    detail:
      alert.value !== null && alert.value !== undefined
        ? `${alert.code} at ${formatMetric(alert.value, 1)}`
        : alert.code,
    timestamp: alert.timestamp,
    state: alert.severity === "critical" ? "critical" : "warning",
  }));

  return [...systemEvents, ...alertEvents];
}

function buildCameraView(settings: AppSettingsSnapshot): PitCameraView {
  if (!settings.device_local.camera.camera_enabled) {
    return {
      title: "Camera Disabled",
      detail: "Enable camera hardware on the Pi to stage pit-side video.",
      state: "unavailable",
    };
  }

  if (!settings.sync.device_online) {
    return {
      title: "Device Offline",
      detail: "Last known camera configuration is saved, but no live camera path is available.",
      state: "warning",
    };
  }

  return {
    title: "Camera Preview Placeholder",
    detail: "Camera/video transport is not implemented yet. This panel reserves the pit-side viewing area.",
    state: "advisory",
  };
}

export function buildPitDashboardViewModel({
  snapshot,
  alerts,
  session,
  streamStatus,
  displayPreferences,
  settings,
}: BuildPitDashboardArgs): PitDashboardViewModel {
  const base = buildDriverNormalViewModel({
    snapshot,
    session,
    streamStatus,
    thresholds: settings.shared.thresholds,
    displayPreferences,
  });

  const metricGroups: PitMetricGroup[] = [
    {
      id: "engine-core",
      label: "Engine Core",
      metrics: [
        toCardFromFocus("pit-gear", base.focus.gear),
        toCardFromFocus("pit-speed", base.focus.speed),
        toCardFromFocus("pit-rpm", base.focus.rpm),
      ],
    },
    {
      id: "cooling",
      label: "Cooling",
      metrics: [base.engineMetrics[2]],
    },
    {
      id: "lubrication",
      label: "Lubrication",
      metrics: [base.engineMetrics[1], base.engineMetrics[0]],
    },
    {
      id: "fuel",
      label: "Fuel",
      metrics: [
        base.supportMetrics[1],
        unavailableCard("pit-fuel-pressure", "Fuel Pressure", "Feed unavailable", displayPreferences.pressure_unit),
      ],
    },
    {
      id: "electrical",
      label: "Electrical",
      metrics: [
        base.supportMetrics[0],
        infoCard(
          "pit-signal",
          "Signal",
          base.supportMetrics[3].value,
          base.supportMetrics[3].detail,
          base.supportMetrics[3].state,
        ),
      ],
    },
    {
      id: "intake-air",
      label: "Intake / Air",
      metrics: [
        base.supportMetrics[2],
        unavailableCard("pit-map", "MAP / Air", "Feed unavailable"),
      ],
    },
    {
      id: "session-support",
      label: "Session / Timing",
      metrics: [
        infoCard(
          "pit-drive-time",
          "Drive Time",
          formatDuration(snapshot?.session.drive_time_ms),
          snapshot?.session.drive_time_ms == null ? "Session clock unavailable" : "Current drive duration",
          snapshot?.session.drive_time_ms == null ? "unavailable" : "normal",
        ),
        infoCard(
          "pit-stint-time",
          "Stint Time",
          formatDuration(snapshot?.session.stint_time_ms),
          snapshot?.session.stint_time_ms == null ? "Stint timer unavailable" : "Current stint duration",
          snapshot?.session.stint_time_ms == null ? "unavailable" : "normal",
        ),
      ],
    },
  ];

  const topStatuses = [
    ...base.topStatuses,
    {
      id: "session",
      label: "Session",
      value: session?.session_id ? session.session_id.slice(0, 12).toUpperCase() : "NO SESSION",
      state: session ? "normal" : "unavailable",
    } satisfies StatusBadgeView,
  ];

  const footerItems: FooterItemView[] = [
    {
      id: "mode",
      label: "Mode",
      value: "PIT DASHBOARD",
    },
    {
      id: "camera",
      label: "Camera",
      value: settings.shared.camera_mode_preference.toUpperCase(),
    },
    {
      id: "dashboard",
      label: "Applied",
      value: settings.sync.applied_dashboard_mode.replace(/_/g, " ").toUpperCase(),
    },
    ...base.footerItems.filter((item) => item.id !== "mode"),
  ];

  return {
    topStatuses,
    alerts: base.alerts,
    focus: base.focus,
    summary: base.summary,
    footerItems,
    metricGroups,
    timingMetrics: base.timingMetrics,
    recentEvents: buildRecentEvents(alerts, snapshot, streamStatus),
    camera: buildCameraView(settings),
  };
}
