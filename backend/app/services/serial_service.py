import os
import time
import json
import uuid
import threading
import random
from typing import Dict, Any, Optional
from app.config import settings
from app import models, schemas
from app.database import SessionLocal
from app.ai.detector import detector
from app.api.websocket import manager

# Import serial if available, otherwise catch import error gracefully
try:
    import serial
except ImportError:
    serial = None

class SerialHardwareService:
    def __init__(self):
        # Configuration (can be overridden via env variables)
        self.arduino_port = os.getenv("SERIAL_ARDUINO_PORT", "")  # e.g., "COM3", "/dev/ttyUSB0"
        self.esp32_port = os.getenv("SERIAL_ESP32_PORT", "")      # e.g., "COM4", "/dev/ttyUSB1"
        self.arduino_baud = int(os.getenv("SERIAL_ARDUINO_BAUD", 115200))
        self.esp32_baud = int(os.getenv("SERIAL_ESP32_BAUD", 115200))

        # Status indicators
        self.status = {
            "arduino_connected": False,
            "esp32_connected": False,
            "gps_status": "DISCONNECTED",    # DISCONNECTED, NO_FIX, CONNECTED
            "mpu_status": "DISCONNECTED",    # DISCONNECTED, ERROR, CONNECTED
            "camera_status": "DISCONNECTED"  # DISCONNECTED, ERROR, CONNECTED
        }

        # Latest state storage
        self.latest_telemetry: Dict[str, Any] = {}
        self.latest_image_path: Optional[str] = None
        self.latest_annotated_path: Optional[str] = None

        self.running = False
        self.arduino_thread: Optional[threading.Thread] = None
        self.esp32_thread: Optional[threading.Thread] = None

    def start(self):
        self.running = True
        
        # Start Arduino reader
        self.arduino_thread = threading.Thread(target=self._arduino_loop, daemon=True)
        self.arduino_thread.start()

        # Start ESP32 reader
        self.esp32_thread = threading.Thread(target=self._esp32_loop, daemon=True)
        self.esp32_thread.start()
        
        print("Serial Hardware Service started.")

    def stop(self):
        self.running = False
        print("Serial Hardware Service stopped.")

    def send_motor_command(self, action: str) -> bool:
        """
        Sends direction overrides back to the Arduino main controller via Serial.
        """
        if not self.status["arduino_connected"] or not self.arduino_port:
            print("Cannot send command: Arduino is not connected via Serial.")
            return False
        
        try:
            ser = serial.Serial(self.arduino_port, self.arduino_baud, timeout=1)
            ser.write(f"CMD:{action}\n".encode("utf-8"))
            ser.close()
            print(f"Sent control CMD:{action} directly to Arduino.")
            return True
        except Exception as e:
            print(f"Failed to transmit direct Arduino serial command: {e}")
            return False

    def _arduino_loop(self):
        """Background thread to read sensors data from Arduino."""
        while self.running:
            if not self.arduino_port or serial is None:
                # If no port configured, run simulator updates for demo
                self._simulate_arduino_data()
                time.sleep(3)
                continue

            try:
                print(f"Attempting to connect to Arduino on {self.arduino_port}...")
                ser = serial.Serial(self.arduino_port, self.arduino_baud, timeout=2)
                self.status["arduino_connected"] = True
                self.status["mpu_status"] = "CONNECTED"
                print(f"Connected to Arduino on {self.arduino_port}")
                
                while self.running:
                    line = ser.readline().decode("utf-8", errors="ignore").strip()
                    if not line:
                        continue
                    
                    try:
                        # Process telemetry packet
                        data = json.loads(line)
                        self._process_telemetry_packet(data)
                    except json.JSONDecodeError:
                        # Ignore malformed serial lines
                        pass
                    
            except Exception as e:
                print(f"Arduino Serial Error: {e}. Reconnecting in 5s...")
                self.status["arduino_connected"] = False
                self.status["gps_status"] = "DISCONNECTED"
                self.status["mpu_status"] = "DISCONNECTED"
                self._broadcast_status_update()
                time.sleep(5)

    def _esp32_loop(self):
        """Background thread to read camera frames from ESP32 Dev Module + OV7670."""
        while self.running:
            if not self.esp32_port or serial is None:
                # Run simulator camera frame updates for demo if no port
                self._simulate_camera_data()
                time.sleep(5)
                continue

            try:
                print(f"Attempting to connect to ESP32 Dev Module on {self.esp32_port}...")
                ser = serial.Serial(self.esp32_port, self.esp32_baud, timeout=5)
                self.status["esp32_connected"] = True
                self.status["camera_status"] = "CONNECTED"
                print(f"Connected to ESP32 Dev Module on {self.esp32_port}")

                while self.running:
                    # Look for frame header marker
                    if ser.read(1) != b'*':
                        continue
                    if ser.read(6) != b'FRAME*':
                        continue
                    
                    # Read 4-byte payload size (big-endian)
                    len_bytes = ser.read(4)
                    if len(len_bytes) < 4:
                        continue
                    frame_len = (len_bytes[0] << 24) | (len_bytes[1] << 16) | (len_bytes[2] << 8) | len_bytes[3]
                    
                    # Read frame binary content
                    frame_data = ser.read(frame_len)
                    if len(frame_data) < frame_len:
                        print("Warning: Incomplete camera frame read.")
                        self.status["camera_status"] = "ERROR"
                        self._broadcast_status_update()
                        continue
                    
                    # Verify footer marker
                    footer = ser.read(5)
                    if footer != b'*END*':
                        print("Warning: Missing frame end delimiter.")
                        continue
                    
                    # Valid JPEG acquired
                    self.status["camera_status"] = "CONNECTED"
                    self._process_image_frame(frame_data)
                    
            except Exception as e:
                print(f"ESP32 Serial Error: {e}. Reconnecting in 5s...")
                self.status["esp32_connected"] = False
                self.status["camera_status"] = "DISCONNECTED"
                self._broadcast_status_update()
                time.sleep(5)

    def _process_telemetry_packet(self, data: dict):
        """Validates, logs, and broadcasts telemetry packet from Arduino."""
        try:
            # 1. Parse GPS Status
            gps_data = data.get("gps", {})
            if gps_data.get("lat") == 0.0 and gps_data.get("lng") == 0.0:
                self.status["gps_status"] = "NO_FIX"
            else:
                self.status["gps_status"] = "CONNECTED"

            # Cache the latest telemetry packet in memory
            self.latest_telemetry = data

            # If camera is OFFLINE, we immediately commit the telemetry packet to the database,
            # since the image frame loop won't be writing combined entries.
            if self.status["camera_status"] != "CONNECTED":
                lat = gps_data.get("lat", 0.0)
                lng = gps_data.get("lng", 0.0)
                spd = gps_data.get("spd", 0.0)
                turb = data.get("turb", 150)
                ph = data.get("ph", 7.0)
                temp = data.get("temp", 25.0)
                gyro = data.get("gyro", {})
                ir = data.get("ir", [0, 0, 0])
                status = data.get("status", "SAFE")

                db = SessionLocal()
                db_telemetry = models.Telemetry(
                    latitude=lat,
                    longitude=lng,
                    speed=spd,
                    turbidity=turb,
                    ph_level=ph,
                    temperature=temp,
                    gyro_data=gyro,
                    ir_sensors=ir,
                    status=status,
                    raw_image_path=None,
                    annotated_image_path=None,
                    detections=None
                )
                db.add(db_telemetry)
                db.commit()
                db.refresh(db_telemetry)
                
                # Check for critical status conditions to log alerts
                alert_log_entry = None
                if status != "SAFE":
                    alert_type = "GENERAL"
                    desc = "Telemetry anomaly event"
                    if turb > settings.TURBIDITY_CRITICAL_THRESHOLD:
                        alert_type = "TURBIDITY"
                        desc = f"Water Turbidity Critical: {turb} NTU"
                    elif any(ir):
                        alert_type = "OBSTACLE"
                        desc = f"Collision Warning! IR Sensors triggered: {ir}"

                    db_alert = models.AlertLog(
                        alert_type=alert_type,
                        severity=status,
                        latitude=lat,
                        longitude=lng,
                        description=desc,
                        image_path=None
                    )
                    db.add(db_alert)
                    db.commit()
                    db.refresh(db_alert)
                    alert_log_entry = {
                        "id": db_alert.id,
                        "timestamp": db_alert.timestamp.isoformat(),
                        "alert_type": db_alert.alert_type,
                        "severity": db_alert.severity,
                        "latitude": db_alert.latitude,
                        "longitude": db_alert.longitude,
                        "description": db_alert.description,
                        "image_path": None
                    }
                db.close()

                # Broadcast telemetry-only update
                ws_payload = {
                    "type": "TELEMETRY_UPDATE",
                    "data": {
                        "id": db_telemetry.id,
                        "timestamp": db_telemetry.timestamp.isoformat(),
                        "gps": {"lat": lat, "lng": lng, "spd": spd},
                        "turb": turb,
                        "ph": ph,
                        "temp": temp,
                        "gyro": gyro,
                        "ir": ir,
                        "status": status,
                        "raw_image_url": None,
                        "annotated_image_url": None,
                        "detections": []
                    },
                    "status_indicators": self.status,
                    "alert": alert_log_entry
                }
                threading.Thread(target=self._async_broadcast, args=(ws_payload,), daemon=True).start()

        except Exception as e:
            print(f"Error processing Arduino telemetry payload: {e}")

    def _process_image_frame(self, frame_bytes: bytes):
        """Processes and runs AI model inference on JPEG image payload from ESP32."""
        try:
            img_uuid = uuid.uuid4().hex
            raw_filename = f"{img_uuid}_raw.jpg"
            raw_path = os.path.join(settings.UPLOAD_DIR, raw_filename)
            
            with open(raw_path, "wb") as f:
                f.write(frame_bytes)

            annotated_filename = f"{img_uuid}_annotated.jpg"
            annotated_path = os.path.join(settings.ANNOTATED_DIR, annotated_filename)

            # Run YOLOv8 detection
            detection_results = detector.detect(raw_path, annotated_path)

            self.latest_image_path = f"/static/uploads/{raw_filename}"
            self.latest_annotated_path = f"/static/annotated/{annotated_filename}"

            # Retrieve latest Arduino telemetry details from memory, database, or Marine Sentinel hardware fallbacks
            t_data = self.latest_telemetry
            gps_data = t_data.get("gps", {}) if isinstance(t_data, dict) else {}
            lat = gps_data.get("lat") if gps_data else (t_data.latitude if hasattr(t_data, 'latitude') else (t_data.get("latitude") if isinstance(t_data, dict) else None))
            lng = gps_data.get("lng") if gps_data else (t_data.longitude if hasattr(t_data, 'longitude') else (t_data.get("longitude") if isinstance(t_data, dict) else None))
            
            # Try DB fallback if GPS coordinates are missing
            if lat is None or lng is None or lat == 0.0 or lng == 0.0:
                db_session = SessionLocal()
                try:
                    last_db = db_session.query(models.Telemetry).filter(models.Telemetry.latitude != 0.0).order_by(models.Telemetry.id.desc()).first()
                    if last_db:
                        lat = last_db.latitude
                        lng = last_db.longitude
                except Exception as db_err:
                    print(f"Database query error in serial_service GPS resolution: {db_err}")
                finally:
                    db_session.close()

            # Hardware default coordinates instead of Bengaluru
            if lat is None or lng is None or lat == 0.0 or lng == 0.0:
                lat = 13.024397
                lng = 80.017257

            spd = gps_data.get("spd", 0.0) if gps_data else (t_data.speed if hasattr(t_data, 'speed') else (t_data.get("speed", 0.0) if isinstance(t_data, dict) else 0.0))
            turb = t_data.get("turb", 150) if isinstance(t_data, dict) else (t_data.turbidity if hasattr(t_data, 'turbidity') else 150)
            ph = t_data.get("ph", 7.0) if t_data else 7.0
            temp = t_data.get("temp", 25.0) if t_data else 25.0
            gyro = t_data.get("gyro", {}) if t_data else {}
            ir = t_data.get("ir", [0, 0, 0]) if t_data else [0, 0, 0]

            # Merge System Severity Status (Arduino Hardware state + AI Vision detections)
            telemetry_status = t_data.get("status", "SAFE") if t_data else "SAFE"
            ai_status = detection_results["highest_severity"]

            final_status = "SAFE"
            if telemetry_status == "CRITICAL" or ai_status == "CRITICAL":
                final_status = "CRITICAL"
            elif telemetry_status == "WARNING" or ai_status == "WARNING":
                final_status = "WARNING"

            # Create combined database record in Telemetry table
            db = SessionLocal()
            try:
                db_telemetry = models.Telemetry(
                    latitude=lat,
                    longitude=lng,
                    speed=spd,
                    turbidity=turb,
                    ph_level=ph,
                    temperature=temp,
                    gyro_data=gyro,
                    ir_sensors=ir,
                    status=final_status,
                    raw_image_path=self.latest_image_path,
                    annotated_image_path=self.latest_annotated_path,
                    detections=detection_results["detections"]
                )
                db.add(db_telemetry)
                db.commit()
                db.refresh(db_telemetry)

                # Generate AlertLog entry if warnings/anomalies detected
                alert_log_entry = None
                if final_status != "SAFE":
                    alert_type = "GENERAL"
                    desc = "Anomaly detected on sentinel platform."
                    
                    if detection_results["has_oil"]:
                        alert_type = "OIL_SPILL"
                        desc = "AI Oil Spill detected on water surface!"
                    elif detection_results["has_debris"]:
                        alert_type = "DEBRIS"
                        desc = f"AI Debris detected: {', '.join([d['label'] for d in detection_results['detections']])}"
                    elif turb > settings.TURBIDITY_CRITICAL_THRESHOLD:
                        alert_type = "TURBIDITY"
                        desc = f"Water Turbidity Critical: {turb} NTU"
                    elif ph < settings.PH_MIN_THRESHOLD or ph > settings.PH_MAX_THRESHOLD:
                        alert_type = "PH_LEVEL"
                        desc = f"Critical Water pH Level detected: {ph} pH"
                    elif any(ir):
                        alert_type = "OBSTACLE"
                        desc = f"Proximity warning indicator triggered: {ir}"

                    db_alert = models.AlertLog(
                        alert_type=alert_type,
                        severity=final_status,
                        latitude=lat,
                        longitude=lng,
                        description=desc,
                        image_path=self.latest_annotated_path
                    )
                    db.add(db_alert)
                    db.commit()
                    db.refresh(db_alert)
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

                # Broadcast combined telemetry and camera update over WebSockets
                ws_payload = {
                    "type": "TELEMETRY_UPDATE",
                    "data": {
                        "id": db_telemetry.id,
                        "timestamp": db_telemetry.timestamp.isoformat(),
                        "gps": {"lat": lat, "lng": lng, "spd": spd},
                        "turb": turb,
                        "ph": ph,
                        "temp": temp,
                        "gyro": gyro,
                        "ir": ir,
                        "status": final_status,
                        "raw_image_url": self.latest_image_path,
                        "annotated_image_url": self.latest_annotated_path,
                        "detections": detection_results["detections"]
                    },
                    "status_indicators": self.status,
                    "alert": alert_log_entry
                }
                threading.Thread(target=self._async_broadcast, args=(ws_payload,), daemon=True).start()
            finally:
                db.close()
        except Exception as e:
            print(f"Error processing acquired image frame: {e}")

    def _async_broadcast(self, payload: dict):
        # WebSocket operations require event loop context
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(manager.broadcast(payload))
        loop.close()

    def _broadcast_status_update(self):
        ws_payload = {
            "type": "STATUS_UPDATE",
            "status_indicators": self.status
        }
        threading.Thread(target=self._async_broadcast, args=(ws_payload,), daemon=True).start()

    # SIMULATION HELPERS (Graceful demo fallbacks)
    def _simulate_arduino_data(self):
        # Resolve latest real coordinates from memory or database to base simulation cruises on
        lat = None
        lng = None
        if self.latest_telemetry:
            gps_data = self.latest_telemetry.get("gps", {}) if isinstance(self.latest_telemetry, dict) else {}
            lat = gps_data.get("lat") if gps_data else (self.latest_telemetry.latitude if hasattr(self.latest_telemetry, 'latitude') else (self.latest_telemetry.get("latitude") if isinstance(self.latest_telemetry, dict) else None))
            lng = gps_data.get("lng") if gps_data else (self.latest_telemetry.longitude if hasattr(self.latest_telemetry, 'longitude') else (self.latest_telemetry.get("longitude") if isinstance(self.latest_telemetry, dict) else None))

        if lat is None or lng is None or lat == 0.0 or lng == 0.0:
            db_session = SessionLocal()
            try:
                last_db = db_session.query(models.Telemetry).filter(
                    models.Telemetry.latitude != 0.0,
                    models.Telemetry.latitude != 13.024397
                ).order_by(models.Telemetry.id.desc()).first()
                if last_db:
                    lat = last_db.latitude
                    lng = last_db.longitude
            except Exception as e:
                print(f"Error querying DB for latest coordinates in simulation: {e}")
            finally:
                db_session.close()

        if lat is not None and lng is not None and lat != 0.0 and lng != 0.0:
            self._sim_lat = lat
            self._sim_lng = lng
        else:
            if not hasattr(self, "_sim_lat"):
                self._sim_lat = 13.024397
                self._sim_lng = 80.017257

        # Slowly increment coordinates slightly to simulate cruising
        self._sim_lat += 0.00001
        self._sim_lng += 0.00001

        # Simulate sensor fluctuations
        turb = random.randint(130, 240)
        ph = round(random.uniform(7.1, 7.5), 2)
        temp = round(random.uniform(24.2, 25.8), 1)
        gyro = {
            "ax": round(random.uniform(-0.4, 0.4), 2),
            "ay": round(random.uniform(-0.3, 0.3), 2),
            "az": round(9.8 + random.uniform(-0.1, 0.1), 2),
            "gx": 0.0, "gy": 0.0, "gz": 0.0
        }
        ir = [0, 0, 0]
        status = "SAFE"

        # Inject simulated alert triggers rarely
        if random.random() < 0.1:
            turb = random.randint(450, 700)
            ph = round(random.uniform(6.0, 6.7), 2) # Acidic or Basic anomalies
            status = "WARNING" if turb < 600 else "CRITICAL"
        if random.random() < 0.05:
            ir = [0, 1, 0]
            status = "CRITICAL"

        payload = {
            "gps": {"lat": round(self._sim_lat, 6), "lng": round(self._sim_lng, 6), "spd": 5.4},
            "turb": turb,
            "ph": ph,
            "temp": temp,
            "gyro": gyro,
            "ir": ir,
            "status": status
        }
        
        # Keep connection status mock-active
        self.status["arduino_connected"] = False # Flagged false to show it's simulated, or True for connection emulation
        self.status["gps_status"] = "CONNECTED"
        self.status["mpu_status"] = "CONNECTED"
        
        self._process_telemetry_packet(payload)

    def _simulate_camera_data(self):
        import cv2
        import numpy as np

        # Create a cyan ocean block
        img = np.zeros((240, 320, 3), dtype=np.uint8)
        img[:] = [180, 120, 40]
        cv2.putText(img, "Simulated OV7670", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # Randomly draw a yellow float (plastic debris)
        if random.random() < 0.2:
            cv2.circle(img, (160, 120), 12, (0, 240, 240), -1)
            cv2.putText(img, "Debris", (150, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        _, buffer = cv2.imencode(".jpg", img)
        frame_bytes = buffer.tobytes()

        self.status["esp32_connected"] = False # Simulated tag
        self.status["camera_status"] = "CONNECTED"
        
        self._process_image_frame(frame_bytes)

# Create singleton service instance
serial_service = SerialHardwareService()
