// Cliente del servicio "Ventas QR - API para Comercios" de Bancard/Infonet.
//
// Tres operaciones (ver docs/PRYAPC-Qr en API de Comercios v1.2):
//   1) generarQr  -> POST   .../selling/generate-qr-express   (obligatorio)
//   2) revertir   -> PUT    .../selling/payments/revert/:hook_alias  (obligatorio)
//   3) callback   <- Bancard nos notifica el pago (se maneja en las rutas)
//
// Autenticación: Basic Access Authentication con
//   base64( "apps/" + CLAVE_PUBLICA + ":" + CLAVE_PRIVADA )
//
// El ambiente de pruebas corre en https://desa.infonet.com.py:8035 con un
// certificado que puede no validar contra las CAs del sistema; por eso el TLS
// es configurable vía BANCARD_INSECURE_TLS (sólo para sandbox).

const https = require('node:https');
const { URL } = require('node:url');

function cfg() {
  const baseUrl = (
    process.env.BANCARD_BASE_URL ||
    'https://desa.infonet.com.py:8035/external-commerce/api/0.1'
  ).replace(/\/+$/, '');
  return {
    baseUrl,
    commerceCode: process.env.BANCARD_COMMERCE_CODE || '270020',
    branchCode: process.env.BANCARD_BRANCH_CODE || '2',
    publicKey: process.env.BANCARD_PUBLIC_KEY || '',
    privateKey: process.env.BANCARD_PRIVATE_KEY || '',
    // En sandbox el cert del servidor de desa suele no validar: lo permitimos
    // explícitamente. En producción debe quedar en false (o sin definir).
    insecureTls: String(process.env.BANCARD_INSECURE_TLS).toLowerCase() === 'true',
  };
}

// Header Authorization: "Basic <base64(apps/publica:privada)>"
function authHeader() {
  const { publicKey, privateKey } = cfg();
  const raw = `apps/${publicKey}:${privateKey}`;
  return 'Basic ' + Buffer.from(raw, 'utf8').toString('base64');
}

// Pequeño wrapper sobre https.request que resuelve { status, body } y parsea
// JSON. Permite controlar rejectUnauthorized para el sandbox.
function request(method, urlStr, bodyObj) {
  const { insecureTls } = cfg();
  const url = new URL(urlStr);
  const payload = bodyObj ? JSON.stringify(bodyObj) : null;

  const options = {
    method,
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
    },
    rejectUnauthorized: !insecureTls,
    timeout: 15000,
  };
  if (payload) {
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch { parsed = { raw: data }; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Bancard: timeout de la petición')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Genera un QR dinámico para una venta. Devuelve el elemento qr_express
// ({ hook_alias, qr_data, url, amount, created_at }) y supported_clients.
async function generarQr({ amount, description }) {
  const { baseUrl, commerceCode, branchCode } = cfg();
  const uri = `${baseUrl}/commerces/${commerceCode}/branches/${branchCode}/selling/generate-qr-express`;
  const { status, body } = await request('POST', uri, {
    amount,
    ...(description ? { description } : {}),
  });

  if (status < 200 || status >= 300 || !body || body.status !== 'success' || !body.qr_express) {
    const msg = body?.messages?.[0]?.description || body?.raw || `HTTP ${status}`;
    const err = new Error(`Bancard no generó el QR: ${msg}`);
    err.bancard = body;
    throw err;
  }
  return { qr_express: body.qr_express, supported_clients: body.supported_clients || [] };
}

// Reversa/cancelación de un QR por su hook_alias. El status externo sólo indica
// que la invocación fue recibida; reverse.status indica si la reversa fue exitosa.
async function revertir(hookAlias) {
  const { baseUrl, commerceCode, branchCode } = cfg();
  const uri = `${baseUrl}/commerces/${commerceCode}/branches/${branchCode}/selling/payments/revert/${encodeURIComponent(hookAlias)}`;
  const { status, body } = await request('PUT', uri, null);
  return { httpStatus: status, body };
}

module.exports = { generarQr, revertir, authHeader, cfg };
