from __future__ import annotations

import asyncio
import json
from pathlib import Path

from pitsight_api.core.canonical_telemetry import (
    CANONICAL_METRIC_DEFINITIONS,
    build_snapshot_from_canonical,
)
from pitsight_api.core.models.telemetry import (
    CameraState,
    ConnectionState,
    GPSFixState,
    ProviderName,
    SourceStatus,
)
from pitsight_api.providers.simulator import SimulatorTelemetryProvider


def test_canonical_dictionary_contract_matches_backend_registry() -> None:
    contract_path = (
        Path(__file__).resolve().parents[3] / "shared" / "contracts" / "telemetry.dictionary.json"
    )
    contract = json.loads(contract_path.read_text(encoding="utf-8"))

    assert contract["schema_version"] == "0.2.0"
    assert set(contract["metrics"]) == set(CANONICAL_METRIC_DEFINITIONS)

    for key, definition in CANONICAL_METRIC_DEFINITIONS.items():
        entry = contract["metrics"][key]
        assert entry["key"] == definition.key
        assert entry["snapshot_path"] == definition.snapshot_path
        assert entry["category"] == definition.category
        assert entry["display_label"] == definition.display_label
        assert entry["canonical_unit"] == definition.canonical_unit
        assert entry["supported_display_units"] == list(definition.supported_display_units)
        assert entry["warning_profile"] == definition.warning_profile
        assert entry["availability"] == ("core" if definition.core else "optional")
        assert entry["no_data_state"] == definition.no_data_state
        assert entry["no_data_meaning"] == definition.no_data_meaning


def test_build_snapshot_from_canonical_maps_flat_metrics_into_grouped_snapshot() -> None:
    snapshot = build_snapshot_from_canonical(
        session_id="session-001",
        sequence=42,
        source_status=SourceStatus(
            provider=ProviderName.SIMULATOR,
            transport="internal",
            protocol="simulated",
            connection_state=ConnectionState.CONNECTING,
            connected=False,
            raw_capture_enabled=False,
        ),
        metrics={
            "source_state": "degraded",
            "rpm": 5412,
            "speed": 118.4,
            "gear": 4,
            "coolant_temp": 97.8,
            "oil_temp": 109.2,
            "oil_pressure": 3.4,
            "battery_voltage": 13.8,
            "fuel_level": 48.5,
            "fuel_pressure": 3.1,
            "lambda": 1.02,
            "afr": 15.0,
            "intake_temp": 33.4,
            "throttle_position": 57.1,
            "lap_time": 81234,
            "best_lap": 79991,
            "delta": -350,
            "lap_count": 5,
            "session_elapsed": 180000,
            "gps_latitude": -26.0246,
            "gps_longitude": 28.0713,
            "gps_speed": 119.8,
            "gps_fix_state": "3d",
            "camera_state": "unavailable",
        },
    )

    assert snapshot.schema_version == "0.2.0"
    assert snapshot.source.connection_state is ConnectionState.DEGRADED
    assert snapshot.source.connected is True
    assert snapshot.engine.rpm == 5412
    assert snapshot.engine.speed_kph == 118.4
    assert snapshot.engine.gear == 4
    assert snapshot.engine.water_temp_c == 97.8
    assert snapshot.engine.battery_voltage_v == 13.8
    assert snapshot.engine.lambda_value == 1.02
    assert snapshot.fuel.level_percent == 48.5
    assert snapshot.fuel.pressure_bar == 3.1
    assert snapshot.lap.delta_ms == -350
    assert snapshot.gps.fix_state is GPSFixState.FIX_3D
    assert snapshot.camera.state is CameraState.UNAVAILABLE


def test_build_snapshot_from_canonical_rejects_unknown_metric_keys() -> None:
    source = SourceStatus(
        provider=ProviderName.SIMULATOR,
        transport="internal",
        protocol="simulated",
        connection_state=ConnectionState.CONNECTED,
        connected=True,
        raw_capture_enabled=False,
    )

    try:
        build_snapshot_from_canonical(
            session_id="session-001",
            sequence=1,
            source_status=source,
            metrics={"unknown_metric": 1},
        )
    except KeyError as error:
        assert "unknown_metric" in str(error)
    else:
        raise AssertionError("Unknown canonical metrics must raise KeyError.")


def test_simulator_provider_emits_canonicalized_optional_metrics() -> None:
    async def scenario() -> None:
        provider = SimulatorTelemetryProvider(interval_seconds=0.01)
        await provider.start("sim-session")
        stream = provider.stream()
        try:
            snapshot = await anext(stream)
            assert snapshot.schema_version == "0.2.0"
            assert snapshot.engine.gear is not None
            assert snapshot.engine.battery_voltage_v is not None
            assert snapshot.engine.lambda_value is not None
            assert snapshot.fuel.pressure_bar is not None
            assert snapshot.gps.fix_state is GPSFixState.FIX_3D
            assert snapshot.camera.state is CameraState.UNAVAILABLE
        finally:
            await provider.stop()
            await stream.aclose()

    asyncio.run(scenario())
