import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { getPedido, getRetirosPedido, generarQrBancard, getEstadoBancard, revertirBancard, prepararPedido } from '../../api';

// Tiempo de vida del QR de pago en pantalla. Pasado este tiempo sin acreditarse,
// reversamos el QR en Bancard (recomendación de Bancard: ~5 min + revert).
const QR_VIDA_MS = 5 * 60 * 1000;
import { compartirComprobante, compartirLinkPedido } from '../../utils/comprobante';
import toast from 'react-hot-toast';
import styles from './Confirmacion.module.css';

const ESTADO_LABEL = {
  PENDIENTE: { texto: 'Pendiente de pago', color: '#856404', bg: '#fff3cd' },
  PAGADO: { texto: '✅ Pagado', color: '#155724', bg: '#d4edda' },
};

// WhatsApp de la organización para recibir el comprobante de transferencia.
const WHATSAPP_ORG = '595981120287';

export default function Confirmacion() {
  const { hash } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [retiros, setRetiros] = useState([]);
  const [tab, setTab] = useState('pedido');
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [qrPago, setQrPago] = useState(null);   // cadena EMVCo del QR de Bancard
  const [qrError, setQrError] = useState(false);
  const [qrVencido, setQrVencido] = useState(false);
  const qrCanvasRef = useRef(null);

  // AUTORETIRO: cuánto de cada ítem pendiente quiere mandar a preparar (arranca
  // con todo lo pendiente). `confirmar` abre el modal "¿estás en el local?".
  const [prepCant, setPrepCant] = useState({}); // idproducto -> cantidad
  const [preparando, setPreparando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    Promise.all([
      getPedido(hash),
      getRetirosPedido(hash).catch(() => []),
    ])
      .then(([p, r]) => {
        setPedido(p);
        setRetiros(r);
      })
      .catch(() => toast.error('Pedido no encontrado'))
      .finally(() => setLoading(false));
  }, [hash]);

  // Pago con QR de Bancard (Infonet): genera el QR y hace polling del estado
  // mientras el pedido siga pendiente. Al confirmarse, la pantalla se actualiza sola.
  useEffect(() => {
    if (!pedido) return;
    const metodo = pedido.metodo_pago || 'TRANSFERENCIA';
    if (metodo !== 'INFONET' || pedido.estado !== 'PENDIENTE') return;

    let cancelado = false;
    let timer;

    generarQrBancard(hash)
      .then((r) => {
        if (cancelado) return;
        if (r.ya_pagado) { setPedido(p => ({ ...p, estado: 'PAGADO' })); return; }
        if (r.qr_data) setQrPago(r.qr_data);
        else setQrError(true);
      })
      .catch(() => { if (!cancelado) setQrError(true); });

    async function poll() {
      try {
        const r = await getEstadoBancard(hash);
        if (cancelado) return;
        if (r.pagado) {
          setPedido(p => ({ ...p, estado: 'PAGADO' }));
          toast.success('¡Pago confirmado!');
          return; // se acreditó: dejamos de pollear
        }
      } catch { /* reintentamos en el próximo ciclo */ }
      if (!cancelado) timer = setTimeout(poll, 4000);
    }
    timer = setTimeout(poll, 4000);

    // Vencimiento del QR: a los ~5 min sin acreditarse, reversamos en Bancard y
    // dejamos de pollear (el cliente puede recargar para generar uno nuevo).
    const vencer = setTimeout(() => {
      if (cancelado) return;
      cancelado = true;
      clearTimeout(timer);
      revertirBancard(hash).catch(() => {});
      setQrVencido(true);
    }, QR_VIDA_MS);

    return () => { cancelado = true; clearTimeout(timer); clearTimeout(vencer); };
  }, [pedido?.idpedido, pedido?.estado, pedido?.metodo_pago, hash]);

  // Por defecto, seleccionar TODO lo pendiente para preparar. Se recalcula cada
  // vez que cambia el pedido (carga inicial y refetch tras un autoretiro).
  useEffect(() => {
    const def = {};
    for (const it of pedido?.items || []) {
      if (it.pendiente > 0) def[it.idproducto] = it.pendiente;
    }
    setPrepCant(def);
  }, [pedido?.idpedido, pedido?.estado, pedido?.items]);

  if (loading) return <div className={styles.loading}>Cargando...</div>;
  if (!pedido) return <div className={styles.loading}>Pedido no encontrado</div>;

  const estado = ESTADO_LABEL[pedido.estado] || ESTADO_LABEL.PENDIENTE;
  const codigo = hash.substring(0, 8).toUpperCase();
  const metodo = pedido.metodo_pago || 'TRANSFERENCIA';
  const esInfonet = metodo === 'INFONET';
  // Pago con QR de Bancard aún pendiente: el QR de pago es lo principal,
  // el QR de retiro y el comprobante se muestran recién cuando está pagado.
  const esperandoPagoQr = esInfonet && pedido.estado === 'PENDIENTE';

  // Teléfono del pedido en formato internacional (+595...), sin el 0 inicial.
  const telDigits = (pedido.contacto || '').replace(/\D/g, '').replace(/^0/, '');
  const telIntl = telDigits ? `+595${telDigits}` : 'tu celular';

  // Texto de estado según método: por transferencia el pedido espera validación manual.
  const estadoTexto = pedido.estado === 'PENDIENTE'
    ? (esInfonet ? 'Pendiente (Infonet)' : 'Pendiente de validación')
    : estado.texto;

  // Mensaje pre-cargado para que el cliente avise su transferencia a la organización.
  const linkPedido = `${window.location.origin}/pedido/${hash}`;
  const lineasItems = (pedido.items || [])
    .map(i => `• ${i.cantidad}x ${i.titulo}`)
    .join('\n');
  const waMsg =
    `*SAN JUAN DICE QUE SI 2026*\n` +
    `🛒 Mi pedido ${codigo}\n` +
    `👤 ${pedido.familia}\n\n` +
    `${lineasItems}\n\n` +
    `Total: Gs. ${Number(pedido.total).toLocaleString('es-PY')}\n\n` +
    `Te envío mi transferencia para que me confirmes el pedido.\n` +
    `Ver pedido: ${linkPedido}`;
  const waHref = `https://wa.me/${WHATSAPP_ORG}?text=${encodeURIComponent(waMsg)}`;

  async function copiarAlias() {
    const alias = '981352935';
    try {
      await navigator.clipboard.writeText(alias);
      toast.success('Alias copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  // AUTORETIRO: ítems que todavía no se mandaron a preparar y selección actual.
  const pendientes = (pedido.items || []).filter(i => i.pendiente > 0);
  const hayPendientes = pendientes.length > 0;
  const totalSel = pendientes.reduce((a, it) => a + (prepCant[it.idproducto] || 0), 0);

  const incPrep = (id, max) =>
    setPrepCant(c => ({ ...c, [id]: Math.min((c[id] || 0) + 1, max) }));
  const decPrep = (id) =>
    setPrepCant(c => ({ ...c, [id]: Math.max((c[id] || 0) - 1, 0) }));

  async function preparar() {
    const items = pendientes
      .map(it => ({ idproducto: it.idproducto, cantidad: prepCant[it.idproducto] || 0 }))
      .filter(i => i.cantidad > 0);
    if (!items.length) { setConfirmar(false); return; }
    setPreparando(true);
    let ok = false;
    try {
      await prepararPedido(hash, items);
      ok = true;
      toast.success('¡Tu pedido se está preparando! 🔥');
    } catch (err) {
      // Típicamente saldo agotado por otra terminal (carrera). El backend ya
      // re-chequeó con lock; acá refrescamos para mostrar el saldo real.
      toast.error(err.response?.data?.error || 'No se pudo preparar el pedido');
    }
    // Siempre re-leemos el saldo: en éxito lo enviado pasa a RETIROS; en error
    // (p. ej. otra terminal se adelantó) los steppers reflejan lo que quedó.
    try {
      const [p, r] = await Promise.all([
        getPedido(hash),
        getRetirosPedido(hash).catch(() => []),
      ]);
      setPedido(p);
      setRetiros(r);
    } catch { /* si el refetch falla, dejamos el estado como estaba */ }
    if (ok) { setTab('retiros'); setConfirmar(false); }
    setPreparando(false);
  }

  async function guardarPedido() {
    try {
      const r = await compartirLinkPedido({ ...pedido, hash });
      if (r === 'copied') toast.success('Link copiado');
    } catch {
      toast.error('No se pudo compartir el link');
    }
  }

  async function descargarComprobante() {
    const wrap = qrCanvasRef.current;
    const qrCanvas = wrap?.tagName === 'CANVAS' ? wrap : wrap?.querySelector('canvas');
    if (!qrCanvas) { toast.error('No se pudo generar el comprobante'); return; }
    setDescargando(true);
    try {
      await compartirComprobante({ ...pedido, hash }, qrCanvas);
    } catch {
      toast.error('No se pudo generar el comprobante');
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>San Juan Dice Que Si !!!</h1>
      </header>

      <div className={styles.card}>
        <div className={styles.estadoBadge} style={{ background: estado.bg, color: estado.color }}>
          {estadoTexto}
        </div>

        {esperandoPagoQr ? (
          /* Pago con QR de Bancard pendiente: el QR de pago es lo principal */
          <div className={styles.pagoQrBox}>
            <h3 className={styles.pagoQrTitulo}>Pagá tu pedido</h3>
            <p className={styles.pagoQrMonto}>Gs. {Number(pedido.total).toLocaleString('es-PY')}</p>
            {qrVencido ? (
              <p className={styles.oAlternativa}>
                ⏳ El código QR venció por tiempo. <strong>Recargá la página</strong> para generar uno nuevo.
              </p>
            ) : qrPago ? (
              <>
                <div className={styles.qrWrap}>
                  <QRCodeSVG value={qrPago} size={220} />
                </div>
                <p className={styles.oAlternativa}>
                  Abrí <strong>Pago Móvil</strong> (o la app de tu banco) y escaneá este código.
                  La pantalla se actualiza sola cuando se acredite.
                </p>
                <div className={styles.esperandoPago}>⏳ Esperando confirmación del pago…</div>
              </>
            ) : qrError ? (
              <p className={styles.oAlternativa}>
                ⚠️ No pudimos generar el QR de pago en este momento. Recargá la página o intentá nuevamente.
              </p>
            ) : (
              <p className={styles.oAlternativa}>Generando QR de pago…</p>
            )}
          </div>
        ) : (
          <>
            <p className={styles.codigoTop}>Código de pedido: <strong>{codigo}</strong></p>

            {/* AUTORETIRO: el cliente elige cuánto de cada ítem pendiente quiere
                que le preparen ahora y lo manda a la pantalla de RETIRO. */}
            {pedido.dia_d && pedido.estado === 'PAGADO' && hayPendientes && (
              <div style={{
                margin: '0.25rem 0 1rem', padding: '1rem', borderRadius: 16,
                background: 'linear-gradient(180deg,#fff7ed 0%,#ffedd5 100%)',
                border: '2px solid #fb923c', boxSizing: 'border-box',
              }}>
                <h3 style={{ margin: '0 0 .25rem', fontSize: '1.15rem', fontWeight: 900, color: '#9a3412', textAlign: 'center' }}>
                  🔥 ¿Listo para retirar?
                </h3>
                <p style={{ margin: '0 0 .85rem', fontSize: '.85rem', color: '#9a3412', textAlign: 'center' }}>
                  Elegí cuánto querés que te preparen <strong>ahora</strong>.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {pendientes.map(it => {
                    const sel = prepCant[it.idproducto] || 0;
                    return (
                      <div key={it.idproducto} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: '.5rem', background: '#fff', borderRadius: 12, padding: '.5rem .65rem',
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {it.titulo}
                          </div>
                          <div style={{ fontSize: '.75rem', color: '#888' }}>
                            {it.pendiente} por retirar
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => decPrep(it.idproducto)}
                            disabled={sel <= 0}
                            style={{ width: 38, height: 38, borderRadius: 10, border: 'none', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer', background: '#f1f5f9', color: sel <= 0 ? '#cbd5e1' : '#0B2E55' }}
                          >−</button>
                          <span style={{ minWidth: 24, textAlign: 'center', fontSize: '1.25rem', fontWeight: 900, color: '#0B2E55' }}>{sel}</span>
                          <button
                            type="button"
                            onClick={() => incPrep(it.idproducto, it.pendiente)}
                            disabled={sel >= it.pendiente}
                            style={{ width: 38, height: 38, borderRadius: 10, border: 'none', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer', background: '#fed7aa', color: sel >= it.pendiente ? '#fbbf90' : '#9a3412' }}
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={totalSel === 0 || preparando}
                  onClick={() => setConfirmar(true)}
                  style={{
                    width: '100%', marginTop: '.85rem', padding: '1.1rem 1rem', borderRadius: 14,
                    border: 'none', boxSizing: 'border-box', cursor: totalSel === 0 ? 'default' : 'pointer',
                    background: totalSel === 0 ? '#d6d3d1' : 'linear-gradient(180deg,#fb923c 0%,#ea580c 100%)',
                    color: '#fff', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '.02em', textTransform: 'uppercase',
                    boxShadow: totalSel === 0 ? 'none' : '0 6px 0 #c2410c, 0 8px 18px rgba(0,0,0,.2)',
                  }}
                >
                  {preparando ? 'Enviando…' : `🔥 Preparáme mi pedido${totalSel > 0 ? ` (${totalSel} u.)` : ''}`}
                </button>
              </div>
            )}

            {/* Una vez pagado, mostramos el QR en pantalla para retirar: el
                expendio puede escanearlo directo del celular. */}
            {pedido.estado === 'PAGADO' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.5rem', margin: '0.5rem 0 1rem' }}>
                <div style={{ background: '#fff', padding: 12, borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,.12)' }}>
                  <QRCodeSVG value={linkPedido} size={220} />
                </div>
                <span style={{ fontSize: '.9rem', fontWeight: 700, color: '#0B2E55' }}>📲 Mostrá este QR al retirar tu pedido</span>
              </div>
            )}

            {/* QR oculto en <canvas> para poder exportar el comprobante como imagen */}
            <div ref={qrCanvasRef} style={{ position: 'absolute', left: '-9999px', top: 0 }} aria-hidden="true">
              <QRCodeCanvas value={linkPedido} size={480} />
            </div>

            {/* Acción principal: compartir el LINK al pedido. Es lo más útil
                porque abre la página viva (estado, QR de retiro). En móvil abre
                la hoja nativa (el cliente puede guardárselo en WhatsApp); en
                desktop copia el link. La imagen queda como opción secundaria. */}
            <button
              className={styles.btnGuardar}
              onClick={guardarPedido}
            >
              📤 Guardar mi pedido
            </button>

            <button
              className={styles.btnDescargar}
              onClick={descargarComprobante}
              disabled={descargando}
            >
              {descargando ? 'Generando…' : '🖼️ Ver comprobante (imagen)'}
            </button>
          </>
        )}

        <div className={styles.datosPedido}>
          <p><strong>Nombre:</strong> {pedido.familia}</p>
          <p><strong>Contacto:</strong> {pedido.contacto}</p>
          <p><strong>Total:</strong> Gs. {Number(pedido.total).toLocaleString('es-PY')}</p>
        </div>

        <div className={styles.tabsRow}>
          <button
            className={`${styles.tabBtn} ${tab === 'pedido' ? styles.tabActivo : ''}`}
            onClick={() => setTab('pedido')}
          >
            PEDIDO
          </button>
          <button
            className={`${styles.tabBtn} ${tab === 'retiros' ? styles.tabActivo : ''}`}
            onClick={() => setTab('retiros')}
          >
            RETIROS{retiros.length > 0 && <span className={styles.retirosBadge}>{retiros.length}</span>}
          </button>
        </div>

        {tab === 'pedido' && (
          <div className={styles.items}>
            {pedido.items?.map(item => (
              <div key={item.id} className={styles.itemLinea}>
                <span>{item.cantidad}x {item.titulo}</span>
                <span>Gs. {Number(item.subtotal).toLocaleString('es-PY')}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'retiros' && (
          <div className={styles.retirosWrap}>
            {retiros.length === 0 ? (
              <em className={styles.sinRetiros}>Aún no se realizaron retiros.</em>
            ) : (
              retiros.map((r, i) => (
                <div key={i} className={styles.retiroLinea}>
                  <span>
                    {r.titulo}
                    <span className={styles.retiroDetalle}> · {r.cantidad} u.</span>
                  </span>
                  <span className={styles.retiroFecha}>
                    {new Date(r.fecha).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {pedido.estado === 'PENDIENTE' && !esInfonet && (
          <div className={styles.instruccionesPago}>
            <h3>
              AHORA HACÉ LA TRANSFERENCIA POR EL MONTO DE<br />
              <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0a7d2c' }}>
                Gs. {Number(pedido.total).toLocaleString('es-PY')}
              </span>
            </h3>
            <button
              type="button"
              onClick={copiarAlias}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.25rem',
                width: '100%', margin: '1rem 0', padding: '1rem', borderRadius: '14px',
                background: '#fff8e1', border: '2px dashed #f0a500', cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: '.85rem', fontWeight: 700, letterSpacing: '.05em', color: '#8a6d00' }}>
                ALIAS
              </span>
              <strong style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '.02em', color: '#1a1a1a' }}>
                +595981352935
              </strong>
              <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#8a6d00' }}>
                📋 Tocá para copiar
              </span>
            </button>
            <p style={{ fontSize: '.85rem', color: '#777', textAlign: 'center', margin: '0 0 .5rem' }}>
              Banco Sudameris · Titular: Juan Genes
            </p>
            <p className={styles.oAlternativa} style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', margin: '.5rem 0' }}>
              ENVIÁ TU COMPROBANTE AL SIGUIENTE ENLACE 👇
            </p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem',
                width: '100%', marginTop: '1rem', padding: '1.1rem 1rem', borderRadius: '14px',
                background: 'linear-gradient(180deg, #2bdd6e 0%, #1ebd5a 100%)', color: '#fff',
                fontWeight: 900, fontSize: '1.35rem', letterSpacing: '.03em', textTransform: 'uppercase',
                textDecoration: 'none', boxSizing: 'border-box', border: 'none',
                boxShadow: '0 6px 0 #149246, 0 8px 18px rgba(0,0,0,.25)', cursor: 'pointer',
              }}
            >
              📲 CLICK AQUÍ
            </a>
          </div>
        )}

        {pedido.estado === 'PAGADO' && (
          <p style={{ textAlign: 'center', color: '#155724', fontWeight: 700, marginTop: '1rem' }}>
            ✅ La organización validó tu pedido. Mostrá este código/QR al retirar.
          </p>
        )}
      </div>

      <button
        className={styles.btnVolver}
        onClick={() => {
          // Si el cliente abandona el pago con QR pendiente, reversamos el QR en
          // Bancard antes de salir (recomendación: cancelar = revert).
          if (esperandoPagoQr && !qrVencido) revertirBancard(hash).catch(() => {});
          navigate('/');
        }}
      >
        ← Volver a la tienda
      </button>

      {/* Confirmación anti-disparo accidental: el link se comparte por WhatsApp/QR,
          así que pedimos confirmar que está en el local antes de mandar a cocina. */}
      {confirmar && (
        <div
          onClick={() => !preparando && setConfirmar(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 18, padding: '1.5rem', textAlign: 'center', boxSizing: 'border-box' }}
          >
            <div style={{ fontSize: '2.5rem' }}>📍</div>
            <h3 style={{ margin: '.5rem 0 .25rem', fontSize: '1.3rem', fontWeight: 900, color: '#9a3412' }}>
              ¿Estás en el local?
            </h3>
            <p style={{ margin: '0 0 1.25rem', color: '#555', fontSize: '.95rem' }}>
              Tu pedido empieza a prepararse <strong>ahora</strong> y no se puede cancelar.
            </p>
            <button
              type="button"
              disabled={preparando}
              onClick={preparar}
              style={{
                width: '100%', padding: '1rem', borderRadius: 12, border: 'none',
                background: 'linear-gradient(180deg,#fb923c 0%,#ea580c 100%)', color: '#fff',
                fontWeight: 900, fontSize: '1.15rem', cursor: 'pointer', boxSizing: 'border-box',
              }}
            >
              {preparando ? 'Enviando…' : `Sí, prepará (${totalSel} u.)`}
            </button>
            <button
              type="button"
              disabled={preparando}
              onClick={() => setConfirmar(false)}
              style={{
                width: '100%', marginTop: '.6rem', padding: '.85rem', borderRadius: 12,
                border: '1px solid #ddd', background: '#fff', color: '#666',
                fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxSizing: 'border-box',
              }}
            >
              Todavía no
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
