from __future__ import annotations

from pitsight_api.protocol.base import DecodedMessage, TelemetryProtocol


class Elm327Protocol(TelemetryProtocol):
    def feed(self, raw_chunk: bytes) -> list[bytes]:
        return [raw_chunk]

    def decode(self, raw_message: bytes) -> DecodedMessage:
        raise NotImplementedError("ELM327 PID decoding is scaffolded but not implemented yet.")

