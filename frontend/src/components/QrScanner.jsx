import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QrScanner({ onDetected, fps = 20, qrbox = 250 }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const handledRef = useRef(false);

  useEffect(() => {
    handledRef.current = false;
    const id = `qr-reader-${Math.random().toString(36).slice(2)}`;
    if (containerRef.current) containerRef.current.id = id;

    const scanner = new Html5QrcodeScanner(
      id,
      { fps, qrbox: { width: qrbox, height: qrbox }, rememberLastUsedCamera: true },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        if (handledRef.current) return;
        handledRef.current = true;
        try { scanner.clear(); } catch { /* noop */ }
        onDetected(decodedText.trim().toUpperCase());
      },
      () => { /* errores de frame: silenciar */ }
    );

    return () => {
      try { scanner.clear(); } catch { /* noop */ }
    };
  }, [fps, qrbox, onDetected]);

  return <div ref={containerRef} style={{ width: '100%' }} />;
}
