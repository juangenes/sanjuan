import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getColaRetiro, marcarComandaImpresa } from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import { imprimirComandaRetiro, getTicketeraIP, setTicketeraIP } from '../../utils/eposPrint';
import { imprimirComandaRetiroWeb, getModoImpresion, setModoImpresion, COMANDA_PRUEBA } from '../../utils/webPrint';
import styles from './Retiro.module.css';

// Estación de IMPRESIÓN de RETIRO (modelo fast food), layout maestro-detalle.
// IZQUIERDA: la cola de comandas en orden FIFO (la más vieja arriba, las nuevas
// caen al fondo) — la base es la fuente de verdad, así que aparecen haya o no
// impresora. DERECHA: el detalle de lo que hay que preparar/retirar de la comanda
// elegida, con el botón «🖨 Imprimir». Se elige cuál atender haciendo click en el
// item de la izquierda; no hace falta respetar el orden.
//
// IMPRESIÓN: el botón soporta dos métodos (se elige en ⚙ Impresora, se guarda por PC):
//   • USB/Windows (por defecto): imprime por el driver de Windows (window.print) a la
//     impresora predeterminada — ej. Epson TM-T20IVL por USB001. Funciona por HTTPS.
//     Para que salga sin diálogo, abrir Chrome con --kiosk-printing (ver webPrint.js).
//   • Red/IP: ePOS-Print por http://<ip> (ej. m30II). CAVEAT mixed-content: en este
//     modo hay que abrir la pantalla por HTTP en la LAN para que el navegador pueda
//     hablar con la impresora por http://<ip>.
export default function RetiroPantalla() {
  const [cola, setCola] = useState([]);          // comandas pendientes (FIFO: vieja→nueva)
  const [selId, setSelId] = useState(null);      // comanda elegida (detalle a la derecha)
  const [impresas, setImpresas] = useState([]);  // historial de impresas en esta sesión
  const [imprimiendo, setImprimiendo] = useState(() => new Set());
  const [online, setOnline] = useState(false);
  const [busqueda, setBusqueda] = useState('');  // filtro de la cola (código o familia)
  const navigate = useNavigate();

  const quitadasRef = useRef(new Set()); // ids ya impresos/quitados (evita que el refetch los reviva)

  const horaCorta = (d) =>
    new Date(d).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

  const refrescar = useCallback(async () => {
    try {
      const lista = await getColaRetiro();
      // FIFO: la más vieja primero (lo nuevo se va al fondo). getColaRetiro ya
      // devuelve ascendente por creado_en; igual lo aseguramos.
      const visible = lista
        .filter(c => !quitadasRef.current.has(c.id))
        .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
      setCola(visible);
    } catch (err) {
      console.error('[retiro] no se pudo cargar la cola:', err.message);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('sanjuan_token')) { navigate('/caja'); return; }
    refrescar();
    const id = setInterval(refrescar, 8000); // respaldo si el RTS se cae
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cleanup = suscribirScope('sanjuan-retiro', 'expendio', () => refrescar(), setOnline);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selección efectiva derivada en el render (sin efecto): la comanda elegida si
  // sigue en la cola; si no (recién impresa) o si no hay ninguna elegida, cae a la
  // primera (la más vieja, FIFO). Click en un item de la izquierda fija selId.
  const sel = cola.find(c => c.id === selId) || cola[0] || null;

  // Cola visible según el buscador. Conserva la posición FIFO original (idx) para
  // que el número del item siga indicando el lugar real en la cola.
  const q = busqueda.trim().toLowerCase();
  const colaFiltrada = q
    ? cola
        .map((c, idx) => ({ c, idx }))
        .filter(({ c }) =>
          (c.codigo || '').toLowerCase().includes(q) ||
          (c.familia || '').toLowerCase().includes(q))
    : cola.map((c, idx) => ({ c, idx }));

  function marcarImprimiendo(id, on) {
    setImprimiendo(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  // Verifica que la impresora esté lista según el método elegido. En USB/Windows no
  // hace falta nada (usa la predeterminada). En Red/IP, pide la IP si falta.
  function impresoraLista() {
    if (getModoImpresion() === 'usb') return true;
    if (getTicketeraIP()) return true;
    const ip = window.prompt('IP de la ticketera de RETIRO (ej. 192.168.1.50):', '');
    if (ip) setTicketeraIP(ip);
    return !!getTicketeraIP();
  }

  // Imprime una comanda por el método configurado: USB/Windows (driver, sin IP) o
  // Red/IP (ePOS-Print; lanza {code:'SIN_IP'} si falta la IP).
  function imprimirComandaSegunModo(c) {
    return getModoImpresion() === 'usb'
      ? imprimirComandaRetiroWeb(c)
      : imprimirComandaRetiro(c);
  }

  // Imprime una comanda. Al imprimir OK, la saca de la cola y la pasa al historial.
  async function imprimir(c) {
    if (!c || imprimiendo.has(c.id)) return;
    if (!impresoraLista()) { toast.error('No hay impresora configurada'); return; }
    marcarImprimiendo(c.id, true);
    try {
      await imprimirComandaSegunModo(c);
      await marcarComandaImpresa(c.id); // sale de la cola en la base
      quitadasRef.current.add(c.id);
      setCola(prev => prev.filter(x => x.id !== c.id));
      setImpresas(prev => [{ ...c, horaImpresa: horaCorta(Date.now()) }, ...prev].slice(0, 20));
      toast.success(`Comanda ${c.codigo} impresa`);
    } catch (err) {
      toast.error(err.code === 'SIN_IP' ? 'No hay ticketera configurada' : `No se imprimió: ${err.message}`);
    } finally {
      marcarImprimiendo(c.id, false);
    }
  }

  // Quita una comanda de la cola sin imprimirla (error, duplicado, etc.).
  async function quitar(c) {
    if (!c) return;
    quitadasRef.current.add(c.id);
    setCola(prev => prev.filter(x => x.id !== c.id)); // optimista
    try {
      await marcarComandaImpresa(c.id);
    } catch (err) {
      quitadasRef.current.delete(c.id);
      toast.error(`No se pudo quitar: ${err.message}`);
      refrescar();
    }
  }

  async function reimprimir(c) {
    if (!impresoraLista()) { toast.error('No hay impresora configurada'); return; }
    try {
      await imprimirComandaSegunModo(c);
      toast.success(`Comanda ${c.codigo} reimpresa`);
    } catch (err) {
      toast.error(`No se pudo reimprimir: ${err.message}`);
    }
  }

  // Imprime una comanda de muestra para probar la impresora sin esperar un pedido real.
  async function imprimirPrueba() {
    if (!impresoraLista()) { toast.error('No hay impresora configurada'); return; }
    try {
      await imprimirComandaSegunModo(COMANDA_PRUEBA);
      toast.success('Prueba enviada a la impresora');
    } catch (err) {
      toast.error(`No se imprimió: ${err.message}`);
    }
  }

  // Elige el método de impresión de esta PC: USB/Windows (TM-T20IVL por USB) o
  // Red/IP (ePOS, ej. m30II). Si es por red, además pide la IP.
  function configurarImpresora() {
    const esUsb = window.confirm(
      'Impresora de RETIRO — elegí el método:\n\n' +
      '• Aceptar  → USB / Windows (TM-T20IVL por USB001)\n' +
      '• Cancelar → Red / IP (ePOS, ej. m30II)\n\n' +
      `Método actual: ${getModoImpresion() === 'usb' ? 'USB / Windows' : 'Red / IP'}`
    );
    if (esUsb) {
      setModoImpresion('usb');
      toast.success('Impresora: USB / Windows');
    } else {
      setModoImpresion('red');
      const ip = window.prompt('IP de la ticketera de RETIRO:', getTicketeraIP());
      if (ip !== null) setTicketeraIP(ip);
      toast.success(getTicketeraIP() ? `Impresora: Red ${getTicketeraIP()}` : 'Impresora: Red (falta IP)');
    }
  }

  const enCurso = sel ? imprimiendo.has(sel.id) : false;

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>
          🖨 RETIRO · Impresión
          <span className={`${styles.dot} ${online ? styles.dotOn : styles.dotOff}`} title={online ? 'En vivo' : 'Sin conexión'} />
        </h1>
        <div className={styles.headRight}>
          {cola.length > 0 && <span className={styles.contador}>{cola.length} en cola</span>}
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={refrescar}>↻ Refrescar</button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={imprimirPrueba}>🖨 Prueba</button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={configurarImpresora}>⚙ Impresora</button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { localStorage.clear(); navigate('/caja'); }}>Salir</button>
        </div>
      </header>

      <div className={styles.split}>
        {/* IZQUIERDA: cola FIFO (vieja arriba, nuevas al fondo) */}
        <aside className={styles.lista}>
          <div className={styles.buscador}>
            <span className={styles.buscadorIcon}>🔍</span>
            <input
              className={styles.buscadorInput}
              type="search"
              placeholder="Buscar código o familia…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button className={styles.buscadorClear} onClick={() => setBusqueda('')} title="Limpiar">✕</button>
            )}
          </div>

          {cola.length === 0 ? (
            <div className={styles.vacio}>📭 Esperando comandas…</div>
          ) : colaFiltrada.length === 0 ? (
            <div className={styles.vacio}>Sin coincidencias para «{busqueda}»</div>
          ) : (
            colaFiltrada.map(({ c, idx }) => (
              <button
                key={c.id}
                className={`${styles.listItem} ${c.id === selId ? styles.listItemActivo : ''}`}
                onClick={() => setSelId(c.id)}
              >
                <span className={styles.liPos}>{idx + 1}</span>
                <div className={styles.liInfo}>
                  <span className={styles.liCod}>{c.codigo}</span>
                  <span className={styles.liFam}>{c.familia}</span>
                </div>
                <span className={styles.liHora}>{horaCorta(c.creado_en)}</span>
              </button>
            ))
          )}

          {impresas.length > 0 && (
            <div className={styles.historial}>
              <div className={styles.historialTit}>Impresas en esta sesión</div>
              <div className={styles.histChips}>
                {impresas.map(c => (
                  <button key={`${c.id}-${c.horaImpresa}`} className={styles.histChip} onClick={() => reimprimir(c)} title="Reimprimir">
                    <span className={styles.histCod}>{c.codigo}</span>
                    <span className={styles.histRe}>↻</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* DERECHA: detalle de lo a retirar */}
        <section className={styles.detalle}>
          {!sel ? (
            <div className={styles.detalleVacio}>👈 Elegí una comanda de la cola</div>
          ) : (
            <>
              <div className={styles.detTop}>
                <span className={styles.detCodigo}>{sel.codigo}</span>
                <span className={styles.detHora}>{horaCorta(sel.creado_en)}</span>
              </div>
              <div className={styles.detFamilia}>{sel.familia}</div>
              <div className={styles.detPreparar}>PREPARAR / ENTREGAR</div>
              <ul className={styles.detItems}>
                {(sel.items || []).map((it, i) => (
                  <li key={i} className={styles.detItem}>
                    <span className={styles.detQty}>{it.cantidad}</span>
                    <span className={styles.detNombre}>{it.titulo}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.detBtns}>
                <button className={styles.imprimir} onClick={() => imprimir(sel)} disabled={enCurso}>
                  {enCurso ? 'Imprimiendo…' : '🖨 Imprimir'}
                </button>
                <button className={styles.quitar} title="Quitar sin imprimir" onClick={() => quitar(sel)} disabled={enCurso}>✕</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
