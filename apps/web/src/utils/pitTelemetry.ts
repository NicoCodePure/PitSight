import type { AppSettingsSnapshot, DisplayPreferences } from "../types/appSettings";
import type { AlertEvent, SessionRecord, SystemEvent, TelemetrySnapshot } from "../types/telemetry";
import { buildCameraPanelView, type CameraPanelView } from "./camera";
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
import { formatDuration, formatMetric, formatPressure, pressureUnitLabel } from "./format";

export interface PitMetricGroup {
  id: string;
  label: string;
  metrics: TelemetryCardView[];
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
  camera: CameraPanelView;
}

interface BuildPitDashboardArgs {
  snapshot: TelemetrySnapshot | null;
  alerts: AlertEvent[];
  events: SystemEvent[];
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

function buildFuelPressureCard(
  snapshot: TelemetrySnapshot | null,
  displayPreferences: DisplayPreferences,
  settings: AppSettingsSnapshot,
): TelemetryCardView {
  const pressure = snapshot?.fuel.pressure_bar;
  const thresholds = settings.effective.shared.thresholds;

  if (pressure === null || pressure === undefined) {
    return unavailableCard(
      "pit-fuel-pressure",
      "Fuel Pressure",
      "Feed unavailable",
      pressureUnitLabel(displayPreferences.pressure_unit),
    );
  }

  const state =
    pressure <= thresholds.fuel_pressure_critical_bar
      ? "critical"
      : pressure <= thresholds.fuel_pressure_warning_bar
        ? "warning"
        : pressure <= thresholds.fuel_pressure_advisory_bar
          ? "advisory"
          : "normal";

  const detail =
    state === "critical" || state === "warning"
      ? `${formatPressure(pressure, displayPreferences.pressure_unit)} ${pressureUnitLabel(displayPreferences.pressure_unit)} below target`
      : state === "advisory"
        ? `Below ${formatPressure(thresholds.fuel_pressure_advisory_bar, displayPreferences.pressure_unit)} ${pressureUnitLabel(displayPreferences.pressure_unit)} advisory floor`
        : "Fuel rail stable";

  return infoCard(
    "pit-fuel-pressure",
    "Fuel Pressure",
    formatPressure(pressure, displayPreferences.pressure_unit),
    detail,
    state,
    pressureUnitLabel(displayPreferences.pressure_unit),
  );
}

function buildRecentEvents(
  events: SystemEvent[],
): PitRecentEventView[] {
  return events.slice(0, 8).map((event, index) => ({
    id: `${event.code}-${event.action}-${index}`,
    title: event.title,
    detail: event.detail,
    timestamp: event.timestamp,
    state:
      event.severity === "critical"
        ? "critical"
        : event.severity === "warning"
          ? "warning"
          : "normal",
  }));
}

export function buildPitDashboardViewModel({
  snapshot,
  alerts,
  events,
  session,
  streamStatus,
  displayPreferences,
  settings,
}: BuildPitDashboardArgs): PitDashboardViewModel {
  const base = buildDriverNormalViewModel({
    snapshot,
    session,
    streamStatus,
    thresholds: settings.effective.shared.thresholds,
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
        buildFuelPressureCard(snapshot, displayPreferences, settings),
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
    {
      id: "device",
      label: "Device",
      value: settings.device_state.online ? "ONLINE" : "OFFLINE",
      state: settings.device_state.online ? "normal" : "critical",
    } satisfies StatusBadgeView,
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
      value: settings.effective.shared.camera_mode_preference.toUpperCase(),
    },
    {
      id: "dashboard",
      label: "Applied",
      value: settings.sync.applied_dashboard_mode.replace(/_/g, " ").toUpperCase(),
    },
    {
      id: "active-screen",
      label: "Screen",
      value: settings.device_state.current_dashboard_mode.replace(/_/g, " ").toUpperCase(),
      state: settings.device_state.online ? "normal" : "warning",
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
    recentEvents: buildRecentEvents(events),
    camera: buildCameraPanelView({
      camera: snapshot?.camera,
      deviceOnline: settings.device_state.online,
      requestedMode: settings.effective.shared.camera_mode_preference,
      hardwareSource: settings.effective.device_local.camera.camera_hardware_source,
    }),
  };
}
