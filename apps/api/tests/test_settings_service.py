from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from pitsight_api.config import Settings
from pitsight_api.core.models.app_settings import (
    AppSettingsUpdate,
    DashboardMode,
    DistanceUnit,
    DriverMode,
    PressureUnit,
    SpeedUnit,
    SyncState,
    SyncTestControls,
    TemperatureUnit,
    WifiMode,
)
from pitsight_api.core.models.telemetry import ConnectionState, ProviderName, SourceStatus
from pitsight_api.services.device_runtime_service import DeviceRuntimeService
from pitsight_api.services.settings_service import SettingsService
from pitsight_api.storage.repository import SQLiteRepository


def test_settings_service_persists_updates_and_exposes_defaults(tmp_path) -> None:
    async def scenario() -> None:
        database_path = tmp_path / "pitsight-settings.db"
        defaults = Settings(
            _env_file=None,
            database_path=database_path,
            oil_pressure_warning_bar=1.7,
            oil_pressure_critical_bar=1.2,
            water_temp_warning_c=104,
            water_temp_critical_c=111,
            oil_temp_warning_c=118,
            oil_temp_critical_c=128,
            fuel_level_warning_percent=18,
            default_speed_unit=SpeedUnit.MPH,
            default_temperature_unit=TemperatureUnit.FAHRENHEIT,
            default_pressure_unit=PressureUnit.PSI,
            default_driver_mode=DriverMode.LEMONS,
        )

        repository = SQLiteRepository(database_path)
        await repository.initialize()

        service = SettingsService(
            repository=repository,
            defaults=defaults,
            device_runtime_service=DeviceRuntimeService(defaults),
        )
        loaded = await service.load()
        default_update = service.default_update()

        assert loaded.shared.thresholds.oil_pressure_warning_bar == 1.7
        assert loaded.shared.thresholds.oil_pressure_advisory_bar == 2.1
        assert loaded.shared.units.pressure_unit is PressureUnit.PSI
        assert loaded.shared.units.distance_unit is DistanceUnit.KM
        assert loaded.shared.display.preferred_driver_mode is DriverMode.LEMONS
        assert loaded.device_local.display.default_dashboard_mode is DashboardMode.DRIVER_NORMAL
        assert loaded.effective.shared.thresholds.oil_pressure_warning_bar == 1.7
        assert loaded.effective.device_local.display.default_dashboard_mode is DashboardMode.DRIVER_NORMAL
        assert loaded.sync_test.auto_apply_shared is True
        assert default_update.shared.units.pressure_unit is PressureUnit.PSI

        updated = await service.update(
            AppSettingsUpdate.model_validate(
                {
                    "device_local": {
                        "connections": {
                            "wifi_mode": "hotspot",
                            "wifi_ssid": "PitLane",
                            "ethernet_direct_enabled": True,
                            "direct_data_mode_enabled": True,
                            "bluetooth_enabled": True,
                            "bluetooth_obd_pairing_name": "OBDLink MX+",
                            "bluetooth_pairing_state": "paired",
                        },
                        "vehicle": {
                            "ecu_type": "Dictator",
                            "ecu_transport_method": "dictator_usb",
                            "usb_serial_device": "COM7",
                            "dictator_connection_method": "usb",
                        },
                        "camera": {
                            "camera_enabled": True,
                            "camera_hardware_source": "usb_cam",
                        },
                        "display": {
                            "default_dashboard_mode": "pit_dashboard",
                        },
                    },
                    "shared": {
                        "thresholds": {
                            "oil_pressure_advisory_bar": 2.2,
                            "oil_pressure_warning_bar": 1.9,
                            "oil_pressure_critical_bar": 1.3,
                            "water_temp_advisory_c": 101,
                            "water_temp_warning_c": 106,
                            "water_temp_critical_c": 113,
                            "oil_temp_advisory_c": 116,
                            "oil_temp_warning_c": 121,
                            "oil_temp_critical_c": 132,
                            "battery_voltage_advisory_v": 12.3,
                            "battery_voltage_warning_v": 11.9,
                            "battery_voltage_critical_v": 11.1,
                            "fuel_pressure_advisory_bar": 3.1,
                            "fuel_pressure_warning_bar": 2.7,
                            "fuel_pressure_critical_bar": 2.3,
                            "lambda_advisory_delta": 0.03,
                            "lambda_warning_delta": 0.06,
                            "lambda_critical_delta": 0.11,
                            "fuel_level_warning_percent": 12,
                        },
                        "units": {
                            "speed_unit": "kph",
                            "distance_unit": "miles",
                            "temperature_unit": "celsius",
                            "pressure_unit": "bar",
                        },
                        "display": {
                            "preferred_driver_mode": "normal",
                            "show_secondary_alerts": False,
                            "keep_screen_awake": True,
                        },
                        "telemetry_source_preference": "dictator",
                        "camera_mode_preference": "driver",
                    },
                    "web": {
                        "alert_history_limit": 40,
                        "diagnostics_panel_enabled": False,
                        "highlight_unsynced_settings": True,
                    }
                }
            )
        )
        assert updated.shared.thresholds.oil_pressure_warning_bar == 1.9
        assert updated.device_local.display.default_dashboard_mode is DashboardMode.PIT_DASHBOARD
        assert updated.shared.units.distance_unit is DistanceUnit.MILES
        assert updated.web.alert_history_limit == 40
        assert updated.effective.shared.thresholds.oil_pressure_warning_bar == 1.7

        synced = await service.runtime_snapshot(
            SourceStatus(
                provider=ProviderName.SIMULATOR,
                transport="simulated",
                protocol="loopback",
                connection_state=ConnectionState.CONNECTED,
                connected=True,
                raw_capture_enabled=False,
            )
        )
        assert synced.sync.sync_state is SyncState.SYNCED
        assert synced.sync.shared_sync_state is SyncState.SYNCED
        assert synced.sync.device_local_sync_state is SyncState.SYNCED
        assert synced.effective.shared.thresholds.oil_pressure_warning_bar == 1.9
        assert synced.effective.device_local.display.default_dashboard_mode is DashboardMode.PIT_DASHBOARD

        await repository.close()

        reloaded_repository = SQLiteRepository(database_path)
        await reloaded_repository.initialize()
        try:
            reloaded_service = SettingsService(
                repository=reloaded_repository,
                defaults=defaults,
                device_runtime_service=DeviceRuntimeService(defaults),
            )
            reloaded = await reloaded_service.load()

            assert reloaded.shared.thresholds.oil_pressure_warning_bar == 1.9
            assert reloaded.shared.thresholds.oil_pressure_critical_bar == 1.3
            assert reloaded.shared.units.speed_unit is SpeedUnit.KPH
            assert reloaded.shared.units.temperature_unit is TemperatureUnit.CELSIUS
            assert reloaded.device_local.connections.bluetooth_enabled is True
            assert reloaded.web.diagnostics_panel_enabled is False
            assert reloaded.effective.shared.thresholds.oil_pressure_warning_bar == 1.9
            assert reloaded.effective.device_local.display.default_dashboard_mode is DashboardMode.PIT_DASHBOARD
        finally:
            await reloaded_repository.close()

    asyncio.run(scenario())


def test_settings_service_runtime_snapshot_tracks_pending_and_apply_state(tmp_path) -> None:
    async def scenario() -> None:
        database_path = tmp_path / "pitsight-settings-sync.db"
        defaults = Settings(_env_file=None, database_path=database_path)

        repository = SQLiteRepository(database_path)
        await repository.initialize()

        service = SettingsService(
            repository=repository,
            defaults=defaults,
            device_runtime_service=DeviceRuntimeService(defaults),
        )
        loaded = await service.load()
        await service.update_sync_test(
            SyncTestControls(
                device_online_override=False,
                auto_apply_shared=False,
                auto_apply_device_local=False,
            )
        )
        await service.update(
            loaded.model_copy(
                update={
                    "shared": loaded.shared.model_copy(
                        update={
                            "units": loaded.shared.units.model_copy(update={"speed_unit": SpeedUnit.MPH}),
                        }
                    ),
                    "device_local": loaded.device_local.model_copy(
                        update={
                            "display": loaded.device_local.display.model_copy(
                                update={"default_dashboard_mode": DashboardMode.DRIVER_LEMONS}
                            ),
                            "connections": loaded.device_local.connections.model_copy(
                                update={"wifi_mode": WifiMode.HOTSPOT}
                            ),
                        }
                    ),
                }
            )
        )

        offline_snapshot = await service.runtime_snapshot(
            SourceStatus(
                provider=ProviderName.SIMULATOR,
                transport="simulated",
                protocol="loopback",
                connection_state=ConnectionState.CONNECTED,
                connected=True,
                raw_capture_enabled=False,
            )
        )
        assert offline_snapshot.sync.device_online is False
        assert offline_snapshot.sync.sync_state is SyncState.PENDING_SYNC
        assert offline_snapshot.sync.pending_shared_changes is True
        assert offline_snapshot.sync.pending_device_local_changes is True
        assert offline_snapshot.sync.shared_sync_state is SyncState.PENDING_SYNC
        assert offline_snapshot.sync.device_local_sync_state is SyncState.PENDING_SYNC
        assert offline_snapshot.sync.display_mode_sync_state is SyncState.PENDING_SYNC
        assert offline_snapshot.sync.applied_dashboard_mode is DashboardMode.DRIVER_NORMAL
        assert offline_snapshot.effective.shared.units.speed_unit is SpeedUnit.KPH
        assert offline_snapshot.effective.device_local.display.default_dashboard_mode is DashboardMode.DRIVER_NORMAL

        await service.update_sync_test(
            SyncTestControls(
                device_online_override=True,
                auto_apply_shared=False,
                auto_apply_device_local=False,
            )
        )
        online_pending_snapshot = await service.runtime_snapshot(
            SourceStatus(
                provider=ProviderName.SIMULATOR,
                transport="simulated",
                protocol="loopback",
                connection_state=ConnectionState.CONNECTED,
                connected=True,
                raw_capture_enabled=False,
            )
        )
        assert online_pending_snapshot.sync.device_online is True
        assert online_pending_snapshot.sync.sync_state is SyncState.AWAITING_APPLY_CONFIRMATION
        assert online_pending_snapshot.sync.shared_sync_state is SyncState.AWAITING_APPLY_CONFIRMATION
        assert online_pending_snapshot.sync.device_local_sync_state is SyncState.AWAITING_APPLY_CONFIRMATION
        assert online_pending_snapshot.sync.display_mode_sync_state is SyncState.AWAITING_APPLY_CONFIRMATION
        assert online_pending_snapshot.sync.applied_dashboard_mode is DashboardMode.DRIVER_NORMAL

        applied_snapshot = await service.apply_requested_to_device(
            SourceStatus(
                provider=ProviderName.SIMULATOR,
                transport="simulated",
                protocol="loopback",
                connection_state=ConnectionState.CONNECTED,
                connected=True,
                raw_capture_enabled=False,
            )
        )
        assert applied_snapshot.sync.device_online is True
        assert applied_snapshot.sync.sync_state is SyncState.SYNCED
        assert applied_snapshot.sync.pending_shared_changes is False
        assert applied_snapshot.sync.pending_device_local_changes is False
        assert applied_snapshot.effective.shared.units.speed_unit is SpeedUnit.MPH
        assert applied_snapshot.effective.device_local.connections.wifi_mode.value == "hotspot"
        assert applied_snapshot.sync.applied_dashboard_mode is DashboardMode.DRIVER_LEMONS
        assert applied_snapshot.device_state.last_known_dashboard_mode is DashboardMode.DRIVER_LEMONS

        await repository.close()

    asyncio.run(scenario())
