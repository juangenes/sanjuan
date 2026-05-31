import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getBoleta } from '../../api';
import { imprimirBoleta, getTicketeraIP, setTicketeraIP } from '../../utils/eposPrint';
import styles from './ExpendioBoleta.module.css';

export default function ExpendioBoleta() {
  const { hash, idot } = useParams();
  const navigate = useNavigate();
  const [boleta, setBoleta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(false);

  async function imprimirTicketera() {
    let ip = getTicketeraIP();
    if (!ip) {
      ip = window.prompt('IP de la ticketera Epson en la red (ej. 192.168.1.50):', '');
      if (!ip) return;
      setTicketeraIP(ip);
    }
    setImprimiendo(true);
    try {
      await imprimirBoleta(boleta, {
        codigo: hash.substring(0, 8).toUpperCase(),
        idot,
      });
      toast.success('Ticket enviado a la impresora');
    } catch (err) {
      toast.error(err.message || 'No se pudo imprimir');
    } finally {
      setImprimiendo(false);
    }
  }

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
          <button onClick={imprimirTicketera} disabled={imprimiendo} className={styles.btnImprimir}>
            {imprimiendo ? 'Imprimiendo...' : '🖨 Imprimir comanda'}
          </button>
          <button onClick={() => window.print()} className={styles.btnVolver}>Imprimir (navegador)</button>
        </div>
        <div className={styles.acciones} style={{ marginTop: '0.75rem' }}>
          <button
            onClick={() => {
              const actual = getTicketeraIP();
              const ip = window.prompt('IP de la ticketera Epson:', actual);
              if (ip !== null) { setTicketeraIP(ip); toast.success(ip ? `Ticketera: ${ip}` : 'IP borrada'); }
            }}
            className={styles.btnVolver}
            style={{ background: '#6b7280', flex: 'unset', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          >
            ⚙ IP ticketera
          </button>
          <button onClick={() => navigate('/expendio/panel')} className={styles.btnVolver} style={{ flex: 1 }}>
            ← Panel
          </button>
        </div>
      </div>
    </div>
  );
}
