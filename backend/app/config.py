import os

class Settings:
    PROJECT_NAME: str = "Marine Sentinel Backend"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./marine_sentinel.db")
    
    # Storage Paths
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "static/uploads")
    ANNOTATED_DIR: str = os.getenv("ANNOTATED_DIR", "static/annotated")
    
    # YOLO Model Configuration
    YOLO_MODEL_PATH: str = os.getenv(
        "YOLO_MODEL_PATH", 
        os.path.join(
            os.path.dirname(os.path.abspath(__file__)), 
            "ai", 
            "models", 
            "yolov8n.pt"
        )
    )
    # Environmental sensor threshold levels
    TURBIDITY_WARNING_THRESHOLD: int = int(os.getenv("TURBIDITY_WARNING_THRESHOLD", 400))
    TURBIDITY_CRITICAL_THRESHOLD: int = int(os.getenv("TURBIDITY_CRITICAL_THRESHOLD", 600))
    PH_MIN_THRESHOLD: float = float(os.getenv("PH_MIN_THRESHOLD", 6.5))
    PH_MAX_THRESHOLD: float = float(os.getenv("PH_MAX_THRESHOLD", 8.5))

settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.ANNOTATED_DIR, exist_ok=True)
os.makedirs(os.path.dirname(settings.YOLO_MODEL_PATH), exist_ok=True)
