from __future__ import annotations

from typing import Any

from pitsight_api.core.models.app_settings import AppSettingsSnapshot, DashboardMode, DeviceStateSnapshot
from pitsight_api.core.models.event import EventAction, EventCategory, SystemEvent
from pitsight_api.core.models.telemetry import (
    AlertEvent,
    AlertSeverity,
    CameraState,
    ConnectionState,
    GPSFixState,
    TelemetrySnapshot,
)
from pitsight_api.storage.repository import SQLiteRepository


FIXED_GPS_STATES = {GPSFixState.FIX_2D, GPSFixState.FIX_3D, GPSFixState.DGPS}


def _enum_value(value: Any) -> Any:
    return getattr(value, "value", value)


def _title_case(value: str) -> str:
    return value.replace("_", " ").strip().title()


def _humanize_alert_title(alert: AlertEvent) -> str:
    if alert.code.endswith("_critical"):
        base = alert.code.removesuffix("_critical")
        return f"{_title_case(base)} Critical"
    if alert.code.endswith("_warning"):
        base = alert.code.removesuffix("_warning")
        return f"{_title_case(base)} Warning"
    return _title_case(alert.code)


def _alert_detail(alert: AlertEvent, action: EventAction) -> str:
    if action is EventAction.CLEARED:
        return f"{alert.message} condition cleared."
    if alert.value is not None and alert.threshold is not None:
        return f"{alert.message}. Value {alert.value:.1f}, threshold {alert.threshold:.1f}."
    return alert.message


def _compare_model_dicts(before: Any, after: Any) -> list[dict[str, Any]]:
    before_dict = before.model_dump(mode="python")
    after_dict = after.model_dump(mode="python")
    changes: list[dict[str, Any]] = []
    for key in sorted(set(before_dict) | set(after_dict)):
        if before_dict.get(key) != after_dict.get(key):
            changes.append(
                {
                    "field": key,
                    "before": _enum_value(before_dict.get(key)),
                    "after": _enum_value(after_dict.get(key)),
                }
            )
    return changes


class EventService:
    def __init__(self, repository: SQLiteRepository, recent_limit: int = 100) -> None:
        self.repository = repository
        self.recent_limit = recent_limit

    async def record_events(self, events: list[SystemEvent]) -> None:
        await self.repository.store_system_events(events)

    async def recent_events(self, limit: int = 20) -> list[SystemEvent]:
        return await self.repository.fetch_recent_system_events(limit=min(limit, self.recent_limit))

    def build_snapshot_events(
        self,
        previous_snapshot: TelemetrySnapshot | None,
        current_snapshot: TelemetrySnapshot,
    ) -> list[SystemEvent]:
        events: list[SystemEvent] = []
        previous_active_alerts = {
            alert.code: alert for alert in (previous_snapshot.alerts if previous_snapshot is not None else []) if alert.active
        }
        current_active_alerts = {alert.code: alert for alert in current_snapshot.alerts if alert.active}

        entered_codes = sorted(set(current_active_alerts) - set(previous_active_alerts))
        cleared_codes = sorted(set(previous_active_alerts) - set(current_active_alerts))

        for code in entered_codes:
            alert = current_active_alerts[code]
            events.append(
                SystemEvent(
                    timestamp=alert.timestamp or current_snapshot.timestamp,
                    session_id=current_snapshot.session_id,
                    category=EventCategory.ALERT,
                    code=f"alert.{code}.entered",
                    action=EventAction.ENTERED,
                    severity=alert.severity,
                    title=f"{_humanize_alert_title(alert)} Entered",
                    detail=_alert_detail(alert, EventAction.ENTERED),
                    metadata={"alert_code": code, "value": alert.value, "threshold": alert.threshold},
                )
            )

        for code in cleared_codes:
            alert = previous_active_alerts[code]
            events.append(
                SystemEvent(
                    timestamp=current_snapshot.timestamp,
                    session_id=current_snapshot.session_id,
                    category=EventCategory.ALERT,
                    code=f"alert.{code}.cleared",
                    action=EventAction.CLEARED,
                    severity=AlertSeverity.INFO,
                    title=f"{_humanize_alert_title(alert)} Cleared",
                    detail=_alert_detail(alert, EventAction.CLEARED),
                    metadata={"alert_code": code, "last_value": alert.value, "threshold": alert.threshold},
                )
            )

        if previous_snapshot is None:
            return events

        if previous_snapshot.source.provider != current_snapshot.source.provider:
            events.append(
                SystemEvent(
                    timestamp=current_snapshot.timestamp,
                    session_id=current_snapshot.session_id,
                    category=EventCategory.SOURCE,
                    code="source.provider_switched",
                    action=EventAction.CHANGED,
                    severity=AlertSeverity.INFO,
                    title="Telemetry Source Switched",
                    detail=(
                        f"Source changed from {previous_snapshot.source.provider.value.upper()} "
                        f"to {current_snapshot.source.provider.value.upper()}."
                    ),
                    metadata={
                        "before": previous_snapshot.source.provider.value,
                        "after": current_snapshot.source.provider.value,
                    },
                )
            )

        if previous_snapshot.source.connection_state != current_snapshot.source.connection_state:
            events.append(
                self._source_transition_event(previous_snapshot, current_snapshot)
            )

        previous_camera_state = previous_snapshot.camera.state
        current_camera_state = current_snapshot.camera.state
        if previous_camera_state != current_camera_state and current_camera_state is not None:
            events.append(
                SystemEvent(
                    timestamp=current_snapshot.timestamp,
                    session_id=current_snapshot.session_id,
                    category=EventCategory.CAMERA,
                    code=f"camera.state.{current_camera_state.value}",
                    action=EventAction.CHANGED,
                    severity=self._camera_severity(current_camera_state),
                    title=f"Camera {_title_case(current_camera_state.value)}",
                    detail=current_snapshot.camera.detail or "Camera state changed.",
                    metadata={
                        "before": _enum_value(previous_camera_state),
                        "after": current_camera_state.value,
                    },
                )
            )

        previous_fix = previous_snapshot.gps.fix_state
        current_fix = current_snapshot.gps.fix_state
        if previous_fix != current_fix:
            gps_event = self._gps_transition_event(
                session_id=current_snapshot.session_id,
                timestamp=current_snapshot.timestamp,
                previous_fix=previous_fix,
                current_fix=current_fix,
                detail=current_snapshot.gps.detail,
            )
            if gps_event is not None:
                events.append(gps_event)

        return events

    def build_settings_update_events(
        self,
        previous_settings: AppSettingsSnapshot,
        next_update: AppSettingsSnapshot,
    ) -> list[SystemEvent]:
        events: list[SystemEvent] = []
        timestamp = next_update.updated_at

        threshold_changes = _compare_model_dicts(
            previous_settings.shared.thresholds,
            next_update.shared.thresholds,
        )
        if threshold_changes:
            events.append(
                SystemEvent(
                    timestamp=timestamp,
                    category=EventCategory.SETTINGS,
                    code="settings.thresholds.updated",
                    action=EventAction.CHANGED,
                    severity=AlertSeverity.INFO,
                    title="Warning Thresholds Updated",
                    detail=f"{len(threshold_changes)} threshold values changed.",
                    metadata={"changes": threshold_changes},
                )
            )

        unit_changes = _compare_model_dicts(previous_settings.shared.units, next_update.shared.units)
        if unit_changes:
            events.append(
                SystemEvent(
                    timestamp=timestamp,
                    category=EventCategory.SETTINGS,
                    code="settings.units.updated",
                    action=EventAction.CHANGED,
                    severity=AlertSeverity.INFO,
                    title="Display Units Updated",
                    detail="Shared display units were updated.",
                    metadata={"changes": unit_changes},
                )
            )

        previous_mode = previous_settings.device_local.display.default_dashboard_mode
        next_mode = next_update.device_local.display.default_dashboard_mode
        if previous_mode != next_mode:
            events.append(
                SystemEvent(
                    timestamp=timestamp,
                    category=EventCategory.DISPLAY,
                    code="display.default_mode.requested",
                    action=EventAction.REQUESTED,
                    severity=AlertSeverity.INFO,
                    title="Default Display Mode Changed",
                    detail=f"Requested default mode changed from {_title_case(previous_mode.value)} to {_title_case(next_mode.value)}.",
                    metadata={"before": previous_mode.value, "after": next_mode.value},
                )
            )

        return events

    def build_settings_applied_events(
        self,
        previous_settings: AppSettingsSnapshot,
        next_settings: AppSettingsSnapshot,
    ) -> list[SystemEvent]:
        events: list[SystemEvent] = []
        timestamp = next_settings.updated_at

        if previous_settings.effective.shared.thresholds != next_settings.effective.shared.thresholds:
            events.append(
                SystemEvent(
                    timestamp=timestamp,
                    category=EventCategory.SETTINGS,
                    code="settings.thresholds.applied",
                    action=EventAction.APPLIED,
                    severity=AlertSeverity.INFO,
                    title="Threshold Changes Applied",
                    detail="Updated warning thresholds were applied to the active device state.",
                )
            )

        previous_mode = previous_settings.effective.device_local.display.default_dashboard_mode
        next_mode = next_settings.effective.device_local.display.default_dashboard_mode
        if previous_mode != next_mode:
            events.append(
                SystemEvent(
                    timestamp=timestamp,
                    category=EventCategory.DISPLAY,
                    code="display.default_mode.applied",
                    action=EventAction.APPLIED,
                    severity=AlertSeverity.INFO,
                    title="Display Mode Applied",
                    detail=f"Applied default mode changed from {_title_case(previous_mode.value)} to {_title_case(next_mode.value)}.",
                    metadata={"before": previous_mode.value, "after": next_mode.value},
                )
            )

        return events

    def build_device_state_events(
        self,
        previous_state: DeviceStateSnapshot,
        next_state: DeviceStateSnapshot,
    ) -> list[SystemEvent]:
        events: list[SystemEvent] = []
        timestamp = next_state.last_seen_at or next_state.last_sync_at
        if timestamp is None:
            return events

        if previous_state.online != next_state.online:
            events.append(
                SystemEvent(
                    timestamp=timestamp,
                    category=EventCategory.DEVICE,
                    code="device.online_state.changed",
                    action=EventAction.CONNECTED if next_state.online else EventAction.DISCONNECTED,
                    severity=AlertSeverity.INFO if next_state.online else AlertSeverity.WARNING,
                    title="Device Connected" if next_state.online else "Device Disconnected",
                    detail=(
                        f"{next_state.device_label} is now online."
                        if next_state.online
                        else f"{next_state.device_label} stopped reporting."
                    ),
                    metadata={"device_id": next_state.device_id, "online": next_state.online},
                )
            )

        if previous_state.current_dashboard_mode != next_state.current_dashboard_mode:
            events.append(
                SystemEvent(
                    timestamp=timestamp,
                    category=EventCategory.DISPLAY,
                    code="display.active_mode.changed",
                    action=EventAction.CHANGED,
                    severity=AlertSeverity.INFO,
                    title="Active Display Mode Changed",
                    detail=(
                        f"Active screen changed from {_title_case(previous_state.current_dashboard_mode.value)} "
                        f"to {_title_case(next_state.current_dashboard_mode.value)}."
                    ),
                    metadata={
                        "before": previous_state.current_dashboard_mode.value,
                        "after": next_state.current_dashboard_mode.value,
                        "source": next_state.current_dashboard_mode_source.value,
                    },
                )
            )

        return events

    def _source_transition_event(
        self,
        previous_snapshot: TelemetrySnapshot,
        current_snapshot: TelemetrySnapshot,
    ) -> SystemEvent:
        previous_state = previous_snapshot.source.connection_state
        current_state = current_snapshot.source.connection_state
        severity = AlertSeverity.INFO
        action = EventAction.CHANGED
        title = "Telemetry Source State Changed"
        detail = (
            f"{current_snapshot.source.provider.value.upper()} source changed from "
            f"{previous_state.value} to {current_state.value}."
        )
        code = "source.connection_state.changed"

        if current_state in {ConnectionState.DISCONNECTED, ConnectionState.FAULT}:
            severity = AlertSeverity.CRITICAL
            action = EventAction.LOST
            title = "Telemetry Signal Lost"
            code = "source.connection_state.lost"
        elif previous_state in {ConnectionState.DISCONNECTED, ConnectionState.FAULT} and current_state in {
            ConnectionState.CONNECTED,
            ConnectionState.DEGRADED,
            ConnectionState.CONNECTING,
        }:
            severity = AlertSeverity.INFO
            action = EventAction.CONNECTED
            title = "Telemetry Signal Restored"
            code = "source.connection_state.restored"
        elif current_state in {ConnectionState.DEGRADED, ConnectionState.CONNECTING}:
            severity = AlertSeverity.WARNING

        return SystemEvent(
            timestamp=current_snapshot.timestamp,
            session_id=current_snapshot.session_id,
            category=EventCategory.SOURCE,
            code=code,
            action=action,
            severity=severity,
            title=title,
            detail=detail,
            metadata={"before": previous_state.value, "after": current_state.value},
        )

    def _gps_transition_event(
        self,
        *,
        session_id: str,
        timestamp,
        previous_fix: GPSFixState | None,
        current_fix: GPSFixState | None,
        detail: str | None,
    ) -> SystemEvent | None:
        previous_fixed = previous_fix in FIXED_GPS_STATES
        current_fixed = current_fix in FIXED_GPS_STATES

        if previous_fixed and not current_fixed:
            return SystemEvent(
                timestamp=timestamp,
                session_id=session_id,
                category=EventCategory.GPS,
                code="gps.fix.lost",
                action=EventAction.LOST,
                severity=AlertSeverity.WARNING,
                title="GPS Fix Lost",
                detail=detail or "GPS fix is no longer available.",
                metadata={"before": _enum_value(previous_fix), "after": _enum_value(current_fix)},
            )

        if not previous_fixed and current_fixed:
            return SystemEvent(
                timestamp=timestamp,
                session_id=session_id,
                category=EventCategory.GPS,
                code="gps.fix.acquired",
                action=EventAction.ACQUIRED,
                severity=AlertSeverity.INFO,
                title="GPS Fix Acquired",
                detail=detail or "GPS fix is now available.",
                metadata={"before": _enum_value(previous_fix), "after": _enum_value(current_fix)},
            )

        if previous_fix != current_fix and current_fix is not None:
            return SystemEvent(
                timestamp=timestamp,
                session_id=session_id,
                category=EventCategory.GPS,
                code="gps.fix.changed",
                action=EventAction.CHANGED,
                severity=AlertSeverity.INFO,
                title="GPS Fix State Changed",
                detail=detail or f"GPS fix changed to {_title_case(current_fix.value)}.",
                metadata={"before": _enum_value(previous_fix), "after": current_fix.value},
            )

        return None

    def _camera_severity(self, camera_state: CameraState) -> AlertSeverity:
        if camera_state in {CameraState.OFFLINE, CameraState.FAULT}:
            return AlertSeverity.CRITICAL
        if camera_state in {CameraState.NO_SIGNAL, CameraState.UNAVAILABLE}:
            return AlertSeverity.WARNING
        return AlertSeverity.INFO
