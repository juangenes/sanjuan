import { useCarrito } from '../../context/CarritoContext';
import styles from './CatalogoSeccion.module.css';

export default function CatalogoSeccion({ titulo, productos }) {
  const { items, agregar, quitar } = useCarrito();

  const getCantidad = (id) => items.find(i => i.idproducto === id)?.cantidad || 0;

  return (
    <section className={styles.seccion}>
      <h2 className={styles.titulo}>{titulo}</h2>
      <div className={styles.grid}>
        {productos.map(p => {
          const cantidad = getCantidad(p.idproducto);
          const sinStock = p.stock === 0;
          return (
            <div key={p.idproducto} className={`${styles.card} ${sinStock ? styles.agotado : ''}`}>
              <img
                src={p.imagen?.startsWith('/') ? p.imagen : `/img/${p.imagen}`}
                alt={p.titulo}
                className={styles.imagen}
                onError={e => { e.target.src = '/img/placeholder.jpg'; }}
              />
              <div className={styles.info}>
                <h3 className={styles.nombre}>{p.titulo}</h3>
                <p className={styles.descripcion}>{p.descripcion}</p>
                <p className={styles.precio}>
                  Gs. {Number(p.precio_preventa).toLocaleString()}
                  {p.precio_normal > p.precio_preventa && (
                    <span className={styles.precioNormal}> Gs. {Number(p.precio_normal).toLocaleString()}</span>
                  )}
                </p>
                {sinStock ? (
                  <span className={styles.tagAgotado}>Agotado</span>
                ) : (
                  <div className={styles.controles}>
                    <button onClick={() => quitar(p.idproducto)} disabled={cantidad === 0}>−</button>
                    <span>{cantidad}</span>
                    <button onClick={() => agregar(p)} disabled={cantidad >= p.stock}>+</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
