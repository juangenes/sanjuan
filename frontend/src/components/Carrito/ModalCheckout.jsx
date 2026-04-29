import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCarrito } from '../../context/CarritoContext';
import { crearPedido } from '../../api';
import styles from './ModalCheckout.module.css';

export default function ModalCheckout({ onClose }) {
  const { items, total, limpiar } = useCarrito();
  const navigate = useNavigate();
  const [form, setForm] = useState({ cedula: '', familia: '', contacto: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.familia || !form.contacto) {
      toast.error('Familia y teléfono son obligatorios');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        items: items.map(i => ({
          idproducto: i.idproducto,
          cantidad: i.cantidad,
        })),
      };
      const resultado = await crearPedido(payload);
      limpiar();
      navigate(`/pedido/${resultado.hash}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear pedido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <h2>Tu Pedido</h2>

        <div className={styles.resumen}>
          {items.map(item => (
            <div key={item.idproducto} className={styles.lineaResumen}>
              <span>{item.cantidad}x {item.titulo}</span>
              <span>Gs. {(item.precio_preventa * item.cantidad).toLocaleString()}</span>
            </div>
          ))}
          <div className={styles.totalResumen}>
            <strong>Total</strong>
            <strong>Gs. {total.toLocaleString()}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>Cédula (opcional)</label>
          <input name="cedula" value={form.cedula} onChange={handleChange} placeholder="Ej: 3218554" />

          <label>Apellido Familia *</label>
          <input name="familia" value={form.familia} onChange={handleChange} placeholder="Ej: González Perez" required />

          <label>Teléfono de contacto *</label>
          <input name="contacto" value={form.contacto} onChange={handleChange} placeholder="Ej: 0981-123456" required />

          <button type="submit" className={styles.btnEnviar} disabled={loading}>
            {loading ? 'Procesando...' : 'Confirmar Pedido →'}
          </button>
        </form>
      </div>
    </div>
  );
}
