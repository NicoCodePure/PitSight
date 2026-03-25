from __future__ import annotations

from pathlib import Path

import aiosqlite

from pitsight_api.core.models.event import SystemEvent
from pitsight_api.core.models.app_settings import AppSettingsSnapshot
from pitsight_api.core.models.session import SessionRecord
from pitsight_api.core.models.telemetry import AlertEvent, TelemetrySnapshot


class SQLiteRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self._connection: aiosqlite.Connection | None = None

    async def initialize(self) -> None:
        if self._connection is not None:
            return
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = await aiosqlite.connect(str(self.database_path))
        self._connection.row_factory = aiosqlite.Row
        await self._connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT
            );

            CREATE TABLE IF NOT EXISTS telemetry_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                health_state TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_telemetry_events_session_sequence
            ON telemetry_events (session_id, sequence);

            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                code TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                active INTEGER NOT NULL,
                value REAL,
                threshold REAL
            );

            CREATE INDEX IF NOT EXISTS idx_alerts_timestamp
            ON alerts (timestamp DESC);

            CREATE TABLE IF NOT EXISTS system_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                timestamp TEXT NOT NULL,
                category TEXT NOT NULL,
                code TEXT NOT NULL,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                detail TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_system_events_timestamp
            ON system_events (timestamp DESC);

            CREATE TABLE IF NOT EXISTS app_settings (
                singleton_key INTEGER PRIMARY KEY CHECK (singleton_key = 1),
                updated_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            """
        )
        await self._connection.commit()

    async def close(self) -> None:
        if self._connection is not None:
            await self._connection.close()
            self._connection = None

    async def store_session(self, session: SessionRecord) -> None:
        connection = self._require_connection()
        await connection.execute(
            """
            INSERT INTO sessions (session_id, provider, started_at, ended_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                session.session_id,
                session.provider.value,
                session.started_at.isoformat(),
                session.ended_at.isoformat() if session.ended_at else None,
            ),
        )
        await connection.commit()

    async def store_system_events(self, events: list[SystemEvent]) -> None:
        if not events:
            return
        connection = self._require_connection()
        await connection.executemany(
            """
            INSERT INTO system_events (
                session_id, timestamp, category, code, severity, title, detail, payload_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    event.session_id,
                    event.timestamp.isoformat(),
                    event.category.value,
                    event.code,
                    event.severity.value,
                    event.title,
                    event.detail,
                    event.model_dump_json(),
                )
                for event in events
            ],
        )
        await connection.commit()

    async def close_session(self, session_id: str, ended_at: str) -> None:
        connection = self._require_connection()
        await connection.execute(
            "UPDATE sessions SET ended_at = ? WHERE session_id = ?",
            (ended_at, session_id),
        )
        await connection.commit()

    async def store_snapshot(self, snapshot: TelemetrySnapshot) -> None:
        connection = self._require_connection()
        await connection.execute(
            """
            INSERT INTO telemetry_events (session_id, sequence, timestamp, health_state, payload_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                snapshot.session_id,
                snapshot.sequence,
                snapshot.timestamp.isoformat(),
                snapshot.health_state.value,
                snapshot.model_dump_json(),
            ),
        )
        await connection.commit()

    async def store_alerts(self, session_id: str, timestamp: str, alerts: list[AlertEvent]) -> None:
        if not alerts:
            return
        connection = self._require_connection()
        await connection.executemany(
            """
            INSERT INTO alerts (session_id, timestamp, code, severity, message, active, value, threshold)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    session_id,
                    alert.timestamp.isoformat() if alert.timestamp is not None else timestamp,
                    alert.code,
                    alert.severity.value,
                    alert.message,
                    1 if alert.active else 0,
                    alert.value,
                    alert.threshold,
                )
                for alert in alerts
            ],
        )
        await connection.commit()

    async def fetch_current_session(self) -> SessionRecord | None:
        connection = self._require_connection()
        cursor = await connection.execute(
            """
            SELECT session_id, provider, started_at, ended_at
            FROM sessions
            ORDER BY started_at DESC
            LIMIT 1
            """
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return SessionRecord.model_validate(dict(row))

    async def fetch_latest_snapshot(self) -> TelemetrySnapshot | None:
        connection = self._require_connection()
        cursor = await connection.execute(
            """
            SELECT payload_json
            FROM telemetry_events
            ORDER BY timestamp DESC
            LIMIT 1
            """
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return TelemetrySnapshot.model_validate_json(row["payload_json"])

    async def fetch_recent_alerts(self, limit: int = 20) -> list[AlertEvent]:
        connection = self._require_connection()
        cursor = await connection.execute(
            """
            SELECT timestamp, code, severity, message, active, value, threshold
            FROM alerts
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
        return [AlertEvent.model_validate(dict(row)) for row in rows]

    async def fetch_recent_system_events(self, limit: int = 20) -> list[SystemEvent]:
        connection = self._require_connection()
        cursor = await connection.execute(
            """
            SELECT payload_json
            FROM system_events
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
        return [SystemEvent.model_validate_json(row["payload_json"]) for row in rows]

    async def fetch_app_settings(self) -> AppSettingsSnapshot | None:
        connection = self._require_connection()
        cursor = await connection.execute(
            """
            SELECT payload_json
            FROM app_settings
            WHERE singleton_key = 1
            """
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return AppSettingsSnapshot.model_validate_json(row["payload_json"])

    async def store_app_settings(self, app_settings: AppSettingsSnapshot) -> None:
        connection = self._require_connection()
        await connection.execute(
            """
            INSERT INTO app_settings (singleton_key, updated_at, payload_json)
            VALUES (1, ?, ?)
            ON CONFLICT(singleton_key)
            DO UPDATE SET
                updated_at = excluded.updated_at,
                payload_json = excluded.payload_json
            """,
            (
                app_settings.updated_at.isoformat(),
                app_settings.model_dump_json(),
            ),
        )
        await connection.commit()

    def _require_connection(self) -> aiosqlite.Connection:
        if self._connection is None:
            raise RuntimeError("SQLite repository has not been initialized.")
        return self._connection
