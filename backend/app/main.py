import os
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base
from app.api import endpoints
from app.api.websocket import manager
from app.services.serial_service import serial_service

# Create Database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Marine Sentinel - Real-time AI Marine Monitoring"
)

@app.on_event("startup")
def startup_event():
    serial_service.start()

@app.on_event("shutdown")
def shutdown_event():
    serial_service.stop()

# Enable CORS for frontend dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev environment, open to all. Restrict in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Directories to serve uploaded files (raw & annotated images)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount API endpoints
app.include_router(endpoints.router, prefix="/api")

# WebSocket Route for frontend dashboard updates
@app.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Keep connection open and listen for client pings/messages
        while True:
            data = await websocket.receive_text()
            # If dashboard sends action commands over WebSocket, parse them
            try:
                msg = json.loads(data)
                if msg.get("type") == "CMD":
                    action = msg.get("action")
                    if action in ["FWD", "REV", "LEFT", "RIGHT", "STOP"]:
                        manager.queue_command(f"CMD:{action}")
                        serial_service.send_motor_command(action)
                        await websocket.send_json({"type": "CMD_ACK", "status": "queued", "command": f"CMD:{action}"})
            except Exception:
                # If message is not JSON, ignore or treat as plain text ping
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Marine Sentinel Monitoring System API Backend"}
