import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getFotos } from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import styles from './AutoFotoGaleria.module.css';

// Galería pública de AUTO FOTO (/fotos). La gente entra desde el QR del TV y baja
// su foto ya con el marco de San Juan.
//
// Pro: orden DESC (más nuevas primero), scroll infinito por cursor (Intersection-
// Observer), skeletons mientras carga, fade-in por imagen y cero salto de layout
// (toda foto es 4:5, así el alto de cada celda está reservado de antemano).

const LIMIT = 24;

// Celda con fade-in: muestra un shimmer hasta que la imagen termina de cargar.
function Celda({ foto, onAbrir, onDescargar }) {
  const [cargada, setCargada] = useState(false);
  return (
    <figure className={`${styles.item} ${cargada ? styles.cargada : ''}`} onClick={() => onAbrir(foto)}>
      <img
        src={foto.url}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setCargada(true)}
        onError={() => setCargada(true)}
      />
      <button
        className={styles.descargar}
        onClick={(e) => { e.stopPropagation(); onDescargar(foto); }}
      >
        ⬇ Descargar
      </button>
    </figure>
  );
}

export default function AutoFotoGaleria() {
  const [fotos, setFotos] = useState([]);
  const [estado, setEstado] = useState('cargando'); // cargando | listo
  const [cargandoMas, setCargandoMas] = useState(false);
  const [hayMas, setHayMas] = useState(true);
  const [activa, setActiva] = useState(null); // foto abierta en el visor
  const sentinela = useRef(null);
  const idsRef = useRef(new Set());

  const recordar = (lista) => lista.forEach(f => idsRef.current.add(f.id));

  const cargarInicial = useCallback(async () => {
    try {
      const r = await getFotos({ limit: LIMIT });
      idsRef.current = new Set(r.map(f => f.id));
      setFotos(r);
      setHayMas(r.length === LIMIT);
    } catch { /* mantenemos lo que haya */ }
    finally { setEstado('listo'); }
  }, []);

  const cargarMas = useCallback(async () => {
    if (cargandoMas || !hayMas) return;
    const ultima = fotos[fotos.length - 1];
    if (!ultima) return;
    setCargandoMas(true);
    try {
      const r = await getFotos({ before: ultima.id, limit: LIMIT });
      const nuevas = r.filter(f => !idsRef.current.has(f.id));
      recordar(nuevas);
      setFotos(prev => [...prev, ...nuevas]);
      setHayMas(r.length === LIMIT);
    } catch { /* reintenta al volver a intersectar */ }
    finally { setCargandoMas(false); }
  }, [cargandoMas, hayMas, fotos]);

  // RTS: foto nueva/moderada → traemos la página más nueva y agregamos al frente
  // lo que no teníamos (sin romper la posición de scroll del visitante).
  const refrescarNuevas = useCallback(async () => {
    try {
      const r = await getFotos({ limit: LIMIT });
      const nuevas = r.filter(f => !idsRef.current.has(f.id));
      if (!nuevas.length) return;
      recordar(nuevas);
      setFotos(prev => [...nuevas, ...prev]);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { cargarInicial(); }, [cargarInicial]);
  useEffect(() => suscribirScope('sanjuan-fotos', 'fotos', refrescarNuevas), [refrescarNuevas]);

  // Scroll infinito: dispara cargarMas al acercarse el sentinel al viewport.
  useEffect(() => {
    const el = sentinela.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entradas) => { if (entradas[0].isIntersecting) cargarMas(); },
      { rootMargin: '700px' }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [cargarMas]);

  // Descarga forzada (blob) para que el celular guarde el archivo en vez de abrirlo.
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

      {estado === 'cargando' ? (
        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : fotos.length === 0 ? (
        <div className={styles.vacio}>
          <div>📸</div>
          <p>Todavía no hay fotos publicadas. ¡Volvé en un rato!</p>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {fotos.map(f => (
              <Celda key={f.id} foto={f} onAbrir={setActiva} onDescargar={descargar} />
            ))}
          </div>

          {/* Sentinel + estado de carga del scroll infinito */}
          <div ref={sentinela} className={styles.sentinela}>
            {cargandoMas && <span className={styles.spinner} />}
            {!hayMas && <span className={styles.fin}>· fin ·</span>}
          </div>
        </>
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
