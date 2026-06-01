import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getEstaciones, getColaEstacion, atenderEnvio, getBoleta } from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import { imprimirBoleta, getTicketeraIP } from '../../utils/eposPrint';
import EntregaCard from './EntregaCard';
import styles from './Despacho.module.css';

export default function ExpendioEstacion() {
  const { estacion } = useParams();
  const [cola, setCola] = useState([]);
  const [label, setLabel] = useState(estacion);
  const [online, setOnline] = useState(false);
  const [sel, setSel] = useState(null); // envío seleccionado { id, hash }
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
      if (avisar && data.length > colaRef.current) toast.success('Nuevo pedido en la estación');
      colaRef.current = data.length;
      setCola(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo cargar la cola');
    }
  }

  // Realtime: ante cada aviso del RTS recargamos la cola (la DB es la verdad).
  useEffect(() => {
    const cleanup = suscribirScope(`sanjuan-${estacion}`, 'expendio', () => cargarCola(true), setOnline);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estacion]);

  function quitarDeCola(envioId) {
    setCola(c => c.filter(x => x.id !== envioId));
    colaRef.current = Math.max(0, colaRef.current - 1);
    setSel(null);
  }

  // Tras una entrega: imprime la comanda interna y, si ya no queda saldo, marca
  // el envío atendido y lo saca de la cola. Entregas parciales lo dejan en cola.
  async function onEntregado({ idot, pedido }) {
    try {
      if (getTicketeraIP()) {
        const boleta = await getBoleta(sel.hash, idot);
        await imprimirBoleta(boleta, { codigo: sel.hash.substring(0, 8).toUpperCase(), idot });
      }
    } catch (err) {
      toast.error(`Entregado, pero no se imprimió la comanda: ${err.message}`);
    }
    const quedaSaldo = pedido.items.some(i => i.pendiente > 0);
    if (!quedaSaldo) {
      try { await atenderEnvio(sel.id); } catch { /* noop */ }
      quitarDeCola(sel.id);
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

      <div className={styles.split}>
        {/* Lista (maestro) */}
        <div className={styles.lista}>
          <div className={styles.listaHead}>En cola ({cola.length})</div>
          {cola.length === 0 ? (
            <div className={styles.listaVacia}>📭 Sin pedidos. Esperando envíos…</div>
          ) : (
            cola.map(p => (
              <button
                key={p.id}
                className={`${styles.item} ${sel?.id === p.id ? styles.itemSel : ''}`}
                onClick={() => setSel(p)}
              >
                <div className={styles.itemTop}>
                  <span className={styles.itemCodigo}>{p.hash.substring(0, 8).toUpperCase()}</span>
                  <span className={styles.itemHora}>
                    {new Date(p.creado_en).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={styles.itemFamilia}>{p.familia}</div>
                <div className={styles.itemMeta}>{Number(p.total_items)} ítems</div>
              </button>
            ))
          )}
        </div>

        {/* Detalle: misma tarjeta de entrega que el panel */}
        <div className={styles.detalle}>
          {!sel ? (
            <div className={styles.detVacio}>👈 Seleccioná un pedido de la cola</div>
          ) : (
            <EntregaCard key={sel.id} hash={sel.hash} onEntregado={onEntregado} />
          )}
        </div>
      </div>
    </div>
  );
}
