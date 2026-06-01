require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { bootstrapUsuarios } = require('./utils/bootstrapUsuarios');
const { bootstrapPuestos } = require('./utils/bootstrapPuestos');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth',      require('./routes/auth.routes'));
app.use('/api/usuarios',  require('./routes/usuarios.routes'));
app.use('/api/productos', require('./routes/productos.routes'));
app.use('/api/pedidos',   require('./routes/pedidos.routes'));
app.use('/api/expendio',  require('./routes/expendio.routes'));
app.use('/api/caja',      require('./routes/caja.routes'));
app.use('/api/totem',     require('./routes/totem.routes'));
app.use('/api/tarjetas',  require('./routes/tarjetas.routes'));
app.use('/api/puestos',   require('./routes/puestos.routes'));
app.use('/api/bancard',   require('./routes/bancard.routes'));
app.use('/api/upload',    require('./routes/upload.routes'));
app.use('/api/fotos',     require('./routes/fotos.routes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Sanjuan API corriendo en puerto ${PORT}`);
  try {
    await bootstrapUsuarios();
  } catch (e) {
    console.error('[bootstrap] Error sembrando usuarios:', e.message);
  }
  try {
    await bootstrapPuestos();
  } catch (e) {
    console.error('[bootstrap] Error sembrando puestos:', e.message);
  }
});
