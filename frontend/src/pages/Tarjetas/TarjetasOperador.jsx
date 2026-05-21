import { useState } from 'react';
import { login } from '../../api';
import JuegosPanel from '../Juegos/JuegosPanel';
import toast from 'react-hot-toast';
import styles from '../Admin/Admin.module.css';

const ROLES_PERMITIDOS = ['admin', 'tarjetas'];

export default function TarjetasOperador() {
  const [autenticado, setAutenticado] = useState(!!localStorage.getItem('sanjuan_token'));
  const [form, setForm] = useState({ usuario: '', password: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, rol } = await login(form.usuario, form.password);
      if (!ROLES_PERMITIDOS.includes(rol)) {
        toast.error('Este usuario no tiene acceso a Tarjetas');
        return;
      }
      localStorage.setItem('sanjuan_token', token);
      localStorage.setItem('sanjuan_rol', rol);
      setAutenticado(true);
    } catch {
      toast.error('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  }

  function salir() {
    localStorage.clear();
    setForm({ usuario: '', password: '' });
    setAutenticado(false);
  }

  if (autenticado) return <JuegosPanel onSalir={salir} />;

  return (
    <div className={styles.loginPagina}>
      <div className={styles.loginCard}>
        <h1>💳</h1>
        <h2>Tarjetas</h2>
        <form onSubmit={handleSubmit}>
          <input placeholder="Usuario" value={form.usuario} onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))} required />
          <input type="password" placeholder="Contraseña" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <button type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
      </div>
    </div>
  );
}
