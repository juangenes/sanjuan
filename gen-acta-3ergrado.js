// Informe de cierre EXCLUSIVO del 3er Grado: combina sus dos ingresos del San
// Juan 2026 — el juego "El árbol de la suerte" y la venta de figuritas en caja —
// con el reparto 80% grado / 20% organización y el monto total a transferir.
// Mismo estilo de marca que los demás reportes. One-off: lee acta-3ergrado-data.json.
const fs = require('fs');
const { jsPDF } = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf');
const autoTablePlugin = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf-autotable').default;

const NAVY = [11, 46, 85];
const GOLD = [201, 138, 42];
const GREEN = [22, 121, 78];
const LIGHT = [240, 244, 248];
const M = 56;

const data = JSON.parse(fs.readFileSync('C:/wamp64/sanjuan/acta-3ergrado-data.json', 'utf8'));
const J = data.juego, F = data.figuritas;

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');
const COBRO = { EFECTIVO: 'Efectivo', POS_DEBITO: 'POS Débito', POS_CREDITO: 'POS Crédito', QR: 'QR', TRANSFERENCIA: 'Transferencia', INFONET: 'QR Infonet' };
const fechaLarga = (iso) => {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[m - 1]} de ${y}`;
};

// ---- Reparto (20% org redondeado; el grado recibe el resto, así siempre cuadra) ----
const reparto = (v) => { const org = Math.round(v * data.split_org); return { org, grado: v - org }; };
const jR = reparto(J.valor);
const fR = reparto(F.valor);
const totVal = J.valor + F.valor;
const totGrado = jR.grado + fR.grado;
const totOrg = jR.org + fR.org;
const figTot = F.tipos.reduce((s, t) => s + t.monto, 0);
const jPico = J.horas.reduce((a, h) => (h.monto > a.monto ? h : a), J.horas[0]);

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
  doc.text('San Juan dice que sí 2026 · Informe de cierre · 3er Grado', M, H - 22);
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
// Gráfico de barras verticales genérico (serie de {hora, monto, sub}).
function barChart(x, y, w, h, serie, fmtTop, fmtSub) {
  const baseY = y + h;
  const maxV = Math.max(...serie.map((s) => s.monto));
  const colW = w / serie.length;
  const pico = serie.reduce((a, s) => (s.monto > a.monto ? s : a), serie[0]);
  serie.forEach((s, i) => {
    const bh = maxV ? (s.monto / maxV) * (h - 26) : 0;
    const bx = x + i * colW + colW * 0.2, bw = colW * 0.6;
    const esPico = s === pico;
    doc.setFillColor(...(esPico ? GOLD : NAVY));
    doc.roundedRect(bx, baseY - bh, bw, bh, 3, 3, 'F');
    doc.setTextColor(...(esPico ? GOLD : NAVY));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(fmtTop(s), bx + bw / 2, baseY - bh - 9, { align: 'center' });
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(fmtSub(s), bx + bw / 2, baseY - bh - 1, { align: 'center' });
    doc.setTextColor(90, 90, 90);
    doc.text(`${s.hora}:00`, bx + bw / 2, baseY + 12, { align: 'center' });
  });
  doc.setDrawColor(210);
  doc.line(x, baseY, x + w, baseY);
}

// ============================================================
// Página 1 — Portada + resumen consolidado
// ============================================================
let y = M + 4;
const lw = 120, lh = (lw * logoH) / logoW;
doc.addImage(logoDataUrl, 'PNG', (W - lw) / 2, y, lw, lh);
y += lh + 22;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(25);
doc.text('INFORME DE CIERRE', W / 2, y, { align: 'center' });
y += 23;
doc.setFontSize(17);
doc.text(data.grado, W / 2, y, { align: 'center' });
y += 20;
doc.setFontSize(12);
doc.setTextColor(...GOLD);
doc.setFont('helvetica', 'normal');
doc.text('San Juan dice que sí 2026', W / 2, y, { align: 'center' });
y += 24;

// Meta
doc.setFillColor(...LIGHT);
doc.roundedRect(M, y, W - M * 2, 70, 6, 6, 'F');
const lx = M + 18, vx = W - M - 18;
doc.setFontSize(10);
const meta = [
  ['Comunicación entre', `Organización San Juan 2026  y  ${data.grado}`],
  ['Actividades del grado', `Juego "${J.nombre}"  +  Venta de figuritas`],
  ['Jornada del evento', `Sábado ${fechaLarga(data.jornada)}`],
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
y += 70 + 20;

// Objeto
doc.setLineHeightFactor(1.4);
doc.setFont('helvetica', 'normal');
doc.setFontSize(10.5);
doc.setTextColor(60, 60, 60);
const objeto =
  `El ${data.grado} participó del San Juan 2026 con dos actividades: el juego "${J.nombre}" y la venta de ` +
  `figuritas en la caja del evento. En ambas, lo recaudado se reparte 80% para el grado y 20% para la organización. ` +
  `Este informe consolida ambos ingresos y detalla el monto total que corresponde transferir al grado.`;
doc.text(doc.splitTextToSize(objeto, W - M * 2), M, y + 4);
doc.setLineHeightFactor(1.15);
y += 56;

// Resumen consolidado
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Resumen consolidado', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Actividad', 'Recaudación', '20% organización', '80% para el grado']],
  body: [
    [`Juego "${J.nombre}"`, fmtGs(J.valor), fmtGs(jR.org), fmtGs(jR.grado)],
    ['Venta de figuritas', fmtGs(F.valor), fmtGs(fR.org), fmtGs(fR.grado)],
  ],
  foot: [['TOTAL', fmtGs(totVal), fmtGs(totOrg), fmtGs(totGrado)]],
  styles: { fontSize: 10, cellPadding: 7 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: {
    0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' },
    3: { halign: 'right', fontStyle: 'bold', textColor: GREEN },
  },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 20;

// Headline: total a transferir
doc.setFillColor(...GREEN);
doc.roundedRect(M, y, W - M * 2, 64, 6, 6, 'F');
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'normal');
doc.setFontSize(11);
doc.text(`Total a transferir al ${data.grado}`, M + 18, y + 25);
doc.setFont('helvetica', 'bold');
doc.setFontSize(28);
doc.text(fmtGs(totGrado), M + 18, y + 53);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.text('Juego + figuritas (80% de lo recaudado)', W - M - 18, y + 53, { align: 'right' });

footer();

// ============================================================
// Página 2 — Detalle del juego
// ============================================================
doc.addPage();
drawHeader(`Juego · ${J.nombre}`, `${fmtNum(J.creditos)} créditos jugados · ${fmtGs(J.valor)}`);
y = M + 48;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Resumen del juego', M, y);
y += 6;
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(110, 110, 110);
doc.text(`Cada crédito es un juego efectivamente jugado en el puesto del grado. Actividad entre las ${J.rango_primera} y las ${J.rango_ultima} h.`, M, y + 12);
y += 24;

const gap = 12, kw = (W - M * 2 - gap * 3) / 4, kh = 54;
kpiCard(M, y, kw, kh, fmtGs(J.valor), 'Recaudación', GREEN);
kpiCard(M + (kw + gap), y, kw, kh, fmtNum(J.creditos), 'Créditos jugados');
kpiCard(M + (kw + gap) * 2, y, kw, kh, fmtNum(J.c7), 'A Gs. 7.000 (preventa)');
kpiCard(M + (kw + gap) * 3, y, kw, kh, fmtNum(J.c8), 'A Gs. 8.000 (jornada)');
y += kh + 24;

// Desglose por precio
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Créditos por precio', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Precio del crédito', 'Créditos', 'Recaudación', '% del total']],
  body: [
    ['Gs. 7.000 (preventa)', fmtNum(J.c7), fmtGs(J.c7 * 7000), pct(J.c7 * 7000, J.valor)],
    ['Gs. 8.000 (jornada)', fmtNum(J.c8), fmtGs(J.c8 * 8000), pct(J.c8 * 8000, J.valor)],
  ],
  foot: [['TOTAL', fmtNum(J.creditos), fmtGs(J.valor), '100%']],
  styles: { fontSize: 9.5, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 24;

// Gráfico por hora
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Actividad por hora', M, y);
y += 18;
barChart(M, y, W - M * 2, 130, J.horas, (s) => fmtNum(s.monto / 1000) + 'k', (s) => `${fmtNum(s.creditos)} cr`);
y += 130 + 28;

// 80/20 del juego
doc.setFillColor(...LIGHT);
doc.roundedRect(M, y, W - M * 2, 34, 5, 5, 'F');
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(10);
doc.text('Reparto del juego', M + 14, y + 14);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9.5);
doc.setTextColor(70, 70, 70);
doc.text(`Para el grado (80%): ${fmtGs(jR.grado)}      ·      Para la organización (20%): ${fmtGs(jR.org)}`, M + 14, y + 27);

footer();

// ============================================================
// Página 3 — Detalle de figuritas
// ============================================================
doc.addPage();
drawHeader('Venta de figuritas', `${fmtNum(F.unidades)} figuritas · ${fmtGs(F.valor)}`);
y = M + 48;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Ventas por tipo de figurita', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Tipo', 'Precio', 'Unidades', 'Recaudación', '% del total']],
  body: F.tipos.map((t) => [t.titulo, fmtGs(t.precio), fmtNum(t.unidades), fmtGs(t.monto), pct(t.monto, figTot)]),
  foot: [['TOTAL', '', fmtNum(F.unidades), fmtGs(F.valor), '100%']],
  styles: { fontSize: 9.5, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 22;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Por forma de pago', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Forma de pago', 'Pedidos', 'Unidades', 'Recaudación', '% del total']],
  body: F.metodos.map((m) => [COBRO[m.metodo] || m.metodo, fmtNum(m.pedidos), fmtNum(m.unidades), fmtGs(m.monto), pct(m.monto, F.valor)]),
  foot: [['TOTAL', fmtNum(F.pedidos), fmtNum(F.unidades), fmtGs(F.valor), '100%']],
  styles: { fontSize: 9.5, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 22;

// 80/20 de figuritas
doc.setFillColor(...LIGHT);
doc.roundedRect(M, y, W - M * 2, 34, 5, 5, 'F');
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(10);
doc.text('Reparto de figuritas', M + 14, y + 14);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9.5);
doc.setTextColor(70, 70, 70);
doc.text(`Para el grado (80%): ${fmtGs(fR.grado)}      ·      Para la organización (20%): ${fmtGs(fR.org)}`, M + 14, y + 27);
y += 34 + 16;

if (F.excluido_nota) {
  doc.setFillColor(252, 246, 232);
  doc.roundedRect(M, y, W - M * 2, 30, 5, 5, 'F');
  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Nota de transparencia', M + 12, y + 13);
  doc.setTextColor(80, 70, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(F.excluido_nota, M + 12, y + 24);
}

footer();

// ============================================================
// Página 4 — Transferencia y firmas
// ============================================================
doc.addPage();
drawHeader('Monto a transferir', `${data.grado} · ${fmtGs(totGrado)}`);
y = M + 50;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(16);
doc.text('TRANSFERENCIA AL 3ER GRADO', M, y);
y += 19;
doc.setFontSize(12);
doc.setTextColor(...GOLD);
doc.setFont('helvetica', 'normal');
doc.text('San Juan dice que sí 2026', M, y);
y += 24;

// Detalle por actividad + total
autoTable({
  startY: y,
  head: [['Concepto', 'Recaudación', 'Monto al grado (80%)']],
  body: [
    [`Juego "${J.nombre}"`, fmtGs(J.valor), fmtGs(jR.grado)],
    ['Venta de figuritas', fmtGs(F.valor), fmtGs(fR.grado)],
  ],
  foot: [['TOTAL A TRANSFERIR', fmtGs(totVal), fmtGs(totGrado)]],
  styles: { fontSize: 10, cellPadding: 7 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 11 },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold', textColor: GREEN } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 22;

// Datos de la cuenta
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Datos para la transferencia', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Grado', 'Alias / cuenta', 'Responsable', 'Monto a transferir']],
  body: [[data.grado, data.grado_alias || '—', data.grado_responsable || '—', fmtGs(totGrado)]],
  styles: { fontSize: 10, cellPadding: 7 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  columnStyles: { 0: { fontStyle: 'bold' }, 3: { halign: 'right', fontStyle: 'bold', textColor: GREEN } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 16;

doc.setFillColor(...LIGHT);
doc.roundedRect(M, y, W - M * 2, 28, 5, 5, 'F');
doc.setTextColor(70, 70, 70);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.text('Una vez realizada la transferencia, el comprobante se anexa al presente informe.', M + 12, y + 17);
y += 28 + 46;

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

const out = 'C:/wamp64/sanjuan/Informe-Cierre-3erGrado.pdf';
fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('OK ->', out);
console.log(`Juego: ${fmtGs(J.valor)} (grado ${fmtGs(jR.grado)}) | Figuritas: ${fmtGs(F.valor)} (grado ${fmtGs(fR.grado)})`);
console.log(`TOTAL al 3er Grado: ${fmtGs(totGrado)} | a la organización: ${fmtGs(totOrg)} | recaudación total: ${fmtGs(totVal)}`);
console.log(`Cuadre: ${totGrado + totOrg === totVal ? 'OK' : 'REVISAR'}`);
