import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPedidoExpendio, registrarEntrega, getHistorialExpendio } from '../../api';
import toast from 'react-hot-toast';
import styles from './Expendio.module.css';

export default function ExpendioPanel() {
  const [hash, setHash] = useState('');
  const [pedido, setPedido] = useState(null);
  const [cantidades, setCantidades] = useState({});
  const [historial, setHistorial] = useState([]);
  const [tab, setTab] = useState('entregar');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  async function buscarPedido(e) {
    e.preventDefault();
    const val = hash.trim();
    if (!val) return;
    setCargando(true);
    try {
      const [data, hist] = await Promise.all([
        getPedidoExpendio(val),
        getHistorialExpendio(val),
      ]);
      setPedido(data);
      setHistorial(hist);
      const init = {};
      data.items.forEach(i => { init[i.idproducto] = 0; });
      setCantidades(init);
      setTab('entregar');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Pedido no encontrado o no pagado');
      setPedido(null);
      setHistorial([]);
    } finally {
      setCargando(false);
    }
  }

  function seleccionarTodo() {
    const init = {};
    pedido.items.forEach(i => { init[i.idproducto] = i.pendiente; });
    setCantidades(init);
  }

  function cambiar(idproducto, delta, max) {
    setCantidades(c => {
      const val = Math.min(Math.max(0, (c[idproducto] || 0) + delta), max);
      return { ...c, [idproducto]: val };
    });
  }

  async function handleEntregar() {
    const items = pedido.items
      .filter(i => cantidades[i.idproducto] > 0)
      .map(i => ({ idproducto: i.idproducto, cantidad: cantidades[i.idproducto] }));

    if (!items.length) { toast.error('Seleccioná al menos un ítem'); return; }

    setCargando(true);
    try {
      const { idot } = await registrarEntrega(hash, items);
      toast.success('Entrega registrada');
      const [data, hist] = await Promise.all([
        getPedidoExpendio(hash),
        getHistorialExpendio(hash),
      ]);
      setPedido(data);
      setHistorial(hist);
      const init = {};
      data.items.forEach(i => { init[i.idproducto] = 0; });
      setCantidades(init);
      window.open(`/expendio/boleta/${hash}/${idot}`, '_blank');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar entrega');
    } finally {
      setCargando(false);
    }
  }

  const hayPendientes = pedido?.items.some(i => i.pendiente > 0);

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>🍖 Expendio</h1>
        <button onClick={() => { localStorage.clear(); navigate('/expendio'); }} className={styles.btnSalir}>Salir</button>
      </header>

      <div className={styles.contenido}>
        <form onSubmit={buscarPedido} className={styles.buscador}>
          <input
            value={hash}
            onChange={e => setHash(e.target.value)}
            placeholder="Hash o código del pedido"
            className={styles.inputHash}
          />
          <button type="submit" disabled={cargando}>Buscar</button>
        </form>

        {pedido && (
          <div className={styles.pedidoCard}>
            <div className={styles.pedidoHeader}>
              <div>
                <strong>{pedido.familia}</strong>
                <span className={styles.codigo}> · {pedido.hash.substring(0, 8).toUpperCase()}</span>
              </div>
              <span className={`${styles.badge} ${pedido.estado === 'PAGADO' ? styles.pagado : styles.pendiente}`}>
                {pedido.estado}
              </span>
            </div>

            <div className={styles.tabs}>
              <button
                className={`${styles.tabBtn} ${tab === 'entregar' ? styles.tabActivo : ''}`}
                onClick={() => setTab('entregar')}
                type="button"
              >
                ENTREGAR
              </button>
              <button
                className={`${styles.tabBtn} ${tab === 'retiros' ? styles.tabActivo : ''}`}
                onClick={() => setTab('retiros')}
                type="button"
              >
                RETIROS {historial.length > 0 && <span className={styles.badge2}>{historial.length}</span>}
              </button>
            </div>

            {tab === 'entregar' && (
              <>
                <button
                  className={styles.btnSelAll}
                  onClick={seleccionarTodo}
                  type="button"
                  disabled={!hayPendientes}
                >
                  Seleccionar todos los saldos
                </button>

                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Ped.</th>
                      <th>Entregado</th>
                      <th>Saldo</th>
                      <th>A entregar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.items.map(item => (
                      <tr key={item.idproducto} style={{ background: item.pendiente === 0 ? '#f0fdf4' : 'white' }}>
                        <td>{item.titulo}</td>
                        <td>{item.cantidad}</td>
                        <td>{item.entregado}</td>
                        <td style={{ color: item.pendiente > 0 ? '#E63946' : '#22c55e', fontWeight: '700' }}>
                          {item.pendiente}
                        </td>
                        <td>
                          {item.pendiente > 0 ? (
                            <div className={styles.plusMinus}>
                              <button
                                type="button"
                                onClick={() => cambiar(item.idproducto, -1, item.pendiente)}
                              >−</button>
                              <span>{cantidades[item.idproducto] ?? 0}</span>
                              <button
                                type="button"
                                onClick={() => cambiar(item.idproducto, 1, item.pendiente)}
                              >+</button>
                            </div>
                          ) : (
                            <span className={styles.yaEntregado}>✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {hayPendientes ? (
                  <button className={styles.btnEntregar} onClick={handleEntregar} disabled={cargando}>
                    {cargando ? 'Registrando...' : '✅ Registrar Entrega'}
                  </button>
                ) : (
                  <div className={styles.todoEntregado}>TODOS LOS PRODUCTOS YA FUERON RETIRADOS</div>
                )}
              </>
            )}

            {tab === 'retiros' && (
              <div className={styles.historialWrap}>
                {historial.length === 0 ? (
                  <em>No hay retiros registrados aún.</em>
                ) : (
                  <>
                    <p className={styles.historialTitulo}>Boletas emitidas:</p>
                    <ul className={styles.boletasList}>
                      {historial.map(b => (
                        <li key={b.idot} className={styles.boletaItem}>
                          <a
                            href={`/expendio/boleta/${hash}/${b.idot}`}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.boletaLink}
                          >
                            {b.idot.substring(0, 8).toUpperCase()}...
                          </a>
                          <span className={styles.fechaBoleta}>
                            {new Date(b.fecha).toLocaleString('es-PY')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
