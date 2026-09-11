import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.runtime import replay_worker


@pytest.fixture(autouse=True)
def _reset_runtime():
    replay_worker._scenario = None  # noqa: SLF001 - deterministic test isolation
    replay_worker.store.reset()
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health_and_config(client: TestClient) -> None:
    assert client.get("/health").json()["model_version"] == "stub-0.1.0"
    config = client.get("/config").json()
    assert config["arbitration"]["min_quality"] == 0.45
    assert "honesty_notice" in config


def test_scenarios_listed(client: TestClient) -> None:
    ids = [s["scenario_id"] for s in client.get("/scenarios").json()]
    assert ids == ["industrial_escalation", "persistent_flare", "sensor_disagreement", "wildfire"]


def test_start_seeds_event_and_supports_simulate_and_verify(client: TestClient) -> None:
    started = client.post("/scenarios/industrial_escalation/start")
    assert started.status_code == 200
    assert started.json()["frame_count"] == 4

    events = client.get("/events").json()
    assert events and events[0]["event_id"] == "evt-industrial_escalation"
    event_id = events[0]["event_id"]

    simulated = client.post(f"/events/{event_id}/simulate", json={"deviation": 1.0}).json()
    assert simulated["route_state"] == "CRITICAL"
    assert simulated["mode"] == "DEMO SIMULATION MODE"

    verified = client.post(f"/events/{event_id}/verify", json={"decision": "confirm"}).json()
    assert verified["route_state"] == "CRITICAL"
    assert verified["verification_status"] == "human_confirmed"

    actions = [entry["action"] for entry in client.get("/audit").json()]
    assert actions[:2] == ["CONFIRM_CRITICAL", "SIMULATE_DEVIATION"]


def test_unknown_scenario_and_event_return_404(client: TestClient) -> None:
    assert client.post("/scenarios/nope/start").status_code == 404
    client.post("/scenarios/persistent_flare/start")
    assert client.get("/events/evt-missing").status_code == 404


def test_replay_speed_validation(client: TestClient) -> None:
    client.post("/scenarios/persistent_flare/start")
    assert client.post("/replay/speed", json={"speed": 4.0}).status_code == 200
    assert client.post("/replay/speed", json={"speed": 2.0}).status_code == 422


def test_websocket_sends_initial_snapshot(client: TestClient) -> None:
    client.post("/scenarios/persistent_flare/start")
    with client.websocket_connect("/ws/events") as ws:
        message = ws.receive_json()
    assert message["type"] == "snapshot"
    assert message["status"]["scenario_id"] == "persistent_flare"
    assert len(message["events"]) == 1


def test_firms_proxy_endpoint(client: TestClient) -> None:
    from unittest.mock import AsyncMock, MagicMock, patch

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b"latitude,longitude\n22.0,80.0\n"
    mock_resp.headers = {"content-type": "text/csv"}

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        res = client.get("/api/firms/area/csv/dummy_key/VIIRS_SNPP_NRT/67,6,97,37/1")
        assert res.status_code == 200
        assert b"latitude,longitude" in res.content
        assert "text/csv" in res.headers["content-type"]


def test_weather_endpoint(client: TestClient) -> None:
    from unittest.mock import AsyncMock, MagicMock, patch

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "current": {
            "temperature_2m": 31.0,
            "relative_humidity_2m": 60.0,
            "wind_speed_10m": 4.5,
            "wind_direction_10m": 90.0,
            "wind_gusts_10m": 7.0,
        }
    }

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        res = client.get("/api/weather?lat=12.97&lon=74.84")
        assert res.status_code == 200
        data = res.json()
        assert data["temperature_c"] == 31.0
        assert data["wind_speed_mps"] == 4.5
        assert data["wind_direction_deg"] == 270.0
        assert "Open-Meteo" in data["source"]


def test_audit_offshore_endpoints(client: TestClient) -> None:
    res = client.get("/audit/offshore-status")
    assert res.status_code == 200
    data = res.json()
    assert "configured" in data
    assert "local_total" in data

    sync_res = client.post("/audit/offshore-sync")
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["status"] == "success"
    assert "synced_now" in sync_data

