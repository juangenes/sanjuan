// Informe de Cierre Financiero - San Juan dice que sí 2026
// Genera el PDF de cierre con la marca del evento (mismo estilo que reporteGrado/figuritas/caja).
const fs = require('fs');
const SCRATCH = '/tmp/claude-1000/-home-jgenes-dev-sanjuan/1a38dcc3-9007-4347-a4dc-3538127f52fd/scratchpad/node_modules';
const { jsPDF } = require(SCRATCH + '/jspdf');
const autoTablePlugin = require(SCRATCH + '/jspdf-autotable').default;

const NAVY = [11, 46, 85];
const GOLD = [201, 138, 42];
const GREEN = [22, 121, 78];
const RED = [176, 58, 46];
const LIGHT = [240, 244, 248];
const M = 56;

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const g = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;

// ============ DATOS DEL CIERRE ============
const INGRESOS = [
  ['Comida, bebidas, postres y demás ventas', 27414402],
  ['Juegos (acta de cierre · 2.505 créditos)', 19021000],
  ['Auspicio Banco BASA', 5000000],
  ['Entrada / portería', 3030000],
  ['Figuritas (3er grado · 187 unidades)', 1310000],
  ['Torneo de tapaditas (34 × 20.000)', 680000],
  ['Auspicio REMAX', 500000],
  ['Auspicio Cinthya Roa', 300000],
  ['Alquiler estructura de la cárcel', 300000],
  ['Sobrante rifa', 84700],
];
const COSTOS = [
  ['Comida (Asado Rojitas)', 6632500],
  ['Bebidas', 2524600],
  ['Mbeju', 1152000],
  ['Insumos y materiales', 1189100],
  ['Servicios (DJ + limpieza/mantenimiento)', 950000],
  ['Comisiones POS/QR + retención IVA', 816957],
  ['Gastos varios', 1364851],
  ['Combos de comida a invitados (cortesía)', 630000],
  ['Premios del evento', 500000],
  ['Mobiliario (sillas y mesas)', 476000],
  ['Helados', 445000],
  ['Postres', 389600],
];
const DISTRIB = [
  ['Juegos - a los grados (80%)', 12173600],
  ['Figuritas - al 3er grado (80%)', 1048000],
];
const TOT_ING = INGRESOS.reduce((a, r) => a + r[1], 0);
const TOT_COS = COSTOS.reduce((a, r) => a + r[1], 0);
const TOT_DIS = DISTRIB.reduce((a, r) => a + r[1], 0);
const QUEDO = 29169615;
const BANCO = { ini: 233559, ing: 53884212, egr: 24714597, fin: 29403174 };

// ============ Setup ============
const logoBuf = fs.readFileSync('/home/jgenes/dev/sanjuan/frontend/public/img/logo-pdf.png');
const logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
const logoW = logoBuf.readUInt32BE(16);
const logoH = logoBuf.readUInt32BE(20);

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();
const autoTable = (opts) => autoTablePlugin(doc, opts);

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
function footer(label) {
  const page = doc.internal.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(label, M, H - 24);
  doc.text(`Página ${page}`, W - M, H - 24, { align: 'right' });
}
function kpiCard(x, y, w, h, valor, etiqueta, color) {
  doc.setFillColor(...LIGHT);
  doc.roundedRect(x, y, w, h, 6, 6, 'F');
  doc.setTextColor(...color);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(String(valor), x + w / 2, y + 26, { align: 'center' });
  doc.setTextColor(90, 90, 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(etiqueta, x + w / 2, y + 44, { align: 'center' });
}

// ============ Página 1: Portada + resumen ============
let y = M + 2;
const lw = Math.min(120, logoW);
const lh = (lw * logoH) / logoW;
doc.addImage(logoDataUrl, 'PNG', (W - lw) / 2, y, lw, lh);
y += lh + 20;
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(22);
doc.text('San Juan dice que sí 2026', W / 2, y, { align: 'center' });
y += 22;
doc.setFont('helvetica', 'normal');
doc.setFontSize(13);
doc.setTextColor(...GOLD);
doc.text('Informe de Cierre Financiero', W / 2, y, { align: 'center' });
y += 16;
doc.setTextColor(110, 110, 110);
doc.setFontSize(10);
doc.text('Promo 2032 · Colegio Torrefuerte · Jornada del sábado 6 de junio de 2026', W / 2, y, { align: 'center' });
y += 26;

// KPIs
const gap = 12;
const kw = (W - M * 2 - gap * 3) / 4;
const kh = 54;
kpiCard(M, y, kw, kh, g(TOT_ING), 'Total ingresado', GREEN);
kpiCard(M + (kw + gap), y, kw, kh, g(TOT_COS), 'Total costos', RED);
kpiCard(M + (kw + gap) * 2, y, kw, kh, g(TOT_DIS), 'Repartido a grados', NAVY);
kpiCard(M + (kw + gap) * 3, y, kw, kh, g(QUEDO), 'Quedó en caja', GREEN);
y += kh + 24;

// Waterfall / resumen
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Resumen ejecutivo', M, y);
y += 8;
autoTable({
  startY: y,
  body: [
    ['Total ingresado (ventas + auspicios + alquiler)', fmtGs(TOT_ING)],
    ['(-) Total costos del evento', `(${fmtGs(TOT_COS)})`],
    ['(-) Distribución a los grados (juegos + figuritas)', `(${fmtGs(TOT_DIS)})`],
    ['= Resultado neto que quedó en la cuenta', fmtGs(QUEDO)],
  ],
  styles: { fontSize: 11, cellPadding: 8 },
  columnStyles: { 0: { cellWidth: W - M * 2 - 150 }, 1: { halign: 'right', cellWidth: 150, fontStyle: 'bold' } },
  didParseCell: (d) => {
    if (d.row.index === 3) { d.cell.styles.fillColor = NAVY; d.cell.styles.textColor = 255; d.cell.styles.fontStyle = 'bold'; d.cell.styles.fontSize = 12; }
  },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 24;

// Nota de control
doc.setTextColor(110, 110, 110);
doc.setFont('helvetica', 'italic');
doc.setFontSize(9);
doc.text('Informe conciliado contra el extracto bancario (cuenta Sudameris 1810787). Ya está todo pagado, rendido y repartido.', M, y);

footer('San Juan 2026 · Cierre Financiero');

// ============ Página 2: Ingresos ============
doc.addPage();
drawHeader('Ingresos', `Recaudación total · ${fmtGs(TOT_ING)}`);
y = M + 50;
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Recaudación por categoría', M, y);
y += 8;
autoTable({
  startY: y,
  head: [['Categoría', 'Monto', '% del total']],
  body: INGRESOS.map((r) => [r[0], fmtGs(r[1]), `${((r[1] / TOT_ING) * 100).toFixed(1)}%`]),
  foot: [['TOTAL INGRESOS', fmtGs(TOT_ING), '100%']],
  styles: { fontSize: 10, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 22;
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(12);
doc.text('Cómo se cobró (canales de pago)', M, y);
y += 6;
autoTable({
  startY: y,
  head: [['POS (tarjetas)', 'QR web', 'Efectivo cajas', 'Transferencias']],
  body: [[fmtGs(22362902), fmtGs(6228000), fmtGs(10014000), fmtGs(13450500)]],
  styles: { fontSize: 9, cellPadding: 6, halign: 'right' },
  headStyles: { fillColor: GOLD, textColor: 255, fontStyle: 'bold', halign: 'center' },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 10;
doc.setTextColor(110, 110, 110);
doc.setFont('helvetica', 'italic');
doc.setFontSize(8.5);
doc.text('Los canales suman lo mismo que las categorías (es la misma plata cobrada por distintas vías). POS (tarjetas): 5 terminales en la jornada.', M, y, { maxWidth: W - M * 2 });
footer('San Juan 2026 · Cierre Financiero');

// ============ Página 3: Costos ============
doc.addPage();
drawHeader('Costos', `Total costos · ${fmtGs(TOT_COS)}`);
y = M + 50;
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Gastos por grupo', M, y);
y += 8;
autoTable({
  startY: y,
  head: [['Grupo de costo', 'Monto', '% del total']],
  body: COSTOS.map((r) => [r[0], fmtGs(r[1]), `${((r[1] / TOT_COS) * 100).toFixed(1)}%`]),
  foot: [['TOTAL COSTOS', fmtGs(TOT_COS), '100%']],
  styles: { fontSize: 10, cellPadding: 6 },
  headStyles: { fillColor: RED, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: RED, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  margin: { left: M, right: M },
});
footer('San Juan 2026 · Cierre Financiero');

// ============ Página 4: Distribución + lo que quedó ============
doc.addPage();
drawHeader('Distribución y resultado', '80% al grado / 20% a la organización');
y = M + 50;
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Distribución a los grados (no es costo)', M, y);
y += 6;
doc.setFont('helvetica', 'normal');
doc.setFontSize(9.5);
doc.setTextColor(110, 110, 110);
doc.text('Lo recaudado en juegos y figuritas se reparte a cada grado. Ya fue transferido el 10/06.', M, y + 12);
y += 22;
autoTable({
  startY: y,
  head: [['Concepto', 'A los grados', 'A la organización']],
  body: [
    ['Juegos - demás grados (80/20)', fmtGs(12173600), fmtGs(3043400)],
    ['Juegos - 6° grado (100% organización)', fmtGs(0), fmtGs(1965000)],
    ['Créditos de juego no jugados', fmtGs(0), fmtGs(1839000)],
    ['Figuritas - 3er grado (80/20)', fmtGs(1048000), fmtGs(262000)],
  ],
  foot: [['TOTAL', fmtGs(13221600), fmtGs(7109400)]],
  styles: { fontSize: 10, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 24;

// Reconciliación bancaria
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Reconciliación de caja (cuenta Sudameris)', M, y);
y += 8;
autoTable({
  startY: y,
  body: [
    ['Saldo inicial (preexistente, no es del grado)', fmtGs(BANCO.ini)],
    ['(+) Ingresos del mes', fmtGs(BANCO.ing)],
    ['(-) Egresos del mes', `(${fmtGs(BANCO.egr)})`],
    ['= Saldo final de la cuenta', fmtGs(BANCO.fin)],
    ['(-) Saldo preexistente', `(${fmtGs(BANCO.ini)})`],
    ['= Resultado del evento', fmtGs(QUEDO)],
  ],
  styles: { fontSize: 10, cellPadding: 6 },
  columnStyles: { 0: { cellWidth: W - M * 2 - 150 }, 1: { halign: 'right', cellWidth: 150 } },
  didParseCell: (d) => {
    if (d.row.index === 5) { d.cell.styles.fillColor = LIGHT; d.cell.styles.textColor = NAVY; d.cell.styles.fontStyle = 'bold'; }
  },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 24;

// Callout final: lo que quedó
doc.setFillColor(...GREEN);
doc.roundedRect(M, y, W - M * 2, 70, 8, 8, 'F');
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'normal');
doc.setFontSize(11);
doc.text('Lo que quedó para la Promo 2032', W / 2, y + 24, { align: 'center' });
doc.setFont('helvetica', 'bold');
doc.setFontSize(28);
doc.text(g(QUEDO), W / 2, y + 54, { align: 'center' });

footer('San Juan 2026 · Cierre Financiero');

// ============ Guardar ============
const outputs = [
  '/home/jgenes/dev/sanjuan/Informe-Cierre-Financiero-2026.pdf',
  '/mnt/c/Users/jgene/Downloads/Informe-Cierre-Financiero-2026.pdf',
];
const buf = Buffer.from(doc.output('arraybuffer'));
for (const o of outputs) { try { fs.writeFileSync(o, buf); console.log('OK ->', o); } catch (e) { console.log('ERR', o, e.message); } }
console.log(`Ingresos ${fmtGs(TOT_ING)} | Costos ${fmtGs(TOT_COS)} | A grados ${fmtGs(TOT_DIS)} | Quedó ${fmtGs(QUEDO)}`);
