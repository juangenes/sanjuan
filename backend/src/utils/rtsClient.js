// Cliente del RTS (servidor Socket.IO en rts.nuova.com.py). Notifica cambios
// usando el canal genérico `entity:changed`: POST /internal/entity-changed con
// el secret compartido. El RTS reenvía el sobre a la room scope:{nombre}.
//
// Importante: una falla al notificar NUNCA debe romper la operación de negocio
// (la cola en la base es la fuente de verdad). Por eso esto loguea y sigue.

const RTS_URL = (process.env.RTS_URL || 'https://rts.nuova.com.py').replace(/\/$/, '');
const SECRET = process.env.RTS_INTERNAL_SECRET || '';

async function notificarEntidad({ resource, action, id, scope, actor, meta }) {
  if (!SECRET) {
    console.warn('[rts] RTS_INTERNAL_SECRET no configurado — se omite la notificación realtime');
    return { ok: false, skipped: true };
  }
  try {
    const resp = await fetch(`${RTS_URL}/internal/entity-changed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': SECRET },
      body: JSON.stringify({ resource, action, id, scope, actor, meta }),
      // No colgar la request de negocio si el RTS no responde.
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) {
      console.warn(`[rts] /internal/entity-changed respondió ${resp.status}`);
      return { ok: false, status: resp.status };
    }
    return await resp.json().catch(() => ({ ok: true }));
  } catch (err) {
    console.warn('[rts] error notificando:', err.message);
    return { ok: false, error: err.message };
  }
}

// Notifica al panel de despacho (board en vivo de pedidos pagados y su estado).
// Fire-and-forget: self-catchea, no hay que await-earlo en el flujo de negocio.
function notificarDespacho(meta) {
  return notificarEntidad({ resource: 'expendio', action: 'despacho', scope: 'sanjuan-despacho', meta });
}

// Avisa a la pantalla de RETIRO que cayó una comanda nueva para imprimir/colgar.
// Scope único (no hay estaciones): todas las comandas van a la misma pantalla.
function notificarRetiro(meta) {
  return notificarEntidad({ resource: 'expendio', action: 'comanda', scope: 'sanjuan-retiro', meta });
}

module.exports = { notificarEntidad, notificarDespacho, notificarRetiro };
