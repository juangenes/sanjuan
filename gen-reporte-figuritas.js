// Reporte de ventas de figuritas en caja — PDF para rendir a los padres.
// One-off: usa jspdf del frontend y el mismo estilo de marca que reporteGrado.
const fs = require('fs');
const path = require('path');
const { jsPDF } = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf');
const autoTablePlugin = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf-autotable').default;

const NAVY = [11, 46, 85];
const GOLD = [201, 138, 42];
const M = 56;

const data = JSON.parse(fs.readFileSync('C:/wamp64/sanjuan/figuritas-data.json', 'utf8'));
data.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id));

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const COBRO_LABEL = { EFECTIVO: 'Efectivo', POS_DEBITO: 'POS Débito', POS_CREDITO: 'POS Crédito', QR: 'QR', INFONET: 'QR Bancard', TRANSFERENCIA: 'Transferencia' };
const cobroLabel = (c) => COBRO_LABEL[c] || c || '—';
const figCorta = (t) => t.replace(/^Figuritas\s+/i, '');

// Logo como dataURL
const logoBuf = fs.readFileSync('C:/wamp64/sanjuan/frontend/public/img/logo-pdf.png');
const logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
// Dimensiones del PNG (IHDR: bytes 16-23)
const logoW = logoBuf.readUInt32BE(16);
const logoH = logoBuf.readUInt32BE(20);

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();
const autoTable = (opts) => autoTablePlugin(doc, opts);

// ---- Totales ----
const TIPOS = ['Figuritas Normales', 'Figuritas Cromadas', 'Figuritas Especiales'];
const PRECIO = { 'Figuritas Normales': 2500, 'Figuritas Cromadas': 5000, 'Figuritas Especiales': 10000 };
const porTipo = {}, porCobro = {};
let totUnid = 0, totMonto = 0;
const pedidosSet = new Set();
for (const r of data) {
  porTipo[r.figurita] = porTipo[r.figurita] || { unid: 0, monto: 0 };
  porTipo[r.figurita].unid += r.cantidad;
  porTipo[r.figurita].monto += r.monto;
  porCobro[r.cobro] = porCobro[r.cobro] || { ped: new Set(), unid: 0, monto: 0 };
  porCobro[r.cobro].ped.add(r.id);
  porCobro[r.cobro].unid += r.cantidad;
  porCobro[r.cobro].monto += r.monto;
  totUnid += r.cantidad;
  totMonto += r.monto;
  pedidosSet.add(r.id);
}

const fechas = data.map((r) => r.fecha).sort();
const primera = fechas[0]?.slice(11, 16);
const ultima = fechas[fechas.length - 1]?.slice(11, 16);
const diaTxt = (fechas[0] || '').slice(0, 10).split('-').reverse().join('/');

function drawHeader(titulo, subtitulo) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 50, 'F');
  const h = 30, w = (h * logoW) / logoH;
  try { doc.addImage(logoDataUrl, 'PNG', M, 10, w, h); } catch (e) {}
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(titulo, W - M, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitulo, W - M, 38, { align: 'right' });
}

// ============ Página 1: Carta + resumen ============
let y = M + 10;
const lw = Math.min(120, logoW);
const lh = (lw * logoH) / logoW;
doc.addImage(logoDataUrl, 'PNG', (W - lw) / 2, y, lw, lh);
y += lh + 24;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(22);
doc.text('San Juan dice que sí 2026', W / 2, y, { align: 'center' });
y += 22;
doc.setFont('helvetica', 'normal');
doc.setFontSize(12);
doc.setTextColor(...GOLD);
doc.text('Rendición de ventas — Figuritas', W / 2, y, { align: 'center' });
y += 40;

doc.setTextColor(40, 40, 40);
doc.setFontSize(12);
doc.setFont('helvetica', 'bold');
doc.text('Estimadas familias a cargo de las figuritas:', M, y);
y += 24;
doc.setFont('helvetica', 'normal');

const parrafos = [
  `A continuación les compartimos la rendición de las ventas de figuritas realizadas en caja durante la jornada del ${diaTxt}, entre las ${primera} y las ${ultima} hs.`,
  'El reporte incluye el resumen por tipo de figurita, la liquidación correspondiente y el detalle completo, venta por venta, para que puedan auditar cada operación.',
  'Todas las ventas listadas están cobradas y confirmadas. ¡Muchas gracias por su trabajo!',
];
doc.setFontSize(11.5);
doc.setLineHeightFactor(1.5);
for (const p of parrafos) {
  const lines = doc.splitTextToSize(p, W - M * 2);
  doc.text(lines, M, y);
  y += lines.length * 11.5 * 1.5 + 10;
}
doc.setLineHeightFactor(1.15);
y += 10;

// Resumen por tipo
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Resumen por tipo de figurita', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Figurita', 'Precio unit.', 'Unidades', 'Monto total']],
  body: TIPOS.filter((t) => porTipo[t]).map((t) => [
    figCorta(t), fmtGs(PRECIO[t]), porTipo[t].unid.toLocaleString('es-PY'), fmtGs(porTipo[t].monto),
  ]),
  foot: [['TOTAL', '', totUnid.toLocaleString('es-PY'), fmtGs(totMonto)]],
  styles: { fontSize: 10, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: [240, 244, 248], textColor: NAVY, fontStyle: 'bold' },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 24;

// Liquidación: 80% responsables de figuritas / 20% Organización San Juan TF 2026
const PCT_RESP = 80, PCT_ORG = 20;
const montoResp = Math.round(totMonto * PCT_RESP / 100);
const montoOrg = totMonto - montoResp; // el resto, para que sumen exacto el total
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Liquidación', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Concepto', 'Porcentaje', 'Monto']],
  body: [
    ['Responsables de las figuritas', `${PCT_RESP}%`, fmtGs(montoResp)],
    ['Organización San Juan TF 2026', `${PCT_ORG}%`, fmtGs(montoOrg)],
  ],
  foot: [['TOTAL RECAUDADO', '100%', fmtGs(totMonto)]],
  styles: { fontSize: 10, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: [240, 244, 248], textColor: NAVY, fontStyle: 'bold' },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  margin: { left: M, right: M },
});

// ============ Página 2+: Detalle pedido por pedido ============
doc.addPage();
drawHeader('Detalle pedido por pedido', `${pedidosSet.size} pedidos · ${data.length} líneas`);
autoTable({
  startY: M + 70,
  head: [['#', 'Pedido', 'Hora', 'Cliente / Familia', 'Operador', 'Figurita', 'Cant.', 'Monto']],
  body: data.map((r, i) => [
    i + 1, r.id, r.fecha.slice(11, 16), r.familia || '—', r.operador || '—',
    figCorta(r.figurita), r.cantidad.toLocaleString('es-PY'), fmtGs(r.monto),
  ]),
  foot: [['', '', '', '', '', 'TOTAL', totUnid.toLocaleString('es-PY'), fmtGs(totMonto)]],
  styles: { fontSize: 8, cellPadding: 3 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: [240, 244, 248], textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: [240, 244, 248] },
  columnStyles: {
    0: { halign: 'right', cellWidth: 24 }, 1: { halign: 'right', cellWidth: 38 },
    2: { cellWidth: 36 }, 6: { halign: 'right', cellWidth: 36 }, 7: { halign: 'right', cellWidth: 64 },
  },
  margin: { left: M, right: M },
  didDrawPage: () => {
    const page = doc.internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('San Juan 2026 · Figuritas (caja)', M, H - 24);
    doc.text(`Página ${page}`, W - M, H - 24, { align: 'right' });
  },
});

const out = 'C:/wamp64/sanjuan/Reporte-Figuritas-Caja.pdf';
fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('OK ->', out);
console.log(`Pedidos: ${pedidosSet.size} | Lineas: ${data.length} | Unidades: ${totUnid} | Monto: ${fmtGs(totMonto)}`);
