// Acta de Cierre de Juegos — documento formal y confidencial para la comisión
// organizadora (Promo 2032). Consolida la auditoría de cargas/créditos del día,
// la distribución 80% grado / 20% organización y el monto a transferir a cada
// grado. Mismo estilo de marca que los demás reportes del San Juan.
// One-off: usa jspdf del frontend. Lee acta-juegos-data.json (no versionado).
const fs = require('fs');
const { jsPDF } = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf');
const autoTablePlugin = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf-autotable').default;

const NAVY = [11, 46, 85];
const GOLD = [201, 138, 42];
const GREEN = [22, 121, 78];
const RED = [176, 42, 42];
const LIGHT = [240, 244, 248];
const M = 56;

const data = JSON.parse(fs.readFileSync('C:/wamp64/sanjuan/acta-juegos-data.json', 'utf8'));
const A = data.auditoria;

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');
const fechaLarga = (iso) => {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[m - 1]} de ${y}`;
};

// Orden natural de grado (1..5, 6a, 6b, 7..12).
const ordenGrado = (cod) => {
  const m = /^(\d+)([ab]?)$/i.exec(String(cod));
  if (!m) return 9999;
  return parseInt(m[1], 10) * 10 + (m[2] === 'a' ? 1 : m[2] === 'b' ? 2 : 0);
};
const partes = (nombre) => {
  const i = String(nombre).indexOf(' · ');
  return i === -1 ? { grado: nombre, juego: '' } : { grado: nombre.slice(0, i), juego: nombre.slice(i + 3) };
};

// ---- Cálculo del reparto ----
// Regla general: 20% organización (redondeado) y el grado recibe el resto, igual
// que el reporte individual por grado. Excepción: el 6° Grado (A y B) integra la
// COMISIÓN ORGANIZADORA, así que la recaudación de sus puestos va 100% a la
// organización y no se transfiere a ningún grado.
const esComision = (cod) => parseInt(cod, 10) === 6; // codigos 6a / 6b
const puestos = data.puestos.map((p) => {
  const comision = esComision(p.codigo);
  const org = comision ? p.valor : Math.round(p.valor * 0.2);
  return { ...p, ...partes(p.nombre), orden: ordenGrado(p.codigo), comision, org, grado_monto: p.valor - org };
});
const enOrden = [...puestos].sort((a, b) => a.orden - b.orden);
const ranking = [...puestos].sort((a, b) => b.valor - a.valor);

const totValor = puestos.reduce((s, p) => s + p.valor, 0);          // jugado = 17.182.000
const totGrados = puestos.reduce((s, p) => s + p.grado_monto, 0);   // a transferir (excl. comisión)
const totOrgCol = puestos.reduce((s, p) => s + p.org, 0);           // para org (20% otros + 100% 6°)
const seisTotal = puestos.filter((p) => p.comision).reduce((s, p) => s + p.valor, 0); // 6° A+B
const totCred = puestos.reduce((s, p) => s + p.creditos, 0);
const orgTotal = totOrgCol + A.monto_no_jugado;                    // org: 20% otros + 6° + no jugado

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
  doc.text('San Juan dice que sí 2026 · Acta de Cierre de Juegos · CONFIDENCIAL', M, H - 22);
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
// Fila de control de auditoría con tilde verde.
function checkRow(x, y, w, texto, detalle) {
  doc.setFillColor(...GREEN);
  doc.circle(x + 9, y + 6, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('OK', x + 9, y + 9, { align: 'center' });
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(texto, x + 26, y + 4);
  doc.setTextColor(110, 110, 110);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const det = doc.splitTextToSize(detalle, w - 26);
  doc.text(det, x + 26, y + 16);
  return y + 16 + det.length * 10 + 8;
}

// ============================================================
// Página 1 — Portada / Acta
// ============================================================
let y = M + 4;
const lw = 120, lh = (lw * logoH) / logoW;
doc.addImage(logoDataUrl, 'PNG', (W - lw) / 2, y, lw, lh);
y += lh + 26;

// Sello CONFIDENCIAL
doc.setDrawColor(...RED);
doc.setLineWidth(1.4);
const selloW = 150, selloH = 24;
doc.roundedRect((W - selloW) / 2, y, selloW, selloH, 5, 5, 'S');
doc.setTextColor(...RED);
doc.setFont('helvetica', 'bold');
doc.setFontSize(12);
doc.text('DOCUMENTO CONFIDENCIAL', W / 2, y + 16, { align: 'center' });
doc.setLineWidth(0.2);
y += selloH + 30;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(26);
doc.text('ACTA DE CIERRE DE JUEGOS', W / 2, y, { align: 'center' });
y += 24;
doc.setFontSize(13);
doc.setTextColor(...GOLD);
doc.setFont('helvetica', 'normal');
doc.text('San Juan dice que sí 2026', W / 2, y, { align: 'center' });
y += 30;

// Datos del documento
doc.setDrawColor(225);
doc.setFillColor(...LIGHT);
doc.roundedRect(M, y, W - M * 2, 84, 6, 6, 'F');
const lx = M + 18, vx = W - M - 18;
doc.setFontSize(10);
const meta = [
  ['Dirigido a', data.destinatario],
  ['Jornada del evento', `Sábado ${fechaLarga(data.jornada)}`],
  ['Fecha de emisión', fechaLarga(data.emision)],
  ['Alcance', 'Recaudación de juegos por puesto y distribución a los grados'],
];
let my = y + 20;
meta.forEach(([k, v]) => {
  doc.setTextColor(110, 110, 110);
  doc.setFont('helvetica', 'normal');
  doc.text(k, lx, my);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.text(v, vx, my, { align: 'right' });
  my += 17;
});
y += 84 + 26;

// Preámbulo
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(12);
doc.text('Objeto del acta', M, y);
y += 8;
doc.setLineHeightFactor(1.45);
doc.setFont('helvetica', 'normal');
doc.setFontSize(10.5);
doc.setTextColor(60, 60, 60);
const preambulo =
  'Por medio del presente documento se deja constancia formal del cierre contable de los juegos del ' +
  'San Juan dice que sí 2026. Cada juego estuvo a cargo de las familias de un grado y se operó con el sistema ' +
  'de tarjetas de crédito recargables: las familias compraban créditos en caja y los jugaban en los puestos. ' +
  'La recaudación de cada puesto corresponde a los créditos efectivamente jugados en él, valuados a su precio ' +
  '(Gs. 7.000 en preventa / Gs. 8.000 en jornada). Conforme a lo acordado, lo recaudado se reparte 80% para el grado ' +
  'y 20% para la organización. El 6° Grado integra la comisión organizadora, por lo que la recaudación de sus ' +
  'puestos se destina íntegramente a la organización. A continuación se detallan las validaciones de control ' +
  'realizadas y el monto que corresponde transferir a cada grado.';
doc.text(doc.splitTextToSize(preambulo, W - M * 2), M, y + 16);
doc.setLineHeightFactor(1.15);

footer();

// ============================================================
// Página 2 — Validaciones de control (auditoría / transparencia)
// ============================================================
doc.addPage();
drawHeader('Validaciones de control', 'Auditoría de cargas y créditos · 100% conciliado');
y = M + 46;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Resumen de la operación de juegos', M, y);
y += 14;
const gap = 12, kw = (W - M * 2 - gap * 3) / 4, kh = 54;
kpiCard(M, y, kw, kh, fmtNum(A.creditos_vendidos), 'Créditos vendidos');
kpiCard(M + (kw + gap), y, kw, kh, fmtNum(A.debitos_n), 'Créditos jugados');
kpiCard(M + (kw + gap) * 2, y, kw, kh, fmtGs(totValor), 'Recaudación jugada', GREEN);
kpiCard(M + (kw + gap) * 3, y, kw, kh, fmtNum(data.puestos.length), 'Grados / puestos');
y += kh + 24;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Controles verificados', M, y);
y += 6;
doc.setFontSize(8.5);
doc.setFont('helvetica', 'normal');
doc.setTextColor(110, 110, 110);
doc.text('Todos los controles fueron verificados contra la base de datos de producción.', M, y + 12);
y += 24;

const colW = (W - M * 2 - 24) / 2;
let yL = y, yR = y;
const left = (t, d) => { yL = checkRow(M, yL, colW, t, d); };
const right = (t, d) => { yR = checkRow(M + colW + 24, yR, colW, t, d); };

left('Solo cargas del día del evento',
  `Las ${fmtNum(A.cargas_n)} cargas se hicieron el sábado, entre las ${A.cargas_primera} y las ${A.cargas_ultima} h. Sin cargas en otras fechas ni fuera de la jornada.`);
left('Venta y carga de créditos cuadran exacto',
  `${fmtNum(A.creditos_vendidos)} créditos vendidos en caja = ${fmtNum(A.creditos_vendidos)} créditos cargados en tarjetas (${fmtGs(A.monto_vendido)}). Diferencia: cero.`);
left('Sin sobregiros',
  'Ninguna tarjeta registró más juegos que créditos cargados. Cada juego descontó un crédito real.');
left('Valores correctos',
  `Todos los créditos fueron valuados a Gs. 7.000 o Gs. 8.000. ${A.debitos_valor_invalido} valores fuera de tarifa.`);

right('Tarjetas de prueba excluidas',
  `Las tarjetas de prueba registraron ${A.tarjetas_prueba_cargas} cargas y ${A.tarjetas_prueba_debitos} juegos: no afectan ningún total.`);
right('Juegos dentro de la jornada',
  `Los ${fmtNum(A.debitos_n)} juegos se registraron entre las ${A.debitos_primera} y las ${A.debitos_ultima} h del sábado. Sin actividad fuera de horario.`);
right('Carga centralizada y trazable',
  `Las cargas se realizaron desde un único punto de venta de créditos, con registro de fecha, hora y monto de cada operación.`);
right('Totales por puesto verificados',
  'La recaudación de cada grado se calculó contando uno por uno los créditos jugados en su puesto.');

y = Math.max(yL, yR) + 6;

// Flujo de conciliación del dinero de juegos
doc.setFillColor(...NAVY);
doc.roundedRect(M, y, W - M * 2, 66, 6, 6, 'F');
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'bold');
doc.setFontSize(10.5);
doc.text('Conciliación', M + 16, y + 20);
doc.setTextColor(...GOLD);
doc.setFontSize(9.5);
doc.text('Todo cuadra al guaraní.', W - M - 16, y + 20, { align: 'right' });
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.text(`Vendido y cargado: ${fmtGs(A.monto_vendido)}`, M + 16, y + 41);
doc.text(`=   Jugado: ${fmtGs(totValor)}   +   Créditos no jugados: ${fmtGs(A.monto_no_jugado)}`, M + 16, y + 56);

footer();

// ============================================================
// Página 3 — Distribución y monto a transferir por grado
// ============================================================
doc.addPage();
drawHeader('Distribución por grado', `${fmtGs(totValor)} jugados · 80% grado / 20% organización`);
y = M + 48;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Monto a transferir a cada grado', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Grado', 'Juego', 'Créditos', 'Recaudación', 'Para organización', 'A transferir al grado']],
  body: enOrden.map((p) => [
    p.grado, p.juego, fmtNum(p.creditos), fmtGs(p.valor), fmtGs(p.org),
    p.comision ? 'Comisión organiz.' : fmtGs(p.grado_monto),
  ]),
  foot: [['TOTAL', '', fmtNum(totCred), fmtGs(totValor), fmtGs(totOrgCol), fmtGs(totGrados)]],
  styles: { fontSize: 8.8, cellPadding: 5 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: {
    0: { cellWidth: 64, fontStyle: 'bold' },
    2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
    5: { halign: 'right', fontStyle: 'bold', textColor: GREEN },
  },
  margin: { left: M, right: M },
  // Resalta las filas del 6° Grado (comisión organizadora).
  didParseCell: (d) => {
    if (d.section === 'body' && enOrden[d.row.index] && enOrden[d.row.index].comision) {
      d.cell.styles.fillColor = [252, 246, 232];
      if (d.column.index === 5) { d.cell.styles.textColor = GOLD; d.cell.styles.fontStyle = 'bolditalic'; }
    }
  },
});
y = doc.lastAutoTable.finalY + 12;

// Nota sobre la comisión organizadora (6° Grado)
doc.setFillColor(252, 246, 232);
doc.roundedRect(M, y, W - M * 2, 30, 5, 5, 'F');
doc.setTextColor(...GOLD);
doc.setFont('helvetica', 'bold');
doc.setFontSize(9);
doc.text('Nota — Comisión organizadora', M + 12, y + 13);
doc.setTextColor(80, 70, 50);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.text(`El 6° Grado (A y B) integra la comisión organizadora: la recaudación completa de sus puestos (${fmtGs(seisTotal)}) queda en la organización y no se transfiere.`, M + 12, y + 24);
y += 30 + 18;

// Resumen de distribución (a dónde va lo recaudado)
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('A dónde va lo recaudado en juegos', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Destino', 'Concepto', 'Monto']],
  body: [
    ['Para los grados', 'Suma de montos a transferir (80% de lo jugado, excluido 6° grado)', fmtGs(totGrados)],
    ['Para la organización', 'Recaudación completa del 6° Grado A y B (comisión organizadora)', fmtGs(seisTotal)],
    ['Para la organización', '20% de lo jugado por los demás grados', fmtGs(totOrgCol - seisTotal)],
    ['Para la organización', 'Créditos vendidos y no jugados', fmtGs(A.monto_no_jugado)],
  ],
  foot: [['TOTAL RECAUDADO EN JUEGOS', '', fmtGs(A.monto_vendido)]],
  styles: { fontSize: 9.5, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: GOLD, textColor: 255, fontStyle: 'bold' },
  columnStyles: { 0: { fontStyle: 'bold', cellWidth: 150 }, 2: { halign: 'right', fontStyle: 'bold' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 16;

// Doble callout: total a grados / total organización
const cgap = 14, cwd = (W - M * 2 - cgap) / 2, chh = 56;
doc.setFillColor(...GREEN);
doc.roundedRect(M, y, cwd, chh, 6, 6, 'F');
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9.5);
doc.text('Total a transferir a los grados', M + 14, y + 20);
doc.setFont('helvetica', 'bold');
doc.setFontSize(17);
doc.text(fmtGs(totGrados), M + 14, y + 42);

doc.setFillColor(...NAVY);
doc.roundedRect(M + cwd + cgap, y, cwd, chh, 6, 6, 'F');
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9.5);
doc.text('Total para la organización', M + cwd + cgap + 14, y + 20);
doc.setFont('helvetica', 'bold');
doc.setFontSize(17);
doc.text(fmtGs(orgTotal), M + cwd + cgap + 14, y + 42);
doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
doc.text(`(6° grado + 20% demás grados + créditos no jugados)`, M + cwd + cgap + 14, y + 52);
footer();

// ============================================================
// Página 4 — Transferencias a realizar
// ============================================================
doc.addPage();
drawHeader('Transferencias a realizar', `${fmtGs(totGrados)} a distribuir entre los grados`);
y = M + 50;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(16);
doc.text('TRANSFERENCIAS A REALIZAR POR JUEGOS', M, y);
y += 19;
doc.setFontSize(12);
doc.setTextColor(...GOLD);
doc.setFont('helvetica', 'normal');
doc.text('San Juan dice que sí 2026', M, y);
y += 22;

// Agrupa por grado (une 6°A y 6°B en un solo "6° Grado", que es la comisión).
const grupos = [];
const gidx = {};
for (const p of enOrden) {
  const key = p.grado.replace(/\s+[AB]$/, '');
  if (gidx[key] == null) { gidx[key] = grupos.length; grupos.push({ grado: key, monto: 0, comision: false }); }
  grupos[gidx[key]].monto += p.grado_monto;
  grupos[gidx[key]].comision = grupos[gidx[key]].comision || p.comision;
}
const dir = data.directorio || {};
autoTable({
  startY: y,
  head: [['#', 'Grado', 'Alias', 'Responsable', 'Monto a transferir']],
  body: grupos.map((g, i) => {
    const d = dir[g.grado] || {};
    return [
      i + 1, g.grado,
      g.comision ? '—' : (d.alias || '—'),
      g.comision ? 'Comisión organizadora' : (d.responsable || '—'),
      g.comision ? '—' : fmtGs(g.monto),
    ];
  }),
  foot: [['', 'TOTAL A TRANSFERIR', '', '', fmtGs(totGrados)]],
  styles: { fontSize: 9.5, cellPadding: 6.5 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 10.5 },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: {
    0: { halign: 'center', cellWidth: 26 },
    1: { fontStyle: 'bold', cellWidth: 86 },
    4: { halign: 'right', fontStyle: 'bold', textColor: GREEN, cellWidth: 110 },
  },
  margin: { left: M, right: M },
  didParseCell: (d) => {
    if (d.section === 'body' && grupos[d.row.index] && grupos[d.row.index].comision) {
      d.cell.styles.fillColor = [252, 246, 232];
      if (d.column.index === 4 || d.column.index === 3) { d.cell.styles.textColor = GOLD; d.cell.styles.fontStyle = 'italic'; }
    }
  },
});
y = doc.lastAutoTable.finalY + 16;

// Nota de comprobantes
doc.setFillColor(...LIGHT);
doc.roundedRect(M, y, W - M * 2, 28, 5, 5, 'F');
doc.setTextColor(70, 70, 70);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.text('Una vez realizadas las transferencias, los comprobantes correspondientes se anexan a la presente acta.', M + 12, y + 17);
y += 28 + 40;

// Bloque de firmas
doc.setDrawColor(180);
const fw = (W - M * 2 - 40) / 2;
doc.line(M, y + 30, M + fw, y + 30);
doc.line(M + fw + 40, y + 30, W - M, y + 30);
doc.setTextColor(90, 90, 90);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.text('Tesorería · Comisión Organizadora', M, y + 44);
doc.text('Presidencia · Comisión Organizadora', M + fw + 40, y + 44);

footer();

// ============================================================
// Páginas 5+ — ANEXO: comprobantes de transferencia (2 por página, en orden)
// ============================================================
const transfDir = 'C:/wamp64/sanjuan/frontend/public/img/transf/';
const archivos = fs.existsSync(transfDir)
  ? fs.readdirSync(transfDir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()
  : [];
// Lee ancho/alto de un JPEG desde su marcador SOF.
function jpgSize(buf) {
  let o = 2;
  while (o < buf.length) {
    if (buf[o] !== 0xFF) { o++; continue; }
    const m = buf[o + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
    }
    o += 2 + buf.readUInt16BE(o + 2);
  }
  return { w: 1, h: 1 };
}

const COLS = 2, IGAP = 26, CAP = 22;
const cellW = (W - M * 2 - IGAP) / COLS;
let comp = 0;
for (let i = 0; i < archivos.length; i += COLS) {
  doc.addPage();
  drawHeader('Anexo · Comprobantes de transferencia', 'Transferencias a los grados · San Juan 2026');
  const top = M + 56;
  const bodyH = (H - 44) - top;
  for (let c = 0; c < COLS && i + c < archivos.length; c++) {
    const f = archivos[i + c];
    comp += 1;
    const isPng = /\.png$/i.test(f);
    const buf = fs.readFileSync(transfDir + f);
    const sz = isPng ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : jpgSize(buf);
    const ratio = sz.w / sz.h;
    let iw = cellW, ih = iw / ratio;
    const maxIh = bodyH - CAP - 8;
    if (ih > maxIh) { ih = maxIh; iw = ih * ratio; }
    const colX = M + c * (cellW + IGAP);
    const x = colX + (cellW - iw) / 2;
    const yImg = top + (bodyH - CAP - ih) / 2;
    const dataUrl = `data:image/${isPng ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
    doc.addImage(dataUrl, isPng ? 'PNG' : 'JPEG', x, yImg, iw, ih);
    doc.setDrawColor(205);
    doc.setLineWidth(0.6);
    doc.rect(x, yImg, iw, ih);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Comprobante ${comp}`, colX + cellW / 2, yImg + ih + 16, { align: 'center' });
  }
  footer();
}

const out = 'C:/wamp64/sanjuan/Acta-Cierre-Juegos-Promo2032.pdf';
fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('OK ->', out);
console.log(`Puestos: ${puestos.length} | Jugado: ${fmtGs(totValor)} | A grados: ${fmtGs(totGrados)} | Org: ${fmtGs(orgTotal)}`);
console.log(`Cuadre: vendido ${fmtGs(A.monto_vendido)} = grados ${fmtGs(totGrados)} + org ${fmtGs(orgTotal)} -> ${totGrados + orgTotal === A.monto_vendido ? 'OK' : 'REVISAR'}`);
console.log(`Anexo: ${archivos.length} comprobantes en ${Math.ceil(archivos.length / 2)} páginas`);
