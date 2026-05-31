// Cliente del RTS (Socket.IO en rts.nuova.com.py). Usa el canal genérico
// `entity:changed` del namespace /planning: nos suscribimos a un scope
// (room de la estación) y recibimos el sobre cuando llega un pedido.
import { io } from 'socket.io-client';

const RTS_URL = (import.meta.env.VITE_RTS_URL || 'https://rts.nuova.com.py').replace(/\/$/, '');

// Suscribe a `scope` y llama onEvent(envelope) por cada entity:changed de ese
// `resource`. `onStatus(connected)` (opcional) reporta el estado de conexión.
// Re-suscribe automáticamente en cada reconexión. Devuelve cleanup.
export function suscribirScope(scope, resource, onEvent, onStatus) {
  const socket = io(`${RTS_URL}/planning`, { withCredentials: true });

  // 'connect' se dispara en cada (re)conexión: re-emitimos la suscripción
  // porque el servidor no conserva la room tras una reconexión.
  socket.on('connect', () => { onStatus?.(true); socket.emit('entity:subscribe', { scope }); });
  socket.on('disconnect', () => onStatus?.(false));

  socket.on('entity:changed', (env) => {
    if (!resource || env?.resource === resource) onEvent(env, socket);
  });

  return () => {
    try { socket.emit('entity:unsubscribe', { scope }); } catch { /* noop */ }
    socket.removeAllListeners();
    socket.disconnect();
  };
}
