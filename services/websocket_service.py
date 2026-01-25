import json
from typing import Dict, Any
from fastapi import WebSocket
from utils.logger import get_logger
from datetime import datetime

logger = get_logger(__name__)

class WebsocketService:
    def __init__(self):
        # { key: session_id : val: websocket }
        self.active_connections: Dict[str, WebSocket] = {}

    # connect
    async def connect_websocket(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        logger.info(f"WebSocket connected for task {session_id}")
    
    # disconnect
    async def disconnect_websocket(self, session_id: str):
        websocket = self.active_connections.get(session_id)
        if websocket:
            try:
                await websocket.close()
                logger.debug(f"WebSocket closed for task {session_id}")
            except Exception as e:
                logger.warning(f"Error closing WebSocket for task {session_id}: {e}")
            
            # Remove from active connections after closing
            self.active_connections.pop(session_id, None)
        
        logger.info(f"WebSocket disconnected for task {session_id}")

    # send message to a specific websocket connection
    async def send_message(self, session_id: str, message: Dict[str, Any]):
        websocket = self.active_connections.get(session_id)
        if websocket:
            try:
                # Always ensure timestamp is present and valid
                message["timestamp"] = datetime.now().isoformat()
                
                # Ensure session_id is always present
                if "session_id" not in message:
                    message["session_id"] = session_id
                
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send message to {session_id}: {e}")
                # If we can't send, the connection is likely closed - remove it
                self.active_connections.pop(session_id, None)
                logger.debug(f"Removed disconnected WebSocket for task {session_id}")
    
    # send error messages
    async def send_error(self, session_id: str, error: str, context: str = None):
        """Send a standardized error message"""
        message = {
            "type": "task.error",
            "error": error
        }
        if context:
            message["context"] = context
        
        await self.send_message(session_id, message)

websocket_service = WebsocketService()
