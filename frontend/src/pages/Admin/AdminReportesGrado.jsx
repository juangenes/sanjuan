import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getConsumoPorPuesto, getConsumoDetallePuesto } from '../../api';
import { generarPdfGrado, generarXlsxGrado } from '../../utils/reporteGrado';
import styles from './Admin.module.css';

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');

export default function AdminReportesGrado() {
  const navigate = useNavigate();
  const [puestos, setPuestos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // `${idpuesto}:${tipo}`

  useEffect(() => {
    getConsumoPorPuesto()
      .then((d) => setPuestos(d.puestos || []))
      .catch((err) => {
        if (err?.response?.status === 401) navigate('/admin');
        else setError(err?.response?.data?.error || err.message || 'Error al cargar datos');
      })
      .finally(() => setCargando(false));
  }, []);

  async function generar(p, tipo) {
    const key = `${p.idpuesto}:${tipo}`;
    setBusy(key);
    try {
      const data = await getConsumoDetallePuesto(p.idpuesto); // { puesto, consumos, totales }
      if (tipo === 'pdf') await generarPdfGrado(data);
      else await generarXlsxGrado(data);
      toast.success(`${tipo.toUpperCase()} de ${data.puesto?.codigo} generado`);
    } catch (err) {
      if (err?.response?.status === 401) navigate('/admin');
      else toast.error(err?.response?.data?.error || err.message || 'No se pudo generar');
    } finally {
      setBusy(null);
    }
  }

  const btn = (p, tipo, label, color) => {
    const key = `${p.idpuesto}:${tipo}`;
    const trabajando = busy === key;
    return (
      <button
        onClick={() => generar(p, tipo)}
        disabled={!!busy}
        style={{
          background: color, color: 'white', border: 'none', borderRadius: 6,
          padding: '0.4rem 0.8rem', cursor: busy ? 'default' : 'pointer',
          opacity: busy && !trabajando ? 0.5 : 1, fontWeight: 600, fontSize: '0.85rem',
        }}
      >
        {trabajando ? '...' : label}
      </button>
    );
  };

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Reporte por Grado</h1>
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
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/admin/reportes" style={{ fontSize: '0.9rem', color: '#0B2E55' }}>← Reportes</Link>
          <p style={{ color: '#666', marginBottom: 0 }}>
            Generá el reporte de cada grado para enviar a las familias: un <strong>PDF</strong> con la carta de
            agradecimiento, las estadísticas y el detalle, y un <strong>Excel</strong> con formato.
          </p>
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#900', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>
        )}

        {cargando ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Grado</th>
                <th style={{ textAlign: 'right' }}>Juegos</th>
                <th style={{ textAlign: 'right' }}>Recaudación</th>
                <th style={{ textAlign: 'center' }}>Reportes</th>
              </tr>
            </thead>
            <tbody>
              {puestos.map((p) => {
                const sinDatos = Number(p.creditos) === 0;
                return (
                  <tr key={p.idpuesto} style={{ opacity: sinDatos ? 0.55 : 1 }}>
                    <td>
                      <span style={{ color: '#999', marginRight: 6 }}>{p.codigo}</span>
                      <strong>{p.nombre}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtNum(p.creditos)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtGs(p.valor)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        {btn(p, 'pdf', '📄 PDF', '#0B2E55')}
                        {btn(p, 'xlsx', '📊 Excel', '#1d7a46')}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {puestos.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin puestos</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
