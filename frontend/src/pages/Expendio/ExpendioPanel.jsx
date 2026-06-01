import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPedidosExpendio, getEstaciones } from '../../api';
import toast from 'react-hot-toast';
import EntregaCard from './EntregaCard';
import styles from './Expendio.module.css';

export default function ExpendioPanel() {
  const [searchParams] = useSearchParams();
  const [hash, setHash] = useState('');
  // Deep-link desde la pantalla de estación: /expendio/panel?hash=XXXX abre el
  // pedido directo para entregarlo (init lazy para no setState en el efecto).
  const [hashAbierto, setHashAbierto] = useState(() => searchParams.get('hash') || null);
  const [pedidosLista, setPedidosLista] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [cargandoLista, setCargandoLista] = useState(true);
  const [estaciones, setEstaciones] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    cargarLista();
    getEstaciones().then(setEstaciones).catch(() => {});
  }, []);

  async function cargarLista() {
    setCargandoLista(true);
    try {
      const data = await getPedidosExpendio();
      setPedidosLista(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cargar pedidos');
    } finally {
      setCargandoLista(false);
    }
  }

  function buscarPedido(e) {
    e.preventDefault();
    const val = hash.trim();
    if (val) setHashAbierto(val);
  }

  function volverAlListado() {
    setHashAbierto(null);
    setHash('');
    cargarLista();
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
        <h1>🍖 Expendio</h1>
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
        {!hashAbierto && (
          <>
            <form onSubmit={buscarPedido} className={styles.buscador}>
              <input
                value={hash}
                onChange={e => setHash(e.target.value)}
                placeholder="Hash o código del pedido"
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
                        <button className={styles.btnAbrir} onClick={() => setHashAbierto(p.hash)}>
                          Abrir
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {hashAbierto && (
          <div className={styles.pedidoCard}>
            <button onClick={volverAlListado} className={styles.btnVolverLista} type="button">
              ← Volver al listado
            </button>
            <EntregaCard
              hash={hashAbierto}
              onEntregado={({ idot }) => window.open(`/expendio/boleta/${hashAbierto}/${idot}`, '_blank')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
