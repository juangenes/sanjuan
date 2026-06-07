// Genera y dispara la descarga de un CSV con BOM (para que Excel respete los
// acentos) a partir de una matriz de filas. Cada celda se escapa entre comillas.
export function descargarCSV(nombre, filas) {
  const csv = filas
    .map((fila) => fila.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
