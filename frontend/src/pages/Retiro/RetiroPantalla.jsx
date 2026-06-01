import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getColaRetiro, marcarComandaImpresa } from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import { imprimirComandaRetiro, getTicketeraIP, setTicketeraIP } from '../../utils/eposPrint';
import styles from './Retiro.module.css';

// Pantalla única de RETIRO (modelo fast food). Escucha el RTS: cada comanda que
// cae se IMPRIME sola en la ticketera y se "cuelga" en el board. La cola en la
// base es la fuente de verdad: si el RTS se pierde un aviso, igual la levantamos
// al refrescar (RTS + intervalo de respaldo). Una comanda recién sale de la cola
// cuando se imprimió OK (se marca impresa en el backend).
//
// CAVEAT mixed-content: abrí esta pantalla por HTTP en la LAN (igual que la caja)
// para que el navegador pueda hablar con la impresora por http://<ip>.
export default function RetiroPantalla() {
  const [colgadas, setColgadas] = useState([]); // comandas impresas esta sesión (board)
  const [online, setOnline] = useState(false);
  const [errImpresion, setErrImpresion] = useState(false);
  const navigate = useNavigate();

  const impresasRef = useRef(new Set()); // ids ya impresos (no reimprimir solos)
  const enVueloRef = useRef(new Set());  // ids imprimiéndose ahora (anti doble)
  const procesandoRef = useRef(false);

  const horaCorta = (d) =>
    new Date(d).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

  // Imprime las comandas pendientes que aún no se imprimieron en esta sesión.
  const procesarCola = useCallback(async (cola) => {
    if (procesandoRef.current) return;
    if (!getTicketeraIP()) { if (cola.length) setErrImpresion(true); return; }
    procesandoRef.current = true;
    try {
      let huboError = false;
      for (const c of cola) {
        if (impresasRef.current.has(c.id) || enVueloRef.current.has(c.id)) continue;
        enVueloRef.current.add(c.id);
        try {
          await imprimirComandaRetiro(c);
          await marcarComandaImpresa(c.id);
          impresasRef.current.add(c.id);
          setColgadas(prev => [{ ...c, hora: horaCorta(Date.now()) }, ...prev].slice(0, 40));
        } catch (err) {
          huboError = true;
          console.error('[retiro] no se imprimió comanda', c.codigo, err.message);
        } finally {
          enVueloRef.current.delete(c.id);
        }
      }
      setErrImpresion(huboError);
    } finally {
      procesandoRef.current = false;
    }
  }, []);

  const refrescar = useCallback(async () => {
    try {
      const cola = await getColaRetiro();
      await procesarCola(cola);
    } catch (err) {
      // Silencioso: el intervalo y el RTS reintentan.
      console.error('[retiro] no se pudo cargar la cola:', err.message);
    }
  }, [procesarCola]);

  useEffect(() => {
    if (!localStorage.getItem('sanjuan_token')) { navigate('/caja'); return; }
    refrescar();
    // Respaldo: si el RTS se cae, igual levantamos comandas nuevas.
    const id = setInterval(refrescar, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: ante cada aviso de comanda nueva, refrescamos (la base es la verdad).
  useEffect(() => {
    const cleanup = suscribirScope('sanjuan-retiro', 'expendio', () => refrescar(), setOnline);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function configurarIp() {
    const ip = window.prompt('IP de la ticketera de RETIRO:', getTicketeraIP());
    if (ip !== null) {
      setTicketeraIP(ip);
      toast.success(ip ? `Ticketera: ${ip}` : 'IP borrada');
      if (ip) { setErrImpresion(false); refrescar(); }
    }
  }

  async function reimprimir(c) {
    try {
      await imprimirComandaRetiro(c);
      toast.success(`Comanda ${c.codigo} reimpresa`);
    } catch (err) {
      toast.error(`No se pudo reimprimir: ${err.message}`);
    }
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <h1>
          🍔 RETIRO
          <span className={`${styles.dot} ${online ? styles.dotOn : styles.dotOff}`} title={online ? 'En vivo' : 'Sin conexión'} />
        </h1>
        <div className={styles.headRight}>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={refrescar}>↻ Refrescar</button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={configurarIp}>⚙ Impresora</button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { localStorage.clear(); navigate('/caja'); }}>Salir</button>
        </div>
      </header>

      {errImpresion && (
        <div className={styles.banner}>
          <span>⚠️ Hay comandas sin imprimir (¿impresora o IP?). Reintentando automáticamente…</span>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={configurarIp}>Configurar IP</button>
        </div>
      )}

      <div className={styles.board}>
        {colgadas.length === 0 ? (
          <div className={styles.vacio}>📭 Esperando comandas… (se imprimen y cuelgan solas)</div>
        ) : (
          colgadas.map(c => (
            <div key={c.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.codigo}>{c.codigo}</span>
                <span className={styles.hora}>{c.hora}</span>
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
              <button className={styles.reimprimir} onClick={() => reimprimir(c)}>↻ Reimprimir</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
