import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getPedido, getRetirosPedido } from '../../api';
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

  if (loading) return <div className={styles.loading}>Cargando...</div>;
  if (!pedido) return <div className={styles.loading}>Pedido no encontrado</div>;

  const estado = ESTADO_LABEL[pedido.estado] || ESTADO_LABEL.PENDIENTE;
  const codigo = hash.substring(0, 8).toUpperCase();
  const metodo = pedido.metodo_pago || 'TRANSFERENCIA';
  const esInfonet = metodo === 'INFONET';

  // Texto de estado según método: por transferencia el pedido espera validación manual.
  const estadoTexto = pedido.estado === 'PENDIENTE'
    ? (esInfonet ? 'Pendiente (Infonet)' : 'Pendiente de validación')
    : estado.texto;

  // Mensaje pre-cargado para que el cliente avise su transferencia a la organización.
  const linkPedido = `${window.location.origin}/pedido/${hash}`;
  const lineasItems = (pedido.items || [])
    .map(i => `• ${i.cantidad}x ${i.titulo}`)
    .join('\n');
  const waMsg =
    `*SAN JUAN DICE QUE SI 2026*\n` +
    `🛒 Mi pedido ${codigo}\n` +
    `👤 ${pedido.familia}\n\n` +
    `${lineasItems}\n\n` +
    `Total: Gs. ${Number(pedido.total).toLocaleString()}\n\n` +
    `Te envío mi transferencia para que me confirmes el pedido.\n` +
    `Ver pedido: ${linkPedido}`;
  const waHref = `https://wa.me/595981969339?text=${encodeURIComponent(waMsg)}`;

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>San Juan Dice Que Si !!!</h1>
      </header>

      <div className={styles.card}>
        <div className={styles.estadoBadge} style={{ background: estado.bg, color: estado.color }}>
          {estadoTexto}
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

        {pedido.estado === 'PENDIENTE' && esInfonet && (
          <div className={styles.instruccionesPago}>
            <h3>Pago automático con Infonet</h3>
            <p className={styles.oAlternativa}>
              ⚙️ La confirmación por Infonet es automática y todavía está <strong>en implementación</strong>. No disponible en esta prueba.
            </p>
          </div>
        )}

        {pedido.estado === 'PENDIENTE' && !esInfonet && (
          <div className={styles.instruccionesPago}>
            <h3>Pagá por transferencia</h3>
            <p className={styles.oAlternativa}>
              Envianos el comprobante de transferencia por WhatsApp. La organización verificará que tu transferencia se recibió con éxito y ahí tu pedido será validado. Te llegará un mensaje de validación de tu pedido al número de celular que proporcionaste en tu pedido.
            </p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem',
                width: '100%', marginTop: '1rem', padding: '.9rem 1rem', borderRadius: '12px',
                background: '#25D366', color: '#fff', fontWeight: 800, fontSize: '1rem',
                textDecoration: 'none', boxSizing: 'border-box',
              }}
            >
              📲 Enviar mi transferencia por WhatsApp
            </a>
          </div>
        )}

        {pedido.estado === 'PAGADO' && (
          <p style={{ textAlign: 'center', color: '#155724', fontWeight: 700, marginTop: '1rem' }}>
            ✅ La organización validó tu pedido. Mostrá este código/QR al retirar.
          </p>
        )}
      </div>

      <button className={styles.btnVolver} onClick={() => navigate('/')}>
        ← Volver a la tienda
      </button>
    </div>
  );
}
