import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CarritoProvider } from './context/CarritoContext';

import Landing from './pages/Landing/Landing';
import Sorteo from './pages/Sorteo/Sorteo';
import Tienda from './pages/Tienda/Tienda';
import Confirmacion from './pages/Tienda/Confirmacion';
import PagoMock from './pages/Tienda/PagoMock';
import AdminLogin from './pages/Admin/AdminLogin';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminPedidos from './pages/Admin/AdminPedidos';
import AdminProductos from './pages/Admin/AdminProductos';
import AdminUsuarios from './pages/Admin/AdminUsuarios';
import AdminVentasProducto from './pages/Admin/AdminVentasProducto';
import AdminPuestos from './pages/Admin/AdminPuestos';
import ExpendioLogin from './pages/Expendio/ExpendioLogin';
import ExpendioPanel from './pages/Expendio/ExpendioPanel';
import ExpendioBoleta from './pages/Expendio/ExpendioBoleta';
import ExpendioScan from './pages/Expendio/ExpendioScan';
import ExpendioEstacion from './pages/Expendio/ExpendioEstacion';
import CajaLogin from './pages/Caja/CajaLogin';
import CajaPanel from './pages/Caja/CajaPanel';
import TotemPanel from './pages/Totem/TotemPanel';
import TarjetasOperador from './pages/Tarjetas/TarjetasOperador';
import TarjetasPanel from './pages/Tarjetas/TarjetasPanel';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <CarritoProvider>
        <Routes>
          {/* Público (cliente / stands) */}
          <Route path="/" element={<Landing />} />
          <Route path="/sorteo" element={<Sorteo />} />
          <Route path="/tienda" element={<Tienda />} />
          <Route path="/pedido/:hash" element={<Confirmacion />} />
          <Route path="/pago/mock" element={<PagoMock />} />

          {/* Tarjetas — operador (login propio: leer tarjeta, ver saldo, cargar) */}
          <Route path="/tarjetas" element={<TarjetasOperador />} />
          {/* Consumo por puesto — abierto a los stands, por URL de puesto (/tarjetas/6a) */}
          <Route path="/tarjetas/:codigo" element={<TarjetasPanel />} />

          {/* Expendio — acceso propio */}
          <Route path="/expendio" element={<ExpendioLogin />} />
          <Route path="/expendio/panel" element={<ExpendioPanel />} />
          <Route path="/expendio/boleta/:hash/:idot" element={<ExpendioBoleta />} />
          <Route path="/expendio/scan" element={<ExpendioScan />} />
          <Route path="/expendio/estacion/:estacion" element={<ExpendioEstacion />} />

          {/* Caja — POS físico (cobro/confirmación) */}
          <Route path="/caja" element={<CajaLogin />} />
          <Route path="/caja/panel" element={<CajaPanel />} />

          {/* Tótem — autoservicio (pantalla táctil, pago con QR Bancard) */}
          <Route path="/totem" element={<TotemPanel />} />

          {/* Admin — oculto, se entra tecleando /admin (sin links en ninguna página) */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/pedidos" element={<AdminPedidos />} />
          <Route path="/admin/productos" element={<AdminProductos />} />
          <Route path="/admin/usuarios" element={<AdminUsuarios />} />
          <Route path="/admin/puestos" element={<AdminPuestos />} />
          <Route path="/admin/ventas-producto" element={<AdminVentasProducto />} />

          {/* Redirects desde rutas viejas (Organización / juegos) */}
          <Route path="/organizacion/expendio/*" element={<Navigate to="/expendio/panel" replace />} />
          <Route path="/organizacion/expendio" element={<Navigate to="/expendio" replace />} />
          <Route path="/organizacion/carga" element={<Navigate to="/tarjetas" replace />} />
          <Route path="/organizacion/administracion/pedidos" element={<Navigate to="/admin/pedidos" replace />} />
          <Route path="/organizacion/administracion/productos" element={<Navigate to="/admin/productos" replace />} />
          <Route path="/organizacion/administracion/usuarios" element={<Navigate to="/admin/usuarios" replace />} />
          <Route path="/organizacion/administracion/puestos" element={<Navigate to="/admin/puestos" replace />} />
          <Route path="/organizacion/administracion/ventas-producto" element={<Navigate to="/admin/ventas-producto" replace />} />
          <Route path="/organizacion/*" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/organizacion" element={<Navigate to="/admin" replace />} />
          <Route path="/juegos" element={<Navigate to="/tarjetas" replace />} />
        </Routes>
      </CarritoProvider>
    </BrowserRouter>
  );
}
