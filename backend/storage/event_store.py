"""Process-local and persistent event store with offshore DB replication.

Persists all operator verifications and append-only audit entries to a local SQLite database
(``data/jvalyx_audit.db``) and replicates audit records to an offshore/cloud database
endpoint whenever ``OFFSHORE_DB_URL`` or ``DATABASE_URL`` is configured.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from itertools import count
from pathlib import Path
from typing import Any, Literal

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

import httpx
from pydantic import BaseModel, ConfigDict

from backend.models import EventIntelligence, RouteState

logger = logging.getLogger("jvalyx.audit")

DEFAULT_DB_PATH = Path(__file__).parents[2] / "data" / "jvalyx_audit.db"

VerificationStatus = Literal["unverified", "human_confirmed", "human_rejected"]

AuditAction = Literal[
    "REPLAY_START",
    "REPLAY_RESET",
    "SCENARIO_LOAD",
    "SIMULATE_DEVIATION",
    "CONFIRM_CRITICAL",
    "REJECT_NORMAL",
    "REQUEST_TACTICAL_PASS",
]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class AuditEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    event_id: str
    timestamp: str
    action: AuditAction
    operator: str = "SYSTEM"
    notes: str = ""
    prior_route_state: RouteState | None = None
    new_route_state: RouteState | None = None


class VerificationRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: VerificationStatus = "unverified"
    route_override: RouteState | None = None


class EventStore:
    """Hybrid in-memory cache and persistent SQLite/Offshore-replicated audit store."""

    def __init__(self, db_path: Path | str | None = None) -> None:
        self._lock = threading.RLock()
        self._events: dict[str, EventIntelligence] = {}
        self._audit: list[AuditEntry] = []
        self._verifications: dict[str, VerificationRecord] = {}

        # Configure database path
        env_path = os.getenv("JVALYX_DB_PATH")
        if db_path is not None:
            self._db_path = Path(db_path) if str(db_path) != ":memory:" else ":memory:"
        elif env_path:
            self._db_path = Path(env_path) if env_path != ":memory:" else ":memory:"
        else:
            self._db_path = DEFAULT_DB_PATH

        # Offshore DB configuration
        self._offshore_url = os.getenv("OFFSHORE_DB_URL") or os.getenv("DATABASE_URL")
        self._offshore_key = os.getenv("OFFSHORE_DB_KEY") or os.getenv("SUPABASE_KEY")
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="offshore-audit-sync")

        # Initialize SQLite storage
        self._init_sqlite()

    def _init_sqlite(self) -> None:
        if self._db_path != ":memory:":
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(str(self._db_path), check_same_thread=False)
        else:
            self._conn = sqlite3.connect(":memory:", check_same_thread=False)

        with self._lock:
            self._conn.execute("PRAGMA journal_mode=WAL;")
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_log (
                    id TEXT PRIMARY KEY,
                    event_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    action TEXT NOT NULL,
                    operator TEXT NOT NULL,
                    notes TEXT NOT NULL,
                    prior_route_state TEXT,
                    new_route_state TEXT,
                    synced_offshore INTEGER DEFAULT 0
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS verifications (
                    event_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    route_override TEXT,
                    updated_at TEXT NOT NULL
                )
                """
            )
            self._conn.commit()

            # Load existing audit records into memory
            cur = self._conn.cursor()
            cur.execute("SELECT id, event_id, timestamp, action, operator, notes, prior_route_state, new_route_state FROM audit_log ORDER BY rowid ASC")
            rows = cur.fetchall()

            audit_nums = []
            for r in rows:
                entry = AuditEntry(
                    id=r[0],
                    event_id=r[1],
                    timestamp=r[2],
                    action=r[3],
                    operator=r[4],
                    notes=r[5],
                    prior_route_state=RouteState(r[6]) if r[6] else None,
                    new_route_state=RouteState(r[7]) if r[7] else None,
                )
                self._audit.append(entry)
                if "-" in r[0]:
                    try:
                        audit_nums.append(int(r[0].split("-")[1]))
                    except ValueError:
                        pass

            next_audit_num = max(audit_nums, default=0) + 1
            self._audit_ids = count(next_audit_num)

            # Load existing verifications
            cur.execute("SELECT event_id, status, route_override FROM verifications")
            for r in cur.fetchall():
                self._verifications[r[0]] = VerificationRecord(
                    status=r[1],
                    route_override=RouteState(r[2]) if r[2] else None,
                )

    # -- events -----------------------------------------------------------------
    def upsert_event(self, event: EventIntelligence) -> None:
        with self._lock:
            self._events[event.event_id] = event

    def get_event(self, event_id: str) -> EventIntelligence | None:
        with self._lock:
            return self._events.get(event_id)

    def list_events(self) -> list[EventIntelligence]:
        with self._lock:
            return list(self._events.values())

    def clear_events(self) -> None:
        with self._lock:
            self._events.clear()

    # -- verification ---------------------------------------------------------
    def verification(self, event_id: str) -> VerificationRecord:
        with self._lock:
            return self._verifications.get(event_id, VerificationRecord())

    def set_verification(
        self, event_id: str, status: VerificationStatus, route_override: RouteState | None
    ) -> None:
        with self._lock:
            record = VerificationRecord(status=status, route_override=route_override)
            self._verifications[event_id] = record
            now = _utc_now_iso()
            self._conn.execute(
                """
                INSERT INTO verifications (event_id, status, route_override, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(event_id) DO UPDATE SET
                    status=excluded.status,
                    route_override=excluded.route_override,
                    updated_at=excluded.updated_at
                """,
                (event_id, status, route_override.value if route_override else None, now),
            )
            self._conn.commit()

    def clear_verification(self, event_id: str) -> None:
        with self._lock:
            self._verifications.pop(event_id, None)
            self._conn.execute("DELETE FROM verifications WHERE event_id = ?", (event_id,))
            self._conn.commit()

    # -- audit --------------------------------------------------------------
    def append_audit(
        self,
        *,
        event_id: str,
        action: AuditAction,
        operator: str = "SYSTEM",
        notes: str = "",
        prior_route_state: RouteState | None = None,
        new_route_state: RouteState | None = None,
    ) -> AuditEntry:
        with self._lock:
            entry = AuditEntry(
                id=f"aud-{next(self._audit_ids):04d}",
                event_id=event_id,
                timestamp=_utc_now_iso(),
                action=action,
                operator=operator,
                notes=notes,
                prior_route_state=prior_route_state,
                new_route_state=new_route_state,
            )
            self._audit.append(entry)

            # Persist to local SQLite
            self._conn.execute(
                """
                INSERT INTO audit_log (id, event_id, timestamp, action, operator, notes, prior_route_state, new_route_state, synced_offshore)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                """,
                (
                    entry.id,
                    entry.event_id,
                    entry.timestamp,
                    entry.action,
                    entry.operator,
                    entry.notes,
                    entry.prior_route_state.value if entry.prior_route_state else None,
                    entry.new_route_state.value if entry.new_route_state else None,
                ),
            )
            self._conn.commit()

            # Non-blocking sync to offshore database if configured
            if self._offshore_url:
                self._executor.submit(self.sync_pending_offshore)

            return entry

    def _sync_postgres(self, entries: list[AuditEntry]) -> list[str]:
        """Insert batch of audit records into offshore PostgreSQL database using psycopg."""
        if not self._offshore_url or not entries:
            return []
        try:
            import psycopg  # type: ignore[import-untyped]
            with psycopg.connect(self._offshore_url, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS audit_log (
                            id TEXT PRIMARY KEY,
                            event_id TEXT NOT NULL,
                            timestamp TIMESTAMPTZ NOT NULL,
                            action TEXT NOT NULL,
                            operator TEXT NOT NULL,
                            notes TEXT,
                            prior_route_state TEXT,
                            new_route_state TEXT,
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        );
                        """
                    )
                    for entry in entries:
                        cur.execute(
                            """
                            INSERT INTO audit_log (id, event_id, timestamp, action, operator, notes, prior_route_state, new_route_state)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (id) DO NOTHING;
                            """,
                            (
                                entry.id,
                                entry.event_id,
                                entry.timestamp,
                                entry.action,
                                entry.operator,
                                entry.notes,
                                entry.prior_route_state.value if entry.prior_route_state else None,
                                entry.new_route_state.value if entry.new_route_state else None,
                            ),
                        )
                conn.commit()
            return [e.id for e in entries]
        except Exception as exc:
            logger.warning("Failed to replicate %d audits to offshore Postgres: %s", len(entries), exc)
            return []

    def _sync_http(self, entries: list[AuditEntry]) -> list[str]:
        """Post audit records to external / offshore HTTP REST endpoint (e.g. Supabase, Webhook)."""
        url = self._offshore_url
        if not url or not entries:
            return []

        # Auto-target Supabase table if base project URL provided
        if "supabase.co" in url and not url.rstrip("/").endswith("/audit_log"):
            url = url.rstrip("/") + "/rest/v1/audit_log"

        headers = {
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        if self._offshore_key:
            headers["Authorization"] = f"Bearer {self._offshore_key}"
            headers["apikey"] = self._offshore_key

        synced_ids: list[str] = []
        try:
            with httpx.Client(timeout=5.0) as client:
                for entry in entries:
                    payload = {
                        "id": entry.id,
                        "event_id": entry.event_id,
                        "timestamp": entry.timestamp,
                        "action": entry.action,
                        "operator": entry.operator,
                        "notes": entry.notes,
                        "prior_route_state": entry.prior_route_state.value if entry.prior_route_state else None,
                        "new_route_state": entry.new_route_state.value if entry.new_route_state else None,
                    }
                    res = client.post(url, json=payload, headers=headers)
                    if res.status_code in (200, 201, 204):
                        synced_ids.append(entry.id)
                    else:
                        logger.warning("Offshore DB returned status %d for %s: %s", res.status_code, entry.id, res.text[:120])
        except Exception as exc:
            logger.warning("Failed to replicate audits to offshore DB: %s", exc)

        return synced_ids

    def sync_pending_offshore(self) -> int:
        """Replay and sync all un-replicated audit entries to the offshore DB.

        Returns the number of entries successfully synced in this pass.
        """
        if not self._offshore_url:
            return 0

        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                "SELECT id, event_id, timestamp, action, operator, notes, prior_route_state, new_route_state "
                "FROM audit_log WHERE synced_offshore = 0 ORDER BY rowid ASC"
            )
            rows = cur.fetchall()
            if not rows:
                return 0

            pending = [
                AuditEntry(
                    id=r[0],
                    event_id=r[1],
                    timestamp=r[2],
                    action=r[3],
                    operator=r[4],
                    notes=r[5],
                    prior_route_state=RouteState(r[6]) if r[6] else None,
                    new_route_state=RouteState(r[7]) if r[7] else None,
                )
                for r in rows
            ]

        is_pg = self._offshore_url.startswith(("postgres://", "postgresql://"))
        if is_pg:
            synced_ids = self._sync_postgres(pending)
        else:
            synced_ids = self._sync_http(pending)

        if synced_ids:
            with self._lock:
                placeholders = ",".join("?" for _ in synced_ids)
                self._conn.execute(
                    f"UPDATE audit_log SET synced_offshore = 1 WHERE id IN ({placeholders})",
                    synced_ids,
                )
                self._conn.commit()

        return len(synced_ids)

    def reconfigure_offshore(self, url: str | None, key: str | None = None) -> None:
        """Dynamically configure offshore database endpoint and trigger immediate sync."""
        with self._lock:
            self._offshore_url = url.strip() if url else None
            self._offshore_key = key.strip() if key else None
        if self._offshore_url:
            self._executor.submit(self.sync_pending_offshore)

    def audit_log(self) -> list[AuditEntry]:
        with self._lock:
            return list(reversed(self._audit))

    def offshore_status(self) -> dict[str, Any]:
        """Return offshore database connection and synchronization status."""
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("SELECT COUNT(*) FROM audit_log WHERE synced_offshore = 1")
            synced = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM audit_log WHERE synced_offshore = 0")
            pending = cur.fetchone()[0]

            is_pg = bool(self._offshore_url and self._offshore_url.startswith(("postgres://", "postgresql://")))
            return {
                "configured": bool(self._offshore_url),
                "type": "postgresql" if is_pg else ("http_rest" if self._offshore_url else "none"),
                "target_url": self._offshore_url if self._offshore_url else None,
                "local_total": len(self._audit),
                "synced_offshore": synced,
                "pending_offshore": pending,
            }

    def reset(self) -> None:
        with self._lock:
            self._events.clear()
            self._verifications.clear()
            self._conn.execute("DELETE FROM verifications")
            self._conn.commit()

    def clear_audit(self) -> None:
        with self._lock:
            self._audit.clear()
            self._audit_ids = count(1)
            self._conn.execute("DELETE FROM audit_log")
            self._conn.commit()


event_store = EventStore()
