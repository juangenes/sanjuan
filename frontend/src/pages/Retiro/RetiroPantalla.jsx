import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getColaRetiro, marcarComandaImpresa } from '../../api';
import { suscribirScope } from '../../utils/rtsSocket';
import { imprimirComandaRetiro, getTicketeraIP, setTicketeraIP } from '../../utils/eposPrint';
import styles from './Retiro.module.css';

// Pantalla única de RETIRO (modelo fast food). El board refleja la COLA EN VIVO de
// comandas pendientes (la base es la fuente de verdad): cada comanda que cae —la
// dispare la caja (walk-in o preventa) o el tótem— aparece acá, HAYA O NO impresora.
// Si hay ticketera configurada, además se imprime sola (best-effort, una vez por
// comanda). La comanda sale del board cuando el operario toca «✓ Listo».
//
// CAVEAT mixed-content: para imprimir, abrí esta pantalla por HTTP en la LAN (igual
// que la caja) para que el navegador pueda hablar con la impresora por http://<ip>.
const PRINTED_KEY = 'retiro_impresas'; // ids ya impresos en ESTE dispositivo (evita reimprimir al refrescar)

function cargarImpresas() {
  try { return new Set(JSON.parse(localStorage.getItem(PRINTED_KEY) || '[]')); }
  catch { return new Set(); }
}
function guardarImpresas(set) {
  try { localStorage.setItem(PRINTED_KEY, JSON.stringify([...set].slice(-300))); } catch { /* noop */ }
}

export default function RetiroPantalla() {
  const [cola, setCola] = useState([]); // comandas PENDIENTE (board en vivo)
  const [online, setOnline] = useState(false);
  const [errImpresion, setErrImpresion] = useState(false);
  const navigate = useNavigate();

  const impresasRef = useRef(cargarImpresas()); // ids ya impresos (persisten en localStorage)
  const enVueloRef = useRef(new Set());         // ids imprimiéndose ahora (anti doble)
  const atendidasRef = useRef(new Set());       // ids que ya marcamos Listo (optimista)

  const horaCorta = (d) =>
    new Date(d).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

  // Best-effort: imprime las comandas nuevas si hay ticketera. NO las saca de la
  // cola (el board las muestra hasta que el operario toque «Listo»). El id impreso
  // se guarda en localStorage para no reimprimir al refrescar/recargar.
  const autoImprimir = useCallback(async (lista) => {
    if (!getTicketeraIP()) return; // sin impresora: igual se muestran en el board
    let huboError = false;
    for (const c of lista) {
      if (impresasRef.current.has(c.id) || enVueloRef.current.has(c.id)) continue;
      enVueloRef.current.add(c.id);
      try {
        await imprimirComandaRetiro(c);
        impresasRef.current.add(c.id);
        guardarImpresas(impresasRef.current);
      } catch (err) {
        huboError = true;
        console.error('[retiro] no se imprimió comanda', c.codigo, err.message);
      } finally {
        enVueloRef.current.delete(c.id);
      }
    }
    if (huboError) setErrImpresion(true);
  }, []);

  const refrescar = useCallback(async () => {
    try {
      const lista = await getColaRetiro();
      // Más recientes arriba; descartamos las que ya marcamos Listo (optimista).
      const visible = lista
        .filter(c => !atendidasRef.current.has(c.id))
        .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
      setCola(visible);
      autoImprimir(visible);
    } catch (err) {
      console.error('[retiro] no se pudo cargar la cola:', err.message);
    }
  }, [autoImprimir]);

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

  function configurarIp() {
    const ip = window.prompt('IP de la ticketera de RETIRO:', getTicketeraIP());
    if (ip !== null) {
      setTicketeraIP(ip);
      toast.success(ip ? `Ticketera: ${ip}` : 'IP borrada');
      if (ip) { setErrImpresion(false); refrescar(); }
    }
  }

  async function imprimir(c) {
    try {
      await imprimirComandaRetiro(c);
      impresasRef.current.add(c.id);
      guardarImpresas(impresasRef.current);
      toast.success(`Comanda ${c.codigo} impresa`);
    } catch (err) {
      toast.error(`No se pudo imprimir: ${err.message}`);
    }
  }

  // El operario marca la comanda como atendida → sale del board y de la cola.
  async function marcarListo(c) {
    atendidasRef.current.add(c.id);
    setCola(prev => prev.filter(x => x.id !== c.id)); // optimista
    try {
      await marcarComandaImpresa(c.id);
    } catch (err) {
      atendidasRef.current.delete(c.id);
      toast.error(`No se pudo cerrar: ${err.message}`);
      refrescar();
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
          <span>⚠️ Hay comandas sin imprimir (¿impresora o IP?). Igual se muestran abajo; reintenta automáticamente…</span>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={configurarIp}>Configurar IP</button>
        </div>
      )}

      <div className={styles.board}>
        {cola.length === 0 ? (
          <div className={styles.vacio}>📭 Esperando comandas… (aparecen acá apenas la caja registra la entrega)</div>
        ) : (
          cola.map(c => (
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
                <button className={styles.listo} onClick={() => marcarListo(c)}>✓ Listo</button>
                <button className={styles.reimprimir} onClick={() => imprimir(c)}>🖨</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
