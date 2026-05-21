import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getPedido, iniciarPago, getRetirosPedido } from '../../api';
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
  const [retiros, setRetiros] = useState([]);
  const [tab, setTab] = useState('pedido');
  const [loading, setLoading] = useState(true);
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    Promise.all([
      getPedido(hash),
      getRetirosPedido(hash).catch(() => []),
    ])
      .then(([p, r]) => {
        setPedido(p);
        setRetiros(r);
      })
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
        <h1>San Juan Dice Que Si !!!</h1>
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

        <div className={styles.tabsRow}>
          <button
            className={`${styles.tabBtn} ${tab === 'pedido' ? styles.tabActivo : ''}`}
            onClick={() => setTab('pedido')}
          >
            PEDIDO
          </button>
          <button
            className={`${styles.tabBtn} ${tab === 'retiros' ? styles.tabActivo : ''}`}
            onClick={() => setTab('retiros')}
          >
            RETIROS{retiros.length > 0 && <span className={styles.retirosBadge}>{retiros.length}</span>}
          </button>
        </div>

        {tab === 'pedido' && (
          <div className={styles.items}>
            {pedido.items?.map(item => (
              <div key={item.id} className={styles.itemLinea}>
                <span>{item.cantidad}x {item.titulo}</span>
                <span>Gs. {Number(item.subtotal).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'retiros' && (
          <div className={styles.retirosWrap}>
            {retiros.length === 0 ? (
              <em className={styles.sinRetiros}>Aún no se realizaron retiros.</em>
            ) : (
              retiros.map((r, i) => (
                <div key={i} className={styles.retiroLinea}>
                  <span>
                    {r.titulo}
                    <span className={styles.retiroDetalle}> · {r.cantidad} u.</span>
                  </span>
                  <span className={styles.retiroFecha}>
                    {new Date(r.fecha).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

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
