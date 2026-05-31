import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getResumen } from '../../api';
import styles from './Admin.module.css';

export default function AdminDashboard() {
  const [resumen, setResumen] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getResumen()
      .then(setResumen)
      .catch(err => { if (err?.response?.status === 401) navigate('/admin'); });
  }, []);

  if (!resumen) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;

  const { dashboard, porProducto } = resumen;

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Administración</h1>
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
        <div className={styles.cards}>
          <div className={styles.cardStat}>
            <h3>Total Pedidos</h3>
            <div className={styles.valor}>{dashboard.total_pedidos}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Pagados</h3>
            <div className={styles.valor} style={{ color: '#22c55e' }}>{dashboard.pagados}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Pendientes</h3>
            <div className={styles.valor} style={{ color: '#f59e0b' }}>{dashboard.pendientes}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Anulados</h3>
            <div className={styles.valor} style={{ color: '#dc2626' }}>{dashboard.anulados}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Monto Pagado</h3>
            <div className={styles.valor} style={{ fontSize: '1.2rem' }}>Gs. {Number(dashboard.monto_pagado).toLocaleString()}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Monto Pendiente</h3>
            <div className={styles.valor} style={{ fontSize: '1.2rem', color: '#f59e0b' }}>Gs. {Number(dashboard.monto_pendiente).toLocaleString()}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>Resumen por Producto</h2>
          <Link to="/admin/ventas-producto" style={{ fontSize: '0.9rem', color: '#0B2E55' }}>Ver detalle →</Link>
        </div>
        <table>
          <thead>
            <tr><th>Producto</th><th>Categoría</th><th>Pagado</th><th>Pendiente</th></tr>
          </thead>
          <tbody>
            {porProducto?.map(p => (
              <tr key={p.producto}>
                <td>{p.producto}</td>
                <td>{p.categoria}</td>
                <td>{p.pagado}</td>
                <td>{p.pendiente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
