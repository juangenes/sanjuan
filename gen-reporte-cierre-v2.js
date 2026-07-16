// Informe de Cierre Financiero v2 - San Juan dice que sí 2026
// Relato en etapas: Leticia (fondo inicial) -> Emma (tesoreria) -> Emma (cajas) -> Sudameris -> Totales.
// Solo titulos y tablas, sin textos explicativos. Deja intacto el PDF v1.
const fs = require('fs');
const SCRATCH = '/tmp/claude-1000/-home-jgenes-dev-sanjuan/2f0779b2-1c83-44a5-aee2-7e13109a194b/scratchpad/node_modules';
const { jsPDF } = require(SCRATCH + '/jspdf');
const autoTablePlugin = require(SCRATCH + '/jspdf-autotable').default;

const NAVY = [11, 46, 85];
const GOLD = [201, 138, 42];
const GREEN = [22, 121, 78];
const RED = [176, 58, 46];
const LIGHT = [240, 244, 248];
const M = 56;

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const g = fmtGs;
const fmtSigned = (n) => {
  if (n === '' || n === null || n === undefined) return '';
  const v = Number(n);
  return v < 0 ? `(${fmtGs(-v)})` : fmtGs(v);
};

// ============ DATOS ============
// Etapa 1 — Fondo inicial (tesoreria de Leticia Montiel)
const FONDO_LETICIA = [
  ['Aporte de las familias (22 × 300.000)', 6600000],
  ['Auspicio Cinthya Roa (peluquería/spa)', 300000],
  ['= Total recaudado en el fondo inicial', 6900000],
  ['(-) Comida Rojitas - anticipo 1 (04/05)', -4362500],
  ['(-) Seña mbeju', -1000000],
  ['(-) Café en cápsulas', -103600],
  ['= Saldo transferido a la tesorería de Emma', 1433900],
];
// Etapa 2 — Rendicion de tesoreria de Emma Dominguez (09/06)
const REND_EMMA = [
  ['23/05', 'Saldo recibido de Leticia Montiel', '', 1433900, 1433900],
  ['23/05', 'Saldo sobrante Aporte Rifa Mundial', '', 84700, 1518600],
  ['23/05', 'Bolsas, plásticos, bandejitas, alfajores', -513600, '', 1005000],
  ['30/05', 'Pago extra proveedor Rojitas (anticipo 2)', -2000000, '', -995000],
  ['31/05', 'Reposición recibida — Juan Genes', '', 942000, -53000],
  ['01/06', 'Auspicio Remax (vía Leticia Montiel)', '', 500000, 447000],
  ['04/06', 'Copipunto (400 pulseras + 400 tarjetas + diseño)', -675500, '', -228500],
  ['05/06', 'Helados', -445000, '', -673500],
  ['06/06', 'Mbeju — cancelación (Patricia Cantero)', -1152000, '', -1825500],
];
const REPONER_EMMA = [
  ['Saldo de la tesorería de Emma', 1825500],
  ['Postres (budín, maní con miel, batata)', 142100],
  ['= Total repuesto a Emma desde Sudameris (10/06)', 1967600],
];
// Etapa 3 — Rendicion de cajas del 06/06 (Emma recibio todas las cajas)
const CAJAS = [
  ['Caja 1 · Cinthya Roa', 1094000, 684000],
  ['Caja 2 · Leticia Montiel', 1542000, 61000],
  ['Caja 3 · José Vandeleis', 925000, 100000],
  ['Caja 4 · Emma Domínguez', 566000, 0],
  ['Caja 5 · Cristhyan Nordhoff', 4257000, 128000],
  ['Entrada · Nery Rivero', 1630000, 0],
];
const CAJA4_OTROS = [
  ['Reporte POS (Bancard)', 1377502],
  ['Combos comida invitados (14 × 45.000)', 630000],
  ['Pago Don Domingo', 150000],
];
const CAJAS_RESUMEN = [
  ['Total efectivo en cajas', 10014000],
  ['Transferencias recibidas de cajas', 973000],
  ['= Transferido a la cuenta Sudameris (SIPAP 09/06)', 10987000],
];
// Etapa 4 — Cuenta Sudameris
const INGRESOS = [
  ['Comida, bebidas, postres y demás ventas', 27414402],
  ['Juegos (acta de cierre · 2.505 créditos)', 19021000],
  ['Aporte inicial de las familias (22 × 300.000)', 6600000],
  ['Auspicio Banco BASA (vía APEI) - neto recibido', 4863636],
  ['Entrada / portería', 3030000],
  ['Figuritas (3er grado · 187 unidades)', 1310000],
  ['Torneo de tapaditas (34 × 20.000)', 680000],
  ['Auspicio REMAX', 500000],
  ['Auspicio Cinthya Roa (peluquería/spa)', 300000],
  ['Alquiler estructura de la cárcel', 300000],
  ['Sobrante rifa', 84700],
];
const CANALES = [17624251, 6228000, 10014000, 13450500];
const BANCO = { ini: 233559, ing: 53884212, egr: 24714597, fin: 29403174 };
// Etapa 5 — Totales del evento (sin combos: es merma, no gasto explícito)
const COSTOS = [
  ['Comida (Asado Rojitas)', 6362500],
  ['Bebidas', 2524600],
  ['Mbeju (seña 1.000.000 + cancelación 1.152.000)', 2152000],
  ['Insumos y materiales', 1189100],
  ['Servicios (DJ + limpieza/mantenimiento)', 950000],
  ['Comisiones POS/QR', 680593],
  ['Gastos varios (incl. café en cápsulas)', 1468451],
  ['Premios del evento', 500000],
  ['Mobiliario (sillas y mesas)', 476000],
  ['Helados', 445000],
  ['Postres', 389600],
];
const DISTRIB = [
  ['Juegos - demás grados (80/20)', 12173600, 3043400],
  ['Juegos - 6° grado (100% organización)', 0, 1965000],
  ['Créditos de juego no jugados', 0, 1839000],
  ['Figuritas - 3er grado (80/20)', 1048000, 262000],
];

const TOT_ING = INGRESOS.reduce((a, r) => a + r[1], 0); // 64.103.738
const TOT_COS = COSTOS.reduce((a, r) => a + r[1], 0);   // 17.137.844 (sin combos)
const TOT_DIS = DISTRIB.reduce((a, r) => a + r[1], 0);   // 13.221.600
const QUEDO = 29169615;

// ============ Setup ============
const logoBuf = fs.readFileSync('/home/jgenes/dev/sanjuan/frontend/public/img/logo-pdf.png');
const logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
const logoW = logoBuf.readUInt32BE(16);
const logoH = logoBuf.readUInt32BE(20);

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();
const autoTable = (opts) => autoTablePlugin(doc, opts);
const RW = W - M * 2; // ancho útil

function drawHeader(titulo) {
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
  doc.text('San Juan 2026 · Cierre Financiero', W - M, 38, { align: 'right' });
  return M + 44;
}
function footer() {
  const page = doc.internal.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text('San Juan dice que sí 2026 · Promo 2032', M, H - 24);
  doc.text(`Página ${page}`, W - M, H - 24, { align: 'right' });
}
function label(text, y, color) {
  doc.setTextColor(...(color || NAVY));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(text, M, y);
  return y + 8;
}
function kpiCard(x, y, w, h, valor, etiqueta, color) {
  doc.setFillColor(...LIGHT);
  doc.roundedRect(x, y, w, h, 6, 6, 'F');
  doc.setTextColor(...color);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(String(valor), x + w / 2, y + 26, { align: 'center' });
  doc.setTextColor(90, 90, 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(etiqueta, x + w / 2, y + 44, { align: 'center' });
}

// ============ Página 1: Leticia Montiel · Fondo Inicial ============
let y = drawHeader('Leticia Montiel · Fondo Inicial');
autoTable({
  startY: y + 6,
  head: [['Movimiento del fondo inicial', 'Monto']],
  body: FONDO_LETICIA.map((r) => [r[0], fmtSigned(r[1])]),
  styles: { fontSize: 11, cellPadding: 9 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  columnStyles: { 0: { cellWidth: RW - 160 }, 1: { halign: 'right', cellWidth: 160 } },
  didParseCell: (d) => {
    if (d.section !== 'body') return;
    if (d.row.index === 2 || d.row.index === 6) { d.cell.styles.fillColor = LIGHT; d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = NAVY; }
    if (d.column.index === 1 && String(d.cell.raw).startsWith('(')) d.cell.styles.textColor = RED;
  },
  margin: { left: M, right: M },
});
footer();

// ============ Página 2: Rendición · Emma Domínguez (tesorería) ============
doc.addPage();
y = drawHeader('Rendición · Emma Domínguez');
autoTable({
  startY: y + 6,
  head: [['Fecha', 'Detalle', 'Egreso', 'Ingreso', 'Saldo']],
  body: REND_EMMA.map((r) => [r[0], r[1], fmtSigned(r[2]), fmtSigned(r[3]), fmtSigned(r[4])]),
  foot: [['', 'TOTALES', `(${fmtGs(4786100)})`, fmtGs(2960600), `(${fmtGs(1825500)})`]],
  styles: { fontSize: 9.5, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  didParseCell: (d) => {
    if (d.column.index >= 2 && String(d.cell.raw).startsWith('(')) d.cell.styles.textColor = RED;
  },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 22;
y = label('Importes a reponer a Emma', y);
autoTable({
  startY: y,
  body: REPONER_EMMA.map((r) => [r[0], fmtGs(r[1])]),
  styles: { fontSize: 10, cellPadding: 7 },
  columnStyles: { 0: { cellWidth: RW - 160 }, 1: { halign: 'right', cellWidth: 160 } },
  didParseCell: (d) => {
    if (d.row.index === 2) { d.cell.styles.fillColor = LIGHT; d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = NAVY; }
  },
  margin: { left: M, right: M },
});
footer();

// ============ Página 3: Rendición de Cajas · Emma Domínguez (06/06) ============
doc.addPage();
y = drawHeader('Rendición de Cajas · Emma Domínguez');
y = label('Valores entregados por cajeros (06/06/2026)', y + 4);
autoTable({
  startY: y,
  head: [['Caja / Responsable', 'Efectivo', 'Transferencia', 'Total']],
  body: CAJAS.map((r) => [r[0], fmtGs(r[1]), r[2] ? fmtGs(r[2]) : '—', fmtGs(r[1] + r[2])]),
  foot: [['TOTAL', fmtGs(10014000), fmtGs(973000), fmtGs(10987000)]],
  styles: { fontSize: 10, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 20;
y = label('Otros valores registrados en Caja 4 (Emma)', y);
autoTable({
  startY: y,
  body: CAJA4_OTROS.map((r) => [r[0], fmtGs(r[1])]),
  styles: { fontSize: 10, cellPadding: 6 },
  columnStyles: { 0: { cellWidth: RW - 160 }, 1: { halign: 'right', cellWidth: 160 } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 20;
y = label('Transferido a la cuenta Sudameris', y);
autoTable({
  startY: y,
  body: CAJAS_RESUMEN.map((r) => [r[0], fmtGs(r[1])]),
  styles: { fontSize: 10.5, cellPadding: 7 },
  columnStyles: { 0: { cellWidth: RW - 180 }, 1: { halign: 'right', cellWidth: 180 } },
  didParseCell: (d) => {
    if (d.row.index === 2) { d.cell.styles.fillColor = GOLD; d.cell.styles.textColor = 255; d.cell.styles.fontStyle = 'bold'; }
  },
  margin: { left: M, right: M },
});
footer();

// ============ Página 4: Cuenta Sudameris ============
doc.addPage();
y = drawHeader('Cuenta Sudameris');
y = label('Ingresos', y + 4);
autoTable({
  startY: y,
  head: [['Categoría', 'Monto', '%']],
  body: INGRESOS.map((r) => [r[0], fmtGs(r[1]), `${((r[1] / TOT_ING) * 100).toFixed(1)}%`]),
  foot: [['TOTAL INGRESOS', fmtGs(TOT_ING), '100%']],
  styles: { fontSize: 9.5, cellPadding: 5 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 16;
y = label('Canales de cobro', y);
autoTable({
  startY: y,
  head: [['POS Bancard (vía APEI)', 'QR web (Sudameris)', 'Efectivo cajas', 'Transferencias']],
  body: [CANALES.map(fmtGs)],
  styles: { fontSize: 9, cellPadding: 5, halign: 'right' },
  headStyles: { fillColor: GOLD, textColor: 255, fontStyle: 'bold', halign: 'center' },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 16;
y = label('Control de la cuenta (extracto Sudameris)', y);
autoTable({
  startY: y,
  body: [
    ['Saldo inicial (preexistente, no es de la Promo)', fmtGs(BANCO.ini)],
    ['(+) Ingresos del período', fmtGs(BANCO.ing)],
    ['(-) Egresos del período (incluye reposición a Emma)', `(${fmtGs(BANCO.egr)})`],
    ['= Saldo final de la cuenta al 28/06', fmtGs(BANCO.fin)],
    ['(-) Saldo preexistente', `(${fmtGs(BANCO.ini)})`],
    ['= Resultado neto de la Promo 2032', fmtGs(QUEDO)],
  ],
  styles: { fontSize: 10.5, cellPadding: 6 },
  columnStyles: { 0: { cellWidth: RW - 170 }, 1: { halign: 'right', cellWidth: 170, fontStyle: 'bold' } },
  didParseCell: (d) => {
    if (d.row.index === 5) { d.cell.styles.fillColor = NAVY; d.cell.styles.textColor = 255; d.cell.styles.fontStyle = 'bold'; d.cell.styles.fontSize = 12; }
  },
  margin: { left: M, right: M },
});
footer();

// ============ Página 5: Totales del evento + KPIs ============
doc.addPage();
y = drawHeader('Totales del evento');
y = label('Costos del evento', y + 4);
autoTable({
  startY: y,
  head: [['Grupo de costo', 'Monto', '%']],
  body: COSTOS.map((r) => [r[0], fmtGs(r[1]), `${((r[1] / TOT_COS) * 100).toFixed(1)}%`]),
  foot: [['TOTAL COSTOS', fmtGs(TOT_COS), '100%']],
  styles: { fontSize: 9.5, cellPadding: 5 },
  headStyles: { fillColor: RED, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: RED, fontStyle: 'bold' },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 18;
y = label('Distribución a los grados (80% grado / 20% organización)', y);
autoTable({
  startY: y,
  head: [['Concepto', 'A los grados', 'A la organización']],
  body: DISTRIB.map((r) => [r[0], fmtGs(r[1]), fmtGs(r[2])]),
  foot: [['TOTAL', fmtGs(13221600), fmtGs(7109400)]],
  styles: { fontSize: 9.5, cellPadding: 5 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 26;

// KPIs (movidos a la hoja final)
const gap = 12;
const kw = (RW - gap * 3) / 4;
const kh = 54;
kpiCard(M, y, kw, kh, g(TOT_ING), 'Total ingresado', GREEN);
kpiCard(M + (kw + gap), y, kw, kh, g(TOT_COS), 'Total costos', RED);
kpiCard(M + (kw + gap) * 2, y, kw, kh, g(TOT_DIS), 'Repartido a grados', NAVY);
kpiCard(M + (kw + gap) * 3, y, kw, kh, g(QUEDO), 'Quedó en cuenta', GREEN);
footer();

// ============ Guardar ============
const outputs = [
  '/home/jgenes/dev/sanjuan/Informe-Cierre-Financiero-2026-v2.pdf',
  '/mnt/c/Users/jgene/Downloads/Informe-Cierre-Financiero-2026-v2.pdf',
];
const buf = Buffer.from(doc.output('arraybuffer'));
for (const o of outputs) { try { fs.writeFileSync(o, buf); console.log('OK ->', o); } catch (e) { console.log('ERR', o, e.message); } }
console.log(`Ingresos ${fmtGs(TOT_ING)} | Costos ${fmtGs(TOT_COS)} | A grados ${fmtGs(TOT_DIS)} | Quedó ${fmtGs(QUEDO)}`);
