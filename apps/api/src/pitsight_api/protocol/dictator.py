from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from pitsight_api.protocol.base import DecodedMessage, TelemetryProtocol

KPA_PER_BAR = 100.0
PSI_PER_BAR = 14.5038
MPH_TO_KPH = 1.609344
MPS_TO_KPH = 3.6
KNOTS_TO_KPH = 1.852

NULL_MARKERS = {"", "na", "n/a", "none", "null", "missing", "unavailable", "--"}
SPEED_SUFFIXES = {"_kph": "kph", "_kmh": "kph", "_mph": "mph", "_mps": "mps", "_ms": "mps", "_knots": "knots"}
TEMP_SUFFIXES = {"_c": "celsius", "_degc": "celsius", "_f": "fahrenheit", "_degf": "fahrenheit"}
PRESSURE_SUFFIXES = {"_bar": "bar", "_psi": "psi", "_kpa": "kpa"}
GENERIC_SUFFIXES = {"_pct": "percent", "_percent": "percent", "_v": "volt"}
VALUE_PATTERN = re.compile(r"[-+]?\d+(?:\.\d+)?")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True, slots=True)
class DictatorFieldBinding:
    canonical_key: str
    aliases: tuple[str, ...]


DICTATOR_FIELD_BINDINGS: tuple[DictatorFieldBinding, ...] = (
    DictatorFieldBinding("rpm", ("rpm", "engine_rpm", "eng_rpm")),
    DictatorFieldBinding("speed", ("speed", "vehicle_speed", "road_speed")),
    DictatorFieldBinding("gear", ("gear", "current_gear")),
    DictatorFieldBinding("coolant_temp", ("coolant_temp", "water_temp", "water", "ect", "clt")),
    DictatorFieldBinding("oil_temp", ("oil_temp", "oil_temperature")),
    DictatorFieldBinding("oil_pressure", ("oil_pressure", "oil_press", "oil_pres")),
    DictatorFieldBinding("battery_voltage", ("battery_voltage", "battery", "voltage", "batt")),
    DictatorFieldBinding("fuel_pressure", ("fuel_pressure", "fuel_press", "fuel_pres")),
    DictatorFieldBinding("fuel_level", ("fuel_level", "fuel_pct", "fuel_percent")),
    DictatorFieldBinding("lambda", ("lambda", "lambda_value")),
    DictatorFieldBinding("afr", ("afr", "air_fuel_ratio")),
    DictatorFieldBinding("intake_temp", ("intake_temp", "intake_air_temp", "iat", "air_temp")),
    DictatorFieldBinding(
        "throttle_position",
        ("throttle_position", "throttle", "tps", "throttle_pct", "throttle_percent"),
    ),
)

ALIASES_TO_BINDINGS = {
    alias: binding
    for binding in DICTATOR_FIELD_BINDINGS
    for alias in binding.aliases
}


class DictatorProtocol(TelemetryProtocol):
    def feed(self, raw_chunk: bytes) -> list[bytes]:
        frames = [line.strip() for line in raw_chunk.splitlines() if line.strip()]
        if frames:
            return frames

        chunk = raw_chunk.strip()
        return [chunk] if chunk else []

    def decode(self, raw_message: bytes) -> DecodedMessage:
        payload_text = raw_message.decode("utf-8", errors="ignore").strip()
        if not payload_text:
            raise ValueError("Empty Dictator frame.")

        parsed_fields = self._parse_fields(payload_text)
        if not parsed_fields:
            raise ValueError("No Dictator fields were found in the frame.")

        canonical_fields: dict[str, float | int | None] = {}
        for raw_key, raw_value in parsed_fields.items():
            binding, unit_hint = self._resolve_binding(raw_key)
            if binding is None:
                continue

            value, inline_unit, explicit_null = self._coerce_value(raw_value)
            unit = inline_unit or unit_hint
            if explicit_null:
                canonical_fields[binding.canonical_key] = None
                continue
            if value is None:
                continue

            canonical_fields[binding.canonical_key] = self._round_metric(
                binding.canonical_key,
                self._convert_to_canonical(binding.canonical_key, value, unit),
            )

        if not canonical_fields:
            raise ValueError("No recognized Dictator telemetry fields were found in the frame.")

        return DecodedMessage(fields=canonical_fields, raw=raw_message, captured_at=_utcnow())

    def _parse_fields(self, payload_text: str) -> dict[str, Any]:
        if payload_text.startswith("{") and payload_text.endswith("}"):
            decoded = json.loads(payload_text)
            if not isinstance(decoded, dict):
                raise ValueError("Dictator JSON payload must be an object.")
            return self._flatten_mapping(decoded)

        fields: dict[str, Any] = {}
        for token in re.split(r"[;,|]", payload_text):
            item = token.strip()
            if not item:
                continue
            key, separator, value = item.partition("=")
            if not separator:
                key, separator, value = item.partition(":")
            if not separator:
                continue
            fields[key.strip()] = value.strip()

        if fields:
            return fields

        for token in payload_text.split():
            key, separator, value = token.partition("=")
            if not separator:
                key, separator, value = token.partition(":")
            if separator:
                fields[key.strip()] = value.strip()

        return fields

    def _flatten_mapping(self, payload: dict[str, Any], prefix: str = "") -> dict[str, Any]:
        flattened: dict[str, Any] = {}
        for key, value in payload.items():
            if not isinstance(key, str):
                continue
            key_prefix = f"{prefix}{key}" if not prefix else f"{prefix}_{key}"
            if isinstance(value, dict) and "value" in value and (
                "unit" in value or "units" in value
            ):
                flattened[key_prefix] = value
                continue
            if isinstance(value, dict) and not {"value", "unit", "units"} & set(value.keys()):
                flattened.update(self._flatten_mapping(value, key_prefix))
                continue
            flattened[key_prefix] = value
        return flattened

    def _resolve_binding(self, raw_key: str) -> tuple[DictatorFieldBinding | None, str | None]:
        normalized_key = self._normalize_key(raw_key)
        base_key, unit_hint = self._split_unit_suffix(normalized_key)
        return ALIASES_TO_BINDINGS.get(base_key), unit_hint

    def _normalize_key(self, raw_key: str) -> str:
        normalized = re.sub(r"[^a-z0-9]+", "_", raw_key.lower()).strip("_")
        return re.sub(r"_+", "_", normalized)

    def _split_unit_suffix(self, normalized_key: str) -> tuple[str, str | None]:
        for suffix_map in (SPEED_SUFFIXES, TEMP_SUFFIXES, PRESSURE_SUFFIXES, GENERIC_SUFFIXES):
            for suffix, unit in suffix_map.items():
                if normalized_key.endswith(suffix):
                    return normalized_key[: -len(suffix)], unit
        return normalized_key, None

    def _coerce_value(self, raw_value: Any) -> tuple[float | None, str | None, bool]:
        if raw_value is None:
            return None, None, True

        if isinstance(raw_value, dict):
            value = raw_value.get("value")
            unit = self._normalize_unit(raw_value.get("unit") or raw_value.get("units"))
            if value is None:
                return None, unit, True
            if isinstance(value, (int, float)):
                return float(value), unit, False
            raw_value = value
        elif isinstance(raw_value, (int, float)):
            return float(raw_value), None, False

        text = str(raw_value).strip().strip('"').strip("'")
        if not text or text.lower() in NULL_MARKERS:
            return None, None, True

        if text.endswith("%"):
            unit = "percent"
        else:
            unit_match = re.sub(r"[-+0-9.\s]", "", text)
            unit = self._normalize_unit(unit_match)

        match = VALUE_PATTERN.search(text)
        if match is None:
            return None, unit, False
        return float(match.group(0)), unit, False

    def _normalize_unit(self, unit: Any) -> str | None:
        if unit is None:
            return None
        normalized = re.sub(r"[^a-z%]+", "", str(unit).lower())
        if normalized in {"c", "degc", "celsius"}:
            return "celsius"
        if normalized in {"f", "degf", "fahrenheit"}:
            return "fahrenheit"
        if normalized in {"kph", "kmh", "kmph", "kmhr", "kmh"}:
            return "kph"
        if normalized in {"mph"}:
            return "mph"
        if normalized in {"mps", "ms"}:
            return "mps"
        if normalized in {"kt", "kts", "knot", "knots"}:
            return "knots"
        if normalized in {"bar"}:
            return "bar"
        if normalized in {"psi"}:
            return "psi"
        if normalized in {"kpa"}:
            return "kpa"
        if normalized in {"v", "volt", "volts"}:
            return "volt"
        if normalized in {"percent", "pct", "%"}:
            return "percent"
        return None

    def _convert_to_canonical(self, canonical_key: str, value: float, unit: str | None) -> float:
        if canonical_key == "speed":
            if unit == "mph":
                return value * MPH_TO_KPH
            if unit == "mps":
                return value * MPS_TO_KPH
            if unit == "knots":
                return value * KNOTS_TO_KPH
            return value

        if canonical_key in {"coolant_temp", "oil_temp", "intake_temp"}:
            if unit == "fahrenheit":
                return (value - 32.0) / 1.8
            return value

        if canonical_key in {"oil_pressure", "fuel_pressure"}:
            if unit == "psi":
                return value / PSI_PER_BAR
            if unit == "kpa":
                return value / KPA_PER_BAR
            return value

        return value

    def _round_metric(self, canonical_key: str, value: float) -> float | int:
        if canonical_key in {"rpm"}:
            return round(value, 0)
        if canonical_key in {"gear"}:
            return int(round(value))
        if canonical_key in {
            "speed",
            "coolant_temp",
            "oil_temp",
            "battery_voltage",
            "intake_temp",
            "throttle_position",
            "fuel_level",
        }:
            return round(value, 1)
        if canonical_key in {"oil_pressure", "fuel_pressure", "lambda", "afr"}:
            return round(value, 3 if canonical_key == "lambda" else 2)
        return round(value, 2)
