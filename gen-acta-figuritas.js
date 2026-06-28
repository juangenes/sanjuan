// Acta / informe de cierre de FIGURITAS — comunicación entre la organización y el
// 3er Grado. Las figuritas se vendieron en caja; lo recaudado se reparte 80% para
// el 3er Grado y 20% para la organización. Mismo estilo de marca que los demás
// reportes del San Juan. One-off: lee acta-figuritas-data.json (no versionado).
const fs = require('fs');
const { jsPDF } = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf');
const autoTablePlugin = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf-autotable').default;

const NAVY = [11, 46, 85];
const GOLD = [201, 138, 42];
const GREEN = [22, 121, 78];
const LIGHT = [240, 244, 248];
const M = 56;

const data = JSON.parse(fs.readFileSync('C:/wamp64/sanjuan/acta-figuritas-data.json', 'utf8'));

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');
const COBRO = { EFECTIVO: 'Efectivo', POS_DEBITO: 'POS Débito', POS_CREDITO: 'POS Crédito', QR: 'QR', TRANSFERENCIA: 'Transferencia', INFONET: 'QR Infonet' };
const fechaLarga = (iso) => {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[m - 1]} de ${y}`;
};

// ---- Agregados ----
const totUnidades = data.tipos.reduce((s, t) => s + t.unidades, 0);
const totMonto = data.tipos.reduce((s, t) => s + t.monto, 0);
const orgMonto = Math.round(totMonto * data.split_org);
const gradoMonto = totMonto - orgMonto;
const ticketProm = data.pedidos ? Math.round(totMonto / data.pedidos) : 0;
const horaPico = data.horas.reduce((a, h) => (h.monto > a.monto ? h : a), data.horas[0]);

// Logo
const logoBuf = fs.readFileSync('C:/wamp64/sanjuan/frontend/public/img/logo-pdf.png');
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
  doc.text(titulo, W - M, 22, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(subtitulo, W - M, 37, { align: 'right' });
}
function footer() {
  const page = doc.internal.getNumberOfPages();
  doc.setDrawColor(220);
  doc.line(M, H - 34, W - M, H - 34);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text('San Juan dice que sí 2026 · Cierre de Figuritas · 3er Grado', M, H - 22);
  doc.text(`Página ${page}`, W - M, H - 22, { align: 'right' });
}
function kpiCard(x, y, w, h, valor, etiqueta, color = NAVY) {
  doc.setFillColor(...LIGHT);
  doc.roundedRect(x, y, w, h, 6, 6, 'F');
  doc.setTextColor(...color);
  doc.setFont('helvetica', 'bold');
  let fz = 15;
  doc.setFontSize(fz);
  while (doc.getTextWidth(String(valor)) > w - 12 && fz > 8) { fz -= 0.5; doc.setFontSize(fz); }
  doc.text(String(valor), x + w / 2, y + 26, { align: 'center' });
  doc.setTextColor(90, 90, 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(etiqueta, x + w / 2, y + 42, { align: 'center' });
}

// ============================================================
// Página 1 — Portada + objeto + ventas por tipo
// ============================================================
let y = M + 4;
const lw = 120, lh = (lw * logoH) / logoW;
doc.addImage(logoDataUrl, 'PNG', (W - lw) / 2, y, lw, lh);
y += lh + 22;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(24);
doc.text('CIERRE DE FIGURITAS', W / 2, y, { align: 'center' });
y += 22;
doc.setFontSize(13);
doc.setTextColor(...GOLD);
doc.setFont('helvetica', 'normal');
doc.text('San Juan dice que sí 2026', W / 2, y, { align: 'center' });
y += 26;

// Datos del documento
doc.setFillColor(...LIGHT);
doc.roundedRect(M, y, W - M * 2, 70, 6, 6, 'F');
const lx = M + 18, vx = W - M - 18;
doc.setFontSize(10);
const meta = [
  ['Comunicación entre', `Organización San Juan 2026  y  ${data.grado}`],
  ['Jornada del evento', `Sábado ${fechaLarga(data.jornada)}`],
  ['Fecha de emisión', fechaLarga(data.emision)],
];
let my = y + 22;
meta.forEach(([k, v]) => {
  doc.setTextColor(110, 110, 110);
  doc.setFont('helvetica', 'normal');
  doc.text(k, lx, my);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.text(v, vx, my, { align: 'right' });
  my += 18;
});
y += 70 + 22;

// Objeto
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(12);
doc.text('Objeto', M, y);
y += 8;
doc.setLineHeightFactor(1.45);
doc.setFont('helvetica', 'normal');
doc.setFontSize(10.5);
doc.setTextColor(60, 60, 60);
const objeto =
  `Las figuritas del San Juan dice que sí 2026 se vendieron en la caja del evento. Conforme a lo acordado, ` +
  `lo recaudado por su venta se reparte 80% para el ${data.grado} y 20% para la organización. ` +
  `El presente informe detalla, de forma transparente, las ventas por tipo de figurita, el desglose por ` +
  `forma de pago y por hora, y el monto que corresponde transferir al ${data.grado}.`;
doc.text(doc.splitTextToSize(objeto, W - M * 2), M, y + 16);
doc.setLineHeightFactor(1.15);
y += 60;

// KPIs
const gap = 12, kw = (W - M * 2 - gap * 3) / 4, kh = 54;
kpiCard(M, y, kw, kh, fmtGs(totMonto), 'Recaudación total', GREEN);
kpiCard(M + (kw + gap), y, kw, kh, fmtNum(totUnidades), 'Figuritas vendidas');
kpiCard(M + (kw + gap) * 2, y, kw, kh, fmtNum(data.pedidos), 'Pedidos');
kpiCard(M + (kw + gap) * 3, y, kw, kh, fmtGs(ticketProm), 'Ticket promedio', GOLD);
y += kh + 24;

// Ventas por tipo
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Ventas por tipo de figurita', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Tipo', 'Precio', 'Unidades', 'Recaudación', '% del total']],
  body: data.tipos.map((t) => [
    t.titulo, fmtGs(t.precio), fmtNum(t.unidades), fmtGs(t.monto), pct(t.monto, totMonto),
  ]),
  foot: [['TOTAL', '', fmtNum(totUnidades), fmtGs(totMonto), '100%']],
  styles: { fontSize: 9.5, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: {
    0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' },
    3: { halign: 'right' }, 4: { halign: 'right' },
  },
  margin: { left: M, right: M },
});

footer();

// ============================================================
// Página 2 — Desglose por forma de pago y por hora
// ============================================================
doc.addPage();
drawHeader('Desglose de ventas', `${fmtNum(totUnidades)} figuritas · ${fmtGs(totMonto)}`);
y = M + 48;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Por forma de pago', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Forma de pago', 'Pedidos', 'Unidades', 'Recaudación', '% del total']],
  body: data.metodos.map((m) => [
    COBRO[m.metodo] || m.metodo, fmtNum(m.pedidos), fmtNum(m.unidades), fmtGs(m.monto), pct(m.monto, totMonto),
  ]),
  foot: [['TOTAL', fmtNum(data.pedidos), fmtNum(totUnidades), fmtGs(totMonto), '100%']],
  styles: { fontSize: 9.5, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 28;

// Recaudación por hora (barras verticales)
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Recaudación por hora', M, y);
y += 6;
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(110, 110, 110);
doc.text(`Ventas entre las ${data.rango_primera} y las ${data.rango_ultima} h (hora de Asunción).`, M, y + 12);
y += 26;
const chartX = M, chartW = W - M * 2, chartH = 150, baseY = y + chartH;
const maxH = Math.max(...data.horas.map((h) => h.monto));
const colW = chartW / data.horas.length;
data.horas.forEach((h, i) => {
  const bh = maxH ? (h.monto / maxH) * (chartH - 26) : 0;
  const bx = chartX + i * colW + colW * 0.2;
  const bw = colW * 0.6;
  const esPico = h.hora === horaPico.hora;
  doc.setFillColor(...(esPico ? GOLD : NAVY));
  doc.roundedRect(bx, baseY - bh, bw, bh, 3, 3, 'F');
  doc.setTextColor(...(esPico ? GOLD : NAVY));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(fmtGs(h.monto).replace('Gs. ', ''), bx + bw / 2, baseY - bh - 9, { align: 'center' });
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.text(`${fmtNum(h.unidades)} u`, bx + bw / 2, baseY - bh - 1, { align: 'center' });
  doc.setTextColor(90, 90, 90);
  doc.text(`${h.hora}:00`, bx + bw / 2, baseY + 12, { align: 'center' });
});
doc.setDrawColor(210);
doc.line(chartX, baseY, chartX + chartW, baseY);
y = baseY + 30;

doc.setFillColor(...LIGHT);
doc.roundedRect(M, y, W - M * 2, 30, 5, 5, 'F');
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(9);
doc.text('Hora pico', M + 12, y + 13);
doc.setTextColor(70, 70, 70);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.text(`Las ${horaPico.hora}:00 h concentraron la mayor recaudación: ${fmtGs(horaPico.monto)} (${fmtNum(horaPico.unidades)} figuritas).`, M + 12, y + 24);

footer();

// ============================================================
// Página 3 — Distribución 80/20 y monto a transferir
// ============================================================
doc.addPage();
drawHeader('Distribución de lo recaudado', `${fmtGs(totMonto)} · 80% ${data.grado} / 20% organización`);
y = M + 48;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('A dónde va lo recaudado en figuritas', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Destino', '%', 'Monto']],
  body: [
    [`Para el ${data.grado}`, '80%', fmtGs(gradoMonto)],
    ['Para la organización San Juan 2026', '20%', fmtGs(orgMonto)],
  ],
  foot: [['TOTAL RECAUDADO EN FIGURITAS', '100%', fmtGs(totMonto)]],
  styles: { fontSize: 10.5, cellPadding: 8 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: GOLD, textColor: 255, fontStyle: 'bold' },
  columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'center', cellWidth: 60 }, 2: { halign: 'right', fontStyle: 'bold' } },
  margin: { left: M, right: M },
  didParseCell: (d) => {
    if (d.section === 'body' && d.row.index === 0) {
      d.cell.styles.fillColor = [232, 244, 238];
      if (d.column.index === 2) d.cell.styles.textColor = GREEN;
    }
  },
});
y = doc.lastAutoTable.finalY + 22;

// Callout: monto a transferir al 3er grado
doc.setFillColor(...GREEN);
doc.roundedRect(M, y, W - M * 2, 70, 6, 6, 'F');
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'normal');
doc.setFontSize(10.5);
doc.text(`Monto a transferir al ${data.grado}`, M + 18, y + 24);
doc.setFont('helvetica', 'bold');
doc.setFontSize(26);
doc.text(fmtGs(gradoMonto), M + 18, y + 52);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
const datosTransf = [
  data.grado_responsable ? `Responsable: ${data.grado_responsable}` : null,
  data.grado_alias ? `Alias / cuenta: ${data.grado_alias}` : null,
].filter(Boolean).join('    ·    ');
if (datosTransf) doc.text(datosTransf, W - M - 18, y + 52, { align: 'right' });
y += 70 + 22;

// Tabla de transferencia (formato consistente con el acta de juegos)
autoTable({
  startY: y,
  head: [['Grado', 'Alias', 'Responsable', 'Monto a transferir']],
  body: [[data.grado, data.grado_alias || '—', data.grado_responsable || '—', fmtGs(gradoMonto)]],
  foot: [['TOTAL A TRANSFERIR', '', '', fmtGs(gradoMonto)]],
  styles: { fontSize: 9.5, cellPadding: 6.5 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 10.5 },
  columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 }, 3: { halign: 'right', fontStyle: 'bold', textColor: GREEN, cellWidth: 120 } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 16;

// Nota de transparencia (exclusión del cargo de prueba)
if (data.excluido_nota) {
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, W - M * 2, 30, 5, 5, 'F');
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Nota de transparencia', M + 12, y + 13);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(data.excluido_nota, M + 12, y + 24);
  y += 30;
}
y += 40;

// Firmas
doc.setDrawColor(180);
const fw = (W - M * 2 - 40) / 2;
doc.line(M, y + 30, M + fw, y + 30);
doc.line(M + fw + 40, y + 30, W - M, y + 30);
doc.setTextColor(90, 90, 90);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.text('Organización San Juan 2026', M, y + 44);
doc.text(`${data.grado}` + (data.grado_responsable ? ` · ${data.grado_responsable}` : ''), M + fw + 40, y + 44);

footer();

const out = 'C:/wamp64/sanjuan/Acta-Cierre-Figuritas-3erGrado.pdf';
fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('OK ->', out);
console.log(`Unidades: ${fmtNum(totUnidades)} | Recaudación: ${fmtGs(totMonto)} | 3er Grado (80%): ${fmtGs(gradoMonto)} | Org (20%): ${fmtGs(orgMonto)}`);
console.log(`Cuadre: ${gradoMonto + orgMonto === totMonto ? 'OK' : 'REVISAR'}`);
