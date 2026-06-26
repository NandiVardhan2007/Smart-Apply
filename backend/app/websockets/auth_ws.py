from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websockets.manager import manager

router = APIRouter()


@router.websocket("/ws/auth/{session_id}")
async def auth_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time auth events.

    The client connects with a unique session_id (UUID).
    The server pushes events like otp_sent, otp_verified,
    login_success, etc. when triggered by REST auth endpoints.
    """
    await manager.connect(session_id, websocket)
    try:
        # Keep connection alive — listen for client pings / close
        while True:
            data = await websocket.receive_text()
            # Client can send a heartbeat ping
            if data == "ping":
                await manager.send_event(session_id, "pong", {})
    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception:
        manager.disconnect(session_id)
