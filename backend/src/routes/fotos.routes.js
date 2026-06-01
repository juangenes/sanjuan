const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fotoModel = require('../models/foto.model');
const { authAdmin } = require('../middleware/auth');
const { notificarFotos } = require('../utils/rtsClient');

// ───────────────────────────────────────────────────────────────────────────
// AUTO FOTO — galería de fotos del evento (carrusel en TVs + descarga pública).
//
// El fotógrafo saca/elige la foto desde su celular en /fotos/admin (login admin),
// la recorta y le aplica el marco/logo de San Juan EN EL NAVEGADOR (canvas), y
// sube la imagen ya final. Por eso acá no procesamos imágenes: guardamos el
// archivo, insertamos la fila y avisamos al RTS para que el carrusel (/fotos/tv)
// y la galería (/fotos) se actualicen en vivo. La base es la fuente de verdad.
// ───────────────────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'fotos');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  // La imagen final (recorte + marco) ronda 1–3 MB; dejamos holgura.
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      return cb(new Error('Formato no permitido'));
    }
    cb(null, true);
  },
});

// GET /api/fotos?before=<id>&limit=<n> — público. Publicadas, DESC, paginado por
// cursor (scroll infinito de la galería). El carrusel pide un límite más alto.
router.get('/', async (req, res) => {
  try {
    const before = req.query.before ? Number(req.query.before) : null;
    const limit = req.query.limit ? Number(req.query.limit) : 24;
    const fotos = await fotoModel.listarPublicadas({ before, limit });
    res.json({ fotos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fotos/admin — todas, para el panel de moderación.
router.get('/admin', authAdmin, async (_req, res) => {
  try {
    const fotos = await fotoModel.listarTodas();
    res.json({ fotos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fotos — sube una foto ya recortada y con marco. Campo: `foto`.
router.post('/', authAdmin, (req, res) => {
  upload.single('foto')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
    try {
      const url = `/uploads/fotos/${req.file.filename}`;
      const marco = (req.body?.marco || '').slice(0, 40) || null;
      const id = await fotoModel.crear({ archivo: req.file.filename, url, marco });
      // Avisa al carrusel/galería que cayó una foto nueva (fire-and-forget).
      notificarFotos({ id, action: 'nueva' });
      res.status(201).json({ success: true, foto: { id, url, marco } });
    } catch (e) {
      // Si falló la inserción, no dejamos el archivo huérfano en disco.
      fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: e.message });
    }
  });
});

// PATCH /api/fotos/:id — moderación: publicar / ocultar.  { publicada: bool }
router.patch('/:id', authAdmin, async (req, res) => {
  try {
    const foto = await fotoModel.buscarPorId(req.params.id);
    if (!foto) return res.status(404).json({ error: 'Foto no encontrada' });
    await fotoModel.setPublicada(foto.id, !!req.body?.publicada);
    notificarFotos({ id: foto.id, action: 'moderada' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/fotos/:id — borra fila y archivo en disco.
router.delete('/:id', authAdmin, async (req, res) => {
  try {
    const foto = await fotoModel.buscarPorId(req.params.id);
    if (!foto) return res.status(404).json({ error: 'Foto no encontrada' });
    await fotoModel.eliminar(foto.id);
    fs.unlink(path.join(UPLOAD_DIR, foto.archivo), () => {}); // best-effort
    notificarFotos({ id: foto.id, action: 'borrada' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
