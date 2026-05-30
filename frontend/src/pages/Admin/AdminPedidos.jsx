import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPedidosAdmin, marcarPagado } from '../../api';
import toast from 'react-hot-toast';
import styles from './Admin.module.css';

function waLink(p) {
  const codigo = p.hash.substring(0, 8).toUpperCase();
  const link = `https://sanjuandicequesi.com/pedido/${p.hash}`;
  let msg;
  if (p.estado === 'PAGADO') {
    msg = `*SAN JUAN DICE QUE SI 2026*\n\n✅ Tu pedido ${codigo} (${p.familia})ha sido VALIDADO.\nTotal: Gs. ${Number(p.total).toLocaleString()}\n\nVer pedido: ${link}`;
  } else {
    msg = `*SAN JUAN DICE QUE SI 2026*\n\n🔔 Tu pedido ${codigo} (${p.familia})está PENDIENTE DE PAGO.\nTotal: Gs. ${Number(p.total).toLocaleString()}\n\n💸 Transferí al alias 0981352935 y enviá comprobante por WhatsApp.\n\nVer pedido: ${link}`;
  }
  const num = p.contacto.replace(/\D/g, '').replace(/^0/, '');
  return `https://wa.me/595${num}?text=${encodeURIComponent(msg)}`;
}

export default function AdminPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('TODOS');
  const navigate = useNavigate();

  useEffect(() => {
    getPedidosAdmin().then(setPedidos).catch(() => navigate('/admin'));
  }, []);

  async function handlePagar(id) {
    try {
      await marcarPagado(id);
      setPedidos(prev => prev.map(p => p.idpedido === id ? { ...p, estado: 'PAGADO' } : p));
      toast.success('Pedido marcado como pagado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  }

  const filtrados = filtro === 'TODOS' ? pedidos : pedidos.filter(p => p.estado === filtro);

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Pedidos</h1>
        <div className={styles.navLinks}>
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/pedidos">Pedidos</Link>
          <Link to="/admin/productos">Productos</Link>
          <Link to="/admin/ventas-producto">Ventas x Producto</Link>
          <Link to="/admin/usuarios">Usuarios</Link>
          <Link to="/admin/puestos">Puestos</Link>
          <a onClick={() => { localStorage.clear(); navigate('/admin'); }} style={{ cursor: 'pointer' }}>Salir</a>
        </div>
      </nav>

      <div className={styles.contenido}>
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
          {['TODOS', 'PENDIENTE', 'PAGADO'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
                background: filtro === f ? '#0B2E55' : '#ddd', color: filtro === f ? 'white' : '#333' }}>
              {f}
            </button>
          ))}
        </div>

        <table>
          <thead>
            <tr><th>#</th><th>Código</th><th>Fecha</th><th>Nombre</th><th>Total</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {filtrados.map(p => (
              <tr key={p.idpedido}>
                <td>{p.idpedido}</td>
                <td><a href={`/pedido/${p.hash}`} target="_blank">{p.hash.substring(0,8).toUpperCase()}</a></td>
                <td style={{ fontSize: '0.85rem' }}>{new Date(p.fecha).toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}</td>
                <td>{p.familia}</td>
                <td>Gs. {Number(p.total).toLocaleString()}</td>
                <td><span className={`${styles.badge} ${styles[p.estado.toLowerCase()]}`}>{p.estado}</span></td>
                <td>
                  {p.estado === 'PENDIENTE' && (
                    <button className={styles.btnPagar} onClick={() => handlePagar(p.idpedido)}>✓ Pagar</button>
                  )}
                  <a className={styles.btnWa} href={waLink(p)} target="_blank" title="WhatsApp">WA</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
