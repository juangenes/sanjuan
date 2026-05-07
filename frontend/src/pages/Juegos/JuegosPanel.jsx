import { useState, useCallback } from 'react';
import { getSaldo, cargarCredito } from '../../api';
import QrScanner from '../../components/QrScanner';
import toast from 'react-hot-toast';
import styles from './Juegos.module.css';

const VALORES = [5000, 7000];

export default function JuegosPanel() {
  const [tarjeta, setTarjeta] = useState(null);
  const [cantidad, setCantidad] = useState('');
  const [valorUnitario, setValorUnitario] = useState(VALORES[0]);
  const [cargando, setCargando] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [modoManual, setModoManual] = useState(false);

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

  async function handleCargar() {
    const n = parseInt(cantidad, 10);
    if (!n || n < 1) { toast.error('Ingresá una cantidad válida'); return; }
    setCargando(true);
    try {
      const res = await cargarCredito(tarjeta.codigo, n, valorUnitario);
      toast.success(`✅ Cargados ${n} créditos de Gs. ${valorUnitario.toLocaleString()}. Saldo: ${res.saldo}`);
      setTarjeta(t => ({ ...t, saldo: res.saldo }));
      setCantidad('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cargar');
    } finally {
      setCargando(false);
    }
  }

  function nuevaBusqueda() {
    setTarjeta(null);
    setCodigoManual('');
    setCantidad('');
    setModoManual(false);
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>💳 Carga de Créditos</h1>
      </header>

      <div className={styles.contenido}>
        {!tarjeta && !modoManual && (
          <div className={styles.scannerBox}>
            <p className={styles.scannerLabel}>Escaneá el QR de la tarjeta</p>
            <QrScanner onDetected={buscarPorCodigo} />
            <button className={styles.btnSecundario} onClick={() => setModoManual(true)}>
              Ingresar código manualmente
            </button>
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
              <span className={styles.saldoLabel}>Saldo actual</span>
              <span className={styles.saldoValor}>
                {tarjeta.saldo} crédito{tarjeta.saldo !== 1 ? 's' : ''}
              </span>
            </div>

            <label className={styles.label}>Valor unitario</label>
            <select
              className={styles.select}
              value={valorUnitario}
              onChange={e => setValorUnitario(Number(e.target.value))}
            >
              {VALORES.map(v => (
                <option key={v} value={v}>Gs. {v.toLocaleString()}</option>
              ))}
            </select>

            <label className={styles.label}>Cantidad de créditos</label>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              placeholder="Ej: 10"
              className={styles.inputCantidad}
            />

            <button
              className={styles.btnCargar}
              onClick={handleCargar}
              disabled={cargando || !cantidad}
            >
              {cargando ? 'Procesando...' : '💳 Cargar créditos'}
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
