// src/services/financials.js
// ==============================================================================
// UTILIDADES FINANCIERAS Y COMPUTACIÓN DE CAJA
// ==============================================================================
// Unifica el cálculo de pagos, abonos y saldos pendientes en una única fuente
// de verdad pura, testeable y libre de dependencias de renderizado.
// ==============================================================================

/**
 * Determina si un pago corresponde a una reserva específica.
 * Empareja por sessionToken (con o sin prefijo 'book-') o por teléfono del cliente para pagos antiguos sin token.
 */
export function paymentBelongsToBooking(payment, booking) {
  if (!payment || !booking) return false;

  const bId = String(booking.id || '').trim();
  const bCleanId = bId.replace(/^book-/, '');

  const token = String(payment.sessionToken || '').trim();
  const tokenCleanId = token.replace(/^book-/, '');

  // 1. Si el pago tiene token:
  if (token) {
    if (token === bId || (bCleanId && tokenCleanId === bCleanId)) {
      return true;
    }
    // Si tiene token pero no coincide con esta reserva, no pertenece a ella
    return false;
  }

  // 2. Si no tiene token (pagos antiguos), emparejar por teléfono si ambos están presentes
  const pPhone = String(payment.clientWhatsApp || '').replace(/\D/g, '');
  const bPhone = String(booking.clientWhatsApp || '').replace(/\D/g, '');
  if (pPhone.length >= 7 && bPhone.length >= 7) {
    const key = bPhone.slice(-8);
    if (pPhone.endsWith(key) || key.endsWith(pPhone.slice(-8))) {
      return true;
    }
  }

  return false;
}

/**
 * Filtra los pagos atribuibles a una reserva.
 */
export function getBookingPayments(booking, payments) {
  if (!booking || !Array.isArray(payments)) return [];
  return payments.filter(p => p && paymentBelongsToBooking(p, booking));
}

/**
 * Computa el estado financiero de una reserva basándose exclusivamente
 * en pagos reales no rechazados y en el importe total acordado.
 */
export function computeBookingPaymentStatus(booking, payments = []) {
  if (!booking) {
    return {
      validPayments: [],
      totalPaid: 0,
      totalPrice: 0,
      remaining: 0,
      paidPercent: 0,
      isFullyPaid: false,
      hasDeposit: false,
      isPendingAbono: true,
      suggestedDeposit: 0,
      suggestedPaymentAmount: 0
    };
  }

  const allBelonging = getBookingPayments(booking, payments);
  const validPayments = allBelonging.filter(p => p && p.status !== 'rejected');

  const totalPaid = validPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalPrice = Number(booking.totalPrice) || 0;
  const remaining = Math.max(0, totalPrice - totalPaid);
  const paidPercent = totalPrice > 0 ? Math.round((totalPaid / totalPrice) * 100) : 0;
  const isFullyPaid = booking.status === 'completed' || (totalPrice > 0 && totalPaid >= totalPrice);
  const hasDeposit = totalPaid > 0 && !isFullyPaid;
  const isPendingAbono = totalPaid === 0 && booking.status !== 'completed';
  const deposit50 = Math.round(totalPrice * 0.5);

  let suggestedPaymentAmount = 0;
  if (!isFullyPaid && remaining > 0) {
    if (totalPaid === 0) {
      suggestedPaymentAmount = Math.min(remaining, deposit50);
    } else {
      suggestedPaymentAmount = remaining;
    }
  }

  const suggestedDeposit = Math.min(remaining, deposit50);

  return {
    validPayments,
    totalPaid,
    totalPrice,
    remaining,
    paidPercent,
    isFullyPaid,
    hasDeposit,
    isPendingAbono,
    suggestedDeposit,
    suggestedPaymentAmount
  };
}

/**
 * Calcula los totales recaudados por billetera (Nequi, DaviPlata, Dale, etc.).
 * Por defecto solo suma pagos verificados. Con onlyVerified: false suma todos los no rechazados.
 */
export function computeWalletTotals(payments = [], { onlyVerified = true } = {}) {
  const totals = { nequi: 0, daviplata: 0, dale: 0, efectivo: 0, otro: 0 };
  for (const p of Array.isArray(payments) ? payments : []) {
    if (!p) continue;
    if (onlyVerified && p.status !== 'verified') continue;
    if (!onlyVerified && p.status === 'rejected') continue;

    const method = String(p.method || 'otro').toLowerCase().trim();
    const amount = Number(p.amount) || 0;
    if (totals[method] !== undefined) {
      totals[method] += amount;
    } else {
      totals[method] = (totals[method] || 0) + amount;
    }
  }
  return totals;
}

/**
 * Calcula el balance total del portafolio (total cotizado, cobrado y por cobrar).
 */
export function computePortfolioBalance(bookings = [], payments = []) {
  let total = 0;
  for (const b of Array.isArray(bookings) ? bookings : []) {
    if (b && !['cancelled', 'cancelada', 'anulada'].includes(String(b.status || '').toLowerCase())) {
      total += Number(b.totalPrice) || 0;
    }
  }

  let cobrado = 0;
  for (const p of Array.isArray(payments) ? payments : []) {
    if (p && p.status === 'verified') {
      cobrado += Number(p.amount) || 0;
    }
  }

  const porCobrar = Math.max(0, total - cobrado);
  return { total, cobrado, porCobrar };
}

/**
 * Sanitiza cualquier texto antes de ser interpolado en HTML (previene XSS en impresión o correos).
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
