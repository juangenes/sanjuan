import { useNavigate } from 'react-router-dom';
import styles from './Caja.module.css';

// Selector de caja: pantalla simple para elegir en qué caja (1..5) se va a operar
// este dispositivo, más el acceso al lector del celular. Cada destino pide login
// aparte. Pensada para abrirse una vez por dispositivo (se puede dejar fija).
const CAJAS = [1, 2, 3, 4, 5];

export default function CajaSelector() {
  const navigate = useNavigate();
  return (
    <div className={styles.selPagina}>
      <div className={styles.selCard}>
        <h1>💵 Caja · San Juan 2026</h1>
        <p className={styles.selSub}>Elegí la caja de este puesto</p>
        <div className={styles.selGrid}>
          {CAJAS.map(n => (
            <button key={n} className={styles.selTile} onClick={() => navigate(`/caja/${n}`)}>
              <span className={styles.selTileNum}>{n}</span>
              <span className={styles.selTileLabel}>Caja {n}</span>
            </button>
          ))}
        </div>
        <button className={styles.selLector} onClick={() => navigate('/caja/lector')}>
          📷 Lector (celular)
        </button>
      </div>
    </div>
  );
}
