import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getEstaciones, getColaEstacion, atenderEnvio,
  getPedidoExpendio, registrarEntrega, getBoleta,
} from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import { imprimirBoleta, getTicketeraIP } from '../../utils/eposPrint';
import styles from './Despacho.module.css';

export default function ExpendioEstacion() {
  const { estacion } = useParams();
  const [cola, setCola] = useState([]);
  const [label, setLabel] = useState(estacion);
  const [online, setOnline] = useState(false);
  const [sel, setSel] = useState(null);        // envío seleccionado { id, hash }
  const [detalle, setDetalle] = useState(null); // pedido con items
  const [cargandoDet, setCargandoDet] = useState(false);
  const [entregando, setEntregando] = useState(false);
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

  async function seleccionar(envio) {
    setSel(envio);
    setDetalle(null);
    setCargandoDet(true);
    try {
      const ped = await getPedidoExpendio(envio.hash);
      setDetalle(ped);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo abrir el pedido');
      setSel(null);
    } finally {
      setCargandoDet(false);
    }
  }

  function quitarDeCola(envioId) {
    setCola(c => c.filter(x => x.id !== envioId));
    colaRef.current = Math.max(0, colaRef.current - 1);
    setSel(null);
    setDetalle(null);
  }

  async function entregar() {
    if (!sel || !detalle) return;
    const pendientes = detalle.items
      .filter(i => i.pendiente > 0)
      .map(i => ({ idproducto: i.idproducto, cantidad: i.pendiente }));

    setEntregando(true);
    try {
      // Si ya estaba todo entregado, solo lo sacamos de la cola.
      if (pendientes.length > 0) {
        const { idot } = await registrarEntrega(sel.hash, pendientes);
        // Imprimir la comanda interna si hay ticketera configurada (no bloquea).
        try {
          if (getTicketeraIP()) {
            const boleta = await getBoleta(sel.hash, idot);
            await imprimirBoleta(boleta, { codigo: sel.hash.substring(0, 8).toUpperCase(), idot });
          }
        } catch (err) {
          toast.error(`Entregado, pero no se imprimió: ${err.message}`);
        }
      }
      await atenderEnvio(sel.id);
      toast.success('Pedido entregado');
      quitarDeCola(sel.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al entregar');
    } finally {
      setEntregando(false);
    }
  }

  const totalPendiente = detalle?.items?.reduce((a, i) => a + i.pendiente, 0) ?? 0;

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
                onClick={() => seleccionar(p)}
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

        {/* Detalle */}
        <div className={styles.detalle}>
          {!sel ? (
            <div className={styles.detVacio}>👈 Seleccioná un pedido de la cola</div>
          ) : cargandoDet ? (
            <div className={styles.detVacio}>Cargando…</div>
          ) : detalle ? (
            <>
              <div className={styles.detHead}>
                <div>
                  <div className={styles.detCodigo}>{detalle.hash.substring(0, 8).toUpperCase()}</div>
                  <div className={styles.detFamilia}>{detalle.familia}</div>
                </div>
              </div>

              <div className={styles.detTitulo}>ENTREGAR</div>
              <ul className={styles.detItems}>
                {detalle.items.map(it => (
                  <li key={it.idproducto} className={`${styles.detItem} ${it.pendiente === 0 ? styles.detItemListo : ''}`}>
                    <span className={styles.detCant}>{it.pendiente > 0 ? it.pendiente : '✓'}</span>
                    <span className={styles.detNombre}>{it.titulo}</span>
                    {it.pendiente === 0 && <span className={styles.detYa}>ya entregado</span>}
                  </li>
                ))}
              </ul>

              <button
                className={styles.btnEntregar}
                onClick={entregar}
                disabled={entregando}
              >
                {entregando ? 'Procesando…' : totalPendiente > 0 ? `✓ Entregar (${totalPendiente})` : '✓ Quitar de la cola'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
