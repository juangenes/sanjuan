import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CarritoProvider } from './context/CarritoContext';

import Tienda from './pages/Tienda/Tienda';
import Confirmacion from './pages/Tienda/Confirmacion';
import PagoMock from './pages/Tienda/PagoMock';
import AdminLogin from './pages/Admin/AdminLogin';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminPedidos from './pages/Admin/AdminPedidos';
import AdminProductos from './pages/Admin/AdminProductos';
import ExpendioLogin from './pages/Expendio/ExpendioLogin';
import ExpendioPanel from './pages/Expendio/ExpendioPanel';
import TarjetasPanel from './pages/Tarjetas/TarjetasPanel';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <CarritoProvider>
        <Routes>
          <Route path="/" element={<Tienda />} />
          <Route path="/pedido/:hash" element={<Confirmacion />} />
          <Route path="/pago/mock" element={<PagoMock />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/pedidos" element={<AdminPedidos />} />
          <Route path="/admin/productos" element={<AdminProductos />} />
          <Route path="/expendio" element={<ExpendioLogin />} />
          <Route path="/expendio/panel" element={<ExpendioPanel />} />
          <Route path="/tarjetas" element={<TarjetasPanel />} />
        </Routes>
      </CarritoProvider>
    </BrowserRouter>
  );
}
