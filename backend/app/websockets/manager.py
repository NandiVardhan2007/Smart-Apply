import json
import logging
from typing import Any, Dict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections keyed by session_id with local routing only."""

    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}
        self._session_to_email: Dict[str, str] = {}

    async def start_pubsub(self):
        """No-op for local routing."""
        logger.info("Using local routing for websockets (Redis removed).")

    async def stop_pubsub(self):
        """No-op for local routing."""
        pass

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        """Accept and store a WebSocket connection."""
        await websocket.accept()
        self._connections[session_id] = websocket
        await self.send_event(session_id, "connected", {"session_id": session_id})

    def disconnect(self, session_id: str) -> None:
        """Remove a WebSocket connection."""
        self._connections.pop(session_id, None)
        self._session_to_email.pop(session_id, None)

    def associate_email(self, session_id: str, email: str) -> None:
        """Associate a session with a user email."""
        self._session_to_email[session_id] = email

    async def send_event(
        self, session_id: str, event_type: str, payload: Dict[str, Any]
    ) -> bool:
        """Publish a typed JSON event to a specific session locally."""
        if session_id in self._connections:
            ws = self._connections[session_id]
            try:
                await ws.send_text(json.dumps({"type": event_type, "data": payload}))
            except Exception as e:
                logger.error(f"Failed to push message locally {session_id}: {e}")
                self.disconnect(session_id)
        return True

    async def broadcast_to_user(
        self, email: str, event_type: str, payload: Dict[str, Any]
    ) -> None:
        """Publish an event to all sessions associated with a user email locally."""
        for local_session_id, session_email in list(self._session_to_email.items()):
            if session_email == email and local_session_id in self._connections:
                ws = self._connections[local_session_id]
                try:
                    await ws.send_text(json.dumps({"type": event_type, "data": payload}))
                except Exception as e:
                    logger.error(f"Failed to push message locally {local_session_id}: {e}")
                    self.disconnect(local_session_id)

# Global singleton
manager = ConnectionManager()

