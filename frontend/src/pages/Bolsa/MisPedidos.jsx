import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getBolsa, prepararBolsa } from '../../api';

// AUTORETIRO AGRUPADO POR CELULAR ("mi bolsa").
//
// La persona entra por un link firmado que recibió por WhatsApp a SU número. Acá
// ve TODOS sus pedidos pagados con el saldo pendiente sumado por producto, y elige
// cuánto retirar (todo o por partes). Es la misma mecánica del autoretiro por
// pedido (Confirmacion.jsx), pero la identidad es el celular, no un hash suelto.
//
// SEGURIDAD: el link es la llave. Por eso arriba va una advertencia explícita de
// que compartirlo deja que cualquiera retire. El backend además re-chequea el saldo
// con lock al disparar, así que un doble toque (o dos terminales) nunca sobre-retira.

const naranja = 'linear-gradient(180deg,#fb923c 0%,#ea580c 100%)';

export default function MisPedidos() {
  const { token } = useParams();
  const [bolsa, setBolsa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [prepCant, setPrepCant] = useState({}); // idproducto -> cantidad
  const [modoRetiro, setModoRetiro] = useState(null); // null = elegir · 'partes' = steppers
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

  const items = (bolsa.bolsa || []).filter(i => i.pendiente > 0);
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
        <h2 style={{ margin: '0 0 .25rem', fontSize: '1.25rem', color: '#0B2E55' }}>
          🛍️ Mis pedidos
        </h2>
        {bolsa.familia && (
          <p style={{ margin: '0 0 .75rem', color: '#555' }}>
            Hola <strong>{bolsa.familia}</strong> 👋
          </p>
        )}

        {/* Advertencia: el link es la llave. Bien explícita y arriba de todo. */}
        <div style={st.warning}>
          ⚠️ <strong>Este link es tuyo y personal.</strong> Si lo compartís,
          <strong> cualquier persona podrá retirar tus pedidos.</strong> No lo reenvíes.
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
            <span style={{ fontSize: '.85rem', fontWeight: 700 }}>
              🔥 Escuchá cuando llamen tu número en RETIRO
            </span>
          </div>
        )}

        {!hayPendientes ? (
          <div style={st.vacio}>
            ✅ No tenés pedidos pendientes de retiro.
          </div>
        ) : !bolsa.dia_d ? (
          <div style={st.aviso}>
            ⏳ El retiro se habilita <strong>el día del evento</strong>. Acá vas a poder
            retirar todo lo que compraste.
            <div style={{ marginTop: '.75rem' }}>
              {items.map(it => (
                <div key={it.idproducto} style={st.lineaRes}>
                  <span>{it.titulo}</span>
                  <span style={{ fontWeight: 800 }}>{it.pendiente} u.</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={st.retiroBox}>
            <h3 style={{ margin: '0 0 .85rem', fontSize: '1.15rem', fontWeight: 900, color: '#9a3412', textAlign: 'center' }}>
              🔥 ¿Listo para retirar?
            </h3>

            {modoRetiro !== 'partes' ? (
              <>
                <p style={{ margin: '0 0 .85rem', fontSize: '.9rem', color: '#9a3412', textAlign: 'center', fontWeight: 700 }}>
                  Tenés dos opciones:
                </p>
                <button type="button" disabled={preparando} onClick={retirarTodo} style={st.btnTodo}>
                  🔥 Retirar todo ({totalPendiente} u.)
                </button>
                <button type="button" onClick={() => setModoRetiro('partes')} style={st.btnPartes}>
                  Retirar por partes
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 .85rem', fontSize: '.85rem', color: '#9a3412', textAlign: 'center' }}>
                  Elegí cuánto querés que te preparen <strong>ahora</strong>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {items.map(it => {
                    const sel = prepCant[it.idproducto] || 0;
                    return (
                      <div key={it.idproducto} style={st.stepperRow}>
                        <div style={{ minWidth: 0 }}>
                          <div style={st.stepperTitulo}>{it.titulo}</div>
                          <div style={{ fontSize: '.75rem', color: '#888' }}>{it.pendiente} por retirar</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
                          <button type="button" onClick={() => dec(it.idproducto)} disabled={sel <= 0}
                            style={{ ...st.stepBtn, background: '#f1f5f9', color: sel <= 0 ? '#cbd5e1' : '#0B2E55' }}>−</button>
                          <span style={{ minWidth: 24, textAlign: 'center', fontSize: '1.25rem', fontWeight: 900, color: '#0B2E55' }}>{sel}</span>
                          <button type="button" onClick={() => inc(it.idproducto, it.pendiente)} disabled={sel >= it.pendiente}
                            style={{ ...st.stepBtn, background: '#fed7aa', color: sel >= it.pendiente ? '#fbbf90' : '#9a3412' }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" disabled={totalSel === 0 || preparando} onClick={() => setConfirmar(true)}
                  style={{ ...st.btnTodo, marginTop: '.85rem', background: totalSel === 0 ? '#d6d3d1' : naranja, boxShadow: totalSel === 0 ? 'none' : st.btnTodo.boxShadow }}>
                  {preparando ? 'Enviando…' : `🔥 Preparar selección${totalSel > 0 ? ` (${totalSel} u.)` : ''}`}
                </button>
                <button type="button" onClick={() => setModoRetiro(null)} style={st.btnVolverLink}>
                  ← Volver a las opciones
                </button>
              </>
            )}
          </div>
        )}

        {/* Transparencia: qué pedidos están incluidos en esta bolsa. */}
        {bolsa.pedidos?.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '.8rem', color: '#888', margin: '0 0 .4rem', fontWeight: 700 }}>
              Incluye {bolsa.pedidos.length} pedido{bolsa.pedidos.length > 1 ? 's' : ''}:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
              {bolsa.pedidos.map(p => (
                <span key={p.idpedido} style={st.chipCodigo}>{p.codigo}</span>
              ))}
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
            <p style={{ margin: '0 0 1.25rem', color: '#555', fontSize: '.95rem' }}>
              Tu pedido empieza a prepararse <strong>ahora</strong> y no se puede cancelar.
            </p>
            <button type="button" disabled={preparando} onClick={preparar}
              style={{ ...st.btnTodo, fontSize: '1.15rem' }}>
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
  warning: { background: '#fff3cd', border: '2px solid #f0a500', borderRadius: 12, padding: '.75rem .9rem', fontSize: '.85rem', color: '#7a5b00', lineHeight: 1.4, margin: '0 0 1rem' },
  numerosBanner: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.25rem', background: naranja, color: '#fff', borderRadius: 14, padding: '1rem', margin: '0 0 1rem', textAlign: 'center' },
  vacio: { background: '#d4edda', color: '#155724', borderRadius: 12, padding: '1rem', textAlign: 'center', fontWeight: 700 },
  aviso: { background: '#fff7ed', border: '2px solid #fdba74', borderRadius: 12, padding: '1rem', color: '#9a3412', fontSize: '.9rem' },
  lineaRes: { display: 'flex', justifyContent: 'space-between', padding: '.35rem 0', borderTop: '1px dashed #fdba74' },
  retiroBox: { padding: '1rem', borderRadius: 16, background: 'linear-gradient(180deg,#fff7ed 0%,#ffedd5 100%)', border: '2px solid #fb923c', boxSizing: 'border-box' },
  btnTodo: { width: '100%', padding: '1.2rem 1rem', borderRadius: 14, border: 'none', boxSizing: 'border-box', cursor: 'pointer', background: naranja, color: '#fff', fontWeight: 900, fontSize: '1.3rem', letterSpacing: '.02em', textTransform: 'uppercase', boxShadow: '0 6px 0 #c2410c, 0 8px 18px rgba(0,0,0,.2)' },
  btnPartes: { width: '100%', marginTop: '.6rem', padding: '.85rem', borderRadius: 12, border: '2px solid #fb923c', background: '#fff', color: '#9a3412', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', boxSizing: 'border-box' },
  btnVolverLink: { width: '100%', marginTop: '.5rem', padding: '.6rem', borderRadius: 10, border: 'none', background: 'transparent', color: '#9a3412', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', boxSizing: 'border-box' },
  stepperRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', background: '#fff', borderRadius: 12, padding: '.5rem .65rem' },
  stepperTitulo: { fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  stepBtn: { width: 38, height: 38, borderRadius: 10, border: 'none', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer' },
  chipCodigo: { background: '#eef2f7', color: '#0B2E55', borderRadius: 8, padding: '.25rem .6rem', fontSize: '.8rem', fontWeight: 800, letterSpacing: '.03em' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  modalCard: { width: '100%', maxWidth: 360, background: '#fff', borderRadius: 18, padding: '1.5rem', textAlign: 'center', boxSizing: 'border-box' },
  btnCancelar: { width: '100%', marginTop: '.6rem', padding: '.85rem', borderRadius: 12, border: '1px solid #ddd', background: '#fff', color: '#666', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxSizing: 'border-box' },
};
