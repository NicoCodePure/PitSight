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
  last_known_dashboard_mode: DashboardMode;
  last_sync_at: string | null;
  connected_peripherals: string[];
}

export interface SettingsSyncSnapshot {
  device_online: boolean;
  sync_state: SyncState;
  last_sync_at: string | null;
  pending_shared_changes: boolean;
  applied_dashboard_mode: DashboardMode;
}

export interface AppSettingsUpdate {
  device_local: DeviceLocalSettings;
  shared: SharedSettings;
  web: WebOperatorSettings;
}

export interface AppSettingsSnapshot extends AppSettingsUpdate {
  updated_at: string;
  device_state: DeviceStateSnapshot;
  sync: SettingsSyncSnapshot;
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
    last_known_dashboard_mode: "driver_normal",
    last_sync_at: EPOCH,
    connected_peripherals: ["simulator feed", "loopback websocket"],
  },
  sync: {
    device_online: false,
    sync_state: "device_offline",
    last_sync_at: EPOCH,
    pending_shared_changes: false,
    applied_dashboard_mode: "driver_normal",
  },
};
