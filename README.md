# 🌊 Marine Sentinel
### AI-Powered Marine Pollution & Floating Debris Monitoring System

<p align="center">
  <strong>🚢 Detect • 📍 Locate • 🤖 Analyze • 🚨 Alert • 📊 Monitor</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AI-YOLOv8-blue?style=for-the-badge" alt="YOLOv8">
  <img src="https://img.shields.io/badge/Backend-FastAPI-green?style=for-the-badge" alt="FastAPI">
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge" alt="React">
  <img src="https://img.shields.io/badge/Hardware-Arduino%20%2B%20ESP32-orange?style=for-the-badge" alt="Hardware">
  <img src="https://img.shields.io/badge/Database-SQLite-lightgrey?style=for-the-badge" alt="SQLite">
</p>

<p align="center">
  <em>
    A low-cost intelligent marine monitoring node that combines environmental sensing,
    GPS tracking, collision detection, computer vision, and real-time AI analytics.
  </em>
</p>

---

## 🌊 What is Marine Sentinel?

**Marine Sentinel** is a low-cost, AI-powered marine monitoring system designed to help detect and monitor:

- 🧴 Floating plastic bottles
- 🥤 Cups and other floating waste
- 🥫 Cans and floating debris
- 🛢️ Possible oil-spill / surface pollution conditions
- 🌊 Abnormal water-quality conditions
- 🚢 Collision or obstacle events
- 📍 Real-time marine location

The system combines **embedded hardware + computer vision + GPS + environmental sensors + a web dashboard** into a single monitoring platform.

The goal is to create an affordable prototype that can eventually be adapted for:

- Coastal monitoring
- Ports and harbours
- Aquaculture zones
- Marine research
- Autonomous surface vehicles
- Pollution surveillance
- Smart water-quality monitoring

---

# ✨ Key Features

| Feature | Technology |
|---|---|
| 🤖 Floating debris detection | YOLOv8 |
| 📷 Camera acquisition | ESP32 + OV7670 |
| 🌡️ Temperature monitoring | Environmental sensor |
| 🌊 Turbidity monitoring | Turbidity sensor |
| 🧪 pH monitoring | pH sensor |
| 📍 GPS tracking | NEO-6M |
| 🚢 Collision detection | MPU6050 + IR |
| 🖥️ Local status display | 1602 I2C LCD |
| 💡 Hardware alerts | LEDs / indicators |
| ⚡ Real-time backend | FastAPI |
| 🔄 Live communication | WebSockets |
| 🗺️ Interactive map | React + Leaflet |
| 🗃️ Local data storage | SQLite |
| 🧪 Hardware-free testing | Simulation mode |

---

# 🏗️ System Architecture

```text
                    🌊 MARINE ENVIRONMENT
                             │
             ┌───────────────┴───────────────┐
             │                               │
             ▼                               ▼
     🌡️ ENVIRONMENTAL                 📷 CAMERA SYSTEM
        SENSORS                       ESP32 + OV7670
             │                               │
             │                               │
             ▼                               ▼
      Arduino Uno/Nano                 ESP32
             │                               │
             │                               │
             └───────────────┬───────────────┘
                             │
                         USB SERIAL
                             │
                             ▼
                  🧠 FASTAPI BACKEND
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
     GPS / Sensors       YOLOv8 AI         SQLite DB
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                        WebSockets
                             │
                             ▼
                 🖥️ REACT DASHBOARD
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
       🗺️ GPS Map        📊 Sensors       🚨 Alerts
                             │
                             ▼
                     👨‍💻 USER / OPERATOR
```

---

# 📁 Repository Structure

```text
Marine/
│
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   └── models/
│   │   │       └── yolov8n.pt
│   │   │
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   └── serial_service.py
│   │   │
│   │   ├── config.py
│   │   └── main.py
│   │
│   ├── static/
│   │   ├── uploads/
│   │   └── annotated/
│   │
│   ├── simulate_node.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   │   └── api.js
│   │   └── App.jsx
│   │
│   ├── package.json
│   └── .env.example
│
├── hardware/
│   ├── arduino_main/
│   │   └── arduino_main.ino
│   │
│   └── esp32_ov7670/
│       └── esp32_ov7670.ino
│
├── .gitignore
├── README.md
├── start_backend.sh
└── start_frontend.sh
```

---

# 🚀 Installation

> **IMPORTANT:** Start with the installation section before reading the architecture or hardware sections.
>
> **Windows is the recommended platform for evaluation.**
>
> macOS/Linux instructions are provided separately.

---

# 🪟 1. Windows Installation — Recommended

This is the **recommended setup for most users and evaluators**.

## 1.1 Install Git

Install Git for Windows.

After installation, open **PowerShell** and verify:

```powershell
git --version
```

Expected:

```text
git version 2.x.x
```

---

## 1.2 Install Python 3.12

### ⚠️ IMPORTANT

For this project, use:

```text
Python 3.12
```

Do **not** rely on Python 3.13 for the backend.

During testing with Python 3.13, some native dependencies attempted to compile from source and produced errors such as:

```text
error: linker `link.exe` not found
```

and:

```text
Failed to build wheel for pydantic-core
```

Using Python 3.12 avoids this installation problem in the normal setup.

After installing Python 3.12, open a **new PowerShell window** and check:

```powershell
py -3.12 --version
```

Expected:

```text
Python 3.12.x
```

If this command does not work, install Python 3.12 and make sure the Python launcher is installed.

---

# 1.3 Install Node.js

Install **Node.js 18 or newer**.

Verify:

```powershell
node --version
```

and:

```powershell
npm --version
```

Expected:

```text
v18.x.x
```

or newer.

---

# 1.4 Clone Marine Sentinel

Open PowerShell:

```powershell
cd $HOME\Desktop
```

Clone the repository:

```powershell
git clone https://github.com/Buvanesh12-tech/Marine.git
```

Enter the project:

```powershell
cd Marine
```

Verify:

```powershell
dir
```

You should see:

```text
backend
frontend
hardware
README.md
```

---

# 🐍 1.5 Create the Backend Virtual Environment

Move into the backend:

```powershell
cd backend
```

Create the virtual environment using Python 3.12:

```powershell
py -3.12 -m venv venv
```

Activate it:

```powershell
.\venv\Scripts\Activate.ps1
```

After activation, the terminal should show something similar to:

```text
(venv) PS C:\...\Marine\backend>
```

---

## ⚠️ If PowerShell blocks activation

If you receive an execution-policy error, run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then activate again:

```powershell
.\venv\Scripts\Activate.ps1
```

### Alternative

You can also use the virtual environment's Python directly without activation:

```powershell
.\venv\Scripts\python.exe --version
```

---

# 1.6 Install Backend Dependencies

With `(venv)` visible in the terminal:

```powershell
python -m pip install --upgrade pip
```

Then:

```powershell
pip install -r requirements.txt
```

This installs the backend stack including:

- FastAPI
- Uvicorn
- SQLAlchemy
- OpenCV
- NumPy
- Pandas
- PySerial
- Ultralytics
- YOLO dependencies
- PyTorch
- WebSockets
- Other required libraries

### ⚠️ If `pydantic-core` tries to compile

If you see:

```text
Failed to build wheel for pydantic-core
```

or:

```text
error: linker `link.exe` not found
```

check your Python version:

```powershell
python --version
```

If it reports:

```text
Python 3.13.x
```

remove the environment and recreate it using Python 3.12:

```powershell
deactivate
```

Then:

```powershell
cd ..
rmdir /s /q backend\venv
```

If PowerShell does not accept that command, use:

```powershell
Remove-Item -Recurse -Force backend\venv
```

Then:

```powershell
cd backend
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

---

# ⚙️ 1.7 Configure Backend Environment

Inside:

```text
backend/
```

copy:

```text
.env.example
```

to:

```text
.env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env`:

```powershell
notepad .env
```

For simulation mode, leave the hardware serial ports empty.

Example:

```env
DATABASE_URL=sqlite:///./marine_sentinel.db

SERIAL_ARDUINO_PORT=
SERIAL_ESP32_PORT=

TURBIDITY_WARNING_THRESHOLD=400
TURBIDITY_CRITICAL_THRESHOLD=600

PH_MIN_THRESHOLD=6.5
PH_MAX_THRESHOLD=8.5
```

---

# ⚛️ 1.8 Install Frontend Dependencies

Open a **second PowerShell window**.

Go to the project:

```powershell
cd $HOME\Desktop\Marine
```

Enter frontend:

```powershell
cd frontend
```

Install packages:

```powershell
npm install
```

### ⚠️ If `vite is not recognized`

If you see:

```text
'vite' is not recognized as an internal or external command
```

run:

```powershell
npm install
```

again.

Then:

```powershell
npm run dev
```

This usually happens when `node_modules` has not been installed yet.

---

# ⚙️ 1.9 Configure Frontend Environment

Copy:

```text
.env.example
```

to:

```text
.env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Open it:

```powershell
notepad .env
```

Example:

```env
VITE_BACKEND_HTTP=http://127.0.0.1:5001
VITE_BACKEND_WS=ws://127.0.0.1:5001/ws/dashboard
```

---

# ▶️ 2. Running Marine Sentinel on Windows

You need **three PowerShell windows** for the complete simulation.

---

## Terminal 1 — Backend

```powershell
cd $HOME\Desktop\Marine\backend
```

Activate:

```powershell
.\venv\Scripts\Activate.ps1
```

Start FastAPI:

```powershell
python -m uvicorn app.main:app --reload --port 5001
```

The backend should be available at:

```text
http://127.0.0.1:5001
```

---

## Terminal 2 — Frontend

Open another PowerShell:

```powershell
cd $HOME\Desktop\Marine\frontend
```

Start Vite:

```powershell
npm run dev
```

Vite will display a local URL.

Open the displayed URL in your browser.

Typical example:

```text
http://localhost:3000
```

> **Do not assume the port if Vite displays a different one.**
> Always open the URL shown in the terminal.

---

## Terminal 3 — Hardware Simulator

Open another PowerShell:

```powershell
cd $HOME\Desktop\Marine
```

Run:

```powershell
backend\venv\Scripts\python.exe backend\simulate_node.py
```

The simulator generates test telemetry such as:

- GPS coordinates
- Sensor values
- Turbidity changes
- Simulated marine events
- Camera/test packets

This allows the complete software system to be demonstrated **without physical hardware**.

---

# 🧪 3. Hardware-Free Demo Mode

You do **not** need Arduino or ESP32 hardware to test the software.

The project contains:

```text
backend/simulate_node.py
```

The simulator allows evaluators to test the software pipeline:

```text
Simulator
    ↓
Backend
    ↓
AI / Database
    ↓
WebSocket
    ↓
React Dashboard
```

This is useful for:

- Laptop demonstrations
- Development
- Debugging
- Hackathon evaluation
- Testing before hardware integration

---

# 🍎 4. macOS Installation

macOS users can run the same project with a slightly different command syntax.

## 4.1 Check Git

```bash
git --version
```

---

## 4.2 Check Python

```bash
python3 --version
```

### Recommended

Use Python 3.12.

Check:

```bash
python3.12 --version
```

If Python 3.12 is installed:

```bash
python3.12 -m venv venv
```

---

# 4.3 Clone the Repository

```bash
git clone https://github.com/Buvanesh12-tech/Marine.git
cd Marine
```

---

# 4.4 Backend Setup

```bash
cd backend
```

Create environment:

```bash
python3.12 -m venv venv
```

Activate:

```bash
source venv/bin/activate
```

Install:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create `.env`:

```bash
cp .env.example .env
```

---

# 4.5 Frontend Setup

Open another terminal:

```bash
cd Marine/frontend
```

Install:

```bash
npm install
```

Create `.env`:

```bash
cp .env.example .env
```

Run:

```bash
npm run dev
```

---

# 4.6 Run Backend on macOS

```bash
cd Marine/backend
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 5001
```

---

# 4.7 Run Simulator on macOS

In another terminal:

```bash
cd Marine
```

Then:

```bash
backend/venv/bin/python backend/simulate_node.py
```

---

# 🐧 5. Linux Installation

Linux follows almost the same process as macOS.

Install/check:

```bash
git --version
python3 --version
node --version
npm --version
```

Clone:

```bash
git clone https://github.com/Buvanesh12-tech/Marine.git
cd Marine
```

Backend:

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Frontend:

```bash
cd ../frontend
npm install
cp .env.example .env
```

Run backend:

```bash
cd ../backend
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 5001
```

Run frontend:

```bash
cd ../frontend
npm run dev
```

---

# 🔌 6. Physical Hardware Setup

Once the software is working in simulation mode, connect the physical hardware.

The project uses two main embedded controllers.

---

## 🟦 Arduino Uno / Nano

The Arduino acts as the primary environmental and navigation controller.

It manages:

- 🌊 Turbidity
- 🧪 pH
- 🌡️ Temperature
- 📍 GPS
- 🧭 MPU6050
- 🚨 IR collision sensing
- 🖥️ 1602 LCD
- 💡 Status LEDs

Firmware:

```text
hardware/arduino_main/arduino_main.ino
```

---

# 🟩 ESP32 + OV7670

The ESP32 handles camera acquisition.

Firmware:

```text
hardware/esp32_ov7670/esp32_ov7670.ino
```

The ESP32 captures camera data and transfers the frame data through Serial to the backend pipeline.

---

# 🔌 7. Finding Serial Ports

## Windows

Connect the Arduino/ESP32.

Open:

```text
Device Manager
```

Then:

```text
Ports (COM & LPT)
```

You may see:

```text
Arduino Uno (COM3)
USB-SERIAL (COM4)
```

Example:

```env
SERIAL_ARDUINO_PORT=COM3
SERIAL_ESP32_PORT=COM4
```

---

## macOS

Run:

```bash
ls /dev/tty.*
```

You may see:

```text
/dev/tty.usbmodemXXXX
/dev/tty.usbserialXXXX
```

---

## Linux

Run:

```bash
ls /dev/ttyUSB*
```

or:

```bash
ls /dev/ttyACM*
```

Example:

```text
/dev/ttyUSB0
/dev/ttyUSB1
```

---

# ⚙️ 8. Physical Hardware Environment Configuration

Edit:

```text
backend/.env
```

Example Windows configuration:

```env
SERIAL_ARDUINO_PORT=COM3
SERIAL_ESP32_PORT=COM4
```

Example Linux/macOS:

```env
SERIAL_ARDUINO_PORT=/dev/ttyUSB0
SERIAL_ESP32_PORT=/dev/ttyUSB1
```

Restart the backend after changing `.env`.

---

# 📍 9. GPS

Marine Sentinel uses a:

```text
NEO-6M GPS module
```

The GPS provides:

- Latitude
- Longitude
- Position tracking
- Real-time node location

### ⚠️ GPS NO FIX

Indoor GPS testing may result in:

```text
NO FIX
```

This is normal.

For initial GPS testing:

1. Place the GPS antenna near a window or outdoors.
2. Give the module enough time to acquire satellites.
3. Avoid testing inside buildings where possible.
4. Check the GPS serial output.

A valid GPS fix should eventually provide usable latitude/longitude data.

---

# 🧭 10. GPS Dashboard

The React dashboard receives GPS telemetry from the backend.

The frontend can visualize the node position using the map interface.

The overall data flow is:

```text
NEO-6M
   ↓
Arduino
   ↓
Serial
   ↓
FastAPI
   ↓
WebSocket
   ↓
React
   ↓
🗺️ Live Map
```

---

# 🤖 11. AI / YOLOv8 Detection

Marine Sentinel uses **YOLOv8** for computer vision.

The AI pipeline is designed to detect floating objects and marine debris from camera frames.

Typical targets include:

```text
Plastic bottles
Cans
Cups
Floating debris
Other detectable objects
```

The model is stored under:

```text
backend/app/ai/models/
```

The AI pipeline is integrated into the backend rather than requiring a separate server.

---

# 📷 12. Camera Pipeline

The camera subsystem follows:

```text
OV7670
   ↓
ESP32
   ↓
Serial
   ↓
FastAPI
   ↓
Frame Processing
   ↓
YOLOv8
   ↓
Detection Results
   ↓
React Dashboard
```

This allows the system to combine:

**Where is the pollution?**

with:

**What is the pollution?**

---

# 🌊 13. Environmental Monitoring

The Arduino collects environmental parameters such as:

### Turbidity

Used to identify abnormal water clarity conditions.

Example threshold configuration:

```env
TURBIDITY_WARNING_THRESHOLD=400
TURBIDITY_CRITICAL_THRESHOLD=600
```

### pH

Configured range:

```env
PH_MIN_THRESHOLD=6.5
PH_MAX_THRESHOLD=8.5
```

### Temperature

Temperature data can be transmitted to the backend and visualized on the dashboard.

---

# 🚨 14. Collision / Obstacle Detection

The system combines:

```text
MPU6050
+
IR Sensors
```

to identify abnormal movement or nearby obstacles.

The Arduino can provide local alerts through:

- LEDs
- LCD
- Sensor status
- Serial telemetry

---

# 🖥️ 15. Dashboard

The React dashboard provides a centralized interface for viewing system status.

The dashboard can include:

- 🗺️ GPS location
- 🌊 Water-quality values
- 📊 Sensor charts
- 🤖 AI detections
- 🚨 Alerts
- 📷 Camera information
- 🚢 Node status
- 📡 Real-time telemetry

---

# 🔄 16. Real-Time Communication

Marine Sentinel uses WebSockets to continuously deliver telemetry to the frontend.

```text
Arduino / ESP32
       ↓
   FastAPI
       ↓
  WebSocket
       ↓
   React UI
```

This avoids requiring the dashboard to constantly refresh the page.

---

# 🗃️ 17. Database

The backend uses:

```text
SQLite
```

The local database is created automatically during operation.

Typical file:

```text
marine_sentinel.db
```

The database can store information such as:

- Sensor readings
- GPS coordinates
- Detection events
- System status
- Recorded telemetry

The local database is intentionally excluded from Git because it is runtime-generated data.

---

# 🧪 18. Development Workflow

For development, the recommended order is:

```text
1️⃣ Clone repository
       ↓
2️⃣ Install dependencies
       ↓
3️⃣ Configure .env
       ↓
4️⃣ Start backend
       ↓
5️⃣ Start frontend
       ↓
6️⃣ Start simulator
       ↓
7️⃣ Verify dashboard
       ↓
8️⃣ Connect hardware
       ↓
9️⃣ Test sensors
       ↓
🔟 Test camera + AI
```

---

# 🩺 19. Troubleshooting

## ❌ `vite is not recognized`

Error:

```text
'vite' is not recognized as an internal or external command
```

Solution:

```powershell
cd frontend
npm install
npm run dev
```

---

## ❌ `venv` does not exist

Error:

```text
.\venv\Scripts\Activate.ps1 is not recognized
```

Create the environment first:

```powershell
py -3.12 -m venv venv
```

Then:

```powershell
.\venv\Scripts\Activate.ps1
```

---

## ❌ Python 3.13 causes installation errors

Check:

```powershell
python --version
```

If:

```text
Python 3.13.x
```

use Python 3.12.

Create a new environment:

```powershell
py -3.12 -m venv venv
```

---

## ❌ `link.exe not found`

Example:

```text
error: linker `link.exe` not found
```

This generally means a Python package is trying to compile native code.

First verify:

```powershell
python --version
```

Use:

```text
Python 3.12
```

instead of Python 3.13 for the recommended project setup.

---

## ❌ `Failed to build wheel for pydantic-core`

This can occur when pip cannot find a compatible prebuilt wheel and tries to compile the package.

Recommended fix:

```powershell
deactivate
```

Delete the old environment and recreate it with Python 3.12:

```powershell
Remove-Item -Recurse -Force venv
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

---

# ❌ Port 5001 Already in Use

If:

```text
Address already in use
```

appears, another backend may already be running.

Use another port:

```powershell
python -m uvicorn app.main:app --reload --port 5002
```

Then update:

```env
VITE_BACKEND_HTTP=http://127.0.0.1:5002
VITE_BACKEND_WS=ws://127.0.0.1:5002/ws/dashboard
```

Restart the frontend after changing `.env`.

---

# ❌ Frontend Cannot Connect to Backend

Check:

```text
frontend/.env
```

Example:

```env
VITE_BACKEND_HTTP=http://127.0.0.1:5001
VITE_BACKEND_WS=ws://127.0.0.1:5001/ws/dashboard
```

Then verify that the backend is actually running.

---

# ❌ Serial Port Not Found

Check the port again.

### Windows

```text
Device Manager → Ports (COM & LPT)
```

### macOS

```bash
ls /dev/tty.*
```

### Linux

```bash
ls /dev/ttyUSB*
```

Then update:

```text
backend/.env
```

---

# ❌ GPS Shows `NO FIX`

Possible reasons:

- Indoor testing
- Weak satellite visibility
- GPS antenna orientation
- Insufficient startup time
- Wiring problem

Try testing outdoors or near a window.

---

# ❌ Camera Does Not Respond

Check:

1. ESP32 power
2. OV7670 wiring
3. Camera pin configuration
4. ESP32 firmware
5. USB serial connection
6. Correct ESP32 COM port
7. Backend serial configuration

The camera firmware is located at:

```text
hardware/esp32_ov7670/esp32_ov7670.ino
```

---

# 🔐 20. Environment Variables & Security

Local `.env` files are intentionally not committed.

Use:

```text
.env.example
```

as the template.

### Backend

```env
DATABASE_URL=sqlite:///./marine_sentinel.db
SERIAL_ARDUINO_PORT=
SERIAL_ESP32_PORT=
TURBIDITY_WARNING_THRESHOLD=400
TURBIDITY_CRITICAL_THRESHOLD=600
PH_MIN_THRESHOLD=6.5
PH_MAX_THRESHOLD=8.5
```

### Frontend

```env
VITE_BACKEND_HTTP=http://127.0.0.1:5001
VITE_BACKEND_WS=ws://127.0.0.1:5001/ws/dashboard
```

> **Never commit passwords, API keys, private tokens, or other secrets to GitHub.**

---

# 🧰 21. Useful Commands

## Check Git

```bash
git status
```

## Pull latest project

```bash
git pull
```

## Start backend

Windows:

```powershell
python -m uvicorn app.main:app --reload --port 5001
```

macOS/Linux:

```bash
python3 -m uvicorn app.main:app --reload --port 5001
```

## Start frontend

```bash
npm run dev
```

## Start simulator

Windows:

```powershell
backend\venv\Scripts\python.exe backend\simulate_node.py
```

macOS/Linux:

```bash
backend/venv/bin/python backend/simulate_node.py
```

---

# 🧑‍💻 22. Quick Start — Windows

For experienced users who already have Git, Python 3.12, and Node.js installed:

### Terminal 1

```powershell
git clone https://github.com/Buvanesh12-tech/Marine.git
cd Marine\backend
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 5001
```

### Terminal 2

```powershell
cd Marine\frontend
npm install
Copy-Item .env.example .env
npm run dev
```

### Terminal 3

```powershell
cd Marine
backend\venv\Scripts\python.exe backend\simulate_node.py
```

Then open the URL shown by Vite.

---

# 🧠 23. Why This Architecture?

Marine Sentinel separates responsibilities between multiple layers.

### Hardware Layer

Responsible for:

```text
Sensors
GPS
Motion
Collision detection
Camera acquisition
```

### Backend Layer

Responsible for:

```text
Serial communication
Data processing
AI inference
Database
APIs
WebSockets
```

### Frontend Layer

Responsible for:

```text
Visualization
Maps
Charts
Alerts
AI results
Operator interaction
```

This makes the system easier to:

- Debug
- Upgrade
- Scale
- Test
- Demonstrate
- Integrate with different hardware

---

# 💡 24. Innovation

Marine Sentinel combines multiple sensing and intelligence layers into one platform.

Instead of relying only on water-quality sensors or only on camera detection, the system attempts to combine:

```text
Environmental Data
        +
GPS Location
        +
Motion / Collision Data
        +
Computer Vision
        +
Real-Time Dashboard
```

This creates a more complete picture of the marine environment.

---

# 🌍 25. Potential Impact

Marine pollution is difficult to monitor continuously across large areas.

A low-cost monitoring node can potentially support:

- Coastal cleanup operations
- Pollution mapping
- Harbour monitoring
- Aquaculture monitoring
- Marine research
- Smart environmental monitoring
- Autonomous monitoring platforms

The architecture can also be extended toward multiple distributed monitoring nodes.

---

# 🚀 26. Future Improvements

Possible future upgrades include:

- 🛰️ Cloud-based fleet monitoring
- 🤖 Autonomous navigation
- 🧠 Custom-trained marine debris dataset
- 📡 LoRa / LTE / 5G communication
- 🔋 Solar-powered operation
- 🌊 Multi-node pollution mapping
- 🛢️ Improved oil-spill classification
- 📈 Long-term environmental analytics
- 🗺️ Pollution heatmaps
- 🚨 Automated emergency alerts
- ☁️ Cloud database integration
- 📱 Mobile monitoring application

---

# 🔬 27. Project Status

| Component | Status |
|---|---|
| React Dashboard | ✅ Implemented |
| FastAPI Backend | ✅ Implemented |
| SQLite Database | ✅ Implemented |
| WebSocket Telemetry | ✅ Implemented |
| GPS Integration | ✅ Implemented |
| Environmental Sensors | ✅ Implemented |
| MPU6050 | ✅ Implemented |
| IR Collision Detection | ✅ Implemented |
| Arduino Firmware | ✅ Implemented |
| ESP32 Firmware | ✅ Implemented |
| OV7670 Integration | 🔧 Hardware-dependent |
| YOLOv8 Pipeline | ✅ Implemented |
| Simulation Mode | ✅ Implemented |
| Windows Setup | ✅ Supported |
| macOS Setup | ✅ Supported |
| Linux Setup | ✅ Supported |

---

# 🏆 28. Hackathon / Evaluation Demo

For a reliable evaluation demonstration, use the following sequence:

```text
STEP 1
Start Backend
        ↓
STEP 2
Start Frontend
        ↓
STEP 3
Start Simulator
        ↓
STEP 4
Open Dashboard
        ↓
STEP 5
Show GPS movement
        ↓
STEP 6
Show environmental readings
        ↓
STEP 7
Trigger sensor anomaly
        ↓
STEP 8
Show AI detection
        ↓
STEP 9
Show alert/status update
        ↓
STEP 10
Explain physical hardware integration
```

This allows the complete software pipeline to be demonstrated even if the hardware is unavailable during evaluation.

---

# 📜 29. License

This project is intended for educational, research, prototyping, and hackathon purposes.

Add the project's final license here when the team decides on the appropriate license.

---

# 👥 30. Team

**Marine Sentinel**

Built as an integrated:

```text
🤖 AI
+
🔌 Embedded Systems
+
📡 IoT
+
📍 GPS
+
🌊 Environmental Monitoring
+
🖥️ Web Technology
```

---

# ⭐ 31. Repository

GitHub:

**Marine Sentinel**

https://github.com/Buvanesh12-tech/Marine

If this project is useful or interesting, consider giving the repository a ⭐.

---

<p align="center">
  <strong>🌊 Marine Sentinel — Making Marine Monitoring Smarter 🚢</strong>
</p>

<p align="center">
  <em>Detect pollution. Locate it. Understand it. Act on it.</em>
</p>
