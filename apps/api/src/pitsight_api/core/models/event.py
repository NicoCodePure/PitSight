from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from pitsight_api.core.models.telemetry import AlertSeverity


class EventCategory(str, Enum):
    ALERT = "alert"
    SOURCE = "source"
    CAMERA = "camera"
    GPS = "gps"
    DISPLAY = "display"
    SETTINGS = "settings"
    DEVICE = "device"


class EventAction(str, Enum):
    ENTERED = "entered"
    CLEARED = "cleared"
    CHANGED = "changed"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    LOST = "lost"
    ACQUIRED = "acquired"
    REQUESTED = "requested"
    APPLIED = "applied"


class SystemEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    session_id: str | None = None
    category: EventCategory
    code: str
    action: EventAction
    severity: AlertSeverity = AlertSeverity.INFO
    title: str
    detail: str
    metadata: dict[str, Any] | None = None
