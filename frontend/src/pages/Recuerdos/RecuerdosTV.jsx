import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getFotos } from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import styles from './RecuerdosTV.module.css';

// Carrusel de Recuerdos San Juan para los televisores. Pantalla fija: avanza solo y se
// actualiza en vivo por el RTS (scope sanjuan-fotos). Robusto ante cortes: si
// una recarga falla, sigue mostrando la lista que ya tenía. Cuando llega una
// foto nueva salta a mostrarla primero. Un QR invita a bajar las fotos en /fotos.
//
// Abrir en el navegador del device HDMI (Fire TV / Android box / Raspberry Pi)
// a pantalla completa en /fotos/tv.

const AVANCE_MS = 6000; // tiempo por foto

export default function RecuerdosTV() {
  const [fotos, setFotos] = useState([]);
  const [idx, setIdx] = useState(0);
  const [online, setOnline] = useState(false);
  const galeriaUrl = `${window.location.origin}/fotos`;
  const idsRef = useRef(new Set());

  const cargar = useCallback(async (saltarAlInicio = false) => {
    try {
      const lista = await getFotos({ limit: 200 });
      const nuevas = lista.some(f => !idsRef.current.has(f.id));
      idsRef.current = new Set(lista.map(f => f.id));
      setFotos(lista);
      if (saltarAlInicio && nuevas) setIdx(0); // mostrar la recién llegada
    } catch {
      // Silencioso: conservamos lo que ya estamos mostrando.
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(() => cargar(false), 30000); // respaldo si cae el RTS
    return () => clearInterval(id);
  }, [cargar]);

  // Realtime: ante foto nueva/moderada/borrada, recargamos y saltamos al inicio.
  useEffect(() => {
    const cleanup = suscribirScope('sanjuan-fotos', 'fotos', () => cargar(true), setOnline);
    return cleanup;
  }, [cargar]);

  // Avance automático.
  useEffect(() => {
    if (fotos.length <= 1) return;
    const id = setInterval(() => setIdx(i => (i + 1) % fotos.length), AVANCE_MS);
    return () => clearInterval(id);
  }, [fotos.length]);

  // Mantener idx dentro de rango si cambió la cantidad.
  useEffect(() => {
    if (idx >= fotos.length && fotos.length > 0) setIdx(0);
  }, [fotos.length, idx]);

  const actual = fotos[idx];

  return (
    <div className={styles.tv}>
      {actual ? (
        <>
          <div className={styles.fondo} style={{ backgroundImage: `url(${actual.url})` }} />
          <div className={styles.escena}>
            {/* Solo la foto activa en el DOM (keyed por id → re-anima el fundido).
                Renderizar todas ahogaría un device HDMI con muchas fotos. */}
            <img key={actual.id} src={actual.url} alt="" className={`${styles.foto} ${styles.activa}`} />
          </div>
        </>
      ) : (
        <div className={styles.espera}>
          <div className={styles.esperaEmoji}>📸</div>
          <h1>RECUERDOS SAN JUAN</h1>
          <p>Las fotos del San Juan van a aparecer acá…</p>
        </div>
      )}

      <header className={styles.marca}>
        <span className={styles.fuego}>🔥</span>
        <div>
          <div className={styles.marcaTit}>RECUERDOS</div>
          <div className={styles.marcaSub}>San Juan dice que sí</div>
        </div>
        <span className={`${styles.dot} ${online ? styles.dotOn : styles.dotOff}`} />
      </header>

      <div className={styles.qrCard}>
        <QRCodeSVG value={galeriaUrl} size={120} bgColor="#ffffff" fgColor="#0b1622" />
        <span>Escaneá<br /><strong>bajá tu foto</strong></span>
      </div>

      {fotos.length > 0 && (
        <div className={styles.puntos}>
          {fotos.slice(0, 12).map((_, i) => (
            <span key={i} className={i === idx % Math.min(fotos.length, 12) ? styles.puntoOn : styles.punto} />
          ))}
        </div>
      )}
    </div>
  );
}
