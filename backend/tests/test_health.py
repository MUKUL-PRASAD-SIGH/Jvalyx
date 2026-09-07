from fastapi.testclient import TestClient

from backend.app import app


def test_health_reports_service_and_versions() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "jvalyx-backend",
        "model_version": "stub-0.1.0",
        "policy_version": "arbitrator-0.1.0",
    }
