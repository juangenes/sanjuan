import { descargarBlob } from './descargar';

// Genera y dispara la descarga de un CSV con BOM (para que Excel respete los
// acentos) a partir de una matriz de filas. Cada celda se escapa entre comillas.
export function descargarCSV(nombre, filas) {
  const csv = filas
    .map((fila) => fila.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  descargarBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), nombre);
}
