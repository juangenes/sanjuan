import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSaldo, consumirCredito, getPuestos } from '../../api';
import QrScanner from '../../components/QrScanner';
import toast from 'react-hot-toast';
import styles from './Tarjetas.module.css';

export default function TarjetasPanel() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [puesto, setPuesto] = useState(null);
  const [tarjeta, setTarjeta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [modoManual, setModoManual] = useState(false);

  // El puesto viene de la URL (/tarjetas/:codigo). Validamos contra los activos.
  useEffect(() => {
    getPuestos()
      .then(puestos => {
        const p = puestos.find(x => String(x.codigo) === String(codigo) || String(x.id) === String(codigo));
        if (!p) { toast.error('Puesto inválido'); navigate('/tarjetas'); return; }
        setPuesto(p);
      })
      .catch(() => { toast.error('No se pudo validar el puesto'); navigate('/tarjetas'); });
  }, [codigo]);

  const buscarPorCodigo = useCallback(async (codigo) => {
    setCargando(true);
    try {
      const data = await getSaldo(codigo);
      setTarjeta(data);
    } catch {
      toast.error('Tarjeta no encontrada');
      setTarjeta(null);
    } finally {
      setCargando(false);
    }
  }, []);

  async function handleManual(e) {
    e.preventDefault();
    if (!codigoManual.trim()) return;
    await buscarPorCodigo(codigoManual.trim().toUpperCase());
  }

  async function handleConsumir() {
    if (!tarjeta || tarjeta.saldo < 1) { toast.error('Sin saldo'); return; }
    if (!puesto) { toast.error('Puesto no válido'); return; }
    setCargando(true);
    try {
      const res = await consumirCredito(tarjeta.codigo, puesto.id);
      toast.success(`✅ Cobrado Gs. ${Number(res.valor_cobrado).toLocaleString()}. Saldo restante: ${res.saldo_restante}`);
      // Un cobro = una lectura: volvemos al escáner para que haya que leer otra vez (evita doble cobro).
      nuevaBusqueda();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al consumir');
    } finally {
      setCargando(false);
    }
  }

  function nuevaBusqueda() {
    setTarjeta(null);
    setCodigoManual('');
    setModoManual(false);
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>🎯 Consumo de Tarjetas</h1>
        {puesto && <p className={styles.puestoNombre}>{puesto.nombre}</p>}
      </header>

      <div className={styles.contenido}>
        {!tarjeta && !modoManual && (
          <div className={styles.scannerBox}>
            <p className={styles.scannerLabel}>Escaneá el QR de la tarjeta</p>
            <QrScanner onDetected={buscarPorCodigo} />
            <button className={styles.btnSecundario} onClick={() => setModoManual(true)}>
              Ingresar código manualmente
            </button>
            <Link to="/tarjetas" className={styles.btnSecundario} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              ← Cambiar de puesto
            </Link>
          </div>
        )}

        {!tarjeta && modoManual && (
          <form onSubmit={handleManual} className={styles.buscador}>
            <input
              value={codigoManual}
              onChange={e => setCodigoManual(e.target.value)}
              placeholder="Código de tarjeta (ej: TJC57F6D)"
              className={styles.inputCodigo}
              autoFocus
            />
            <button type="submit" disabled={cargando}>Buscar</button>
            <button type="button" className={styles.btnSecundario} onClick={() => setModoManual(false)}>
              ← Volver al escáner
            </button>
          </form>
        )}

        {tarjeta && (
          <div className={styles.tarjetaCard}>
            <div className={styles.codigoDisplay}>{tarjeta.codigo}</div>
            <div className={styles.saldoDisplay}>
              <span className={styles.saldoLabel}>Saldo disponible</span>
              <span className={styles.saldoValor} style={{ color: tarjeta.saldo > 0 ? '#22c55e' : '#E63946' }}>
                {tarjeta.saldo} crédito{tarjeta.saldo !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              className={styles.btnConsumir}
              onClick={handleConsumir}
              disabled={cargando || tarjeta.saldo < 1}
            >
              {cargando ? 'Procesando...' : '🎯 Canjear 1 Crédito'}
            </button>
            <button className={styles.btnSecundario} onClick={nuevaBusqueda} disabled={cargando}>
              Escanear otra tarjeta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
