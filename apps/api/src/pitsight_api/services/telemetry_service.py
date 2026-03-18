from __future__ import annotations

import asyncio
import logging
from collections.abc import Iterable

from fastapi import WebSocket

from pitsight_api.core.models.session import SessionRecord
from pitsight_api.core.models.telemetry import AlertEvent, TelemetrySnapshot
from pitsight_api.providers.base import ProviderMetadata, TelemetryProvider
from pitsight_api.services.session_service import SessionService
from pitsight_api.services.warning_engine import WarningEngine
from pitsight_api.storage.repository import SQLiteRepository

logger = logging.getLogger(__name__)


class TelemetryService:
    def __init__(
        self,
        provider: TelemetryProvider,
        repository: SQLiteRepository,
        warning_engine: WarningEngine,
        session_service: SessionService,
        alert_history_limit: int = 50,
    ) -> None:
        self.provider = provider
        self.repository = repository
        self.warning_engine = warning_engine
        self.session_service = session_service
        self.alert_history_limit = alert_history_limit
        self._task: asyncio.Task[None] | None = None
        self._latest_snapshot: TelemetrySnapshot | None = None
        self._websockets: set[WebSocket] = set()
        self._active_alert_codes: set[str] = set()
        self._first_snapshot_ready = asyncio.Event()

    @property
    def provider_metadata(self) -> ProviderMetadata:
        return self.provider.metadata

    async def start(self) -> None:
        await self.repository.initialize()
        session = self.session_service.start_session(self.provider.metadata.name)
        await self.repository.store_session(session)
        await self.provider.start(session.session_id)
        self._task = asyncio.create_task(self._run_stream(), name="pitsight-telemetry-stream")
        try:
            await asyncio.wait_for(
                self._first_snapshot_ready.wait(),
                timeout=max(2.0, self.provider.metadata.poll_interval_seconds * 4),
            )
        except asyncio.TimeoutError:
            logger.warning("Telemetry service did not receive an initial snapshot before startup timeout")

    async def stop(self) -> None:
        await self.provider.stop()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        session = self.session_service.end_session()
        if session is not None and session.ended_at is not None:
            await self.repository.close_session(session.session_id, session.ended_at.isoformat())
        await self.repository.close()

    async def _run_stream(self) -> None:
        try:
            async for snapshot in self.provider.stream():
                alerts = self.warning_engine.evaluate(snapshot)
                enriched = snapshot.with_alerts(alerts)
                self._latest_snapshot = enriched
                self._first_snapshot_ready.set()
                await self.repository.store_snapshot(enriched)
                await self._store_new_alerts(enriched.session_id, enriched.timestamp.isoformat(), alerts)
                await self._broadcast(enriched)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Telemetry stream stopped unexpectedly")
            raise

    async def _store_new_alerts(
        self,
        session_id: str,
        timestamp: str,
        alerts: Iterable[AlertEvent],
    ) -> None:
        active_alerts = [alert for alert in alerts if alert.active]
        active_codes = {alert.code for alert in active_alerts}
        new_alerts = [alert for alert in active_alerts if alert.code not in self._active_alert_codes]
        self._active_alert_codes = active_codes
        if new_alerts:
            await self.repository.store_alerts(session_id=session_id, timestamp=timestamp, alerts=new_alerts)

    async def _broadcast(self, snapshot: TelemetrySnapshot) -> None:
        payload = snapshot.model_dump(mode="json")
        stale_clients: list[WebSocket] = []
        for websocket in self._websockets:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale_clients.append(websocket)
        for websocket in stale_clients:
            self._websockets.discard(websocket)

    async def register_websocket(self, websocket: WebSocket) -> None:
        self._websockets.add(websocket)
        if self._latest_snapshot is not None:
            await websocket.send_json(self._latest_snapshot.model_dump(mode="json"))

    async def unregister_websocket(self, websocket: WebSocket) -> None:
        self._websockets.discard(websocket)

    async def latest_snapshot(self) -> TelemetrySnapshot | None:
        if self._latest_snapshot is not None:
            return self._latest_snapshot
        return await self.repository.fetch_latest_snapshot()

    async def recent_alerts(self, limit: int = 20) -> list[AlertEvent]:
        return await self.repository.fetch_recent_alerts(limit=min(limit, self.alert_history_limit))

    async def current_session(self) -> SessionRecord | None:
        session = self.session_service.current_session()
        if session is not None:
            return session
        return await self.repository.fetch_current_session()
