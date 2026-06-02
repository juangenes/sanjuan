import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { login, registrarLecturaCaja } from '../../api';
import QrScanner from '../../components/QrScanner';
import loginStyles from '../Admin/Admin.module.css';
import styles from './Caja.module.css';

// Lector del celular: escanea el QR del cliente (la URL de su pedido) y manda esa
// lectura por RTS a la caja elegida (1..5). El operario de esa caja la ve caer en
// su lista de "Lecturas" (Preventa/Retiro) y la abre para entregar. El teléfono no
// imprime ni cobra: es solo un atajo para cuando alguien llega con su pedido.
const CAJAS = [1, 2, 3, 4, 5];

export default function CajaLector() {
  const [auted, setAuted] = useState(!!localStorage.getItem('sanjuan_token'));
  if (!auted) return <LoginGate onOk={() => setAuted(true)} />;
  return <Lector />;
}

// Gate de login propio (el celular puede no haber iniciado sesión).
function LoginGate({ onOk }) {
  const [form, setForm] = useState({ usuario: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, rol } = await login(form.usuario, form.password);
      localStorage.setItem('sanjuan_token', token);
      localStorage.setItem('sanjuan_rol', rol);
      onOk();
    } catch {
      toast.error('Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={loginStyles.loginPagina}>
      <div className={loginStyles.loginCard}>
        <h1>📷</h1>
        <h2>Lector · San Juan 2026</h2>
        <form onSubmit={handleSubmit}>
          <input placeholder="Usuario" value={form.usuario} onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))} required />
          <input type="password" placeholder="Contraseña" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <button type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
        <button className={styles.lectorVolver} onClick={() => navigate('/caja')}>← Volver</button>
      </div>
    </div>
  );
}

function Lector() {
  const [caja, setCaja] = useState(localStorage.getItem('sanjuan_caja_lector') || '1');
  const [scanKey, setScanKey] = useState(0); // remontamos el escáner para re-armarlo
  const [enviando, setEnviando] = useState(false);
  const [recientes, setRecientes] = useState([]);
  const navigate = useNavigate();

  function elegirCaja(n) {
    const v = String(n);
    setCaja(v);
    localStorage.setItem('sanjuan_caja_lector', v);
  }

  // onDetected estable por caja: si cambia su identidad en cada render, el QrScanner
  // reinicia la cámara. Lo fijamos con useCallback (solo cambia al cambiar de caja).
  const onDetected = useCallback((codigo) => {
    setEnviando(true);
    registrarLecturaCaja(caja, codigo)
      .then(l => {
        toast.success(`✓ Enviado a Caja ${caja}${l?.familia ? ` · ${l.familia}` : ''}`);
        setRecientes(prev => [{
          key: `${Date.now()}-${prev.length}`,
          codigo: (l?.hash || codigo).substring(0, 8).toUpperCase(),
          familia: l?.familia || null,
          encontrado: !!l?.encontrado,
          caja,
        }, ...prev].slice(0, 8));
      })
      .catch(() => toast.error('No se pudo enviar la lectura'))
      .finally(() => {
        setEnviando(false);
        // Re-armar el escáner para la próxima lectura (se detiene tras un match).
        setTimeout(() => setScanKey(k => k + 1), 900);
      });
  }, [caja]);

  return (
    <div className={styles.lectorPagina}>
      <header className={styles.lectorHeader}>
        <span>📷 Lector</span>
        <button className={styles.lectorSalir} onClick={() => navigate('/caja')}>Salir</button>
      </header>

      <div className={styles.lectorCajas}>
        <span className={styles.lectorCajasLabel}>Enviar a:</span>
        {CAJAS.map(n => (
          <button
            key={n}
            className={`${styles.lectorCaja} ${String(n) === caja ? styles.lectorCajaActiva : ''}`}
            onClick={() => elegirCaja(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <div className={styles.lectorScan}>
        <QrScanner key={scanKey} onDetected={onDetected} />
        <p className={styles.lectorHint}>
          {enviando ? 'Enviando…' : `Apuntá al QR del pedido. Va a la Caja ${caja}.`}
        </p>
      </div>

      {recientes.length > 0 && (
        <div className={styles.lectorRecientes}>
          <div className={styles.lectorRecientesTit}>Últimos enviados</div>
          {recientes.map(r => (
            <div key={r.key} className={styles.lectorReciente}>
              <span className={styles.lectorRecCod}>{r.codigo}</span>
              <span className={styles.lectorRecFam}>
                {r.encontrado ? (r.familia || 'Pedido') : <em style={{ color: '#b00020' }}>no encontrado</em>}
              </span>
              <span className={styles.lectorRecCaja}>Caja {r.caja}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
