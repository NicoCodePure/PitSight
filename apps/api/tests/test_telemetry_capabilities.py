from __future__ import annotations

from pitsight_api.core.models.telemetry import ConnectionState, GPSMetrics, ProviderName
from pitsight_api.services.telemetry_service import build_runtime_capabilities


def test_simulator_capabilities_are_full() -> None:
    capabilities = build_runtime_capabilities(
        ProviderName.SIMULATOR,
        GPSMetrics(),
        gps_runtime_enabled=False,
    )

    assert capabilities.lap_timing.level.value == "full"
    assert capabilities.track_position.level.value == "full"
    assert capabilities.session_clock.level.value == "full"


def test_real_source_without_gps_reports_unavailable_lap_logic_and_limited_clock() -> None:
    capabilities = build_runtime_capabilities(
        ProviderName.OBD2,
        GPSMetrics(),
        gps_runtime_enabled=False,
    )

    assert capabilities.lap_timing.level.value == "unavailable"
    assert capabilities.track_position.level.value == "unavailable"
    assert capabilities.session_clock.level.value == "limited"


def test_real_source_with_gps_reports_limited_track_context() -> None:
    capabilities = build_runtime_capabilities(
        ProviderName.DICTATOR,
        GPSMetrics(
            present=True,
            connection_state=ConnectionState.CONNECTED,
            detail="GPS locked.",
        ),
        gps_runtime_enabled=True,
    )

    assert capabilities.lap_timing.level.value == "unavailable"
    assert capabilities.track_position.level.value == "limited"
    assert capabilities.track_position.detail == "GPS locked."
    assert capabilities.session_clock.level.value == "limited"


def test_real_source_with_gps_runtime_but_no_context_stays_unavailable() -> None:
    capabilities = build_runtime_capabilities(
        ProviderName.OBD2,
        GPSMetrics(
            present=False,
            connection_state=ConnectionState.DISCONNECTED,
            detail="No GPS serial port configured or auto-detected.",
        ),
        gps_runtime_enabled=True,
    )

    assert capabilities.track_position.level.value == "unavailable"
    assert capabilities.track_position.detail == "No GPS serial port configured or auto-detected."
