export type ProviderName = "simulator" | "obd2" | "dictator";
export type ConnectionState =
  | "connecting"
  | "connected"
  | "degraded"
  | "disconnected"
  | "fault";
export type AlertSeverity = "info" | "warning" | "critical";
export type HealthState = "nominal" | "warning" | "critical";
export type EventCategory =
  | "alert"
  | "source"
  | "camera"
  | "gps"
  | "display"
  | "settings"
  | "device";
export type EventAction =
  | "entered"
  | "cleared"
  | "changed"
  | "connected"
  | "disconnected"
  | "lost"
  | "acquired"
  | "requested"
  | "applied";
export type GPSFixState = "no_fix" | "2d" | "3d" | "dgps";
export type CameraState =
  | "disabled"
  | "loading"
  | "live"
  | "no_signal"
  | "offline"
  | "unavailable"
  | "fault";
export type CameraViewMode = "disabled" | "road" | "driver";

export interface SourceStatus {
  provider: ProviderName;
  transport: string;
  protocol: string;
  connection_state: ConnectionState;
  connected: boolean;
  raw_capture_enabled: boolean;
  details?: Record<string, unknown> | null;
}

export interface LapMetrics {
  lap_count?: number | null;
  current_lap_time_ms?: number | null;
  previous_lap_time_ms?: number | null;
  best_lap_time_ms?: number | null;
  optimal_lap_estimate_ms?: number | null;
  delta_ms?: number | null;
}

export interface SessionMetrics {
  session_time_ms?: number | null;
  drive_time_ms?: number | null;
  stint_time_ms?: number | null;
}

export interface EngineMetrics {
  speed_kph?: number | null;
  rpm?: number | null;
  gear?: number | null;
  water_temp_c?: number | null;
  oil_temp_c?: number | null;
  oil_pressure_bar?: number | null;
  battery_voltage_v?: number | null;
  lambda_value?: number | null;
  afr?: number | null;
  intake_temp_c?: number | null;
  throttle_position_pct?: number | null;
}

export interface FuelMetrics {
  level_percent?: number | null;
  range_km?: number | null;
  pressure_bar?: number | null;
}

export interface GPSMetrics {
  latitude?: number | null;
  longitude?: number | null;
  speed_kph?: number | null;
  fix_state?: GPSFixState | null;
  present?: boolean | null;
  connection_state?: ConnectionState | null;
  source?: string | null;
  updated_at?: string | null;
  detail?: string | null;
}

export interface CameraMetrics {
  state?: CameraState | null;
  mode?: CameraViewMode | null;
  stream_url?: string | null;
  detail?: string | null;
  present?: boolean | null;
  last_frame_at?: string | null;
}

export interface AlertEvent {
  timestamp?: string | null;
  code: string;
  severity: AlertSeverity;
  message: string;
  active: boolean;
  value?: number | null;
  threshold?: number | null;
}

export interface SystemEvent {
  timestamp: string;
  session_id?: string | null;
  category: EventCategory;
  code: string;
  action: EventAction;
  severity: AlertSeverity;
  title: string;
  detail: string;
  metadata?: Record<string, unknown> | null;
}

export interface TelemetrySnapshot {
  schema_version: string;
  session_id: string;
  sequence: number;
  timestamp: string;
  source: SourceStatus;
  lap: LapMetrics;
  session: SessionMetrics;
  engine: EngineMetrics;
  fuel: FuelMetrics;
  gps: GPSMetrics;
  camera: CameraMetrics;
  alerts: AlertEvent[];
  health_state: HealthState;
}

export interface SessionRecord {
  session_id: string;
  provider: ProviderName;
  started_at: string;
  ended_at?: string | null;
}
