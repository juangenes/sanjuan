import { Link, useNavigate } from 'react-router-dom';
import styles from './Admin.module.css';

// Hub de reportes del evento. Cada reporte se cuelga acá como una tarjeta-link.
// Los `proximamente` quedan listados (a la vista) pero deshabilitados hasta que
// se implemente su pantalla.
const REPORTES = [
  {
    to: '/admin/reportes/consumo-puesto',
    icono: '🎟️',
    titulo: 'Consumo por puesto',
    descripcion: 'Créditos gastados y valor en guaraníes en cada stand, ranking por ingresos.',
  },
  { icono: '🍔', titulo: 'Ventas por producto', descripcion: 'Unidades, ingresos y entregas por producto.', to: '/admin/ventas-producto' },
  { icono: '📊', titulo: 'Resumen general', descripcion: 'Pedidos, montos y estado de cobro del evento.', to: '/admin/dashboard' },
  { icono: '💳', titulo: 'Créditos cargados vs consumidos', descripcion: 'Cuadre de acreditación contra consumo.', proximamente: true },
  { icono: '💵', titulo: 'Cuadre de caja', descripcion: 'Cobros por método de pago y por cajero.', proximamente: true },
];

export default function AdminReportes() {
  const navigate = useNavigate();

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Reportes</h1>
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
        <p style={{ color: '#666', marginTop: 0 }}>Acceso rápido a todos los reportes del San Juan.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {REPORTES.map((r) => {
            const contenido = (
              <>
                <div style={{ fontSize: '2rem', lineHeight: 1 }}>{r.icono}</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '0.5rem', color: '#0B2E55' }}>
                  {r.titulo}
                  {r.proximamente && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#999', marginLeft: 6 }}>· próximamente</span>}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.35rem' }}>{r.descripcion}</div>
              </>
            );
            const cardStyle = {
              display: 'block',
              background: 'white',
              padding: '1.25rem',
              borderRadius: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              textDecoration: 'none',
              border: '1px solid #eee',
            };
            if (r.proximamente) {
              return <div key={r.titulo} style={{ ...cardStyle, opacity: 0.55, cursor: 'default' }}>{contenido}</div>;
            }
            return (
              <Link key={r.titulo} to={r.to} style={cardStyle}>{contenido}</Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
