import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPuestosAdmin, crearPuesto, actualizarPuesto, eliminarPuesto } from '../../api';
import toast from 'react-hot-toast';
import styles from './Admin.module.css';

const FORM_VACIO = { codigo: '', nombre: '', responsable: '', activo: true };

export default function AdminPuestos() {
  const [puestos, setPuestos] = useState([]);
  const [nuevo, setNuevo] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null);
  const navigate = useNavigate();

  function cargar() {
    getPuestosAdmin().then(setPuestos).catch(() => navigate('/admin'));
  }

  useEffect(() => { cargar(); }, []);

  async function handleCrear(e) {
    e.preventDefault();
    try {
      await crearPuesto(nuevo);
      toast.success('Puesto creado');
      setNuevo(FORM_VACIO);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear');
    }
  }

  async function handleGuardarEdit() {
    try {
      const { id, codigo, nombre, responsable, activo } = editando;
      await actualizarPuesto(id, { codigo, nombre, responsable, activo });
      toast.success('Puesto actualizado');
      setEditando(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    }
  }

  async function handleEliminar(p) {
    if (!window.confirm(`¿Eliminar puesto "${p.nombre}"?`)) return;
    try {
      await eliminarPuesto(p.id);
      toast.success('Puesto eliminado');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  }

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Puestos</h1>
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
        <h2 style={{ marginBottom: '0.75rem' }}>Crear nuevo puesto</h2>
        <form
          onSubmit={handleCrear}
          style={{
            background: 'white', padding: '1rem', borderRadius: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem',
          }}
        >
          <input
            placeholder="código URL (ej: 6a)"
            value={nuevo.codigo}
            onChange={e => setNuevo(n => ({ ...n, codigo: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="nombre (ej: 1° Grado)"
            value={nuevo.nombre}
            onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))}
            required
            style={inputStyle}
          />
          <input
            placeholder="responsable (opcional)"
            value={nuevo.responsable}
            onChange={e => setNuevo(n => ({ ...n, responsable: e.target.value }))}
            style={inputStyle}
          />
          <button type="submit" style={btnPrimario}>Crear</button>
        </form>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Código</th>
              <th>Nombre</th>
              <th>Responsable</th>
              <th>Activo</th>
              <th>Link de consumo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {puestos.map(p => (
              editando?.id === p.id ? (
                <tr key={p.id} style={{ background: '#fffbe6' }}>
                  <td>{p.id}</td>
                  <td>
                    <input
                      value={editando.codigo || ''}
                      onChange={e => setEditando(s => ({ ...s, codigo: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <input
                      value={editando.nombre}
                      onChange={e => setEditando(s => ({ ...s, nombre: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <input
                      value={editando.responsable || ''}
                      onChange={e => setEditando(s => ({ ...s, responsable: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!editando.activo}
                      onChange={e => setEditando(s => ({ ...s, activo: e.target.checked }))}
                    />
                  </td>
                  <td>—</td>
                  <td>
                    <button onClick={handleGuardarEdit} style={btnPrimario}>Guardar</button>
                    <button onClick={() => setEditando(null)} style={btnSecundario}>Cancelar</button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td><strong>{p.codigo || '—'}</strong></td>
                  <td>{p.nombre}</td>
                  <td>{p.responsable || '—'}</td>
                  <td>
                    <span className={`${styles.badge} ${p.activo ? styles.pagado : styles.pendiente}`}>
                      {p.activo ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td>
                    <a href={`/tarjetas/${p.codigo || p.id}`} target="_blank" rel="noreferrer" style={{ color: '#0B2E55' }}>
                      /tarjetas/{p.codigo || p.id}
                    </a>
                  </td>
                  <td>
                    <button onClick={() => setEditando({ ...p })} style={btnSecundario}>Editar</button>
                    <button onClick={() => handleEliminar(p)} style={btnPeligro}>Eliminar</button>
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
