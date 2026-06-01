import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getFotosAdmin, subirFoto, moderarFoto, eliminarFoto } from '../../api';
import { MARCOS, MARCO_DEFAULT, getMarco, OUTPUT_W, OUTPUT_H } from '../../utils/marcos';
import styles from './AutoFoto.module.css';

// AUTO FOTO — captura + moderación (se usa desde el celular del fotógrafo, login
// admin). Flujo: elegir/tomar foto → recortar (arrastrar + zoom) → elegir marco
// → previsualizar → Publicar. El recorte y el marco se "hornean" en un canvas a
// resolución final (4:5) y se sube la imagen ya lista. La pestaña "Moderar"
// permite ocultar/borrar lo que ya está publicado.

export default function AutoFotoAdmin() {
  const navigate = useNavigate();
  const [vista, setVista] = useState('capturar'); // 'capturar' | 'moderar'

  // ─── Captura ───────────────────────────────────────────────────────────
  const [img, setImg] = useState(null);     // HTMLImageElement cargada
  const [zoom, setZoom] = useState(1);
  const [marco, setMarco] = useState(MARCO_DEFAULT);
  const [subiendo, setSubiendo] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });  // desplazamiento del recorte (px de salida)
  const canvasRef = useRef(null);
  const objUrlRef = useRef(null);
  const dragRef = useRef(null);
  const camInput = useRef(null);
  const galInput = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem('sanjuan_token')) navigate('/admin');
  }, [navigate]);

  // Dimensiones de dibujo de la foto para un zoom dado (modo "cover").
  const dims = useCallback((z) => {
    if (!img) return { drawW: OUTPUT_W, drawH: OUTPUT_H };
    const base = Math.max(OUTPUT_W / img.naturalWidth, OUTPUT_H / img.naturalHeight);
    const s = base * z;
    return { drawW: img.naturalWidth * s, drawH: img.naturalHeight * s };
  }, [img]);

  const clamp = useCallback((off, z) => {
    const { drawW, drawH } = dims(z);
    const maxX = Math.max(0, (drawW - OUTPUT_W) / 2);
    const maxY = Math.max(0, (drawH - OUTPUT_H) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, off.x)),
      y: Math.min(maxY, Math.max(-maxY, off.y)),
    };
  }, [dims]);

  // Redibuja foto + marco en el canvas (WYSIWYG: es la misma imagen que se sube).
  const dibujar = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, OUTPUT_W, OUTPUT_H);
    if (img) {
      const { drawW, drawH } = dims(zoom);
      const off = clamp(offsetRef.current, zoom);
      offsetRef.current = off;
      ctx.drawImage(img, (OUTPUT_W - drawW) / 2 + off.x, (OUTPUT_H - drawH) / 2 + off.y, drawW, drawH);
    } else {
      ctx.fillStyle = '#10202e';
      ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H);
    }
    getMarco(marco).draw(ctx, OUTPUT_W, OUTPUT_H);
  }, [img, zoom, marco, dims, clamp]);

  useEffect(() => { dibujar(); }, [dibujar]);

  function elegirArchivo(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    const url = URL.createObjectURL(file);
    objUrlRef.current = url;
    const im = new Image();
    im.onload = () => {
      offsetRef.current = { x: 0, y: 0 };
      setZoom(1);
      setImg(im);
    };
    im.onerror = () => toast.error('No se pudo abrir la imagen');
    im.src = url;
  }

  // Arrastre para reposicionar el recorte (px de pantalla → px de salida).
  function onPointerDown(e) {
    if (!img) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e) {
    if (!dragRef.current || !img) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ratio = OUTPUT_W / rect.width;
    const dx = (e.clientX - dragRef.current.x) * ratio;
    const dy = (e.clientY - dragRef.current.y) * ratio;
    dragRef.current = { x: e.clientX, y: e.clientY };
    offsetRef.current = clamp({ x: offsetRef.current.x + dx, y: offsetRef.current.y + dy }, zoom);
    dibujar();
  }
  function onPointerUp() { dragRef.current = null; }

  function cambiarZoom(z) {
    offsetRef.current = clamp(offsetRef.current, z);
    setZoom(z);
  }

  function descartar() {
    if (objUrlRef.current) { URL.revokeObjectURL(objUrlRef.current); objUrlRef.current = null; }
    setImg(null);
    setZoom(1);
    offsetRef.current = { x: 0, y: 0 };
  }

  async function publicar() {
    if (!img || subiendo) return;
    setSubiendo(true);
    try {
      const blob = await new Promise((res, rej) =>
        canvasRef.current.toBlob(b => b ? res(b) : rej(new Error('No se pudo generar la imagen')), 'image/jpeg', 0.9)
      );
      await subirFoto(blob, marco);
      toast.success('📸 ¡Foto publicada! Ya aparece en las pantallas.');
      descartar();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'No se pudo publicar');
    } finally {
      setSubiendo(false);
    }
  }

  // ─── Moderación ──────────────────────────────────────────────────────────
  const [fotos, setFotos] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargarFotos = useCallback(async () => {
    setCargando(true);
    try { setFotos(await getFotosAdmin()); }
    catch { toast.error('No se pudieron cargar las fotos'); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { if (vista === 'moderar') cargarFotos(); }, [vista, cargarFotos]);

  async function toggle(f) {
    try {
      await moderarFoto(f.id, !f.publicada);
      setFotos(prev => prev.map(x => x.id === f.id ? { ...x, publicada: f.publicada ? 0 : 1 } : x));
    } catch { toast.error('No se pudo actualizar'); }
  }
  async function borrar(f) {
    if (!window.confirm('¿Borrar esta foto? No se puede deshacer.')) return;
    try {
      await eliminarFoto(f.id);
      setFotos(prev => prev.filter(x => x.id !== f.id));
      toast.success('Foto borrada');
    } catch { toast.error('No se pudo borrar'); }
  }

  return (
    <div className={styles.admin}>
      <header className={styles.adminHeader}>
        <h1>📸 AUTO FOTO</h1>
        <div className={styles.tabs}>
          <button className={vista === 'capturar' ? styles.tabActive : styles.tab} onClick={() => setVista('capturar')}>Capturar</button>
          <button className={vista === 'moderar' ? styles.tabActive : styles.tab} onClick={() => setVista('moderar')}>Moderar</button>
        </div>
        <button className={styles.salir} onClick={() => { localStorage.clear(); navigate('/admin'); }}>Salir</button>
      </header>

      {vista === 'capturar' ? (
        <div className={styles.capturar}>
          <div className={styles.lienzoWrap}>
            <canvas
              ref={canvasRef}
              width={OUTPUT_W}
              height={OUTPUT_H}
              className={styles.lienzo}
              style={{ touchAction: 'none', cursor: img ? 'grab' : 'default' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {!img && (
              <div className={styles.placeholder}>
                <div className={styles.phEmoji}>📷</div>
                <p>Tomá o elegí una foto para empezar</p>
              </div>
            )}
          </div>

          {img && (
            <div className={styles.controles}>
              <label className={styles.zoomRow}>
                <span>🔍</span>
                <input type="range" min="1" max="3" step="0.01" value={zoom}
                  onChange={e => cambiarZoom(Number(e.target.value))} />
              </label>
              <div className={styles.marcos}>
                {MARCOS.map(m => (
                  <button key={m.key}
                    className={marco === m.key ? styles.marcoActivo : styles.marcoBtn}
                    onClick={() => setMarco(m.key)}>
                    {m.label}
                  </button>
                ))}
              </div>
              <p className={styles.tip}>Arrastrá la foto para encuadrar · zoom con la barra</p>
            </div>
          )}

          <div className={styles.acciones}>
            <input ref={camInput} type="file" accept="image/*" capture="environment" hidden onChange={elegirArchivo} />
            <input ref={galInput} type="file" accept="image/*" hidden onChange={elegirArchivo} />
            {!img ? (
              <>
                <button className={styles.btnPrimario} onClick={() => camInput.current.click()}>📷 Cámara</button>
                <button className={styles.btnSecundario} onClick={() => galInput.current.click()}>🖼 Galería</button>
              </>
            ) : (
              <>
                <button className={styles.btnSecundario} onClick={descartar} disabled={subiendo}>↺ Otra</button>
                <button className={styles.btnPrimario} onClick={publicar} disabled={subiendo}>
                  {subiendo ? 'Publicando…' : '✓ Publicar'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.moderar}>
          <div className={styles.moderarTop}>
            <span>{fotos.length} foto(s)</span>
            <button className={styles.btnSecundario} onClick={cargarFotos}>↻ Refrescar</button>
          </div>
          {cargando ? (
            <p className={styles.aviso}>Cargando…</p>
          ) : fotos.length === 0 ? (
            <p className={styles.aviso}>Todavía no hay fotos.</p>
          ) : (
            <div className={styles.grid}>
              {fotos.map(f => (
                <div key={f.id} className={`${styles.tile} ${f.publicada ? '' : styles.oculta}`}>
                  <img src={f.url} alt="" loading="lazy" />
                  {!f.publicada && <span className={styles.badge}>oculta</span>}
                  <div className={styles.tileBtns}>
                    <button onClick={() => toggle(f)}>{f.publicada ? '🙈 Ocultar' : '👁 Publicar'}</button>
                    <button className={styles.del} onClick={() => borrar(f)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
