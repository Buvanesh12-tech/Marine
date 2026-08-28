import os
import json
import uuid
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.config import settings
from app.ai.detector import detector
from app.api.websocket import manager
from app.services.serial_service import serial_service

router = APIRouter()

@router.post("/upload")
async def upload_telemetry_and_image(
    image: UploadFile = File(...),
    telemetry: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        # 1. Parse JSON telemetry payload
        telemetry_dict = json.loads(telemetry)
        payload = schemas.TelemetryPayload(**telemetry_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid telemetry JSON: {e}")

    # 2. Save incoming raw image
    img_uuid = uuid.uuid4().hex
    raw_filename = f"{img_uuid}_raw.jpg"
    raw_path = os.path.join(settings.UPLOAD_DIR, raw_filename)
    
    with open(raw_path, "wb") as buffer:
        content = await image.read()
        buffer.write(content)

    # 3. Process AI detection
    annotated_filename = f"{img_uuid}_annotated.jpg"
    annotated_path = os.path.join(settings.ANNOTATED_DIR, annotated_filename)
    
    detection_results = detector.detect(raw_path, annotated_path)
    
    # 4. Determine final system status (Combine hardware status and AI severity)
    # If AI detects CRITICAL (Oil spill), override hardware state to CRITICAL
    final_status = payload.status
    if detection_results["highest_severity"] == "CRITICAL" or payload.status == "CRITICAL":
        final_status = "CRITICAL"
    elif detection_results["highest_severity"] == "WARNING" or payload.status == "WARNING":
        final_status = "WARNING"

    # 5. Insert Telemetry into database
    db_telemetry = models.Telemetry(
        latitude=payload.gps.lat,
        longitude=payload.gps.lng,
        speed=payload.gps.spd,
        turbidity=payload.turb,
        gyro_data=payload.gyro.model_dump(),
        ir_sensors=payload.ir,
        status=final_status,
        raw_image_path=f"/static/uploads/{raw_filename}",
        annotated_image_path=f"/static/annotated/{annotated_filename}",
        detections=detection_results["detections"]
    )
    db.add(db_telemetry)
    db.commit()
    db.refresh(db_telemetry)

    # Sync memory cache of serial service to avoid default fallbacks
    serial_service.latest_telemetry = telemetry_dict
    serial_service.status["gps_status"] = "CONNECTED" if payload.gps.lat != 0.0 else "NO_FIX"
    if payload.gyro:
        serial_service.status["mpu_status"] = "CONNECTED"

    # 6. Generate AlertLogs if necessary
    alert_triggered = False
    alert_log_entry = None
    
    if final_status != "SAFE":
        desc = ""
        alert_type = "GENERAL"
        
        # Determine specific alert cause
        if detection_results["has_oil"]:
            alert_type = "OIL_SPILL"
            desc = "AI Oil Spill detected on water surface!"
        elif detection_results["has_debris"]:
            alert_type = "DEBRIS"
            desc = f"AI Debris detected: {', '.join([d['label'] for d in detection_results['detections']])}"
        elif payload.turb > 600:
            alert_type = "TURBIDITY"
            desc = f"Critical water turbidity level measured: {payload.turb} NTU"
        elif any(payload.ir):
            alert_type = "OBSTACLE"
            desc = f"Proximity collision alert! IR trigger: {payload.ir}"

        db_alert = models.AlertLog(
            alert_type=alert_type,
            severity=final_status,
            latitude=payload.gps.lat,
            longitude=payload.gps.lng,
            description=desc,
            image_path=f"/static/annotated/{annotated_filename}"
        )
        db.add(db_alert)
        db.commit()
        db.refresh(db_alert)
        alert_triggered = True
        alert_log_entry = {
            "id": db_alert.id,
            "timestamp": db_alert.timestamp.isoformat(),
            "alert_type": db_alert.alert_type,
            "severity": db_alert.severity,
            "latitude": db_alert.latitude,
            "longitude": db_alert.longitude,
            "description": db_alert.description,
            "image_path": db_alert.image_path
        }

    # 7. Broadcast update to web clients over WebSockets
    ws_payload = {
        "type": "TELEMETRY_UPDATE",
        "data": {
            "id": db_telemetry.id,
            "timestamp": db_telemetry.timestamp.isoformat(),
            "gps": {
                "lat": db_telemetry.latitude,
                "lng": db_telemetry.longitude,
                "spd": db_telemetry.speed
            },
            "turb": db_telemetry.turbidity,
            "gyro": db_telemetry.gyro_data,
            "ir": db_telemetry.ir_sensors,
            "status": db_telemetry.status,
            "raw_image_url": db_telemetry.raw_image_path,
            "annotated_image_url": db_telemetry.annotated_image_path,
            "detections": detection_results["detections"]
        },
        "alert": alert_log_entry if alert_triggered else None
    }
    
    await manager.broadcast(ws_payload)

    # 8. Return the pending command for reference
    pending_cmd = manager.consume_command()
    return {"status": "success", "command": pending_cmd}


@router.get("/history/telemetry", response_model=list[schemas.TelemetryResponse])
def get_telemetry_history(limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(models.Telemetry).order_by(models.Telemetry.timestamp.desc()).limit(limit).all()
    # Reverse to return chronological order
    logs.reverse()
    return logs


@router.get("/history/alerts", response_model=list[schemas.AlertResponse])
def get_alerts_history(limit: int = 50, db: Session = Depends(get_db)):
    return db.query(models.AlertLog).order_by(models.AlertLog.timestamp.desc()).limit(limit).all()


@router.post("/control")
def send_control_command(payload: dict):
    # Payload shape: {"action": "FWD" | "REV" | "LEFT" | "RIGHT" | "STOP"}
    action = payload.get("action")
    if action not in ["FWD", "REV", "LEFT", "RIGHT", "STOP"]:
        raise HTTPException(status_code=400, detail="Invalid action command")
        
    cmd_string = f"CMD:{action}"
    manager.queue_command(cmd_string)
    serial_service.send_motor_command(action)
    return {"status": "success", "queued": cmd_string}
