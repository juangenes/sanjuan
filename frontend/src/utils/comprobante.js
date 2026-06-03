// Generación del comprobante del pedido como imagen (canvas).
// Compartido entre la página pública /pedido/:hash (Confirmacion) y el panel
// de admin (AdminPedidos), para que ambos generen exactamente la misma imagen.

// WhatsApp de la organización que se imprime en el comprobante de transferencia.
const WHATSAPP_ORG_FMT = '+595 981 120 287';

// Dibuja el comprobante (QR + datos + ítems + estado) en un canvas y lo devuelve.
// `pedido` debe incluir: hash, items, estado, familia, contacto, total, metodo_pago.
// `qrCanvas` es el <canvas> del QR de retiro (de qrcode.react) ya renderizado.
export function construirComprobante(pedido, qrCanvas) {
  const items = pedido.items || [];
  const metodo = pedido.metodo_pago || 'TRANSFERENCIA';
  const esInfonet = metodo === 'INFONET';
  const codigo = (pedido.hash || '').substring(0, 8).toUpperCase();
  const estadoTexto = pedido.estado === 'PENDIENTE'
    ? (esInfonet ? 'Pendiente (Infonet)' : 'Pendiente de validación')
    : '✅ Pagado';
  // Por transferencia y pendiente, el comprobante avisa a dónde mandar el pago.
  const muestraWhatsapp = pedido.estado === 'PENDIENTE' && !esInfonet;

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
      'Transferí el monto de tu pedido al',
      'Alias 0981352935 y luego enviá el',
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

// Genera el comprobante y lo comparte: en móvil abre la hoja de compartir nativa
// (con la imagen adjunta de verdad), en desktop descarga el PNG como fallback.
// Devuelve 'shared' | 'cancelled' | 'downloaded'.
export async function compartirComprobante(pedido, qrCanvas) {
  const codigo = (pedido.hash || '').substring(0, 8).toUpperCase();
  const canvas = construirComprobante(pedido, qrCanvas);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('No se pudo generar la imagen');
  const file = new File([blob], `pedido-${codigo}.png`, { type: 'image/png' });

  // Móvil: hoja de compartir nativa (permite elegir WhatsApp y adjuntar la imagen).
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Pedido ${codigo}` });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'; // el usuario canceló
      // si share falla por otro motivo, caemos a la descarga directa
    }
  }
  // Desktop / fallback: descarga como archivo.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

// Comparte el LINK al pedido (no la imagen). Esto es lo realmente útil: el link
// abre la página viva del pedido (estado actual, QR de retiro, etc.), a
// diferencia de la imagen que queda congelada. En móvil abre la hoja de
// compartir nativa para que el cliente lo guarde donde quiera (p.ej.
// reenviárselo a sí mismo por WhatsApp). En desktop / sin Web Share, copia el
// link al portapapeles. Devuelve 'shared' | 'cancelled' | 'copied'.
export async function compartirLinkPedido(pedido) {
  const codigo = (pedido.hash || '').substring(0, 8).toUpperCase();
  const link = `${window.location.origin}/pedido/${pedido.hash}`;
  const texto =
    `🛒 Mi pedido ${codigo} — San Juan Dice Que Si\n${link}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: `Pedido ${codigo}`, text: texto, url: link });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'; // el usuario canceló
      // si share falla por otro motivo, caemos a copiar al portapapeles
    }
  }
  await navigator.clipboard.writeText(link);
  return 'copied';
}
