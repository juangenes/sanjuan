import { useEffect, useState } from 'react';
import { getPedido } from '../../api';
import { metodoPago } from '../../utils/metodoPago';
import shared from './ModalPedido.module.css';
import admin from './Admin.module.css';
import styles from './ModalDetallePedido.module.css';

const fmtGs = n => 'Gs. ' + Number(n || 0).toLocaleString();
const fmtFecha = f => f
  ? new Date(f).toLocaleString('es-PY', { timeZone: 'America/Asuncion' })
  : '—';

const ORIGEN = { tienda: 'Tienda online', caja: 'Caja', totem: 'Tótem' };

function Campo({ label, children }) {
  return (
    <div className={styles.campo}>
      <span className={styles.lbl}>{label}</span>
      <span className={styles.val}>{children}</span>
    </div>
  );
}

// Modal de solo-lectura con TODO el detalle del pedido (datos que la tabla ya no
// muestra: método de pago, cobro en caja, Bancard, origen, ítems). Aloja también
// las acciones, que ahora viven acá en vez de saturar la fila.
//
// El estado vive en la lista del padre (`pedido`), por eso las acciones se
// reflejan al instante; el resto (ítems, cobro, bancard) viene del fetch completo.
export default function ModalDetallePedido({
  pedido, onClose, onPagar, onEditar, onAnular, onRestaurar,
  whatsappHref, onEnviarImagen, imgBusy,
}) {
  const [full, setFull] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    getPedido(pedido.hash)
      .then(d => { if (!cancel) setFull(d); })
      .catch(() => { if (!cancel) setFull(null); })
      .finally(() => { if (!cancel) setCargando(false); });
    return () => { cancel = true; };
  }, [pedido.hash]);

  const d = full || pedido;             // la lista alcanza para los datos base
  const pago = metodoPago(d);
  const codigo = pedido.hash.substring(0, 8).toUpperCase();
  const hayCobro = d.cobro_metodo || d.cobro_fecha || d.cobro_operador;
  const hayBancard = d.bancard_status || d.bancard_ticket || d.bancard_authorization;
  const vuelto = d.cobro_recibido != null
    ? Number(d.cobro_recibido) - Number(d.total)
    : null;

  return (
    <div className={shared.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${shared.modal} ${styles.modalWide}`}>
        <header className={shared.header}>
          <h2>Pedido #{pedido.idpedido} · {codigo}</h2>
          <button className={shared.cerrar} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className={shared.body}>
          <div className={styles.badges}>
            <span className={`${admin.badge} ${admin[pedido.estado.toLowerCase()]}`}>{pedido.estado}</span>
            <span className={styles.pagoBadge}>{pago.icon} {pago.label}</span>
          </div>

          <div className={styles.seccion}>Cliente</div>
          <Campo label="Nombre / familia">{d.familia || '—'}</Campo>
          <Campo label="Contacto">{d.contacto || '—'}</Campo>
          <Campo label="Cédula">{d.cedula || '—'}</Campo>

          <div className={styles.seccion}>Pedido</div>
          <Campo label="Fecha">{fmtFecha(d.fecha)}</Campo>
          <Campo label="Origen">{ORIGEN[d.origen] || '—'}</Campo>
          <Campo label="Total">{fmtGs(d.total)}</Campo>

          {hayCobro && (
            <>
              <div className={styles.seccion}>Cobro</div>
              <Campo label="Método">{pago.icon} {pago.label}</Campo>
              {d.cobro_recibido != null && <Campo label="Recibido">{fmtGs(d.cobro_recibido)}</Campo>}
              {vuelto != null && vuelto >= 0 && <Campo label="Vuelto">{fmtGs(vuelto)}</Campo>}
              {d.cobro_operador && <Campo label="Operador">{d.cobro_operador}</Campo>}
              {d.cobro_fecha && <Campo label="Fecha de cobro">{fmtFecha(d.cobro_fecha)}</Campo>}
            </>
          )}

          {hayBancard && (
            <>
              <div className={styles.seccion}>Bancard (QR)</div>
              {d.bancard_status && <Campo label="Estado">{d.bancard_status}</Campo>}
              {d.bancard_ticket && <Campo label="Ticket">{d.bancard_ticket}</Campo>}
              {d.bancard_authorization && <Campo label="Autorización">{d.bancard_authorization}</Campo>}
            </>
          )}

          <div className={styles.seccion}>Ítems</div>
          {cargando && <div className={styles.cargando}>Cargando ítems…</div>}
          {!cargando && full?.items?.length > 0 && (
            <div className={styles.items}>
              {full.items.map(it => (
                <div className={styles.item} key={it.idproducto}>
                  <span className={styles.cant}>{it.cantidad}×</span>
                  <span className={styles.tit}>{it.titulo}</span>
                  <span className={styles.sub}>{fmtGs(it.subtotal)}</span>
                </div>
              ))}
              <div className={styles.totalRow}>
                <span>Total</span><span>{fmtGs(d.total)}</span>
              </div>
            </div>
          )}
          {!cargando && (!full?.items || full.items.length === 0) && (
            <div className={styles.cargando}>Sin ítems</div>
          )}
        </div>

        <footer className={`${shared.footer} ${styles.acciones}`}>
          {pedido.estado === 'PENDIENTE' && (
            <button className={admin.btnPagar} onClick={() => onPagar(pedido)}>✓ Pagar</button>
          )}
          <button className={admin.btnEditar} onClick={() => onEditar(pedido)}>✎ Editar</button>
          {pedido.estado === 'ANULADO' ? (
            <button className={admin.btnRestaurar} onClick={() => onRestaurar(pedido)}>↺ Restaurar</button>
          ) : (
            <button className={admin.btnAnular} onClick={() => onAnular(pedido)}>✕ Anular</button>
          )}
          <a className={admin.btnWa} href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp</a>
          <button
            className={admin.btnWa}
            onClick={() => onEnviarImagen(pedido)}
            disabled={imgBusy === pedido.idpedido}
            title="Compartir imagen del comprobante por WhatsApp"
          >
            {imgBusy === pedido.idpedido ? '…' : '🖼 Imagen'}
          </button>
        </footer>
      </div>
    </div>
  );
}
