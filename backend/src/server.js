require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',      require('./routes/auth.routes'));
app.use('/api/productos', require('./routes/productos.routes'));
app.use('/api/pedidos',   require('./routes/pedidos.routes'));
app.use('/api/expendio',  require('./routes/expendio.routes'));
app.use('/api/tarjetas',  require('./routes/tarjetas.routes'));
app.use('/api/bancard',   require('./routes/bancard.routes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Sanjuan API corriendo en puerto ${PORT}`));
