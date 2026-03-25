from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from pitsight_api.core.models.app_settings import AlertThresholdSettings
from pitsight_api.core.models.telemetry import ConnectionState, ProviderName, SourceStatus, TelemetrySnapshot
from pitsight_api.services.warning_engine import WarningEngine


def build_warning_engine(thresholds: AlertThresholdSettings | None = None) -> WarningEngine:
    current_thresholds = thresholds or AlertThresholdSettings(
        oil_pressure_advisory_bar=1.9,
        oil_pressure_warning_bar=1.5,
        oil_pressure_critical_bar=1.0,
        water_temp_advisory_c=100.0,
        water_temp_warning_c=105.0,
        water_temp_critical_c=112.0,
        oil_temp_advisory_c=115.0,
        oil_temp_warning_c=120.0,
        oil_temp_critical_c=130.0,
        battery_voltage_advisory_v=12.2,
        battery_voltage_warning_v=11.8,
        battery_voltage_critical_v=11.2,
        fuel_pressure_advisory_bar=3.0,
        fuel_pressure_warning_bar=2.6,
        fuel_pressure_critical_bar=2.2,
        lambda_advisory_delta=0.03,
        lambda_warning_delta=0.06,
        lambda_critical_delta=0.1,
        fuel_level_warning_percent=15.0,
    )
    settings_service = SimpleNamespace(
        current=lambda: SimpleNamespace(
            effective=SimpleNamespace(shared=SimpleNamespace(thresholds=current_thresholds))
        )
    )
    return WarningEngine(settings_service=settings_service)


def build_snapshot(
    *,
    oil_pressure_bar: float | None = 3.2,
    water_temp_c: float | None = 98.0,
    oil_temp_c: float | None = 109.0,
    fuel_level_percent: float | None = 48.0,
    battery_voltage_v: float | None = 13.8,
    fuel_pressure_bar: float | None = 3.4,
    lambda_value: float | None = 1.0,
) -> TelemetrySnapshot:
    return TelemetrySnapshot(
        session_id="session-warning-engine",
        sequence=1,
        timestamp=datetime(2026, 3, 25, 12, 0, tzinfo=timezone.utc),
        source=SourceStatus(
            provider=ProviderName.SIMULATOR,
            transport="internal",
            protocol="simulated",
            connection_state=ConnectionState.CONNECTED,
            connected=True,
        ),
        engine={
            "oil_pressure_bar": oil_pressure_bar,
            "water_temp_c": water_temp_c,
            "oil_temp_c": oil_temp_c,
            "battery_voltage_v": battery_voltage_v,
            "lambda_value": lambda_value,
        },
        fuel={
            "level_percent": fuel_level_percent,
            "pressure_bar": fuel_pressure_bar,
        },
    )


@pytest.mark.parametrize(
    ("snapshot_overrides", "expected_code"),
    [
        ({"oil_pressure_bar": 1.5}, "low_oil_pressure_warning"),
        ({"water_temp_c": 105.0}, "high_water_temp_warning"),
        ({"oil_temp_c": 120.0}, "high_oil_temp_warning"),
        ({"fuel_level_percent": 15.0}, "low_fuel_warning"),
    ],
)
def test_warning_engine_emits_warning_alerts_at_exact_thresholds(snapshot_overrides, expected_code) -> None:
    engine = build_warning_engine()
    snapshot = build_snapshot(**snapshot_overrides)

    alerts = engine.evaluate(snapshot)

    assert [alert.code for alert in alerts] == [expected_code]


@pytest.mark.parametrize(
    ("snapshot_overrides", "expected_code"),
    [
        ({"oil_pressure_bar": 1.0}, "low_oil_pressure_critical"),
        ({"water_temp_c": 112.0}, "high_water_temp_critical"),
        ({"oil_temp_c": 130.0}, "high_oil_temp_critical"),
    ],
)
def test_warning_engine_emits_critical_alerts_at_exact_thresholds(snapshot_overrides, expected_code) -> None:
    engine = build_warning_engine()
    snapshot = build_snapshot(**snapshot_overrides)

    alerts = engine.evaluate(snapshot)

    assert [alert.code for alert in alerts] == [expected_code]


def test_warning_engine_does_not_emit_alerts_for_display_only_or_advisory_thresholds() -> None:
    engine = build_warning_engine()
    snapshot = build_snapshot(
        oil_pressure_bar=1.8,
        water_temp_c=101.0,
        oil_temp_c=117.0,
        fuel_level_percent=20.0,
        battery_voltage_v=10.5,
        fuel_pressure_bar=1.8,
        lambda_value=1.2,
    )

    alerts = engine.evaluate(snapshot)

    assert alerts == []


def test_warning_engine_prefers_critical_over_warning_for_the_same_metric() -> None:
    engine = build_warning_engine()
    snapshot = build_snapshot(oil_pressure_bar=0.9)

    alerts = engine.evaluate(snapshot)

    assert [alert.code for alert in alerts] == ["low_oil_pressure_critical"]
