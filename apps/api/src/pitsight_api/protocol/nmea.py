from __future__ import annotations

from datetime import datetime, timezone

from pitsight_api.core.models.telemetry import GPSFixState
from pitsight_api.protocol.base import DecodedMessage, TelemetryProtocol

KNOTS_TO_KPH = 1.852


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_float(value: object) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _map_quality_to_fix_state(quality: object) -> GPSFixState | None:
    try:
        quality_value = int(str(quality))
    except (TypeError, ValueError):
        return None

    if quality_value <= 0:
        return GPSFixState.NO_FIX
    if quality_value == 2:
        return GPSFixState.DGPS
    return GPSFixState.FIX_3D


def _map_fix_type_to_fix_state(fix_type: object) -> GPSFixState | None:
    try:
        fix_type_value = int(str(fix_type))
    except (TypeError, ValueError):
        return None

    if fix_type_value <= 1:
        return GPSFixState.NO_FIX
    if fix_type_value == 2:
        return GPSFixState.FIX_2D
    return GPSFixState.FIX_3D


class NMEA0183Protocol(TelemetryProtocol):
    def feed(self, raw_chunk: bytes) -> list[bytes]:
        return [
            line.strip()
            for line in raw_chunk.splitlines()
            if line.strip().startswith(b"$")
        ]

    def decode(self, raw_message: bytes) -> DecodedMessage:
        try:
            import pynmea2  # type: ignore[import-not-found]
        except ImportError as error:
            raise RuntimeError(
                "pynmea2 is not installed. Run with the gps extra to enable GPS decoding."
            ) from error

        sentence = raw_message.decode("ascii", errors="ignore").strip()
        if not sentence:
            raise ValueError("Empty GPS sentence.")

        # GPS adapters in the field can emit imperfect checksums during startup noise.
        # Accept syntactically valid sentences here and let runtime state handle degraded data.
        message = pynmea2.parse(sentence, check=False)
        fields: dict[str, object] = {
            "sentence_type": getattr(message, "sentence_type", None),
        }

        sentence_type = getattr(message, "sentence_type", "")
        if sentence_type == "GGA":
            fields["gps_latitude"] = getattr(message, "latitude", None)
            fields["gps_longitude"] = getattr(message, "longitude", None)
            fields["gps_fix_state"] = _map_quality_to_fix_state(getattr(message, "gps_qual", None))
        elif sentence_type == "GSA":
            fields["gps_fix_state"] = _map_fix_type_to_fix_state(
                getattr(message, "mode_fix_type", None)
            )
        elif sentence_type == "RMC":
            status = getattr(message, "status", None)
            fields["gps_fix_state"] = (
                GPSFixState.NO_FIX if status == "V" else GPSFixState.FIX_3D if status == "A" else None
            )
            fields["gps_latitude"] = getattr(message, "latitude", None)
            fields["gps_longitude"] = getattr(message, "longitude", None)
            speed_knots = _coerce_float(getattr(message, "spd_over_grnd", None))
            if speed_knots is not None:
                fields["gps_speed"] = speed_knots * KNOTS_TO_KPH
        elif sentence_type == "VTG":
            speed_kph = _coerce_float(getattr(message, "spd_over_grnd_kmph", None))
            if speed_kph is not None:
                fields["gps_speed"] = speed_kph
        elif sentence_type == "GLL":
            status = getattr(message, "status", None)
            fields["gps_fix_state"] = (
                GPSFixState.NO_FIX if status == "V" else GPSFixState.FIX_3D if status == "A" else None
            )
            fields["gps_latitude"] = getattr(message, "latitude", None)
            fields["gps_longitude"] = getattr(message, "longitude", None)

        return DecodedMessage(fields=fields, raw=raw_message, captured_at=_utcnow())
