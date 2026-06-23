"""
WebSocket connection manager for real-time push notifications to the dashboard.
"""

from typing import Dict, List
from fastapi import WebSocket
import json
import structlog

logger = structlog.get_logger()


class ConnectionManager:
    def __init__(self):
        # user_id -> list of active WebSocket connections
        self._connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self._connections.setdefault(user_id, []).append(websocket)
        logger.info("WS connected", user_id=user_id, total=len(self._connections[user_id]))

    def disconnect(self, websocket: WebSocket, user_id: int):
        conns = self._connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, event: str, data: dict):
        """Push a JSON event to all connections for a user."""
        conns = self._connections.get(user_id, [])
        dead = []
        payload = json.dumps({"event": event, "data": data})
        for ws in conns:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def broadcast(self, event: str, data: dict):
        """Push to every connected user."""
        for user_id in list(self._connections.keys()):
            await self.send_to_user(user_id, event, data)


ws_manager = ConnectionManager()
