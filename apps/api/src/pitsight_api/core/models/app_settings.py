from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from pitsight_api.core.models.telemetry import ProviderName


def _coerce_mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return value
    return {}


class SpeedUnit(str, Enum):
    KPH = "kph"
    MPH = "mph"


class DistanceUnit(str, Enum):
    KM = "km"
    MILES = "miles"


class TemperatureUnit(str, Enum):
    CELSIUS = "celsius"
    FAHRENHEIT = "fahrenheit"


class PressureUnit(str, Enum):
    BAR = "bar"
    PSI = "psi"


class DriverMode(str, Enum):
    NORMAL = "normal"
    LEMONS = "lemons"


class DashboardMode(str, Enum):
    DRIVER_NORMAL = "driver_normal"
    DRIVER_LEMONS = "driver_lemons"
    PIT_DASHBOARD = "pit_dashboard"
    LAST_USED = "last_used"


class WifiMode(str, Enum):
    CLIENT = "client"
    HOTSPOT = "hotspot"
    OFF = "off"


class BluetoothPairingState(str, Enum):
    NOT_PAIRED = "not_paired"
    PAIRED = "paired"
    SEARCHING = "searching"


class ECUTransportMethod(str, Enum):
    SIMULATOR = "simulator"
    OBD2_BLUETOOTH = "obd2_bluetooth"
    USB_SERIAL = "usb_serial"
    DICTATOR_USB = "dictator_usb"
    DICTATOR_WIRELESS = "dictator_wireless"


class DictatorConnectionMethod(str, Enum):
    USB = "usb"
    WIRELESS = "wireless"


class CameraHardwareSource(str, Enum):
    NONE = "none"
    PI_CAM = "pi_cam"
    USB_CAM = "usb_cam"
    NETWORK_STREAM = "network_stream"


class CameraMode(str, Enum):
    DISABLED = "disabled"
    ROAD = "road"
    DRIVER = "driver"


class SyncState(str, Enum):
    SYNCED = "synced"
    PENDING_SYNC = "pending_sync"
    DEVICE_OFFLINE = "device_offline"
    LOCAL_DEVICE_SETTING = "local_device_setting"
    AWAITING_APPLY_CONFIRMATION = "awaiting_apply_confirmation"


class AlertThresholdSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    oil_pressure_advisory_bar: float = Field(gt=0, le=10)
    oil_pressure_warning_bar: float = Field(gt=0, le=10)
    oil_pressure_critical_bar: float = Field(gt=0, le=10)
    water_temp_advisory_c: float = Field(ge=20, le=180)
    water_temp_warning_c: float = Field(ge=20, le=180)
    water_temp_critical_c: float = Field(ge=20, le=180)
    oil_temp_advisory_c: float = Field(ge=20, le=220)
    oil_temp_warning_c: float = Field(ge=20, le=220)
    oil_temp_critical_c: float = Field(ge=20, le=220)
    battery_voltage_advisory_v: float = Field(ge=0, le=24)
    battery_voltage_warning_v: float = Field(ge=0, le=24)
    battery_voltage_critical_v: float = Field(ge=0, le=24)
    fuel_pressure_advisory_bar: float = Field(ge=0, le=10)
    fuel_pressure_warning_bar: float = Field(ge=0, le=10)
    fuel_pressure_critical_bar: float = Field(ge=0, le=10)
    lambda_advisory_delta: float = Field(ge=0, le=1)
    lambda_warning_delta: float = Field(ge=0, le=1)
    lambda_critical_delta: float = Field(ge=0, le=1)
    fuel_level_warning_percent: float = Field(ge=0, le=100)

    @model_validator(mode="after")
    def validate_threshold_order(self) -> "AlertThresholdSettings":
        if not (self.oil_pressure_critical_bar < self.oil_pressure_warning_bar < self.oil_pressure_advisory_bar):
            raise ValueError("Oil pressure thresholds must be critical < warning < advisory.")
        if not (self.water_temp_advisory_c < self.water_temp_warning_c < self.water_temp_critical_c):
            raise ValueError("Water temp thresholds must be advisory < warning < critical.")
        if not (self.oil_temp_advisory_c < self.oil_temp_warning_c < self.oil_temp_critical_c):
            raise ValueError("Oil temp thresholds must be advisory < warning < critical.")
        if not (
            self.battery_voltage_critical_v
            < self.battery_voltage_warning_v
            < self.battery_voltage_advisory_v
        ):
            raise ValueError("Battery voltage thresholds must be critical < warning < advisory.")
        if not (
            self.fuel_pressure_critical_bar
            < self.fuel_pressure_warning_bar
            < self.fuel_pressure_advisory_bar
        ):
            raise ValueError("Fuel pressure thresholds must be critical < warning < advisory.")
        if not (self.lambda_advisory_delta < self.lambda_warning_delta < self.lambda_critical_delta):
            raise ValueError("Lambda thresholds must be advisory < warning < critical.")
        return self


class DisplayPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    speed_unit: SpeedUnit = SpeedUnit.KPH
    distance_unit: DistanceUnit = DistanceUnit.KM
    temperature_unit: TemperatureUnit = TemperatureUnit.CELSIUS
    pressure_unit: PressureUnit = PressureUnit.BAR


class SharedDisplaySettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preferred_driver_mode: DriverMode = DriverMode.NORMAL
    show_secondary_alerts: bool = True
    keep_screen_awake: bool = True


class DeviceConnectionSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wifi_mode: WifiMode = WifiMode.CLIENT
    wifi_ssid: str = "PitSight Wi-Fi"
    ethernet_direct_enabled: bool = True
    direct_data_mode_enabled: bool = False
    bluetooth_enabled: bool = False
    bluetooth_obd_pairing_name: str = ""
    bluetooth_pairing_state: BluetoothPairingState = BluetoothPairingState.NOT_PAIRED


class DeviceVehicleSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ecu_type: str = "Simulator"
    ecu_transport_method: ECUTransportMethod = ECUTransportMethod.SIMULATOR
    usb_serial_device: str = "AUTO"
    dictator_connection_method: DictatorConnectionMethod = DictatorConnectionMethod.USB


class DeviceCameraSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    camera_enabled: bool = False
    camera_hardware_source: CameraHardwareSource = CameraHardwareSource.NONE


class DeviceDisplaySettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    default_dashboard_mode: DashboardMode = DashboardMode.DRIVER_NORMAL


class DeviceLocalSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connections: DeviceConnectionSettings = Field(default_factory=DeviceConnectionSettings)
    vehicle: DeviceVehicleSettings = Field(default_factory=DeviceVehicleSettings)
    camera: DeviceCameraSettings = Field(default_factory=DeviceCameraSettings)
    display: DeviceDisplaySettings = Field(default_factory=DeviceDisplaySettings)


class SharedSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    thresholds: AlertThresholdSettings
    units: DisplayPreferences = Field(default_factory=DisplayPreferences)
    display: SharedDisplaySettings = Field(default_factory=SharedDisplaySettings)
    telemetry_source_preference: ProviderName = ProviderName.SIMULATOR
    camera_mode_preference: CameraMode = CameraMode.DISABLED


class WebOperatorSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    alert_history_limit: int = Field(default=20, ge=5, le=200)
    diagnostics_panel_enabled: bool = True
    highlight_unsynced_settings: bool = True


class DeviceStateSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: str = "pitsight-pi-sim-01"
    device_label: str = "PitSight Pi Simulator"
    software_version: str = "0.1.0"
    last_known_dashboard_mode: DashboardMode = DashboardMode.DRIVER_NORMAL
    last_sync_at: datetime | None = Field(default_factory=lambda: datetime.now(timezone.utc))
    connected_peripherals: list[str] = Field(
        default_factory=lambda: ["simulator feed", "loopback websocket"]
    )


class SettingsSyncSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_online: bool = False
    sync_state: SyncState = SyncState.DEVICE_OFFLINE
    shared_sync_state: SyncState = SyncState.DEVICE_OFFLINE
    device_local_sync_state: SyncState = SyncState.DEVICE_OFFLINE
    display_mode_sync_state: SyncState = SyncState.DEVICE_OFFLINE
    last_sync_at: datetime | None = None
    pending_shared_changes: bool = False
    pending_device_local_changes: bool = False
    applied_dashboard_mode: DashboardMode = DashboardMode.DRIVER_NORMAL


class EffectiveSettingsSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_local: DeviceLocalSettings = Field(default_factory=DeviceLocalSettings)
    shared: SharedSettings


class SyncTestControls(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_online_override: bool | None = None
    auto_apply_shared: bool = True
    auto_apply_device_local: bool = True


class AppSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_local: DeviceLocalSettings
    shared: SharedSettings
    web: WebOperatorSettings = Field(default_factory=WebOperatorSettings)

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_payload(cls, raw_value: Any) -> Any:
        if not isinstance(raw_value, dict):
            return raw_value

        if "shared" in raw_value and "device_local" in raw_value:
            return raw_value

        if "thresholds" not in raw_value and "display" not in raw_value:
            return raw_value

        legacy_thresholds = raw_value.get("thresholds", {}) or {}
        legacy_display = raw_value.get("display", {}) or {}
        preferred_driver_mode = legacy_display.get("default_driver_mode", DriverMode.NORMAL.value)
        default_dashboard_mode = (
            DashboardMode.DRIVER_LEMONS.value
            if preferred_driver_mode == DriverMode.LEMONS.value
            else DashboardMode.DRIVER_NORMAL.value
        )

        return {
            "device_local": {
                "connections": DeviceConnectionSettings().model_dump(mode="json"),
                "vehicle": DeviceVehicleSettings().model_dump(mode="json"),
                "camera": DeviceCameraSettings().model_dump(mode="json"),
                "display": {
                    "default_dashboard_mode": default_dashboard_mode,
                },
            },
            "shared": {
                "thresholds": {
                    "oil_pressure_advisory_bar": legacy_thresholds.get("oil_pressure_warning_bar", 1.5) + 0.4,
                    "oil_pressure_warning_bar": legacy_thresholds.get("oil_pressure_warning_bar", 1.5),
                    "oil_pressure_critical_bar": legacy_thresholds.get("oil_pressure_critical_bar", 1.0),
                    "water_temp_advisory_c": legacy_thresholds.get("water_temp_warning_c", 105) - 5,
                    "water_temp_warning_c": legacy_thresholds.get("water_temp_warning_c", 105),
                    "water_temp_critical_c": legacy_thresholds.get("water_temp_critical_c", 112),
                    "oil_temp_advisory_c": legacy_thresholds.get("oil_temp_warning_c", 120) - 5,
                    "oil_temp_warning_c": legacy_thresholds.get("oil_temp_warning_c", 120),
                    "oil_temp_critical_c": legacy_thresholds.get("oil_temp_critical_c", 130),
                    "battery_voltage_advisory_v": 12.2,
                    "battery_voltage_warning_v": 11.8,
                    "battery_voltage_critical_v": 11.2,
                    "fuel_pressure_advisory_bar": 3.0,
                    "fuel_pressure_warning_bar": 2.6,
                    "fuel_pressure_critical_bar": 2.2,
                    "lambda_advisory_delta": 0.03,
                    "lambda_warning_delta": 0.06,
                    "lambda_critical_delta": 0.1,
                    "fuel_level_warning_percent": legacy_thresholds.get("fuel_level_warning_percent", 15),
                },
                "units": {
                    "speed_unit": legacy_display.get("speed_unit", SpeedUnit.KPH.value),
                    "distance_unit": DistanceUnit.KM.value,
                    "temperature_unit": legacy_display.get(
                        "temperature_unit", TemperatureUnit.CELSIUS.value
                    ),
                    "pressure_unit": legacy_display.get("pressure_unit", PressureUnit.BAR.value),
                },
                "display": {
                    "preferred_driver_mode": preferred_driver_mode,
                    "show_secondary_alerts": True,
                    "keep_screen_awake": True,
                },
                "telemetry_source_preference": ProviderName.SIMULATOR.value,
                "camera_mode_preference": CameraMode.DISABLED.value,
            },
            "web": WebOperatorSettings().model_dump(mode="json"),
        }


class AppSettingsSnapshot(AppSettingsUpdate):
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    device_state: DeviceStateSnapshot = Field(default_factory=DeviceStateSnapshot)
    sync: SettingsSyncSnapshot = Field(default_factory=SettingsSyncSnapshot)
    effective: EffectiveSettingsSnapshot
    sync_test: SyncTestControls = Field(default_factory=SyncTestControls)

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_snapshot(cls, raw_value: Any) -> Any:
        if not isinstance(raw_value, dict):
            return raw_value

        candidate: dict[str, Any]
        if "device_local" in raw_value and "shared" in raw_value:
            candidate = dict(raw_value)
        else:
            migrated_update = AppSettingsUpdate.migrate_legacy_payload(raw_value)
            if not isinstance(migrated_update, dict):
                return raw_value
            candidate = migrated_update

        updated_at = candidate.get("updated_at", datetime.now(timezone.utc).isoformat())
        device_local_payload = _coerce_mapping(candidate.get("device_local"))
        shared_payload = _coerce_mapping(candidate.get("shared"))
        raw_device_state = _coerce_mapping(candidate.get("device_state"))
        raw_sync = _coerce_mapping(candidate.get("sync"))
        effective = _coerce_mapping(candidate.get("effective"))
        effective_device_local = _coerce_mapping(effective.get("device_local")) or device_local_payload
        effective_shared = _coerce_mapping(effective.get("shared")) or shared_payload
        applied_dashboard_mode = raw_sync.get(
            "applied_dashboard_mode",
            effective_device_local.get("display", {}).get(
                "default_dashboard_mode",
                device_local_payload["display"]["default_dashboard_mode"],
            ),
        )
        last_known_dashboard_mode = raw_device_state.get(
            "last_known_dashboard_mode",
            applied_dashboard_mode,
        )

        return {
            **candidate,
            "device_local": device_local_payload,
            "shared": shared_payload,
            "updated_at": updated_at,
            "device_state": {
                **DeviceStateSnapshot().model_dump(mode="json"),
                **raw_device_state,
                "last_known_dashboard_mode": last_known_dashboard_mode,
                "last_sync_at": raw_device_state.get("last_sync_at", updated_at),
            },
            "sync": {
                **SettingsSyncSnapshot().model_dump(mode="json"),
                **raw_sync,
                "last_sync_at": raw_sync.get("last_sync_at", updated_at),
                "applied_dashboard_mode": applied_dashboard_mode,
            },
            "effective": {
                "device_local": effective_device_local,
                "shared": effective_shared,
            },
            "sync_test": {
                **SyncTestControls().model_dump(mode="json"),
                **_coerce_mapping(candidate.get("sync_test")),
            },
        }
