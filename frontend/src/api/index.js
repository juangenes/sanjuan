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

// Caja (POS físico) — toma un pedido nuevo, lo cobra y lo deja PAGADO
export const tomarPedidoCaja = (payload) => api.post('/caja/pedido', payload).then(r => r.data.pedido);

// Retiros públicos (cliente)
export const getRetirosPedido = (hash) => api.get(`/pedidos/${hash}/retiros`).then(r => r.data.retiros);

// Tarjetas
export const getSaldo = (codigo) => api.get(`/tarjetas/${codigo}/saldo`).then(r => r.data);
export const consumirCredito = (codigo, idpuesto) => api.post('/tarjetas/consumir', { codigo, idpuesto }).then(r => r.data);
export const cargarCredito = (codigo, cantidad, valor_unitario) =>
  api.post('/tarjetas/cargar', { codigo, cantidad, valor_unitario }).then(r => r.data);

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
