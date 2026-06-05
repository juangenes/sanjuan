import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import {
  getProductos,
  crearPedidoTotem,
  generarQrBancard,
  getEstadoBancard,
  revertirBancard,
  pagarMockTotem,
  prepararPedido,
  getConfig,
} from '../../api';
import { useCarrito } from '../../context/CarritoContext';
import '../Tienda/tienda-desktop.css';
import styles from './Totem.module.css';

// Tótem de autoservicio (estilo McDonald's). Pantalla táctil física en el predio:
// el comensal arma su pedido y paga con QR de Bancard. El tótem NO imprime. Funciona
// como la caja: al confirmarse el pago se dispara la comanda con TODO el pedido
// (retira todo) y sale su número de retiro (#XX). Como no hay impresora, la pantalla
// de éxito muestra un QR para que el cliente se lleve "el ticket" (con su #XX) en el
// celular y lo muestre en RETIRO. NO hay que hacer nada más desde el celular.
//
// Estados: 'idle' (atrae) → 'menu' (arma) → 'pago' (QR + polling) → 'exito'.

const TABS = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'COMIDA', label: '🍖 Comida' },
  { key: 'BEBIDA', label: '🥤 Bebidas' },
  { key: 'POSTRE', label: '🍰 Postres' },
  { key: 'JUEGO', label: '🎯 Juegos' },
];
const SECCIONES = TABS.slice(1);

const fmtGs = (n) => Number(n || 0).toLocaleString('es-PY');
// Precio del día: lista NORMAL (igual que la caja). Cae a preventa solo si el
// producto no tiene precio normal cargado.
const precioTotem = (p) => Number(p.precio_normal) || Number(p.precio_preventa) || 0;

// Segundos de inactividad en pantalla de pago/éxito antes de volver al inicio.
const TIMEOUT_PAGO = 300;   // 5 min esperando que pague (recomendación Bancard); al vencer se reversa el QR
const TIMEOUT_EXITO = 30;   // 30 s para escanear el QR de retiro antes de auto-reiniciar

function imgSrc(p) {
  if (!p.imagen) return '/img/placeholder.jpg';
  return p.imagen.startsWith('/') ? p.imagen : `/img/${p.imagen}`;
}

export default function TotemPanel() {
  const [fase, setFase] = useState('idle'); // idle | menu | pago | exito
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TODOS');
  const [search, setSearch] = useState('');

  // Datos del pago en curso
  const [pago, setPago] = useState(null);    // { hash, total }
  const [qrPago, setQrPago] = useState(null); // cadena EMVCo
  const [qrError, setQrError] = useState(false);
  const [creando, setCreando] = useState(false);
  const [exito, setExito] = useState(null);  // { codigo, hash }
  const [ttl, setTtl] = useState(0);         // cuenta regresiva visible
  const [bypassPago, setBypassPago] = useState(false); // PRUEBA: saltea Bancard (flag de config)

  const { items, agregar, quitar, limpiar } = useCarrito();
  const itemsRef = useRef([]); // foto del carrito para disparar la comanda al pagar
  const pagadoRef = useRef(false); // evita procesar el pago dos veces (ya_pagado + poll)

  useEffect(() => {
    getProductos()
      .then(setProductos)
      .catch(() => toast.error('No se pudieron cargar los productos'))
      .finally(() => setLoading(false));
    // Flag de prueba (tabla configuración): si está, el tótem saltea el pago real.
    getConfig().then(c => setBypassPago(!!c.bypass_pago_totem)).catch(() => {});
  }, []);

  const total = useMemo(
    () => items.reduce((a, i) => a + precioTotem(i) * i.cantidad, 0),
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

  // Vuelve al inicio limpiando todo el estado del pedido en curso.
  function reiniciar() {
    pagadoRef.current = false;
    limpiar();
    setPago(null);
    setQrPago(null);
    setQrError(false);
    setExito(null);
    setSearch('');
    setActiveTab('TODOS');
    setFase('idle');
  }

  function empezar() {
    limpiar();
    setFase('menu');
  }

  // Crea el pedido PENDIENTE y genera el QR de Bancard. Pasa a fase 'pago'.
  async function irAPagar() {
    if (!items.length || creando) return;
    setCreando(true);
    // Foto del carrito para disparar la comanda (retira todo) al confirmarse el pago.
    itemsRef.current = items.map(i => ({ idproducto: i.idproducto, cantidad: i.cantidad }));
    try {
      const pedido = await crearPedidoTotem({ items: itemsRef.current });

      // PRUEBA (revertible): saltea el QR de Bancard y marca pagado directo, como si
      // hubiera pagado OK. Va derecho a "seguí desde tu celular". Controlado por el flag
      // `bypass_pago_totem` de la config. Si el server lo tiene apagado (403), caemos al
      // QR normal: así el tótem nunca queda roto por un desfasaje de flags.
      if (bypassPago) {
        try {
          await pagarMockTotem(pedido.hash);
          onPagado(pedido.hash);
          return;
        } catch (err) {
          if (err.response?.status !== 403) throw err;
        }
      }

      setPago({ hash: pedido.hash, total: pedido.total });
      setQrPago(null);
      setQrError(false);
      setFase('pago');

      const r = await generarQrBancard(pedido.hash);
      if (r.ya_pagado) { onPagado(pedido.hash); return; }
      if (r.qr_data) setQrPago(r.qr_data);
      else setQrError(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo iniciar el pago');
      setFase('menu');
    } finally {
      setCreando(false);
    }
  }

  // Cancela el QR pendiente (reversa en Bancard) y vuelve al menú.
  async function cancelarPago() {
    if (pago?.hash) { revertirBancard(pago.hash).catch(() => {}); }
    setPago(null);
    setQrPago(null);
    setQrError(false);
    setFase('menu');
  }

  // Pago confirmado: disparamos la comanda con TODO el pedido (retira todo, como la
  // caja) y guardamos su #XX. Si es antes del DÍA D, /preparar responde 403 y queda
  // sin número (el cliente retira después). Mostramos el QR = "ticket" con el #XX.
  async function onPagado(hash) {
    if (pagadoRef.current) return; // ya lo procesamos (evita doble disparo)
    pagadoRef.current = true;
    const codigo = hash.substring(0, 8).toUpperCase();
    let numero = null;
    try {
      const r = await prepararPedido(hash, itemsRef.current);
      numero = r?.numero ?? null;
    } catch { /* 403 antes del DÍA D u otro: queda sin #XX, retira luego */ }
    limpiar();
    setExito({ codigo, hash, numero });
    setFase('exito');
  }

  // Polling del estado del pago mientras estamos en fase 'pago'.
  useEffect(() => {
    if (fase !== 'pago' || !pago?.hash) return;
    let cancelado = false;
    let timer;
    async function poll() {
      try {
        const r = await getEstadoBancard(pago.hash);
        if (cancelado) return;
        if (r.pagado) { onPagado(pago.hash); return; }
      } catch { /* reintentamos */ }
      if (!cancelado) timer = setTimeout(poll, 4000);
    }
    timer = setTimeout(poll, 4000);
    return () => { cancelado = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, pago?.hash]);

  // Cuenta regresiva / auto-reinicio en pago y éxito (libera el tótem si el
  // comensal se va). En 'pago' además reversa el QR pendiente.
  useEffect(() => {
    if (fase !== 'pago' && fase !== 'exito') { setTtl(0); return; }
    const limite = fase === 'pago' ? TIMEOUT_PAGO : TIMEOUT_EXITO;
    setTtl(limite);
    const id = setInterval(() => {
      setTtl(prev => {
        if (prev <= 1) {
          clearInterval(id);
          if (fase === 'pago') cancelarPago();
          reiniciar();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  // ─── Pantalla de inicio (atrae al cliente) ──────────────────────────────
  if (fase === 'idle') {
    return (
      <div className={styles.idle} onClick={empezar}>
        <div className={styles.idleInner}>
          <div className={styles.idleEmoji}>🔥</div>
          <h1 className={styles.idleTitulo}>SAN JUAN<br />DICE QUE SI</h1>
          <p className={styles.idleSub}>Autoservicio</p>
          <div className={styles.idleCta}>👆 Tocá para comenzar tu pedido</div>
        </div>
      </div>
    );
  }

  // ─── Pantalla de pago (QR de Bancard + espera) ──────────────────────────
  if (fase === 'pago') {
    return (
      <div className={styles.pagoPagina}>
        <div className={styles.pagoCard}>
          <h2 className={styles.pagoTitulo}>Escaneá para pagar</h2>
          <p className={styles.pagoMonto}>Gs. {fmtGs(pago?.total)}</p>
          {qrPago ? (
            <>
              <div className={styles.qrWrap}>
                <QRCodeSVG value={qrPago} size={300} />
              </div>
              <p className={styles.pagoAyuda}>
                Abrí <strong>Pago Móvil</strong> o la app de tu banco y escaneá el código.
              </p>
              <div className={styles.pagoEsperando}>⏳ Esperando confirmación del pago…</div>
            </>
          ) : qrError ? (
            <p className={styles.pagoError}>
              ⚠️ No pudimos generar el QR. Tocá «Cancelar» e intentá de nuevo.
            </p>
          ) : (
            <p className={styles.pagoAyuda}>Generando QR de pago…</p>
          )}
          <button className={styles.btnCancelar} onClick={cancelarPago}>✕ Cancelar</button>
          <p className={styles.ttl}>Vuelve al inicio en {ttl}s</p>
        </div>
      </div>
    );
  }

  // ─── Pantalla de éxito (QR = ticket de retiro) ──────────────────────────
  // La comanda ya se disparó (retira todo). El QR es el "ticket": el cliente lo
  // escanea para llevarse su #XX en el celular y mostrarlo en RETIRO. No hay que
  // hacer nada más desde el celular.
  if (fase === 'exito') {
    return (
      <div className={styles.exitoPagina} onClick={reiniciar}>
        <div className={styles.exitoCard} onClick={(e) => e.stopPropagation()}>
          <div className={styles.exitoCheck}>✓</div>
          <h2>¡Pago confirmado!</h2>

          <div className={styles.seguiCallout}>
            <div className={styles.seguiEmoji}>📲</div>
            <h3 className={styles.seguiTitulo}>ESCANEÁ ESTE QR<br />PARA RETIRAR TU PEDIDO</h3>
            <div className={styles.exitoQr}>
              <QRCodeSVG value={`https://sanjuandicequesi.com/pedido/${exito?.hash}`} size={300} />
            </div>
            {exito?.numero != null && (
              <div className={styles.retiroNum}>RETIRO <strong>#{exito.numero}</strong></div>
            )}
            <p className={styles.seguiAyuda}>
              Llevate tu <strong>ticket</strong> en el celular y mostralo en <strong>RETIRO</strong>.
            </p>
          </div>

          <p className={styles.exitoLabel}>Código de pedido</p>
          <div className={styles.exitoCodigo}>{exito?.codigo}</div>

          <button className={styles.btnNuevo} onClick={reiniciar}>Listo · nuevo pedido ({ttl}s)</button>
        </div>
      </div>
    );
  }

  // ─── Pantalla de menú (arma el pedido) ──────────────────────────────────
  return (
    <div className="td-app td-totem">
      <header className="td-header">
        <div className="td-header-brand">
          <div><h1>🔥 San Juan · Autoservicio</h1></div>
        </div>
        <nav className="td-header-nav">
          <a onClick={reiniciar}>✕ Cancelar</a>
        </nav>
      </header>

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
                            <p className="td-card-precio">Gs. {fmtGs(precioTotem(p))}</p>
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
              <div className="td-cart-empty-sub">Tocá los productos para agregarlos.</div>
            </div>
          ) : items.map(i => (
            <div key={i.idproducto} className="td-cart-line">
              <img className="td-cart-line-img" src={imgSrc(i)} alt="" onError={e => { e.target.src = '/img/placeholder.jpg'; }} />
              <div className="td-cart-line-info">
                <div className="td-cart-line-name">{i.titulo}</div>
                <div className="td-cart-line-price">
                  <strong>Gs. {fmtGs(precioTotem(i) * i.cantidad)}</strong>
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
            <button className="td-cta" disabled={creando} onClick={irAPagar}>
              {creando ? 'Generando QR…' : <>Pagar con QR <span className="td-cta-amount">Gs. {fmtGs(total)}</span></>}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
