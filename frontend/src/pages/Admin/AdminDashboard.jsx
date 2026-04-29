import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getResumen } from '../../api';
import styles from './Admin.module.css';

export default function AdminDashboard() {
  const [resumen, setResumen] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getResumen().then(setResumen).catch(() => navigate('/admin'));
  }, []);

  if (!resumen) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;

  const { dashboard, porProducto } = resumen;

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Admin</h1>
        <div className={styles.navLinks}>
          <Link to="/admin/pedidos">Pedidos</Link>
          <Link to="/admin/productos">Productos</Link>
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
            <h3>Monto Pagado</h3>
            <div className={styles.valor} style={{ fontSize: '1.2rem' }}>Gs. {Number(dashboard.monto_pagado).toLocaleString()}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Monto Pendiente</h3>
            <div className={styles.valor} style={{ fontSize: '1.2rem', color: '#f59e0b' }}>Gs. {Number(dashboard.monto_pendiente).toLocaleString()}</div>
          </div>
        </div>

        <h2 style={{ marginBottom: '0.75rem' }}>Resumen por Producto</h2>
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
