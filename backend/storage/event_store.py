"""Process-local event store and append-only audit log.

Deliberately in-memory for the demo. The public surface is kept narrow so a SQLite /
PostgreSQL implementation can be dropped in later without touching callers
(Comprehensive plan §3.2).
"""

import threading
from datetime import datetime, timezone
from itertools import count
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from backend.models import EventIntelligence, RouteState

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
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._events: dict[str, EventIntelligence] = {}
        self._audit: list[AuditEntry] = []
        self._verifications: dict[str, VerificationRecord] = {}
        self._audit_ids = count(1)

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
            self._verifications[event_id] = VerificationRecord(
                status=status, route_override=route_override
            )

    def clear_verification(self, event_id: str) -> None:
        with self._lock:
            self._verifications.pop(event_id, None)

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
            return entry

    def audit_log(self) -> list[AuditEntry]:
        with self._lock:
            return list(reversed(self._audit))

    def reset(self) -> None:
        with self._lock:
            self._events.clear()
            self._verifications.clear()


event_store = EventStore()
