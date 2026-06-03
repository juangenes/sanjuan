import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getUsuarios,
  crearUsuario,
  actualizarUsuario,
  resetPasswordUsuario,
  eliminarUsuario,
} from '../../api';
import styles from './Admin.module.css';

const ROLES = ['admin', 'caja', 'expendio', 'tarjetas', 'fotos'];

const FORM_VACIO = { usuario: '', password: '', rol: 'expendio', nombre: '', activo: true };

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [nuevo, setNuevo] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const navigate = useNavigate();

  function cargar() {
    getUsuarios().then(setUsuarios).catch(() => navigate('/admin'));
  }

  useEffect(() => { cargar(); }, []);

  async function handleCrear(e) {
    e.preventDefault();
    try {
      await crearUsuario(nuevo);
      toast.success('Usuario creado');
      setNuevo(FORM_VACIO);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear');
    }
  }

  async function handleGuardarEdit() {
    try {
      const { id, usuario, rol, nombre, activo } = editando;
      await actualizarUsuario(id, { usuario, rol, nombre, activo });
      toast.success('Usuario actualizado');
      setEditando(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    }
  }

  async function handleResetPassword(u) {
    const nueva = window.prompt(`Nueva contraseña para ${u.usuario}:`);
    if (!nueva) return;
    if (nueva.length < 6) return toast.error('Mínimo 6 caracteres');
    try {
      await resetPasswordUsuario(u.id, nueva);
      toast.success('Contraseña actualizada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  }

  async function handleEliminar(u) {
    if (!window.confirm(`¿Eliminar usuario "${u.usuario}"?`)) return;
    try {
      await eliminarUsuario(u.id);
      toast.success('Usuario eliminado');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  }

  function formatFecha(f) {
    if (!f) return '—';
    return new Date(f).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });
  }

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Usuarios</h1>
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
        <h2 style={{ marginBottom: '0.75rem' }}>Crear nuevo usuario</h2>
        <form
          onSubmit={handleCrear}
          style={{
            background: 'white', padding: '1rem', borderRadius: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem',
          }}
        >
          <input
            placeholder="usuario"
            value={nuevo.usuario}
            onChange={e => setNuevo(n => ({ ...n, usuario: e.target.value }))}
            required
            style={inputStyle}
          />
          <input
            placeholder="nombre (opcional)"
            value={nuevo.nombre}
            onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))}
            style={inputStyle}
          />
          <select
            value={nuevo.rol}
            onChange={e => setNuevo(n => ({ ...n, rol: e.target.value }))}
            style={inputStyle}
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input
            type="password"
            placeholder="contraseña (mín. 6)"
            value={nuevo.password}
            onChange={e => setNuevo(n => ({ ...n, password: e.target.value }))}
            required
            minLength={6}
            style={inputStyle}
          />
          <button type="submit" style={btnPrimario}>Crear</button>
        </form>

        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Activo</th>
              <th>Último login</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              editando?.id === u.id ? (
                <tr key={u.id} style={{ background: '#fffbe6' }}>
                  <td>
                    <input
                      value={editando.usuario}
                      onChange={e => setEditando(s => ({ ...s, usuario: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <input
                      value={editando.nombre || ''}
                      onChange={e => setEditando(s => ({ ...s, nombre: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <select
                      value={editando.rol}
                      onChange={e => setEditando(s => ({ ...s, rol: e.target.value }))}
                      style={inputStyle}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!editando.activo}
                      onChange={e => setEditando(s => ({ ...s, activo: e.target.checked }))}
                    />
                  </td>
                  <td>{formatFecha(u.ultimo_login)}</td>
                  <td>
                    <button onClick={handleGuardarEdit} style={btnPrimario}>Guardar</button>
                    <button onClick={() => setEditando(null)} style={btnSecundario}>Cancelar</button>
                  </td>
                </tr>
              ) : (
                <tr key={u.id}>
                  <td>{u.usuario}</td>
                  <td>{u.nombre || '—'}</td>
                  <td>
                    <span className={`${styles.badge} ${u.rol === 'admin' ? styles.pagado : styles.pendiente}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td>{u.activo ? 'Sí' : 'No'}</td>
                  <td>{formatFecha(u.ultimo_login)}</td>
                  <td>
                    <button onClick={() => setEditando({ ...u })} style={btnSecundario}>Editar</button>
                    <button onClick={() => handleResetPassword(u)} style={btnSecundario}>Reset pass</button>
                    <button onClick={() => handleEliminar(u)} style={btnPeligro}>Eliminar</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '0.55rem 0.7rem',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
};

const btnPrimario = {
  background: '#0B2E55',
  color: 'white',
  border: 'none',
  padding: '0.5rem 0.8rem',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: '0.85rem',
  marginRight: '0.3rem',
};

const btnSecundario = {
  background: 'transparent',
  color: '#0B2E55',
  border: '1px solid #0B2E55',
  padding: '0.4rem 0.7rem',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: '0.85rem',
  marginRight: '0.3rem',
};

const btnPeligro = {
  background: '#E63946',
  color: 'white',
  border: 'none',
  padding: '0.4rem 0.7rem',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: '0.85rem',
};
