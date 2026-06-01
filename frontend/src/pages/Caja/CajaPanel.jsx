import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import { getProductos, tomarPedidoCaja, getPedidosExpendio } from '../../api';
import { useCarrito } from '../../context/CarritoContext';
import { imprimirTicketPedido, getTicketeraIP, setTicketeraIP } from '../../utils/eposPrint';
import EntregaCard from '../Expendio/EntregaCard';
import '../Tienda/tienda-desktop.css';
import styles from './Caja.module.css';

const TABS = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'COMIDA', label: '🍖 Comida' },
  { key: 'BEBIDA', label: '🥤 Bebidas' },
  { key: 'POSTRE', label: '🍰 Postres' },
  { key: 'JUEGO', label: '🎯 Juegos' },
];
const SECCIONES = TABS.slice(1);

const METODOS = [
  { key: 'EFECTIVO', label: '💵 Efectivo' },
  { key: 'POS_DEBITO', label: '💳 POS Débito' },
  { key: 'POS_CREDITO', label: '💳 POS Crédito' },
];

const fmtGs = (n) => Number(n || 0).toLocaleString('es-PY');
// Precio del día: lista NORMAL (sin descuento de preventa). Cae al de preventa
// solo si el producto no tiene precio normal cargado.
const precioCaja = (p) => Number(p.precio_normal) || Number(p.precio_preventa) || 0;

function imgSrc(p) {
  if (!p.imagen) return '/img/placeholder.jpg';
  return p.imagen.startsWith('/') ? p.imagen : `/img/${p.imagen}`;
}

export default function CajaPanel() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [cobroOpen, setCobroOpen] = useState(false);
  const [exito, setExito] = useState(null); // { codigo, hash, idpedido, vuelto, metodo, nombre, total, recibido, lineas }
  const [imprimiendo, setImprimiendo] = useState(false);
  const [modo, setModo] = useState('nuevo'); // 'nuevo' (walk-in) | 'preventa' (retiro)
  const { items, agregar, quitar, limpiar } = useCarrito();
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem('sanjuan_token')) { navigate('/caja'); return; }
    getProductos()
      .then(setProductos)
      .catch(() => toast.error('No se pudieron cargar los productos'))
      .finally(() => setLoading(false));
  }, [navigate]);

  const total = useMemo(
    () => items.reduce((a, i) => a + precioCaja(i) * i.cantidad, 0),
    [items]
  );
  const totalUnits = items.reduce((a, i) => a + i.cantidad, 0);
  const qtyOf = (id) => items.find(i => i.idproducto === id)?.cantidad || 0;

  const counts = useMemo(() => {
    const c = { TODOS: totalUnits };
    SECCIONES.forEach(s => {
      c[s.key] = items.filter(i => i.categoria === s.key).reduce((a, i) => a + i.cantidad, 0);
    });
    return c;
  }, [items, totalUnits]);

  const filteredSections = SECCIONES
    .filter(s => activeTab === 'TODOS' || activeTab === s.key)
    .map(s => ({
      seccion: s,
      productos: productos
        .filter(p => p.categoria === s.key)
        .filter(p => !search.trim() || p.titulo.toLowerCase().includes(search.toLowerCase().trim())),
    }));
  const hasResults = filteredSections.some(g => g.productos.length > 0);

  function configurarIp() {
    const actual = getTicketeraIP();
    const ip = window.prompt('IP de la ticketera Epson:', actual);
    if (ip !== null) { setTicketeraIP(ip); toast.success(ip ? `Ticketera: ${ip}` : 'IP borrada'); }
  }

  async function confirmarCobro({ nombre, metodo, recibido }) {
    const payload = {
      nombre,
      metodo,
      recibido: metodo === 'EFECTIVO' ? Number(recibido) : null,
      items: items.map(i => ({ idproducto: i.idproducto, cantidad: i.cantidad })),
    };
    // Foto del carrito para el ticket (con precios del día), antes de limpiarlo.
    const lineas = items.map(i => ({
      titulo: i.titulo,
      cantidad: i.cantidad,
      subtotal: precioCaja(i) * i.cantidad,
    }));

    const pedido = await tomarPedidoCaja(payload);
    const codigo = pedido.hash.substring(0, 8).toUpperCase();

    // El cobro ya quedó cerrado y la comanda salió automática a RETIRO. La
    // impresión del ticket NO es automática: el cajero la dispara desde la
    // pantalla de éxito (o el comensal escanea el QR sin imprimir).
    limpiar();
    setCobroOpen(false);
    setExito({
      codigo,
      hash: pedido.hash,
      idpedido: pedido.idpedido,
      vuelto: pedido.vuelto,
      metodo,
      nombre: (nombre && nombre.trim()) || 'Mostrador',
      total: pedido.total,
      recibido: Number(recibido),
      lineas,
    });
  }

  // Impresión explícita del ticket desde la pantalla de éxito.
  async function imprimirTicket() {
    if (imprimiendo) return;
    setImprimiendo(true);
    try {
      if (!getTicketeraIP()) {
        const ip = window.prompt('IP de la ticketera Epson (ej. 192.168.1.50):', '');
        if (ip) setTicketeraIP(ip);
      }
      if (!getTicketeraIP()) { toast.error('No hay ticketera configurada'); return; }
      await imprimirTicketPedido({
        codigo: exito.codigo,
        hash: exito.hash,
        nombre: exito.nombre,
        total: exito.total,
        metodo: exito.metodo,
        recibido: exito.recibido,
        vuelto: exito.vuelto,
        items: exito.lineas,
      });
      toast.success('Ticket enviado a la impresora');
    } catch (err) {
      toast.error(`No se imprimió: ${err.message}`);
    } finally {
      setImprimiendo(false);
    }
  }

  if (exito) {
    return (
      <div className={styles.pagina}>
        <div className={styles.exitoWrap}>
          <div className={styles.exitoCard}>
            <div className={styles.exitoCheck}>✓</div>
            <h2>Pedido cobrado</h2>
            <p className={styles.exitoLabel}>Código de retiro</p>
            <div className={styles.exitoCodigo}>{exito.codigo}</div>
            {exito.metodo === 'EFECTIVO' && (
              <div className={styles.exitoVuelto}>Vuelto: Gs. {fmtGs(exito.vuelto)}</div>
            )}
            <div className={styles.exitoQr}>
              <QRCodeCanvas value={JSON.stringify({ hash: exito.hash, idpedido: exito.idpedido })} size={180} />
              <span>El comensal puede escanear este código en RETIRO, sin imprimir.</span>
            </div>
            <p className={styles.exitoNota}>La comanda salió en RETIRO. El comensal retira con este código.</p>
            <div className={styles.exitoBtns}>
              <button className={styles.btnImprimir} onClick={imprimirTicket} disabled={imprimiendo}>
                {imprimiendo ? 'Imprimiendo…' : '🖨 Imprimir ticket'}
              </button>
              <button className={styles.btnNuevo} onClick={() => setExito(null)}>＋ Nuevo pedido</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="td-app">
      <header className="td-header">
        <div className="td-header-brand">
          <div><h1>💵 Caja · San Juan 2026</h1></div>
        </div>
        <nav className="td-header-nav">
          <a className={modo === 'nuevo' ? 'activo' : ''} onClick={() => setModo('nuevo')}>🛒 Nuevo pedido</a>
          <a className={modo === 'preventa' ? 'activo' : ''} onClick={() => setModo('preventa')}>🎫 Preventa / Retiro</a>
          <a onClick={configurarIp}>⚙ IP ticketera</a>
          <a onClick={() => { limpiar(); localStorage.clear(); navigate('/caja'); }}>Salir</a>
        </nav>
      </header>

      {modo === 'preventa' && <PreventaRetiro />}

      {modo === 'nuevo' && (<>
      <main className="td-main">
        <div className="td-toolbar">
          <div className="td-tabs">
            {TABS.map(t => (
              <button key={t.key} className={`td-tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)} type="button">
                <span>{t.label}</span>
                {counts[t.key] > 0 && <span className="td-tab-count">{counts[t.key]}</span>}
              </button>
            ))}
          </div>
          <div className="td-search">
            <span className="td-search-icon">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." />
          </div>
        </div>

        {loading ? (
          <div className="td-loading">Cargando productos...</div>
        ) : hasResults ? (
          filteredSections.map(g => g.productos.length > 0 && (
            <section key={g.seccion.key} className="td-section">
              <h2 className="td-section-title">{g.seccion.label}</h2>
              <div className="td-grid">
                {g.productos.map(p => {
                  const qty = qtyOf(p.idproducto);
                  const sin = Number(p.stock) === 0;
                  return (
                    <div key={p.idproducto} className={`td-card ${sin ? 'agotado' : ''} ${qty > 0 ? 'has-qty' : ''}`}>
                      <div className="td-card-media">
                        <img className="td-card-img" src={imgSrc(p)} alt={p.titulo} onError={e => { e.target.src = '/img/placeholder.jpg'; }} />
                        {sin && <span className="td-tag-agotado">Agotado</span>}
                      </div>
                      <div className="td-card-body">
                        <h3 className="td-card-name">{p.titulo}</h3>
                        <div className="td-card-bot">
                          <div className="td-price-row">
                            <p className="td-card-precio">Gs. {fmtGs(precioCaja(p))}</p>
                          </div>
                          {sin ? null : qty === 0 ? (
                            <button className="td-add-btn" onClick={() => agregar(p)}>＋ Agregar</button>
                          ) : (
                            <div className="td-stepper">
                              <button onClick={() => quitar(p.idproducto)}>−</button>
                              <span className="td-stepper-qty">{qty}</span>
                              <button onClick={() => agregar(p)} disabled={qty >= p.stock}>+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="td-empty">
            <div className="td-empty-emoji">🔍</div>
            <div>{search ? `No encontramos "${search}".` : 'No hay productos disponibles.'}</div>
          </div>
        )}
      </main>

      <aside className="td-cart" id="tdCart">
        <div className="td-cart-head">
          <h2>🛒 Pedido {items.length > 0 && <span className="td-cart-count">{totalUnits}</span>}</h2>
          {items.length > 0 && <button className="td-cart-clear" onClick={limpiar}>Vaciar</button>}
        </div>
        <div className="td-cart-body">
          {items.length === 0 ? (
            <div className="td-cart-empty">
              <div className="td-cart-empty-emoji">🛒</div>
              <div className="td-cart-empty-title">Carrito vacío</div>
              <div className="td-cart-empty-sub">Agregá productos del catálogo.</div>
            </div>
          ) : items.map(i => (
            <div key={i.idproducto} className="td-cart-line">
              <img className="td-cart-line-img" src={imgSrc(i)} alt="" onError={e => { e.target.src = '/img/placeholder.jpg'; }} />
              <div className="td-cart-line-info">
                <div className="td-cart-line-name">{i.titulo}</div>
                <div className="td-cart-line-price">
                  <strong>Gs. {fmtGs(precioCaja(i) * i.cantidad)}</strong>
                  <span style={{ color: '#aaa' }}> · {i.cantidad} u.</span>
                </div>
              </div>
              <div className="td-cart-line-stepper">
                <button onClick={() => quitar(i.idproducto)}>−</button>
                <span className="td-cart-line-qty">{i.cantidad}</span>
                <button onClick={() => agregar(i)} disabled={i.cantidad >= i.stock}>+</button>
              </div>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="td-cart-foot">
            <div className="td-cart-totals">
              <div className="td-cart-tot-row td-cart-tot-final">
                <span>Total</span><span>Gs. {fmtGs(total)}</span>
              </div>
            </div>
            <button className="td-cta" onClick={() => setCobroOpen(true)}>
              Cobrar <span className="td-cta-amount">Gs. {fmtGs(total)}</span>
            </button>
          </div>
        )}
      </aside>
      </>)}

      {cobroOpen && (
        <CobroModal total={total} onClose={() => setCobroOpen(false)} onConfirm={confirmarCobro} />
      )}
    </div>
  );
}

// Modo "Preventa / Retiro": busca un pedido ya pagado (online/preventa) y dispara
// la comanda a RETIRO con los ítems que el comensal quiere retirar ahora. La
// entrega se registra y la comanda sale impresa en retiro (no acá en la caja).
function PreventaRetiro() {
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [sel, setSel] = useState(null); // hash seleccionado
  const [cargando, setCargando] = useState(true);

  function cargar() {
    setCargando(true);
    getPedidosExpendio()
      .then(setLista)
      .catch(() => toast.error('No se pudieron cargar los pedidos'))
      .finally(() => setCargando(false));
  }
  useEffect(() => { cargar(); }, []);

  const filtrada = lista.filter(p => {
    const completo = Number(p.total_entregado) >= Number(p.total_items);
    if (completo) return false; // ya retiró todo: no aparece
    if (!filtro.trim()) return true;
    const f = filtro.trim().toLowerCase();
    return (
      p.familia?.toLowerCase().includes(f) ||
      p.cedula?.toLowerCase?.().includes(f) ||
      p.hash?.substring(0, 8).toLowerCase().includes(f)
    );
  });

  if (sel) {
    return (
      <main className="td-main">
        <button className={styles.btnNuevo} style={{ marginBottom: '1rem' }} onClick={() => { setSel(null); cargar(); }}>
          ← Volver al listado
        </button>
        <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 14, padding: '1rem' }}>
          <EntregaCard
            key={sel}
            hash={sel}
            onEntregado={() => toast.success('Comanda enviada a RETIRO')}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="td-main">
      <div className="td-search" style={{ maxWidth: 520, margin: '0 auto 1rem' }}>
        <span className="td-search-icon">🔍</span>
        <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar por código, nombre o cédula..." autoFocus />
      </div>

      {cargando ? (
        <div className="td-loading">Cargando pedidos...</div>
      ) : filtrada.length === 0 ? (
        <div className="td-empty">
          <div className="td-empty-emoji">🎫</div>
          <div>{filtro ? `No encontramos "${filtro}".` : 'No hay pedidos de preventa pendientes de retiro.'}</div>
        </div>
      ) : (
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
          {filtrada.map(p => (
            <button
              key={p.idpedido}
              onClick={() => setSel(p.hash)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
                background: '#fff', border: '1px solid #e3e3e3', borderRadius: 12, padding: '0.8rem 1rem',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>
                  <span style={{ color: '#0a7d2c', marginRight: 8 }}>{p.hash.substring(0, 8).toUpperCase()}</span>
                  {p.familia}
                </div>
                <div style={{ fontSize: '.85rem', color: '#777' }}>
                  Cédula: {p.cedula || '—'} · {Number(p.total_entregado)}/{Number(p.total_items)} ítems retirados
                </div>
              </div>
              <span style={{ fontWeight: 800, color: '#1d4ed8', whiteSpace: 'nowrap' }}>Retirar →</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

function CobroModal({ total, onClose, onConfirm }) {
  const [nombre, setNombre] = useState('');
  const [metodo, setMetodo] = useState('EFECTIVO');
  const [recibido, setRecibido] = useState('');
  const [loading, setLoading] = useState(false);

  const recibidoNum = Number(recibido);
  const vuelto = metodo === 'EFECTIVO' && Number.isFinite(recibidoNum) ? recibidoNum - total : 0;
  const ok = metodo !== 'EFECTIVO' || (Number.isFinite(recibidoNum) && recibidoNum >= total);

  async function submit() {
    if (!ok || loading) return;
    setLoading(true);
    try {
      await onConfirm({ nombre, metodo, recibido });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cobrar');
      setLoading(false);
    }
  }

  return (
    <div className="td-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="td-modal">
        <div className="td-modal-head">
          <div><h2>Cobrar pedido</h2><p>Total: Gs. {fmtGs(total)}</p></div>
          <button className="td-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="td-modal-body">
          <div className={styles.campo}>
            <label>Nombre <span style={{ opacity: .5 }}>(opcional)</span></label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan / Mostrador" autoFocus />
          </div>

          <div className={styles.metodos}>
            {METODOS.map(m => (
              <button key={m.key} type="button"
                className={`${styles.metodoBtn} ${metodo === m.key ? styles.metodoActivo : ''}`}
                onClick={() => setMetodo(m.key)}>
                {m.label}
              </button>
            ))}
          </div>

          {metodo === 'EFECTIVO' && (
            <div className={styles.efectivo}>
              <label>Monto recibido</label>
              <input type="number" inputMode="numeric" value={recibido} onChange={e => setRecibido(e.target.value)} placeholder="0" className={styles.inputMonto} />
              <div className={`${styles.vuelto} ${vuelto < 0 ? styles.vueltoNeg : ''}`}>
                Vuelto: Gs. {fmtGs(Math.max(0, vuelto))}
                {vuelto < 0 && <span> · faltan Gs. {fmtGs(-vuelto)}</span>}
              </div>
            </div>
          )}
        </div>
        <div className="td-modal-foot">
          <button className="td-cta" disabled={!ok || loading} style={{ opacity: ok && !loading ? 1 : .55 }} onClick={submit}>
            {loading ? 'Procesando...' : `✅ Cobrar Gs. ${fmtGs(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
