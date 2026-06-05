import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getBolsa, prepararBolsa } from '../../api';

// AUTORETIRO AGRUPADO POR CELULAR ("mi bolsa").
//
// La persona entra por un link firmado que recibió por WhatsApp a SU número. Acá
// ve TODOS sus pedidos pagados y elige qué retirar. El layout es deliberado:
//   1) "Para retirar": la lista de ítems pendientes SUMADOS por producto, con el
//      botón de acción debajo → el cliente ve QUÉ retira antes de tocar el botón.
//   2) "Tus pedidos": el detalle real pedido por pedido, con su estado, para que
//      reconozca sus compras y vea qué ya retiró.
//
// La identidad es el celular, no un hash suelto. SEGURIDAD: el link es la llave;
// por eso la advertencia de no compartirlo. El backend re-chequea el saldo con lock
// al disparar, así que un doble toque (o dos terminales) nunca sobre-retira.

const naranja = 'linear-gradient(180deg,#fb923c 0%,#ea580c 100%)';

// Estado de retiro de un pedido, derivado de sus ítems (pendiente vs entregado).
function estadoPedido(items) {
  const pend = items.reduce((a, i) => a + i.pendiente, 0);
  const ent = items.reduce((a, i) => a + i.entregado, 0);
  if (pend === 0) return { label: 'Retirado', icon: '✅', color: '#155724', bg: '#d4edda' };
  if (ent > 0) return { label: 'Retiro parcial', icon: '🔶', color: '#9a3412', bg: '#ffedd5' };
  return { label: 'Pendiente de retiro', icon: '⏳', color: '#7a5b00', bg: '#fff3cd' };
}

const fechaCorta = (d) => {
  try { return new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' }); }
  catch { return ''; }
};

export default function MisPedidos() {
  const { token } = useParams();
  const [bolsa, setBolsa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [prepCant, setPrepCant] = useState({}); // idproducto -> cantidad
  const [modoRetiro, setModoRetiro] = useState(null); // null = todo · 'partes' = steppers
  const [confirmar, setConfirmar] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [numeros, setNumeros] = useState(null); // #XX disparados en el último retiro

  function cargar() {
    return getBolsa(token)
      .then(b => { setBolsa(b); setError(false); })
      .catch(() => setError(true));
  }

  useEffect(() => {
    cargar().finally(() => setLoading(false));
  }, [token]);

  // Por defecto, seleccionar TODO lo pendiente. Se recalcula al cargar y tras retirar.
  useEffect(() => {
    const def = {};
    for (const it of bolsa?.bolsa || []) if (it.pendiente > 0) def[it.idproducto] = it.pendiente;
    setPrepCant(def);
  }, [bolsa]);

  if (loading) return <div style={st.loading}>Cargando tus pedidos…</div>;
  if (error || !bolsa) return <div style={st.loading}>Link inválido o vencido.</div>;

  const items = (bolsa.bolsa || []).filter(i => i.pendiente > 0); // sumado por producto
  const hayPendientes = items.length > 0;
  const totalPendiente = items.reduce((a, it) => a + it.pendiente, 0);
  const totalSel = items.reduce((a, it) => a + (prepCant[it.idproducto] || 0), 0);

  const inc = (id, max) => setPrepCant(c => ({ ...c, [id]: Math.min((c[id] || 0) + 1, max) }));
  const dec = (id) => setPrepCant(c => ({ ...c, [id]: Math.max((c[id] || 0) - 1, 0) }));

  function retirarTodo() {
    const full = {};
    for (const it of items) full[it.idproducto] = it.pendiente;
    setPrepCant(full);
    setConfirmar(true);
  }

  async function preparar() {
    const seleccion = items
      .map(it => ({ idproducto: it.idproducto, cantidad: prepCant[it.idproducto] || 0 }))
      .filter(i => i.cantidad > 0);
    if (!seleccion.length) { setConfirmar(false); return; }
    setPreparando(true);
    let ok = false;
    let nums = null;
    try {
      const r = await prepararBolsa(token, seleccion);
      nums = r?.numeros || [];
      ok = true;
      toast.success('¡Tu pedido se está preparando! 🔥');
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo retirar');
    }
    await cargar(); // refresca el saldo real (haya ido bien o haya perdido una carrera)
    if (ok) { setNumeros(nums); setModoRetiro(null); setConfirmar(false); }
    setPreparando(false);
  }

  return (
    <div style={st.pagina}>
      <header style={st.header}>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>San Juan Dice Que Si !!!</h1>
      </header>

      <div style={st.card}>
        <h2 style={{ margin: '0 0 .25rem', fontSize: '1.25rem', color: '#0B2E55' }}>🛍️ Mis pedidos</h2>
        {bolsa.familia && (
          <p style={{ margin: '0 0 .75rem', color: '#555' }}>Hola <strong>{bolsa.familia}</strong> 👋</p>
        )}

        {/* Advertencia: el link es la llave. */}
        <div style={st.warning}>
          ⚠️ <strong>Este link es tuyo y personal.</strong> Si lo compartís,
          <strong> cualquiera podrá retirar tus pedidos.</strong> No lo reenvíes.
        </div>

        {/* Banner del último retiro disparado: los #XX que se cantan. */}
        {numeros && numeros.length > 0 && (
          <div style={st.numerosBanner}>
            <span style={{ fontSize: '.85rem', fontWeight: 700, opacity: .95 }}>
              {numeros.length > 1 ? 'Tus números de retiro' : 'Tu número de retiro'}
            </span>
            <span style={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 1 }}>
              {numeros.map(n => `#${n}`).join('  ')}
            </span>
            <span style={{ fontSize: '.85rem', fontWeight: 700 }}>🔥 Escuchá cuando llamen tu número en RETIRO</span>
          </div>
        )}

        {/* ───── PARA RETIRAR: lo que tiene pendiente, sumado por producto ───── */}
        {!hayPendientes ? (
          <div style={st.vacio}>✅ Ya retiraste todos tus pedidos. ¡Buen provecho!</div>
        ) : (
          <div style={st.retiroBox}>
            <h3 style={st.retiroTitulo}>🔥 Para retirar</h3>

            {/* La lista SIEMPRE visible: el cliente ve QUÉ va a retirar. En modo
                "partes" cada línea suma steppers para elegir cantidades. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {items.map(it => {
                const sel = prepCant[it.idproducto] || 0;
                return (
                  <div key={it.idproducto} style={st.itemRow}>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '.5rem' }}>
                      {modoRetiro !== 'partes' && <span style={st.itemCant}>{it.pendiente}×</span>}
                      <span style={st.itemTitulo}>{it.titulo}</span>
                    </div>
                    {modoRetiro === 'partes' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
                        <button type="button" onClick={() => dec(it.idproducto)} disabled={sel <= 0}
                          style={{ ...st.stepBtn, background: '#f1f5f9', color: sel <= 0 ? '#cbd5e1' : '#0B2E55' }}>−</button>
                        <span style={{ minWidth: 22, textAlign: 'center', fontSize: '1.2rem', fontWeight: 900, color: '#0B2E55' }}>{sel}</span>
                        <button type="button" onClick={() => inc(it.idproducto, it.pendiente)} disabled={sel >= it.pendiente}
                          style={{ ...st.stepBtn, background: '#fed7aa', color: sel >= it.pendiente ? '#fbbf90' : '#9a3412' }}>+</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '.75rem', color: '#888', flexShrink: 0 }}>por retirar</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Acción: solo el DÍA D. Antes del evento, aviso. */}
            {!bolsa.dia_d ? (
              <div style={st.avisoDiaD}>⏳ El retiro se habilita <strong>el día del evento</strong>.</div>
            ) : modoRetiro !== 'partes' ? (
              <>
                <button type="button" disabled={preparando} onClick={retirarTodo} style={st.btnTodo}>
                  🔥 Retirar todo ({totalPendiente} u.)
                </button>
                <button type="button" onClick={() => setModoRetiro('partes')} style={st.btnPartes}>
                  Prefiero elegir qué retirar
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={totalSel === 0 || preparando} onClick={() => setConfirmar(true)}
                  style={{ ...st.btnTodo, background: totalSel === 0 ? '#d6d3d1' : naranja, boxShadow: totalSel === 0 ? 'none' : st.btnTodo.boxShadow }}>
                  {preparando ? 'Enviando…' : `🔥 Retirar selección${totalSel > 0 ? ` (${totalSel} u.)` : ''}`}
                </button>
                <button type="button" onClick={() => setModoRetiro(null)} style={st.btnVolverLink}>
                  ← Volver a “retirar todo”
                </button>
              </>
            )}
          </div>
        )}

        {/* ───── TUS PEDIDOS: el detalle real, pedido por pedido ───── */}
        {bolsa.pedidos?.length > 0 && (
          <div style={{ marginTop: '1.25rem' }}>
            <h3 style={st.seccionTitulo}>
              Tus pedidos <span style={st.contador}>{bolsa.pedidos.length}</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              {bolsa.pedidos.map(p => {
                const e = estadoPedido(p.items);
                return (
                  <div key={p.idpedido} style={st.pedidoCard}>
                    <div style={st.pedidoHead}>
                      <span style={st.pedidoCodigo}>{p.codigo}</span>
                      <span style={st.pedidoFecha}>{fechaCorta(p.fecha)}</span>
                      <span style={{ ...st.pedidoEstado, color: e.color, background: e.bg }}>
                        {e.icon} {e.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.15rem' }}>
                      {p.items.map(it => {
                        const retirado = it.pendiente === 0;
                        return (
                          <div key={it.idproducto} style={st.pedidoLinea}>
                            <span style={{ color: retirado ? '#9aa' : '#1a1a1a', textDecoration: retirado ? 'line-through' : 'none' }}>
                              {it.cantidad}× {it.titulo}
                            </span>
                            <span style={{ fontSize: '.78rem', fontWeight: 700, color: retirado ? '#16a34a' : it.entregado > 0 ? '#ea580c' : '#94a3b8', flexShrink: 0 }}>
                              {retirado ? '✓ retirado' : it.entregado > 0 ? `faltan ${it.pendiente}` : 'pendiente'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmación anti-disparo accidental: el retiro empieza a prepararse ya. */}
      {confirmar && (
        <div onClick={() => !preparando && setConfirmar(false)} style={st.modalOverlay}>
          <div onClick={e => e.stopPropagation()} style={st.modalCard}>
            <div style={{ fontSize: '2.5rem' }}>📍</div>
            <h3 style={{ margin: '.5rem 0 .25rem', fontSize: '1.3rem', fontWeight: 900, color: '#9a3412' }}>
              ¿Estás en el local?
            </h3>
            <p style={{ margin: '0 0 1rem', color: '#555', fontSize: '.95rem' }}>
              Tu pedido empieza a prepararse <strong>ahora</strong> y no se puede cancelar.
            </p>
            {/* Resumen de lo que se va a retirar, para confirmar con conocimiento. */}
            <div style={st.resumenConfirm}>
              {items.filter(it => (prepCant[it.idproducto] || 0) > 0).map(it => (
                <div key={it.idproducto} style={st.resumenLinea}>
                  <span>{it.titulo}</span><strong>{prepCant[it.idproducto]}×</strong>
                </div>
              ))}
            </div>
            <button type="button" disabled={preparando} onClick={preparar} style={{ ...st.btnTodo, fontSize: '1.15rem' }}>
              {preparando ? 'Enviando…' : `Sí, prepará (${totalSel} u.)`}
            </button>
            <button type="button" disabled={preparando} onClick={() => setConfirmar(false)} style={st.btnCancelar}>
              Todavía no
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const st = {
  pagina: { minHeight: '100vh', background: '#0B2E55', paddingBottom: '2rem' },
  header: { color: '#fff', textAlign: 'center', padding: '1.25rem 1rem' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#0B2E55', fontWeight: 700, padding: '1rem', textAlign: 'center' },
  card: { maxWidth: 440, margin: '0 auto', background: '#fff', borderRadius: 18, padding: '1.25rem', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,.2)' },
  warning: { background: '#fff3cd', border: '2px solid #f0a500', borderRadius: 12, padding: '.7rem .85rem', fontSize: '.82rem', color: '#7a5b00', lineHeight: 1.4, margin: '0 0 1rem' },
  numerosBanner: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.25rem', background: naranja, color: '#fff', borderRadius: 14, padding: '1rem', margin: '0 0 1rem', textAlign: 'center' },
  vacio: { background: '#d4edda', color: '#155724', borderRadius: 12, padding: '1rem', textAlign: 'center', fontWeight: 700 },
  retiroBox: { padding: '1rem', borderRadius: 16, background: 'linear-gradient(180deg,#fff7ed 0%,#ffedd5 100%)', border: '2px solid #fb923c', boxSizing: 'border-box' },
  retiroTitulo: { margin: '0 0 .75rem', fontSize: '1.15rem', fontWeight: 900, color: '#9a3412', textAlign: 'center' },
  itemRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', background: '#fff', borderRadius: 12, padding: '.6rem .75rem' },
  itemCant: { fontWeight: 900, color: '#ea580c', fontSize: '1.05rem', flexShrink: 0 },
  itemTitulo: { fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  stepBtn: { width: 36, height: 36, borderRadius: 10, border: 'none', fontSize: '1.35rem', fontWeight: 900, cursor: 'pointer' },
  avisoDiaD: { marginTop: '.9rem', background: '#fff', border: '1px dashed #fb923c', borderRadius: 12, padding: '.75rem', textAlign: 'center', color: '#9a3412', fontSize: '.9rem' },
  btnTodo: { width: '100%', marginTop: '.9rem', padding: '1.1rem 1rem', borderRadius: 14, border: 'none', boxSizing: 'border-box', cursor: 'pointer', background: naranja, color: '#fff', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '.02em', textTransform: 'uppercase', boxShadow: '0 6px 0 #c2410c, 0 8px 18px rgba(0,0,0,.2)' },
  btnPartes: { width: '100%', marginTop: '.6rem', padding: '.8rem', borderRadius: 12, border: '2px solid #fb923c', background: '#fff', color: '#9a3412', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', boxSizing: 'border-box' },
  btnVolverLink: { width: '100%', marginTop: '.5rem', padding: '.6rem', borderRadius: 10, border: 'none', background: 'transparent', color: '#9a3412', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', boxSizing: 'border-box' },
  seccionTitulo: { margin: '0 0 .6rem', fontSize: '.95rem', fontWeight: 800, color: '#0B2E55', letterSpacing: '.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '.4rem' },
  contador: { background: '#eef2f7', color: '#0B2E55', borderRadius: 999, padding: '.05rem .5rem', fontSize: '.8rem', fontWeight: 800 },
  pedidoCard: { border: '1px solid #e7e9ee', borderRadius: 12, padding: '.7rem .8rem', boxSizing: 'border-box' },
  pedidoHead: { display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.45rem', flexWrap: 'wrap' },
  pedidoCodigo: { fontWeight: 800, color: '#0B2E55', letterSpacing: '.03em', fontSize: '.85rem' },
  pedidoFecha: { fontSize: '.78rem', color: '#94a3b8' },
  pedidoEstado: { marginLeft: 'auto', fontSize: '.72rem', fontWeight: 800, borderRadius: 999, padding: '.12rem .55rem', whiteSpace: 'nowrap' },
  pedidoLinea: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.6rem', fontSize: '.9rem' },
  resumenConfirm: { textAlign: 'left', background: '#fff7ed', borderRadius: 10, padding: '.6rem .75rem', margin: '0 0 1rem', maxHeight: 160, overflowY: 'auto' },
  resumenLinea: { display: 'flex', justifyContent: 'space-between', gap: '.6rem', fontSize: '.9rem', color: '#9a3412', padding: '.12rem 0' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  modalCard: { width: '100%', maxWidth: 360, background: '#fff', borderRadius: 18, padding: '1.5rem', textAlign: 'center', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' },
  btnCancelar: { width: '100%', marginTop: '.6rem', padding: '.85rem', borderRadius: 12, border: '1px solid #ddd', background: '#fff', color: '#666', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxSizing: 'border-box' },
};
