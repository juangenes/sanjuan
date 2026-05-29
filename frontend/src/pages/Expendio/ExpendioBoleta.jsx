import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBoleta } from '../../api';
import styles from './ExpendioBoleta.module.css';

export default function ExpendioBoleta() {
  const { hash, idot } = useParams();
  const navigate = useNavigate();
  const [boleta, setBoleta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getBoleta(hash, idot)
      .then(setBoleta)
      .catch(() => setError('Boleta no encontrada'))
      .finally(() => setLoading(false));
  }, [hash, idot]);

  if (loading) return <div className={styles.centro}>Cargando...</div>;
  if (error) return <div className={styles.centro}>{error}</div>;

  const { pedido, items } = boleta;

  return (
    <div className={styles.pagina}>
      <div className={styles.container}>
        <h2 className={styles.titulo}>Boleta de Expendio</h2>

        <div className={styles.boletaId}>
          <strong>ID Boleta:</strong>
          <code className={styles.codigo}>{idot}</code>
        </div>

        <div className={styles.pedidoInfo}>
          <div><span className={styles.label}>Código:</span> {hash.substring(0, 8).toUpperCase()}</div>
          <div><span className={styles.label}>Nombre:</span> {pedido.familia}</div>
          <div><span className={styles.label}>Cédula:</span> {pedido.cedula}</div>
        </div>

        <h3 className={styles.secTitulo}>Productos entregados en esta boleta</h3>
        <ul className={styles.itemsLista}>
          {items.map(item => (
            <li key={item.idproducto} className={styles.itemRow}>
              <span className={styles.checkbox} />
              <span className={styles.itemNombre}>{item.titulo}</span>
              <span className={styles.itemCantidad}>x {item.cantidad}</span>
            </li>
          ))}
        </ul>

        <div className={styles.acciones}>
          <button onClick={() => window.print()} className={styles.btnImprimir}>Imprimir</button>
          <button onClick={() => navigate('/expendio/panel')} className={styles.btnVolver}>← Panel</button>
        </div>
      </div>
    </div>
  );
}
