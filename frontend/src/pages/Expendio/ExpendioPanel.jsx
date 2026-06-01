import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPedidosExpendio, getEstaciones, getPedidoExpendio, enviarAEstacion } from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import toast from 'react-hot-toast';
import styles from './Expendio.module.css';

// El panel es el RUTEADOR: busca un pedido (p.ej. quien llega sin QR) y lo
// envía a una estación. La entrega ocurre solo en las estaciones, así un pedido
// vive en una sola a la vez (concurrencia garantizada por el guard del backend).
export default function ExpendioPanel() {
  const [searchParams] = useSearchParams();
  const [hash, setHash] = useState('');
  const [abierto, setAbierto] = useState(() => searchParams.get('hash') || null);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDet, setCargandoDet] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pedidosLista, setPedidosLista] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [cargandoLista, setCargandoLista] = useState(true);
  const [estaciones, setEstaciones] = useState([]);
  const [online, setOnline] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    cargarLista();
    getEstaciones().then(setEstaciones).catch(() => {});
  }, []);

  // Board en vivo: el RTS avisa (caja cobra, se rutea, se libera, se entrega) y
  // refrescamos la lista en silencio (sin parpadeo de "Cargando").
  useEffect(() => {
    const cleanup = suscribirScope('sanjuan-despacho', 'expendio', () => cargarLista(true), setOnline);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const labelEst = (id) => estaciones.find(e => e.id === id)?.label || id;

  // Trae el detalle del pedido abierto (para confirmar antes de rutear).
  useEffect(() => {
    if (!abierto) return;
    let cancel = false;
    (async () => {
      setCargandoDet(true);
      try {
        const d = await getPedidoExpendio(abierto);
        if (!cancel) setDetalle(d);
      } catch (err) {
        if (!cancel) { toast.error(err.response?.data?.error || 'Pedido no encontrado o no pagado'); setAbierto(null); }
      } finally {
        if (!cancel) setCargandoDet(false);
      }
    })();
    return () => { cancel = true; };
  }, [abierto]);

  async function cargarLista(silent = false) {
    if (!silent) setCargandoLista(true);
    try {
      setPedidosLista(await getPedidosExpendio());
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.error || 'Error al cargar pedidos');
    } finally {
      if (!silent) setCargandoLista(false);
    }
  }

  function buscar(e) {
    e.preventDefault();
    const v = hash.trim();
    if (v) setAbierto(v);
  }

  function volver() {
    setAbierto(null);
    setHash('');
    cargarLista();
  }

  async function enviar(estId) {
    setEnviando(true);
    try {
      const envio = await enviarAEstacion(abierto, estId);
      const est = estaciones.find(e => e.id === estId);
      toast.success(`${envio.familia} → ${est?.label || estId}`);
      // Abre la vista de esa estación para ver el pedido caer en su cola.
      navigate(`/expendio/estacion/${estId}`);
    } catch (err) {
      // El guard de concurrencia responde acá: "El pedido ya está activo en Expendio N"
      toast.error(err.response?.data?.error || 'No se pudo enviar');
    } finally {
      setEnviando(false);
    }
  }

  const listaFiltrada = pedidosLista.filter(p => {
    if (!filtro.trim()) return true;
    const f = filtro.trim().toLowerCase();
    return (
      p.familia?.toLowerCase().includes(f) ||
      p.cedula?.toLowerCase?.().includes(f) ||
      p.hash?.substring(0, 8).toLowerCase().includes(f)
    );
  });

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>
          🍖 Expendio · Despacho
          <span
            title={online ? 'En vivo' : 'Sin conexión'}
            style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              marginLeft: 10, verticalAlign: 'middle',
              background: online ? '#22c55e' : '#E63946',
              boxShadow: online ? '0 0 0 3px rgba(34,197,94,.25)' : 'none',
            }}
          />
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {estaciones.map(e => (
            <a
              key={e.id}
              href={`/expendio/estacion/${e.id}`}
              target="_blank"
              rel="noreferrer"
              className={styles.btnSalir}
              style={{ background: '#1d4ed8', textDecoration: 'none', display: 'inline-block' }}
            >
              🖥 {e.label}
            </a>
          ))}
          <button onClick={() => navigate('/expendio/scan')} className={styles.btnSalir} style={{ background: '#0a7d2c' }}>📷 Lector</button>
          <button onClick={() => { localStorage.clear(); navigate('/expendio'); }} className={styles.btnSalir}>Salir</button>
        </div>
      </header>

      <div className={styles.contenido}>
        {!abierto && (
          <>
            <form onSubmit={buscar} className={styles.buscador}>
              <input
                value={hash}
                onChange={e => setHash(e.target.value)}
                placeholder="Hash, código, nombre o cédula"
                className={styles.inputHash}
              />
              <button type="submit">Buscar</button>
            </form>

            <div className={styles.listaWrap}>
              <div className={styles.listaHeader}>
                <h2 className={styles.listaTitulo}>Pedidos pagados ({pedidosLista.length})</h2>
                <input
                  type="text"
                  placeholder="Filtrar nombre, cédula o código..."
                  value={filtro}
                  onChange={e => setFiltro(e.target.value)}
                  className={styles.filtroInput}
                />
              </div>

              {cargandoLista ? (
                <div className={styles.listaVacia}>Cargando...</div>
              ) : listaFiltrada.length === 0 ? (
                <div className={styles.listaVacia}>
                  {pedidosLista.length === 0 ? 'No hay pedidos pagados.' : 'No hay pedidos que coincidan con el filtro.'}
                </div>
              ) : (
                <ul className={styles.listaPedidos}>
                  {listaFiltrada.map(p => {
                    const completo = Number(p.total_entregado) >= Number(p.total_items);
                    return (
                      <li key={p.idpedido} className={styles.pedidoLista}>
                        <div className={styles.pedidoListaInfo}>
                          <div className={styles.pedidoListaTitulo}>
                            <span className={styles.pedidoListaCodigo}>{p.hash.substring(0, 8).toUpperCase()}</span>
                            <strong>{p.familia}</strong>
                            {completo && <span className={styles.checkCompleto}>✓ entregado</span>}
                          </div>
                          <div className={styles.pedidoListaSub}>
                            <span>Cédula: {p.cedula}</span>
                            <span>Gs. {Number(p.total).toLocaleString()}</span>
                            <span>{Number(p.total_entregado)}/{Number(p.total_items)} ítems</span>
                          </div>
                        </div>
                        {p.estacion_activa ? (
                          <a
                            href={`/expendio/estacion/${p.estacion_activa}`}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.btnAbrir}
                            style={{ background: '#1d4ed8', textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' }}
                          >
                            🖥 En {labelEst(p.estacion_activa)}
                          </a>
                        ) : completo ? (
                          <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>✓ entregado</span>
                        ) : (
                          <button className={styles.btnAbrir} onClick={() => setAbierto(p.hash)}>
                            Enviar →
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {abierto && (
          <div className={styles.pedidoCard}>
            <button onClick={volver} className={styles.btnVolverLista} type="button">
              ← Volver al listado
            </button>

            {cargandoDet ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Cargando…</div>
            ) : detalle ? (
              <>
                <div className={styles.pedidoHeader}>
                  <div>
                    <strong>{detalle.familia}</strong>
                    <span className={styles.codigo}> · {detalle.hash.substring(0, 8).toUpperCase()}</span>
                  </div>
                  <span className={`${styles.badge} ${detalle.estado === 'PAGADO' ? styles.pagado : styles.pendiente}`}>
                    {detalle.estado}
                  </span>
                </div>

                {/* Resumen read-only del pedido (el panel no entrega, solo rutea) */}
                <ul className={styles.routeItems}>
                  {detalle.items.map(it => (
                    <li key={it.idproducto} className={styles.routeItem}>
                      <span>{it.cantidad}x {it.titulo}</span>
                      <span style={{ color: it.pendiente > 0 ? '#E63946' : '#22c55e', fontWeight: 700 }}>
                        {it.pendiente > 0 ? `faltan ${it.pendiente}` : '✓ entregado'}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className={styles.routeLabel}>Enviar a estación:</div>
                <div className={styles.routeEstaciones}>
                  {estaciones.map(e => (
                    <button
                      key={e.id}
                      className={styles.routeBtn}
                      onClick={() => enviar(e.id)}
                      disabled={enviando}
                    >
                      🖥 {e.label}
                    </button>
                  ))}
                </div>
                <p className={styles.routeHint}>
                  El comensal pasa a retirar a esa estación. Si el pedido ya está activo en otra,
                  el sistema te avisa y no lo duplica.
                </p>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
