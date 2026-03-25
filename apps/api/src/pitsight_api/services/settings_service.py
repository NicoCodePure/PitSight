from __future__ import annotations

from datetime import datetime, timezone

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import (
    AlertThresholdSettings,
    AppSettingsSnapshot,
    AppSettingsUpdate,
    CameraMode,
    DeviceConnectionHealth,
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
    EffectiveSettingsSnapshot,
    SettingsSyncSnapshot,
    SharedDisplaySettings,
    SharedSettings,
    SyncState,
    SyncTestControls,
    WebOperatorSettings,
)
from pitsight_api.core.models.telemetry import SourceStatus
from pitsight_api.services.device_runtime_service import DeviceRuntimeService
from pitsight_api.services.event_service import EventService
from pitsight_api.storage.repository import SQLiteRepository


class SettingsService:
    def __init__(
        self,
        repository: SQLiteRepository,
        defaults: Settings,
        device_runtime_service: DeviceRuntimeService,
        event_service: EventService | None = None,
    ) -> None:
        self.repository = repository
        self.defaults = defaults
        self.device_runtime_service = device_runtime_service
        self.event_service = event_service
        self._current: AppSettingsSnapshot | None = None

    async def load(self) -> AppSettingsSnapshot:
        stored = await self.repository.fetch_app_settings()
        if stored is not None:
            self.device_runtime_service.prime(stored.device_state)
            self._current = stored
            return stored

        default_settings = AppSettingsSnapshot(**self.default_update().model_dump())
        await self.repository.store_app_settings(default_settings)
        self.device_runtime_service.prime(default_settings.device_state)
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
        runtime_device_state = self.device_runtime_service.snapshot(
            applied_dashboard_mode=current.effective.device_local.display.default_dashboard_mode,
            stored_state=current.device_state,
        )
        next_snapshot = AppSettingsSnapshot(
            device_local=update.device_local,
            shared=update.shared,
            web=update.web,
            updated_at=datetime.now(timezone.utc),
            device_state=runtime_device_state,
            sync=current.sync,
            effective=current.effective,
            sync_test=current.sync_test,
        )
        if self.event_service is not None:
            events = self.event_service.build_settings_update_events(current, next_snapshot)
            await self.event_service.record_events(events)
        await self.repository.store_app_settings(next_snapshot)
        self._current = next_snapshot
        return next_snapshot

    async def update_sync_test(self, controls: SyncTestControls) -> AppSettingsSnapshot:
        current = self.current()
        runtime_device_state = self.device_runtime_service.snapshot(
            applied_dashboard_mode=current.effective.device_local.display.default_dashboard_mode,
            stored_state=current.device_state,
        )
        next_snapshot = current.model_copy(update={"sync_test": controls})
        next_snapshot = next_snapshot.model_copy(update={"device_state": runtime_device_state})
        await self.repository.store_app_settings(next_snapshot)
        self._current = next_snapshot
        return next_snapshot

    async def apply_requested_to_device(
        self,
        source_status: SourceStatus | None,
        source_observed_at: datetime | None = None,
    ) -> AppSettingsSnapshot:
        current = self.current()
        if source_status is not None:
            self.device_runtime_service.observe_source(source_status, observed_at=source_observed_at)
        runtime_device_state = self.device_runtime_service.snapshot(
            applied_dashboard_mode=current.effective.device_local.display.default_dashboard_mode,
            stored_state=current.device_state,
        )
        device_online = self._resolve_device_online(runtime_device_state.online, current.sync_test)
        if not device_online:
            return await self.runtime_snapshot(source_status, source_observed_at)

        next_snapshot = self._apply_effective_state(
            current=current,
            apply_shared=True,
            apply_device_local=True,
            confirmed_at=datetime.now(timezone.utc),
        )
        if self.event_service is not None:
            events = self.event_service.build_settings_applied_events(current, next_snapshot)
            await self.event_service.record_events(events)
        await self.repository.store_app_settings(next_snapshot)
        self._current = next_snapshot
        return await self.runtime_snapshot(source_status, source_observed_at)

    def _resolve_device_online(
        self,
        runtime_online: bool,
        controls: SyncTestControls,
    ) -> bool:
        if controls.device_online_override is not None:
            return controls.device_online_override
        return runtime_online

    def _apply_effective_state(
        self,
        current: AppSettingsSnapshot,
        *,
        apply_shared: bool,
        apply_device_local: bool,
        confirmed_at: datetime,
    ) -> AppSettingsSnapshot:
        effective = current.effective

        next_effective = EffectiveSettingsSnapshot(
            device_local=current.device_local if apply_device_local else effective.device_local,
            shared=current.shared if apply_shared else effective.shared,
        )

        device_state = current.device_state.model_copy(
            update={
                "last_known_dashboard_mode": next_effective.device_local.display.default_dashboard_mode,
                "last_sync_at": confirmed_at,
            }
        )

        return current.model_copy(
            update={
                "effective": next_effective,
                "device_state": device_state,
            }
        )

    def _sync_state_for_pending(self, device_online: bool, pending: bool) -> SyncState:
        if pending:
            return SyncState.AWAITING_APPLY_CONFIRMATION if device_online else SyncState.PENDING_SYNC
        return SyncState.SYNCED if device_online else SyncState.DEVICE_OFFLINE

    async def runtime_snapshot(
        self,
        source_status: SourceStatus | None,
        source_observed_at: datetime | None = None,
    ) -> AppSettingsSnapshot:
        current = self.current()
        if source_status is not None:
            self.device_runtime_service.observe_source(source_status, observed_at=source_observed_at)
        initial_runtime_device_state = self.device_runtime_service.snapshot(
            applied_dashboard_mode=current.effective.device_local.display.default_dashboard_mode,
            stored_state=current.device_state,
        )
        device_online = self._resolve_device_online(initial_runtime_device_state.online, current.sync_test)
        should_apply_shared = device_online and current.sync_test.auto_apply_shared
        should_apply_device_local = device_online and current.sync_test.auto_apply_device_local

        if should_apply_shared or should_apply_device_local:
            maybe_next = self._apply_effective_state(
                current=current,
                apply_shared=should_apply_shared,
                apply_device_local=should_apply_device_local,
                confirmed_at=datetime.now(timezone.utc),
            )
            if maybe_next != current:
                current = maybe_next
                await self.repository.store_app_settings(current)
                self._current = current

        runtime_device_state = self.device_runtime_service.snapshot(
            applied_dashboard_mode=current.effective.device_local.display.default_dashboard_mode,
            stored_state=current.device_state,
        )

        pending_shared_changes = current.shared != current.effective.shared
        pending_device_local_changes = current.device_local != current.effective.device_local
        display_mode_pending = (
            current.device_local.display.default_dashboard_mode
            != current.effective.device_local.display.default_dashboard_mode
        )

        shared_sync_state = self._sync_state_for_pending(device_online, pending_shared_changes)
        device_local_sync_state = self._sync_state_for_pending(device_online, pending_device_local_changes)
        display_mode_sync_state = self._sync_state_for_pending(device_online, display_mode_pending)
        overall_pending = pending_shared_changes or pending_device_local_changes
        sync_state = self._sync_state_for_pending(device_online, overall_pending)
        runtime_device_state_for_response = runtime_device_state.model_copy(
            update={
                "online": device_online,
                "connection_health_summary": (
                    runtime_device_state.connection_health_summary
                    if device_online
                    else DeviceConnectionHealth.OFFLINE
                ),
            }
        )

        response_snapshot = current.model_copy(
            update={
                "device_state": runtime_device_state_for_response,
                "sync": SettingsSyncSnapshot(
                    device_online=device_online,
                    sync_state=sync_state,
                    shared_sync_state=shared_sync_state,
                    device_local_sync_state=device_local_sync_state,
                    display_mode_sync_state=display_mode_sync_state,
                    last_sync_at=runtime_device_state.last_sync_at,
                    pending_shared_changes=pending_shared_changes,
                    pending_device_local_changes=pending_device_local_changes,
                    applied_dashboard_mode=current.effective.device_local.display.default_dashboard_mode,
                )
            }
        )
        if self.event_service is not None:
            events = self.event_service.build_device_state_events(
                current.device_state,
                response_snapshot.device_state,
            )
            await self.event_service.record_events(events)
        self._current = response_snapshot
        return response_snapshot
