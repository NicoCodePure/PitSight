from fastapi import FastAPI
from fastapi.testclient import TestClient

from pitsight_api.config import Settings
from pitsight_api.main import install_cors_middleware


def build_test_app(settings: Settings) -> FastAPI:
    app = FastAPI()
    install_cors_middleware(app, settings)

    @app.get("/ping")
    async def ping() -> dict[str, bool]:
        return {"ok": True}

    return app


def test_settings_parse_comma_separated_cors_origins() -> None:
    settings = Settings(
        _env_file=None,
        cors_origins="http://localhost:5173, http://192.168.3.104:5173",
    )

    assert settings.cors_origins == [
        "http://localhost:5173",
        "http://192.168.3.104:5173",
    ]


def test_settings_parse_wildcard_cors_origin() -> None:
    settings = Settings(_env_file=None, cors_origins="*")

    assert settings.cors_origins == ["*"]


def test_cors_allows_configured_lan_origin() -> None:
    settings = Settings(
        _env_file=None,
        cors_origins="http://localhost:5173,http://192.168.3.104:5173",
    )
    client = TestClient(build_test_app(settings))

    response = client.options(
        "/ping",
        headers={
            "Origin": "http://192.168.3.104:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://192.168.3.104:5173"


def test_cors_rejects_unconfigured_origin() -> None:
    settings = Settings(
        _env_file=None,
        cors_origins="http://localhost:5173",
    )
    client = TestClient(build_test_app(settings))

    response = client.options(
        "/ping",
        headers={
            "Origin": "http://192.168.3.104:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
