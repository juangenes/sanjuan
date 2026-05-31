import { useState } from 'react';
import toast from 'react-hot-toast';
import { actualizarPedido } from '../../api';
import styles from './ModalPedido.module.css';

// Edita los datos de contacto del pedido (nombre, contacto, cédula) y permite
// cambiar el estado. No toca el total ni los ítems.
export default function ModalEditarPedido({ pedido, onClose, onGuardado }) {
  const [datos, setDatos] = useState({
    cedula: pedido.cedula || '',
    familia: pedido.familia || '',
    contacto: pedido.contacto || '',
    estado: pedido.estado,
  });
  const [guardando, setGuardando] = useState(false);

  const set = (campo, valor) => setDatos(d => ({ ...d, [campo]: valor }));

  async function handleGuardar() {
    if (!datos.familia.trim() || !datos.contacto.trim()) {
      toast.error('El nombre y el contacto son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      await actualizarPedido(pedido.idpedido, datos);
      onGuardado({ ...pedido, ...datos });
      toast.success('Pedido actualizado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && !guardando && onClose()}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>Editar pedido #{pedido.idpedido}</h2>
          <button className={styles.cerrar} onClick={onClose} disabled={guardando} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.body}>
          <label>Nombre / familia</label>
          <input value={datos.familia} onChange={e => set('familia', e.target.value)} />

          <label>Contacto (teléfono)</label>
          <input value={datos.contacto} onChange={e => set('contacto', e.target.value)} />

          <label>Cédula</label>
          <input value={datos.cedula} onChange={e => set('cedula', e.target.value)} />

          <label>Estado</label>
          <select value={datos.estado} onChange={e => set('estado', e.target.value)}>
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="PAGADO">PAGADO</option>
            <option value="ANULADO">ANULADO</option>
          </select>
        </div>

        <footer className={styles.footer}>
          <button className={styles.btnCancelar} onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button className={styles.btnGuardar} onClick={handleGuardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
