import crypto from 'crypto';

/**
 * Genera una referencia única para transacciones de Wompi.
 * @param {string} prefix
 * @returns {string}
 */
export function generatePaymentReference(prefix = 'wompi') {
  const randomHex = crypto.randomBytes(4).toString('hex');
  return `ref-${prefix}-${Date.now()}-${randomHex}`;
}

/**
 * Calcula la firma de integridad SHA-256 para el Checkout / Widget de Wompi.
 *
 * Fórmula oficial de Wompi:
 * SHA256("<referencia><monto_en_centavos><moneda><secreto_de_integridad>")
 *
 * @param {Object} params
 * @param {string} params.reference Referencia única de la transacción
 * @param {number|string} params.amountInCents Monto total en centavos (ej: 2000000 para $20.000 COP)
 * @param {string} [params.currency='COP'] Código de moneda ISO
 * @param {string} params.integritySecret Secreto de integridad provisto por Wompi
 * @returns {string} Hash SHA-256 en formato hexadecimal
 */
export function generateWompiSignature({ reference, amountInCents, currency = 'COP', integritySecret }) {
  if (!reference || amountInCents === undefined || amountInCents === null || !integritySecret) {
    throw new Error('Faltan parámetros requeridos para generar la firma de integridad de Wompi.');
  }

  const raw = `${reference}${amountInCents}${currency}${integritySecret}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Resuelve una ruta de propiedad con notación de puntos dentro de un objeto.
 * Ejemplo: resolvePropertyPath({ transaction: { id: '123' } }, 'transaction.id') => '123'
 *
 * @param {Object} obj
 * @param {string} path
 * @returns {string}
 */
export function resolvePropertyPath(obj, path) {
  if (!obj || typeof path !== 'string') return '';
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return '';
    current = current[part];
  }
  return current === null || current === undefined ? '' : String(current);
}

/**
 * Valida criptográficamente el checksum de un evento de webhook enviado por Wompi.
 *
 * Fórmula oficial de Wompi:
 * SHA256("<valor_prop1><valor_prop2>...<timestamp><secreto_de_eventos>")
 *
 * @param {Object} params
 * @param {Object} params.eventPayload Cuerpo JSON recibido en el webhook
 * @param {string} params.eventsSecret Secreto de eventos configurado en Wompi (WOMPI_EVENTS_SECRET)
 * @returns {boolean} True si la firma es válida y auténtica; false en caso contrario
 */
export function verifyWompiChecksum({ eventPayload, eventsSecret }) {
  if (!eventsSecret || typeof eventsSecret !== 'string') {
    return false;
  }
  if (!eventPayload || typeof eventPayload !== 'object') {
    return false;
  }

  const { signature, timestamp, data } = eventPayload;
  if (!signature || !Array.isArray(signature.properties) || !signature.checksum || timestamp === undefined || timestamp === null) {
    return false;
  }

  // Extraer valores en el orden exacto especificado en signature.properties
  const propValues = signature.properties.map(propPath => resolvePropertyPath(data, propPath));
  const raw = `${propValues.join('')}${timestamp}${eventsSecret}`;
  const calculatedHash = crypto.createHash('sha256').update(raw).digest('hex');

  // Comparación en tiempo constante para mitigar ataques de tiempo
  const expectedBuf = Buffer.from(signature.checksum.toLowerCase(), 'utf8');
  const actualBuf = Buffer.from(calculatedHash.toLowerCase(), 'utf8');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Valida las reglas de negocio sobre el monto a pagar según el concepto.
 *
 * Reglas de negocio críticas:
 * 1. Abono de reserva ('booking_deposit'):
 *    - Es exactamente $20.000 COP, a menos que el total de la reserva sea menor (en cuyo caso es el total).
 *    - NO se compara contra el total del paquete de resolveBookingPrice.
 * 2. Saldo de sesión ('session_balance'):
 *    - Debe ser exactamente el saldo pendiente calculado (sessionRemaining).
 *
 * @param {Object} params
 * @param {string} params.concept Concepto ('booking_deposit' | 'session_balance')
 * @param {number} params.amount Monto en pesos COP que el cliente intenta pagar
 * @param {Object} [params.booking] Reserva asociada si existe
 * @param {number} [params.sessionRemaining] Saldo pendiente si aplica
 * @returns {{ valid: boolean, expectedAmount: number, error?: string }}
 */
export function validateCheckoutAmount({ concept, amount, booking, sessionRemaining }) {
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return { valid: false, expectedAmount: 0, error: 'Monto inválido o no numérico.' };
  }

  if (concept === 'booking_deposit' || concept === 'abono') {
    const bookingTotal = booking?.totalPrice !== undefined ? Number(booking.totalPrice) : Infinity;
    const expectedDeposit = bookingTotal < 20000 ? bookingTotal : 20000;

    if (numAmount !== expectedDeposit) {
      return {
        valid: false,
        expectedAmount: expectedDeposit,
        error: `El abono de reserva debe ser exactamente de $${expectedDeposit.toLocaleString('es-CO')} COP.`
      };
    }

    return { valid: true, expectedAmount: expectedDeposit };
  }

  if (concept === 'session_balance' || concept === 'saldo_galeria') {
    if (sessionRemaining === undefined || sessionRemaining === null || sessionRemaining <= 0) {
      return { valid: false, expectedAmount: 0, error: 'No hay saldo pendiente por pagar para esta sesión.' };
    }

    const expected = Number(sessionRemaining);
    if (numAmount !== expected) {
      return {
        valid: false,
        expectedAmount: expected,
        error: `El saldo pendiente de la sesión es de $${expected.toLocaleString('es-CO')} COP.`
      };
    }

    return { valid: true, expectedAmount: expected };
  }

  return { valid: false, expectedAmount: 0, error: `Concepto de pago desconocido: "${concept}".` };
}

/**
 * Consulta de forma autoritativa los detalles de una transacción directamente en la API de Wompi.
 * Permite contrastar los datos del webhook con la fuente oficial de Wompi para garantizar
 * que la referencia, el estado, el monto y la moneda no hayan sido alterados.
 *
 * @param {string} transactionId ID de la transacción en Wompi (ej: '12345-167890-54321')
 * @param {Object} [options]
 * @param {string} [options.privateKey] Llave privada de Wompi (prv_prod_... o prv_test_...)
 * @param {string} [options.apiBaseUrl] URL base de la API de Wompi
 * @returns {Promise<{ ok: boolean, transaction?: Object, error?: string, status?: number }>}
 */
export async function fetchWompiTransaction(transactionId, {
  privateKey = process.env.WOMPI_PRIVATE_KEY,
  apiBaseUrl = process.env.WOMPI_API_URL || 'https://production.wompi.co/v1'
} = {}) {
  if (!transactionId) {
    return { ok: false, error: 'transactionId requerido para consultar en Wompi API' };
  }
  if (!privateKey) {
    return { ok: false, error: 'WOMPI_PRIVATE_KEY no configurada en el servidor' };
  }

  try {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/transactions/${encodeURIComponent(transactionId)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    if (timeout && timeout.unref) timeout.unref();

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${privateKey}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { ok: false, status: res.status, error: `Error HTTP ${res.status} consultando transacción en Wompi API` };
    }

    const json = await res.json();
    const tx = json?.data;
    if (!tx || !tx.id) {
      return { ok: false, error: 'Respuesta inválida de Wompi API (sin data)' };
    }

    return { ok: true, transaction: tx };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
