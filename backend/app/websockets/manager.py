import json
import logging
import asyncio
from typing import Any, Dict, Optional

import redis.asyncio as redis
from fastapi import WebSocket

from app.config import settings

logger = logging.getLogger(__name__)

CHANNEL = "sa:ws:events"
SESSION_TTL = 60 * 60  # 1 hour, refreshed on activity


class ConnectionManager:
    """Manages local WebSocket connections; relays cross-instance events via Redis pub/sub."""

    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}
        self._redis: Optional[redis.Redis] = None
        self._pubsub_task: Optional[asyncio.Task] = None

    async def start_pubsub(self):
        try:
            self._redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
            pubsub = self._redis.pubsub()
            await pubsub.subscribe(CHANNEL)
            self._pubsub_task = asyncio.create_task(self._listen(pubsub))
            logger.info("Subscribed to Redis pub/sub for WebSocket relay.")
        except Exception as e:
            logger.warning(f"Redis pub/sub connection failed ({e}). Falling back to local in-memory relay.")
            self._redis = None

    async def stop_pubsub(self):
        if self._pubsub_task:
            self._pubsub_task.cancel()
        if self._redis:
            try:
                await self._redis.close()
            except Exception:
                pass

    async def _listen(self, pubsub):
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                envelope = json.loads(message["data"])
                session_id = envelope.get("session_id")
                if session_id and session_id in self._connections:
                    await self._send_local(session_id, envelope["type"], envelope["data"])
            except Exception as e:
                logger.error(f"Failed to process pub/sub message: {e}")

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[session_id] = websocket
        await self.send_event(session_id, "connected", {"session_id": session_id})

    async def disconnect(self, session_id: str) -> None:
        self._connections.pop(session_id, None)
        if self._redis:
            try:
                # best-effort cleanup of any user->session set this session was added to
                async for key in self._redis.scan_iter("sa:ws:sessions:*"):
                    await self._redis.srem(key, session_id)
            except Exception as e:
                logger.warning(f"Failed Redis cleanup on disconnect: {e}")

    async def associate_email(self, session_id: str, email: str) -> None:
        if self._redis:
            try:
                key = f"sa:ws:sessions:{email}"
                await self._redis.sadd(key, session_id)
                await self._redis.expire(key, SESSION_TTL)
            except Exception as e:
                logger.warning(f"Failed Redis associate_email: {e}")

    async def _send_local(self, session_id: str, event_type: str, payload: Dict[str, Any]):
        ws = self._connections.get(session_id)
        if not ws:
            return
        try:
            await ws.send_text(json.dumps({"type": event_type, "data": payload}))
        except Exception as e:
            logger.error(f"Failed to push message locally {session_id}: {e}")
            await self.disconnect(session_id)

    async def send_event(self, session_id: str, event_type: str, payload: Dict[str, Any]) -> bool:
        """Publish an event. Every instance receives it; only the one holding the session delivers it."""
        if not self._redis:
            # Fallback if pubsub isn't started
            await self._send_local(session_id, event_type, payload)
            return True
        try:
            envelope = json.dumps({"session_id": session_id, "type": event_type, "data": payload})
            await self._redis.publish(CHANNEL, envelope)
            return True
        except Exception as e:
            logger.warning(f"Redis publish failed ({e}). Falling back to local send.")
            await self._send_local(session_id, event_type, payload)
            return True

    async def broadcast_to_user(self, email: str, event_type: str, payload: Dict[str, Any]) -> None:
        if not self._redis:
            return
        try:
            session_ids = await self._redis.smembers(f"sa:ws:sessions:{email}")
            for session_id in session_ids:
                await self.send_event(session_id, event_type, payload)
        except Exception as e:
            logger.warning(f"Failed Redis broadcast_to_user: {e}")


manager = ConnectionManager()
