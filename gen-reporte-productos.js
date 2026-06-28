// Reporte gerencial por producto — vendido vs entregado, para cierre con proveedores.
// One-off: usa jspdf del frontend y el mismo estilo de marca que los demás reportes.
// Lee el export en productos-data.json (no versionado).
const fs = require('fs');
const { jsPDF } = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf');
const autoTablePlugin = require('C:/wamp64/sanjuan/frontend/node_modules/jspdf-autotable').default;

const NAVY = [11, 46, 85];
const GOLD = [201, 138, 42];
const GREEN = [22, 121, 78];
const LIGHT = [240, 244, 248];
const M = 56;

const data = JSON.parse(fs.readFileSync('C:/wamp64/sanjuan/productos-data.json', 'utf8'));

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');

// Categorías que pasan por expendio (tienen entrega registrada). Juegos y
// figuritas se entregan en el momento, no por expendio → entrega = N/A.
const EXPENDIO = new Set(['COMIDA', 'BEBIDA', 'POSTRE']);
const CAT_LABEL = { COMIDA: 'Comida', BEBIDA: 'Bebidas', POSTRE: 'Postres', JUEGO: 'Juegos', FIGURITAS: 'Figuritas' };
const catLabel = (c) => CAT_LABEL[c] || c;

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
let totVend = 0, totEntr = 0, totUVend = 0, totUEntr = 0;
let foodVend = 0, foodEntr = 0, foodUVend = 0, foodUEntr = 0;
const porCat = {}; // cat -> { uVend, mVend, uEntr, mEntr, prods }
for (const r of data) {
  const exp = EXPENDIO.has(r.categoria);
  porCat[r.categoria] = porCat[r.categoria] || { uVend: 0, mVend: 0, uEntr: 0, mEntr: 0, prods: 0, exp };
  const c = porCat[r.categoria];
  c.uVend += r.u_vend; c.mVend += r.m_vend; c.uEntr += r.u_entr; c.mEntr += r.m_entr; c.prods += 1;
  totVend += r.m_vend; totUVend += r.u_vend; totEntr += r.m_entr; totUEntr += r.u_entr;
  if (exp) { foodVend += r.m_vend; foodEntr += r.m_entr; foodUVend += r.u_vend; foodUEntr += r.u_entr; }
}
const cats = Object.keys(porCat).sort((a, b) => porCat[b].mVend - porCat[a].mVend);

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
doc.text('Reporte de ventas por producto', W / 2, y, { align: 'center' });
y += 16;
doc.setTextColor(110, 110, 110);
doc.setFontSize(10);
doc.text('Cierre con proveedores · vendido vs. entregado', W / 2, y, { align: 'center' });
y += 28;

// KPIs
const gap = 12;
const kw = (W - M * 2 - gap * 3) / 4;
const kh = 56;
kpiCard(M, y, kw, kh, fmtGs(totVend), 'Monto vendido', GREEN);
kpiCard(M + (kw + gap), y, kw, kh, fmtNum(totUVend), 'Unidades vendidas');
kpiCard(M + (kw + gap) * 2, y, kw, kh, fmtNum(data.length), 'Productos distintos');
kpiCard(M + (kw + gap) * 3, y, kw, kh, pct(foodEntr, foodVend), 'Entrega (comida)', GOLD);
y += kh + 26;

// Resumen por categoría
doc.setTextColor(...NAVY);
doc.setFont('helvetica', 'bold');
doc.setFontSize(13);
doc.text('Resumen por categoría', M, y);
y += 10;
autoTable({
  startY: y,
  head: [['Categoría', 'Prod.', 'U. vendidas', 'Monto vendido', '% vta.', 'U. entreg.', 'Monto entregado', '% entr.']],
  body: cats.map((cat) => {
    const c = porCat[cat];
    return [
      catLabel(cat), fmtNum(c.prods), fmtNum(c.uVend), fmtGs(c.mVend), pct(c.mVend, totVend),
      c.exp ? fmtNum(c.uEntr) : '—', c.exp ? fmtGs(c.mEntr) : '—', c.exp ? pct(c.mEntr, c.mVend) : '—',
    ];
  }),
  foot: [[
    'TOTAL', fmtNum(data.length), fmtNum(totUVend), fmtGs(totVend), '100%',
    fmtNum(totUEntr), fmtGs(totEntr), pct(foodEntr, foodVend),
  ]],
  styles: { fontSize: 9, cellPadding: 5 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: LIGHT },
  columnStyles: {
    1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
    5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
  },
  margin: { left: M, right: M },
});
y = doc.lastAutoTable.finalY + 20;

// Nota metodológica
doc.setFillColor(...LIGHT);
const noteH = 64;
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
  'Vendido = unidades cobradas (pedidos PAGADOS, incluye caja, tótem y preventa). Entregado = unidades efectivamente despachadas por expendio. ' +
  'Pendiente = vendido aún no retirado. Juegos y Figuritas se entregan en el momento (no pasan por expendio), por eso su entrega figura como “—”.',
  W - M * 2 - 28);
doc.text(nota, M + 14, y + 32);
doc.setLineHeightFactor(1.15);

footer('San Juan 2026 · Ventas por producto');

// ============ Página 2+: Detalle por producto, agrupado por categoría ============
doc.addPage();
drawHeader('Detalle por producto', `${data.length} productos · vendido ${fmtGs(totVend)}`);

// Construye el cuerpo con filas de encabezado de categoría + subtotales.
const body = [];
for (const cat of cats) {
  const c = porCat[cat];
  const prods = data.filter((r) => r.categoria === cat).sort((a, b) => b.m_vend - a.m_vend);
  body.push([{ content: catLabel(cat).toUpperCase(), colSpan: 8, styles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 9 } }]);
  for (const r of prods) {
    const pend = r.u_vend - r.u_entr;
    body.push([
      r.titulo, fmtGs(r.precio), fmtNum(r.u_vend), fmtGs(r.m_vend),
      c.exp ? fmtNum(r.u_entr) : '—', c.exp ? fmtGs(r.m_entr) : '—',
      c.exp ? fmtNum(pend) : '—', c.exp ? pct(r.m_entr, r.m_vend) : '—',
    ]);
  }
  body.push([
    { content: `Subtotal ${catLabel(cat)}`, styles: { fontStyle: 'bold', fillColor: LIGHT } },
    { content: '', styles: { fillColor: LIGHT } },
    { content: fmtNum(c.uVend), styles: { fontStyle: 'bold', fillColor: LIGHT, halign: 'right' } },
    { content: fmtGs(c.mVend), styles: { fontStyle: 'bold', fillColor: LIGHT, halign: 'right' } },
    { content: c.exp ? fmtNum(c.uEntr) : '—', styles: { fontStyle: 'bold', fillColor: LIGHT, halign: 'right' } },
    { content: c.exp ? fmtGs(c.mEntr) : '—', styles: { fontStyle: 'bold', fillColor: LIGHT, halign: 'right' } },
    { content: c.exp ? fmtNum(c.uVend - c.uEntr) : '—', styles: { fontStyle: 'bold', fillColor: LIGHT, halign: 'right' } },
    { content: c.exp ? pct(c.mEntr, c.mVend) : '—', styles: { fontStyle: 'bold', fillColor: LIGHT, halign: 'right' } },
  ]);
}

autoTable({
  startY: M + 50,
  head: [['Producto', 'Precio', 'U. vend.', 'Monto vendido', 'U. entr.', 'Monto entregado', 'Pend.', '% entr.']],
  body,
  foot: [[
    'TOTAL GENERAL', '', fmtNum(totUVend), fmtGs(totVend),
    fmtNum(totUEntr), fmtGs(totEntr), fmtNum(foodUVend - foodUEntr), pct(foodEntr, foodVend),
  ]],
  styles: { fontSize: 8.5, cellPadding: 3.5 },
  headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
  footStyles: { fillColor: GOLD, textColor: 255, fontStyle: 'bold' },
  columnStyles: {
    1: { halign: 'right', cellWidth: 56 }, 2: { halign: 'right', cellWidth: 44 },
    3: { halign: 'right', cellWidth: 78 }, 4: { halign: 'right', cellWidth: 44 },
    5: { halign: 'right', cellWidth: 84 }, 6: { halign: 'right', cellWidth: 38 }, 7: { halign: 'right', cellWidth: 42 },
  },
  margin: { left: M, right: M },
  didDrawPage: () => footer('San Juan 2026 · Ventas por producto'),
});

const out = 'C:/wamp64/sanjuan/Reporte-Ventas-Por-Producto.pdf';
fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log('OK ->', out);
console.log(`Productos: ${data.length} | Vendido: ${fmtGs(totVend)} | Entregado (comida): ${fmtGs(totEntr)} | Entrega: ${pct(foodEntr, foodVend)}`);
