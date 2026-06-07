import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCuadreAcreditacion } from '../../api';
import { descargarCSV } from '../../utils/csv';
import styles from './Admin.module.css';

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');

export default function AdminCuadreAcreditacion() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setCargando(true);
    setError('');
    getCuadreAcreditacion()
      .then(setData)
      .catch((err) => {
        if (err?.response?.status === 401) navigate('/admin');
        else setError(err?.response?.data?.error || err.message || 'Error al cargar datos');
      })
      .finally(() => setCargando(false));
  }, []);

  const t = data?.totales || {};
  const porValor = data?.porValor || [];
  const tarjetas = data?.tarjetas || [];

  const exportar = () => {
    const filas = [
      ['CUADRE DE ACREDITACIÓN'],
      ['Concepto', 'Créditos', 'Monto (Gs.)'],
      ['Cargados', Number(t.cargados || 0), Number(t.gs_cargado || 0)],
      ['Consumidos', Number(t.consumidos || 0), Number(t.gs_consumido || 0)],
      ['No consumidos (saldo)', Number(t.no_consumidos || 0), Number(t.gs_no_consumido || 0)],
      [],
      ['POR PRECIO', 'Cargados', 'Consumidos', 'No consumidos', 'Saldo (Gs.)'],
      ...porValor.map((v) => [
        fmtGs(v.valor_unitario), Number(v.cargados || 0), Number(v.consumidos || 0),
        Number(v.no_consumidos || 0), Number(v.gs_no_consumido || 0),
      ]),
      [],
      ['TARJETAS CON SALDO PENDIENTE'],
      ['Tarjeta', 'Saldo (créditos)', 'Saldo (Gs.)'],
      ...tarjetas.map((c) => [c.codigo, Number(c.saldo || 0), Number(c.saldo_gs || 0)]),
    ];
    descargarCSV('cuadre-acreditacion.csv', filas);
  };

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Cuadre de Acreditación</h1>
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
          <Link to="/admin/reportes" style={{ fontSize: '0.9rem', color: '#0B2E55' }}>← Reportes</Link>
          <button
            onClick={exportar}
            disabled={!data}
            className={styles.btnPagar}
            style={{ background: '#0B2E55', padding: '0.5rem 1rem', opacity: data ? 1 : 0.5 }}
          >
            ⬇ Descargar CSV
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#900', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
            {error} — verificá que el backend esté actualizado con el endpoint <code>/api/tarjetas/admin/cuadre-acreditacion</code>.
          </div>
        )}

        {cargando ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
        ) : (
          <>
            <div className={styles.cards}>
              <div className={styles.cardStat}>
                <h3>Cargado</h3>
                <div className={styles.valor} style={{ fontSize: '1.2rem' }}>{fmtGs(t.gs_cargado)}</div>
                <div style={{ fontSize: '0.8rem', color: '#999' }}>{fmtNum(t.cargados)} créditos</div>
              </div>
              <div className={styles.cardStat}>
                <h3>Consumido</h3>
                <div className={styles.valor} style={{ fontSize: '1.2rem', color: '#22c55e' }}>{fmtGs(t.gs_consumido)}</div>
                <div style={{ fontSize: '0.8rem', color: '#999' }}>{fmtNum(t.consumidos)} créditos</div>
              </div>
              <div className={styles.cardStat}>
                <h3>No consumido (saldo)</h3>
                <div className={styles.valor} style={{ fontSize: '1.2rem', color: '#f59e0b' }}>{fmtGs(t.gs_no_consumido)}</div>
                <div style={{ fontSize: '0.8rem', color: '#999' }}>{fmtNum(t.no_consumidos)} créditos</div>
              </div>
            </div>

            <h2 style={{ marginBottom: '0.5rem' }}>Por precio</h2>
            <table style={{ marginBottom: '2rem' }}>
              <thead>
                <tr>
                  <th>Valor unitario</th>
                  <th style={{ textAlign: 'right' }}>Cargados</th>
                  <th style={{ textAlign: 'right' }}>Consumidos</th>
                  <th style={{ textAlign: 'right' }}>No consumidos</th>
                  <th style={{ textAlign: 'right' }}>Saldo (Gs.)</th>
                </tr>
              </thead>
              <tbody>
                {porValor.map((v) => (
                  <tr key={v.valor_unitario}>
                    <td>{fmtGs(v.valor_unitario)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtNum(v.cargados)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtNum(v.consumidos)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtNum(v.no_consumidos)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtGs(v.gs_no_consumido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0 }}>Tarjetas con saldo pendiente</h2>
              <span style={{ fontSize: '0.85rem', color: '#999' }}>{fmtNum(tarjetas.length)} tarjetas</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tarjeta</th>
                  <th style={{ textAlign: 'right' }}>Saldo (créditos)</th>
                  <th style={{ textAlign: 'right' }}>Saldo (Gs.)</th>
                </tr>
              </thead>
              <tbody>
                {tarjetas.map((c, i) => (
                  <tr key={c.codigo}>
                    <td style={{ color: '#999', fontSize: '0.85rem' }}>{i + 1}</td>
                    <td style={{ fontFamily: 'monospace' }}>{c.codigo}</td>
                    <td style={{ textAlign: 'right' }}>{fmtNum(c.saldo)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtGs(c.saldo_gs)}</td>
                  </tr>
                ))}
                {tarjetas.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin saldos pendientes</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
