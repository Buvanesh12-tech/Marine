from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

class GPSDataSchema(BaseModel):
    lat: float = 0.0
    lng: float = 0.0
    spd: float = 0.0

class GyroDataSchema(BaseModel):
    ax: float = 0.0
    ay: float = 0.0
    az: float = 0.0
    gx: float = 0.0
    gy: float = 0.0
    gz: float = 0.0

class TelemetryPayload(BaseModel):
    gps: GPSDataSchema
    turb: int
    ph: float = 7.0
    temp: float = 25.0
    gyro: GyroDataSchema
    ir: List[int] = Field(default_factory=lambda: [0, 0, 0])
    status: str = "SAFE"

class TelemetryResponse(BaseModel):
    id: int
    timestamp: datetime
    latitude: float
    longitude: float
    speed: float
    turbidity: int
    ph_level: float
    temperature: float
    gyro_data: Dict[str, float]
    ir_sensors: List[int]
    status: str
    raw_image_path: Optional[str] = None
    annotated_image_path: Optional[str] = None
    detections: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True

class AlertResponse(BaseModel):
    id: int
    timestamp: datetime
    alert_type: str
    severity: str
    latitude: float
    longitude: float
    description: str
    image_path: Optional[str] = None

    class Config:
        from_attributes = True
