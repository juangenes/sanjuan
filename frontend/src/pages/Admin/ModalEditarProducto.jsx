import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { actualizarProducto, crearProducto, eliminarProducto, subirImagenProducto } from '../../api';
import styles from './ModalEditarProducto.module.css';

function srcDeImagen(imagen) {
  if (!imagen) return '/img/placeholder.jpg';
  return imagen.startsWith('/') ? imagen : `/img/${imagen}`;
}

export default function ModalEditarProducto({ producto, onClose, onGuardado, onEliminado }) {
  const [datos, setDatos] = useState({ ...producto });
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const fileRef = useRef(null);

  const esNuevo = !producto.idproducto;

  const set = (campo, valor) => setDatos(d => ({ ...d, [campo]: valor }));

  async function handleArchivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5 MB');
      return;
    }
    setSubiendo(true);
    try {
      const { url } = await subirImagenProducto(file);
      set('imagen', url);
      toast.success('Imagen subida');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al subir imagen');
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleGuardar() {
    if (!datos.titulo?.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    setGuardando(true);
    try {
      if (esNuevo) {
        const { idproducto } = await crearProducto(datos);
        onGuardado({ ...datos, idproducto });
        toast.success('Producto creado');
      } else {
        await actualizarProducto(datos.idproducto, datos);
        onGuardado(datos);
        toast.success('Producto actualizado');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!confirm(`¿Eliminar "${datos.titulo}"? Esta acción no se puede deshacer.`)) return;
    setEliminando(true);
    try {
      await eliminarProducto(datos.idproducto);
      onEliminado(datos.idproducto);
      toast.success('Producto eliminado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>{esNuevo ? 'Nuevo producto' : 'Editar producto'}</h2>
          <button className={styles.cerrar} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.body}>
          <div className={styles.imgCol}>
            <div className={styles.preview}>
              <img
                src={srcDeImagen(datos.imagen)}
                alt={datos.titulo}
                onError={e => { e.target.src = '/img/placeholder.jpg'; }}
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleArchivo}
              className={styles.fileInput}
              id="archivo-producto"
            />
            <label htmlFor="archivo-producto" className={`${styles.btnSubir} ${subiendo ? styles.disabled : ''}`}>
              {subiendo ? 'Subiendo...' : 'Cambiar imagen'}
            </label>
            <p className={styles.imgNombre}>{datos.imagen || 'sin imagen'}</p>
          </div>

          <div className={styles.formCol}>
            <label>Título</label>
            <input value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} />

            <label>Descripción</label>
            <textarea
              rows={2}
              value={datos.descripcion || ''}
              onChange={e => set('descripcion', e.target.value)}
            />

            <div className={styles.fila}>
              <div>
                <label>Categoría</label>
                <select value={datos.categoria || 'COMIDA'} onChange={e => set('categoria', e.target.value)}>
                  <option>COMIDA</option>
                  <option>BEBIDA</option>
                  <option>POSTRE</option>
                  <option>JUEGO</option>
                </select>
              </div>
              <div>
                <label>Activo</label>
                <select
                  value={datos.activo ? '1' : '0'}
                  onChange={e => set('activo', e.target.value === '1' ? 1 : 0)}
                >
                  <option value="1">Sí</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>

            <div className={styles.fila}>
              <div>
                <label>Precio preventa</label>
                <input
                  type="number"
                  value={datos.precio_preventa ?? ''}
                  onChange={e => set('precio_preventa', e.target.value)}
                />
              </div>
              <div>
                <label>Precio normal</label>
                <input
                  type="number"
                  value={datos.precio_normal ?? ''}
                  onChange={e => set('precio_normal', e.target.value)}
                />
              </div>
              <div>
                <label>Stock</label>
                <input
                  type="number"
                  value={datos.stock ?? 0}
                  onChange={e => set('stock', e.target.value)}
                />
              </div>
            </div>

            {datos.categoria === 'JUEGO' && (
              <>
                <label>Créditos por unidad</label>
                <input
                  type="number"
                  min="0"
                  value={datos.creditos_por_unidad ?? 0}
                  onChange={e => set('creditos_por_unidad', e.target.value)}
                />
                <p style={{ fontSize: '0.8rem', color: '#777', margin: '0.25rem 0 0' }}>
                  Cuántos créditos de juego entrega cada unidad (combo x10 = 10, suelto = 1).
                  El acreditador dispensa estos créditos contra el pedido pagado.
                </p>
              </>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          {esNuevo ? (
            <span />
          ) : (
            <button
              className={styles.btnEliminar}
              onClick={handleEliminar}
              disabled={eliminando || guardando}
            >
              {eliminando ? 'Eliminando...' : 'Eliminar'}
            </button>
          )}
          <div className={styles.acciones}>
            <button className={styles.btnCancelar} onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button
              className={styles.btnGuardar}
              onClick={handleGuardar}
              disabled={guardando || subiendo}
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
