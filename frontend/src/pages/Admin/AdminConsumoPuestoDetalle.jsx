import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getConsumoDetallePuesto } from '../../api';
import { descargarCSV } from '../../utils/csv';
import styles from './Admin.module.css';

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');

// Hora de Paraguay (Asunción, hoy −3), independiente de la zona del dispositivo
// del admin. El backend manda la fecha como instante UTC.
const fmtFechaHora = (f) =>
  f
    ? new Date(f).toLocaleString('es-PY', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'America/Asuncion',
      })
    : '—';

export default function AdminConsumoPuestoDetalle() {
  const { idpuesto } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setCargando(true);
    setError('');
    getConsumoDetallePuesto(idpuesto)
      .then(setData)
      .catch((err) => {
        if (err?.response?.status === 401) navigate('/admin');
        else setError(err?.response?.data?.error || err.message || 'Error al cargar datos');
      })
      .finally(() => setCargando(false));
  }, [idpuesto]);

  const puesto = data?.puesto;
  const consumos = data?.consumos || [];
  const totales = data?.totales || { creditos: 0, valor: 0 };

  const exportar = () => {
    const filas = [
      ['#', 'Fecha y hora (PY)', 'Tarjeta', 'Valor (Gs.)'],
      ...consumos.map((c, i) => [i + 1, fmtFechaHora(c.fecha), c.tarjeta, Number(c.valor_unitario || 0)]),
      ['', '', 'TOTAL', totales.valor],
    ];
    const nombre = puesto ? `consumo-${puesto.codigo}.csv` : 'consumo-puesto.csv';
    descargarCSV(nombre, filas);
  };

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Detalle de Consumo</h1>
        <div className={styles.navLinks}>
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/pedidos">Pedidos</Link>
          <Link to="/admin/productos">Productos</Link>
          <Link to="/admin/ventas-producto">Ventas x Producto</Link>
          <Link to="/admin/reportes">Reportes</Link>
          <Link to="/admin/usuarios">Usuarios</Link>
          <Link to="/admin/puestos">Puestos</Link>
          <Link to="/admin/configuracion">Configuración</Link>
          <a onClick={() => { localStorage.clear(); navigate('/admin'); }} style={{ cursor: 'pointer' }}>Salir</a>
        </div>
      </nav>

      <div className={styles.contenido}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <Link to="/admin/reportes/consumo-puesto" style={{ fontSize: '0.9rem', color: '#0B2E55' }}>← Consumo por puesto</Link>
          <button
            onClick={exportar}
            disabled={!consumos.length}
            className={styles.btnPagar}
            style={{ background: '#0B2E55', padding: '0.5rem 1rem', opacity: consumos.length ? 1 : 0.5 }}
          >
            ⬇ Descargar CSV
          </button>
        </div>

        {puesto && (
          <h2 style={{ marginTop: 0 }}>
            <span style={{ color: '#999', fontWeight: 400, marginRight: 8 }}>{puesto.codigo}</span>
            {puesto.nombre}
          </h2>
        )}

        <div className={styles.cards}>
          <div className={styles.cardStat}>
            <h3>Créditos consumidos</h3>
            <div className={styles.valor}>{fmtNum(totales.creditos)}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Valor total</h3>
            <div className={styles.valor} style={{ fontSize: '1.2rem' }}>{fmtGs(totales.valor)}</div>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#900', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {cargando ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha y hora</th>
                <th>Tarjeta</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {consumos.map((c, i) => (
                <tr key={c.id}>
                  <td style={{ color: '#999', fontSize: '0.85rem' }}>{i + 1}</td>
                  <td>{fmtFechaHora(c.fecha)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{c.tarjeta}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtGs(c.valor_unitario)}</td>
                </tr>
              ))}
              {consumos.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Este puesto no registró consumo</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
