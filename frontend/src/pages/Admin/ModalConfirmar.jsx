import { useState } from 'react';
import styles from './ModalPedido.module.css';

// Modal de confirmación genérico. `onConfirm` puede ser async; mientras corre,
// los botones quedan deshabilitados. El cierre lo decide el padre.
export default function ModalConfirmar({
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  peligro = false,
  onConfirm,
  onClose,
}) {
  const [procesando, setProcesando] = useState(false);

  async function handleConfirmar() {
    setProcesando(true);
    try {
      await onConfirm();
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && !procesando && onClose()}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>{titulo}</h2>
          <button className={styles.cerrar} onClick={onClose} disabled={procesando} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.body}>
          <p className={styles.mensaje}>{mensaje}</p>
        </div>

        <footer className={styles.footer}>
          <button className={styles.btnCancelar} onClick={onClose} disabled={procesando}>
            Cancelar
          </button>
          <button
            className={peligro ? styles.btnPeligro : styles.btnGuardar}
            onClick={handleConfirmar}
            disabled={procesando}
          >
            {procesando ? 'Procesando...' : textoConfirmar}
          </button>
        </footer>
      </div>
    </div>
  );
}
