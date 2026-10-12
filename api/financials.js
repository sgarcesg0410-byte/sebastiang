// api/financials.js
// ==============================================================================
// UTILIDADES FINANCIERAS Y COMPUTACIÓN DE CAJA (PARA VERCEL SERVERLESS)
// ==============================================================================
// Ubicado dentro de api/ para garantizar resolución nativa en Vercel Serverless.
// ==============================================================================

export function paymentBelongsToBooking(payment, booking) {
  if (!payment || !booking) return false;

  const bId = String(booking.id || '').trim();
  const bCleanId = bId.replace(/^book-/, '');

  const token = String(payment.sessionToken || '').trim();
  const tokenCleanId = token.replace(/^book-/, '');

  if (token) {
    if (token === bId || (bCleanId && tokenCleanId === bCleanId)) {
      return true;
    }
    return false;
  }

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

export function getBookingPayments(booking, payments) {
  if (!booking || !Array.isArray(payments)) return [];
  return payments.filter(p => p && paymentBelongsToBooking(p, booking));
}

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
  const validPayments = allBelonging.filter(p => p && (p.status === 'verified' || p.status === 'approved'));

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

export function computeWalletTotals(payments = [], { onlyVerified = true } = {}) {
  const totals = { nequi: 0, daviplata: 0, dale: 0, wompi: 0, efectivo: 0, otro: 0 };
  for (const p of Array.isArray(payments) ? payments : []) {
    if (!p) continue;
    if (onlyVerified && p.status !== 'verified' && p.status !== 'approved') continue;
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

export function computePortfolioBalance(bookings = [], payments = []) {
  let total = 0;
  for (const b of Array.isArray(bookings) ? bookings : []) {
    if (b && !['cancelled', 'cancelada', 'anulada'].includes(String(b.status || '').toLowerCase())) {
      total += Number(b.totalPrice) || 0;
    }
  }

  let cobrado = 0;
  for (const p of Array.isArray(payments) ? payments : []) {
    if (p && (p.status === 'verified' || p.status === 'approved')) {
      cobrado += Number(p.amount) || 0;
    }
  }

  const porCobrar = Math.max(0, total - cobrado);
  return { total, cobrado, porCobrar };
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
