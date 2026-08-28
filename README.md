# Marine Sentinel (Pollution & Debris Monitoring Node)

Marine Sentinel is a low-cost, AI-powered marine monitoring system designed to detect marine pollution, floating debris (plastic bottles, cans, cups), and oil spills on the ocean surface.

The system uses a two-tier hardware controller structure:
1.  **Arduino Uno/Nano** (Main Controller): Manages environmental sensors (Turbidity, pH, Temperature), GPS navigation (NEO-6M), collision detection (MPU6050 and IR sensors), and displays status on a 1602 LCD.
2.  **ESP32 Dev Module + OV7670 Camera**: Handles frame acquisition and streams JPEG images over Serial.
3.  **FastAPI Backend & React Dashboard**: Receives telemetry and video streams, executes real-time YOLOv8 edge AI inference, logs data to an SQLite database, and broadcasts updates over WebSockets to a React Leaflet dashboard.

---

## Repository Structure

```text
├── backend/                   # FastAPI Web server, SQLite log, and YOLOv8 pipeline
│   ├── app/                   # Database models, schemas, and serial processing threads
│   │   ├── ai/                # YOLOv8 target detectors
│   │   ├── services/          # Dual Serial readers (Arduino + ESP32)
│   │   └── config.py          # Configurable warnings & status thresholds
│   ├── simulate_node.py       # Emulates boat movement, sensors, and camera packets
│   └── requirements.txt       # Python backend dependencies
├── frontend/                  # React + Vite web dashboard application
│   ├── src/                   # React components (Leaflet maps, charts, gauges)
│   └── package.json           # Frontend Node modules configuration
├── hardware/                  # Physical firmware code
│   ├── arduino_main/          # Main controller firmware (GPS, MPU6050, LCD, LEDs)
│   └── esp32_ov7670/          # ESP32 parallel frame grabber and packets stream
└── .gitignore                 # Excludes virtual environments and node_modules
```

---

## 1. Setup Guide (New Laptop Deploy)

### Prerequisites
*   Python 3.10+ installed.
*   Node.js (v18+) and npm installed.

### Step 1: Clone the Repository
```bash
git clone https://github.com/Buvanesh12-tech/Marine.git
cd Marine
```

### Step 2: Configure the Backend Environment
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create a Python virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install --upgrade pip
    pip install -r requirements.txt
    ```
4.  Configure the environment settings:
    Copy `.env.example` to `.env` and set parameters:
    ```bash
    cp .env.example .env
    ```
    *(If running without physical hardware, leave `SERIAL_ARDUINO_PORT` and `SERIAL_ESP32_PORT` blank to run in simulated fallback demo mode.)*

### Step 3: Configure the Frontend Environment
1.  Navigate to the frontend directory:
    ```bash
    cd ../frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Set up local API addresses:
    Copy `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```

---

## 2. Running the Application

### A. Run in Simulation / Fallback Mode (No Hardware Connected)
If you do not have the physical Arduino/ESP32 hardware connected, you can run the complete system in demo mode:

1.  **Start the Backend**:
    From the `backend/` folder (with virtual environment activated):
    ```bash
    python3 -m uvicorn app.main:app --reload --port 5001
    ```
2.  **Start the Frontend**:
    From the `frontend/` folder:
    ```bash
    npm run dev
    ```
    Open **[http://localhost:3000](http://localhost:3000)** in your browser.
3.  **Run the Hardware Emulator**:
    In a separate terminal, run the simulator script to feed coordinates, turbidity anomalies, and test images:
    ```bash
    python3 backend/simulate_node.py
    ```

### B. Run in Production Mode (Physical Hardware Connected)
1.  Connect the Arduino and ESP32 Dev Module to your laptop via USB cables.
2.  Open your OS device list to find the port identifiers:
    *   **Windows**: Check Device Manager $\rightarrow$ Ports (e.g., `COM3`, `COM4`).
    *   **macOS / Linux**: Run `ls /dev/tty.*` or `ls /dev/ttyUSB*` (e.g., `/dev/ttyUSB0`).
3.  Update the `backend/.env` file with these values:
    ```env
    SERIAL_ARDUINO_PORT=COM3
    SERIAL_ESP32_PORT=COM4
    ```
4.  Start the FastAPI backend. It will connect to the physical serial buses, parse live GPS packets, execute YOLOv8 on frames, and write data directly to the SQLite database.

---

## 3. Troubleshooting

### Port 5001 Already in Use
*   **Cause**: Another server is running on the backend port.
*   **Solution**: Stop the competing process or specify a different port when starting uvicorn:
    ```bash
    python3 -m uvicorn app.main:app --reload --port 5002
    ```
    *(Remember to update `VITE_BACKEND_HTTP` and `VITE_BACKEND_WS` in `frontend/.env` to point to port 5002).*

### Serial Port Unavailable
*   **Cause**: Insufficient permissions or incorrect port configured.
*   **Solution (Linux/macOS)**: Grant write access to the port file:
    ```bash
    sudo chmod 666 /dev/ttyUSB0
    ```
    Verify the port name matches what is written in the backend `.env`.

### GPS Status: NO FIX
*   **Cause**: Indoor testing blocks GPS satellite signals.
*   **Solution**: Place the NEO-6M antenna outside or near a window. The red LED on the GPS module should start blinking at 1Hz once a sat-fix is established.

### Frontend Cannot Connect to Backend
*   **Cause**: The backend is running on a different address/port than what is configured in Vite environment variables.
*   **Solution**: Check your `frontend/.env` file. Ensure `VITE_BACKEND_HTTP` matches the FastAPI server address.
