export type SpeedUnit = "kph" | "mph";
export type DistanceUnit = "km" | "miles";
export type TemperatureUnit = "celsius" | "fahrenheit";
export type PressureUnit = "bar" | "psi";
export type DriverMode = "normal" | "lemons";
export type DashboardMode =
  | "driver_normal"
  | "driver_lemons"
  | "pit_dashboard"
  | "last_used";
export type WifiMode = "client" | "hotspot" | "off";
export type BluetoothPairingState = "not_paired" | "paired" | "searching";
export type ECUTransportMethod =
  | "simulator"
  | "obd2_bluetooth"
  | "usb_serial"
  | "dictator_usb"
  | "dictator_wireless";
export type DictatorConnectionMethod = "usb" | "wireless";
export type CameraHardwareSource = "none" | "pi_cam" | "usb_cam" | "network_stream";
export type CameraMode = "disabled" | "road" | "driver";
export type SyncState =
  | "synced"
  | "pending_sync"
  | "device_offline"
  | "local_device_setting"
  | "awaiting_apply_confirmation";
export type ProviderName = "simulator" | "obd2" | "dictator";
export type ProviderSelectionState = "active" | "restart_required" | "invalid";
export type DeviceConnectionHealth = "nominal" | "degraded" | "fault" | "offline";
export type ActiveDashboardModeSource = "reported" | "applied_default" | "last_known";
export type TelemetryConnectionState =
  | "connecting"
  | "connected"
  | "degraded"
  | "disconnected"
  | "fault";

export interface AlertThresholdSettings {
  oil_pressure_advisory_bar: number;
  oil_pressure_warning_bar: number;
  oil_pressure_critical_bar: number;
  water_temp_advisory_c: number;
  water_temp_warning_c: number;
  water_temp_critical_c: number;
  oil_temp_advisory_c: number;
  oil_temp_warning_c: number;
  oil_temp_critical_c: number;
  battery_voltage_advisory_v: number;
  battery_voltage_warning_v: number;
  battery_voltage_critical_v: number;
  fuel_pressure_advisory_bar: number;
  fuel_pressure_warning_bar: number;
  fuel_pressure_critical_bar: number;
  lambda_advisory_delta: number;
  lambda_warning_delta: number;
  lambda_critical_delta: number;
  fuel_level_warning_percent: number;
}

export interface DisplayPreferences {
  speed_unit: SpeedUnit;
  distance_unit: DistanceUnit;
  temperature_unit: TemperatureUnit;
  pressure_unit: PressureUnit;
}

export interface SharedDisplaySettings {
  preferred_driver_mode: DriverMode;
  show_secondary_alerts: boolean;
  keep_screen_awake: boolean;
}

export interface DeviceConnectionSettings {
  wifi_mode: WifiMode;
  wifi_ssid: string;
  ethernet_direct_enabled: boolean;
  direct_data_mode_enabled: boolean;
  bluetooth_enabled: boolean;
  bluetooth_obd_pairing_name: string;
  bluetooth_pairing_state: BluetoothPairingState;
}

export interface DeviceVehicleSettings {
  ecu_type: string;
  ecu_transport_method: ECUTransportMethod;
  usb_serial_device: string;
  dictator_connection_method: DictatorConnectionMethod;
}

export interface DeviceCameraSettings {
  camera_enabled: boolean;
  camera_hardware_source: CameraHardwareSource;
}

export interface DeviceDisplaySettings {
  default_dashboard_mode: DashboardMode;
}

export interface DeviceLocalSettings {
  connections: DeviceConnectionSettings;
  vehicle: DeviceVehicleSettings;
  camera: DeviceCameraSettings;
  display: DeviceDisplaySettings;
}

export interface SharedSettings {
  thresholds: AlertThresholdSettings;
  units: DisplayPreferences;
  display: SharedDisplaySettings;
  telemetry_source_preference: ProviderName;
  camera_mode_preference: CameraMode;
}

export interface WebOperatorSettings {
  alert_history_limit: number;
  diagnostics_panel_enabled: boolean;
  highlight_unsynced_settings: boolean;
}

export interface DeviceStateSnapshot {
  device_id: string;
  device_label: string;
  software_version: string;
  hostname: string;
  platform: string;
  heartbeat_interval_seconds: number;
  heartbeat_timeout_seconds: number;
  last_seen_at: string | null;
  last_known_dashboard_mode: DashboardMode;
  current_dashboard_mode: DashboardMode;
  current_dashboard_mode_source: ActiveDashboardModeSource;
  active_source_provider: ProviderName | null;
  source_connection_state: TelemetryConnectionState | null;
  source_connected: boolean;
  connection_health_summary: DeviceConnectionHealth;
  online: boolean;
  last_sync_at: string | null;
  connected_peripherals: string[];
}

export interface DeviceHeartbeatReport {
  current_dashboard_mode?: DashboardMode | null;
  active_source_provider?: ProviderName | null;
  source_connection_state?: TelemetryConnectionState | null;
  source_connected?: boolean | null;
  connected_peripherals?: string[] | null;
}

export interface ProviderRuntimeSnapshot {
  boot_provider: ProviderName;
  requested_provider: ProviderName;
  active_provider: ProviderName;
  selection_state: ProviderSelectionState;
  live_switch_supported: boolean;
  restart_required: boolean;
  detail: string;
}

export interface SettingsSyncSnapshot {
  device_online: boolean;
  sync_state: SyncState;
  shared_sync_state: SyncState;
  device_local_sync_state: SyncState;
  display_mode_sync_state: SyncState;
  last_sync_at: string | null;
  pending_shared_changes: boolean;
  pending_device_local_changes: boolean;
  applied_dashboard_mode: DashboardMode;
}

export interface EffectiveSettingsSnapshot {
  device_local: DeviceLocalSettings;
  shared: SharedSettings;
}

export interface SyncTestControls {
  device_online_override: boolean | null;
  auto_apply_shared: boolean;
  auto_apply_device_local: boolean;
}

export interface AppSettingsUpdate {
  device_local: DeviceLocalSettings;
  shared: SharedSettings;
  web: WebOperatorSettings;
}

export interface AppSettingsSnapshot extends AppSettingsUpdate {
  updated_at: string;
  device_state: DeviceStateSnapshot;
  provider_runtime: ProviderRuntimeSnapshot;
  sync: SettingsSyncSnapshot;
  effective: EffectiveSettingsSnapshot;
  sync_test: SyncTestControls;
}

const EPOCH = new Date(0).toISOString();

export const DEFAULT_APP_SETTINGS_UPDATE: AppSettingsUpdate = {
  device_local: {
    connections: {
      wifi_mode: "client",
      wifi_ssid: "PitSight Wi-Fi",
      ethernet_direct_enabled: true,
      direct_data_mode_enabled: false,
      bluetooth_enabled: false,
      bluetooth_obd_pairing_name: "",
      bluetooth_pairing_state: "not_paired",
    },
    vehicle: {
      ecu_type: "Simulator",
      ecu_transport_method: "simulator",
      usb_serial_device: "AUTO",
      dictator_connection_method: "usb",
    },
    camera: {
      camera_enabled: false,
      camera_hardware_source: "none",
    },
    display: {
      default_dashboard_mode: "driver_normal",
    },
  },
  shared: {
    thresholds: {
      oil_pressure_advisory_bar: 1.9,
      oil_pressure_warning_bar: 1.5,
      oil_pressure_critical_bar: 1.0,
      water_temp_advisory_c: 100,
      water_temp_warning_c: 105,
      water_temp_critical_c: 112,
      oil_temp_advisory_c: 115,
      oil_temp_warning_c: 120,
      oil_temp_critical_c: 130,
      battery_voltage_advisory_v: 12.2,
      battery_voltage_warning_v: 11.8,
      battery_voltage_critical_v: 11.2,
      fuel_pressure_advisory_bar: 3.0,
      fuel_pressure_warning_bar: 2.6,
      fuel_pressure_critical_bar: 2.2,
      lambda_advisory_delta: 0.03,
      lambda_warning_delta: 0.06,
      lambda_critical_delta: 0.1,
      fuel_level_warning_percent: 15,
    },
    units: {
      speed_unit: "kph",
      distance_unit: "km",
      temperature_unit: "celsius",
      pressure_unit: "bar",
    },
    display: {
      preferred_driver_mode: "normal",
      show_secondary_alerts: true,
      keep_screen_awake: true,
    },
    telemetry_source_preference: "simulator",
    camera_mode_preference: "disabled",
  },
  web: {
    alert_history_limit: 20,
    diagnostics_panel_enabled: true,
    highlight_unsynced_settings: true,
  },
};

export const DEFAULT_APP_SETTINGS: AppSettingsSnapshot = {
  ...DEFAULT_APP_SETTINGS_UPDATE,
  updated_at: EPOCH,
  device_state: {
    device_id: "pitsight-pi-sim-01",
    device_label: "PitSight Pi Simulator",
    software_version: "0.1.0",
    hostname: "localhost",
    platform: "simulator",
    heartbeat_interval_seconds: 5,
    heartbeat_timeout_seconds: 15,
    last_seen_at: null,
    last_known_dashboard_mode: "driver_normal",
    current_dashboard_mode: "driver_normal",
    current_dashboard_mode_source: "applied_default",
    active_source_provider: null,
    source_connection_state: null,
    source_connected: false,
    connection_health_summary: "offline",
    online: false,
    last_sync_at: EPOCH,
    connected_peripherals: ["simulator feed", "loopback websocket"],
  },
  provider_runtime: {
    boot_provider: "simulator",
    requested_provider: "simulator",
    active_provider: "simulator",
    selection_state: "active",
    live_switch_supported: false,
    restart_required: false,
    detail:
      "Telemetry provider selection is explicit at backend startup. Changing providers requires a backend or Pi restart.",
  },
  sync: {
    device_online: false,
    sync_state: "device_offline",
    shared_sync_state: "device_offline",
    device_local_sync_state: "device_offline",
    display_mode_sync_state: "device_offline",
    last_sync_at: EPOCH,
    pending_shared_changes: false,
    pending_device_local_changes: false,
    applied_dashboard_mode: "driver_normal",
  },
  effective: {
    device_local: structuredClone(DEFAULT_APP_SETTINGS_UPDATE.device_local),
    shared: structuredClone(DEFAULT_APP_SETTINGS_UPDATE.shared),
  },
  sync_test: {
    device_online_override: null,
    auto_apply_shared: true,
    auto_apply_device_local: true,
  },
};
