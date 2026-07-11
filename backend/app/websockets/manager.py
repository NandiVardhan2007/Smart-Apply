import json
import logging
import asyncio
from typing import Any, Dict

from fastapi import WebSocket
import redis.asyncio as redis
from app.config import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections keyed by session_id, with Redis pub/sub."""

    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}
        self._session_to_email: Dict[str, str] = {}
        self.redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.pubsub = self.redis.pubsub()
        self.channel_name = "smartapply:events"
        self._listener_task = None

        self.redis_available = False

    async def start_pubsub(self):
        """Starts the Redis pub/sub listener loop."""
        try:
            await self.pubsub.subscribe(self.channel_name)
            logger.info(f"Subscribed to Redis channel: {self.channel_name}")
            self.redis_available = True
            self._listener_task = asyncio.create_task(self._listen_for_events())
        except Exception as e:
            logger.warning(f"Failed to connect to Redis for pub/sub: {e}. Falling back to local routing.")
            self.redis_available = False

    async def _listen_for_events(self):
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    if "user_email" in data:
                        target_email = data["user_email"]
                        for local_session_id, email in list(self._session_to_email.items()):
                            if email == target_email and local_session_id in self._connections:
                                ws = self._connections[local_session_id]
                                try:
                                    await ws.send_text(json.dumps({"type": data["event_type"], "data": data["payload"]}))
                                except Exception as e:
                                    logger.error(f"Failed to push message to local ws {local_session_id}: {e}")
                                    self.disconnect(local_session_id)
                    else:
                        session_id = data.get("session_id")
                        if session_id and session_id in self._connections:
                            ws = self._connections[session_id]
                            try:
                                await ws.send_text(json.dumps({"type": data["event_type"], "data": data["payload"]}))
                            except Exception as e:
                                logger.error(f"Failed to push message to local ws {session_id}: {e}")
                                self.disconnect(session_id)
        except Exception as e:
            logger.error(f"Redis pub/sub listener error: {e}")
        except asyncio.CancelledError:
            pass

    async def stop_pubsub(self):
        """Stops the Redis pub/sub listener."""
        if self._listener_task:
            self._listener_task.cancel()
        if self.redis_available:
            try:
                await self.pubsub.unsubscribe(self.channel_name)
                await self.pubsub.close()
                await self.redis.close()
            except Exception:
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
        """Publish a typed JSON event to a specific session via Redis (or local if unavailable)."""
        if not self.redis_available:
            if session_id in self._connections:
                ws = self._connections[session_id]
                try:
                    await ws.send_text(json.dumps({"type": event_type, "data": payload}))
                except Exception as e:
                    logger.error(f"Failed to push message locally {session_id}: {e}")
                    self.disconnect(session_id)
            return True

        message = {
            "session_id": session_id,
            "event_type": event_type,
            "payload": payload
        }
        try:
            await self.redis.publish(self.channel_name, json.dumps(message))
        except Exception as e:
            logger.error(f"Redis publish failed: {e}")
            self.redis_available = False
        return True

    async def broadcast_to_user(
        self, email: str, event_type: str, payload: Dict[str, Any]
    ) -> None:
        """Publish an event to all sessions associated with a user email via Redis (or local if unavailable)."""
        if not self.redis_available:
            for local_session_id, session_email in list(self._session_to_email.items()):
                if session_email == email and local_session_id in self._connections:
                    ws = self._connections[local_session_id]
                    try:
                        await ws.send_text(json.dumps({"type": event_type, "data": payload}))
                    except Exception as e:
                        logger.error(f"Failed to push message locally {local_session_id}: {e}")
                        self.disconnect(local_session_id)
            return

        message = {
            "user_email": email,
            "event_type": event_type,
            "payload": payload
        }
        try:
            await self.redis.publish(self.channel_name, json.dumps(message))
        except Exception as e:
            logger.error(f"Redis broadcast failed: {e}")
            self.redis_available = False

# Global singleton
manager = ConnectionManager()
