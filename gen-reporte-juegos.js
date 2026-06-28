// Reporte gerencial de juegos — unificado, todos los grados.
// Actividad por grado (orden 1,2,3...), ranking de puestos y horas pico (heatmap).
// One-off: usa jspdf del frontend y el mismo estilo de marca que los demás reportes.
// Lee el export en juegos-data.json (no versionado).
const fs = require('fs');
const { jsPDF } = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf');
const autoTablePlugin = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf-autotable').default;

const NAVY = [11, 46, 85];
const GOLD = [201, 138, 42];
const GREEN = [22, 121, 78];
const LIGHT = [240, 244, 248];
const M = 56;

const data = JSON.parse(fs.readFileSync('C:/wamp64/sanjuan/juegos-data.json', 'utf8'));

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');

// Orden natural de grado a partir del código (1..5, 6a, 6b, 7..9, 10..12).
const ordenGrado = (cod) => {
  const m = /^(\d+)([ab]?)$/i.exec(String(cod));
  if (!m) return 9999;
  return parseInt(m[1], 10) * 10 + (m[2] === 'a' ? 1 : m[2] === 'b' ? 2 : 0);
};
const partes = (nombre) => {
  const i = String(nombre).indexOf(' · ');
  return i === -1 ? { grado: nombre, juego: '' } : { grado: nombre.slice(0, i), juego: nombre.slice(i + 3) };
};

// Logo
const logoBuf = fs.readFileSync('C:/wamp64/sanjuan/frontend/public/img/logo-pdf.png');
const logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
const logoW = logoBuf.readUInt32BE(16);
const logoH = logoBuf.readUInt32BE(20);

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();
const autoTable = (opts) => autoTablePlugin(doc, opts);

// ---- Agregados ----
const porGrado = data.puestos.map((p) => ({ ...p, ...partes(p.nombre), orden: ordenGrado(p.codigo) }));
const enOrden = [...porGrado].sort((a, b) => a.orden - b.orden);
const ranking = [...porGrado].sort((a, b) => b.valor - a.valor || b.creditos - a.creditos);
const totCred = porGrado.reduce((a, p) => a + p.creditos, 0);
const totValor = porGrado.reduce((a, p) => a + p.valor, 0);

const horas = data.horas.map((h) => h.hora).sort((a, b) => a - b);
const horasMap = {}; data.horas.forEach((h) => { horasMap[h.hora] = h; });
const horaPico = data.horas.reduce((a, h) => (h.creditos > a.creditos ? h : a), data.horas[0]);

// Matriz grado×hora: map[codigo][hora] = creditos
const mat = {};
let maxCelda = 0;
for (const c of data.matriz) {
  mat[c.codigo] = mat[c.codigo] || {};
  mat[c.codigo][c.hora] = c.creditos;
  if (c.creditos > maxCelda) maxCelda = c.creditos;
}
const picoDe = (cod) => {
  const row = mat[cod] || {};
  let bh = null, bv = -1;
  for (const h of horas) if ((row[h] || 0) > bv) { bv = row[h] || 0; bh = h; }
  return bv > 0 ? `${bh}:00` : '—';
};

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
function footer() {
  const page = doc.internal.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text('San Juan 2026 · Reporte de juegos', M, H - 24);
  doc.text(`Página ${page}`, W - M, H - 24, { align: 'right' });
}
function kpiCard(x, y, w, h, valor, etiqueta, color = NAVY) {
  doc.setFillColor(...LIGHT);
  doc.roundedRect(x, y, w, h, 6, 6, 'F');
  doc.setTextColor(...color);
  doc.setFont('helvetica', 'bold');
  let fs = 16;
  doc.setFontSize(fs);
  while (doc.getTextWidth(String(valor)) > w - 12 && fs > 8) { fs -= 0.5; doc.setFontSize(fs); }
  doc.text(String(valor), x + w / 2, y + 28, { align: 'center' });
  doc.setTextColor(90, 90, 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(etiqueta, x + w / 2, y + 44, { align: 'center' });
}
// Interpola LIGHT -> NAVY según t (0..1)
const heat = (t) => [
  Math.round(LIGHT[0] + (NAVY[0] - LIGHT[0]) * t),
  Math.round(LIGHT[1] + (NAVY[1] - LIGHT[1]) * t),
  Math.round(LIGHT[2] + (NAVY[2] - LIGHT[2]) * t),
];

// ============ Página 1: Portada + resumen ejecutivo ============
let y = M + 6;
const lw = Math.min(120, logoW);
const lh = (lw * logoH) / logoW;
doc.addImage(logoDataUrl, 'PNG', (W - lw) / 2, y, lw, lh);
y += lh + 22;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(22);
doc.text('San Juan dice que sí 2026', W / 2, y, { align: 'center' });
y += 22;
doc.setFont('helvetica', 'normal');
doc.setFontSize(12);
doc.setTextColor(...GOLD);
doc.text('Reporte gerencial de juegos', W / 2, y, { align: 'center' });
y += 16;
doc.setTextColor(110, 110, 110);
doc.setFontSize(10);
doc.text(`${data.puestos.length} grados · ${horas[0]}:00 a ${horas[horas.length - 1] + 1}:00 hs`, W / 2, y, { align: 'center' });
y += 28;

const gap = 12;
const kw = (W - M * 2 - gap * 3) / 4;
const kh = 56;
kpiCard(M, y, kw, kh, fmtGs(totValor), 'Recaudación juegos', GREEN);
kpiCard(M + (kw + gap), y, kw, kh, fmtNum(totCred), 'Créditos jugados');
kpiCard(M + (kw + gap) * 2, y, kw, kh, fmtNum(data.puestos.length), 'Grados / puestos');
kpiCard(M + (kw + gap) * 3, y, kw, kh, `${horaPico.hora}:00 h`, 'Hora pico', GOLD);
y += kh + 26;

// Top 3 grados + nota
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Lo más destacado', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['#', 'Grado', 'Juego', 'Créditos', 'Recaudación', '%']],
  body: ranking.slice(0, 5).map((p, i) => [
    `${i + 1}°`, p.grado, p.juego, fmtNum(p.creditos), fmtGs(p.valor), pct(p.valor, totValor),
  ]),
  styles: { fontSize: 9.5, cellPadding: 5 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: { 0: { halign: 'center', cellWidth: 26 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 18;

doc.setFillColor(...LIGHT);
const noteH = 58;
doc.roundedRect(M, y, W - M * 2, noteH, 6, 6, 'F');
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(9.5);
doc.text('Cómo leer este reporte', M + 14, y + 18);
doc.setFont('helvetica', 'normal');
doc.setTextColor(70, 70, 70);
doc.setFontSize(8.5);
doc.setLineHeightFactor(1.4);
const nota = doc.splitTextToSize(
  'Cada crédito es un juego efectivamente jugado en el puesto del grado (no incluye créditos comprados y no usados). ' +
  'La recaudación valúa cada crédito por su precio (preventa Gs. 7.000 / normal Gs. 8.000). Horas en hora de Asunción (UTC-3).',
  W - M * 2 - 28);
doc.text(nota, M + 14, y + 32);
doc.setLineHeightFactor(1.15);

footer();

// ============ Página 2: Actividad por grado (orden 1,2,3...) ============
doc.addPage();
drawHeader('Actividad por grado', `${data.puestos.length} grados · ${fmtNum(totCred)} créditos · ${fmtGs(totValor)}`);
autoTable({
  startY: M + 50,
  head: [['Grado', 'Juego', 'Créditos', 'G. 7.000', 'G. 8.000', 'Recaudación', '%', 'Pico', 'Horario']],
  body: enOrden.map((p) => [
    p.grado, p.juego, fmtNum(p.creditos), fmtNum(p.c7), fmtNum(p.c8), fmtGs(p.valor),
    pct(p.valor, totValor), picoDe(p.codigo), p.primera ? `${p.primera}–${p.ultima}` : '—',
  ]),
  foot: [[
    'TOTAL', '', fmtNum(totCred),
    fmtNum(porGrado.reduce((a, p) => a + p.c7, 0)), fmtNum(porGrado.reduce((a, p) => a + p.c8, 0)),
    fmtGs(totValor), '100%', `${horaPico.hora}:00`, '',
  ]],
  styles: { fontSize: 8.5, cellPadding: 4 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: {
    0: { cellWidth: 62, fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
    5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'center' }, 8: { halign: 'center' },
  },
  margin: { left: M, right: M },
  didDrawPage: footer,
});

// ============ Página 3: Ranking de puestos ============
doc.addPage();
drawHeader('Ranking de puestos', `Por recaudación · ${fmtGs(totValor)}`);
y = M + 50;
autoTable({
  startY: y,
  head: [['Pos.', 'Grado', 'Juego', 'Créditos', 'Recaudación', '%', 'Acum. %']],
  body: (() => {
    let acum = 0;
    return ranking.map((p, i) => {
      acum += p.valor;
      return [
        `${i + 1}°`, p.grado, p.juego, fmtNum(p.creditos),
        fmtGs(p.valor), pct(p.valor, totValor), pct(acum, totValor),
      ];
    });
  })(),
  foot: [['', 'TOTAL', '', fmtNum(totCred), fmtGs(totValor), '100%', '']],
  styles: { fontSize: 9, cellPadding: 4.5 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: {
    0: { halign: 'center', cellWidth: 38, fontStyle: 'bold' }, 3: { halign: 'right' }, 4: { halign: 'right' },
    5: { halign: 'right' }, 6: { halign: 'right' },
  },
  margin: { left: M, right: M },
  // Resalta en dorado el podio (top 3).
  didParseCell: (d) => {
    if (d.section === 'body' && d.row.index < 3) {
      d.cell.styles.fillColor = d.column.index === 0 ? GOLD : [252, 246, 232];
      if (d.column.index === 0) d.cell.styles.textColor = 255;
    }
  },
});
y = doc.lastAutoTable.finalY + 24;

// Barras horizontales del ranking
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Recaudación por puesto', M, y);
y += 16;
const maxV = ranking[0].valor;
const labelW = 96, barMaxW = W - M * 2 - labelW - 120, barH = 13, barGap = 6;
for (const p of ranking) {
  const bw = Math.max(2, (p.valor / maxV) * barMaxW);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(p.grado, M, y + barH - 3);
  doc.setFillColor(...NAVY);
  doc.roundedRect(M + labelW, y, bw, barH, 2, 2, 'F');
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtGs(p.valor), M + labelW + bw + 6, y + barH - 3);
  y += barH + barGap;
}
footer();

// ============ Página 4: Horas pico + heatmap ============
doc.addPage();
drawHeader('Horas pico', `Pico ${horaPico.hora}:00 h · ${fmtNum(horaPico.creditos)} créditos`);
y = M + 50;

// Distribución por hora (barras verticales)
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Distribución horaria de juegos', M, y);
y += 14;
const chartX = M, chartW = W - M * 2, chartH = 130, baseY = y + chartH;
const maxH = Math.max(...horas.map((h) => horasMap[h].creditos));
const colW = chartW / horas.length;
horas.forEach((h, i) => {
  const cr = horasMap[h].creditos;
  const bh = (cr / maxH) * (chartH - 20);
  const bx = chartX + i * colW + colW * 0.18;
  const bw = colW * 0.64;
  const esPico = h === horaPico.hora;
  doc.setFillColor(...(esPico ? GOLD : NAVY));
  doc.roundedRect(bx, baseY - bh, bw, bh, 3, 3, 'F');
  doc.setTextColor(...(esPico ? GOLD : NAVY));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(fmtNum(cr), bx + bw / 2, baseY - bh - 4, { align: 'center' });
  doc.setTextColor(90, 90, 90);
  doc.setFont('helvetica', 'normal');
  doc.text(`${h}:00`, bx + bw / 2, baseY + 12, { align: 'center' });
});
doc.setDrawColor(210);
doc.line(chartX, baseY, chartX + chartW, baseY);
y = baseY + 34;

// Heatmap grado × hora
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Mapa de calor — créditos por grado y hora', M, y);
y += 14;
const gradoColW = 96;
const cellW = (W - M * 2 - gradoColW) / horas.length;
const cellH = 18;
// Encabezado de horas
doc.setFontSize(8.5);
doc.setTextColor(90, 90, 90);
doc.setFont('helvetica', 'bold');
horas.forEach((h, i) => {
  doc.text(`${h}:00`, M + gradoColW + i * cellW + cellW / 2, y - 2, { align: 'center' });
});
// Filas en orden de grado
for (const p of enOrden) {
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(p.grado, M, y + cellH - 6);
  horas.forEach((h, i) => {
    const v = (mat[p.codigo] || {})[h] || 0;
    const t = maxCelda ? v / maxCelda : 0;
    const x = M + gradoColW + i * cellW;
    doc.setFillColor(...heat(t));
    doc.setDrawColor(255);
    doc.rect(x, y, cellW, cellH, 'FD');
    if (v > 0) {
      doc.setTextColor(...(t > 0.5 ? [255, 255, 255] : NAVY));
      doc.setFont('helvetica', t > 0.6 ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.text(fmtNum(v), x + cellW / 2, y + cellH - 6, { align: 'center' });
    }
  });
  y += cellH;
}
// Leyenda
y += 14;
doc.setTextColor(110, 110, 110);
doc.setFont('helvetica', 'normal');
doc.setFontSize(8);
doc.text('Menos', M, y + 9);
const legX = M + 34, legW = 120, segs = 10;
for (let i = 0; i < segs; i++) {
  doc.setFillColor(...heat(i / (segs - 1)));
  doc.rect(legX + (legW / segs) * i, y, legW / segs, 9, 'F');
}
doc.text('Más', legX + legW + 6, y + 9);
doc.text(`(máx. ${fmtNum(maxCelda)} créditos en una celda)`, legX + legW + 30, y + 9);
footer();

const out = 'C:/wamp64/sanjuan/Reporte-Gerencial-Juegos.pdf';
fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('OK ->', out);
console.log(`Grados: ${data.puestos.length} | Créditos: ${fmtNum(totCred)} | Recaudación: ${fmtGs(totValor)} | Pico: ${horaPico.hora}:00 (${horaPico.creditos})`);
console.log('Top 3:', ranking.slice(0, 3).map((p) => `${p.grado}=${fmtGs(p.valor)}`).join(' | '));
