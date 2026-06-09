const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8001";
// Handle relative URL (e.g. /api) → derive from current host
const resolvedURL = BACKEND_URL.startsWith("/")
  ? `${window.location.protocol}//${window.location.host}${BACKEND_URL}`
  : BACKEND_URL;
const WS_BASE = resolvedURL.replace(/^http/, "ws");

const TOKEN_KEY = "admin_dashboard_token";
const listeners = {};
let socket = null;
let reconnectTimer = null;
let shouldConnect = false;

function emit(eventType, data) {
  const cbs = listeners[eventType];
  if (cbs) cbs.forEach((cb) => cb(data));
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (!shouldConnect) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) connect(token);
  }, 3000);
}

export function connect(token) {
  shouldConnect = true;
  if (socket && socket.readyState === WebSocket.OPEN) return;
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  socket = new WebSocket(`${WS_BASE}/ws?token=${token}`);

  socket.onopen = () => {
    clearTimeout(reconnectTimer);
  };

  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      emit(msg.type, msg);
    } catch {}
  };

  socket.onclose = () => {
    if (shouldConnect) scheduleReconnect();
  };

  socket.onerror = () => {
    socket.close();
  };
}

export function disconnect() {
  shouldConnect = false;
  clearTimeout(reconnectTimer);
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

export function subscribe(eventType, callback) {
  if (!listeners[eventType]) listeners[eventType] = new Set();
  listeners[eventType].add(callback);
  return () => listeners[eventType].delete(callback);
}
