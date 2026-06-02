import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getColaRetiro, marcarComandaImpresa } from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import { imprimirComandaRetiro, getTicketeraIP, setTicketeraIP } from '../../utils/eposPrint';
import styles from './Retiro.module.css';

// Estación de IMPRESIÓN de RETIRO (modelo fast food). Las comandas que dispara la
// caja (walk-in o preventa) o el tótem van CAYENDO acá como "pendientes de imprimir"
// —la base es la fuente de verdad, así que aparecen haya o no impresora—. El
// operario decide y toca «🖨 Imprimir» en cada una: al imprimirse, la comanda sale
// del board y pasa al historial de la sesión (por si hay que reimprimir). No hay
// impresión automática ni marca de "entregado": esta pantalla es solo para imprimir.
//
// CAVEAT mixed-content: para imprimir, abrí esta pantalla por HTTP en la LAN (igual
// que la caja) para que el navegador pueda hablar con la impresora por http://<ip>.
export default function RetiroPantalla() {
  const [cola, setCola] = useState([]);          // comandas pendientes de imprimir (board)
  const [impresas, setImpresas] = useState([]);  // historial de impresas en esta sesión
  const [imprimiendo, setImprimiendo] = useState(() => new Set()); // ids imprimiéndose ahora
  const [online, setOnline] = useState(false);
  const navigate = useNavigate();

  const quitadasRef = useRef(new Set()); // ids ya impresos/quitados (evita que el refetch los reviva)

  const horaCorta = (d) =>
    new Date(d).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

  const refrescar = useCallback(async () => {
    try {
      const lista = await getColaRetiro();
      const visible = lista
        .filter(c => !quitadasRef.current.has(c.id))
        .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
      setCola(visible);
    } catch (err) {
      console.error('[retiro] no se pudo cargar la cola:', err.message);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('sanjuan_token')) { navigate('/caja'); return; }
    refrescar();
    // Respaldo: si el RTS se cae, igual levantamos comandas nuevas.
    const id = setInterval(refrescar, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: ante cada aviso de comanda nueva, refrescamos (la base es la verdad).
  useEffect(() => {
    const cleanup = suscribirScope('sanjuan-retiro', 'expendio', () => refrescar(), setOnline);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function marcarImprimiendo(id, on) {
    setImprimiendo(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  function pedirIpSiFalta() {
    if (getTicketeraIP()) return true;
    const ip = window.prompt('IP de la ticketera de RETIRO (ej. 192.168.1.50):', '');
    if (ip) setTicketeraIP(ip);
    return !!getTicketeraIP();
  }

  // Imprime una comanda. Al imprimir OK, la saca del board y la pasa al historial.
  async function imprimir(c) {
    if (imprimiendo.has(c.id)) return;
    if (!pedirIpSiFalta()) { toast.error('No hay ticketera configurada'); return; }
    marcarImprimiendo(c.id, true);
    try {
      await imprimirComandaRetiro(c);
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

  // Quita una comanda del board sin imprimirla (error, duplicado, etc.).
  async function quitar(c) {
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
    if (!pedirIpSiFalta()) { toast.error('No hay ticketera configurada'); return; }
    try {
      await imprimirComandaRetiro(c);
      toast.success(`Comanda ${c.codigo} reimpresa`);
    } catch (err) {
      toast.error(`No se pudo reimprimir: ${err.message}`);
    }
  }

  function configurarIp() {
    const ip = window.prompt('IP de la ticketera de RETIRO:', getTicketeraIP());
    if (ip !== null) {
      setTicketeraIP(ip);
      toast.success(ip ? `Ticketera: ${ip}` : 'IP borrada');
    }
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>
          🖨 RETIRO · Impresión
          <span className={`${styles.dot} ${online ? styles.dotOn : styles.dotOff}`} title={online ? 'En vivo' : 'Sin conexión'} />
        </h1>
        <div className={styles.headRight}>
          {cola.length > 0 && <span className={styles.contador}>{cola.length} por imprimir</span>}
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={refrescar}>↻ Refrescar</button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={configurarIp}>⚙ Impresora</button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { localStorage.clear(); navigate('/caja'); }}>Salir</button>
        </div>
      </header>

      <div className={styles.board}>
        {cola.length === 0 ? (
          <div className={styles.vacio}>📭 Esperando comandas… (caen acá apenas la caja registra la entrega)</div>
        ) : (
          cola.map(c => {
            const enCurso = imprimiendo.has(c.id);
            return (
              <div key={c.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.codigo}>{c.codigo}</span>
                  <span className={styles.hora}>{horaCorta(c.creado_en)}</span>
                </div>
                <div className={styles.familia}>{c.familia}</div>
                <ul className={styles.items}>
                  {(c.items || []).map((it, i) => (
                    <li key={i} className={styles.item}>
                      <span className={styles.itemQty}>{it.cantidad}</span>
                      <span>{it.titulo}</span>
                    </li>
                  ))}
                </ul>
                <div className={styles.cardBtns}>
                  <button className={styles.imprimir} onClick={() => imprimir(c)} disabled={enCurso}>
                    {enCurso ? 'Imprimiendo…' : '🖨 Imprimir'}
                  </button>
                  <button className={styles.quitar} title="Quitar sin imprimir" onClick={() => quitar(c)} disabled={enCurso}>✕</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {impresas.length > 0 && (
        <div className={styles.historial}>
          <div className={styles.historialTit}>Impresas en esta sesión</div>
          <div className={styles.histChips}>
            {impresas.map(c => (
              <button key={`${c.id}-${c.horaImpresa}`} className={styles.histChip} onClick={() => reimprimir(c)} title="Reimprimir">
                <span className={styles.histCod}>{c.codigo}</span>
                <span className={styles.histHora}>{c.horaImpresa}</span>
                <span className={styles.histRe}>↻</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
