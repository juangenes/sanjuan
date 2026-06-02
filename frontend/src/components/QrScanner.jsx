import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Escáner de QR que arranca directo con la cámara trasera (facingMode: environment).
// No mostramos el selector de cámaras: el operador no tiene que elegir nada.
export default function QrScanner({ onDetected, fps = 20, qrbox = 250 }) {
  const containerRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    handledRef.current = false;
    const id = `qr-reader-${Math.random().toString(36).slice(2)}`;
    if (containerRef.current) containerRef.current.id = id;

    const html5Qr = new Html5Qrcode(id, /* verbose */ false);
    let detenido = false;

    const detener = () => {
      if (detenido) return;
      detenido = true;
      // stop() falla si el escáner nunca llegó a arrancar. Lanza de forma SÍNCRONA
      // (no como promesa rechazada), así que hay que envolverlo en try/catch además
      // del .catch() — un .catch() solo no atrapa el throw síncrono.
      try {
        return html5Qr.stop().then(() => html5Qr.clear()).catch(() => { /* noop */ });
      } catch { /* el escáner nunca arrancó: nada que detener */ }
    };

    html5Qr
      .start(
        { facingMode: 'environment' },
        { fps, qrbox: { width: qrbox, height: qrbox } },
        (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;
          Promise.resolve(detener()).finally(() => {
            onDetected(decodedText.trim().toUpperCase());
          });
        },
        () => { /* errores de frame: silenciar */ }
      )
      .catch((err) => {
        console.error('No se pudo iniciar la cámara trasera', err);
      });

    return () => { detener(); };
  }, [fps, qrbox, onDetected]);

  return <div ref={containerRef} style={{ width: '100%' }} />;
}
