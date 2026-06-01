import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import {
  crearCertPedidoBancard, generarQrBancard, getEstadoBancard, revertirBancard,
} from '../../api';

// Pantalla interna de CERTIFICACIÓN Bancard (solo admin). Permite generar un QR
// de monto arbitrario y nombre arbitrario para correr los 4 escenarios que pide
// Bancard, mostrando el hook_alias en grande para reportarlo. Reusa la misma
// maquinaria real (POST /qr, GET /estado, POST /revertir) que producción.
//
//   1) Pago exitoso        → monto chico (ej. 1.000), pagar en la app de prueba.
//   2) Pago fallido        → monto alto (ej. 900.000.000), pagar → falla.
//   3) Confirmado sin proc. → nombre con "CERTFAIL", pagar → respondemos error.
//   4) QR cancelado        → generar y tocar "Revertir QR" sin pagar.

const fmtGs = (n) => Number(n || 0).toLocaleString('es-PY');

const ESCENARIOS = [
  { label: '1 · Éxito (Gs 1.000)', monto: 1000, nombre: 'CERT exito' },
  { label: '2 · Fallido (Gs 900.000.000)', monto: 900000000, nombre: 'CERT fallido' },
  { label: '3 · Confirmado sin procesar', monto: 1000, nombre: 'CERTFAIL prueba' },
  { label: '4 · QR a cancelar (revert)', monto: 1000, nombre: 'CERT revert' },
];

export default function CertBancard() {
  const navigate = useNavigate();
  const [monto, setMonto] = useState(1000);
  const [nombre, setNombre] = useState('CERT exito');
  const [activo, setActivo] = useState(null); // { hash, idpedido, hookAlias, qrData, monto, nombre }
  const [estado, setEstado] = useState(null); // { estado, pagado, bancard_status }
  const [historial, setHistorial] = useState([]); // tests previos (con su último estado)
  const [generando, setGenerando] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem('sanjuan_token')) navigate('/admin');
  }, [navigate]);

  // Polling del estado del test activo.
  useEffect(() => {
    if (!activo?.hash) return;
    let cancel = false;
    async function poll() {
      try {
        const r = await getEstadoBancard(activo.hash);
        if (!cancel) setEstado(r);
      } catch { /* reintenta */ }
      if (!cancel) pollRef.current = setTimeout(poll, 3000);
    }
    poll();
    return () => { cancel = true; clearTimeout(pollRef.current); };
  }, [activo?.hash]);

  async function generar() {
    if (generando) return;
    setGenerando(true);
    try {
      // Cierra el test anterior al historial con su último estado conocido.
      if (activo) {
        setHistorial(h => [{ ...activo, estadoFinal: estado }, ...h]);
      }
      setEstado(null);
      const pedido = await crearCertPedidoBancard(Number(monto), nombre);
      const qr = await generarQrBancard(pedido.hash);
      if (!qr.qr_data && !qr.hook_alias) throw new Error('Bancard no devolvió el QR');
      setActivo({
        hash: pedido.hash,
        idpedido: pedido.idpedido,
        hookAlias: qr.hook_alias,
        qrData: qr.qr_data,
        monto: pedido.total,
        nombre,
      });
      toast.success('QR generado');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error generando el QR');
    } finally {
      setGenerando(false);
    }
  }

  async function revertir() {
    if (!activo?.hash) return;
    try {
      const r = await revertirBancard(activo.hash);
      toast.success(`Revert enviado: ${r.reverse || 'ok'}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo revertir');
    }
  }

  function copiar(txt) {
    navigator.clipboard?.writeText(txt).then(
      () => toast.success('Copiado'),
      () => toast.error('No se pudo copiar')
    );
  }

  const badge = (e) => {
    const s = e?.pagado ? 'PAGADO' : (e?.bancard_status || e?.estado || '—');
    const color = e?.pagado ? '#0a7d2c'
      : e?.bancard_status === 'failed' ? '#b00020'
      : e?.bancard_status === 'reverted' || e?.bancard_status === 'revert_requested' ? '#8a6d00'
      : '#555';
    return <span style={{ fontWeight: 800, color }}>{s}</span>;
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#0B2E55' }}>🧪 Certificación Bancard (QR)</h1>
      <p style={{ color: '#666', marginTop: '-.4rem' }}>
        Herramienta interna para los 4 escenarios. El <strong>hook_alias</strong> es lo que hay que reportar a Bancard.
      </p>

      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: '1rem 0' }}>
        {ESCENARIOS.map(s => (
          <button key={s.label} onClick={() => { setMonto(s.monto); setNombre(s.nombre); }}
            style={{ padding: '.5rem .8rem', borderRadius: 10, border: '1.5px solid #0B2E55',
              background: '#fff', color: '#0B2E55', cursor: 'pointer', fontWeight: 700, fontSize: '.85rem' }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: '.8rem', color: '#0B2E55' }}>Monto (Gs)</div>
          <input type="number" value={monto} onChange={e => setMonto(e.target.value)}
            style={{ width: '100%', padding: '.6rem', borderRadius: 10, border: '1.5px solid #ccc', fontSize: '1rem' }} />
        </label>
        <label style={{ flex: 2, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: '.8rem', color: '#0B2E55' }}>Nombre (usar "CERTFAIL" para escenario 3)</div>
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            style={{ width: '100%', padding: '.6rem', borderRadius: 10, border: '1.5px solid #ccc', fontSize: '1rem' }} />
        </label>
        <button onClick={generar} disabled={generando}
          style={{ padding: '.7rem 1.2rem', borderRadius: 10, border: 'none', background: '#0B2E55',
            color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '1rem' }}>
          {generando ? 'Generando…' : 'Generar QR'}
        </button>
      </div>

      {activo && (
        <div style={{ marginTop: '1.5rem', padding: '1.2rem', borderRadius: 14, border: '2px solid #0B2E55',
          background: '#f7f9fc', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0B2E55' }}>Gs. {fmtGs(activo.monto)}</div>
          <div style={{ color: '#666', fontSize: '.85rem', marginBottom: '.6rem' }}>{activo.nombre}</div>
          {activo.qrData
            ? <div style={{ background: '#fff', display: 'inline-block', padding: 12, borderRadius: 12 }}>
                <QRCodeSVG value={activo.qrData} size={240} />
              </div>
            : <div style={{ color: '#b00020' }}>Sin qr_data (¿reusó un QR previo?)</div>}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '.8rem', color: '#666' }}>hook_alias (reportar a Bancard)</div>
            <button onClick={() => copiar(activo.hookAlias || '')}
              style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0B2E55', background: '#fff8e1',
                border: '2px dashed #f0a500', borderRadius: 10, padding: '.4rem 1rem', cursor: 'pointer' }}>
              {activo.hookAlias || '—'} 📋
            </button>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '1.05rem' }}>Estado: {badge(estado)}</div>
          <button onClick={revertir}
            style={{ marginTop: '1rem', padding: '.6rem 1.2rem', borderRadius: 10, border: '1.5px solid #b00020',
              background: '#fff', color: '#b00020', fontWeight: 800, cursor: 'pointer' }}>
            ✕ Revertir QR (escenario 4)
          </button>
        </div>
      )}

      {historial.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#0B2E55' }}>Historial de pruebas</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '.4rem' }}>hook_alias</th><th>Monto</th><th>Nombre</th><th>Estado final</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '.4rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => copiar(t.hookAlias || '')}>{t.hookAlias || '—'} 📋</td>
                  <td>Gs. {fmtGs(t.monto)}</td>
                  <td>{t.nombre}</td>
                  <td>{badge(t.estadoFinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
