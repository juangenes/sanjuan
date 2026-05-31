import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getEstaciones, enviarAEstacion } from '../../api';
import styles from './Despacho.module.css';

// El QR puede venir como hash crudo (ticket de caja) o como JSON {hash,idpedido}
// (comprobante de preventa). Devolvemos el hash en ambos casos.
function parseHash(raw) {
  const txt = (raw || '').trim();
  if (!txt) return null;
  try {
    const o = JSON.parse(txt);
    if (o && o.hash) return String(o.hash);
  } catch { /* no es JSON: es el hash crudo */ }
  return txt;
}

export default function ExpendioScan() {
  const [estaciones, setEstaciones] = useState([]);
  const [estacion, setEstacion] = useState(localStorage.getItem('scan_estacion') || '');
  const [manual, setManual] = useState('');
  const [ultimo, setUltimo] = useState(null); // { familia, estacion } del último envío
  const [camActiva, setCamActiva] = useState(false);
  const [soporta] = useState(() => 'BarcodeDetector' in window);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const lockRef = useRef(false);        // evita enviar el mismo QR muchas veces
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem('sanjuan_token')) { navigate('/expendio'); return; }
    getEstaciones().then(setEstaciones).catch(() => toast.error('No se pudieron cargar las estaciones'));
  }, [navigate]);

  // Loop de detección de QR mientras la cámara está activa.
  useEffect(() => {
    if (!camActiva || !soporta) return;
    let cancel = false;
    let raf;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }, audio: false,
        });
        if (cancel) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        tick();
      } catch {
        toast.error('No se pudo abrir la cámara');
        setCamActiva(false);
      }
    }

    async function tick() {
      if (cancel) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length && !lockRef.current) onCodigo(codes[0].rawValue);
      } catch { /* frame sin lectura */ }
      raf = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancel = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camActiva, soporta, estacion]);

  async function onCodigo(raw) {
    const hash = parseHash(raw);
    if (!hash) return;
    if (!estacion) { toast.error('Elegí una estación primero'); return; }
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      const envio = await enviarAEstacion(hash, estacion);
      const est = estaciones.find(e => e.id === estacion);
      setUltimo({ familia: envio.familia, estacion: est?.label || estacion });
      toast.success(`${envio.familia} → ${est?.label || estacion}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo enviar');
    } finally {
      // Pequeña pausa para no reenviar el mismo QR en ráfaga.
      setTimeout(() => { lockRef.current = false; }, 1500);
    }
  }

  function enviarManual(e) {
    e.preventDefault();
    const val = manual.trim();
    if (!val) return;
    onCodigo(val);
    setManual('');
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>📷 Lector · Despacho</h1>
        <button onClick={() => navigate('/expendio/panel')} className={styles.btnSec}>← Panel</button>
      </header>

      <div className={styles.contenido}>
        <p className={styles.label}>Enviar a estación:</p>
        <div className={styles.estaciones}>
          {estaciones.map(e => (
            <button
              key={e.id}
              className={`${styles.estBtn} ${estacion === e.id ? styles.estActiva : ''}`}
              onClick={() => { setEstacion(e.id); localStorage.setItem('scan_estacion', e.id); }}
            >
              {e.label}
            </button>
          ))}
        </div>

        {estacion && (
          <>
            {soporta ? (
              <div className={styles.camWrap}>
                <video ref={videoRef} className={styles.video} playsInline muted />
                {!camActiva ? (
                  <button className={styles.btnCam} onClick={() => setCamActiva(true)}>▶ Activar cámara</button>
                ) : (
                  <>
                    <div className={styles.mira} />
                    <button className={styles.btnCamStop} onClick={() => setCamActiva(false)}>⏸ Pausar</button>
                  </>
                )}
              </div>
            ) : (
              <p className={styles.aviso}>⚠️ Este dispositivo no soporta escaneo por cámara. Usá la entrada manual.</p>
            )}

            <form onSubmit={enviarManual} className={styles.manualRow}>
              <input
                value={manual}
                onChange={e => setManual(e.target.value)}
                placeholder="Código / hash del pedido (manual)"
                className={styles.manualInput}
              />
              <button type="submit" className={styles.btnEnviar}>Enviar</button>
            </form>

            {ultimo && (
              <div className={styles.ultimo}>
                ✓ Último: <strong>{ultimo.familia}</strong> → {ultimo.estacion}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
