from __future__ import annotations

from datetime import datetime, timezone

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import (
    AlertThresholdSettings,
    AppSettingsSnapshot,
    AppSettingsUpdate,
    CameraMode,
    DistanceUnit,
    DeviceConnectionSettings,
    DeviceDisplaySettings,
    DeviceLocalSettings,
    DeviceStateSnapshot,
    DeviceVehicleSettings,
    DeviceCameraSettings,
    DictatorConnectionMethod,
    DisplayPreferences,
    ECUTransportMethod,
    SettingsSyncSnapshot,
    SharedDisplaySettings,
    SharedSettings,
    SyncState,
    WebOperatorSettings,
)
from pitsight_api.core.models.telemetry import SourceStatus
from pitsight_api.storage.repository import SQLiteRepository


class SettingsService:
    def __init__(self, repository: SQLiteRepository, defaults: Settings) -> None:
        self.repository = repository
        self.defaults = defaults
        self._current: AppSettingsSnapshot | None = None

    async def load(self) -> AppSettingsSnapshot:
        stored = await self.repository.fetch_app_settings()
        if stored is not None:
            self._current = stored
            return stored

        default_settings = AppSettingsSnapshot(**self.default_update().model_dump())
        await self.repository.store_app_settings(default_settings)
        self._current = default_settings
        return default_settings

    def current(self) -> AppSettingsSnapshot:
        if self._current is None:
            raise RuntimeError("App settings have not been loaded.")
        return self._current

    def default_update(self) -> AppSettingsUpdate:
        return AppSettingsUpdate(
            device_local=DeviceLocalSettings(
                connections=DeviceConnectionSettings(),
                vehicle=DeviceVehicleSettings(
                    ecu_type="Simulator",
                    ecu_transport_method=ECUTransportMethod.SIMULATOR,
                    usb_serial_device="AUTO",
                    dictator_connection_method=DictatorConnectionMethod.USB,
                ),
                camera=DeviceCameraSettings(),
                display=DeviceDisplaySettings(),
            ),
            shared=SharedSettings(
                thresholds=AlertThresholdSettings(
                    oil_pressure_advisory_bar=self.defaults.oil_pressure_warning_bar + 0.4,
                    oil_pressure_warning_bar=self.defaults.oil_pressure_warning_bar,
                    oil_pressure_critical_bar=self.defaults.oil_pressure_critical_bar,
                    water_temp_advisory_c=self.defaults.water_temp_warning_c - 5,
                    water_temp_warning_c=self.defaults.water_temp_warning_c,
                    water_temp_critical_c=self.defaults.water_temp_critical_c,
                    oil_temp_advisory_c=self.defaults.oil_temp_warning_c - 5,
                    oil_temp_warning_c=self.defaults.oil_temp_warning_c,
                    oil_temp_critical_c=self.defaults.oil_temp_critical_c,
                    battery_voltage_advisory_v=12.2,
                    battery_voltage_warning_v=11.8,
                    battery_voltage_critical_v=11.2,
                    fuel_pressure_advisory_bar=3.0,
                    fuel_pressure_warning_bar=2.6,
                    fuel_pressure_critical_bar=2.2,
                    lambda_advisory_delta=0.03,
                    lambda_warning_delta=0.06,
                    lambda_critical_delta=0.1,
                    fuel_level_warning_percent=self.defaults.fuel_level_warning_percent,
                ),
                units=DisplayPreferences(
                    speed_unit=self.defaults.default_speed_unit,
                    distance_unit=DistanceUnit.KM,
                    temperature_unit=self.defaults.default_temperature_unit,
                    pressure_unit=self.defaults.default_pressure_unit,
                ),
                display=SharedDisplaySettings(
                    preferred_driver_mode=self.defaults.default_driver_mode,
                    show_secondary_alerts=True,
                    keep_screen_awake=True,
                ),
                telemetry_source_preference=self.defaults.provider_mode,
                camera_mode_preference=CameraMode.DISABLED,
            ),
            web=WebOperatorSettings(),
        )

    async def update(self, update: AppSettingsUpdate) -> AppSettingsSnapshot:
        current = self.current()
        next_snapshot = AppSettingsSnapshot(
            device_local=update.device_local,
            shared=update.shared,
            web=update.web,
            updated_at=datetime.now(timezone.utc),
            device_state=current.device_state,
            sync=current.sync,
        )
        await self.repository.store_app_settings(next_snapshot)
        self._current = next_snapshot
        return next_snapshot

    async def runtime_snapshot(self, source_status: SourceStatus | None) -> AppSettingsSnapshot:
        current = self.current()
        device_online = bool(source_status is not None and source_status.connected)

        if device_online:
            next_device_state = current.device_state.model_copy(
                update={
                    "last_known_dashboard_mode": current.device_local.display.default_dashboard_mode,
                    "last_sync_at": current.updated_at,
                }
            )
            if next_device_state != current.device_state:
                current = current.model_copy(update={"device_state": next_device_state})
                await self.repository.store_app_settings(current)
                self._current = current

        last_sync_at = current.updated_at if device_online else current.device_state.last_sync_at
        pending_shared_changes = (
            not device_online
            and current.device_state.last_sync_at is not None
            and current.updated_at > current.device_state.last_sync_at
        )

        sync_state = (
            SyncState.SYNCED
            if device_online
            else SyncState.PENDING_SYNC if pending_shared_changes else SyncState.DEVICE_OFFLINE
        )

        return current.model_copy(
            update={
                "sync": SettingsSyncSnapshot(
                    device_online=device_online,
                    sync_state=sync_state,
                    last_sync_at=last_sync_at,
                    pending_shared_changes=pending_shared_changes,
                    applied_dashboard_mode=(
                        current.device_local.display.default_dashboard_mode
                        if device_online
                        else current.device_state.last_known_dashboard_mode
                    ),
                )
            }
        )
