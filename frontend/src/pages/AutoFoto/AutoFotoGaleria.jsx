import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getFotos } from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import styles from './AutoFotoGaleria.module.css';

// Galería pública de AUTO FOTO (/fotos). La gente entra desde el QR del TV y baja
// su foto ya con el marco de San Juan. Se actualiza en vivo por el RTS.

export default function AutoFotoGaleria() {
  const [fotos, setFotos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [activa, setActiva] = useState(null); // foto abierta en el visor

  const cargar = useCallback(async () => {
    try { setFotos(await getFotos()); }
    catch { /* mantenemos lo que haya */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => suscribirScope('sanjuan-fotos', 'fotos', cargar), [cargar]);

  // Descarga forzada (blob) para que el navegador del celular guarde el archivo
  // en vez de abrirlo en una pestaña.
  async function descargar(foto) {
    try {
      const resp = await fetch(foto.url);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `san-juan-${foto.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: abrir en pestaña nueva para guardar con "mantener presionado".
      window.open(foto.url, '_blank');
      toast('Mantené presionada la foto para guardarla', { icon: '💾' });
    }
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.fuego}>🔥</span>
          <div>
            <h1>AUTO FOTO</h1>
            <p>San Juan dice que sí · bajá tu foto</p>
          </div>
        </div>
      </header>

      {cargando ? (
        <p className={styles.aviso}>Cargando fotos…</p>
      ) : fotos.length === 0 ? (
        <div className={styles.vacio}>
          <div>📸</div>
          <p>Todavía no hay fotos publicadas. ¡Volvé en un rato!</p>
        </div>
      ) : (
        <div className={styles.masonry}>
          {fotos.map(f => (
            <figure key={f.id} className={styles.item} onClick={() => setActiva(f)}>
              <img src={f.url} alt="" loading="lazy" />
              <button
                className={styles.descargar}
                onClick={(e) => { e.stopPropagation(); descargar(f); }}
              >
                ⬇ Descargar
              </button>
            </figure>
          ))}
        </div>
      )}

      {activa && (
        <div className={styles.visor} onClick={() => setActiva(null)}>
          <button className={styles.cerrar} onClick={() => setActiva(null)}>✕</button>
          <img src={activa.url} alt="" onClick={e => e.stopPropagation()} />
          <button className={styles.visorDl} onClick={(e) => { e.stopPropagation(); descargar(activa); }}>
            ⬇ Descargar foto
          </button>
        </div>
      )}

      <footer className={styles.footer}>🔥 sanjuandicequesi.com</footer>
    </div>
  );
}
