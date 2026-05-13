import type { AlertThresholdSettings, DisplayPreferences } from "../types/appSettings";
import type {
  AlertEvent,
  CapabilityStatus,
  SessionRecord,
  TelemetryCapabilities,
  TelemetrySnapshot,
} from "../types/telemetry";
import {
  formatDuration,
  formatMetric,
  formatPressure,
  formatSpeed,
  formatTemperature,
  pressureUnitLabel,
  speedUnitLabel,
  temperatureUnitLabel,
} from "./format";

export type TelemetryVisualState =
  | "normal"
  | "advisory"
  | "warning"
  | "critical"
  | "unavailable";

export interface DriverAlertView {
  id: string;
  severity: Exclude<TelemetryVisualState, "normal">;
  source: string;
  title: string;
  detail: string;
}

export interface TelemetryCardView {
  id: string;
  label: string;
  value: string;
  unit?: string;
  state: TelemetryVisualState;
  detail: string;
}

export interface TimingMetricView {
  id: string;
  label: string;
  value: string;
  state: TelemetryVisualState;
  detail: string;
  emphasis: "primary" | "secondary";
}

export interface FocusValueView {
  label: string;
  value: string;
  unit?: string;
  state: TelemetryVisualState;
  detail: string;
}

export interface FocusClusterView {
  gear: FocusValueView;
  speed: FocusValueView;
  rpm: FocusValueView & {
    shiftLightCount: number;
    shiftState: TelemetryVisualState;
  };
}

export interface StatusBadgeView {
  id: string;
  label: string;
  value: string;
  state: TelemetryVisualState;
}

export interface FooterItemView {
  id: string;
  label: string;
  value: string;
  state?: TelemetryVisualState;
}

export interface DriverScreenViewModelBase {
  topStatuses: StatusBadgeView[];
  alerts: DriverAlertView[];
  focus: FocusClusterView;
  engineMetrics: TelemetryCardView[];
  supportMetrics: TelemetryCardView[];
  footerItems: FooterItemView[];
  summary: string;
}

export interface DriverLemonsViewModel {
  topStatuses: StatusBadgeView[];
  alerts: DriverAlertView[];
  focus: FocusClusterView;
  lapMetric: TelemetryCardView;
  engineMetrics: TelemetryCardView[];
  secondaryMetrics: TelemetryCardView[];
  summary: string;
}

export interface DriverNormalViewModel extends DriverScreenViewModelBase {
  timingMetrics: TimingMetricView[];
}

interface BuildDriverScreenArgs {
  snapshot: TelemetrySnapshot | null;
  session: SessionRecord | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  thresholds: AlertThresholdSettings;
  displayPreferences: DisplayPreferences;
}

const RPM_SHIFT_START = 5200;
const RPM_SHIFT_TARGET = 6600;
const RPM_REDLINE = 7200;
const SHIFT_LIGHT_SEGMENTS = 10;
const UNAVAILABLE_VIA_CONNECTION_METHOD = "Unavailable via connection method";

const STATE_LABELS: Record<TelemetryVisualState, string> = {
  normal: "Normal",
  advisory: "Advisory",
  warning: "Warning",
  critical: "Critical",
  unavailable: "Unavailable",
};

const SEVERITY_PRIORITY: Record<Exclude<TelemetryVisualState, "normal">, number> = {
  critical: 0,
  warning: 1,
  advisory: 2,
  unavailable: 3,
};

const DEFAULT_CAPABILITIES: TelemetryCapabilities = {
  lap_timing: {
    level: "unavailable",
    detail: "Lap timing support has not been declared for this snapshot.",
  },
  track_position: {
    level: "unavailable",
    detail: "Track-position support has not been declared for this snapshot.",
  },
  session_clock: {
    level: "unavailable",
    detail: "Session-clock support has not been declared for this snapshot.",
  },
};

function getCapabilities(snapshot: TelemetrySnapshot | null): TelemetryCapabilities {
  if (snapshot?.capabilities) {
    return snapshot.capabilities;
  }
  if (snapshot?.source.provider === "simulator") {
    return {
      lap_timing: {
        level: "full",
        detail: "Simulator provides lap count, live lap time, best lap, delta, and optimal lap.",
      },
      track_position: {
        level: "full",
        detail: "Simulator provides a synthetic GPS loop and track-position context.",
      },
      session_clock: {
        level: "full",
        detail: "Simulator provides session, drive, and stint clocks.",
      },
    };
  }
  if (snapshot) {
    return {
      lap_timing: {
        level: "unavailable",
        detail: "Lap timing is not available for this source in the current build.",
      },
      track_position: {
        level: "unavailable",
        detail: "Track-position support is not available for this source in the current build.",
      },
      session_clock: {
        level: "limited",
        detail: "Elapsed session, drive, and stint clocks are available, but they are not track-aware or lap-aware.",
      },
    };
  }
  return DEFAULT_CAPABILITIES;
}

function getCapabilityVisualState(capability: CapabilityStatus): TelemetryVisualState {
  if (capability.level === "full") {
    return "normal";
  }
  if (capability.level === "limited") {
    return "advisory";
  }
  return "unavailable";
}

function getCapabilityValue(capability: CapabilityStatus): string {
  return capability.level.toUpperCase();
}

function sourceUsesNonSimulatorConnection(snapshot: TelemetrySnapshot | null): boolean {
  return Boolean(snapshot && snapshot.source.provider !== "simulator");
}

function sourceHasNoLiveSamples(snapshot: TelemetrySnapshot | null): boolean {
  return Boolean(
    snapshot &&
      (snapshot.source.connection_state === "fault" ||
        snapshot.source.connection_state === "disconnected" ||
        !snapshot.source.connected),
  );
}

function unavailableMetricDetail(
  snapshot: TelemetrySnapshot | null,
  fallback: string,
): string {
  if (!sourceUsesNonSimulatorConnection(snapshot)) {
    return fallback;
  }
  return sourceHasNoLiveSamples(snapshot) ? "No live samples" : UNAVAILABLE_VIA_CONNECTION_METHOD;
}

function unavailableCapabilityDetail(
  snapshot: TelemetrySnapshot | null,
  capability: CapabilityStatus,
  fallback: string,
): string {
  if (capability.level === "unavailable") {
    return unavailableMetricDetail(snapshot, fallback);
  }
  return capability.detail;
}

function getAlertBackedMetricState(
  snapshot: TelemetrySnapshot | null,
  value: number | null | undefined,
  criticalCodes: string[],
  warningCodes: string[],
): TelemetryVisualState {
  if (value === null || value === undefined) {
    return "unavailable";
  }
  const activeCodes = new Set(
    snapshot?.alerts.filter((alert) => alert.active).map((alert) => alert.code) ?? [],
  );
  if (criticalCodes.some((code) => activeCodes.has(code))) {
    return "critical";
  }
  if (warningCodes.some((code) => activeCodes.has(code))) {
    return "warning";
  }
  return "normal";
}

function getDiagnosticMetricState(
  value: number | null | undefined,
): TelemetryVisualState {
  if (value === null || value === undefined) {
    return "unavailable";
  }
  return "normal";
}

function getSignalState(
  snapshot: TelemetrySnapshot | null,
  streamStatus: "connecting" | "connected" | "disconnected",
): TelemetryVisualState {
  if (!snapshot || streamStatus === "disconnected") {
    return "critical";
  }
  if (streamStatus === "connecting" || snapshot.source.connection_state === "connecting") {
    return "advisory";
  }
  if (snapshot.source.connection_state === "degraded") {
    return "warning";
  }
  if (
    !snapshot.source.connected ||
    snapshot.source.connection_state === "fault" ||
    snapshot.source.connection_state === "disconnected"
  ) {
    return "critical";
  }
  return "normal";
}

function getRpmState(value: number | null | undefined): TelemetryVisualState {
  if (value === null || value === undefined) {
    return "unavailable";
  }
  if (value >= RPM_REDLINE) {
    return "critical";
  }
  if (value >= RPM_SHIFT_TARGET) {
    return "warning";
  }
  if (value >= RPM_SHIFT_START) {
    return "advisory";
  }
  return "normal";
}

function getShiftLightCount(value: number | null | undefined): number {
  if (value === null || value === undefined || value <= RPM_SHIFT_START) {
    return 0;
  }
  const ratio = (Math.min(value, RPM_REDLINE) - RPM_SHIFT_START) / (RPM_REDLINE - RPM_SHIFT_START);
  return Math.max(0, Math.min(SHIFT_LIGHT_SEGMENTS, Math.ceil(ratio * SHIFT_LIGHT_SEGMENTS)));
}

function getTrueSpeed(snapshot: TelemetrySnapshot | null): number | null {
  if (snapshot?.engine.speed_kph !== null && snapshot?.engine.speed_kph !== undefined) {
    return snapshot.engine.speed_kph;
  }
  if (snapshot?.gps.speed_kph !== null && snapshot?.gps.speed_kph !== undefined) {
    return snapshot.gps.speed_kph;
  }
  return null;
}

function getSpeedSourceDetail(snapshot: TelemetrySnapshot | null): string {
  if (snapshot?.engine.speed_kph !== null && snapshot?.engine.speed_kph !== undefined) {
    return "Vehicle speed";
  }
  if (snapshot?.gps.speed_kph !== null && snapshot?.gps.speed_kph !== undefined) {
    return "GPS fallback";
  }
  return unavailableMetricDetail(snapshot, "Speed feed missing");
}

function formatPressureThreshold(value: number, displayPreferences: DisplayPreferences): string {
  return `${formatPressure(value, displayPreferences.pressure_unit)} ${pressureUnitLabel(
    displayPreferences.pressure_unit,
  )}`;
}

function formatTemperatureThreshold(value: number, displayPreferences: DisplayPreferences): string {
  return `${formatTemperature(value, displayPreferences.temperature_unit)} ${temperatureUnitLabel(
    displayPreferences.temperature_unit,
  )}`;
}

function formatSignedDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "--";
  }
  const sign = value > 0 ? "+" : value < 0 ? "-" : "+/-";
  return `${sign}${formatDuration(Math.abs(value))}`;
}

function formatProviderShortName(snapshot: TelemetrySnapshot | null): string {
  if (!snapshot) {
    return "NO SOURCE";
  }

  switch (snapshot.source.provider) {
    case "simulator":
      return "SIM";
    case "obd2":
      return "OBD2";
    case "dictator":
      return "DICTATOR";
    default:
      return String(snapshot.source.provider).toUpperCase();
  }
}

function formatSourceStatusValue(
  snapshot: TelemetrySnapshot | null,
  streamStatus: "connecting" | "connected" | "disconnected",
): string {
  const source = formatProviderShortName(snapshot);
  if (!snapshot) {
    return source;
  }
  if (streamStatus === "disconnected") {
    return `${source} DOWN`;
  }

  switch (snapshot.source.connection_state) {
    case "connected":
      return snapshot.source.connected ? `${source} LIVE` : `${source} DOWN`;
    case "degraded":
      return `${source} DEGRADED`;
    case "connecting":
      return `${source} CONNECTING`;
    case "fault":
      return `${source} FAULT`;
    case "disconnected":
      return `${source} DOWN`;
  }
}

function formatLinkStatusValue(
  snapshot: TelemetrySnapshot | null,
  streamStatus: "connecting" | "connected" | "disconnected",
): string {
  if (!snapshot || streamStatus === "disconnected") {
    return "DOWN";
  }
  if (streamStatus === "connecting" || snapshot.source.connection_state === "connecting") {
    return "CONNECTING";
  }
  if (snapshot.source.connection_state === "degraded") {
    return "DEGRADED";
  }
  if (
    !snapshot.source.connected ||
    snapshot.source.connection_state === "fault" ||
    snapshot.source.connection_state === "disconnected"
  ) {
    return "DOWN";
  }
  return "CONNECTED";
}

function buildOilPressureDetail(
  snapshot: TelemetrySnapshot | null,
  state: TelemetryVisualState,
  value: number | null | undefined,
  rpm: number | null | undefined,
  thresholds: AlertThresholdSettings,
  displayPreferences: DisplayPreferences,
): string {
  if (state === "unavailable") {
    return unavailableMetricDetail(snapshot, "Sensor missing");
  }

  const formattedValue = formatPressure(value, displayPreferences.pressure_unit);
  const unit = pressureUnitLabel(displayPreferences.pressure_unit);
  const rpmDetail = rpm === null || rpm === undefined ? null : `${formatMetric(rpm, 0)} RPM`;

  if (state === "critical" || state === "warning") {
    return rpmDetail ? `${formattedValue} ${unit} at ${rpmDetail}` : `${formattedValue} ${unit} now`;
  }

  return `Warning below ${formatPressureThreshold(thresholds.oil_pressure_warning_bar, displayPreferences)}`;
}

function buildTemperatureDetail(
  snapshot: TelemetrySnapshot | null,
  state: TelemetryVisualState,
  value: number | null | undefined,
  warningThreshold: number,
  criticalThreshold: number,
  displayPreferences: DisplayPreferences,
): string {
  if (state === "unavailable") {
    return unavailableMetricDetail(snapshot, "Sensor missing");
  }

  const formattedValue = formatTemperature(value, displayPreferences.temperature_unit);

  if (state === "critical") {
    return `${formattedValue} above ${formatTemperatureThreshold(criticalThreshold, displayPreferences)}`;
  }

  if (state === "warning") {
    return `${formattedValue} above ${formatTemperatureThreshold(warningThreshold, displayPreferences)}`;
  }

  return `Warning above ${formatTemperatureThreshold(warningThreshold, displayPreferences)}`;
}

function buildFuelDetail(
  snapshot: TelemetrySnapshot | null,
  state: TelemetryVisualState,
  levelPercent: number | null | undefined,
  rangeKm: number | null | undefined,
  thresholds: AlertThresholdSettings,
): string {
  if (state === "unavailable") {
    return unavailableMetricDetail(snapshot, "Feed missing");
  }
  if (state === "warning") {
    return `${formatMetric(levelPercent, 1)}% remaining`;
  }
  if (rangeKm !== null && rangeKm !== undefined) {
    return `${formatMetric(rangeKm, 0)} km range`;
  }
  return `Warning at ${formatMetric(thresholds.fuel_level_warning_percent, 0)}% remaining`;
}

function buildBatteryDetail(
  snapshot: TelemetrySnapshot | null,
  state: TelemetryVisualState,
  value: number | null | undefined,
): string {
  if (state === "unavailable") {
    return unavailableMetricDetail(snapshot, "Feed unavailable");
  }
  return `${formatMetric(value, 1)} V Diagnostic only. No backend alert configured.`;
}

function buildLambdaDetail(
  snapshot: TelemetrySnapshot | null,
  state: TelemetryVisualState,
  lambdaValue: number | null | undefined,
  afrValue: number | null | undefined,
): string {
  if (state === "unavailable") {
    return unavailableMetricDetail(snapshot, "Feed unavailable");
  }
  const afrDetail =
    afrValue === null || afrValue === undefined ? null : `AFR ${formatMetric(afrValue, 1)}`;

  if (lambdaValue === null || lambdaValue === undefined) {
    return `${afrDetail ?? "Mixture"} Diagnostic only. No backend alert configured.`;
  }

  return `${afrDetail ?? `Lambda ${formatMetric(lambdaValue, 2)}`} Diagnostic only. No backend alert configured.`;
}

function buildAfrDetail(
  snapshot: TelemetrySnapshot | null,
  state: TelemetryVisualState,
  afrValue: number | null | undefined,
): string {
  if (state === "unavailable") {
    return unavailableMetricDetail(snapshot, "Feed unavailable");
  }
  return `AFR ${formatMetric(afrValue, 1)} Diagnostic only. No backend alert configured.`;
}

function buildSignalDetail(
  state: TelemetryVisualState,
  snapshot: TelemetrySnapshot | null,
  streamStatus: "connecting" | "connected" | "disconnected",
): string {
  if (!snapshot || state === "critical") {
    return "No live samples";
  }
  if (state === "warning") {
    return "Feed degraded";
  }
  if (state === "advisory") {
    return `Link ${streamStatus}`;
  }
  return `${formatProviderShortName(snapshot)} live`;
}

function formatAlertDetail(
  alert: AlertEvent,
  snapshot: TelemetrySnapshot,
  thresholds: AlertThresholdSettings,
  displayPreferences: DisplayPreferences,
): string {
  if (alert.code.includes("oil_pressure")) {
    const pressure = formatPressure(alert.value, displayPreferences.pressure_unit);
    const unit = pressureUnitLabel(displayPreferences.pressure_unit);
    const rpm = snapshot.engine.rpm;
    if (rpm === null || rpm === undefined) {
      return `${pressure} ${unit} below ${formatPressureThreshold(alert.threshold ?? thresholds.oil_pressure_warning_bar, displayPreferences)}`;
    }
    return `${pressure} ${unit} at ${formatMetric(rpm, 0)} RPM`;
  }

  if (alert.code.includes("water_temp")) {
    const threshold = alert.threshold ?? thresholds.water_temp_warning_c;
    return `${formatTemperature(alert.value, displayPreferences.temperature_unit)} above ${formatTemperatureThreshold(threshold, displayPreferences)}`;
  }

  if (alert.code.includes("oil_temp")) {
    const threshold = alert.threshold ?? thresholds.oil_temp_warning_c;
    return `${formatTemperature(alert.value, displayPreferences.temperature_unit)} above ${formatTemperatureThreshold(threshold, displayPreferences)}`;
  }

  if (alert.code.includes("fuel")) {
    return `${formatMetric(alert.value, 1)}% remaining`;
  }

  return "Driver attention required";
}

function mapAlertTitle(alert: AlertEvent): { title: string; source: string } {
  if (alert.code === "low_oil_pressure_critical") {
    return { title: "OIL PRESSURE CRITICAL", source: "Oil pressure" };
  }
  if (alert.code === "low_oil_pressure_warning") {
    return { title: "OIL PRESSURE LOW", source: "Oil pressure" };
  }
  if (alert.code === "high_water_temp_critical") {
    return { title: "COOLANT TEMP HIGH", source: "Coolant temp" };
  }
  if (alert.code === "high_water_temp_warning") {
    return { title: "COOLANT TEMP HIGH", source: "Coolant temp" };
  }
  if (alert.code === "high_oil_temp_critical") {
    return { title: "OIL TEMP CRITICAL", source: "Oil temp" };
  }
  if (alert.code === "high_oil_temp_warning") {
    return { title: "OIL TEMP HIGH", source: "Oil temp" };
  }
  if (alert.code === "low_fuel_warning") {
    return { title: "FUEL LEVEL LOW", source: "Fuel" };
  }
  return { title: alert.message.toUpperCase(), source: "System" };
}

function buildSystemAlerts(
  snapshot: TelemetrySnapshot | null,
  streamStatus: "connecting" | "connected" | "disconnected",
): DriverAlertView[] {
  const alerts: DriverAlertView[] = [];

  if (!snapshot || streamStatus === "disconnected") {
    alerts.push({
      id: "telemetry-lost",
      severity: "critical",
      source: "Telemetry",
      title: "TELEMETRY SIGNAL LOST",
      detail: "No live samples available",
    });
    return alerts;
  }

  if (streamStatus === "connecting" || snapshot.source.connection_state === "connecting") {
    alerts.push({
      id: "telemetry-connecting",
      severity: "advisory",
      source: "Telemetry",
      title: "TELEMETRY RECONNECTING",
      detail: `Waiting for ${formatProviderShortName(snapshot)} live feed`,
    });
  }

  if (snapshot.source.connection_state === "degraded") {
    alerts.push({
      id: "telemetry-degraded",
      severity: "warning",
      source: "Telemetry",
      title: "TELEMETRY DEGRADED",
      detail: `${formatProviderShortName(snapshot)} data quality reduced`,
    });
  }

  if (snapshot.source.connection_state === "fault" || snapshot.source.connection_state === "disconnected") {
    alerts.push({
      id: "telemetry-fault",
      severity: "critical",
      source: "Telemetry",
      title: "TELEMETRY SIGNAL LOST",
      detail: `${formatProviderShortName(snapshot)} link unavailable`,
    });
  }

  if (snapshot.source.provider === "simulator") {
    const coreSensors: Array<{
      id: string;
      value: number | null | undefined;
      title: string;
      source: string;
    }> = [
      {
        id: "oil-pressure-sensor",
        value: snapshot.engine.oil_pressure_bar,
        title: "OIL PRESSURE SENSOR UNAVAILABLE",
        source: "Oil pressure",
      },
      {
        id: "coolant-temp-sensor",
        value: snapshot.engine.water_temp_c,
        title: "COOLANT TEMP SENSOR UNAVAILABLE",
        source: "Coolant temp",
      },
      {
        id: "oil-temp-sensor",
        value: snapshot.engine.oil_temp_c,
        title: "OIL TEMP SENSOR UNAVAILABLE",
        source: "Oil temp",
      },
      {
        id: "rpm-signal",
        value: snapshot.engine.rpm,
        title: "RPM SIGNAL UNAVAILABLE",
        source: "RPM",
      },
      {
        id: "speed-signal",
        value: getTrueSpeed(snapshot),
        title: "SPEED SIGNAL UNAVAILABLE",
        source: "Speed",
      },
    ];

    for (const sensor of coreSensors) {
      if (sensor.value === null || sensor.value === undefined) {
        alerts.push({
          id: sensor.id,
          severity: "unavailable",
          source: sensor.source,
          title: sensor.title,
          detail: "Sensor data missing",
        });
      }
    }
  }

  return alerts;
}

function buildLemonsSystemAlerts(
  snapshot: TelemetrySnapshot | null,
  streamStatus: "connecting" | "connected" | "disconnected",
): DriverAlertView[] {
  const alerts: DriverAlertView[] = [];

  if (!snapshot || streamStatus === "disconnected") {
    alerts.push({
      id: "telemetry-lost",
      severity: "critical",
      source: "Telemetry",
      title: "TELEMETRY SIGNAL LOST",
      detail: "No live samples available",
    });
    return alerts;
  }

  if (streamStatus === "connecting" || snapshot.source.connection_state === "connecting") {
    alerts.push({
      id: "telemetry-connecting",
      severity: "advisory",
      source: "Telemetry",
      title: "TELEMETRY RECONNECTING",
      detail: `Waiting for ${formatProviderShortName(snapshot)} live feed`,
    });
  }

  if (snapshot.source.connection_state === "degraded") {
    alerts.push({
      id: "telemetry-degraded",
      severity: "warning",
      source: "Telemetry",
      title: "TELEMETRY DEGRADED",
      detail: `${formatProviderShortName(snapshot)} data quality reduced`,
    });
  }

  if (snapshot.source.connection_state === "fault" || snapshot.source.connection_state === "disconnected") {
    alerts.push({
      id: "telemetry-fault",
      severity: "critical",
      source: "Telemetry",
      title: "TELEMETRY SIGNAL LOST",
      detail: `${formatProviderShortName(snapshot)} link unavailable`,
    });
  }

  if (snapshot.source.provider === "simulator") {
    const essentialSensors: Array<{
      id: string;
      value: number | null | undefined;
      title: string;
      source: string;
    }> = [
      {
        id: "oil-pressure-sensor",
        value: snapshot.engine.oil_pressure_bar,
        title: "OIL PRESSURE SENSOR UNAVAILABLE",
        source: "Oil pressure",
      },
      {
        id: "coolant-temp-sensor",
        value: snapshot.engine.water_temp_c,
        title: "COOLANT TEMP SENSOR UNAVAILABLE",
        source: "Coolant temp",
      },
      {
        id: "oil-temp-sensor",
        value: snapshot.engine.oil_temp_c,
        title: "OIL TEMP SENSOR UNAVAILABLE",
        source: "Oil temp",
      },
      {
        id: "speed-signal",
        value: getTrueSpeed(snapshot),
        title: "SPEED SIGNAL UNAVAILABLE",
        source: "Speed",
      },
      {
        id: "rpm-signal",
        value: snapshot.engine.rpm,
        title: "RPM SIGNAL UNAVAILABLE",
        source: "RPM",
      },
    ];

    for (const sensor of essentialSensors) {
      if (sensor.value === null || sensor.value === undefined) {
        alerts.push({
          id: sensor.id,
          severity: "unavailable",
          source: sensor.source,
          title: sensor.title,
          detail: "Sensor data missing",
        });
      }
    }
  }

  return alerts;
}

function buildBackendAlerts(
  snapshot: TelemetrySnapshot | null,
  thresholds: AlertThresholdSettings,
  displayPreferences: DisplayPreferences,
): DriverAlertView[] {
  if (!snapshot) {
    return [];
  }

  return snapshot.alerts
    .filter((alert) => alert.active)
    .map((alert) => {
      const title = mapAlertTitle(alert);
      return {
        id: alert.code,
        severity: alert.severity === "critical" ? "critical" : "warning",
        source: title.source,
        title: title.title,
        detail: formatAlertDetail(alert, snapshot, thresholds, displayPreferences),
      } satisfies DriverAlertView;
    });
}

function sortAlerts(alerts: DriverAlertView[]): DriverAlertView[] {
  return [...alerts].sort((left, right) => {
    const severityDelta = SEVERITY_PRIORITY[left.severity] - SEVERITY_PRIORITY[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return left.title.localeCompare(right.title);
  });
}

function getSystemHealthState(alerts: DriverAlertView[]): TelemetryVisualState {
  if (alerts.some((alert) => alert.severity === "critical")) {
    return "critical";
  }
  if (alerts.some((alert) => alert.severity === "warning")) {
    return "warning";
  }
  if (alerts.some((alert) => alert.severity === "advisory")) {
    return "advisory";
  }
  if (alerts.some((alert) => alert.severity === "unavailable")) {
    return "unavailable";
  }
  return "normal";
}

function getSummary(alerts: DriverAlertView[], snapshot: TelemetrySnapshot | null): string {
  const criticalCount = alerts.filter((alert) => alert.severity === "critical").length;
  const warningCount = alerts.filter((alert) => alert.severity === "warning").length;
  const advisoryCount = alerts.filter((alert) => alert.severity === "advisory").length;
  const unavailableCount = alerts.filter((alert) => alert.severity === "unavailable").length;

  if (criticalCount > 0 || warningCount > 0) {
    const parts: string[] = [];
    if (criticalCount > 0) {
      parts.push(`${criticalCount} critical`);
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} warning`);
    }
    return `${parts.join(", ")} active`;
  }

  if (advisoryCount > 0) {
    return `${advisoryCount} advisory active`;
  }

  if (unavailableCount > 0) {
    return `${unavailableCount} feed unavailable`;
  }

  if (!snapshot) {
    return "Waiting for telemetry feed";
  }

  const capabilities = getCapabilities(snapshot);
  if (capabilities.lap_timing.level !== "full") {
    return `${formatProviderShortName(snapshot)} live. Lap timing ${capabilities.lap_timing.level}; session clock ${capabilities.session_clock.level}.`;
  }

  return `${formatProviderShortName(snapshot)} live. Core telemetry stable.`;
}

function getLemonsSummary(alerts: DriverAlertView[], snapshot: TelemetrySnapshot | null): string {
  if (alerts.length > 0 || !snapshot) {
    return getSummary(alerts, snapshot);
  }

  return `${formatProviderShortName(snapshot)} live. Engine survival metrics stable.`;
}

function buildTopStatuses(
  snapshot: TelemetrySnapshot | null,
  streamStatus: "connecting" | "connected" | "disconnected",
  systemHealthState: TelemetryVisualState,
): StatusBadgeView[] {
  const signalState = getSignalState(snapshot, streamStatus);
  const capabilities = getCapabilities(snapshot);
  const lapTimingState = getCapabilityVisualState(capabilities.lap_timing);
  const trackState = getCapabilityVisualState(capabilities.track_position);

  return [
    {
      id: "source",
      label: "Source",
      value: formatSourceStatusValue(snapshot, streamStatus),
      state: signalState,
    },
    {
      id: "link",
      label: "Link",
      value: formatLinkStatusValue(snapshot, streamStatus),
      state: signalState,
    },
    {
      id: "system",
      label: "System",
      value: STATE_LABELS[systemHealthState].toUpperCase(),
      state: systemHealthState,
    },
    {
      id: "lap-support",
      label: "Lap Logic",
      value: getCapabilityValue(capabilities.lap_timing),
      state: lapTimingState,
    },
    {
      id: "track-support",
      label: "Track",
      value: getCapabilityValue(capabilities.track_position),
      state: trackState,
    },
  ];
}

function buildLemonsTopStatuses(
  snapshot: TelemetrySnapshot | null,
  streamStatus: "connecting" | "connected" | "disconnected",
  systemHealthState: TelemetryVisualState,
): StatusBadgeView[] {
  const signalState = getSignalState(snapshot, streamStatus);

  return [
    {
      id: "source",
      label: "Source",
      value: formatSourceStatusValue(snapshot, streamStatus),
      state: signalState,
    },
    {
      id: "link",
      label: "Link",
      value: formatLinkStatusValue(snapshot, streamStatus),
      state: signalState,
    },
    {
      id: "system",
      label: "System",
      value: STATE_LABELS[systemHealthState].toUpperCase(),
      state: systemHealthState,
    },
  ];
}

function buildFocus(
  snapshot: TelemetrySnapshot | null,
  displayPreferences: DisplayPreferences,
): FocusClusterView {
  const trueSpeed = getTrueSpeed(snapshot);
  const rpm = snapshot?.engine.rpm ?? null;
  const gear = snapshot?.engine.gear ?? null;
  const rpmState = getRpmState(rpm);

  return {
    gear: {
      label: "Gear",
      value: gear === null ? "--" : gear === 0 ? "N" : String(gear),
      state: gear === null ? "unavailable" : "normal",
      detail: gear === null ? unavailableMetricDetail(snapshot, "No gear data") : "Decoded gear",
    },
    speed: {
      label: "Speed",
      value: formatSpeed(trueSpeed, displayPreferences.speed_unit),
      unit: speedUnitLabel(displayPreferences.speed_unit),
      state: trueSpeed === null ? "unavailable" : "normal",
      detail: getSpeedSourceDetail(snapshot),
    },
    rpm: {
      label: "RPM",
      value: formatMetric(rpm, 0),
      unit: "rpm",
      state: rpmState,
      detail:
        rpmState === "unavailable"
          ? unavailableMetricDetail(snapshot, "Signal missing")
          : rpmState === "critical"
            ? "Redline"
            : rpmState === "warning"
              ? "Shift now"
              : rpmState === "advisory"
                ? "Shift soon"
                : "Stable",
      shiftLightCount: getShiftLightCount(rpm),
      shiftState: rpmState,
    },
  };
}

function buildEngineMetrics(
  snapshot: TelemetrySnapshot | null,
  thresholds: AlertThresholdSettings,
  displayPreferences: DisplayPreferences,
): TelemetryCardView[] {
  const rpm = snapshot?.engine.rpm ?? null;
  const oilPressureState = getAlertBackedMetricState(
    snapshot,
    snapshot?.engine.oil_pressure_bar,
    ["low_oil_pressure_critical"],
    ["low_oil_pressure_warning"],
  );
  const oilTempState = getAlertBackedMetricState(
    snapshot,
    snapshot?.engine.oil_temp_c,
    ["high_oil_temp_critical"],
    ["high_oil_temp_warning"],
  );
  const coolantState = getAlertBackedMetricState(
    snapshot,
    snapshot?.engine.water_temp_c,
    ["high_water_temp_critical"],
    ["high_water_temp_warning"],
  );

  return [
    {
      id: "oil-temp",
      label: "Oil Temp",
      value: formatTemperature(snapshot?.engine.oil_temp_c, displayPreferences.temperature_unit),
      unit: temperatureUnitLabel(displayPreferences.temperature_unit),
      state: oilTempState,
      detail: buildTemperatureDetail(
        snapshot,
        oilTempState,
        snapshot?.engine.oil_temp_c,
        thresholds.oil_temp_warning_c,
        thresholds.oil_temp_critical_c,
        displayPreferences,
      ),
    },
    {
      id: "oil-pressure",
      label: "Oil Pressure",
      value: formatPressure(snapshot?.engine.oil_pressure_bar, displayPreferences.pressure_unit),
      unit: pressureUnitLabel(displayPreferences.pressure_unit),
      state: oilPressureState,
      detail: buildOilPressureDetail(
        snapshot,
        oilPressureState,
        snapshot?.engine.oil_pressure_bar,
        rpm,
        thresholds,
        displayPreferences,
      ),
    },
    {
      id: "coolant-temp",
      label: "Coolant Temp",
      value: formatTemperature(snapshot?.engine.water_temp_c, displayPreferences.temperature_unit),
      unit: temperatureUnitLabel(displayPreferences.temperature_unit),
      state: coolantState,
      detail: buildTemperatureDetail(
        snapshot,
        coolantState,
        snapshot?.engine.water_temp_c,
        thresholds.water_temp_warning_c,
        thresholds.water_temp_critical_c,
        displayPreferences,
      ),
    },
  ];
}

function buildSupportMetrics(
  snapshot: TelemetrySnapshot | null,
  thresholds: AlertThresholdSettings,
  _displayPreferences: DisplayPreferences,
  streamStatus: "connecting" | "connected" | "disconnected",
): TelemetryCardView[] {
  const signalState = getSignalState(snapshot, streamStatus);
  const fuelState = getAlertBackedMetricState(
    snapshot,
    snapshot?.fuel.level_percent,
    [],
    ["low_fuel_warning"],
  );
  const batteryState = getDiagnosticMetricState(
    snapshot?.engine.battery_voltage_v,
  );
  const lambdaValue =
    snapshot?.engine.lambda_value ?? snapshot?.engine.afr ?? null;
  const lambdaState = getDiagnosticMetricState(lambdaValue);

  return [
    {
      id: "battery",
      label: "Battery",
      value: formatMetric(snapshot?.engine.battery_voltage_v, 1),
      unit: "V",
      state: batteryState,
      detail: buildBatteryDetail(snapshot, batteryState, snapshot?.engine.battery_voltage_v),
    },
    {
      id: "fuel-level",
      label: "Fuel Level",
      value: formatMetric(snapshot?.fuel.level_percent, 1),
      unit: "%",
      state: fuelState,
      detail: buildFuelDetail(
        snapshot,
        fuelState,
        snapshot?.fuel.level_percent,
        snapshot?.fuel.range_km,
        thresholds,
      ),
    },
    {
      id: "lambda",
      label: "Lambda / AFR",
      value:
        snapshot?.engine.lambda_value === null || snapshot?.engine.lambda_value === undefined
          ? formatMetric(snapshot?.engine.afr, 1)
          : formatMetric(snapshot?.engine.lambda_value, 2),
      unit:
        snapshot?.engine.lambda_value === null || snapshot?.engine.lambda_value === undefined
          ? "afr"
          : "lambda",
      state: lambdaState,
      detail: buildLambdaDetail(
        snapshot,
        lambdaState,
        snapshot?.engine.lambda_value,
        snapshot?.engine.afr,
      ),
    },
    {
      id: "signal",
      label: "Signal",
      value:
        signalState === "critical"
          ? "LOST"
          : signalState === "warning"
            ? "DEGRADED"
            : signalState === "advisory"
              ? "SYNC"
              : "LIVE",
      state: signalState,
      detail: buildSignalDetail(signalState, snapshot, streamStatus),
    },
  ];
}

function buildLemonsLapMetric(snapshot: TelemetrySnapshot | null): TelemetryCardView {
  const capabilities = getCapabilities(snapshot);
  const lapTimingState = getCapabilityVisualState(capabilities.lap_timing);
  const lapTimingAvailable = capabilities.lap_timing.level === "full";

  return {
    id: "lap-count",
    label: "Lap Count",
    value: lapTimingAvailable ? formatMetric(snapshot?.lap.lap_count, 0) : "--",
    state: !lapTimingAvailable
      ? lapTimingState
      : snapshot?.lap.lap_count === null || snapshot?.lap.lap_count === undefined
        ? "unavailable"
        : "normal",
    detail:
      !lapTimingAvailable
        ? unavailableCapabilityDetail(snapshot, capabilities.lap_timing, "Lap count unavailable")
        : snapshot?.lap.lap_count === null || snapshot?.lap.lap_count === undefined
          ? unavailableMetricDetail(snapshot, "Lap count unavailable")
          : "Completed laps",
  };
}

function buildLemonsSecondaryMetrics(
  snapshot: TelemetrySnapshot | null,
  thresholds: AlertThresholdSettings,
): TelemetryCardView[] {
  const fuelState = getAlertBackedMetricState(
    snapshot,
    snapshot?.fuel.level_percent,
    [],
    ["low_fuel_warning"],
  );
  const batteryState = getDiagnosticMetricState(snapshot?.engine.battery_voltage_v);
  const afrState = getDiagnosticMetricState(snapshot?.engine.afr);

  return [
    {
      id: "fuel-level",
      label: "Fuel Level",
      value: formatMetric(snapshot?.fuel.level_percent, 1),
      unit: "%",
      state: fuelState,
      detail: buildFuelDetail(
        snapshot,
        fuelState,
        snapshot?.fuel.level_percent,
        snapshot?.fuel.range_km,
        thresholds,
      ),
    },
    {
      id: "battery",
      label: "Battery",
      value: formatMetric(snapshot?.engine.battery_voltage_v, 1),
      unit: "V",
      state: batteryState,
      detail: buildBatteryDetail(snapshot, batteryState, snapshot?.engine.battery_voltage_v),
    },
    {
      id: "afr",
      label: "AFR",
      value: formatMetric(snapshot?.engine.afr, 1),
      unit: "afr",
      state: afrState,
      detail: buildAfrDetail(snapshot, afrState, snapshot?.engine.afr),
    },
  ];
}

function buildCommonDriverView({
  snapshot,
  session,
  streamStatus,
  thresholds,
  displayPreferences,
  modeLabel,
  elapsedLabel,
  includeLapFooter,
}: BuildDriverScreenArgs & {
  modeLabel: string;
  elapsedLabel: string;
  includeLapFooter: boolean;
}): DriverScreenViewModelBase {
  const capabilities = getCapabilities(snapshot);
  const sessionClockState = getCapabilityVisualState(capabilities.session_clock);
  const lapTimingState = getCapabilityVisualState(capabilities.lap_timing);
  const alerts = sortAlerts([
    ...buildBackendAlerts(snapshot, thresholds, displayPreferences),
    ...buildSystemAlerts(snapshot, streamStatus),
  ]);
  const systemHealthState = getSystemHealthState(alerts);

  const footerItems: FooterItemView[] = [
    {
      id: "mode",
      label: "Mode",
      value: modeLabel,
    },
  ];

  if (includeLapFooter) {
    footerItems.push({
      id: "lap",
      label: "Lap",
      value:
        capabilities.lap_timing.level === "full"
          ? formatMetric(snapshot?.lap.lap_count, 0)
          : "--",
      state: lapTimingState,
    });
  }

  footerItems.push(
    {
      id: "elapsed",
      label: elapsedLabel,
      value: formatDuration(snapshot?.session.drive_time_ms ?? snapshot?.session.session_time_ms),
      state: sessionClockState,
    },
    {
      id: "session",
      label: "Session",
      value: session?.session_id ? session.session_id.slice(0, 18) : "--",
    },
    {
      id: "state",
      label: "State",
      value: STATE_LABELS[systemHealthState].toUpperCase(),
      state: systemHealthState,
    },
  );

  return {
    topStatuses: buildTopStatuses(snapshot, streamStatus, systemHealthState),
    alerts,
    focus: buildFocus(snapshot, displayPreferences),
    engineMetrics: buildEngineMetrics(snapshot, thresholds, displayPreferences),
    supportMetrics: buildSupportMetrics(snapshot, thresholds, displayPreferences, streamStatus),
    footerItems,
    summary: getSummary(alerts, snapshot),
  };
}

export function buildDriverLemonsViewModel(args: BuildDriverScreenArgs): DriverLemonsViewModel {
  const alerts = sortAlerts([
    ...buildBackendAlerts(args.snapshot, args.thresholds, args.displayPreferences),
    ...buildLemonsSystemAlerts(args.snapshot, args.streamStatus),
  ]);
  const systemHealthState = getSystemHealthState(alerts);

  return {
    topStatuses: buildLemonsTopStatuses(args.snapshot, args.streamStatus, systemHealthState),
    alerts,
    focus: buildFocus(args.snapshot, args.displayPreferences),
    lapMetric: buildLemonsLapMetric(args.snapshot),
    engineMetrics: buildEngineMetrics(args.snapshot, args.thresholds, args.displayPreferences),
    secondaryMetrics: buildLemonsSecondaryMetrics(args.snapshot, args.thresholds),
    summary: getLemonsSummary(alerts, args.snapshot),
  };
}

export function buildDriverNormalViewModel(args: BuildDriverScreenArgs): DriverNormalViewModel {
  const base = buildCommonDriverView({
    ...args,
    modeLabel: "NORMAL SESSION",
    elapsedLabel: "Drive",
    includeLapFooter: false,
  });
  const capabilities = getCapabilities(args.snapshot);
  const lapTimingState = getCapabilityVisualState(capabilities.lap_timing);
  const sessionClockState = getCapabilityVisualState(capabilities.session_clock);
  const lapTimingAvailable = capabilities.lap_timing.level === "full";
  const sessionClockAvailable = capabilities.session_clock.level !== "unavailable";

  return {
    ...base,
    timingMetrics: [
      {
        id: "current-lap",
        label: "Current Lap",
        value: lapTimingAvailable ? formatDuration(args.snapshot?.lap.current_lap_time_ms) : "--:--.---",
        state: !lapTimingAvailable
          ? lapTimingState
          : args.snapshot?.lap.current_lap_time_ms === null || args.snapshot?.lap.current_lap_time_ms === undefined
            ? "unavailable"
            : "normal",
        detail:
          !lapTimingAvailable
            ? unavailableCapabilityDetail(args.snapshot, capabilities.lap_timing, "Lap timer unavailable")
            : args.snapshot?.lap.current_lap_time_ms === null || args.snapshot?.lap.current_lap_time_ms === undefined
              ? unavailableMetricDetail(args.snapshot, "Lap timer unavailable")
              : "Live lap timer",
        emphasis: "primary",
      },
      {
        id: "best-lap",
        label: "Best Lap",
        value: lapTimingAvailable ? formatDuration(args.snapshot?.lap.best_lap_time_ms) : "--:--.---",
        state: !lapTimingAvailable
          ? lapTimingState
          : args.snapshot?.lap.best_lap_time_ms === null || args.snapshot?.lap.best_lap_time_ms === undefined
            ? "unavailable"
            : "normal",
        detail:
          !lapTimingAvailable
            ? unavailableCapabilityDetail(args.snapshot, capabilities.lap_timing, "No best lap yet")
            : args.snapshot?.lap.best_lap_time_ms === null || args.snapshot?.lap.best_lap_time_ms === undefined
              ? unavailableMetricDetail(args.snapshot, "No best lap yet")
              : "Best this session",
        emphasis: "primary",
      },
      {
        id: "delta",
        label: "Delta",
        value: lapTimingAvailable ? formatSignedDuration(args.snapshot?.lap.delta_ms) : "--",
        state:
          !lapTimingAvailable
            ? lapTimingState
            : args.snapshot?.lap.delta_ms === null || args.snapshot?.lap.delta_ms === undefined
              ? "unavailable"
              : args.snapshot.lap.delta_ms > 1500
                ? "warning"
                : args.snapshot.lap.delta_ms > 0
                  ? "advisory"
                  : "normal",
        detail:
          !lapTimingAvailable
            ? unavailableCapabilityDetail(args.snapshot, capabilities.lap_timing, "No reference lap yet")
            : args.snapshot?.lap.delta_ms === null || args.snapshot?.lap.delta_ms === undefined
              ? unavailableMetricDetail(args.snapshot, "No reference lap yet")
              : args.snapshot.lap.delta_ms > 0
                ? "Behind best lap"
                : "Ahead of best lap",
        emphasis: "secondary",
      },
      {
        id: "lap-count",
        label: "Lap Count",
        value: lapTimingAvailable ? formatMetric(args.snapshot?.lap.lap_count, 0) : "--",
        state: !lapTimingAvailable
          ? lapTimingState
          : args.snapshot?.lap.lap_count === null || args.snapshot?.lap.lap_count === undefined
            ? "unavailable"
            : "normal",
        detail:
          !lapTimingAvailable
            ? unavailableCapabilityDetail(args.snapshot, capabilities.lap_timing, "Lap count unavailable")
            : args.snapshot?.lap.lap_count === null || args.snapshot?.lap.lap_count === undefined
              ? unavailableMetricDetail(args.snapshot, "Lap count unavailable")
              : "Completed laps",
        emphasis: "secondary",
      },
      {
        id: "session-elapsed",
        label: "Session Elapsed",
        value: sessionClockAvailable ? formatDuration(args.snapshot?.session.session_time_ms) : "--:--.---",
        state:
          !sessionClockAvailable
            ? sessionClockState
            : args.snapshot?.session.session_time_ms === null || args.snapshot?.session.session_time_ms === undefined
              ? "unavailable"
              : capabilities.session_clock.level === "limited"
                ? "advisory"
                : "normal",
        detail:
          !sessionClockAvailable
            ? unavailableCapabilityDetail(args.snapshot, capabilities.session_clock, "Session clock unavailable")
            : args.snapshot?.session.session_time_ms === null || args.snapshot?.session.session_time_ms === undefined
              ? unavailableMetricDetail(args.snapshot, "Session clock unavailable")
              : capabilities.session_clock.level === "limited"
                ? capabilities.session_clock.detail
                : "Session clock",
        emphasis: "secondary",
      },
    ],
  };
}
