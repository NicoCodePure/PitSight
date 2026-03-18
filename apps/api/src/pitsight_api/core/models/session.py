from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field

from pitsight_api.core.models.telemetry import ProviderName


class SessionRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    provider: ProviderName
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None

