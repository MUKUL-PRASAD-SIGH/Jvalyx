"""WebSocket stream of live event-state updates (Comprehensive plan §12.2)."""

import contextlib

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.runtime import replay_worker

router = APIRouter()


@router.websocket("/ws/events")
async def events_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    await replay_worker.broadcaster.register(websocket)
    try:
        # Initial snapshot so a late joiner renders immediately.
        await websocket.send_json(
            {
                "type": "snapshot",
                "status": replay_worker.status(),
                "events": [event.model_dump(mode="json") for event in replay_worker.store.list_events()],
            }
        )
        while True:
            # We don't expect inbound messages; this keeps the socket open and
            # surfaces disconnects promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await replay_worker.broadcaster.unregister(websocket)
        with contextlib.suppress(RuntimeError):
            await websocket.close()
