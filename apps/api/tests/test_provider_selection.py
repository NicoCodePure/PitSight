from types import SimpleNamespace

import pytest

from pitsight_api.config import Settings
from pitsight_api.core.models.telemetry import ProviderName
from pitsight_api.providers.dictator import DictatorTelemetryProvider
from pitsight_api.providers.factory import build_provider
from pitsight_api.providers.obd2 import OBD2TelemetryProvider
from pitsight_api.providers.simulator import SimulatorTelemetryProvider


@pytest.mark.parametrize(
    ("provider_mode", "provider_type", "provider_name"),
    [
        (ProviderName.SIMULATOR, SimulatorTelemetryProvider, ProviderName.SIMULATOR),
        (ProviderName.OBD2, OBD2TelemetryProvider, ProviderName.OBD2),
        (ProviderName.DICTATOR, DictatorTelemetryProvider, ProviderName.DICTATOR),
    ],
)
def test_build_provider_uses_explicit_startup_mode(provider_mode, provider_type, provider_name) -> None:
    settings = Settings(_env_file=None, provider_mode=provider_mode)

    provider = build_provider(settings)

    assert isinstance(provider, provider_type)
    assert provider.metadata.name is provider_name


def test_build_provider_rejects_unsupported_provider_mode() -> None:
    unsupported_settings = SimpleNamespace(provider_mode="gps")

    with pytest.raises(ValueError, match="Unsupported provider mode: gps"):
        build_provider(unsupported_settings)
