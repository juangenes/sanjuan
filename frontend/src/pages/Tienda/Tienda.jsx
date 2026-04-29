import { useEffect, useState } from 'react';
import { getProductos } from '../../api';
import { useCarrito } from '../../context/CarritoContext';
import CatalogoSeccion from '../../components/Productos/CatalogoSeccion';
import CarritoFlotante from '../../components/Carrito/CarritoFlotante';
import ModalCheckout from '../../components/Carrito/ModalCheckout';
import styles from './Tienda.module.css';

const CATEGORIAS = [
  { key: 'COMIDA', label: '🍖 Comidas Típicas' },
  { key: 'BEBIDA', label: '🥤 Bebidas' },
  { key: 'JUEGO', label: '🎯 Juegos' },
];

export default function Tienda() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const { cantidadTotal } = useCarrito();

  useEffect(() => {
    getProductos()
      .then(setProductos)
      .finally(() => setLoading(false));
  }, []);

  const porCategoria = (cat) => productos.filter(p => p.categoria === cat);

  return (
    <div className={styles.tienda}>
      <header className={styles.header}>
        <img src="/logo.png" alt="San Juan Dice Que Sí" className={styles.logo} />
        <h1>San Juan Dice Que Sí</h1>
        <p className={styles.subtitulo}>Torrefuerte 2025 · Sábado 07 de junio · 11:00 hs</p>
      </header>

      {loading ? (
        <div className={styles.loading}>Cargando productos...</div>
      ) : (
        <>
          {CATEGORIAS.map(({ key, label }) => (
            porCategoria(key).length > 0 && (
              <CatalogoSeccion key={key} titulo={label} productos={porCategoria(key)} />
            )
          ))}
        </>
      )}

      <CarritoFlotante onCheckout={() => setModalOpen(true)} />
      {modalOpen && <ModalCheckout onClose={() => setModalOpen(false)} />}
    </div>
  );
}
