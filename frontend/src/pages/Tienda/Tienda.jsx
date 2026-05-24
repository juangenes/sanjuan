import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getProductos, crearPedido } from '../../api';
import { useCarrito } from '../../context/CarritoContext';
import './tienda-desktop.css';

// Tienda deshabilitada temporalmente: la preventa todavía no está habilitada.
// Cambiar a true para reactivar el checkout cuando se abra la tienda.
const TIENDA_HABILITADA = true;

const TABS = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'COMIDA', label: '🍖 Comida' },
  { key: 'BEBIDA', label: '🥤 Bebidas' },
  { key: 'POSTRE', label: '🍰 Postres' },
  { key: 'JUEGO', label: '🎯 Juegos' },
];
const SECCIONES = TABS.slice(1);

function imgSrc(p) {
  if (!p.imagen) return '/img/placeholder.jpg';
  return p.imagen.startsWith('/') ? p.imagen : `/img/${p.imagen}`;
}

function fmtGs(n) {
  return Number(n || 0).toLocaleString('es-PY');
}

function DesktopHeader() {
  return (
    <header className="td-header">
      <div className="td-header-brand">
        <div>
          <h1>San Juan Dice Que Si !!!</h1>
          <div className="td-header-meta">06 jun 2026 · Colegio Torrefuerte · 11:00 am</div>
        </div>
      </div>
      <nav className="td-header-nav">
        <Link to="/">Inicio</Link>
        <a className="active">Tienda</a>
      </nav>
    </header>
  );
}

function PromoStrip() {
  return (
    <div className="td-promo">
      {TIENDA_HABILITADA ? (
        <>🔥 <span><strong>Preventa abierta</strong> hasta el 4 de junio · descuentos en toda la tienda</span></>
      ) : (
        <>⏳ <span><strong>La preventa abre muy pronto</strong> · mirá el catálogo y volvé para comprar con descuento</span></>
      )}
    </div>
  );
}

function Toolbar({ active, onClick, counts, search, onSearch }) {
  return (
    <div className="td-toolbar">
      <div className="td-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`td-tab ${active === t.key ? 'active' : ''}`}
            onClick={() => onClick(t.key)}
            type="button"
          >
            <span>{t.label}</span>
            {counts[t.key] > 0 && <span className="td-tab-count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>
      <div className="td-search">
        <span className="td-search-icon">🔍</span>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Buscar mbeju, choripán, agua..."
        />
      </div>
    </div>
  );
}

function ProductCard({ p, qty, onAdd, onSub }) {
  const sin = Number(p.stock) === 0;
  const pv = Number(p.precio_preventa);
  const pn = Number(p.precio_normal);
  const tieneDesc = pn > pv;              // preventa con descuento sobre precio normal
  const soloPreventa = pn === 0 && pv > 0; // solo tiene precio de preventa cargado
  const stockBajo = !sin && Number(p.stock) <= 5;
  return (
    <div className={`td-card ${sin ? 'agotado' : ''} ${qty > 0 ? 'has-qty' : ''}`}>
      <div className="td-card-media">
        <img
          className="td-card-img"
          src={imgSrc(p)}
          alt={p.titulo}
          onError={e => { e.target.src = '/img/placeholder.jpg'; }}
        />
        {tieneDesc && !sin && <span className="td-promo-tag">Preventa</span>}
        {soloPreventa && !sin && <span className="td-promo-tag td-promo-tag--solo">Solo preventa</span>}
        {sin && <span className="td-tag-agotado">Agotado</span>}
        {stockBajo && <span className="td-stock-low">Quedan {p.stock}</span>}
      </div>
      <div className="td-card-body">
        <h3 className="td-card-name">{p.titulo}</h3>
        {p.descripcion && <p className="td-card-desc">{p.descripcion}</p>}
        <div className="td-card-bot">
          <div className="td-price-row">
            <p className="td-card-precio">Gs. {fmtGs(p.precio_preventa)}</p>
            {tieneDesc && <span className="td-card-precio-old">Gs. {fmtGs(p.precio_normal)}</span>}
          </div>
          {sin ? null : qty === 0 ? (
            <button className="td-add-btn" onClick={onAdd}>＋ Agregar</button>
          ) : (
            <div className="td-stepper">
              <button onClick={onSub}>−</button>
              <span className="td-stepper-qty">{qty}</span>
              <button onClick={onAdd} disabled={qty >= p.stock}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CartSidebar({ items, total, onAdd, onSub, onClear, onCheckout }) {
  const totalUnits = items.reduce((a, i) => a + i.cantidad, 0);
  return (
    <aside className="td-cart">
      <div className="td-cart-head">
        <h2>
          🛒 Tu pedido
          {items.length > 0 && <span className="td-cart-count">{totalUnits}</span>}
        </h2>
        {items.length > 0 && (
          <button className="td-cart-clear" onClick={onClear}>Vaciar</button>
        )}
      </div>
      <div className="td-cart-body">
        {items.length === 0 ? (
          <div className="td-cart-empty">
            <div className="td-cart-empty-emoji">🛒</div>
            <div className="td-cart-empty-title">Tu carrito está vacío</div>
            <div className="td-cart-empty-sub">
              Agregá productos del catálogo y aparecerán acá.
            </div>
          </div>
        ) : items.map(i => (
          <div key={i.idproducto} className="td-cart-line">
            <img
              className="td-cart-line-img"
              src={imgSrc(i)}
              alt=""
              onError={e => { e.target.src = '/img/placeholder.jpg'; }}
            />
            <div className="td-cart-line-info">
              <div className="td-cart-line-name">{i.titulo}</div>
              <div className="td-cart-line-price">
                <strong>Gs. {fmtGs(i.precio_preventa * i.cantidad)}</strong>
                <span style={{ color: '#aaa' }}> · {i.cantidad} u.</span>
              </div>
            </div>
            <div className="td-cart-line-stepper">
              <button onClick={() => onSub(i.idproducto)}>−</button>
              <span className="td-cart-line-qty">{i.cantidad}</span>
              <button onClick={() => onAdd(i)} disabled={i.cantidad >= i.stock}>+</button>
            </div>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <div className="td-cart-foot">
          <div className="td-cart-suggest">
            💡 <span><strong>¿Querés agregar algo más?</strong> Seguí navegando el catálogo →</span>
          </div>
          <div className="td-cart-totals">
            <div className="td-cart-tot-row">
              <span>Subtotal ({totalUnits} u.)</span>
              <span>Gs. {fmtGs(total)}</span>
            </div>
            <div className="td-cart-tot-row td-cart-tot-final">
              <span>Total</span>
              <span>Gs. {fmtGs(total)}</span>
            </div>
          </div>
          <button
            className="td-cta"
            onClick={onCheckout}
            disabled={!TIENDA_HABILITADA}
            style={!TIENDA_HABILITADA ? { opacity: .55, cursor: 'not-allowed' } : undefined}
          >
            {TIENDA_HABILITADA ? 'Confirmar pedido' : 'Disponible próximamente'}
            {TIENDA_HABILITADA && <span className="td-cta-amount">Gs. {fmtGs(total)}</span>}
          </button>
          {!TIENDA_HABILITADA && (
            <div className="td-cart-suggest" style={{ marginTop: '.6rem' }}>
              ⏳ La preventa todavía no está habilitada. ¡Muy pronto!
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function CheckoutModal({ total, items, onClose, onSuccess }) {
  const [familia, setFamilia] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cedula, setCedula] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhone = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 10);
    return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4)}`;
  };
  const valid =
    familia.trim().length >= 2 &&
    telefono.replace(/\D/g, '').length >= 9 &&
    !loading;

  async function submit() {
    if (!valid || !TIENDA_HABILITADA) return;
    setLoading(true);
    try {
      const payload = {
        cedula,
        familia,
        contacto: telefono,
        items: items.map(i => ({ idproducto: i.idproducto, cantidad: i.cantidad })),
      };
      const resultado = await crearPedido(payload);
      onSuccess(resultado);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear pedido');
      setLoading(false);
    }
  }

  return (
    <div className="td-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="td-modal">
        <div className="td-modal-head">
          <div>
            <h2>Datos de contacto</h2>
            <p>Solo dos datos para emitir tu código de retiro.</p>
          </div>
          <button className="td-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="td-modal-body">
          <form className="td-form" onSubmit={e => { e.preventDefault(); submit(); }}>
            <div className="td-field">
              <label className="td-field-required">Nombre y apellido</label>
              <input
                value={familia}
                onChange={e => setFamilia(e.target.value)}
                placeholder="Ej: González Pérez"
                autoFocus
                autoCapitalize="words"
              />
              <div className="td-field-hint">Para identificar tu pedido al retirar.</div>
            </div>
            <div className="td-field">
              <label className="td-field-required">Teléfono</label>
              <input
                value={telefono}
                onChange={e => setTelefono(formatPhone(e.target.value))}
                placeholder="0981-123456"
                inputMode="tel"
              />
              <div className="td-field-hint">Te avisamos por WhatsApp cuando esté pago.</div>
            </div>
            <div className="td-field">
              <label>Cédula <span style={{ opacity: .5, fontWeight: 600 }}>(opcional)</span></label>
              <input
                value={cedula}
                onChange={e => setCedula(e.target.value)}
                placeholder="Ej: 3218554"
                inputMode="numeric"
              />
            </div>
            <button type="submit" style={{ display: 'none' }} />
          </form>
        </div>
        <div className="td-modal-foot">
          <button
            className="td-cta"
            disabled={!valid || !TIENDA_HABILITADA}
            style={{ opacity: (valid && TIENDA_HABILITADA) ? 1 : .55, cursor: (valid && TIENDA_HABILITADA) ? 'pointer' : 'not-allowed' }}
            onClick={submit}
          >
            {loading ? 'Procesando...' : (TIENDA_HABILITADA ? 'Confirmar pedido' : 'Disponible próximamente')}
            {!loading && TIENDA_HABILITADA && <span className="td-cta-amount">Gs. {fmtGs(total)}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Tienda() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { items, agregar, quitar, limpiar, total } = useCarrito();
  const navigate = useNavigate();

  useEffect(() => {
    getProductos()
      .then(setProductos)
      .catch(() => toast.error('No se pudieron cargar los productos'))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { TODOS: items.reduce((a, i) => a + i.cantidad, 0) };
    SECCIONES.forEach(s => {
      c[s.key] = items
        .filter(i => i.categoria === s.key)
        .reduce((a, i) => a + i.cantidad, 0);
    });
    return c;
  }, [items]);

  const qtyOf = (id) => items.find(i => i.idproducto === id)?.cantidad || 0;

  const filteredSections = SECCIONES
    .filter(s => activeTab === 'TODOS' || activeTab === s.key)
    .map(s => ({
      seccion: s,
      productos: productos
        .filter(p => p.categoria === s.key)
        .filter(p => !search.trim() || p.titulo.toLowerCase().includes(search.toLowerCase().trim())),
    }));

  const hasResults = filteredSections.some(g => g.productos.length > 0);

  return (
    <div className="td-app">
      <DesktopHeader />
      <PromoStrip />
      <main className="td-main">
        <Toolbar
          active={activeTab}
          onClick={setActiveTab}
          counts={counts}
          search={search}
          onSearch={setSearch}
        />
        {loading ? (
          <div className="td-loading">Cargando productos...</div>
        ) : hasResults ? (
          filteredSections.map(g => g.productos.length > 0 && (
            <section key={g.seccion.key} className="td-section">
              <h2 className="td-section-title">{g.seccion.label}</h2>
              <div className="td-grid">
                {g.productos.map(p => (
                  <ProductCard
                    key={p.idproducto}
                    p={p}
                    qty={qtyOf(p.idproducto)}
                    onAdd={() => agregar(p)}
                    onSub={() => quitar(p.idproducto)}
                  />
                ))}
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
      <CartSidebar
        items={items}
        total={total}
        onAdd={agregar}
        onSub={quitar}
        onClear={limpiar}
        onCheckout={() => setCheckoutOpen(true)}
      />
      {checkoutOpen && (
        <CheckoutModal
          total={total}
          items={items}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={(resultado) => {
            limpiar();
            setCheckoutOpen(false);
            navigate(`/pedido/${resultado.hash}`);
          }}
        />
      )}
    </div>
  );
}
