import { useState, useEffect, useCallback } from 'react';
import { getCreditosPendientes, dispensarCreditos } from '../../api';
import QrScanner from '../../components/QrScanner';
import { suscribirScope } from '../../utils/rtsSocket';
import toast from 'react-hot-toast';
import styles from './Juegos.module.css';

// Panel del ACREDITADOR de saldos. Trabaja junto al cajero de juegos: el cliente
// paga en caja y dicta su código (o las últimas letras); el acreditador lo busca
// en su listado de pendientes y carga los créditos a una o varias tarjetas.
// Ya no hay carga libre: todo crédito sale de un pedido PAGADO.
export default function JuegosPanel({ onSalir }) {
  const [pedidos, setPedidos] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState(null); // pedido seleccionado para cargar
  const [enVivo, setEnVivo] = useState(false); // conexión al push de la caja

  const refrescar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      const data = await getCreditosPendientes();
      setPedidos(data);
      return data;
    } catch (err) {
      if (err.response?.status === 401) { onSalir?.(); return []; }
      if (!silencioso) toast.error('No se pudo cargar la lista');
      return null;
    } finally {
      setCargandoLista(false);
    }
  }, [onSalir]);

  // Carga inicial de la lista al montar. De ahí en más, los pedidos nuevos llegan
  // por el push en vivo (RTS) y, como respaldo, por el refresco automático.
  useEffect(() => {
    let vivo = true;
    getCreditosPendientes()
      .then(data => { if (vivo) setPedidos(data); })
      .catch(err => { if (err.response?.status === 401) onSalir?.(); })
      .finally(() => { if (vivo) setCargandoLista(false); });
    return () => { vivo = false; };
  }, [onSalir]);

  // Push en vivo: la caja, al cobrar un pedido con créditos de juego, emite por RTS
  // y acá refrescamos al instante — sin recargar la página ni esperar el poll. Misma
  // mecánica que usa la pantalla de caja para las lecturas.
  useEffect(() => {
    if (sel) return; // mientras se carga un pedido no tocamos la lista
    const cleanup = suscribirScope(
      'sanjuan-tarjetas',
      'tarjetas',
      () => refrescar({ silencioso: true }),
      setEnVivo,
    );
    return cleanup;
  }, [sel, refrescar]);

  // Respaldo: si el RTS no está disponible (no llega el push), igual refrescamos solos
  // cada 20s para no quedar nunca con la lista vieja.
  useEffect(() => {
    if (sel) return; // no refrescar mientras se está cargando un pedido
    const id = setInterval(() => refrescar({ silencioso: true }), 20000);
    return () => clearInterval(id);
  }, [sel, refrescar]);

  // Cierra la vista de carga y vuelve a la lista, refrescando los pendientes.
  const volverALista = useCallback((data) => {
    setSel(null);
    if (data) setPedidos(data);
    else refrescar({ silencioso: true });
  }, [refrescar]);

  const q = busqueda.trim().toUpperCase();
  const filtrados = q
    ? pedidos.filter(p => p.codigo.includes(q) || (p.familia || '').toUpperCase().includes(q))
    : pedidos;

  if (sel) {
    return (
      <CargarPedido
        pedido={sel}
        onSalir={onSalir}
        onListo={volverALista}
        onCancelar={() => setSel(null)}
      />
    );
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>💳 Acreditar saldos</h1>
        <button className={styles.btnSecundario} onClick={onSalir} style={{ width: 'auto' }}>Salir</button>
      </header>

      <div className={styles.contenido}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por código o familia (ej: últimas letras)"
          className={styles.inputCodigo}
          autoFocus
        />

        <div className={styles.listaHead}>
          <span>
            {cargandoLista ? 'Cargando…' : `${filtrados.length} pedido${filtrados.length !== 1 ? 's' : ''} por acreditar`}
            <span
              title={enVivo ? 'Actualización en vivo activa' : 'Sin conexión en vivo — refresco automático cada 20s'}
              style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginLeft: 8,
                background: enVivo ? '#22c55e' : '#cbd5e1', verticalAlign: 'middle',
              }}
            />
          </span>
          <button className={styles.btnRefrescar} onClick={() => refrescar()} disabled={cargandoLista}>↻</button>
        </div>

        {!cargandoLista && filtrados.length === 0 && (
          <div className={styles.vacio}>
            {q ? `Sin resultados para "${busqueda}".` : 'No hay pedidos pendientes de acreditar.'}
          </div>
        )}

        <div className={styles.lista}>
          {filtrados.map(p => (
            <button key={p.idpedido} className={styles.pedidoCard} onClick={() => setSel(p)}>
              <div className={styles.pedidoInfo}>
                <span className={styles.pedidoCodigo}>{p.codigo}</span>
                {p.familia && <span className={styles.pedidoFamilia}>{p.familia}</span>}
              </div>
              <span className={styles.pendienteBadge}>
                {p.pendiente}<small>créd.</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Vista de carga: dado un pedido pendiente, escanear/ingresar una tarjeta y
// dispensarle créditos. Permite repetir para varias tarjetas del mismo pedido
// (caso "dos hermanos": 10 a una, 10 a otra) hasta agotar el pendiente.
function CargarPedido({ pedido, onSalir, onListo, onCancelar }) {
  const [pendiente, setPendiente] = useState(pedido.pendiente);
  const [codigoTarjeta, setCodigoTarjeta] = useState(null);
  const [cantidad, setCantidad] = useState('');
  const [modoManual, setModoManual] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [ultimaCarga, setUltimaCarga] = useState(null); // { codigo, creditos, saldo }

  function elegirTarjeta(codigo) {
    setCodigoTarjeta(codigo);
    setCantidad(String(pendiente)); // por defecto, cargar todo lo pendiente
  }

  function handleManual(e) {
    e.preventDefault();
    if (!codigoManual.trim()) return;
    elegirTarjeta(codigoManual.trim().toUpperCase());
    setCodigoManual('');
    setModoManual(false);
  }

  async function cargar() {
    const n = parseInt(cantidad, 10);
    if (!n || n < 1) { toast.error('Ingresá una cantidad válida'); return; }
    if (n > pendiente) { toast.error(`Solo quedan ${pendiente} pendientes`); return; }
    setProcesando(true);
    try {
      const res = await dispensarCreditos(pedido.hash, codigoTarjeta, n);
      setUltimaCarga({ codigo: codigoTarjeta, creditos: n, saldo: res.saldoTarjeta });
      toast.success(`✅ ${n} crédito${n !== 1 ? 's' : ''} a ${codigoTarjeta}. Saldo: ${res.saldoTarjeta}`);
      setPendiente(res.pendiente);
      setCodigoTarjeta(null);
      setCantidad('');
      if (res.pendiente <= 0) {
        toast.success('Pedido acreditado por completo');
        onListo(); // refresca y vuelve a la lista
      }
    } catch (err) {
      if (err.response?.status === 401) { onSalir?.(); return; }
      toast.error(err.response?.data?.error || 'Error al acreditar');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>💳 {pedido.codigo}</h1>
        <button className={styles.btnSecundario} onClick={onCancelar} style={{ width: 'auto' }}>← Lista</button>
      </header>

      <div className={styles.contenido}>
        <div className={styles.pedidoResumen}>
          {pedido.familia && <div className={styles.pedidoResumenFam}>{pedido.familia}</div>}
          <div className={styles.saldoDisplay}>
            <span className={styles.saldoLabel}>Pendiente de acreditar</span>
            <span className={styles.saldoValor}>{pendiente} crédito{pendiente !== 1 ? 's' : ''}</span>
          </div>
          {ultimaCarga && (
            <div className={styles.ultimaCarga}>
              Última: {ultimaCarga.creditos} a {ultimaCarga.codigo} (saldo {ultimaCarga.saldo})
            </div>
          )}
        </div>

        {!codigoTarjeta && !modoManual && (
          <div className={styles.scannerBox}>
            <p className={styles.scannerLabel}>Escaneá el QR de la tarjeta</p>
            <QrScanner onDetected={elegirTarjeta} />
            <button className={styles.btnSecundario} onClick={() => setModoManual(true)}>
              Ingresar código manualmente
            </button>
          </div>
        )}

        {!codigoTarjeta && modoManual && (
          <form onSubmit={handleManual} className={styles.buscador}>
            <input
              value={codigoManual}
              onChange={e => setCodigoManual(e.target.value)}
              placeholder="Código de tarjeta (ej: TJC57F6D)"
              className={styles.inputCodigo}
              autoFocus
            />
            <button type="submit">Usar tarjeta</button>
            <button type="button" className={styles.btnSecundario} onClick={() => setModoManual(false)}>
              ← Volver al escáner
            </button>
          </form>
        )}

        {codigoTarjeta && (
          <div className={styles.tarjetaCard}>
            <div className={styles.codigoDisplay}>{codigoTarjeta}</div>

            <label className={styles.label}>Créditos a cargar en esta tarjeta</label>
            <input
              type="number"
              min="1"
              max={pendiente}
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              className={styles.inputCantidad}
              autoFocus
            />

            <button className={styles.btnCargar} onClick={cargar} disabled={procesando || !cantidad}>
              {procesando ? 'Procesando…' : `💳 Cargar ${cantidad || ''} créditos`}
            </button>
            <button className={styles.btnSecundario} onClick={() => { setCodigoTarjeta(null); setCantidad(''); }} disabled={procesando}>
              Cambiar tarjeta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
