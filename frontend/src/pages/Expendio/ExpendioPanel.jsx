import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPedidoExpendio, registrarEntrega } from '../../api';
import toast from 'react-hot-toast';
import styles from './Expendio.module.css';

export default function ExpendioPanel() {
  const [hash, setHash] = useState('');
  const [pedido, setPedido] = useState(null);
  const [cantidades, setCantidades] = useState({});
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  async function buscarPedido(e) {
    e.preventDefault();
    const val = hash.trim();
    if (!val) return;
    setCargando(true);
    try {
      const data = await getPedidoExpendio(val);
      setPedido(data);
      const init = {};
      data.items.forEach(i => { init[i.idproducto] = i.pendiente > 0 ? i.pendiente : 0; });
      setCantidades(init);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Pedido no encontrado o no pagado');
      setPedido(null);
    } finally {
      setCargando(false);
    }
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
      // Recargar pedido
      const data = await getPedidoExpendio(hash);
      setPedido(data);
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
                <span className={styles.codigo}> · {pedido.hash.substring(0,8).toUpperCase()}</span>
              </div>
              <span className={`${styles.badge} ${pedido.estado === 'PAGADO' ? styles.pagado : styles.pendiente}`}>
                {pedido.estado}
              </span>
            </div>

            <table className={styles.tabla}>
              <thead>
                <tr><th>Producto</th><th>Pedido</th><th>Entregado</th><th>Pendiente</th><th>A entregar</th></tr>
              </thead>
              <tbody>
                {pedido.items.map(item => (
                  <tr key={item.idproducto} style={{ background: item.pendiente === 0 ? '#f0fdf4' : 'white' }}>
                    <td>{item.titulo}</td>
                    <td>{item.cantidad}</td>
                    <td>{item.entregado}</td>
                    <td style={{ color: item.pendiente > 0 ? '#E63946' : '#22c55e', fontWeight: '700' }}>{item.pendiente}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={item.pendiente}
                        value={cantidades[item.idproducto] ?? 0}
                        onChange={e => setCantidades(c => ({ ...c, [item.idproducto]: Number(e.target.value) }))}
                        className={styles.inputCant}
                        disabled={item.pendiente === 0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button className={styles.btnEntregar} onClick={handleEntregar} disabled={cargando}>
              {cargando ? 'Registrando...' : '✅ Registrar Entrega'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
