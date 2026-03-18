export type ProviderName = "simulator" | "obd2" | "dictator";
export type ConnectionState =
  | "connecting"
  | "connected"
  | "degraded"
  | "disconnected"
  | "fault";
export type AlertSeverity = "info" | "warning" | "critical";
export type HealthState = "nominal" | "warning" | "critical";

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
}

export interface SessionMetrics {
  session_time_ms?: number | null;
  drive_time_ms?: number | null;
  stint_time_ms?: number | null;
}

export interface EngineMetrics {
  speed_kph?: number | null;
  rpm?: number | null;
  water_temp_c?: number | null;
  oil_temp_c?: number | null;
  oil_pressure_bar?: number | null;
}

export interface FuelMetrics {
  level_percent?: number | null;
  range_km?: number | null;
}

export interface GPSMetrics {
  latitude?: number | null;
  longitude?: number | null;
  speed_kph?: number | null;
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
  alerts: AlertEvent[];
  health_state: HealthState;
}

export interface SessionRecord {
  session_id: string;
  provider: ProviderName;
  started_at: string;
  ended_at?: string | null;
}
