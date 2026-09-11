from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def test_get_industrial_polygons():
    response = client.get("/api/facilities/industrial-polygons")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 278


def test_get_zones_summary():
    response = client.get("/api/facilities/zones")
    assert response.status_code == 200
    data = response.json()
    assert data["total_polygons"] == 278
    assert "Raniganj_Coalfield_WB" in data["zones"]
    assert "Korba_Industrial_CG" in data["zones"]


def test_lookup_korba():
    response = client.get("/api/facilities/lookup?lat=22.322&lon=82.732")
    assert response.status_code == 200
    data = response.json()
    assert data["is_in_industrial_polygon"] is True
    assert data["distance_to_nearest_industrial_m"] == 0.0
    assert data["matched_facility"]["coal_industrial_zone"] == "Korba_Industrial_CG"


def test_lookup_sea():
    response = client.get("/api/facilities/lookup?lat=15.0&lon=70.0")
    assert response.status_code == 200
    data = response.json()
    assert data["is_in_industrial_polygon"] is False
    assert data["distance_to_nearest_industrial_m"] > 500_000
