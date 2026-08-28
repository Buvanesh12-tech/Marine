import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Wifi, 
  WifiOff, 
  MapPin, 
  AlertTriangle, 
  Droplet, 
  Compass, 
  Zap, 
  Camera, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  Circle,
  Activity,
  History,
  LifeBuoy
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

// Import backend API & WS service layer
import { 
  getTelemetryHistory, 
  getAlerts, 
  sendControlCommand, 
  connectDashboardWebSocket,
  mapTelemetryData
} from './services/api';

// Setup Leaflet marker icon configuration to fix missing icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom boat marker icon
const boatIcon = new L.DivIcon({
  html: `<div class="w-8 h-8 bg-blue-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg transform rotate-45 animate-pulse">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="w-4 h-4">
             <path d="M12 2L2 22l10-6 10 6L12 2z"/>
           </svg>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Custom alert marker icon
const alertIcon = (severity) => new L.DivIcon({
  html: `<div class="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-md animate-ping ${
    severity === 'CRITICAL' ? 'bg-red-600' : 'bg-yellow-500'
  }">
           <span class="text-white text-xs font-bold">!</span>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Helper component to auto-recenter map when coordinates change
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0 && center[1] !== 0 && center[0] !== null && center[1] !== null) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function App() {
  // Web Dashboard States (Telemetry mapped to conform to backend values)
  const [telemetry, setTelemetry] = useState({
    id: 0,
    timestamp: '',
    gps: null, // Mapped GPS coordinates (lat, lng, spd)
    turb: null,
    ph: null,
    temp: null,
    gyro: null,
    ir: null,
    status: 'UNKNOWN',
    raw_image_url: null,
    annotated_image_url: null,
    detections: []
  });

  const [telemetryHistoryList, setTelemetryHistoryList] = useState([]); // List of full telemetry records
  const [telemetryHistory, setTelemetryHistory] = useState([]); // Array of coordinate tuples [lat, lng]
  const [alerts, setAlerts] = useState([]);
  
  // Connection states
  const [isConnected, setIsConnected] = useState(false); // WebSocket status
  const [isBackendAvailable, setIsBackendAvailable] = useState(false); // HTTP status
  
  const [useAnnotated, setUseAnnotated] = useState(true);
  const [lastCommandSent, setLastCommandSent] = useState('STOP');
  const [controlMode, setControlMode] = useState('AUTO'); // AUTO or MANUAL
  const [activeChartTab, setActiveChartTab] = useState('turbidity'); // 'turbidity' | 'ph' | 'temp'
  
  const [hardwareStatus, setHardwareStatus] = useState({
    arduino_connected: false,
    esp32_connected: false,
    gps_status: 'DISCONNECTED', // DISCONNECTED, NO_FIX, CONNECTED
    mpu_status: 'DISCONNECTED', // DISCONNECTED, ERROR, CONNECTED
    camera_status: 'DISCONNECTED' // DISCONNECTED, ERROR, CONNECTED
  });

  const wsRef = useRef(null);

  // Core Data Fetch Routine
  const loadHistoricalData = async () => {
    try {
      const history = await getTelemetryHistory();
      setIsBackendAvailable(true);
      
      // Parse valid coordinates for Leaflet Polyline path
      const historyPoints = history
        .filter(t => t.gps && t.gps.lat !== null && t.gps.lng !== null && t.gps.lat !== 0 && t.gps.lng !== 0)
        .map(t => [t.gps.lat, t.gps.lng]);
        
      setTelemetryHistoryList(history);
      setTelemetryHistory(historyPoints);

      // Initialize latest state from newest log
      if (history.length > 0) {
        const latest = history[history.length - 1];
        setTelemetry(latest);
        if (latest.gps && latest.gps.lat !== null && latest.gps.lng !== null) {
          console.log("[GPS] Arduino latitude =", latest.gps.lat);
          console.log("[GPS] Arduino longitude =", latest.gps.lng);
        }
        console.log("[GPS] Mapped telemetry history object:", latest);
      }
    } catch (err) {
      console.error("Error loading telemetry history:", err);
      setIsBackendAvailable(false);
    }

    try {
      const alertLogs = await getAlerts();
      setAlerts(alertLogs);
    } catch (err) {
      console.error("Error loading alerts:", err);
    }
  };

  // Initial load
  useEffect(() => {
    loadHistoricalData();
  }, []);

  // WebSocket Connection and Reconnect/Polling Fallback Loop
  useEffect(() => {
    let ws = null;
    let pollingInterval = null;

    const setupWSConnection = () => {
      console.log("Attempting WebSocket connection to backend...");
      
      ws = connectDashboardWebSocket(
        // onMessage payload handler
        (payload) => {
          setIsBackendAvailable(true);

          if (payload.status_indicators) {
            setHardwareStatus(payload.status_indicators);
          }

          if (payload.type === 'TELEMETRY_UPDATE') {
            const telemetryData = mapTelemetryData(payload.data);
            setTelemetry(telemetryData);

            if (telemetryData.gps && telemetryData.gps.lat !== null && telemetryData.gps.lng !== null) {
              console.log("[GPS] Arduino latitude =", telemetryData.gps.lat);
              console.log("[GPS] Arduino longitude =", telemetryData.gps.lng);
              setTelemetryHistory(prev => [...prev, [telemetryData.gps.lat, telemetryData.gps.lng]]);
              setTelemetryHistoryList(prev => [...prev, telemetryData]);
            }
            console.log("[GPS] WebSocket raw telemetry payload.data object:", payload.data);

            if (payload.alert) {
              setAlerts(prev => [payload.alert, ...prev]);
            }
          } else if (payload.type === 'CAMERA_UPDATE') {
            const cameraData = payload.data;
            const mappedCam = mapTelemetryData(cameraData);
            
            setTelemetry(prev => ({
              ...prev,
              raw_image_url: mappedCam.raw_image_url,
              annotated_image_url: mappedCam.annotated_image_url,
              detections: mappedCam.detections,
              status: cameraData.status === 'SAFE' ? prev.status : cameraData.status
            }));

            if (payload.alert) {
              setAlerts(prev => [payload.alert, ...prev]);
            }
          }
        },
        // onOpen callback
        () => {
          setIsConnected(true);
          setIsBackendAvailable(true);
          console.log("WebSocket connection established. Live data stream active.");
          
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        },
        // onClose callback (initiates retry + polling fallback)
        () => {
          setIsConnected(false);
          console.warn("WebSocket closed. Falling back to HTTP polling (every 1.5s)...");
          
          if (!pollingInterval) {
            pollingInterval = setInterval(loadHistoricalData, 1500);
          }

          // Retry WS connection after 3s
          setTimeout(() => {
            if (!ws || ws.readyState === WebSocket.CLOSED) {
              setupWSConnection();
            }
          }, 3000);
        },
        // onError callback
        (err) => {
          console.error("WebSocket connection error:", err);
          setIsConnected(false);
        }
      );
    };

    setupWSConnection();

    return () => {
      if (ws) ws.close();
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, []);

  // Trigger motor steering commands
  const sendControl = (action) => {
    setLastCommandSent(action);
    sendControlCommand(action)
      .then(() => console.log(`Command ${action} acknowledged by motor subsystem`))
      .catch(err => console.error("Failed sending command:", err));
  };

  // Determine severity border and text color helper
  const getStatusColor = (status) => {
    switch (status) {
      case 'CRITICAL':
        return {
          bg: 'bg-red-950/60 border-red-500/50',
          text: 'text-red-400',
          badge: 'bg-red-500 text-white animate-pulse',
          label: 'CRITICAL WARNING: DEBRIS / OIL DETECTED'
        };
      case 'WARNING':
        return {
          bg: 'bg-yellow-950/40 border-yellow-500/50',
          text: 'text-yellow-400',
          badge: 'bg-yellow-500 text-black',
          label: 'MONITORING: WATER QUALITY ALTERED / SMALL DEBRIS'
        };
      default:
        return {
          bg: 'bg-blue-950/40 border-blue-500/50',
          text: 'text-blue-400',
          badge: 'bg-blue-600 text-white',
          label: 'OCEAN SAFE: SYSTEM ONLINE'
        };
    }
  };

  const statusStyle = getStatusColor(telemetry.status);
  
  // Dynamic Map Coordinates fallback (converting explicitly to Floats for Leaflet compatibility)
  const hasGps = telemetry.gps && telemetry.gps.lat !== null && telemetry.gps.lng !== null && telemetry.gps.lat !== 0 && telemetry.gps.lng !== 0;
  const currentCoords = hasGps ? [Number(telemetry.gps.lat), Number(telemetry.gps.lng)] : [13.024397, 80.017257]; // Safe vessel default center

  return (
    <div className="flex flex-col min-h-screen font-sans bg-gray-950 text-white select-none">
      
      {/* HEADER STATUS PANEL */}
      <header className={`border-b p-4 ${statusStyle.bg} transition-colors duration-500`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className={`w-8 h-8 ${statusStyle.text}`} />
              <h1 className="text-2xl font-bold tracking-tight">MARINE SENTINEL</h1>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Low-Cost AI Marine Debris & Pollution Sentinel Node</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
            {/* Live Data Connection Badge */}
            <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 px-3 py-1 rounded-lg text-xs font-bold">
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-emerald-400 tracking-wider">LIVE DATA</span>
                </>
              ) : isBackendAvailable ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                  <span className="text-yellow-400 tracking-wider">STANDBY</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-rose-500 tracking-wider">OFFLINE</span>
                </>
              )}
            </div>

            {/* Status Alert Banner */}
            <span className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${statusStyle.badge}`}>
              {statusStyle.label}
            </span>

            {/* Backend Connected */}
            <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 px-3 py-1 rounded-lg text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${isBackendAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-gray-300">Backend: {isBackendAvailable ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </div>

            {/* WebSocket Connected */}
            <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 px-3 py-1 rounded-lg text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-gray-300">WebSocket: {isConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </div>

            {/* Arduino Connected */}
            <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 px-3 py-1 rounded-lg text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${hardwareStatus.arduino_connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-gray-300">Arduino: {hardwareStatus.arduino_connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </div>

            {/* MPU Connected */}
            <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 px-3 py-1 rounded-lg text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${
                telemetry.mpu_connected === true || telemetry.mpu_connected === 'true' || hardwareStatus.mpu_status === 'CONNECTED'
                  ? 'bg-emerald-400 animate-pulse' 
                  : 'bg-rose-500'
              }`}></span>
              <span className="text-gray-300">MPU6050: {
                telemetry.mpu_connected === true || telemetry.mpu_connected === 'true' || hardwareStatus.mpu_status === 'CONNECTED'
                  ? 'CONNECTED' 
                  : 'DISCONNECTED'
              }</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT COLUMN: LIVE FEED & DRIVE CONTROLS (5/12 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Camera Visualizer */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
            <div className="p-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Camera className="w-4 h-4 text-blue-400" />
                <span>Live Sentinel Camera Feed</span>
              </div>
              <div className="flex rounded-md bg-gray-950 p-0.5 border border-gray-700 text-xs">
                <button 
                  onClick={() => setUseAnnotated(false)}
                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${!useAnnotated ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                >
                  Raw
                </button>
                <button 
                  onClick={() => setUseAnnotated(true)}
                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${useAnnotated ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                >
                  AI Detect
                </button>
              </div>
            </div>
            
            {/* Image display container */}
            <div className="relative aspect-video bg-gray-950 flex items-center justify-center overflow-hidden border-b border-gray-800">
              {useAnnotated && telemetry.annotated_image_url ? (
                <img 
                  src={telemetry.annotated_image_url} 
                  alt="AI Annotated Feed" 
                  className="w-full h-full object-cover"
                />
              ) : telemetry.raw_image_url ? (
                <img 
                  src={telemetry.raw_image_url} 
                  alt="Raw Video Feed" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-6 flex flex-col items-center">
                  <Activity className="w-12 h-12 text-gray-700 animate-pulse mb-3" />
                  <p className="text-sm font-medium text-gray-500">
                    {hardwareStatus.camera_status === 'DISCONNECTED' ? 'Camera Offline' : 'Awaiting video transmission...'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {hardwareStatus.camera_status === 'ERROR' 
                      ? 'Camera Sensor Initialization Failure' 
                      : 'Check ESP32 Dev Module + OV7670 Serial connection'}
                  </p>
                </div>
              )}

              {/* Timestamp tag overlay */}
              {telemetry.timestamp && (
                <span className="absolute bottom-2 left-2 bg-gray-950/80 px-2 py-1 rounded text-[10px] text-gray-400 border border-gray-800">
                  {new Date(telemetry.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>

            {/* Detections Checklist */}
            <div className="p-3 bg-gray-950 text-xs">
              <span className="text-gray-400 font-semibold block mb-1">Target Detections list:</span>
              {telemetry.detections && telemetry.detections.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {telemetry.detections.map((det, index) => (
                    <span 
                      key={index}
                      className={`px-2 py-1 rounded border flex items-center gap-1.5 ${
                        det.class === 'OIL_SPILL' 
                          ? 'bg-red-950/50 border-red-500/30 text-red-300' 
                          : 'bg-yellow-950/50 border-yellow-500/30 text-yellow-300'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <strong>{det.label || det.class}</strong> ({(det.confidence * 100).toFixed(0)}%)
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-600 italic">No detections</span>
              )}
            </div>
          </div>

          {/* Drive & Control Panel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <LifeBuoy className="w-4 h-4 text-orange-400" />
                <span>Steering Override & Controls</span>
              </div>
              <div className="flex rounded-md bg-gray-950 p-0.5 border border-gray-700 text-xs">
                <button 
                  onClick={() => setControlMode('AUTO')}
                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${controlMode === 'AUTO' ? 'bg-orange-600 text-white font-bold' : 'text-gray-400'}`}
                >
                  Autonomous
                </button>
                <button 
                  onClick={() => setControlMode('MANUAL')}
                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${controlMode === 'MANUAL' ? 'bg-orange-600 text-white font-bold' : 'text-gray-400'}`}
                >
                  Manual
                </button>
              </div>
            </div>

            {controlMode === 'MANUAL' ? (
              <div className="flex flex-col items-center justify-center p-4">
                <p className="text-[11px] text-yellow-500 mb-3 text-center">
                  WARNING: Manual control overrides boat cruising routes. Navigate with care.
                </p>
                <div className="grid grid-cols-3 gap-2 max-w-[180px]">
                  <div></div>
                  <button 
                    onClick={() => sendControl('FWD')} 
                    className="p-3 bg-gray-800 hover:bg-gray-700 active:bg-orange-600 rounded-lg flex items-center justify-center border border-gray-700 cursor-pointer transition"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                  <div></div>

                  <button 
                    onClick={() => sendControl('LEFT')} 
                    className="p-3 bg-gray-800 hover:bg-gray-700 active:bg-orange-600 rounded-lg flex items-center justify-center border border-gray-700 cursor-pointer transition"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => sendControl('STOP')} 
                    className="p-3 bg-red-950 hover:bg-red-900 active:bg-red-700 text-red-400 rounded-lg flex items-center justify-center border border-red-800 cursor-pointer font-bold"
                  >
                    HALT
                  </button>
                  <button 
                    onClick={() => sendControl('RIGHT')} 
                    className="p-3 bg-gray-800 hover:bg-gray-700 active:bg-orange-600 rounded-lg flex items-center justify-center border border-gray-700 cursor-pointer transition"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  <div></div>
                  <button 
                    onClick={() => sendControl('REV')} 
                    className="p-3 bg-gray-800 hover:bg-gray-700 active:bg-orange-600 rounded-lg flex items-center justify-center border border-gray-700 cursor-pointer transition"
                  >
                    <ArrowDown className="w-5 h-5" />
                  </button>
                  <div></div>
                </div>

                <div className="mt-4 text-xs text-gray-500 text-center">
                  Last direction packet queued: <span className="text-gray-300 font-mono font-bold">{lastCommandSent}</span>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-gray-800 rounded-lg text-center flex flex-col items-center justify-center">
                <Compass className="w-8 h-8 text-blue-400 animate-spin mb-2" style={{ animationDuration: '6s' }} />
                <p className="text-xs font-semibold text-gray-300">Autopilot Active</p>
                <p className="text-[10px] text-gray-500 mt-1 max-w-[240px]">
                  The sentinel is running preset search grids. Manual controls locked.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* CENTER COLUMN: INTERACTIVE MAP (7/12 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Mission Map Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-[320px] lg:h-[450px]">
            <div className="p-3 bg-gray-800 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm font-semibold">
              <div className="flex items-center gap-2 flex-wrap">
                <MapPin className="w-4 h-4 text-rose-500" />
                <span>Geographic Mission Coordinates Map</span>
                <span className="bg-emerald-950 border border-emerald-500/30 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  GPS SOURCE: MARINE SENTINEL HARDWARE
                </span>
              </div>
              <div className="flex flex-col items-end text-xs font-mono text-gray-400">
                <span>
                  {hasGps 
                    ? `Lat: ${telemetry.gps.lat.toFixed(6)}, Lng: ${telemetry.gps.lng.toFixed(6)}` 
                    : 'GPS SIGNAL UNAVAILABLE'}
                </span>
                {hasGps && telemetry.timestamp && (
                  <span className="text-[9px] text-gray-500">
                    Fix Time: {new Date(telemetry.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-grow relative z-0">
              {hardwareStatus.gps_status !== 'CONNECTED' && (
                <div className="absolute top-2 right-2 z-[1000] bg-red-950/90 border border-red-500/50 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 text-red-300 shadow-md">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{hardwareStatus.gps_status === 'NO_FIX' ? 'GPS Status: NO FIX (Acquiring Satellites...)' : 'GPS Status: DISCONNECTED'}</span>
                </div>
              )}
              <MapContainer 
                center={currentCoords} 
                zoom={16} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Recenters Leaflet map on coordinate update */}
                <ChangeMapView center={currentCoords} />

                {/* Sentinel Boat Marker */}
                {hasGps && (
                  <Marker position={currentCoords} icon={boatIcon}>
                    <Popup>
                      <div className="text-black text-xs font-sans space-y-1">
                        <strong className="block border-b border-gray-200 pb-1">Marine Sentinel Boat</strong>
                        <div><strong>Latitude:</strong> {telemetry.gps.lat.toFixed(6)}</div>
                        <div><strong>Longitude:</strong> {telemetry.gps.lng.toFixed(6)}</div>
                        <div><strong>Speed:</strong> {telemetry.gps.spd !== null ? `${telemetry.gps.spd.toFixed(1)} km/h` : 'N/A'}</div>
                        <div><strong>Turbidity:</strong> {telemetry.turb !== null ? `${telemetry.turb} NTU` : 'N/A'}</div>
                        <div><strong>Status:</strong> {telemetry.status}</div>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Historical warning pins from Alert logs */}
                {alerts.map((al, idx) => (
                  <Marker 
                    key={idx} 
                    position={[al.latitude, al.longitude]} 
                    icon={alertIcon(al.severity)}
                  >
                    <Popup>
                      <div className="text-black text-xs font-sans">
                        <strong>Alert Log #{al.id}</strong><br />
                        Type: {al.alert_type}<br />
                        Severity: {al.severity}<br />
                        Description: {al.description}
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Path line trajectory */}
                {telemetryHistory.length > 1 && (
                  <Polyline 
                    positions={telemetryHistory} 
                    color="#3b82f6" 
                    weight={3} 
                    dashArray="5, 5" 
                  />
                )}
              </MapContainer>
            </div>
          </div>

          {/* TELEMETRY CARD GRID */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Water Quality & Environment Status */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-semibold uppercase">Water & Environment</span>
                <Droplet className="w-4 h-4 text-sky-400" />
              </div>
              
              {/* Turbidity Row */}
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Turbidity:</span>
                  <span className={`font-mono font-bold ${
                    telemetry.turb > 600 ? 'text-red-400' : telemetry.turb > 400 ? 'text-yellow-400' : 'text-blue-400'
                  }`}>
                    {telemetry.turb !== null && telemetry.turb !== undefined ? `${telemetry.turb} NTU` : '--'}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      telemetry.turb > 600 ? 'bg-red-500' : telemetry.turb > 400 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${telemetry.turb !== null && telemetry.turb !== undefined ? Math.min((telemetry.turb / 1024) * 100, 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* pH Level Row */}
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">pH Level:</span>
                  <span className={`font-mono font-bold ${
                    telemetry.ph !== null && (telemetry.ph < 6.5 || telemetry.ph > 8.5) ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {telemetry.ph !== null && telemetry.ph !== undefined ? `${telemetry.ph.toFixed(1)} pH` : '--'}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      telemetry.ph !== null && (telemetry.ph < 6.5 || telemetry.ph > 8.5) ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${telemetry.ph !== null && telemetry.ph !== undefined ? Math.min((telemetry.ph / 14) * 100, 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Temperature Row */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Temperature:</span>
                  <span className="font-mono font-bold text-orange-400">
                    {telemetry.temp !== null && telemetry.temp !== undefined ? `${telemetry.temp.toFixed(1)} °C` : '--'}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-orange-500"
                    style={{ width: `${telemetry.temp !== null && telemetry.temp !== undefined ? Math.min((telemetry.temp / 50) * 100, 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Stability Gyro card */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-semibold uppercase">Tilt & Pitch (MPU6050)</span>
                <Compass className="w-4 h-4 text-emerald-400 animate-pulse" />
              </div>
              
              {hardwareStatus.mpu_status !== 'CONNECTED' && telemetry.mpu_connected !== true ? (
                <div className="text-rose-400 text-xs py-4 italic flex flex-col items-center gap-1 justify-center flex-grow">
                  <AlertTriangle className="w-5 h-5 mb-1" />
                  <span>MPU6050 Disconnected / Error</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    <div>
                      <span className="text-gray-500 block">Pitch (Acc X)</span>
                      <span className="font-mono text-sm text-gray-200 font-bold">
                        {telemetry.gyro && telemetry.gyro.ax !== null && telemetry.gyro.ax !== undefined 
                          ? `${telemetry.gyro.ax.toFixed(2)} m/s²` 
                          : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Roll (Acc Y)</span>
                      <span className="font-mono text-sm text-gray-200 font-bold">
                        {telemetry.gyro && telemetry.gyro.ay !== null && telemetry.gyro.ay !== undefined 
                          ? `${telemetry.gyro.ay.toFixed(2)} m/s²` 
                          : '--'}
                      </span>
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-gray-500 mt-2 block border-t border-gray-800 pt-2">
                    Boat motion stability: <strong className="text-emerald-400">Normal</strong>
                  </span>
                </>
              )}
            </div>

            {/* Proximity / IR Collision status */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-semibold uppercase">IR Collisions</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              
              <div className="flex justify-between gap-1 mt-2">
                {['Left', 'Center', 'Right'].map((dir, idx) => {
                  const val = Array.isArray(telemetry.ir) ? telemetry.ir[idx] : null;
                  return (
                    <div key={idx} className="flex flex-col items-center flex-1 bg-gray-950 p-2 rounded-lg border border-gray-800">
                      <span className="text-[9px] text-gray-500 mb-1">{dir}</span>
                      {val === null || val === undefined ? (
                        <span className="text-gray-600 font-bold text-xs">--</span>
                      ) : (
                        <Circle className={`w-3.5 h-3.5 rounded-full ${
                          val === 1 ? 'fill-red-500 text-red-500 animate-pulse animate-bounce' : 'text-gray-700'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
              
              <span className="text-[10px] text-gray-500 mt-2 block font-semibold">
                {Array.isArray(telemetry.ir) && telemetry.ir.includes(1) ? 'ALERT: Obstacle Avoidance Triggered' : 'Proximity fields: Clear'}
              </span>
            </div>

            {/* Ultrasonic & Motion Status */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-semibold uppercase">Ultrasonic & Motion</span>
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              
              {/* Distance Row */}
              <div className="mb-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Obstacle Distance:</span>
                  <span className="font-mono font-bold text-purple-400">
                    {telemetry.distance_cm !== null && telemetry.distance_cm !== undefined 
                      ? `${Number(telemetry.distance_cm).toFixed(1)} cm` 
                      : '--'}
                  </span>
                </div>
              </div>

              {/* Movement Row */}
              <div className="mb-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Motion Velocity:</span>
                  <span className="font-mono font-bold text-indigo-400">
                    {telemetry.movement_dps !== null && telemetry.movement_dps !== undefined 
                      ? `${Number(telemetry.movement_dps).toFixed(1)} dps` 
                      : '--'}
                  </span>
                </div>
              </div>

              {/* Object Detected Status */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">AI Target Lock:</span>
                  <span className={`font-mono font-bold ${
                    telemetry.object_detected === true || telemetry.object_detected === 'true' 
                      ? 'text-red-400 animate-pulse' 
                      : 'text-gray-400'
                  }`}>
                    {telemetry.object_detected === null || telemetry.object_detected === undefined 
                      ? '--' 
                      : (telemetry.object_detected === true || telemetry.object_detected === 'true' ? 'OBJECT DETECTED' : 'CLEAN')}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Telemetry Charts Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
                <span>Historical Environmental Analytics Trends</span>
              </div>
              <div className="flex rounded-md bg-gray-950 p-0.5 border border-gray-700 text-[10px]">
                <button
                  onClick={() => setActiveChartTab('turbidity')}
                  className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    activeChartTab === 'turbidity' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Turbidity
                </button>
                <button
                  onClick={() => setActiveChartTab('ph')}
                  className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    activeChartTab === 'ph' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  pH Level
                </button>
                <button
                  onClick={() => setActiveChartTab('temp')}
                  className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    activeChartTab === 'temp' ? 'bg-orange-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Temperature
                </button>
              </div>
            </div>

            <div className="h-[180px] w-full mt-2 select-none">
              {telemetryHistoryList.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={telemetryHistoryList.map(t => ({
                      time: t.timestamp ? new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A',
                      turb: t.turb,
                      ph: t.ph,
                      temp: t.temp
                    }))}
                    margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                  >
                    <XAxis 
                      dataKey="time" 
                      stroke="#4b5563" 
                      fontSize={9} 
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#4b5563" 
                      fontSize={9} 
                      tickLine={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6', fontSize: 10 }}
                    />
                    {activeChartTab === 'turbidity' && (
                      <Line type="monotone" dataKey="turb" stroke="#3b82f6" strokeWidth={2} dot={false} name="Turbidity (NTU)" />
                    )}
                    {activeChartTab === 'ph' && (
                      <Line type="monotone" dataKey="ph" stroke="#10b981" strokeWidth={2} dot={false} name="pH Level" />
                    )}
                    {activeChartTab === 'temp' && (
                      <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} dot={false} name="Temp (°C)" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-500 italic">
                  Awaiting telemetry logs history for graph trend lines...
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE ALERTS & ACTIONS PANEL */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 text-sm font-semibold">
              <History className="w-4 h-4 text-yellow-400" />
              <span>Real-Time Alert Feed & Action Prompts</span>
            </div>

            <div className="max-h-[160px] overflow-y-auto flex flex-col gap-2.5 pr-1.5">
              {alerts.length > 0 ? (
                alerts.map((al, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg border flex flex-col gap-1.5 ${
                      al.severity === 'CRITICAL' 
                        ? 'bg-red-950/20 border-red-500/30' 
                        : 'bg-yellow-950/20 border-yellow-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className={al.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'}>
                        {al.alert_type} Alert
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(al.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">{al.description}</p>
                    
                    {/* Suggested Response prompt */}
                    <div className="text-[10px] bg-black/40 p-1.5 rounded border border-gray-800 text-gray-400 mt-0.5">
                      <strong className="text-blue-400">Response Action:</strong> {
                        al.alert_type === 'OIL_SPILL' 
                          ? 'Dispatch containment boom crew immediately. Send site cleanup boat to coordinates.'
                          : al.alert_type === 'DEBRIS'
                          ? 'Trace path downwind. Debris collection vessel task recommended.'
                          : al.alert_type === 'TURBIDITY'
                          ? 'Record local sediment conditions. Check for sewage outlets/outfall runoff.'
                          : 'Proximity collision threat. Steering command overrides enabled.'
                      }
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-6 text-xs text-gray-600 italic">
                  No active warnings. System running clean scans.
                </div>
              )}
            </div>
          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-gray-950 border-t border-gray-900 p-4 text-center text-xs text-gray-600">
        <div className="max-w-7xl mx-auto">
          &copy; 2026 Marine Sentinel. Built for AI-powered autonomous ocean cleanup and telemetry monitoring.
        </div>
      </footer>

    </div>
  );
}
