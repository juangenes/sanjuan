import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProductosAdmin, actualizarProducto } from '../../api';
import toast from 'react-hot-toast';
import styles from './Admin.module.css';

export default function AdminProductos() {
  const [productos, setProductos] = useState([]);
  const [editando, setEditando] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getProductosAdmin().then(setProductos).catch(() => navigate('/admin'));
  }, []);

  async function handleGuardar() {
    try {
      await actualizarProducto(editando.idproducto, editando);
      setProductos(prev => prev.map(p => p.idproducto === editando.idproducto ? editando : p));
      setEditando(null);
      toast.success('Producto actualizado');
    } catch {
      toast.error('Error al guardar');
    }
  }

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Productos</h1>
        <div className={styles.navLinks}>
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/pedidos">Pedidos</Link>
          <a onClick={() => { localStorage.clear(); navigate('/admin'); }} style={{ cursor: 'pointer' }}>Salir</a>
        </div>
      </nav>

      <div className={styles.contenido}>
        <table>
          <thead>
            <tr><th>Producto</th><th>Categoría</th><th>Precio preventa</th><th>Stock</th><th>Activo</th><th></th></tr>
          </thead>
          <tbody>
            {productos.map(p => (
              <tr key={p.idproducto}>
                {editando?.idproducto === p.idproducto ? (
                  <>
                    <td><input value={editando.titulo} onChange={e => setEditando(v => ({ ...v, titulo: e.target.value }))} style={{ width: '100%' }} /></td>
                    <td>
                      <select value={editando.categoria} onChange={e => setEditando(v => ({ ...v, categoria: e.target.value }))}>
                        <option>COMIDA</option><option>BEBIDA</option><option>JUEGO</option>
                      </select>
                    </td>
                    <td><input type="number" value={editando.precio_preventa} onChange={e => setEditando(v => ({ ...v, precio_preventa: e.target.value }))} style={{ width: '90px' }} /></td>
                    <td><input type="number" value={editando.stock} onChange={e => setEditando(v => ({ ...v, stock: e.target.value }))} style={{ width: '70px' }} /></td>
                    <td>
                      <select value={editando.activo} onChange={e => setEditando(v => ({ ...v, activo: Number(e.target.value) }))}>
                        <option value={1}>Sí</option><option value={0}>No</option>
                      </select>
                    </td>
                    <td>
                      <button onClick={handleGuardar} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '0.3rem 0.7rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.3rem' }}>✓</button>
                      <button onClick={() => setEditando(null)} style={{ border: '1px solid #ccc', padding: '0.3rem 0.7rem', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{p.titulo}</td>
                    <td>{p.categoria}</td>
                    <td>Gs. {Number(p.precio_preventa).toLocaleString()}</td>
                    <td style={{ color: p.stock < 5 ? '#E63946' : 'inherit', fontWeight: p.stock < 5 ? '700' : '400' }}>{p.stock}</td>
                    <td><span className={`${styles.badge} ${p.activo ? styles.pagado : styles.pendiente}`}>{p.activo ? 'Sí' : 'No'}</span></td>
                    <td><button onClick={() => setEditando({ ...p })} style={{ border: '1px solid #0B2E55', color: '#0B2E55', padding: '0.3rem 0.7rem', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}>Editar</button></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
