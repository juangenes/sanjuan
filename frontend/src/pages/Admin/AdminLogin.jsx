import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api';
import toast from 'react-hot-toast';
import styles from './Admin.module.css';

export default function AdminLogin() {
  const [form, setForm] = useState({ usuario: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, rol } = await login(form.usuario, form.password);
      localStorage.setItem('sanjuan_token', token);
      localStorage.setItem('sanjuan_rol', rol);
      navigate(rol === 'expendio' ? '/expendio/panel' : '/admin/dashboard');
    } catch {
      toast.error('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginPagina}>
      <div className={styles.loginCard}>
        <h1>San Juan</h1>
        <h2>Panel de Administración</h2>
        <form onSubmit={handleSubmit}>
          <input placeholder="Usuario" value={form.usuario} onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))} required />
          <input type="password" placeholder="Contraseña" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <button type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
      </div>
    </div>
  );
}
