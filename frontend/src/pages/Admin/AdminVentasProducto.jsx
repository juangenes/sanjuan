import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getVentasPorProducto } from '../../api';
import styles from './Admin.module.css';

const fmtGs = (n) => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('es-PY');
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-PY') : '—';

const CATEGORIAS = ['TODAS', 'COMIDA', 'BEBIDA', 'JUEGO'];

export default function AdminVentasProducto() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [categoria, setCategoria] = useState('TODAS');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('ingresos');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = () => {
    setCargando(true);
    setError('');
    getVentasPorProducto(desde || undefined, hasta || undefined)
      .then(setData)
      .catch(err => {
        if (err?.response?.status === 401) navigate('/admin');
        else setError(err?.response?.data?.error || err.message || 'Error al cargar datos');
      })
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    if (!data?.productos) return [];
    let arr = data.productos;
    if (categoria !== 'TODAS') arr = arr.filter(p => p.categoria === categoria);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      arr = arr.filter(p => p.producto.toLowerCase().includes(q));
    }
    arr = [...arr].sort((a, b) => Number(b[orden] || 0) - Number(a[orden] || 0));
    return arr;
  }, [data, categoria, busqueda, orden]);

  const totalIngresos = data?.productos?.reduce((s, p) => s + Number(p.ingresos || 0), 0) || 0;
  const maxIngresos = Math.max(1, ...filtrados.map(p => Number(p.ingresos || 0)));

  const totales = data?.totales || {};
  const ticketProm = totales.pedidos > 0 ? Math.round(totales.monto / totales.pedidos) : 0;

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Ventas por Producto</h1>
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
        <div style={{ background: 'white', padding: '1rem', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ddd', borderRadius: 4 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ddd', borderRadius: 4 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Categoría</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ddd', borderRadius: 4 }}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Buscar producto</label>
            <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Ej. Mbeju" style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Ordenar por</label>
            <select value={orden} onChange={e => setOrden(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ddd', borderRadius: 4 }}>
              <option value="ingresos">Ingresos</option>
              <option value="unidades">Unidades</option>
              <option value="pedidos">Pedidos</option>
              <option value="familias">Familias</option>
            </select>
          </div>
          <button onClick={cargar} className={styles.btnPagar} style={{ background: '#0B2E55', padding: '0.5rem 1rem' }}>Aplicar</button>
        </div>

        <div className={styles.cards}>
          <div className={styles.cardStat}>
            <h3>Pedidos pagados</h3>
            <div className={styles.valor}>{fmtNum(totales.pedidos)}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Monto total</h3>
            <div className={styles.valor} style={{ fontSize: '1.2rem' }}>{fmtGs(totales.monto)}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Unidades</h3>
            <div className={styles.valor}>{fmtNum(totales.unidades)}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Ticket promedio</h3>
            <div className={styles.valor} style={{ fontSize: '1.2rem' }}>{fmtGs(ticketProm)}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Productos vendidos</h3>
            <div className={styles.valor}>{fmtNum(totales.productos_distintos)}</div>
          </div>
          <div className={styles.cardStat}>
            <h3>Familias</h3>
            <div className={styles.valor}>{fmtNum(totales.familias)}</div>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#900', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
            {error} — verificá que el backend esté actualizado con el endpoint <code>/api/pedidos/admin/ventas-producto</code>.
          </div>
        )}

        {cargando ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Producto</th>
                <th>Cat.</th>
                <th style={{ textAlign: 'right' }}>Unidades</th>
                <th style={{ textAlign: 'right' }}>Pedidos</th>
                <th style={{ textAlign: 'right' }}>Familias</th>
                <th style={{ textAlign: 'right' }}>Ingresos</th>
                <th style={{ textAlign: 'right' }}>% Part.</th>
                <th style={{ textAlign: 'right' }}>Precio prom.</th>
                <th style={{ textAlign: 'right' }}>Entregadas</th>
                <th style={{ textAlign: 'right' }}>Pendientes</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => {
                const unidades = Number(p.unidades || 0);
                const ingresos = Number(p.ingresos || 0);
                const entregadas = Number(p.entregadas || 0);
                const pendientes = Math.max(0, unidades - entregadas);
                const precioProm = unidades > 0 ? Math.round(ingresos / unidades) : 0;
                const participacion = totalIngresos > 0 ? (ingresos / totalIngresos) * 100 : 0;
                const barra = (ingresos / maxIngresos) * 100;
                const pctEntregado = unidades > 0 ? (entregadas / unidades) * 100 : 0;
                return (
                  <tr key={p.idproducto}>
                    <td style={{ color: '#999', fontSize: '0.85rem' }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.producto}</div>
                      <div style={{ height: 4, background: '#eee', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${barra}%`, height: '100%', background: '#0B2E55' }} />
                      </div>
                    </td>
                    <td><span style={{ fontSize: '0.75rem', color: '#666' }}>{p.categoria}</span></td>
                    <td style={{ textAlign: 'right' }}>{fmtNum(unidades)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtNum(p.pedidos)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtNum(p.familias)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtGs(ingresos)}</td>
                    <td style={{ textAlign: 'right' }}>{participacion.toFixed(1)}%</td>
                    <td style={{ textAlign: 'right' }}>{fmtGs(precioProm)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {fmtNum(entregadas)}
                      <div style={{ fontSize: '0.7rem', color: '#999' }}>{pctEntregado.toFixed(0)}%</div>
                    </td>
                    <td style={{ textAlign: 'right', color: pendientes > 0 ? '#f59e0b' : '#999' }}>{fmtNum(pendientes)}</td>
                    <td style={{ textAlign: 'right', color: p.stock <= 0 ? '#dc2626' : '#666' }}>{fmtNum(p.stock)}</td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
