from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(slots=True)
class DecodedMessage:
    fields: dict[str, Any]
    raw: bytes
    captured_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class TelemetryProtocol(ABC):
    @abstractmethod
    def feed(self, raw_chunk: bytes) -> list[bytes]:
        """Split a transport chunk into protocol messages."""

    @abstractmethod
    def decode(self, raw_message: bytes) -> DecodedMessage:
        """Decode one protocol message into partial normalized fields."""

