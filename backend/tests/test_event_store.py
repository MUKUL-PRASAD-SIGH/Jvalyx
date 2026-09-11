import os
from pathlib import Path
from backend.models import RouteState
from backend.storage.event_store import EventStore


def test_sqlite_persistence_across_store_instances(tmp_path: Path) -> None:
    db_file = tmp_path / "test_audit.db"

    # Store 1: write audit and verification
    store1 = EventStore(db_path=db_file)
    entry1 = store1.append_audit(
        event_id="evt-mrpl-01",
        action="CONFIRM_CRITICAL",
        operator="CHIEF-OPS",
        notes="High FRP surge observed",
        prior_route_state=RouteState.UNCERTAIN,
        new_route_state=RouteState.CRITICAL,
    )
    assert entry1.id == "aud-0001"
    store1.set_verification("evt-mrpl-01", "human_confirmed", RouteState.CRITICAL)

    # Store 2: open the exact same database file
    store2 = EventStore(db_path=db_file)
    logs = store2.audit_log()
    assert len(logs) == 1
    assert logs[0].id == "aud-0001"
    assert logs[0].action == "CONFIRM_CRITICAL"
    assert logs[0].operator == "CHIEF-OPS"
    assert logs[0].new_route_state == RouteState.CRITICAL

    # Check verification persisted
    v = store2.verification("evt-mrpl-01")
    assert v.status == "human_confirmed"
    assert v.route_override == RouteState.CRITICAL

    # Write second entry, check ID monotonicity
    entry2 = store2.append_audit(
        event_id="evt-mrpl-01",
        action="REQUEST_TACTICAL_PASS",
        operator="SYSTEM",
    )
    assert entry2.id == "aud-0002"

    logs2 = store2.audit_log()
    assert len(logs2) == 2
    assert logs2[0].id == "aud-0002"
    assert logs2[1].id == "aud-0001"


def test_offshore_status_reporting(tmp_path: Path) -> None:
    db_file = tmp_path / "test_status.db"
    store = EventStore(db_path=db_file)
    status = store.offshore_status()
    assert "configured" in status
    assert "local_total" in status
    assert status["local_total"] == 0


def test_sync_pending_offshore_http(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "test_offshore_sync.db"
    store = EventStore(db_path=db_file)
    store.reconfigure_offshore("https://testproject.supabase.co", "test-key-123")

    # Write two audits locally
    store.append_audit(
        event_id="evt-01",
        action="CONFIRM_CRITICAL",
        operator="AGENT-1",
        new_route_state=RouteState.CRITICAL,
    )
    store.append_audit(
        event_id="evt-02",
        action="REJECT_NORMAL",
        operator="AGENT-2",
        new_route_state=RouteState.NORMAL,
    )

    posted_urls: list[str] = []

    class MockResponse:
        status_code = 201
        text = ""

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, url, json=None, headers=None):
            posted_urls.append(url)
            assert headers["apikey"] == "test-key-123"
            assert "Bearer test-key-123" in headers["Authorization"]
            return MockResponse()

    monkeypatch.setattr("httpx.Client", MockClient)

    synced = store.sync_pending_offshore()
    assert synced == 2
    assert len(posted_urls) == 2
    assert posted_urls[0] == "https://testproject.supabase.co/rest/v1/audit_log"

    status = store.offshore_status()
    assert status["synced_offshore"] == 2
    assert status["pending_offshore"] == 0

