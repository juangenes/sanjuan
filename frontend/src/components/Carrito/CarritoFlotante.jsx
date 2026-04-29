import { useCarrito } from '../../context/CarritoContext';
import styles from './CarritoFlotante.module.css';

export default function CarritoFlotante({ onCheckout }) {
  const { items, total, cantidadTotal } = useCarrito();

  if (cantidadTotal === 0) return null;

  return (
    <div className={styles.barra}>
      <div className={styles.info}>
        <span className={styles.cantidad}>{cantidadTotal} item{cantidadTotal > 1 ? 's' : ''}</span>
        <span className={styles.total}>Gs. {total.toLocaleString()}</span>
      </div>
      <button className={styles.btn} onClick={onCheckout}>
        Hacer Pedido →
      </button>
    </div>
  );
}
