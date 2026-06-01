// Impresión directa a ticketera Epson (TM-m30II y compatibles) vía ePOS-Print.
//
// Cómo funciona: la impresora trae un servidor ePOS-Print embebido. Le mandamos
// un POST con un sobre SOAP/XML a:
//     http://<IP-IMPRESORA>/cgi-bin/epos/service.cgi?devid=local_printer
// y la impresora imprime y corta. No hace falta driver ni SDK en la tablet.
//
// CAVEAT (mixed content): una página servida por HTTPS NO puede hacer fetch a
// http://<ip>. Para usar esto en producción, abrí la caja por HTTP en la LAN
// (ej. http://192.168.1.50:5173) o en localhost (dev). Ver imprimirBoleta().
//
// La IP de la impresora se guarda en localStorage ('ticketera_ip') para que la
// caja la configure una sola vez. Papel asumido: 80mm = 48 columnas (fuente A).

const LS_KEY = 'ticketera_ip';
const ANCHO = 48; // columnas a 80mm, fuente A

const NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print';

export function getTicketeraIP() {
  return localStorage.getItem(LS_KEY) || '';
}

export function setTicketeraIP(ip) {
  if (ip) localStorage.setItem(LS_KEY, ip.trim());
  else localStorage.removeItem(LS_KEY);
}

// --- Helpers de armado del XML ---------------------------------------------

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Construye el cuerpo <epos-print> a partir de una lista de "comandos".
// Cada comando es un objeto: { text, align, bold, dw, dh, feed, cut }
function construirEposBody(comandos) {
  const partes = [];
  for (const c of comandos) {
    if (c.feed != null) {
      partes.push(`<feed line="${c.feed}"/>`);
      continue;
    }
    if (c.cut) {
      partes.push(`<cut type="feed"/>`);
      continue;
    }
    if (c.qr) {
      // QR centrado y vuelta a alineación izquierda para lo que siga.
      partes.push(`<text align="center"/>`);
      partes.push(`<symbol type="qrcode_model_2" level="level_l" width="6" height="6" size="0">${esc(c.qr)}</symbol>`);
      partes.push(`<text align="left"/>`);
      continue;
    }
    const attrs = [];
    if (c.align) attrs.push(`align="${c.align}"`);     // left | center | right
    if (c.bold) attrs.push(`em="true"`);
    if (c.dw) attrs.push(`dw="true"`);                 // doble ancho
    if (c.dh) attrs.push(`dh="true"`);                 // doble alto
    const a = attrs.length ? ' ' + attrs.join(' ') : '';
    partes.push(`<text${a}>${esc(c.text ?? '')}&#10;</text>`); // &#10; = salto de línea
  }
  return partes.join('');
}

function construirSobre(comandos) {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<s:Body>` +
    `<epos-print xmlns="${NS}">` +
    construirEposBody(comandos) +
    `</epos-print>` +
    `</s:Body>` +
    `</s:Envelope>`
  );
}

// Línea "etiqueta .......... valor" ajustada al ancho del papel.
function lineaLR(izq, der) {
  izq = String(izq);
  der = String(der);
  const espacio = Math.max(1, ANCHO - izq.length - der.length);
  return izq + ' '.repeat(espacio) + der;
}

function separador(ch = '-') {
  return ch.repeat(ANCHO);
}

// --- Envío -----------------------------------------------------------------

// Postea el job a la impresora y verifica la respuesta SOAP (success="true").
async function enviarAImpresora(ip, comandos) {
  const url = `http://${ip}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
  const xml = construirSobre(comandos);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '""',
    },
    body: xml,
  });

  const texto = await resp.text();
  // La impresora responde con <response success="true" code="" status=".."/>
  const success = /success="true"/.test(texto);
  if (!success) {
    const code = (texto.match(/code="([^"]*)"/) || [])[1] || 'desconocido';
    throw new Error(`La impresora rechazó el trabajo (code=${code})`);
  }
  return texto;
}

// --- API pública ------------------------------------------------------------

// Imprime la COMANDA INTERNA del expendio (para nuestro personal: qué entregar).
// No es para el comensal — el comensal ya tiene su ticket de pedido de la caja.
// `boleta` = { pedido, items } como lo devuelve getBoleta(); `meta` = { codigo, idot }.
export async function imprimirBoleta(boleta, meta) {
  const ip = getTicketeraIP();
  if (!ip) {
    const err = new Error('No hay IP de ticketera configurada');
    err.code = 'SIN_IP';
    throw err;
  }

  const { pedido, items } = boleta;
  const fecha = new Date().toLocaleString('es-PY');

  const comandos = [
    { text: 'COMANDA - EXPENDIO', align: 'center', bold: true, dw: true },
    { text: 'USO INTERNO', align: 'center' },
    { text: separador() },
    { text: `Codigo:  ${meta.codigo}` },
    { text: `Nombre:  ${pedido.familia || ''}` },
    { text: `Boleta:  ${String(meta.idot).substring(0, 8).toUpperCase()}` },
    { text: `Fecha:   ${fecha}` },
    { text: separador() },
    { text: 'ENTREGAR', bold: true },
    { text: separador() },
    // Cantidad bien grande a la izquierda para que el armador no se equivoque.
    ...items.map(it => ({ text: lineaLR(`${it.cantidad} x ${it.titulo}`, ''), bold: true })),
    { text: separador() },
    { feed: 3 },
    { cut: true },
  ];

  return enviarAImpresora(ip, comandos);
}

// Imprime el TICKET DE PEDIDO que se lleva el comensal (su comprobante para
// retirar en expendio). `data` = { codigo, hash, nombre, total, metodo, recibido,
// vuelto, operador, items:[{ titulo, cantidad, subtotal }] }.
// El QR (hash completo) lo escanea el lector del expendio para rutear el pedido.
export async function imprimirTicketPedido(data) {
  const ip = getTicketeraIP();
  if (!ip) {
    const err = new Error('No hay IP de ticketera configurada');
    err.code = 'SIN_IP';
    throw err;
  }

  const fecha = new Date().toLocaleString('es-PY');
  const gs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
  const items = data.items || [];

  const comandos = [
    { text: 'SAN JUAN DICE QUE SI', align: 'center', bold: true, dw: true },
    { text: 'Ticket de Pedido', align: 'center' },
    { text: separador() },
    ...(data.hash ? [{ qr: data.hash }] : []),
    { text: 'CODIGO DE RETIRO', align: 'center' },
    { text: data.codigo, align: 'center', bold: true, dw: true, dh: true },
    { text: separador() },
    { text: `Nombre:  ${data.nombre || 'Mostrador'}` },
    { text: `Fecha:   ${fecha}` },
    { text: `Cajero:  ${data.operador || ''}` },
    { text: separador() },
  ];

  for (const it of items) {
    comandos.push({ text: lineaLR(`${it.cantidad}x ${it.titulo}`, gs(it.subtotal)) });
  }
  comandos.push({ text: separador() });
  const metodoLabel = {
    EFECTIVO: 'Efectivo', POS_DEBITO: 'POS Debito', POS_CREDITO: 'POS Credito',
    QR: 'QR', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia',
  }[data.metodo] || data.metodo;
  comandos.push({ text: lineaLR('TOTAL', gs(data.total)), bold: true });
  comandos.push({ text: lineaLR('Metodo', metodoLabel) });
  if (data.metodo === 'EFECTIVO') {
    comandos.push({ text: lineaLR('Recibido', gs(data.recibido)) });
    comandos.push({ text: lineaLR('Vuelto', gs(data.vuelto)), bold: true });
  }

  comandos.push(
    { text: separador() },
    { feed: 1 },
    { text: '✓ PAGADO', align: 'center', bold: true, dw: true },
    { text: 'Retiralo en EXPENDIO', align: 'center' },
    { text: 'mostrando este codigo', align: 'center' },
    { feed: 3 },
    { cut: true },
  );

  return enviarAImpresora(ip, comandos);
}

// Ticket de prueba mínimo, para verificar la conexión con la impresora.
export async function imprimirPrueba() {
  const ip = getTicketeraIP();
  if (!ip) {
    const err = new Error('No hay IP de ticketera configurada');
    err.code = 'SIN_IP';
    throw err;
  }
  return enviarAImpresora(ip, [
    { text: 'PRUEBA DE TICKETERA', align: 'center', bold: true, dw: true },
    { text: separador() },
    { text: 'Conexion ePOS-Print OK', align: 'center' },
    { text: new Date().toLocaleString('es-PY'), align: 'center' },
    { feed: 3 },
    { cut: true },
  ]);
}
