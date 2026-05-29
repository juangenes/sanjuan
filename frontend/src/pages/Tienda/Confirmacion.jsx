import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { getPedido, getRetirosPedido, generarQrBancard, getEstadoBancard } from '../../api';
import toast from 'react-hot-toast';
import styles from './Confirmacion.module.css';

const ESTADO_LABEL = {
  PENDIENTE: { texto: 'Pendiente de pago', color: '#856404', bg: '#fff3cd' },
  PAGADO: { texto: '✅ Pagado', color: '#155724', bg: '#d4edda' },
};

// WhatsApp de la organización para recibir el comprobante de transferencia.
const WHATSAPP_ORG = '595981969339';
const WHATSAPP_ORG_FMT = '+595 981 969 339';

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
  const qrCanvasRef = useRef(null);

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

    return () => { cancelado = true; clearTimeout(timer); };
  }, [pedido?.idpedido, pedido?.estado, pedido?.metodo_pago, hash]);

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

  // Por transferencia y pendiente, el comprobante debe avisar a dónde mandar el pago.
  const muestraWhatsapp = pedido.estado === 'PENDIENTE' && !esInfonet;

  // Dibuja el comprobante (QR + datos + ítems + estado) en un canvas y lo devuelve.
  function construirComprobante(qrCanvas) {
    const items = pedido.items || [];
    const S = 2;            // factor de nitidez (retina)
    const W = 560;          // ancho lógico
    const cx = W / 2;
    const padX = 44;
    const azul = '#0B2E55', rojo = '#E63946', amarillo = '#FFCE00';
    const tmp = document.createElement('canvas');
    tmp.width = W * S;
    tmp.height = 1400 * S;
    const ctx = tmp.getContext('2d');
    ctx.scale(S, S);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, 1400);
    ctx.textBaseline = 'top';

    const center = (txt, y, font, color) => {
      ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center';
      ctx.fillText(txt, cx, y);
    };
    const divider = (y) => {
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(W - padX, y); ctx.stroke();
    };

    // Banda superior (marca)
    ctx.fillStyle = rojo; ctx.fillRect(0, 0, W, 88);
    center('San Juan Dice Que Si !!!', 30, '700 28px Georgia, serif', amarillo);
    center('06 jun 2026 · Colegio Torrefuerte', 66, '600 13px Inter, sans-serif', 'rgba(255,255,255,.85)');

    let y = 116;

    // Badge de estado
    const badge = pedido.estado === 'PAGADO'
      ? { bg: '#d4edda', fg: '#155724' } : { bg: '#fff3cd', fg: '#856404' };
    ctx.font = '700 15px Inter, sans-serif';
    const bw = ctx.measureText(estadoTexto).width + 44;
    const bx = cx - bw / 2;
    ctx.fillStyle = badge.bg;
    ctx.beginPath(); ctx.roundRect(bx, y, bw, 38, 19); ctx.fill();
    ctx.fillStyle = badge.fg; ctx.textAlign = 'center';
    ctx.fillText(estadoTexto, cx, y + 11);
    y += 38 + 26;

    // QR
    const qrSize = 240;
    ctx.drawImage(qrCanvas, cx - qrSize / 2, y, qrSize, qrSize);
    y += qrSize + 14;
    center(`Código: ${codigo}`, y, '700 20px Inter, sans-serif', azul);
    y += 30 + 18;
    divider(y); y += 22;

    // Datos del pedido (alineados a la izquierda)
    ctx.textAlign = 'left';
    const dato = (label, value) => {
      ctx.font = '700 15px Inter, sans-serif'; ctx.fillStyle = '#555';
      ctx.fillText(label, padX, y);
      const lw = ctx.measureText(label).width;
      ctx.font = '500 15px Inter, sans-serif'; ctx.fillStyle = '#1a1a1a';
      ctx.fillText(value, padX + lw + 8, y);
      y += 28;
    };
    dato('Nombre: ', String(pedido.familia || ''));
    dato('Contacto: ', String(pedido.contacto || ''));
    y += 2; divider(y); y += 16;

    // Ítems
    ctx.font = '800 12px Inter, sans-serif'; ctx.fillStyle = '#999';
    ctx.fillText('DETALLE DEL PEDIDO', padX, y); y += 24;
    items.forEach((it) => {
      ctx.textAlign = 'left'; ctx.font = '500 15px Inter, sans-serif'; ctx.fillStyle = '#1a1a1a';
      ctx.fillText(`${it.cantidad}x ${it.titulo}`, padX, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#555';
      ctx.fillText(`Gs. ${Number(it.subtotal).toLocaleString('es-PY')}`, W - padX, y);
      y += 26;
    });
    y += 6; divider(y); y += 16;

    // Total
    ctx.textAlign = 'left'; ctx.font = '800 18px Inter, sans-serif'; ctx.fillStyle = azul;
    ctx.fillText('Total', padX, y);
    ctx.textAlign = 'right'; ctx.fillStyle = rojo;
    ctx.fillText(`Gs. ${Number(pedido.total).toLocaleString('es-PY')}`, W - padX, y);
    y += 28 + 18;

    // Instrucción de pago por transferencia (solo si corresponde)
    if (muestraWhatsapp) {
      divider(y); y += 18;
      const boxY = y;
      ctx.fillStyle = '#e8f8ee';
      const lines = [
        'Pagá por transferencia y enviá el',
        'comprobante por WhatsApp al:',
      ];
      const boxH = 28 + lines.length * 20 + 30 + 16;
      ctx.beginPath(); ctx.roundRect(padX, boxY, W - padX * 2, boxH, 12); ctx.fill();
      let ty = boxY + 14;
      center('📲 ¿Cómo confirmo mi pedido?', ty, '800 14px Inter, sans-serif', '#15803d');
      ty += 26;
      lines.forEach((ln) => { center(ln, ty, '500 13px Inter, sans-serif', '#166534'); ty += 20; });
      center(WHATSAPP_ORG_FMT, ty + 4, '800 19px Inter, sans-serif', '#15803d');
      y = boxY + boxH + 16;
    }

    // Pie
    divider(y); y += 14;
    center('Mostrá este código / QR al retirar tu pedido', y, '500 12px Inter, sans-serif', '#999');
    y += 18;
    center('sanjuandicequesi.com', y, '700 12px Inter, sans-serif', azul);
    y += 24;

    // Recortar a la altura real
    const out = document.createElement('canvas');
    out.width = W * S; out.height = Math.round(y * S);
    const octx = out.getContext('2d');
    octx.fillStyle = '#fff'; octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(tmp, 0, 0);
    return out;
  }

  async function descargarComprobante() {
    const wrap = qrCanvasRef.current;
    const qrCanvas = wrap?.tagName === 'CANVAS' ? wrap : wrap?.querySelector('canvas');
    if (!qrCanvas) { toast.error('No se pudo generar el comprobante'); return; }
    setDescargando(true);
    try {
      const canvas = construirComprobante(qrCanvas);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('blob');
      const file = new File([blob], `pedido-${codigo}.png`, { type: 'image/png' });

      // Móvil: hoja de compartir nativa (permite "Guardar imagen" en la galería).
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Pedido ${codigo}` });
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return; // el usuario canceló
          // si share falla por otro motivo, caemos a la descarga directa
        }
      }
      // Desktop / fallback: descarga como archivo.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
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
            {qrPago ? (
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
            {/* El QR de retiro no se muestra en pantalla (nadie lo escanea acá);
                va dentro del comprobante descargable. Solo mostramos el código. */}
            <p className={styles.codigoTop}>Código de pedido: <strong>{codigo}</strong></p>

            {/* QR oculto en <canvas> para poder exportar el comprobante como imagen */}
            <div ref={qrCanvasRef} style={{ position: 'absolute', left: '-9999px', top: 0 }} aria-hidden="true">
              <QRCodeCanvas value={JSON.stringify({ hash, idpedido: pedido.idpedido })} size={480} />
            </div>

            <button
              className={styles.btnDescargar}
              onClick={descargarComprobante}
              disabled={descargando}
            >
              {descargando ? 'Generando tu pedido...' : '⬇️ Descargá tu pedido'}
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
            <h3>Pagá por transferencia</h3>
            <p className={styles.oAlternativa}>
              Envianos el comprobante de transferencia por WhatsApp. Cuando la organización pueda verificar que tu transferencia se haya recibido con éxito tu pedido será validado. En ese momento recibirás un mensaje de validación al número <strong>{telIntl}</strong>.
            </p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem',
                width: '100%', marginTop: '1rem', padding: '.9rem 1rem', borderRadius: '12px',
                background: '#25D366', color: '#fff', fontWeight: 800, fontSize: '1rem',
                textDecoration: 'none', boxSizing: 'border-box',
              }}
            >
              📲 Enviar mi transferencia por WhatsApp
            </a>
          </div>
        )}

        {pedido.estado === 'PAGADO' && (
          <p style={{ textAlign: 'center', color: '#155724', fontWeight: 700, marginTop: '1rem' }}>
            ✅ La organización validó tu pedido. Mostrá este código/QR al retirar.
          </p>
        )}
      </div>

      <button className={styles.btnVolver} onClick={() => navigate('/')}>
        ← Volver a la tienda
      </button>
    </div>
  );
}
