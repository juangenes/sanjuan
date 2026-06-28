// Reporte de ventas por caja — PDF de arqueo/rendición por caja.
// One-off: usa jspdf del frontend y el mismo estilo de marca que reporteGrado/figuritas.
// Lee el export en ventas-caja-data.json (no versionado, contiene datos de clientes).
const fs = require('fs');
const { jsPDF } = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf');
const autoTablePlugin = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf-autotable').default;

const NAVY = [11, 46, 85];
const GOLD = [201, 138, 42];
const GREEN = [22, 121, 78];
const LIGHT = [240, 244, 248];
const M = 56;

const data = JSON.parse(fs.readFileSync('C:/wamp64/sanjuan/ventas-caja-data.json', 'utf8'));
data.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id));

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');
const COBRO_LABEL = { EFECTIVO: 'Efectivo', POS_DEBITO: 'POS Débito', POS_CREDITO: 'POS Crédito', QR: 'QR', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };
const cobroLabel = (c) => COBRO_LABEL[c] || c || '—';
// Nombre lindo de la caja a partir del login del operador.
const cajaLabel = (op) => {
  if (!op) return '—';
  const m = /^(caja|juegos)\s*(\d+)$/i.exec(op);
  if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}`;
  return op.charAt(0).toUpperCase() + op.slice(1);
};

// Logo como dataURL
const logoBuf = fs.readFileSync('C:/wamp64/sanjuan/frontend/public/img/logo-pdf.png');
const logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;
const logoW = logoBuf.readUInt32BE(16);
const logoH = logoBuf.readUInt32BE(20);

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();
const autoTable = (opts) => autoTablePlugin(doc, opts);

// ---- Agregados ----
const METODOS = ['EFECTIVO', 'POS_DEBITO', 'POS_CREDITO'];
const blankBreak = () => ({ EFECTIVO: 0, POS_DEBITO: 0, POS_CREDITO: 0 });
const porCaja = {};      // operador -> { ped, total, metodo:{...}, horas:[] }
const porMetodo = blankBreak();
const porMetodoPed = { EFECTIVO: 0, POS_DEBITO: 0, POS_CREDITO: 0 };
let totMonto = 0;

for (const r of data) {
  const op = r.operador;
  porCaja[op] = porCaja[op] || { ped: 0, total: 0, metodo: blankBreak(), horas: [] };
  porCaja[op].ped += 1;
  porCaja[op].total += r.total;
  porCaja[op].metodo[r.cobro] = (porCaja[op].metodo[r.cobro] || 0) + r.total;
  porCaja[op].horas.push(r.fecha.slice(11, 16));
  porMetodo[r.cobro] = (porMetodo[r.cobro] || 0) + r.total;
  porMetodoPed[r.cobro] = (porMetodoPed[r.cobro] || 0) + 1;
  totMonto += r.total;
}

// Cajas ordenadas por recaudación desc
const cajas = Object.keys(porCaja).sort((a, b) => porCaja[b].total - porCaja[a].total);
const totEfectivo = porMetodo.EFECTIVO;

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

function footer(label) {
  const page = doc.internal.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(label, M, H - 24);
  doc.text(`Página ${page}`, W - M, H - 24, { align: 'right' });
}

// Tarjeta KPI — el valor se achica solo para entrar en el ancho.
function kpiCard(x, y, w, h, valor, etiqueta, color = NAVY) {
  doc.setFillColor(...LIGHT);
  doc.roundedRect(x, y, w, h, 6, 6, 'F');
  doc.setTextColor(...color);
  doc.setFont('helvetica', 'bold');
  let fs = 16;
  doc.setFontSize(fs);
  while (doc.getTextWidth(String(valor)) > w - 12 && fs > 8) {
    fs -= 0.5;
    doc.setFontSize(fs);
  }
  doc.text(String(valor), x + w / 2, y + 28, { align: 'center' });
  doc.setTextColor(90, 90, 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(etiqueta, x + w / 2, y + 44, { align: 'center' });
}

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
doc.text('Reporte de ventas por caja', W / 2, y, { align: 'center' });
y += 16;
doc.setTextColor(110, 110, 110);
doc.setFontSize(10);
doc.text(`Jornada del ${diaTxt} · ${primera} a ${ultima} hs`, W / 2, y, { align: 'center' });
y += 28;

// KPIs
const gap = 12;
const kw = (W - M * 2 - gap * 3) / 4;
const kh = 56;
kpiCard(M, y, kw, kh, fmtGs(totMonto), 'Total recaudado', GREEN);
kpiCard(M + (kw + gap), y, kw, kh, fmtNum(data.length), 'Ventas (pedidos)');
kpiCard(M + (kw + gap) * 2, y, kw, kh, fmtNum(cajas.length), 'Cajas operativas');
kpiCard(M + (kw + gap) * 3, y, kw, kh, fmtGs(Math.round(totMonto / data.length)), 'Ticket promedio');
y += kh + 26;

// Recaudación por método de pago
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Recaudación por método de pago', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Método', 'Ventas', 'Monto', '% del total']],
  body: METODOS.map((m) => [
    cobroLabel(m), fmtNum(porMetodoPed[m]), fmtGs(porMetodo[m]),
    `${((porMetodo[m] / totMonto) * 100).toFixed(1)}%`,
  ]),
  foot: [['TOTAL', fmtNum(data.length), fmtGs(totMonto), '100%']],
  styles: { fontSize: 10, cellPadding: 6 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 22;

// Arqueo de efectivo (callout)
doc.setFillColor(...GREEN);
doc.roundedRect(M, y, W - M * 2, 46, 6, 6, 'F');
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'normal');
doc.setFontSize(10);
doc.text('Efectivo a rendir (arqueo de cajas)', M + 16, y + 19);
doc.setFont('helvetica', 'bold');
doc.setFontSize(18);
doc.text(fmtGs(totEfectivo), W - M - 16, y + 30, { align: 'right' });
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.text(`${((totEfectivo / totMonto) * 100).toFixed(1)}% del total · POS (débito + crédito): ${fmtGs(porMetodo.POS_DEBITO + porMetodo.POS_CREDITO)}`, M + 16, y + 36);

footer('San Juan 2026 · Ventas por caja');

// ============ Página 2: Resumen por caja ============
doc.addPage();
drawHeader('Resumen por caja', `${cajas.length} cajas · ${fmtNum(data.length)} ventas · ${fmtGs(totMonto)}`);
y = M + 50;

doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Recaudación por caja', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Caja', 'Ventas', 'Efectivo', 'POS Débito', 'POS Crédito', 'Total', '%', 'Ticket prom.']],
  body: cajas.map((op) => {
    const c = porCaja[op];
    return [
      cajaLabel(op), fmtNum(c.ped), fmtGs(c.metodo.EFECTIVO), fmtGs(c.metodo.POS_DEBITO),
      fmtGs(c.metodo.POS_CREDITO), fmtGs(c.total), `${((c.total / totMonto) * 100).toFixed(1)}%`,
      fmtGs(Math.round(c.total / c.ped)),
    ];
  }),
  foot: [[
    'TOTAL', fmtNum(data.length), fmtGs(porMetodo.EFECTIVO), fmtGs(porMetodo.POS_DEBITO),
    fmtGs(porMetodo.POS_CREDITO), fmtGs(totMonto), '100%', fmtGs(Math.round(totMonto / data.length)),
  ]],
  styles: { fontSize: 9, cellPadding: 5 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: {
    1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
    5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'right' }, 7: { halign: 'right' },
  },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 28;

// Gráfico de barras: participación por caja
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Participación por caja', M, y);
y += 18;
const maxTotal = Math.max(...cajas.map((op) => porCaja[op].total));
const barLabelW = 70;
const barMaxW = W - M * 2 - barLabelW - 130;
const barH = 16, barGap = 12;
for (const op of cajas) {
  const c = porCaja[op];
  const bw = Math.max(2, (c.total / maxTotal) * barMaxW);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(cajaLabel(op), M, y + barH - 4);
  doc.setFillColor(...NAVY);
  doc.roundedRect(M + barLabelW, y, bw, barH, 3, 3, 'F');
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.text(`${fmtGs(c.total)}  (${((c.total / totMonto) * 100).toFixed(1)}%)`, M + barLabelW + bw + 8, y + barH - 4);
  y += barH + barGap;
}

footer('San Juan 2026 · Ventas por caja');

// ============ Página 3+: Detalle pedido por pedido, agrupado por caja ============
for (const op of cajas) {
  const c = porCaja[op];
  const filas = data.filter((r) => r.operador === op);
  doc.addPage();
  drawHeader(`Detalle de caja · ${cajaLabel(op)}`, `${fmtNum(c.ped)} ventas · ${fmtGs(c.total)}`);
  autoTable({
    startY: M + 50,
    head: [['#', 'Pedido', 'Hora', 'Cliente / Familia', 'Método', 'Monto']],
    body: filas.map((r, i) => [
      i + 1, r.id, r.fecha.slice(11, 16), r.familia || '—', cobroLabel(r.cobro), fmtGs(r.total),
    ]),
    foot: [[
      '', '', '', `Efvo ${fmtGs(c.metodo.EFECTIVO)}  ·  Déb ${fmtGs(c.metodo.POS_DEBITO)}  ·  Créd ${fmtGs(c.metodo.POS_CREDITO)}`,
      'TOTAL', fmtGs(c.total),
    ]],
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { halign: 'right', cellWidth: 28 }, 1: { halign: 'right', cellWidth: 44 },
      2: { cellWidth: 40 }, 4: { cellWidth: 76 }, 5: { halign: 'right', cellWidth: 84 },
    },
    margin: { left: M, right: M },
    didDrawPage: () => footer(`San Juan 2026 · Caja ${cajaLabel(op)}`),
  });
}

const out = 'C:/wamp64/sanjuan/Reporte-Ventas-Por-Caja.pdf';
fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('OK ->', out);
console.log(`Cajas: ${cajas.length} | Ventas: ${data.length} | Total: ${fmtGs(totMonto)}`);
console.log('Por caja:', cajas.map((op) => `${cajaLabel(op)}=${fmtGs(porCaja[op].total)}`).join(' | '));
