"""In-memory event + audit persistence for the demo backend."""

from .event_store import AuditEntry, EventStore, event_store

__all__ = ["AuditEntry", "EventStore", "event_store"]
