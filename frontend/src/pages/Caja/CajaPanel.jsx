import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import {
  getProductos, tomarPedidoCaja, tomarPedidoCajaQr, getPedidosExpendio,
  generarQrBancard, getEstadoBancard, revertirBancard,
  getLecturasCaja, atenderLecturaCaja, despacharPedidoCaja, getConfig,
} from '../../api';
import { useCarrito } from '../../context/CarritoContext';
import { suscribirScope } from '../../utils/rtsSocket';
import { imprimirTicketPedidoWeb } from '../../utils/webPrint';
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
  { key: 'INFONET', label: '📱 QR Bancard' },
];

const fmtGs = (n) => Number(n || 0).toLocaleString('es-PY');
// Vida del QR de pago en pantalla: a los ~5 min sin acreditarse lo reversamos
// en Bancard (recomendación de Bancard).
const QR_VIDA_MS = 5 * 60 * 1000;
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
  const [qrPago, setQrPago] = useState(null); // { hash, idpedido, nombre, total, lineas, data, error } — pago QR en curso
  const [imprimiendo, setImprimiendo] = useState(false);
  const [impreso, setImpreso] = useState(false);
  const [diaD, setDiaD] = useState(false); // DÍA D: walk-in dispara la comanda al cobrar
  const [modo, setModo] = useState('nuevo'); // 'nuevo' (walk-in) | 'preventa' (retiro)
  const { items, agregar, quitar, limpiar } = useCarrito();
  const navigate = useNavigate();
  const { num } = useParams();

  useEffect(() => {
    if (!localStorage.getItem('sanjuan_token')) { navigate(`/caja/${num}`); return; }
    getProductos()
      .then(setProductos)
      .catch(() => toast.error('No se pudieron cargar los productos'))
      .finally(() => setLoading(false));
    getConfig().then(c => setDiaD(!!c.dia_d)).catch(() => {});
  }, [navigate, num]);

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


  async function confirmarCobro({ nombre, metodo, recibido }) {
    const itemsPayload = items.map(i => ({ idproducto: i.idproducto, cantidad: i.cantidad }));
    // Foto del carrito para el ticket (con precios del día), antes de limpiarlo.
    const lineas = items.map(i => ({
      titulo: i.titulo,
      cantidad: i.cantidad,
      subtotal: precioCaja(i) * i.cantidad,
    }));

    // Pago con QR de Bancard: NO se cobra acá. Creamos el pedido PENDIENTE y
    // pasamos a la pantalla de QR; el pago lo confirma el callback de Bancard y
    // lo detectamos por polling. La comanda a RETIRO la dispara el callback.
    if (metodo === 'INFONET') {
      const pedido = await tomarPedidoCajaQr({ nombre, items: itemsPayload });
      limpiar();
      setCobroOpen(false);
      setQrPago({
        hash: pedido.hash,
        idpedido: pedido.idpedido,
        nombre: (nombre && nombre.trim()) || 'Mostrador',
        total: pedido.total,
        lineas,
        data: null,
        error: false,
      });
      return;
    }

    const payload = {
      nombre,
      metodo,
      recibido: metodo === 'EFECTIVO' ? Number(recibido) : null,
      items: itemsPayload,
    };

    const pedido = await tomarPedidoCaja(payload);
    const codigo = pedido.hash.substring(0, 8).toUpperCase();

    limpiar();
    setCobroOpen(false);
    setImpreso(false);

    // Walk-in del DÍA D = retira TODO en el acto: disparamos la comanda y sale el #XX.
    // (No preguntamos "por partes": el que compra en el día come ahora. El retiro
    // parcial queda solo para la preventa, desde el celular.) Antes del DÍA D no se
    // dispara: el éxito muestra el QR para retirar después.
    const numero = await despacharCajaSiDiaD(pedido.hash);
    setExito({
      codigo,
      numero,
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

  // Si es DÍA D, dispara la comanda con todo el pedido y devuelve su #XX; si no,
  // devuelve null (el retiro se hará después). No rompe el cobro si falla.
  async function despacharCajaSiDiaD(hash) {
    if (!diaD) return null;
    try {
      const r = await despacharPedidoCaja(hash);
      return r.numero;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cobrado, pero no se pudo enviar a RETIRO');
      return null;
    }
  }

  // Pago con QR en curso: genera el QR de Bancard y poletea el estado hasta que
  // el callback confirme el pago. Al confirmarse, dispara la comanda (retira todo)
  // igual que en efectivo y muestra el #XX.
  useEffect(() => {
    if (!qrPago?.hash) return;
    const { hash, idpedido, nombre, total, lineas } = qrPago;
    let cancelado = false;
    let timer;

    async function alPagar() {
      if (cancelado) return;
      const numero = await despacharCajaSiDiaD(hash);
      if (cancelado) return;
      setExito({
        codigo: hash.substring(0, 8).toUpperCase(),
        numero,
        hash, idpedido, vuelto: 0, metodo: 'INFONET',
        nombre, total, recibido: 0, lineas,
      });
      setQrPago(null);
      toast.success('¡Pago confirmado!');
    }

    generarQrBancard(hash)
      .then(r => {
        if (cancelado) return;
        if (r.ya_pagado) { alPagar(); return; }
        if (r.qr_data) setQrPago(q => (q && q.hash === hash ? { ...q, data: r.qr_data } : q));
        else setQrPago(q => (q && q.hash === hash ? { ...q, error: true } : q));
      })
      .catch(() => { if (!cancelado) setQrPago(q => (q && q.hash === hash ? { ...q, error: true } : q)); });

    async function poll() {
      try {
        const r = await getEstadoBancard(hash);
        if (cancelado) return;
        if (r.pagado) { alPagar(); return; }
      } catch { /* reintentamos en el próximo ciclo */ }
      if (!cancelado) timer = setTimeout(poll, 4000);
    }
    timer = setTimeout(poll, 4000);

    // Vencimiento del QR: a los ~5 min sin pagarse, reversamos en Bancard y
    // marcamos el QR como vencido (el cajero genera uno nuevo).
    const vencer = setTimeout(() => {
      if (cancelado) return;
      cancelado = true;
      clearTimeout(timer);
      revertirBancard(hash).catch(() => {});
      setQrPago(q => (q && q.hash === hash ? { ...q, vencido: true } : q));
    }, QR_VIDA_MS);

    return () => { cancelado = true; clearTimeout(timer); clearTimeout(vencer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrPago?.hash]);

  // Cancela el pago QR pendiente: reversa el QR en Bancard y vuelve al catálogo.
  function cancelarQr() {
    if (qrPago?.hash) revertirBancard(qrPago.hash).catch(() => {});
    setQrPago(null);
  }

  // Impresión explícita del ticket desde la pantalla de éxito (USB / driver Windows).
  async function imprimirTicket() {
    if (imprimiendo) return;
    setImprimiendo(true);
    try {
      await imprimirTicketPedidoWeb({
        codigo: exito.codigo,
        numero: exito.numero,
        nombre: exito.nombre,
        total: exito.total,
        metodo: exito.metodo,
        recibido: exito.recibido,
        vuelto: exito.vuelto,
        items: exito.lineas,
      });
      setImpreso(true);
      toast.success('Ticket enviado a la impresora');
    } catch (err) {
      toast.error(`No se imprimió: ${err.message}`);
    } finally {
      setImprimiendo(false);
    }
  }

  if (qrPago) {
    return (
      <div className={styles.pagina}>
        <div className={styles.exitoWrap}>
          <div className={styles.exitoCard}>
            <h2>📱 Pago con QR</h2>
            <p className={styles.exitoLabel}>Total a pagar</p>
            <div className={styles.exitoCodigo}>Gs. {fmtGs(qrPago.total)}</div>
            {qrPago.vencido ? (
              <p style={{ marginTop: '1rem', fontWeight: 700, color: '#856404' }}>
                ⏳ El QR venció por tiempo y se canceló. Tocá «Cerrar» y generá uno nuevo.
              </p>
            ) : qrPago.data ? (
              <>
                <div className={styles.exitoQr} style={{ marginTop: '1rem' }}>
                  <QRCodeSVG value={qrPago.data} size={240} />
                  <span>El comensal escanea con Pago Móvil o la app de su banco.</span>
                </div>
                <p style={{ marginTop: '1rem', fontWeight: 700, color: '#856404' }}>
                  ⏳ Esperando confirmación del pago…
                </p>
              </>
            ) : qrPago.error ? (
              <p style={{ marginTop: '1rem', fontWeight: 700, color: '#b00020' }}>
                ⚠️ No se pudo generar el QR. Cancelá e intentá de nuevo.
              </p>
            ) : (
              <p style={{ marginTop: '1rem' }}>Generando QR de pago…</p>
            )}
            <div className={styles.exitoBtns} style={{ marginTop: '1.5rem' }}>
              <button className={styles.btnNuevo} onClick={cancelarQr}>
                {qrPago.vencido ? 'Cerrar' : '✕ Cancelar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (exito) {
    const despachado = exito.numero != null;        // ya se disparó la comanda (#XX)
    return (
      <div className={styles.pagina}>
        <div className={styles.exitoWrap}>
          <div className={styles.exitoCard}>
            <div className={styles.exitoCheck}>✓</div>
            <h2>Pedido cobrado</h2>
            {exito.metodo === 'EFECTIVO' && (
              <div className={styles.exitoVuelto}>Vuelto: Gs. {fmtGs(exito.vuelto)}</div>
            )}

            {despachado ? (
              /* Comanda disparada: el #XX es lo que se canta en el mostrador. */
              <>
                <p className={styles.exitoLabel}>Número de retiro</p>
                <div className={styles.exitoCodigo}>#{exito.numero}</div>
                <p className={styles.exitoPedidoCod}>Pedido {exito.codigo}</p>
                <p className={styles.exitoNota}>La comanda salió a RETIRO. Se llama al comensal por su número.</p>
                <div className={styles.exitoBtns}>
                  <button
                    className={`${styles.btnImprimir} ${impreso ? styles.btnImpreso : ''}`}
                    onClick={imprimirTicket}
                    disabled={imprimiendo}
                  >
                    {imprimiendo ? 'Imprimiendo…' : impreso ? '✓ Ticket impreso · reimprimir' : '🖨 Imprimir ticket'}
                  </button>
                  <button className={styles.btnNuevo} onClick={() => setExito(null)}>＋ Nuevo pedido</button>
                </div>
              </>
            ) : (
              /* "Por partes" o antes del DÍA D: retira desde su celular cuando quiera. */
              <>
                <div className={styles.exitoQr}>
                  <QRCodeCanvas value={`https://sanjuandicequesi.com/pedido/${exito.hash}`} size={180} />
                  <span>📲 El comensal escanea este QR y pide el retiro desde su celular cuando quiera.</span>
                </div>
                <p className={styles.exitoLabel}>Código de pedido</p>
                <div className={styles.exitoCodigo}>{exito.codigo}</div>
                <div className={styles.exitoBtns}>
                  <button className={styles.btnNuevo} onClick={() => setExito(null)}>＋ Nuevo pedido</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="td-app">
      <header className="td-header">
        <div className="td-header-brand">
          <div><h1>💵 Caja {num} · San Juan 2026</h1></div>
        </div>
        <nav className="td-header-nav">
          <a className={modo === 'nuevo' ? 'activo' : ''} onClick={() => setModo('nuevo')}>🛒 Nuevo pedido</a>
          <a className={modo === 'preventa' ? 'activo' : ''} onClick={() => setModo('preventa')}>🎫 Preventa / Retiro</a>
          <a onClick={() => { limpiar(); localStorage.clear(); navigate(`/caja/${num}`); }}>Salir</a>
        </nav>
      </header>

      {modo === 'preventa' && <PreventaRetiro caja={num} />}

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
function PreventaRetiro({ caja }) {
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [sel, setSel] = useState(null); // hash seleccionado
  const [selLectura, setSelLectura] = useState(null); // id de la lectura abierta (para marcarla)
  const [cargando, setCargando] = useState(true);
  const [lecturas, setLecturas] = useState([]); // cola del lector del celular para esta caja
  const [online, setOnline] = useState(false);

  function cargar() {
    setCargando(true);
    getPedidosExpendio()
      .then(setLista)
      .catch(() => toast.error('No se pudieron cargar los pedidos'))
      .finally(() => setCargando(false));
  }
  useEffect(() => { cargar(); }, []);

  // Lecturas del lector del celular ruteadas a esta caja (cola en base + RTS en vivo).
  const cargarLecturas = useCallback(() => {
    if (!caja) return;
    getLecturasCaja(caja).then(setLecturas).catch(() => { /* el RTS/refetch reintenta */ });
  }, [caja]);

  useEffect(() => {
    cargarLecturas();
    const cleanup = suscribirScope(`sanjuan-caja-${caja}`, 'caja', () => cargarLecturas(), setOnline);
    return cleanup;
  }, [caja, cargarLecturas]);

  // Abre una lectura: si pudo resolverse a un pedido (hash), abre la entrega; si no,
  // avisa que no se encontró. Recordamos su id para marcarla al entregar.
  function abrirLectura(l) {
    if (!l.hash) { toast.error('Esa lectura no corresponde a un pedido'); return; }
    setSelLectura(l.id);
    setSel(l.hash);
  }

  async function descartarLectura(id) {
    try {
      await atenderLecturaCaja(id, 'DESCARTADA');
      cargarLecturas();
    } catch { toast.error('No se pudo descartar la lectura'); }
  }

  const horaCorta = (d) => new Date(d).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

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
        <button className={styles.btnNuevo} style={{ marginBottom: '1rem' }} onClick={() => { setSel(null); setSelLectura(null); cargar(); }}>
          ← Volver al listado
        </button>
        <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 14, padding: '1rem' }}>
          <EntregaCard
            key={sel}
            hash={sel}
            onEntregado={() => {
              toast.success('Comanda enviada a RETIRO');
              // Si veníamos de una lectura del lector, la sacamos de la cola.
              if (selLectura) { atenderLecturaCaja(selLectura, 'ATENDIDA').finally(cargarLecturas); }
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="td-main">
      {lecturas.length > 0 && (
        <div className={styles.lecturas}>
          <div className={styles.lecturasHead}>
            <span>📲 Lecturas del lector
              <span className={`${styles.lecturasDot} ${online ? styles.lecturasOn : styles.lecturasOff}`} title={online ? 'En vivo' : 'Sin conexión'} />
            </span>
            <button className={styles.lecturasRefresh} onClick={cargarLecturas}>↻</button>
          </div>
          <div className={styles.lecturasLista}>
            {lecturas.map(l => {
              const codigo = (l.hash || l.codigo || '').substring(0, 8).toUpperCase();
              return (
                <div key={l.id} className={styles.lecturaItem}>
                  <div className={styles.lecturaInfo}>
                    <span className={styles.lecturaCodigo}>{codigo}</span>
                    {l.hash
                      ? <span className={styles.lecturaFamilia}>{l.familia || 'Pedido'}</span>
                      : <span className={styles.lecturaNoEnc}>no encontrado</span>}
                    <span className={styles.lecturaHora}>{horaCorta(l.creado_en)}</span>
                  </div>
                  <div className={styles.lecturaBtns}>
                    {l.hash && (
                      <button className={styles.lecturaAbrir} onClick={() => abrirLectura(l)}>Abrir →</button>
                    )}
                    <button className={styles.lecturaDescartar} title="Descartar" onClick={() => descartarLectura(l.id)}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            {loading
              ? 'Procesando...'
              : metodo === 'INFONET'
                ? `📱 Generar QR · Gs. ${fmtGs(total)}`
                : `✅ Cobrar Gs. ${fmtGs(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
