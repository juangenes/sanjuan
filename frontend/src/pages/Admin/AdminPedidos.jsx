import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { getPedidosAdmin, marcarPagado, cambiarEstadoPedido, getPedido } from '../../api';
import { compartirComprobante } from '../../utils/comprobante';
import toast from 'react-hot-toast';
import styles from './Admin.module.css';
import ModalConfirmar from './ModalConfirmar';
import ModalEditarPedido from './ModalEditarPedido';

function waLink(p) {
  const codigo = p.hash.substring(0, 8).toUpperCase();
  const link = `https://sanjuandicequesi.com/pedido/${p.hash}`;
  let msg;
  if (p.estado === 'PAGADO') {
    msg = `*SAN JUAN DICE QUE SI 2026*\n\n✅ Tu pedido ${codigo} (${p.familia})ha sido VALIDADO.\nTotal: Gs. ${Number(p.total).toLocaleString()}\n\nVer pedido: ${link}`;
  } else {
    msg = `*SAN JUAN DICE QUE SI 2026*\n\n🔔 Tu pedido ${codigo} (${p.familia})está PENDIENTE DE PAGO.\nTotal: Gs. ${Number(p.total).toLocaleString()}\n\n💸 Transferí al alias 0981352935 y enviá comprobante por WhatsApp.\n\nVer pedido: ${link}`;
  }
  const num = p.contacto.replace(/\D/g, '').replace(/^0/, '');
  return `https://wa.me/595${num}?text=${encodeURIComponent(msg)}`;
}

// Normaliza un celular a su forma comparable: solo dígitos, sin prefijo país (595)
// ni el 0 inicial. Así "0981123456", "981123456" y "595981123456" coinciden.
function normNum(s) {
  return (s || '').replace(/\D/g, '').replace(/^595/, '').replace(/^0/, '');
}

// Arma un wa.me con el listado de pedidos de un cliente para enviárselo a su
// propio número. Reusa el mismo patrón de deep-link (envío manual, sin API).
function waLinkListado(numNorm, lista) {
  const lineas = lista.map((p, i) => {
    const codigo = p.hash.substring(0, 8).toUpperCase();
    const link = `https://sanjuandicequesi.com/pedido/${p.hash}`;
    const est = p.estado === 'PAGADO' ? '✅ PAGADO' : '🔔 PENDIENTE DE PAGO';
    return `${i + 1}) ${codigo} · ${p.familia}\n${est} — Gs. ${Number(p.total).toLocaleString()}\n${link}`;
  });
  const total = lista.reduce((s, p) => s + Number(p.total || 0), 0);
  const msg = `*SAN JUAN DICE QUE SI 2026*\n\nTus pedidos (${lista.length}):\n\n${lineas.join('\n\n')}\n\n*Total: Gs. ${total.toLocaleString()}*`;
  return `https://wa.me/595${numNorm}?text=${encodeURIComponent(msg)}`;
}

export default function AdminPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('TODOS');
  const [confirmar, setConfirmar] = useState(null); // config del modal de confirmación
  const [editando, setEditando] = useState(null);   // pedido en edición
  // Pedido (completo, con ítems) cuya imagen de comprobante se está por compartir.
  const [imgPedido, setImgPedido] = useState(null);
  const [imgBusy, setImgBusy] = useState(null); // idpedido en proceso
  const [numEnvio, setNumEnvio] = useState(''); // celular para enviar el listado
  const qrRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    // Carga inicial: si falla la auth, al login.
    getPedidosAdmin().then(d => { if (!cancel) setPedidos(d); }).catch(() => { if (!cancel) navigate('/admin'); });
    // Refresco periódico: los pagos confirmados por Bancard (vía callback) pasan a
    // PAGADO en la base; así aparecen acá sin tener que recargar la página.
    const id = setInterval(() => {
      getPedidosAdmin().then(d => { if (!cancel) setPedidos(d); }).catch(() => {});
    }, 15000);
    return () => { cancel = true; clearInterval(id); };
  }, []);

  // Aplica un cambio de estado al pedido `id` localmente (sin recargar la lista).
  function aplicarEstado(id, estado) {
    setPedidos(prev => prev.map(p => p.idpedido === id ? { ...p, estado } : p));
  }

  function pedirPagar(p) {
    setConfirmar({
      titulo: 'Marcar como pagado',
      mensaje: (
        <>¿Confirmás que el pedido <strong>#{p.idpedido}</strong> de <strong>{p.familia}</strong> (Gs. {Number(p.total).toLocaleString()}) está pagado?</>
      ),
      textoConfirmar: '✓ Marcar pagado',
      onConfirm: async () => {
        try {
          await marcarPagado(p.idpedido);
          aplicarEstado(p.idpedido, 'PAGADO');
          toast.success('Pedido marcado como pagado');
          setConfirmar(null);
        } catch (err) {
          toast.error(err.response?.data?.error || 'Error');
        }
      },
    });
  }

  function pedirAnular(p) {
    setConfirmar({
      titulo: 'Anular pedido',
      mensaje: (
        <>¿Anular el pedido <strong>#{p.idpedido}</strong> de <strong>{p.familia}</strong>? Dejará de contar en los totales. Podés restaurarlo después.</>
      ),
      textoConfirmar: 'Anular',
      peligro: true,
      onConfirm: async () => {
        try {
          await cambiarEstadoPedido(p.idpedido, 'ANULADO');
          aplicarEstado(p.idpedido, 'ANULADO');
          toast.success('Pedido anulado');
          setConfirmar(null);
        } catch (err) {
          toast.error(err.response?.data?.error || 'Error');
        }
      },
    });
  }

  function pedirRestaurar(p) {
    setConfirmar({
      titulo: 'Restaurar pedido',
      mensaje: (
        <>¿Restaurar el pedido <strong>#{p.idpedido}</strong> de <strong>{p.familia}</strong>? Volverá al estado PENDIENTE.</>
      ),
      textoConfirmar: 'Restaurar',
      onConfirm: async () => {
        try {
          await cambiarEstadoPedido(p.idpedido, 'PENDIENTE');
          aplicarEstado(p.idpedido, 'PENDIENTE');
          toast.success('Pedido restaurado');
          setConfirmar(null);
        } catch (err) {
          toast.error(err.response?.data?.error || 'Error');
        }
      },
    });
  }

  function handleEditado(actualizado) {
    setPedidos(prev => prev.map(p => p.idpedido === actualizado.idpedido ? { ...p, ...actualizado } : p));
    setEditando(null);
  }

  // La lista de admin no trae ítems: traemos el pedido completo y lo dejamos en
  // estado para que se renderice el QR oculto. El efecto de abajo arma la imagen.
  async function handleEnviarImagen(p) {
    setImgBusy(p.idpedido);
    try {
      const full = await getPedido(p.hash);
      setImgPedido(full);
    } catch {
      toast.error('No se pudo cargar el pedido');
      setImgBusy(null);
    }
  }

  // Cuando hay un pedido seleccionado, el QR oculto ya está en el DOM; esperamos
  // dos frames para que qrcode.react lo dibuje y compartimos la imagen.
  useEffect(() => {
    if (!imgPedido) return;
    let cancel = false;
    const raf = requestAnimationFrame(() => requestAnimationFrame(async () => {
      if (cancel) return;
      const qrCanvas = qrRef.current?.querySelector('canvas');
      if (!qrCanvas) { toast.error('No se pudo generar la imagen'); setImgBusy(null); setImgPedido(null); return; }
      try {
        const res = await compartirComprobante(imgPedido, qrCanvas);
        if (cancel) return;
        // Desktop (sin compartir nativo): se descargó el PNG. Abrimos el chat de
        // WhatsApp del cliente para que el admin adjunte la imagen descargada.
        if (res === 'downloaded') {
          window.open(waLink(imgPedido), '_blank');
          toast.success('Imagen descargada. Adjuntala en el chat de WhatsApp.');
        }
      } catch {
        if (!cancel) toast.error('No se pudo generar la imagen');
      } finally {
        if (!cancel) { setImgBusy(null); setImgPedido(null); }
      }
    }));
    return () => { cancel = true; cancelAnimationFrame(raf); };
  }, [imgPedido]);

  // Busca todos los pedidos (no anulados) de un celular y abre WhatsApp hacia ese
  // mismo número con el listado armado, listo para enviar.
  function enviarListado() {
    const objetivo = normNum(numEnvio);
    if (objetivo.length < 6) { toast.error('Ingresá un celular válido'); return; }
    const lista = pedidos.filter(p => p.estado !== 'ANULADO' && normNum(p.contacto) === objetivo);
    if (!lista.length) { toast.error('No hay pedidos para ese número'); return; }
    window.open(waLinkListado(objetivo, lista), '_blank');
  }

  const filtrados = filtro === 'TODOS' ? pedidos : pedidos.filter(p => p.estado === filtro);

  return (
    <div className={styles.panel}>
      <nav className={styles.navbar}>
        <h1>⛪ San Juan · Pedidos</h1>
        <div className={styles.navLinks}>
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/pedidos">Pedidos</Link>
          <Link to="/admin/productos">Productos</Link>
          <Link to="/admin/ventas-producto">Ventas x Producto</Link>
          <Link to="/admin/usuarios">Usuarios</Link>
          <Link to="/admin/puestos">Puestos</Link>
          <Link to="/admin/configuracion">Configuración</Link>
          <a onClick={() => { localStorage.clear(); navigate('/admin'); }} style={{ cursor: 'pointer' }}>Salir</a>
        </div>
      </nav>

      <div className={styles.contenido}>
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {['TODOS', 'PENDIENTE', 'PAGADO', 'ANULADO'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
                background: filtro === f ? '#0B2E55' : '#ddd', color: filtro === f ? 'white' : '#333' }}>
              {f}
            </button>
          ))}
          {/* Enviar a un cliente, por WhatsApp, el listado de sus propios pedidos. */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="tel"
              value={numEnvio}
              onChange={e => setNumEnvio(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') enviarListado(); }}
              placeholder="Celular del cliente"
              style={{ padding: '0.4rem 0.7rem', borderRadius: '20px', border: '1px solid #ccc', width: '11rem' }}
            />
            <button onClick={enviarListado}
              style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
                background: '#25D366', color: 'white', fontWeight: 600 }}
              title="Enviar a ese número el listado de sus pedidos por WhatsApp">
              📋 Enviar listado
            </button>
          </div>
        </div>

        <table>
          <thead>
            <tr><th>#</th><th>Código</th><th>Fecha</th><th>Nombre</th><th>Total</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {filtrados.map(p => (
              <tr key={p.idpedido}>
                <td>{p.idpedido}</td>
                <td><a href={`/pedido/${p.hash}`} target="_blank">{p.hash.substring(0,8).toUpperCase()}</a></td>
                <td style={{ fontSize: '0.85rem' }}>{new Date(p.fecha).toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}</td>
                <td>{p.familia}</td>
                <td>Gs. {Number(p.total).toLocaleString()}</td>
                <td><span className={`${styles.badge} ${styles[p.estado.toLowerCase()]}`}>{p.estado}</span></td>
                <td>
                  {p.estado === 'PENDIENTE' && (
                    <button className={styles.btnPagar} onClick={() => pedirPagar(p)}>✓ Pagar</button>
                  )}
                  <button className={styles.btnEditar} onClick={() => setEditando(p)} title="Editar datos del pedido">✎</button>
                  {p.estado === 'ANULADO' ? (
                    <button className={styles.btnRestaurar} onClick={() => pedirRestaurar(p)} title="Restaurar pedido">↺</button>
                  ) : (
                    <button className={styles.btnAnular} onClick={() => pedirAnular(p)} title="Anular pedido">✕</button>
                  )}
                  <a className={styles.btnWa} href={waLink(p)} target="_blank" title="Enviar mensaje por WhatsApp">WA</a>
                  <button
                    className={styles.btnWa}
                    onClick={() => handleEnviarImagen(p)}
                    disabled={imgBusy === p.idpedido}
                    title="Compartir imagen del comprobante por WhatsApp"
                  >
                    {imgBusy === p.idpedido ? '…' : '🖼'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* QR de retiro oculto: se renderiza solo cuando hay un pedido seleccionado,
          para poder dibujarlo dentro de la imagen del comprobante. */}
      <div ref={qrRef} style={{ position: 'absolute', left: '-9999px', top: 0 }} aria-hidden="true">
        {imgPedido && (
          <QRCodeCanvas value={`https://sanjuandicequesi.com/pedido/${imgPedido.hash}`} size={480} />
        )}
      </div>

      {confirmar && (
        <ModalConfirmar {...confirmar} onClose={() => setConfirmar(null)} />
      )}

      {editando && (
        <ModalEditarPedido
          pedido={editando}
          onClose={() => setEditando(null)}
          onGuardado={handleEditado}
        />
      )}
    </div>
  );
}
