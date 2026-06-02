import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProductosAdmin } from '../../api';
import styles from './Admin.module.css';
import ModalEditarProducto from './ModalEditarProducto';

function srcDeImagen(imagen) {
  if (!imagen) return '/img/placeholder.jpg';
  return imagen.startsWith('/') ? imagen : `/img/${imagen}`;
}

export default function AdminProductos() {
  const [productos, setProductos] = useState([]);
  const [editando, setEditando] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getProductosAdmin().then(setProductos).catch(() => navigate('/admin'));
  }, []);

  const productoVacio = {
    titulo: '',
    descripcion: '',
    imagen: '',
    categoria: 'COMIDA',
    activo: 1,
    precio_preventa: '',
    precio_normal: '',
    stock: 0,
    creditos_por_unidad: 0,
  };

  function handleGuardado(guardado) {
    setProductos(prev =>
      prev.some(p => p.idproducto === guardado.idproducto)
        ? prev.map(p => (p.idproducto === guardado.idproducto ? guardado : p))
        : [...prev, guardado]
    );
    setEditando(null);
  }

  function handleEliminado(id) {
    setProductos(prev => prev.filter(p => p.idproducto !== id));
    setEditando(null);
  }

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Productos</h1>
        <div className={styles.navLinks}>
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/pedidos">Pedidos</Link>
          <Link to="/admin/productos">Productos</Link>
          <Link to="/admin/ventas-producto">Ventas x Producto</Link>
          <Link to="/admin/usuarios">Usuarios</Link>
          <Link to="/admin/puestos">Puestos</Link>
          <Link to="/admin/configuracion">Configuración</Link>
          <a onClick={() => { localStorage.clear(); navigate('/admin'); }} style={{ cursor: 'pointer' }}>Salir</a>
        </div>
      </nav>

      <div className={styles.contenido}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button
            onClick={() => setEditando({ ...productoVacio })}
            style={{
              background: '#0B2E55',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Nuevo producto
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}></th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio preventa</th>
              <th>Stock</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productos.map(p => (
              <tr key={p.idproducto}>
                <td>
                  <img
                    src={srcDeImagen(p.imagen)}
                    alt={p.titulo}
                    onError={e => { e.target.src = '/img/placeholder.jpg'; }}
                    style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                  />
                </td>
                <td>{p.titulo}</td>
                <td>{p.categoria}</td>
                <td>Gs. {Number(p.precio_preventa).toLocaleString()}</td>
                <td style={{ color: p.stock < 5 ? '#E63946' : 'inherit', fontWeight: p.stock < 5 ? 700 : 400 }}>
                  {p.stock}
                </td>
                <td>
                  <span className={`${styles.badge} ${p.activo ? styles.pagado : styles.pendiente}`}>
                    {p.activo ? 'Sí' : 'No'}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => setEditando({ ...p })}
                    style={{
                      border: '1px solid #0B2E55',
                      color: '#0B2E55',
                      padding: '0.3rem 0.7rem',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: 'transparent',
                    }}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <ModalEditarProducto
          producto={editando}
          onClose={() => setEditando(null)}
          onGuardado={handleGuardado}
          onEliminado={handleEliminado}
        />
      )}
    </div>
  );
}
