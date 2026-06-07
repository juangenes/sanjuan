import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getConfigAdmin, guardarConfig } from '../../api';
import toast from 'react-hot-toast';
import styles from './Admin.module.css';

// Configuración operativa editable en vivo (sin tocar .env ni reiniciar PM2).
// Hoy: DÍA D (habilita el autoretiro del cliente en /pedido/:hash y en el tótem,
// y el endpoint POST /api/pedidos/:hash/preparar).
export default function AdminConfiguracion() {
  const [config, setConfig] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getConfigAdmin().then(setConfig).catch(() => navigate('/admin'));
  }, []);

  const diaD = config?.dia_d === 'true';
  const bypass = config?.bypass_pago_totem === 'true';

  async function toggleDiaD() {
    const nuevo = !diaD;
    setGuardando(true);
    try {
      await guardarConfig('dia_d', String(nuevo));
      setConfig(c => ({ ...c, dia_d: String(nuevo) }));
      toast.success(nuevo ? 'Retiro HABILITADO (Día D)' : 'Retiro deshabilitado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleBypass() {
    const nuevo = !bypass;
    setGuardando(true);
    try {
      await guardarConfig('bypass_pago_totem', String(nuevo));
      setConfig(c => ({ ...c, bypass_pago_totem: String(nuevo) }));
      toast.success(nuevo ? 'Bypass de pago del tótem ACTIVADO (prueba)' : 'Bypass de pago desactivado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Configuración</h1>
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
        {!config ? (
          <p>Cargando…</p>
        ) : (
          <div style={{
            background: 'white', padding: '1.5rem', borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: 620,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: '0 0 .35rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  🔥 Día D — Retiro habilitado
                </h2>
                <p style={{ margin: 0, color: '#555', fontSize: '.95rem', lineHeight: 1.45 }}>
                  Cuando está <strong>activado</strong>, el cliente puede mandar su pedido a
                  RETIRO desde su celular (botón "LISTO PARA RETIRAR" en <code>/pedido/:hash</code>)
                  y desde el tótem. <strong>Activalo el día del evento.</strong> Antes del evento
                  dejalo apagado para que nadie dispare pedidos a la cocina.
                </p>
              </div>

              {/* Switch tipo toggle */}
              <button
                type="button"
                onClick={toggleDiaD}
                disabled={guardando}
                aria-pressed={diaD}
                style={{
                  position: 'relative', flexShrink: 0, width: 86, height: 46, borderRadius: 999,
                  border: 'none', cursor: guardando ? 'wait' : 'pointer', padding: 0,
                  background: diaD ? 'linear-gradient(180deg,#22c55e,#16a34a)' : '#cbd5e1',
                  transition: 'background .2s', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.2)',
                }}
              >
                <span style={{
                  position: 'absolute', top: 4, left: diaD ? 44 : 4, width: 38, height: 38,
                  borderRadius: '50%', background: 'white', transition: 'left .2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,.3)',
                }} />
              </button>
            </div>

            <div style={{
              marginTop: '1.25rem', padding: '.85rem 1rem', borderRadius: 10, fontWeight: 700,
              background: diaD ? '#dcfce7' : '#fef3c7',
              color: diaD ? '#15803d' : '#92400e',
              border: `2px solid ${diaD ? '#22c55e' : '#f59e0b'}`,
            }}>
              {diaD
                ? '✅ El retiro está ACTIVO. Los clientes pueden disparar sus pedidos a la cocina.'
                : '⏸️ El retiro está APAGADO (modo pre-evento). El botón no aparece para los clientes.'}
            </div>

            {/* PRUEBA: bypass de pago del tótem */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #eee' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: '0 0 .35rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    🧪 Bypass de pago del tótem (prueba)
                  </h2>
                  <p style={{ margin: 0, color: '#555', fontSize: '.95rem', lineHeight: 1.45 }}>
                    Cuando está <strong>activado</strong>, el tótem <strong>saltea el QR de Bancard</strong> y
                    marca el pedido como pagado, para probar el flujo completo sin pagar de verdad. No afecta
                    el pago real de caja/tienda. <strong style={{ color: '#b00020' }}>Apagalo antes de operar con clientes reales.</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleBypass}
                  disabled={guardando}
                  aria-pressed={bypass}
                  style={{
                    position: 'relative', flexShrink: 0, width: 86, height: 46, borderRadius: 999,
                    border: 'none', cursor: guardando ? 'wait' : 'pointer', padding: 0,
                    background: bypass ? 'linear-gradient(180deg,#f59e0b,#d97706)' : '#cbd5e1',
                    transition: 'background .2s', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.2)',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 4, left: bypass ? 44 : 4, width: 38, height: 38,
                    borderRadius: '50%', background: 'white', transition: 'left .2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,.3)',
                  }} />
                </button>
              </div>
              {bypass && (
                <div style={{
                  marginTop: '1rem', padding: '.85rem 1rem', borderRadius: 10, fontWeight: 700,
                  background: '#fef3c7', color: '#92400e', border: '2px solid #f59e0b',
                }}>
                  🧪 PRUEBA ACTIVA: el tótem NO cobra. Acordate de apagarlo antes del evento real.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
