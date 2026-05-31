import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getEstaciones, getColaEstacion, atenderEnvio } from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import styles from './Despacho.module.css';

export default function ExpendioEstacion() {
  const { estacion } = useParams();
  const [cola, setCola] = useState([]);
  const [label, setLabel] = useState(estacion);
  const [online, setOnline] = useState(false);
  const navigate = useNavigate();
  const colaRef = useRef(0);

  useEffect(() => {
    if (!localStorage.getItem('sanjuan_token')) { navigate('/expendio'); return; }
    getEstaciones()
      .then(ests => {
        const e = ests.find(x => x.id === estacion);
        if (!e) { toast.error('Estación inválida'); navigate('/expendio/panel'); return; }
        setLabel(e.label);
      })
      .catch(() => {});
    cargarCola();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estacion]);

  async function cargarCola(avisar = false) {
    try {
      const data = await getColaEstacion(estacion);
      // Si llegó uno nuevo respecto al conteo anterior, avisamos.
      if (avisar && data.length > colaRef.current) toast.success('Nuevo pedido en la estación');
      colaRef.current = data.length;
      setCola(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo cargar la cola');
    }
  }

  // Suscripción realtime: ante cada aviso del RTS recargamos la cola (la base es
  // la fuente de verdad; el socket solo dispara la actualización).
  useEffect(() => {
    const cleanup = suscribirScope(`sanjuan-${estacion}`, 'expendio', () => cargarCola(true), setOnline);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estacion]);

  async function atender(id) {
    try {
      await atenderEnvio(id);
      setCola(c => c.filter(x => x.id !== id));
      colaRef.current = Math.max(0, colaRef.current - 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>🍖 {label}</h1>
        <div className={styles.headRight}>
          <span className={`${styles.dot} ${online ? styles.dotOn : styles.dotOff}`} title={online ? 'En vivo' : 'Sin conexión'} />
          <button onClick={() => navigate('/expendio/panel')} className={styles.btnSec}>← Panel</button>
        </div>
      </header>

      <div className={styles.colaWrap}>
        {cola.length === 0 ? (
          <div className={styles.vacio}>
            <div className={styles.vacioEmoji}>📭</div>
            <p>Sin pedidos en cola. Esperando envíos…</p>
          </div>
        ) : (
          <div className={styles.tarjetas}>
            {cola.map(p => (
              <div key={p.id} className={styles.tarjeta}>
                <div className={styles.tarjCodigo}>{p.hash.substring(0, 8).toUpperCase()}</div>
                <div className={styles.tarjFamilia}>{p.familia}</div>
                <div className={styles.tarjMeta}>
                  <span>{Number(p.total_items)} ítems</span>
                  <span>{new Date(p.creado_en).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={styles.tarjAcciones}>
                  <a
                    href={`/expendio/panel?hash=${p.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.btnVer}
                  >
                    Entregar
                  </a>
                  <button className={styles.btnAtender} onClick={() => atender(p.id)}>✓ Atender</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
