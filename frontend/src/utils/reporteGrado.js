// Generación de los reportes por grado para los padres: un PDF "pro" (carta de
// agradecimiento + estadísticas con gráfico + datos crudos) y un XLSX con
// formato. Las librerías pesadas (jspdf, exceljs) se cargan de forma diferida
// para no inflar el bundle principal.
import { descargarBlob } from './descargar';

const TZ = 'America/Asuncion';
const NAVY = [11, 46, 85];   // #0B2E55 — color de marca
const GOLD = [201, 138, 42]; // acento cálido San Juan

const hourFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, hourCycle: 'h23', timeZone: TZ });
const dtFmt = new Intl.DateTimeFormat('es-PY', {
  day: '2-digit', month: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: TZ,
});

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtFechaHora = (iso) => (iso ? dtFmt.format(new Date(iso)) : '—');
const fmtHora = (h) => `${String(h).padStart(2, '0')}:00`;
const rgb = (a) => `#${a.map((n) => n.toString(16).padStart(2, '0')).join('')}`;

// Parte "1° Grado" y "Reto de Puntería" desde "1° Grado · Reto de Puntería".
function partesGrado(nombre) {
  const [grado, ...resto] = String(nombre || '').split('·');
  return { grado: grado.trim(), juego: resto.join('·').trim() };
}

// Estadísticas derivadas de la lista de consumos (cada uno = 1 jugada).
export function statsGrado(consumos) {
  const total = consumos.length;
  const recaudacion = consumos.reduce((s, c) => s + Number(c.valor_unitario || 0), 0);
  const porHora = {};
  let min = null, max = null;
  for (const c of consumos) {
    const d = new Date(c.fecha);
    const h = parseInt(hourFmt.format(d), 10) % 24;
    porHora[h] = (porHora[h] || 0) + 1;
    const t = d.getTime();
    if (min === null || t < min) min = t;
    if (max === null || t > max) max = t;
  }
  const durMin = min !== null && max !== null && max > min ? (max - min) / 60000 : 0;
  const porMinuto = durMin > 0 ? total / durMin : 0;
  let peakHora = null, peakVal = 0;
  for (const [h, v] of Object.entries(porHora)) {
    if (v > peakVal) { peakVal = v; peakHora = Number(h); }
  }
  // Serie continua desde la primera hasta la última hora con actividad.
  const horas = Object.keys(porHora).map(Number).sort((a, b) => a - b);
  const serie = [];
  if (horas.length) {
    for (let h = horas[0]; h <= horas[horas.length - 1]; h++) serie.push({ hora: h, juegos: porHora[h] || 0 });
  }
  return {
    total, recaudacion, serie, porMinuto, peakHora, peakVal,
    primera: min, ultima: max, ticketProm: total ? Math.round(recaudacion / total) : 0,
  };
}

// Carga el logo del San Juan como dataURL + dimensiones (para conservar el
// aspecto) + formato (PNG/JPEG, para jspdf y exceljs).
async function cargarLogo() {
  try {
    const res = await fetch('/img/logo-pdf.png');
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    const extension = (blob.type || '').includes('png') ? 'png' : 'jpeg';
    return { dataUrl, ...dims, format: extension === 'png' ? 'PNG' : 'JPEG', extension };
  } catch {
    return null;
  }
}

function nombreArchivo(puesto, ext) {
  const base = `Reporte-${puesto.codigo}-${partesGrado(puesto.nombre).grado}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '_');
  return `${base}.${ext}`;
}

// ----------------------------------------------------------------------------
// PDF
// ----------------------------------------------------------------------------
export async function generarPdfGrado({ puesto, consumos }) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const logo = await cargarLogo();
  const st = statsGrado(consumos);
  const { grado, juego } = partesGrado(puesto.nombre);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;

  const logoDims = (maxW) => {
    if (!logo || !logo.w) return null;
    const w = Math.min(maxW, logo.w);
    return { w, h: (w * logo.h) / logo.w };
  };

  // ---------- Página 1: Carta ----------
  let y = M + 10;
  const ld = logoDims(120);
  if (ld) { doc.addImage(logo.dataUrl, logo.format, (W - ld.w) / 2, y, ld.w, ld.h); y += ld.h + 24; }
  else y += 10;

  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('San Juan dice que sí 2026', W / 2, y, { align: 'center' });
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text('Reporte de tu grado', W / 2, y, { align: 'center' });
  y += 40;

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Estimadas familias del ${grado}:`, M, y);
  y += 24;
  doc.setFont('helvetica', 'normal');

  const parrafos = [
    `Ayer vivimos una jornada inolvidable. Queremos agradecerles de corazón por haber sido parte del San Juan, y muy especialmente por el juego "${juego}", que estuvo a cargo de las familias del ${grado}.`,
    'Nada de esto hubiera sido posible sin su esfuerzo, su tiempo y su cariño. Cada familia que armó, atendió y acompañó el puesto hizo que la fiesta saliera adelante y fuera el éxito que fue.',
    'Como pequeño reconocimiento, preparamos este reporte con los números de la participación de tu grado durante la jornada. En las páginas siguientes vas a encontrar las estadísticas y el detalle de la actividad.',
    '¡Gracias por tanto! Esta fiesta es de todos, y la hicieron posible ustedes.',
  ];
  doc.setFontSize(11.5);
  doc.setLineHeightFactor(1.5);
  for (const p of parrafos) {
    const lines = doc.splitTextToSize(p, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 11.5 * 1.5 + 10;
  }
  doc.setLineHeightFactor(1.15);

  y += 20;
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(80, 80, 80);
  doc.text('Con gratitud,', M, y); y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text('La Comisión Organizadora', M, y); y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('San Juan dice que sí 2026', M, y);

  // ---------- Página 2: Estadísticas ----------
  doc.addPage();
  drawHeader(doc, W, M, logo, 'Los números de tu grado', `${grado} · ${juego}`);
  y = M + 70;

  const kpis = [
    { label: 'Recaudación', valor: fmtGs(st.recaudacion), destacado: true },
    { label: 'Juegos jugados', valor: st.total.toLocaleString('es-PY') },
    { label: 'Juegos por minuto', valor: st.porMinuto.toFixed(1) },
    { label: 'Hora pico', valor: st.peakHora !== null ? fmtHora(st.peakHora) : '—', sub: st.peakHora !== null ? `${st.peakVal} juegos` : '' },
    { label: 'Valor por juego', valor: fmtGs(st.ticketProm) },
    { label: 'Actividad', valor: st.primera ? `${dtFmt.format(new Date(st.primera)).slice(-8)}–${dtFmt.format(new Date(st.ultima)).slice(-8)}` : '—' },
  ];
  const cols = 3;
  const gap = 14;
  const cw = (W - M * 2 - gap * (cols - 1)) / cols;
  const ch = 70;
  kpis.forEach((k, i) => {
    const cx = M + (i % cols) * (cw + gap);
    const cy = y + Math.floor(i / cols) * (ch + gap);
    doc.setFillColor(...(k.destacado ? GOLD : NAVY));
    doc.roundedRect(cx, cy, cw, ch, 6, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(k.label.toUpperCase(), cx + 12, cy + 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(String(k.valor), cx + 12, cy + 44);
    if (k.sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(k.sub, cx + 12, cy + 60); }
  });
  y += Math.ceil(kpis.length / cols) * (ch + gap) + 24;

  // Gráfico de juegos por hora
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Juegos por hora', M, y);
  y += 16;
  if (st.serie.length) drawBarChart(doc, M, y, W - M * 2, 180, st.serie);
  else { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(120, 120, 120); doc.text('Sin actividad registrada.', M, y + 20); }

  // ---------- Página 3+: Datos crudos ----------
  doc.addPage();
  drawHeader(doc, W, M, logo, 'Detalle de jugadas', `${grado} · ${st.total} jugadas`);

  const ordenados = [...consumos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  autoTable(doc, {
    startY: M + 70,
    head: [['#', 'Fecha y hora', 'Tarjeta', 'Valor']],
    body: ordenados.map((c, i) => [i + 1, fmtFechaHora(c.fecha), c.tarjeta, fmtGs(c.valor_unitario)]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 244, 248] },
    columnStyles: { 0: { halign: 'right', cellWidth: 36 }, 3: { halign: 'right' } },
    margin: { left: M, right: M },
    didDrawPage: () => {
      const page = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`San Juan 2026 · ${grado}`, M, H - 24);
      doc.text(`Página ${page}`, W - M, H - 24, { align: 'right' });
    },
  });

  doc.save(nombreArchivo(puesto, 'pdf'));
}

function drawHeader(doc, W, M, logo, titulo, subtitulo) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 50, 'F');
  if (logo && logo.w) {
    const h = 30; const w = (h * logo.w) / logo.h;
    try { doc.addImage(logo.dataUrl, logo.format, M, 10, w, h); } catch { /* ignore */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(titulo, W - M, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitulo, W - M, 38, { align: 'right' });
}

function drawBarChart(doc, x, y, w, h, serie) {
  const maxV = Math.max(1, ...serie.map((s) => s.juegos));
  const n = serie.length;
  const gap = n > 12 ? 4 : 8;
  const bw = (w - gap * (n - 1)) / n;
  const baseY = y + h;
  doc.setDrawColor(210);
  doc.line(x, baseY, x + w, baseY);
  serie.forEach((s, i) => {
    const bx = x + i * (bw + gap);
    const bh = (s.juegos / maxV) * (h - 22);
    doc.setFillColor(...NAVY);
    doc.rect(bx, baseY - bh, bw, bh, 'F');
    doc.setFontSize(7);
    doc.setTextColor(80);
    if (s.juegos > 0) doc.text(String(s.juegos), bx + bw / 2, baseY - bh - 4, { align: 'center' });
    doc.setTextColor(120);
    doc.text(String(s.hora).padStart(2, '0'), bx + bw / 2, baseY + 12, { align: 'center' });
  });
}

// ----------------------------------------------------------------------------
// XLSX (exceljs)
// ----------------------------------------------------------------------------
export async function generarXlsxGrado({ puesto, consumos }) {
  const ExcelJS = (await import('exceljs')).default;
  const logo = await cargarLogo();
  const st = statsGrado(consumos);
  const { grado, juego } = partesGrado(puesto.nombre);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'San Juan dice que sí 2026';

  const navyFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2E55' } };
  const goldFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC98A2A' } };
  const headFont = { color: { argb: 'FFFFFFFF' }, bold: true };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFD9DEE5' } },
    bottom: { style: 'thin', color: { argb: 'FFD9DEE5' } },
    left: { style: 'thin', color: { argb: 'FFD9DEE5' } },
    right: { style: 'thin', color: { argb: 'FFD9DEE5' } },
  };
  const GS_FMT = '"Gs. "#,##0';

  // ===== Hoja 1: Resumen =====
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 30 }, { width: 26 }, { width: 26 }];

  if (logo?.dataUrl) {
    try {
      const imgId = wb.addImage({ base64: logo.dataUrl, extension: logo.extension });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 150, height: (150 * logo.h) / logo.w } });
    } catch { /* logo opcional */ }
  }

  ws.mergeCells('B2:C2');
  ws.getCell('B2').value = 'San Juan dice que sí 2026';
  ws.getCell('B2').font = { bold: true, size: 18, color: { argb: 'FF0B2E55' } };
  ws.mergeCells('B3:C3');
  ws.getCell('B3').value = `${grado} · ${juego}`;
  ws.getCell('B3').font = { size: 12, color: { argb: 'FFC98A2A' }, bold: true };

  ws.mergeCells('A6:C9');
  const blurb = ws.getCell('A6');
  blurb.value =
    `¡Gracias, familias del ${grado}! Sin su esfuerzo en el juego "${juego}" esta fiesta no hubiera sido posible. ` +
    'Acá les compartimos los números de la participación de su grado durante la jornada.';
  blurb.alignment = { wrapText: true, vertical: 'top' };
  blurb.font = { italic: true, color: { argb: 'FF444444' } };

  // KPIs
  let r = 11;
  ws.getCell(`A${r}`).value = 'Resumen';
  ws.getCell(`A${r}`).font = { bold: true, size: 13, color: { argb: 'FF0B2E55' } };
  r += 1;
  const kpis = [
    ['Recaudación del grado', st.recaudacion, GS_FMT, true],
    ['Juegos jugados', st.total, '#,##0', false],
    ['Juegos por minuto', Number(st.porMinuto.toFixed(2)), '#,##0.00', false],
    ['Hora pico', st.peakHora !== null ? `${fmtHora(st.peakHora)} (${st.peakVal} juegos)` : '—', null, false],
    ['Valor por juego', st.ticketProm, GS_FMT, false],
    ['Primera jugada', st.primera ? fmtFechaHora(new Date(st.primera).toISOString()) : '—', null, false],
    ['Última jugada', st.ultima ? fmtFechaHora(new Date(st.ultima).toISOString()) : '—', null, false],
  ];
  for (const [label, valor, fmt, destacado] of kpis) {
    const cL = ws.getCell(`A${r}`);
    const cV = ws.getCell(`B${r}`);
    cL.value = label;
    cL.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cL.fill = destacado ? goldFill : navyFill;
    cL.alignment = { vertical: 'middle' };
    cL.border = thinBorder;
    cV.value = valor;
    if (fmt) cV.numFmt = fmt;
    cV.font = { bold: destacado, size: destacado ? 13 : 11 };
    cV.alignment = { vertical: 'middle' };
    cV.border = thinBorder;
    ws.getRow(r).height = 22;
    r += 1;
  }

  // ===== Hoja 2: Por hora =====
  const wh = wb.addWorksheet('Por hora');
  wh.columns = [{ width: 14 }, { width: 16 }];
  wh.getRow(1).values = ['Hora', 'Juegos'];
  wh.getRow(1).eachCell((c) => { c.fill = navyFill; c.font = headFont; c.alignment = { horizontal: 'center' }; });
  st.serie.forEach((s, i) => {
    const row = wh.getRow(i + 2);
    row.getCell(1).value = fmtHora(s.hora);
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).value = s.juegos;
    row.getCell(2).alignment = { horizontal: 'center' };
  });
  if (st.serie.length) {
    // Barras de datos: visualiza las horas pico dentro de la propia celda.
    wh.addConditionalFormatting({
      ref: `B2:B${st.serie.length + 1}`,
      rules: [{ type: 'dataBar', cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FF0B2E55' }, priority: 1 }],
    });
  }

  // ===== Hoja 3: Datos =====
  const wd = wb.addWorksheet('Datos');
  wd.columns = [
    { header: '#', key: 'n', width: 8 },
    { header: 'Fecha y hora', key: 'fecha', width: 22 },
    { header: 'Tarjeta', key: 'tarjeta', width: 16 },
    { header: 'Valor', key: 'valor', width: 16 },
  ];
  wd.getRow(1).eachCell((c) => { c.fill = navyFill; c.font = headFont; c.alignment = { horizontal: 'center' }; });
  const ordenados = [...consumos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  ordenados.forEach((c, i) => {
    const row = wd.addRow({ n: i + 1, fecha: fmtFechaHora(c.fecha), tarjeta: c.tarjeta, valor: Number(c.valor_unitario || 0) });
    row.getCell('valor').numFmt = GS_FMT;
    if (i % 2 === 1) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } }; });
  });
  // Fila total
  const totalRow = wd.addRow({ n: '', fecha: '', tarjeta: 'TOTAL', valor: st.recaudacion });
  totalRow.getCell('tarjeta').font = { bold: true };
  totalRow.getCell('valor').font = { bold: true };
  totalRow.getCell('valor').numFmt = GS_FMT;
  wd.views = [{ state: 'frozen', ySplit: 1 }];
  wd.autoFilter = 'A1:D1';

  const buf = await wb.xlsx.writeBuffer();
  descargarBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nombreArchivo(puesto, 'xlsx'),
  );
}
