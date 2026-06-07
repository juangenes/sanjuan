import { Link } from 'react-router-dom';
import './Landing.css';

const FOTOS_PATH = '/fotos';

function LandingNav() {
  return (
    <nav className="ld-nav">
      <div className="ld-nav-brand">
        <span className="ld-nav-brand-mark">SJ</span>
        <span>San Juan Dice Que Si !!!</span>
      </div>
      <Link to={FOTOS_PATH} className="ld-nav-cta">
        Ver las fotos →
      </Link>
    </nav>
  );
}

function LandingHero() {
  return (
    <section className="ld-hero ld-hero-gracias">
      <div className="ld-hero-inner ld-hero-inner-gracias">
        <span className="ld-hero-tag">
          <span className="ld-hero-tag-dot" />
          San Juan 2026 · Colegio Torrefuerte
        </span>
        <h1>¡Gracias!</h1>
        <p className="ld-hero-sub ld-hero-sub-center">
          La fiesta terminó, pero nos quedan las comidas típicas, los juegos,
          las risas de los chicos y los encuentros entre familias. Gracias a
          cada uno que participó y apoyó esta iniciativa: la hicieron posible.
        </p>
        <div className="ld-hero-actions ld-hero-actions-center">
          <Link to={FOTOS_PATH} className="ld-btn-primary">
            Mirá las fotos del evento →
          </Link>
        </div>
      </div>
    </section>
  );
}

function LandingCarta() {
  return (
    <section className="ld-section ld-carta">
      <div className="ld-carta-inner">
        <span className="ld-eyebrow">Unas palabras</span>
        <h2 className="ld-h2">Por nuestras tradiciones</h2>
        <p className="ld-lead">
          San Juan es parte de quiénes somos, y nuestro objetivo fue simple:
          que esta tradición no se pierda y siga viva para los más chicos.
          Esta es una iniciativa del colegio, llevada adelante por los padres
          del 6° Grado — con mucho cariño y empeño, aunque no somos
          profesionales en organizar eventos.
        </p>
        <p className="ld-lead">
          Si algo no salió como esperabas, te pedimos disculpas con sinceridad.
          Pusimos lo mejor de nosotros y aprendimos en el camino. Lo importante
          es lo que vivimos juntos: una jornada de comunidad, de juegos y de
          tradición compartida en familia.
        </p>
        <p className="ld-carta-firma">
          Con gratitud,
          <span>Las familias del 6° Grado · Colegio Torrefuerte</span>
        </p>
      </div>
    </section>
  );
}

function LandingFinal() {
  return (
    <section className="ld-final">
      <div className="ld-final-inner">
        <h2>Hasta el próximo San Juan</h2>
        <p>
          Que la tradición siga encendida. Gracias por ser parte de esta fiesta
          — los esperamos el año que viene.
        </p>
        <Link to={FOTOS_PATH} className="ld-btn-primary">
          Revivir el evento en fotos →
        </Link>
      </div>
    </section>
  );
}

function LandingGrupal() {
  return (
    <section className="ld-grupal">
      <div className="ld-grupal-inner">
        <div className="ld-grupal-foto">
          <img
            src="/img/foto-grupal.jpg"
            alt="Comisión Organizadora San Juan 2026 - Colegio Torrefuerte"
            onError={(e) => { e.currentTarget.closest('.ld-grupal-foto').style.display = 'none'; }}
          />
        </div>
        <div className="ld-grupal-texto">
          <h2>¡GRACIAS TOTALES!</h2>
          <p>Comisión Organizadora · San Juan 2026 · Torrefuerte</p>
        </div>
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
        <Link to="/fotos">Fotos</Link>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="ld">
      <LandingNav />
      <LandingHero />
      <LandingCarta />
      <LandingFinal />
      <LandingGrupal />
      <LandingFooter />
    </div>
  );
}
