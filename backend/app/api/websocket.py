from fastapi import WebSocket
from typing import List

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.latest_command = "CMD:STOP"

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"New client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"Client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Failed to send message: {e}")
                # We don't remove during iteration to avoid modifying the list size
                pass

    def queue_command(self, cmd: str):
        self.latest_command = cmd
        print(f"Queued command: {cmd}")

    def consume_command(self) -> str:
        cmd = self.latest_command
        # Optional: reset command to STOP after consumption, or keep repeating it
        # Let's reset it to STOP so the boat doesn't keep running forever on a single tap
        self.latest_command = "CMD:STOP"
        return cmd

manager = ConnectionManager()
