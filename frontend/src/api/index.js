import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Evita que una request colgada (p. ej. un lock en la base) deje la UI en
  // "Procesando..." para siempre: a los 20s falla y el modal muestra el error.
  timeout: 20000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('sanjuan_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Productos
export const getProductos = () => api.get('/productos').then(r => r.data.productos);

// Pedidos
export const crearPedido = (datos) => api.post('/pedidos', datos).then(r => r.data);
export const getPedido = (hash) => api.get(`/pedidos/${hash}`).then(r => r.data.pedido);

// Auth
export const login = (usuario, password) =>
  api.post('/auth/login', { usuario, password }).then(r => r.data);

// Admin
export const getPedidosAdmin = () => api.get('/pedidos').then(r => r.data.pedidos);
export const marcarPagado = (id) => api.post(`/pedidos/${id}/pagar`).then(r => r.data);
export const actualizarPedido = (id, datos) => api.put(`/pedidos/${id}`, datos).then(r => r.data);
export const cambiarEstadoPedido = (id, estado) => api.post(`/pedidos/${id}/estado`, { estado }).then(r => r.data);
export const getResumen = () => api.get('/pedidos/admin/resumen').then(r => r.data);
export const getVentasPorProducto = (desde, hasta) =>
  api.get('/pedidos/admin/ventas-producto', { params: { desde, hasta } }).then(r => r.data);
export const getProductosAdmin = () => api.get('/productos/admin').then(r => r.data.productos);
export const crearProducto = (datos) => api.post('/productos', datos).then(r => r.data);
export const actualizarProducto = (id, datos) => api.put(`/productos/${id}`, datos).then(r => r.data);
export const eliminarProducto = (id) => api.delete(`/productos/${id}`).then(r => r.data);
export const subirImagenProducto = (file) => {
  const fd = new FormData();
  fd.append('imagen', file);
  return api.post('/upload/producto', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then(r => r.data);
};

// Expendio
export const getPedidosExpendio = () => api.get('/expendio/pedidos').then(r => r.data.pedidos);
export const getPedidoExpendio = (hash) => api.get(`/expendio/pedido/${hash}`).then(r => r.data.pedido);
export const registrarEntrega = (hash, items) => api.post('/expendio/entregar', { hash, items }).then(r => r.data);
export const getBoleta = (hash, idot) => api.get(`/expendio/boleta/${hash}/${idot}`).then(r => r.data.boleta);
export const getHistorialExpendio = (hash) => api.get(`/expendio/historial/${hash}`).then(r => r.data.historial);

// RETIRO (pantalla única que imprime/cuelga las comandas)
export const getColaRetiro = () => api.get('/expendio/cola-retiro').then(r => r.data.cola);
export const marcarComandaImpresa = (id) => api.post(`/expendio/comanda/${id}/impresa`).then(r => r.data);

// Caja (POS físico) — toma un pedido nuevo, lo cobra y lo deja PAGADO
export const tomarPedidoCaja = (payload) => api.post('/caja/pedido', payload).then(r => r.data.pedido);

// Caja con pago por QR de Bancard — crea el pedido PENDIENTE (precio normal,
// método INFONET) y devuelve su hash para generar el QR; lo confirma el callback.
export const tomarPedidoCajaQr = (payload) => api.post('/caja/pedido-qr', payload).then(r => r.data.pedido);

// Lector (celular) → caja: manda una lectura escaneada a una caja (1..5).
export const registrarLecturaCaja = (caja, codigo) =>
  api.post('/caja/lectura', { caja, codigo }).then(r => r.data.lectura);
// Lecturas pendientes de una caja (las levanta la pantalla de caja).
export const getLecturasCaja = (caja) =>
  api.get('/caja/lecturas', { params: { caja } }).then(r => r.data.lecturas);
// Marca una lectura como atendida ('ATENDIDA') o descartada ('DESCARTADA').
export const atenderLecturaCaja = (id, estado) =>
  api.post(`/caja/lectura/${id}/atendida`, { estado }).then(r => r.data);

// Tótem autoservicio — crea un pedido PENDIENTE (precio normal, pago QR Bancard)
export const crearPedidoTotem = (payload) => api.post('/totem/pedido', payload).then(r => r.data.pedido);

// Retiros públicos (cliente)
export const getRetirosPedido = (hash) => api.get(`/pedidos/${hash}/retiros`).then(r => r.data.retiros);

// AUTORETIRO — el cliente (o el tótem) dispara a RETIRO los ítems que elige.
// items: [{ idproducto, cantidad }]. Seguridad por hash.
export const prepararPedido = (hash, items) =>
  api.post(`/pedidos/${hash}/preparar`, { items }).then(r => r.data);

// Config pública del front (dia_d habilita el autoretiro del cliente/tótem).
export const getConfig = () => api.get('/config').then(r => r.data);
// Admin — ver/editar la configuración operativa (pantalla /admin/configuracion).
export const getConfigAdmin = () => api.get('/config/admin').then(r => r.data.config);
export const guardarConfig = (clave, valor) => api.put('/config', { clave, valor }).then(r => r.data);

// Tarjetas
export const getSaldo = (codigo) => api.get(`/tarjetas/${codigo}/saldo`).then(r => r.data);
export const consumirCredito = (codigo, idpuesto) => api.post('/tarjetas/consumir', { codigo, idpuesto }).then(r => r.data);
export const cargarCredito = (codigo, cantidad, valor_unitario) =>
  api.post('/tarjetas/cargar', { codigo, cantidad, valor_unitario }).then(r => r.data);
// Acreditación contra pedido pagado
export const getCreditosPendientes = () => api.get('/tarjetas/pendientes').then(r => r.data.pedidos);
export const dispensarCreditos = (hash, codigo, cantidad) =>
  api.post('/tarjetas/dispensar', { hash, codigo, cantidad }).then(r => r.data);

// Puestos
export const getPuestos = () => api.get('/puestos').then(r => r.data.puestos);
export const getPuestosAdmin = () => api.get('/puestos/admin').then(r => r.data.puestos);
export const crearPuesto = (datos) => api.post('/puestos', datos).then(r => r.data);
export const actualizarPuesto = (id, datos) => api.put(`/puestos/${id}`, datos).then(r => r.data);
export const eliminarPuesto = (id) => api.delete(`/puestos/${id}`).then(r => r.data);

// Bancard mock
export const iniciarPago = (hash) => api.post('/bancard/iniciar', { hash }).then(r => r.data);
export const confirmarPagoMock = (hash) => api.post('/bancard/confirmar-mock', { hash }).then(r => r.data);

// Bancard QR (Infonet)
export const generarQrBancard = (hash) => api.post('/bancard/qr', { hash }).then(r => r.data);
export const getEstadoBancard = (hash) => api.get(`/bancard/estado/${hash}`).then(r => r.data);
export const revertirBancard = (hash) => api.post('/bancard/revertir', { hash }).then(r => r.data);

// Recuerdos San Juan — galería de fotos del evento. params: { before, limit }
export const getFotos = (params) => api.get('/fotos', { params }).then(r => r.data.fotos);
export const getFotosAdmin = () => api.get('/fotos/admin').then(r => r.data.fotos);
export const subirFoto = (blob, marco) => {
  const fd = new FormData();
  fd.append('foto', blob, `sanjuan-${Date.now()}.jpg`);
  if (marco) fd.append('marco', marco);
  return api.post('/fotos', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then(r => r.data.foto);
};
export const moderarFoto = (id, publicada) =>
  api.patch(`/fotos/${id}`, { publicada }).then(r => r.data);
export const eliminarFoto = (id) => api.delete(`/fotos/${id}`).then(r => r.data);

// Usuarios
export const getUsuarios = () => api.get('/usuarios').then(r => r.data.usuarios);
export const crearUsuario = (datos) => api.post('/usuarios', datos).then(r => r.data);
export const actualizarUsuario = (id, datos) => api.put(`/usuarios/${id}`, datos).then(r => r.data);
export const resetPasswordUsuario = (id, password) =>
  api.put(`/usuarios/${id}/password`, { password }).then(r => r.data);
export const eliminarUsuario = (id) => api.delete(`/usuarios/${id}`).then(r => r.data);
export const cambiarMiPassword = (actual, nueva) =>
  api.put('/usuarios/me/password', { actual, nueva }).then(r => r.data);

export default api;
