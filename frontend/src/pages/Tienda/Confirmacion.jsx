import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getPedido, iniciarPago } from '../../api';
import toast from 'react-hot-toast';
import styles from './Confirmacion.module.css';

const ESTADO_LABEL = {
  PENDIENTE: { texto: 'Pendiente de pago', color: '#856404', bg: '#fff3cd' },
  PAGADO: { texto: '✅ Pagado', color: '#155724', bg: '#d4edda' },
};

export default function Confirmacion() {
  const { hash } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    getPedido(hash)
      .then(setPedido)
      .catch(() => toast.error('Pedido no encontrado'))
      .finally(() => setLoading(false));
  }, [hash]);

  async function handlePagar() {
    setPagando(true);
    try {
      const res = await iniciarPago(hash);
      navigate(res.redirect_url);
    } catch {
      toast.error('Error al iniciar pago');
    } finally {
      setPagando(false);
    }
  }

  if (loading) return <div className={styles.loading}>Cargando...</div>;
  if (!pedido) return <div className={styles.loading}>Pedido no encontrado</div>;

  const estado = ESTADO_LABEL[pedido.estado] || ESTADO_LABEL.PENDIENTE;
  const codigo = hash.substring(0, 8).toUpperCase();

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>San Juan Dice Que Sí</h1>
      </header>

      <div className={styles.card}>
        <div className={styles.estadoBadge} style={{ background: estado.bg, color: estado.color }}>
          {estado.texto}
        </div>

        <div className={styles.qrWrap}>
          <QRCodeSVG value={JSON.stringify({ hash, idpedido: pedido.idpedido })} size={180} />
          <p className={styles.codigo}>Código: <strong>{codigo}</strong></p>
        </div>

        <div className={styles.datosPedido}>
          <p><strong>Familia:</strong> {pedido.familia}</p>
          <p><strong>Contacto:</strong> {pedido.contacto}</p>
          <p><strong>Total:</strong> Gs. {Number(pedido.total).toLocaleString()}</p>
        </div>

        <div className={styles.items}>
          {pedido.items?.map(item => (
            <div key={item.id} className={styles.itemLinea}>
              <span>{item.cantidad}x {item.titulo}</span>
              <span>Gs. {Number(item.subtotal).toLocaleString()}</span>
            </div>
          ))}
        </div>

        {pedido.estado === 'PENDIENTE' && (
          <div className={styles.instruccionesPago}>
            <h3>¿Cómo pagar?</h3>
            <button className={styles.btnBancard} onClick={handlePagar} disabled={pagando}>
              {pagando ? 'Redirigiendo...' : '💳 Pagar con Bancard'}
            </button>
            <p className={styles.oAlternativa}>— o también —</p>
            <p>Transferí al alias <strong>0981818031</strong> y enviá el comprobante por WhatsApp.</p>
          </div>
        )}
      </div>

      <button className={styles.btnVolver} onClick={() => navigate('/')}>
        ← Volver a la tienda
      </button>
    </div>
  );
}
