// Impresión vía el DRIVER DE WINDOWS (window.print), para ticketeras conectadas
// por USB que NO tienen IP de red — ej. Epson TM-T20IVL en USB001.
//
// Cómo funciona: armamos el ticket como una página HTML angosta (80mm) dentro de
// un iframe oculto y llamamos a print(). El navegador lo manda a la impresora
// PREDETERMINADA de Windows (el mismo camino que cuando imprimís desde cualquier
// programa). No hay POST por red, así que NO hay problema de "mixed content":
// funciona igual abriendo la pantalla por HTTPS (sanjuandicequesi.com).
//
// Para que el ticket salga SOLO (sin el cartel de «Imprimir») y corte el papel,
// en la PC de la ticketera hay que dejar configurado UNA sola vez:
//   1. Poné la TM-T20IVL como impresora PREDETERMINADA de Windows.
//   2. En las preferencias del driver Epson, activá el corte de papel al final
//      de cada documento (Document → "Cut each page" / "Auto cut").
//   3. Abrí Chrome con el modo kiosko de impresión (imprime directo, sin diálogo):
//        chrome.exe --kiosk-printing https://sanjuandicequesi.com/retiro
//      (sin ese flag igual imprime, pero muestra el diálogo de impresión cada vez).
//
// El método de impresión (USB/Windows vs Red/IP) se guarda en localStorage para
// que cada PC lo elija una sola vez. Ver getModoImpresion()/setModoImpresion().

const ANCHO_MM = 80; // ancho del papel térmico

const LS_MODO = 'ticketera_modo';

// 'usb' = driver de Windows (window.print, este módulo) · 'red' = ePOS por IP.
// Por defecto 'usb': es lo que usa la PC con la TM-T20IVL conectada por USB.
export function getModoImpresion() {
  const m = localStorage.getItem(LS_MODO);
  return m === 'red' ? 'red' : 'usb';
}

export function setModoImpresion(modo) {
  if (modo === 'red' || modo === 'usb') localStorage.setItem(LS_MODO, modo);
}

// --- Helpers ----------------------------------------------------------------

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Ícono de fogata (SVG vectorial → imprime nítido en la térmica, sin depender de
// fuentes ni emojis). Relleno negro. `s` = tamaño en px.
function fogataSVG(s) {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="#000" ` +
    `xmlns="http://www.w3.org/2000/svg"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3` +
    `-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153` +
    `.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
}

// Estilos del ticket de 80mm — estética "restaurante": wordmark con fogata arriba,
// el código en una caja NEGRA invertida (lo más llamativo) y los ítems prolijos.
// Ancho fijo y sin márgenes de página para que la térmica no recorte ni agregue
// hojas en blanco. print-color-adjust:exact hace que los fondos negros salgan llenos.
const ESTILOS = `
  @page { size: ${ANCHO_MM}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${ANCHO_MM}mm;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: #000; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* Padding lateral generoso: las térmicas tienen ~4mm no-imprimibles a cada lado;
     con menos margen se come la línea izquierda de los recuadros. */
  .t { padding: 3mm 5mm 5mm; text-align: center; }

  .brand { margin-bottom: 1mm; }
  .brand svg { display: block; margin: 0 auto .3mm; }
  .bname { font-size: 24px; font-weight: 900; letter-spacing: 2px; line-height: 1; }
  .btag { font-size: 14px; font-weight: 700; letter-spacing: 1px; margin-top: .6mm; }

  .rule { border-top: 2px solid #000; margin: 2mm 0; }
  .dash { border-top: 1px dashed #000; margin: 2mm 0; }

  .codebox { background: #000; color: #fff; border-radius: 6px; padding: 1.8mm 2mm 2.4mm; margin: 1.5mm 0; }
  .codelbl { font-size: 11px; font-weight: 700; letter-spacing: 5px; }
  .code { font-size: 48px; font-weight: 900; letter-spacing: 2px; line-height: 1.02;
          font-family: "Consolas", "Cascadia Mono", monospace; }

  /* Código de PEDIDO: secundario, para cruzar la comanda con la compra del cliente. */
  .pedido { font-size: 15px; font-weight: 800; letter-spacing: 3px; margin: .5mm 0 1mm;
            font-family: "Consolas", "Cascadia Mono", monospace; }
  .meta { font-size: 13px; font-weight: 600; }

  .items { text-align: left; margin: 1mm 0 0; }
  .item { display: flex; align-items: center; gap: 2.2mm; margin: 1.6mm 0; }
  .item .chk { flex: none; width: 6mm; height: 6mm; border: 1.6px solid #000; border-radius: 2px; }
  .item .q { flex: none; min-width: 7mm; height: 7mm; line-height: 6.7mm; text-align: center;
             font-size: 15px; font-weight: 800; border: 1.5px solid #000; border-radius: 4px; }
  .item .n { font-size: 14px; font-weight: 700; line-height: 1.15; }

  .foot { font-size: 12px; font-weight: 700; margin-top: 1mm;
          display: flex; align-items: center; justify-content: center; gap: 2mm; }
`;

// Lanza la impresión de un documento HTML completo a través del driver de Windows.
// Renderiza en un iframe oculto, imprime y limpia. Resuelve al terminar (o tras un
// timeout de seguridad, porque onafterprint no siempre dispara en modo kiosko).
function imprimirHTML(html) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    let terminado = false;
    const limpiar = () => {
      if (terminado) return;
      terminado = true;
      setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* noop */ } }, 1000);
      resolve();
    };

    try {
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    } catch (err) {
      try { document.body.removeChild(iframe); } catch { /* noop */ }
      reject(err);
      return;
    }

    const win = iframe.contentWindow;
    win.onafterprint = limpiar;

    // Pequeña espera para que el iframe termine de renderizar antes de imprimir.
    setTimeout(() => {
      try {
        win.focus();
        win.print();
        // Respaldo: si onafterprint no llega (kiosko), resolvemos igual.
        setTimeout(limpiar, 1500);
      } catch (err) {
        try { document.body.removeChild(iframe); } catch { /* noop */ }
        reject(err);
      }
    }, 150);
  });
}

// --- Documentos -------------------------------------------------------------

// Comanda de RETIRO (modelo fast food), estética restaurante. Mismo contenido que
// imprimirComandaRetiro de eposPrint.js pero como HTML para el driver de Windows.
// `comanda` = { numero, codigo, familia, creado_en, items:[{ titulo, cantidad }] }
function comandaRetiroHTML(comanda) {
  const d = comanda.creado_en ? new Date(comanda.creado_en) : new Date();
  const hora = d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
  const nombre = (comanda.familia || '').trim() || 'Mostrador';
  const numero = comanda.numero ?? comanda.id ?? '';
  const items = comanda.items || [];
  const filas = items
    .map(it => `<div class="item"><span class="chk"></span>` +
      `<span class="q">${esc(it.cantidad)}</span>` +
      `<span class="n">${esc(it.titulo)}</span></div>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>${ESTILOS}</style></head>` +
    `<body><div class="t">` +
    `<div class="brand">${fogataSVG(34)}` +
      `<div class="bname">SAN JUAN 2026</div>` +
      `<div class="btag">Promo 2032</div>` +
    `</div>` +
    `<div class="rule"></div>` +
    `<div class="codebox">` +
      `<div class="codelbl">RETIRO</div>` +
      `<div class="code">#${esc(String(numero))}</div>` +
    `</div>` +
    `<div class="pedido">PEDIDO ${esc(String(comanda.codigo || '').toUpperCase())}</div>` +
    `<div class="meta">${esc(nombre)} &middot; ${esc(hora)}</div>` +
    `<div class="dash"></div>` +
    `<div class="items">${filas}</div>` +
    `<div class="dash"></div>` +
    `<div class="foot">${fogataSVG(14)} ¡Buen provecho! ${fogataSVG(14)}</div>` +
    `</div></body></html>`;
}

// --- API pública ------------------------------------------------------------

// Imprime la comanda de RETIRO por el driver de Windows (impresora predeterminada).
export async function imprimirComandaRetiroWeb(comanda) {
  return imprimirHTML(comandaRetiroHTML(comanda));
}

// Comanda de muestra para el botón de prueba (misma plantilla, datos ficticios).
export const COMANDA_PRUEBA = {
  id: 'prueba',
  numero: '000',
  codigo: 'PRUEBA01',
  familia: 'Mostrador',
  creado_en: null,
  items: [
    { cantidad: 2, titulo: 'Chorizo a la parrilla' },
    { cantidad: 1, titulo: 'Gaseosa 500 ml' },
    { cantidad: 3, titulo: 'Empanada' },
  ],
};
