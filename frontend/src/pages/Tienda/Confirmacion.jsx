import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getPedido, confirmarPagoMock, getRetirosPedido } from '../../api';
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

  async function handleConfirmar() {
    setPagando(true);
    try {
      await confirmarPagoMock(hash);
      const p = await getPedido(hash);
      setPedido(p);
      toast.success('¡Pedido confirmado! (pago simulado)');
    } catch {
      toast.error('No se pudo confirmar el pedido');
    } finally {
      setPagando(false);
    }
  }

  if (loading) return <div className={styles.loading}>Cargando...</div>;
  if (!pedido) return <div className={styles.loading}>Pedido no encontrado</div>;

  const estado = ESTADO_LABEL[pedido.estado] || ESTADO_LABEL.PENDIENTE;
  const codigo = hash.substring(0, 8).toUpperCase();

  // Mensaje pre-cargado para que el cliente avise su pedido a la organización.
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
    `Ver pedido: ${linkPedido}`;
  const waHref = `https://wa.me/595981969339?text=${encodeURIComponent(waMsg)}`;

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
            <h3>Finalizá tu pedido</h3>
            <p className={styles.oAlternativa}>🧪 Modo prueba · el pago es simulado, no se cobra nada.</p>
            <button className={styles.btnBancard} onClick={handleConfirmar} disabled={pagando}>
              {pagando ? 'Procesando...' : '✅ Confirmar pedido (pago simulado)'}
            </button>
          </div>
        )}

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
          📲 Enviar mi pedido por WhatsApp
        </a>
        <p style={{ fontSize: '.8rem', color: '#777', textAlign: 'center', marginTop: '.5rem' }}>
          Avisale a la organización que hiciste tu pedido.
        </p>
      </div>

      <button className={styles.btnVolver} onClick={() => navigate('/')}>
        ← Volver a la tienda
      </button>
    </div>
  );
}
