from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from pitsight_api.core.models.session import SessionRecord
from pitsight_api.core.models.telemetry import ProviderName


class SessionService:
    def __init__(self) -> None:
        self._current_session: SessionRecord | None = None

    def start_session(self, provider: ProviderName) -> SessionRecord:
        started_at = datetime.now(timezone.utc)
        session_id = f"{provider.value}-{started_at.strftime('%Y%m%dT%H%M%S')}-{uuid4().hex[:8]}"
        self._current_session = SessionRecord(
            session_id=session_id,
            provider=provider,
            started_at=started_at,
        )
        return self._current_session

    def end_session(self) -> SessionRecord | None:
        if self._current_session is None:
            return None
        self._current_session = self._current_session.model_copy(
            update={"ended_at": datetime.now(timezone.utc)}
        )
        return self._current_session

    def current_session(self) -> SessionRecord | None:
        return self._current_session

