from sqlalchemy import Column, Integer, Float, String, DateTime, JSON
from datetime import datetime
from app.database import Base

class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # GPS data
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    speed = Column(Float, default=0.0)
    
    # Turbidity sensor
    turbidity = Column(Integer, default=0)
    ph_level = Column(Float, default=7.0)
    temperature = Column(Float, default=25.0)
    
    # MPU6050 Accelerometer / Gyroscope (ax, ay, az, gx, gy, gz)
    gyro_data = Column(JSON, nullable=True)
    
    # IR proximity sensors status (left, center, right)
    ir_sensors = Column(JSON, nullable=True)
    
    # System severity status (SAFE, WARNING, CRITICAL)
    status = Column(String, default="SAFE")
    
    # Image references
    raw_image_path = Column(String, nullable=True)
    annotated_image_path = Column(String, nullable=True)
    detections = Column(JSON, nullable=True)


class AlertLog(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    alert_type = Column(String, index=True) # OIL_SPILL, DEBRIS, TURBIDITY, OBSTACLE
    severity = Column(String, default="WARNING") # WARNING (Yellow), CRITICAL (Red)
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    description = Column(String, nullable=True)
    image_path = Column(String, nullable=True)
