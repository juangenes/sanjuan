import { useState, useCallback } from 'react';
import { getSaldo, consumirCredito } from '../../api';
import QrScanner from '../../components/QrScanner';
import toast from 'react-hot-toast';
import styles from './Tarjetas.module.css';

export default function TarjetasPanel() {
  const [tarjeta, setTarjeta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [modoManual, setModoManual] = useState(false);

  // En producción esto viene del token del operador
  const IDPUESTO = 1;

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
    setCargando(true);
    try {
      const res = await consumirCredito(tarjeta.codigo, IDPUESTO);
      toast.success(`✅ Cobrado Gs. ${Number(res.valor_cobrado).toLocaleString()}. Saldo restante: ${res.saldo_restante}`);
      setTarjeta(t => ({ ...t, saldo: res.saldo_restante }));
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
        <h1>🎯 Puesto de Juegos</h1>
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
