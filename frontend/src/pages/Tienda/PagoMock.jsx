import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { confirmarPagoMock } from '../../api';
import toast from 'react-hot-toast';
import styles from './PagoMock.module.css';

export default function PagoMock() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const hash = params.get('hash');
  const [procesando, setProcesando] = useState(false);

  async function handlePagar() {
    setProcesando(true);
    try {
      await confirmarPagoMock(hash);
      toast.success('¡Pago aprobado! (simulado)');
      navigate(`/pedido/${hash}`);
    } catch {
      toast.error('Error al procesar pago');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.card}>
        <div className={styles.logo}>💳</div>
        <h2>Pago con Bancard</h2>
        <p className={styles.aviso}>⚠️ Esta es una simulación de pago. En producción, se redirigirá a Bancard.</p>
        <div className={styles.montoBox}>
          <span>Simulando pago aprobado</span>
        </div>
        <button className={styles.btnPagar} onClick={handlePagar} disabled={procesando}>
          {procesando ? 'Procesando...' : '✅ Aprobar Pago (Mock)'}
        </button>
        <button className={styles.btnCancelar} onClick={() => navigate(`/pedido/${hash}`)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
