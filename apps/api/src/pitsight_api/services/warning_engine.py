from __future__ import annotations

from pitsight_api.core.models.app_settings import AlertThresholdSettings
from pitsight_api.core.models.telemetry import AlertEvent, AlertSeverity, TelemetrySnapshot
from pitsight_api.services.settings_service import SettingsService


class WarningEngine:
    def __init__(self, settings_service: SettingsService) -> None:
        self.settings_service = settings_service

    @property
    def thresholds(self) -> AlertThresholdSettings:
        return self.settings_service.current().shared.thresholds

    def evaluate(self, snapshot: TelemetrySnapshot) -> list[AlertEvent]:
        alerts: list[AlertEvent] = list(snapshot.alerts)
        engine = snapshot.engine

        if engine.oil_pressure_bar is not None:
            if engine.oil_pressure_bar <= self.thresholds.oil_pressure_critical_bar:
                alerts.append(
                    AlertEvent(
                        timestamp=snapshot.timestamp,
                        code="low_oil_pressure_critical",
                        severity=AlertSeverity.CRITICAL,
                        message="Critical oil pressure",
                        value=engine.oil_pressure_bar,
                        threshold=self.thresholds.oil_pressure_critical_bar,
                    )
                )
            elif engine.oil_pressure_bar <= self.thresholds.oil_pressure_warning_bar:
                alerts.append(
                    AlertEvent(
                        timestamp=snapshot.timestamp,
                        code="low_oil_pressure_warning",
                        severity=AlertSeverity.WARNING,
                        message="Low oil pressure",
                        value=engine.oil_pressure_bar,
                        threshold=self.thresholds.oil_pressure_warning_bar,
                    )
                )

        if engine.water_temp_c is not None:
            if engine.water_temp_c >= self.thresholds.water_temp_critical_c:
                alerts.append(
                    AlertEvent(
                        timestamp=snapshot.timestamp,
                        code="high_water_temp_critical",
                        severity=AlertSeverity.CRITICAL,
                        message="Critical water temperature",
                        value=engine.water_temp_c,
                        threshold=self.thresholds.water_temp_critical_c,
                    )
                )
            elif engine.water_temp_c >= self.thresholds.water_temp_warning_c:
                alerts.append(
                    AlertEvent(
                        timestamp=snapshot.timestamp,
                        code="high_water_temp_warning",
                        severity=AlertSeverity.WARNING,
                        message="High water temperature",
                        value=engine.water_temp_c,
                        threshold=self.thresholds.water_temp_warning_c,
                    )
                )

        if engine.oil_temp_c is not None:
            if engine.oil_temp_c >= self.thresholds.oil_temp_critical_c:
                alerts.append(
                    AlertEvent(
                        timestamp=snapshot.timestamp,
                        code="high_oil_temp_critical",
                        severity=AlertSeverity.CRITICAL,
                        message="Critical oil temperature",
                        value=engine.oil_temp_c,
                        threshold=self.thresholds.oil_temp_critical_c,
                    )
                )
            elif engine.oil_temp_c >= self.thresholds.oil_temp_warning_c:
                alerts.append(
                    AlertEvent(
                        timestamp=snapshot.timestamp,
                        code="high_oil_temp_warning",
                        severity=AlertSeverity.WARNING,
                        message="High oil temperature",
                        value=engine.oil_temp_c,
                        threshold=self.thresholds.oil_temp_warning_c,
                    )
                )

        fuel_level = snapshot.fuel.level_percent
        if fuel_level is not None and fuel_level <= self.thresholds.fuel_level_warning_percent:
            alerts.append(
                AlertEvent(
                    timestamp=snapshot.timestamp,
                    code="low_fuel_warning",
                    severity=AlertSeverity.WARNING,
                    message="Low fuel",
                    value=fuel_level,
                    threshold=self.thresholds.fuel_level_warning_percent,
                )
            )

        return alerts
