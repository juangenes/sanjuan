import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
export const getResumen = () => api.get('/pedidos/admin/resumen').then(r => r.data);
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

// Retiros públicos (cliente)
export const getRetirosPedido = (hash) => api.get(`/pedidos/${hash}/retiros`).then(r => r.data.retiros);

// Tarjetas
export const getSaldo = (codigo) => api.get(`/tarjetas/${codigo}/saldo`).then(r => r.data);
export const consumirCredito = (codigo, idpuesto) => api.post('/tarjetas/consumir', { codigo, idpuesto }).then(r => r.data);
export const cargarCredito = (codigo, cantidad, valor_unitario) =>
  api.post('/tarjetas/cargar', { codigo, cantidad, valor_unitario }).then(r => r.data);

// Bancard mock
export const iniciarPago = (hash) => api.post('/bancard/iniciar', { hash }).then(r => r.data);
export const confirmarPagoMock = (hash) => api.post('/bancard/confirmar-mock', { hash }).then(r => r.data);

export default api;
