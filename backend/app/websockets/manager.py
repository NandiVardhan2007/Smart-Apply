import json
from typing import Any, Dict

from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket connections keyed by session_id."""

    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}
        self._session_to_email: Dict[str, str] = {}

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
        """Send a typed JSON event to a specific session. Returns True if sent."""
        ws = self._connections.get(session_id)
        if ws is None:
            return False
        try:
            message = json.dumps({"type": event_type, "data": payload})
            await ws.send_text(message)
            return True
        except Exception:
            self.disconnect(session_id)
            return False

    async def broadcast_to_user(
        self, email: str, event_type: str, payload: Dict[str, Any]
    ) -> None:
        """Send an event to all sessions associated with a user email."""
        for sid, e in list(self._session_to_email.items()):
            if e == email:
                await self.send_event(sid, event_type, payload)

    @property
    def active_count(self) -> int:
        return len(self._connections)


# Global singleton
manager = ConnectionManager()
