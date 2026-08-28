// API and WebSocket service layer for Marine Sentinel backend integration

const BACKEND_HTTP = import.meta.env.VITE_BACKEND_HTTP || 'http://127.0.0.1:5001';
const BACKEND_WS = import.meta.env.VITE_BACKEND_WS || 'ws://127.0.0.1:5001/ws/dashboard';

/**
 * Maps raw backend database telemetry records (flat schema) or real-time WebSocket payloads (nested schema)
 * into a single unified telemetry state object used by the frontend dashboard.
 * Enforces correct mapping for new hardware variables (distance, motion, MPU & object status).
 */
export const mapTelemetryData = (raw) => {
  if (!raw) return null;

  // 1. Resolve raw and annotated static file URLs from backend
  const rawPath = raw.raw_image_path || raw.raw_image_url || null;
  const annotatedPath = raw.annotated_image_path || raw.annotated_image_url || null;

  const raw_image_url = rawPath
    ? (rawPath.startsWith('http') ? rawPath : `${BACKEND_HTTP}${rawPath}`)
    : null;

  const annotated_image_url = annotatedPath
    ? (annotatedPath.startsWith('http') ? annotatedPath : `${BACKEND_HTTP}${annotatedPath}`)
    : null;

  // 2. Resolve GPS coordinates & Speed parameters
  let gps = null;
  if (raw.gps) {
    gps = {
      lat: raw.gps.lat !== undefined && raw.gps.lat !== null ? Number(raw.gps.lat) : null,
      lng: raw.gps.lng !== undefined && raw.gps.lng !== null ? Number(raw.gps.lng) : null,
      spd: raw.gps.spd !== undefined && raw.gps.spd !== null ? Number(raw.gps.spd) : null
    };
  } else if (raw.latitude !== undefined && raw.longitude !== undefined) {
    gps = {
      lat: raw.latitude !== null ? Number(raw.latitude) : null,
      lng: raw.longitude !== null ? Number(raw.longitude) : null,
      spd: raw.speed !== undefined && raw.speed !== null ? Number(raw.speed) : null
    };
  }

  // 3. Resolve Gyroscope X/Y/Z parameters
  let gyro = null;
  if (raw.gyro) {
    gyro = {
      ax: raw.gyro.ax !== undefined && raw.gyro.ax !== null ? Number(raw.gyro.ax) : null,
      ay: raw.gyro.ay !== undefined && raw.gyro.ay !== null ? Number(raw.gyro.ay) : null,
      az: raw.gyro.az !== undefined && raw.gyro.az !== null ? Number(raw.gyro.az) : null,
      gx: raw.gyro.gx !== undefined && raw.gyro.gx !== null ? Number(raw.gyro.gx) : null,
      gy: raw.gyro.gy !== undefined && raw.gyro.gy !== null ? Number(raw.gyro.gy) : null,
      gz: raw.gyro.gz !== undefined && raw.gyro.gz !== null ? Number(raw.gyro.gz) : null
    };
  } else if (raw.gyro_data) {
    gyro = {
      ax: raw.gyro_data.ax !== undefined && raw.gyro_data.ax !== null ? Number(raw.gyro_data.ax) : null,
      ay: raw.gyro_data.ay !== undefined && raw.gyro_data.ay !== null ? Number(raw.gyro_data.ay) : null,
      az: raw.gyro_data.az !== undefined && raw.gyro_data.az !== null ? Number(raw.gyro_data.az) : null,
      gx: raw.gyro_data.gx !== undefined && raw.gyro_data.gx !== null ? Number(raw.gyro_data.gx) : null,
      gy: raw.gyro_data.gy !== undefined && raw.gyro_data.gy !== null ? Number(raw.gyro_data.gy) : null,
      gz: raw.gyro_data.gz !== undefined && raw.gyro_data.gz !== null ? Number(raw.gyro_data.gz) : null
    };
  }

  // 4. Extract other variables
  const turb = raw.turbidity !== undefined ? raw.turbidity : (raw.turb !== undefined ? raw.turb : null);
  const ph = raw.ph_level !== undefined ? raw.ph_level : (raw.ph !== undefined ? raw.ph : null);
  const temp = raw.temperature !== undefined ? raw.temperature : (raw.temp !== undefined ? raw.temp : null);
  const ir = raw.ir_sensors !== undefined ? raw.ir_sensors : (raw.ir !== undefined ? raw.ir : null);

  // 5. Parse hardware parameters (Distance, Movement, MPU and Object Detections status)
  const distance_cm = raw.distance_cm !== undefined && raw.distance_cm !== null ? Number(raw.distance_cm) : null;
  const movement_dps = raw.movement_dps !== undefined && raw.movement_dps !== null ? Number(raw.movement_dps) : null;
  const mpu_connected = raw.mpu_connected !== undefined ? raw.mpu_connected : null;
  const object_detected = raw.object_detected !== undefined ? raw.object_detected : null;

  return {
    id: raw.id ?? 0,
    timestamp: raw.timestamp ?? '',
    gps,
    turb: turb !== null ? Number(turb) : null,
    ph: ph !== null ? Number(ph) : null,
    temp: temp !== null ? Number(temp) : null,
    gyro,
    ir: Array.isArray(ir) ? ir.map(Number) : null,
    status: raw.status || 'UNKNOWN',
    raw_image_url,
    annotated_image_url,
    detections: Array.isArray(raw.detections) ? raw.detections : [],
    
    // New parameters
    distance_cm,
    movement_dps,
    mpu_connected,
    object_detected
  };
};

/**
 * Fetch telemetry history log
 */
export const getTelemetryHistory = async () => {
  const response = await fetch(`${BACKEND_HTTP}/api/history/telemetry`);
  if (!response.ok) {
    throw new Error(`Failed to load telemetry history from backend (Status: ${response.status})`);
  }
  const data = await response.json();
  return data.map(mapTelemetryData);
};

/**
 * Fetch alert logs
 */
export const getAlerts = async () => {
  const response = await fetch(`${BACKEND_HTTP}/api/history/alerts`);
  if (!response.ok) {
    throw new Error(`Failed to load alert logs from backend (Status: ${response.status})`);
  }
  return response.json();
};

/**
 * Send steering override action to motor controllers
 */
export const sendControlCommand = async (action) => {
  const response = await fetch(`${BACKEND_HTTP}/api/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  if (!response.ok) {
    throw new Error(`Failed to transmit steering control command (Status: ${response.status})`);
  }
  return response.json();
};

/**
 * Connect to live Websocket updates
 */
export const connectDashboardWebSocket = (onMessage, onOpen, onClose, onError) => {
  const ws = new WebSocket(BACKEND_WS);
  
  ws.onopen = () => {
    if (typeof onOpen === 'function') onOpen();
  };
  
  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (typeof onMessage === 'function') onMessage(payload);
    } catch (err) {
      console.error("Websocket message parse exception:", err);
    }
  };
  
  ws.onclose = () => {
    if (typeof onClose === 'function') onClose();
  };
  
  ws.onerror = (err) => {
    if (typeof onError === 'function') onError(err);
  };
  
  return ws;
};
