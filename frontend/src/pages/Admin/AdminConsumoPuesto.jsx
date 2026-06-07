import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getConsumoPorPuesto } from '../../api';
import styles from './Admin.module.css';

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');

// Genera y dispara la descarga de un CSV con BOM (para que Excel respete los
// acentos) a partir de una matriz de filas. Cada celda se escapa entre comillas.
function descargarCSV(nombre, filas) {
  const csv = filas
    .map((fila) => fila.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminConsumoPuesto() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setCargando(true);
    setError('');
    getConsumoPorPuesto()
      .then(setData)
      .catch((err) => {
        if (err?.response?.status === 401) navigate('/admin');
        else setError(err?.response?.data?.error || err.message || 'Error al cargar datos');
      })
      .finally(() => setCargando(false));
  }, []);

  const puestos = data?.puestos || [];
  const totales = data?.totales || { creditos: 0, valor: 0 };
  const conConsumo = useMemo(() => puestos.filter((p) => Number(p.creditos) > 0).length, [puestos]);
  const maxValor = Math.max(1, ...puestos.map((p) => Number(p.valor || 0)));

  const exportar = () => {
    const filas = [
      ['#', 'Código', 'Puesto', 'Créditos consumidos', 'Valor (Gs.)', '% del total'],
      ...puestos.map((p, i) => {
        const valor = Number(p.valor || 0);
        const pct = totales.valor > 0 ? ((valor / totales.valor) * 100).toFixed(1) : '0.0';
        return [i + 1, p.codigo, p.nombre, Number(p.creditos || 0), valor, pct];
      }),
      ['', '', 'TOTAL', totales.creditos, totales.valor, '100.0'],
    ];
    descargarCSV('consumo-por-puesto.csv', filas);
  };

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Consumo por Puesto</h1>
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
            disabled={!puestos.length}
            className={styles.btnPagar}
            style={{ background: '#0B2E55', padding: '0.5rem 1rem', opacity: puestos.length ? 1 : 0.5 }}
          >
            ⬇ Descargar CSV
          </button>
        </div>

        <div className={styles.cards}>
          <div className={styles.cardStat}>
            <h3>Créditos consumidos</h3>
            <div className={styles.valor}>{fmtNum(totales.creditos)}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Valor total</h3>
            <div className={styles.valor} style={{ fontSize: '1.2rem' }}>{fmtGs(totales.valor)}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Puestos con consumo</h3>
            <div className={styles.valor}>{fmtNum(conConsumo)}</div>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#900', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
            {error} — verificá que el backend esté actualizado con el endpoint <code>/api/tarjetas/admin/consumo-puesto</code>.
          </div>
        )}

        {cargando ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Puesto</th>
                <th style={{ textAlign: 'right' }}>Créditos</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'right' }}>% del total</th>
              </tr>
            </thead>
            <tbody>
              {puestos.map((p, i) => {
                const creditos = Number(p.creditos || 0);
                const valor = Number(p.valor || 0);
                const pct = totales.valor > 0 ? (valor / totales.valor) * 100 : 0;
                const barra = (valor / maxValor) * 100;
                return (
                  <tr key={p.idpuesto} style={{ opacity: creditos > 0 ? 1 : 0.5 }}>
                    <td style={{ color: '#999', fontSize: '0.85rem' }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        <span style={{ color: '#999', fontWeight: 400, marginRight: 6 }}>{p.codigo}</span>
                        {p.nombre}
                      </div>
                      <div style={{ height: 4, background: '#eee', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${barra}%`, height: '100%', background: '#0B2E55' }} />
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtNum(creditos)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtGs(valor)}</td>
                    <td style={{ textAlign: 'right' }}>{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
              {puestos.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin consumo registrado</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
