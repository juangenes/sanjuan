// Marcos de Recuerdos San Juan — se dibujan por código sobre la foto recortada (canvas),
// sin imágenes externas, así quedan nítidos a cualquier resolución. Cada marco
// expone draw(ctx, w, h) y se "hornea" en la foto antes de subirla.
//
// La foto se exporta SIEMPRE en 4:5 (vertical, estilo red social) y se ve muy
// bien centrada en el carrusel de TV sobre un fondo desenfocado.

export const OUTPUT_W = 1080;
export const OUTPUT_H = 1350;

const ORO = '#ffd166';
const FUEGO = '#ff5722';
const ROJO = '#e63946';

// Texto con sombra para que se lea sobre cualquier foto.
function texto(ctx, str, x, y, { size, weight = 900, color = '#fff', align = 'center', font = 'Arial, sans-serif', spacing = 0 } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.25;
  ctx.shadowOffsetY = size * 0.04;
  ctx.fillStyle = color;
  if (spacing && align === 'center') {
    // Espaciado entre letras (canvas no soporta letter-spacing nativo).
    const total = str.split('').reduce((a, ch) => a + ctx.measureText(ch).width + spacing, -spacing);
    let cx = x - total / 2;
    ctx.textAlign = 'left';
    for (const ch of str) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
  } else {
    ctx.fillText(str, x, y);
  }
  ctx.restore();
}

// Degradé inferior para apoyar texto sobre la foto.
function scrimInferior(ctx, w, h, alto = 0.34) {
  const g = ctx.createLinearGradient(0, h * (1 - alto), 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h * (1 - alto), w, h * alto);
}

export const MARCOS = [
  {
    key: 'clasico',
    label: '🔥 Clásico',
    draw(ctx, w, h) {
      scrimInferior(ctx, w, h, 0.36);
      // Borde fino interior.
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.round(w * 0.008);
      const m = Math.round(w * 0.035);
      ctx.strokeRect(m, m, w - m * 2, h - m * 2);
      ctx.restore();
      texto(ctx, 'RECUERDO DEL', w / 2, h - 180, { size: 40, weight: 800, color: '#ffe7b3', spacing: 8 });
      texto(ctx, 'SAN JUAN', w / 2, h - 92, { size: 108, color: ORO, spacing: 6 });
      texto(ctx, 'Torrefuerte 2026', w / 2, h - 36, { size: 48, weight: 700, color: '#fff', spacing: 2 });
    },
  },
  {
    key: 'fuego',
    label: '🔥 Fuego',
    draw(ctx, w, h) {
      // Marco con degradé de fuego.
      ctx.save();
      const borde = Math.round(w * 0.045);
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, ROJO);
      g.addColorStop(0.5, FUEGO);
      g.addColorStop(1, ORO);
      ctx.lineWidth = borde;
      ctx.strokeStyle = g;
      ctx.strokeRect(borde / 2, borde / 2, w - borde, h - borde);
      ctx.restore();
      scrimInferior(ctx, w, h, 0.32);
      texto(ctx, 'RECUERDO DEL SAN JUAN', w / 2, h - 104, { size: 44, weight: 800, color: '#ffe7b3', spacing: 3 });
      texto(ctx, 'TORREFUERTE 2026', w / 2, h - 42, { size: 66, color: '#fff', spacing: 3 });
    },
  },
  {
    key: 'polaroid',
    label: '📸 Polaroid',
    draw(ctx, w, h) {
      // Borde blanco tipo polaroid (más grueso abajo). Nota: el recorte ya deja
      // la foto centrada; este marco pinta el margen encima del borde.
      ctx.save();
      ctx.fillStyle = '#fff';
      const lado = Math.round(w * 0.04);
      const abajo = Math.round(h * 0.14);
      ctx.fillRect(0, 0, w, lado);          // arriba
      ctx.fillRect(0, 0, lado, h);          // izquierda
      ctx.fillRect(w - lado, 0, lado, h);   // derecha
      ctx.fillRect(0, h - abajo, w, abajo); // abajo (banda ancha)
      const cy = h - abajo / 2;
      texto(ctx, 'Recuerdo del San Juan', w / 2, cy - 6, {
        size: 46, weight: 700, color: '#c2410c', font: '"Segoe Script", "Comic Sans MS", cursive',
      });
      texto(ctx, 'Torrefuerte 2026', w / 2, cy + 52, {
        size: 46, weight: 700, color: '#c2410c', font: '"Segoe Script", "Comic Sans MS", cursive',
      });
      ctx.restore();
    },
  },
  {
    key: 'cinta',
    label: '🎗 Cinta',
    draw(ctx, w, h) {
      // Cinta diagonal arriba-izquierda.
      ctx.save();
      ctx.translate(-w * 0.02, h * 0.06);
      ctx.rotate(-Math.PI / 4);
      const g = ctx.createLinearGradient(-w * 0.3, 0, w * 0.3, 0);
      g.addColorStop(0, ROJO);
      g.addColorStop(1, FUEGO);
      ctx.fillStyle = g;
      ctx.fillRect(-w * 0.3, -38, w * 0.6, 76);
      ctx.restore();
      texto(ctx, 'TORREFUERTE 2026', w * 0.155, h * 0.135, { size: 27, color: '#fff', spacing: 1 });
      // Recuerdo abajo a la derecha.
      texto(ctx, '🔥 Recuerdo del San Juan Torrefuerte 2026', w - 24, h - 28, { size: 30, weight: 700, color: '#fff', align: 'right' });
    },
  },
];

export const MARCO_DEFAULT = MARCOS[0].key;
export const getMarco = (key) => MARCOS.find(m => m.key === key) || MARCOS[0];
