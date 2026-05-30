import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProductos } from '../../api';
import './Landing.css';

const TIENDA_PATH = '/tienda';
const MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=-25.31670230890569%2C-57.51481211053011';
const MAPS_EMBED_URL =
  'https://maps.google.com/maps?q=-25.31670230890569,-57.51481211053011&z=16&output=embed';

function fmtGs(n) {
  return Number(n || 0).toLocaleString('es-PY');
}

function imgSrc(p) {
  if (!p.imagen) return '/img/placeholder.jpg';
  return p.imagen.startsWith('/') ? p.imagen : `/img/${p.imagen}`;
}

function LandingNav() {
  return (
    <nav className="ld-nav">
      <div className="ld-nav-brand">
        <span className="ld-nav-brand-mark">SJ</span>
        <span>San Juan Dice Que Si !!!</span>
      </div>
      <div className="ld-nav-links">
        <a href="#tradicion">La tradición</a>
        <a href="#juegos">Juegos</a>
        <a href="#comidas">Comidas</a>
        <a href="#info">Cuándo & dónde</a>
      </div>
      <Link to={TIENDA_PATH} className="ld-nav-cta">
        Comprar preventa →
      </Link>
    </nav>
  );
}

function LandingHero() {
  return (
    <section className="ld-hero">
      <div className="ld-hero-inner">
        <div>
          <span className="ld-hero-tag">
            <span className="ld-hero-tag-dot" />
            Edición 2026 · Colegio Torrefuerte
          </span>
          <h1>San Juan<br/>Dice Que Si <span className="ii">!!!</span></h1>
          <p className="ld-hero-sub">
            Mbeju recién hecho, asaditos al carbón y los juegos de siempre, en
            una jornada a pleno día para toda la familia. Como cuando éramos
            chicos — pero ahora con preventa online y sin filas.
          </p>
          <div className="ld-hero-meta">
            <div className="ld-hero-meta-item">
              <span className="ld-hero-meta-label">Fecha</span>
              <span className="ld-hero-meta-value">Sábado 6 de junio</span>
            </div>
            <div className="ld-hero-meta-item">
              <span className="ld-hero-meta-label">Desde</span>
              <span className="ld-hero-meta-value">11:00 am</span>
            </div>
            <div className="ld-hero-meta-item">
              <span className="ld-hero-meta-label">Lugar</span>
              <span className="ld-hero-meta-value">Colegio Torrefuerte</span>
            </div>
          </div>
          <div className="ld-hero-actions">
            <Link to={TIENDA_PATH} className="ld-btn-primary">
              Comprar en preventa →
            </Link>
            <a href="#juegos" className="ld-btn-secondary">Ver el programa</a>
          </div>
        </div>
        <div className="ld-hero-visual">
          <div className="ld-hero-poster">
            <div className="ld-hero-poster-top">Colegio Torrefuerte · 6° Grado · presenta</div>
            <div className="ld-hero-poster-mid">
              San Juan<br/>Dice Que Si <span style={{color:'#fff'}}>!!!</span>
              <span className="anio">06·06·2026</span>
            </div>
            <div className="ld-hero-poster-bot">Comida · Juegos · Música en vivo</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingTradicion() {
  return (
    <section className="ld-section ld-tradicion" id="tradicion">
      <div className="ld-section-inner">
        <div className="ld-tradicion-grid">
          <div>
            <span className="ld-eyebrow">La tradición</span>
            <h2 className="ld-h2">Una fiesta que nos une desde hace generaciones</h2>
            <p className="ld-lead">
              San Juan se celebra cada 24 de junio en honor a San Juan Bautista, y
              en Paraguay es mucho más que una fecha en el calendario: es el olor
              a leña, los pies descalzos sobre las brasas, las botellas que vuelan
              alto en el carrera vosa, y la familia entera afuera hasta la
              tardecita. Es cultura viva, y este año los padres del Sexto Grado
              del Colegio Torrefuerte la traemos de vuelta para nuestros chicos.
            </p>
            <Link to={TIENDA_PATH} className="ld-cta-inline">
              Sumate a la fiesta — comprá tu preventa →
            </Link>
          </div>
          <div className="ld-tradicion-visual">
            <img
              src="/img/flyer.jpg"
              alt="Flyer San Juan Dice Que Si"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

const JUEGOS_STANDS = [
  { icon:'🐷', grado:'1er Grado', t:'Reto de Puntería' },
  { icon:'🐔', grado:'2do Grado', t:'La gallinita de los huevos de oro' },
  { icon:'🌳', grado:'3er Grado', t:'El árbol de la suerte' },
  { icon:'🏃', grado:'4to Grado', t:'Karrera Vosá' },
  { icon:'🧠', grado:'5to Grado', t:'Mastermind' },
  { icon:'⛓️', grado:'6to Grado', t:'Cárcel y Sala de Videojuegos' },
  { icon:'🏀', grado:'7mo Grado', t:'Básquet' },
  { icon:'🫧', grado:'8vo Grado', t:'La burbuja gigante' },
  { icon:'⚽', grado:'9no Grado', t:'Metegol' },
  { icon:'💌', grado:'1er Año', t:'Casamiento Koygua y Correo del 💌' },
  { icon:'🎳', grado:'2do Año', t:'Bowling' },
  { icon:'🎯', grado:'3er Año', t:'Tiro al blanco' },
];

const JUEGOS_TIPICOS = [
  { icon:'🍯', t:'Kambuchi Jejoka', d:'Romper el cántaro de barro con los ojos vendados para ganar el premio escondido.' },
  { icon:'🍳', t:'Paila Jeherei', d:'Sacar con la boca la moneda de la paila enhollinada. Te ensuciás, pero vale la pena.' },
];

const JUEGOS_MODERNOS = [
  { icon:'🎈', t:'Globo Loco', d:'El inflable que pone a prueba el equilibrio de grandes y chicos.' },
];

function LandingJuegos() {
  return (
    <section className="ld-section ld-juegos" id="juegos">
      <div className="ld-section-inner" style={{position:'relative'}}>
        <span className="ld-eyebrow">Juegos San Juan 2026</span>
        <h2 className="ld-h2">Un stand de juegos por cada grado</h2>
        <p className="ld-lead">
          Cada curso del colegio arma su propio juego. Pasá por todos los stands,
          juntá premios y viví el San Juan como se debe.
        </p>
        <div className="ld-juegos-grid">
          {JUEGOS_STANDS.map(j => (
            <div className="ld-juego" key={j.grado}>
              <div className="ld-juego-icon">{j.icon}</div>
              <span className="ld-juego-grado">{j.grado}</span>
              <h4>{j.t}</h4>
            </div>
          ))}
        </div>

        <h3 className="ld-juegos-sub">Juegos típicos</h3>
        <p className="ld-lead">
          Los clásicos de siempre, los que no pueden faltar en ningún San Juan.
        </p>
        <div className="ld-juegos-grid">
          {JUEGOS_TIPICOS.map(j => (
            <div className="ld-juego" key={j.t}>
              <div className="ld-juego-icon">{j.icon}</div>
              <h4>{j.t}</h4>
              <p>{j.d}</p>
            </div>
          ))}
        </div>

        <h3 className="ld-juegos-sub">Y también algo más moderno</h3>
        <p className="ld-lead">
          No son típicos de San Juan, pero buenísimos para que los chicos
          se diviertan.
        </p>
        <div className="ld-juegos-grid">
          {JUEGOS_MODERNOS.map(j => (
            <div className="ld-juego" key={j.t}>
              <div className="ld-juego-icon">{j.icon}</div>
              <h4>{j.t}</h4>
              <p>{j.d}</p>
            </div>
          ))}
        </div>

        <div className="ld-juegos-cta">
          <Link to={TIENDA_PATH} className="ld-cta-inline">
            Llevá tu tarjeta de juegos en preventa →
          </Link>
        </div>
      </div>
    </section>
  );
}

function LandingComidas() {
  const [comidas, setComidas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProductos()
      .then(productos => setComidas(productos.filter(p => p.categoria === 'COMIDA')))
      .catch(() => setComidas([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="ld-section ld-comidas" id="comidas">
      <div className="ld-section-inner">
        <span className="ld-eyebrow">Comidas típicas</span>
        <h2 className="ld-h2">Sabores que solo se sienten en San Juan</h2>
        <p className="ld-lead">
          Toda la cocina paraguaya servida en plena fiesta. Reservá tu plato
          en preventa y evitá la cola el día del evento.
        </p>
        <div className="ld-comidas-grid">
          {comidas.map(c => {
            const tieneDesc = Number(c.precio_normal) > Number(c.precio_preventa);
            return (
              <div className="ld-comida" key={c.idproducto}>
                <div className="ld-comida-img">
                  <img
                    src={imgSrc(c)}
                    alt={c.titulo}
                    onError={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg,#FFCE00,#FF7F00)';
                      e.currentTarget.removeAttribute('src');
                    }}
                  />
                  {tieneDesc && <span className="ld-comida-tag">Preventa</span>}
                </div>
                <div className="ld-comida-body">
                  <h4>{c.titulo}</h4>
                  {c.descripcion && <p>{c.descripcion}</p>}
                  <div className="ld-comida-precio">
                    Gs. {fmtGs(c.precio_preventa)}
                    {tieneDesc && <small>Gs. {fmtGs(c.precio_normal)}</small>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {!loading && comidas.length === 0 && (
          <p className="ld-lead" style={{ textAlign: 'center' }}>
            Pronto vamos a publicar el menú completo. ¡Seguinos atentos!
          </p>
        )}
        <div className="ld-comidas-cta">
          <div className="ld-comidas-cta-text">
            <strong>En nuestra fiesta vas a poder disfrutar de todo esto y más</strong>
            <span>Hacé tu pedido por adelantado, pagá online y retirá el día del evento. Sin colas, con descuento.</span>
          </div>
          <Link to={TIENDA_PATH} className="ld-btn-primary">
            Hacé tu compra ahora →
          </Link>
        </div>
      </div>
    </section>
  );
}

function LandingInfo() {
  return (
    <section className="ld-section ld-info" id="info">
      <div className="ld-section-inner">
        <span className="ld-eyebrow">Cuándo & dónde</span>
        <h2 className="ld-h2">Toda la info que necesitás</h2>
        <div className="ld-info-grid">
          <div className="ld-info-card">
            <div className="ld-info-card-icon">📅</div>
            <h5>Fecha y hora</h5>
            <div className="ld-info-val">Sábado 6 de junio de 2026</div>
            <p className="ld-info-sub">Arrancamos a las 11:00 am. Almuerzo, comidas típicas y juegos para los chicos durante todo el día.</p>
          </div>
          <div className="ld-info-card">
            <div className="ld-info-card-icon">📍</div>
            <h5>Ubicación</h5>
            <div className="ld-info-val">Colegio Torrefuerte</div>
            <p className="ld-info-sub">Patio principal del colegio. Estacionamiento habilitado para padres y familias.</p>
            <a
              className="ld-maps-link"
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              📍 Cómo llegar →
            </a>
          </div>
          <div className="ld-info-card">
            <div className="ld-info-card-icon">💳</div>
            <h5>Pagos</h5>
            <div className="ld-info-val">Bancard, transferencia o efectivo</div>
            <p className="ld-info-sub">Preventa online con descuento. Mostrás el QR y retirás.</p>
          </div>
        </div>
        <div className="ld-map">
          <iframe
            title="Ubicación Colegio Torrefuerte"
            src={MAPS_EMBED_URL}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a
            className="ld-map-overlay"
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir en Google Maps →
          </a>
        </div>
      </div>
    </section>
  );
}

function LandingFinal() {
  return (
    <section className="ld-final">
      <div className="ld-final-inner">
        <h2>Nos vemos el 6 de junio</h2>
        <p>
          Reservá tu comida y tus tarjetas de juegos hasta el 5/06/2026 inclusive y
          aprovechá los precios de preventa. Toda la recaudación es para el
          viaje de fin de curso del 6° Grado — la cantidad es limitada.
        </p>
        <Link to={TIENDA_PATH} className="ld-btn-primary">
          Comprar mi preventa →
        </Link>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="ld-footer">
      <div className="ld-footer-brand">
        <span style={{
          width:24,height:24,borderRadius:'50%',background:'#FFCE00',color:'#0B2E55',
          display:'inline-flex',alignItems:'center',justifyContent:'center',
          fontSize:'.7rem',fontWeight:800,fontFamily:'Inter,system-ui,sans-serif'
        }}>SJ</span>
        San Juan Dice Que Si !!! · Colegio Torrefuerte · 6° Grado · 2026
      </div>
      <div className="ld-footer-links">
        <Link to="/tarjetas">Tarjetas</Link>
        <Link to="/expendio">Expendio</Link>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="ld">
      <LandingNav />
      <LandingHero />
      <LandingTradicion />
      <LandingJuegos />
      <LandingComidas />
      <LandingInfo />
      <LandingFinal />
      <LandingFooter />
    </div>
  );
}
