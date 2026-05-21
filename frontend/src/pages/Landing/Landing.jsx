import { Link } from 'react-router-dom';
import './Landing.css';

const TIENDA_PATH = '/tienda';

function LandingNav() {
  return (
    <nav className="ld-nav">
      <div className="ld-nav-brand">
        <span className="ld-nav-brand-mark">SJ</span>
        <span>San Juan Dice Que Si !!!</span>
      </div>
      <div className="ld-nav-links">
        <a href="#tradicion">La tradición</a>
        <a href="#juegos">Juegos típicos</a>
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
            Una noche de fogata, mbeju recién hecho, asaditos al carbón y los
            juegos de siempre. Como cuando éramos chicos — pero ahora con
            preventa online y sin filas.
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
            <div className="ld-hero-poster-bot">Comida · Juegos · Fogata · Música en vivo</div>
            <div className="ld-hero-badge bg-1">
              <span className="num">−20%</span>
              <span className="lbl">Preventa</span>
            </div>
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
              src="/img/sjdicequesi.jpg"
              alt="Fiesta de San Juan"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="ld-tradicion-overlay">"Lo bueno se vive,<br/>se comparte y se come"</div>
          </div>
        </div>
      </div>
    </section>
  );
}

const JUEGOS = [
  { icon:'🔥', t:'Pelota Tatá', d:'La pelota envuelta en trapos y kerosene que vuela encendida en la noche.' },
  { icon:'🎯', t:'Tata Ári Jehasa', d:'Caminar descalzo sobre las brasas. Solo para los más valientes.' },
  { icon:'🏃', t:'Carrera Vosá', d:'Carrera con bolsa hasta la meta. Caídas garantizadas, risas también.' },
  { icon:'🪙', t:'Yvyra Sỹi', d:'Subir el palo enjabonado para alcanzar el premio. Se puede en grupo.' },
  { icon:'🐸', t:'Sapo', d:'Tirar la moneda en la boca del sapo de bronce. Clásico de clásicos.' },
  { icon:'🎲', t:'Argollas', d:'Encestar las argollas en las botellas. Suena fácil. No lo es.' },
  { icon:'⛳', t:'Tiro al Blanco', d:'Apuntá, disparás, ganás. Premios para los mejores.' },
  { icon:'🔔', t:'Toro Candil', d:'El toro de cuernos encendidos persigue a los más rápidos.' },
];

function LandingJuegos() {
  return (
    <section className="ld-section ld-juegos" id="juegos">
      <div className="ld-section-inner" style={{position:'relative'}}>
        <span className="ld-eyebrow">Juegos típicos</span>
        <h2 className="ld-h2">Lo que vas a vivir ese día</h2>
        <p className="ld-lead">
          Los juegos de siempre, los que nuestros abuelos jugaban en sus
          San Juanes. Para chicos, grandes y nostálgicos.
        </p>
        <div className="ld-juegos-grid">
          {JUEGOS.map(j => (
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

const COMIDAS = [
  { img:'/img/asadito_carne.jpg', t:'Asadito de Carne', d:'Brochette al carbón con yopará y mandioca', precio:'25.000', old:'30.000' },
  { img:'/img/empanada.jpg',      t:'Empanadas Criollas', d:'Fritas, hechas al momento, masa de la abuela', precio:'8.000', old:'10.000' },
  { img:'/img/mbeju.jpg',         t:'Mbeju', d:'Hecho al instante en sartén caliente', precio:'10.000', old:'12.000' },
  { img:'/img/choripan.jpg',      t:'Choripán', d:'Con chimichurri casero', precio:'20.000', old:'22.000' },
  { img:'/img/pajagua.jpg',       t:'Pajagua Mascada', d:'Tortilla de mandioca con carne molida', precio:'12.000' },
  { img:'/img/vori.jpg',          t:'Vorí Vorí', d:'Caldo caliente con bolitas de maíz, ideal para la noche fría', precio:'15.000' },
];

function LandingComidas() {
  return (
    <section className="ld-section ld-comidas" id="comidas">
      <div className="ld-section-inner">
        <span className="ld-eyebrow">Comidas típicas</span>
        <h2 className="ld-h2">Sabores que solo se sienten en San Juan</h2>
        <p className="ld-lead">
          Toda la cocina paraguaya servida bajo las estrellas. Reservá tu plato
          en preventa y evitá la cola la noche del evento.
        </p>
        <div className="ld-comidas-grid">
          {COMIDAS.map(c => (
            <div className="ld-comida" key={c.t}>
              <div className="ld-comida-img">
                <img
                  src={c.img}
                  alt={c.t}
                  onError={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg,#FFCE00,#FF7F00)';
                    e.currentTarget.removeAttribute('src');
                  }}
                />
                {c.old && <span className="ld-comida-tag">Preventa</span>}
              </div>
              <div className="ld-comida-body">
                <h4>{c.t}</h4>
                <p>{c.d}</p>
                <div className="ld-comida-precio">
                  Gs. {c.precio}
                  {c.old && <small>Gs. {c.old}</small>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="ld-comidas-cta">
          <div className="ld-comidas-cta-text">
            <strong>En nuestra fiesta vas a poder disfrutar de todo esto y más</strong>
            <span>Hacé tu pedido por adelantado, pagá online y retirá la noche del evento. Sin colas, con descuento.</span>
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
            <p className="ld-info-sub">Desde las 11:00 am. Almuerzo, juegos para los chicos, fogata al caer el sol.</p>
          </div>
          <div className="ld-info-card">
            <div className="ld-info-card-icon">📍</div>
            <h5>Ubicación</h5>
            <div className="ld-info-val">Colegio Torrefuerte</div>
            <p className="ld-info-sub">Patio principal del colegio. Estacionamiento habilitado para padres y familias.</p>
          </div>
          <div className="ld-info-card">
            <div className="ld-info-card-icon">💳</div>
            <h5>Pagos</h5>
            <div className="ld-info-val">Bancard, transferencia o efectivo</div>
            <p className="ld-info-sub">Preventa online con descuento. Mostrás el QR y retirás.</p>
          </div>
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
          Reservá tu comida y tus tarjetas de juegos antes del 4 de junio y
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
