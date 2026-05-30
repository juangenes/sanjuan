import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Sorteo.css';

// ⚠️ CONFIGURÁ TU NÚMERO DE WHATSAPP AQUÍ (formato internacional, sin + ni espacios).
// Ej: Paraguay 0981 123 456  ->  '595981123456'
const WHATSAPP = '595981120287';

// Precio por rifa (Gs.)
const PRECIO_RIFA = 20000;

// Alias al que se transfiere el pago
const ALIAS_TRANSFERENCIA = '0981352935';

const PREMIOS = [
  {
    n: '1er',
    emoji: '📒',
    img: '/img/caja_figuritas.png',
    t: '1 caja de figuritas del Mundial',
    d: 'La caja completa para llenar tu álbum del Mundial.',
  },
  {
    n: '2do',
    emoji: '👕',
    img: '/img/camiseta_albirroja.webp',
    t: '1 camiseta oficial de la Albirroja',
    d: 'La camiseta original de la Selección Paraguaya.',
  },
  {
    n: '3er',
    emoji: '⚽',
    img: '/img/pelota.webp',
    t: '1 pelota oficial del Mundial',
    d: 'La pelota oficial, lista para la cancha.',
  },
];

function fmtGs(n) {
  return Number(n || 0).toLocaleString('es-PY');
}

function ModalRifas({ onClose }) {
  const [cantidad, setCantidad] = useState(1);
  const [nombre, setNombre] = useState('');
  const [ci, setCi] = useState('');
  const total = cantidad * PRECIO_RIFA;

  const nombreOk = nombre.trim().length >= 2;
  const ciOk = ci.trim().length >= 4;
  const valido = nombreOk && ciOk;

  const baja = () => setCantidad((c) => Math.max(1, c - 1));
  const sube = () => setCantidad((c) => Math.min(999, c + 1));
  const onInput = (e) => {
    const v = parseInt(e.target.value, 10);
    setCantidad(Number.isNaN(v) ? 1 : Math.min(999, Math.max(1, v)));
  };
  // CI: solo dígitos
  const onCi = (e) => setCi(e.target.value.replace(/[^\d]/g, ''));

  const enviar = () => {
    if (!valido) return;
    const plural = cantidad === 1 ? 'rifa' : 'rifas';
    const msg =
      `Hola! Soy ${nombre.trim()} (CI ${ci.trim()}). ` +
      `Quiero comprar ${cantidad} ${plural}! ` +
      `Dame unos minutos para enviarte el comprobante de transferencia al alias ${ALIAS_TRANSFERENCIA} ` +
      `por el monto de Gs. ${fmtGs(total)} y aguardo la foto de mis rifas para saber mis numeros! ` +
      `Quiero ganar todos los premios!`;
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener');
    onClose();
  };

  return (
    <div className="srt-modal-overlay" onClick={onClose}>
      <div className="srt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="srt-modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        <span className="srt-modal-emoji">🎟️</span>
        <h3>Reservá tu rifa</h3>
        <p className="srt-modal-sub">Tus datos quedan anotados en la rifa. Cada una cuesta Gs. {fmtGs(PRECIO_RIFA)}.</p>

        <div className="srt-field">
          <label htmlFor="srt-nombre">Nombre y apellido</label>
          <input
            id="srt-nombre"
            type="text"
            placeholder="Ej: Juan Pérez"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="srt-field">
          <label htmlFor="srt-ci">Número de cédula (CI)</label>
          <input
            id="srt-ci"
            type="text"
            inputMode="numeric"
            placeholder="Ej: 1234567"
            value={ci}
            onChange={onCi}
          />
        </div>

        <span className="srt-field-label">¿Cuántas rifas?</span>
        <div className="srt-stepper">
          <button onClick={baja} aria-label="Restar">−</button>
          <input
            type="number"
            min="1"
            max="999"
            value={cantidad}
            onChange={onInput}
          />
          <button onClick={sube} aria-label="Sumar">+</button>
        </div>

        <div className="srt-modal-total">
          <span>Total a transferir</span>
          <strong>Gs. {fmtGs(total)}</strong>
        </div>

        <button className="srt-modal-cta" onClick={enviar} disabled={!valido}>
          Enviar por WhatsApp →
        </button>
        <p className="srt-modal-note">
          Te abrimos WhatsApp con el mensaje listo. Mandás el comprobante y te devolvemos la foto de tus rifas.
        </p>
      </div>
    </div>
  );
}

export default function Sorteo() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="srt">
      <nav className="srt-nav">
        <Link to="/" className="srt-nav-brand">
          <span className="srt-nav-mark">SJ</span>
          <span>San Juan Dice Que Si !!!</span>
        </Link>
        <Link to="/" className="srt-nav-back">← Volver al inicio</Link>
      </nav>

      <header className="srt-hero">
        <span className="srt-tag">⚽ Para los amantes del fútbol</span>
        <h1>Gran Rifa<br /><span className="srt-hl">Promo 2032</span></h1>
        <p className="srt-sub">
          Tres premios mundialistas. Participá por solo <strong>G. 20.000</strong> y
          jugá por la caja de figuritas, la camiseta de la Albirroja y la pelota oficial.
        </p>
        <button className="srt-hero-cta" onClick={() => setAbierto(true)}>
          🎟️ Comprar mi rifa
        </button>
      </header>

      <section className="srt-premios">
        {PREMIOS.map((p) => (
          <div className={`srt-premio srt-premio-${p.n}`} key={p.n}>
            {p.img ? (
              <div className="srt-premio-img">
                <img
                  src={p.img}
                  alt={p.t}
                  onError={(e) => {
                    const fallback = e.currentTarget.nextElementSibling;
                    e.currentTarget.style.display = 'none';
                    if (fallback) fallback.style.display = '';
                  }}
                />
                <span className="srt-premio-emoji" style={{ display: 'none' }}>{p.emoji}</span>
              </div>
            ) : (
              <div className="srt-premio-emoji">{p.emoji}</div>
            )}
            <span className="srt-premio-pos">{p.n} premio</span>
            <h3>{p.t}</h3>
            <p>{p.d}</p>
          </div>
        ))}
      </section>

      <section className="srt-precio">
        <span className="srt-precio-label">Participá y ganá por solo</span>
        <span className="srt-precio-monto">G. 20.000</span>
        <span className="srt-precio-nota">Cuantas más compras, más posibilidades tenés de ganar 🍀</span>
      </section>

      <section className="srt-info">
        <div className="srt-info-card">
          <div className="srt-info-icon">📅</div>
          <h4>Cuándo se sortea</h4>
          <div className="srt-info-val">Sábado 6 de junio</div>
          <p>A las 15:30 hs, durante el San Juan en el Colegio Torrefuerte.</p>
        </div>
        <div className="srt-info-card">
          <div className="srt-info-icon">🎟️</div>
          <h4>Cómo participar</h4>
          <div className="srt-info-val">Escribime y reservá</div>
          <p>Tocá el botón, elegí cuántas rifas querés y te abrimos WhatsApp con el mensaje listo.</p>
        </div>
      </section>

      <section className="srt-contacto">
        <button className="srt-contacto-cta" onClick={() => setAbierto(true)}>
          💬 Reservar por WhatsApp
        </button>
      </section>

      <footer className="srt-footer">
        <span className="srt-footer-mark">⚽</span>
        San Juan Ara · Torrefuerte 2026
      </footer>

      {abierto && <ModalRifas onClose={() => setAbierto(false)} />}
    </div>
  );
}
