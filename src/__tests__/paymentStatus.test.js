import { describe, it, expect } from 'vitest';
import {
  computeBookingPaymentStatus,
  computeWalletTotals,
  computePortfolioBalance,
  paymentBelongsToBooking,
  getBookingPayments
} from '../services/financials.js';

const booking = (over = {}) => ({
  id: 'book-1790280190756',
  clientName: 'Cliente Prueba',
  clientWhatsApp: '+57 300 111 2233',
  totalPrice: 100000,
  status: 'pending',
  ...over
});

describe('Estado de pago de una reserva (src/services/financials.js)', () => {
  it('excluye los pagos rechazados del dinero recibido', () => {
    const b = booking();
    const payments = [
      { id: 'p1', sessionToken: b.id, amount: 50000, status: 'verified' },
      { id: 'p2', sessionToken: b.id, amount: 30000, status: 'rejected' }
    ];
    const res = computeBookingPaymentStatus(b, payments);

    expect(res.totalPaid).toBe(50000); // 30.000 rechazados NO cuentan
    expect(res.remaining).toBe(50000);
    // Regresión: la tarjeta de la agenda sumaba los rechazados y marcaba la reserva como pagada.
    expect(res.isFullyPaid).toBe(false);
  });

  it('empareja el pago aunque el id venga con o sin prefijo', () => {
    const b = booking({ id: 'book-123' });
    const payments = [
      { id: 'p1', sessionToken: '123', amount: 25000, status: 'verified' },
      { id: 'p2', sessionToken: 'book-123', amount: 25000, status: 'verified' }
    ];
    expect(computeBookingPaymentStatus(b, payments).totalPaid).toBe(50000);
  });

  it('no suma pagos de otra reserva aunque coincida el nombre', () => {
    const b = booking({ id: 'book-A' });
    const otro = { id: 'p2', sessionToken: 'book-B', clientName: 'Cliente Prueba', amount: 90000, status: 'verified' };
    expect(paymentBelongsToBooking(otro, b)).toBe(false);
    expect(computeBookingPaymentStatus(b, [otro]).totalPaid).toBe(0);
  });

  it('rescata pagos antiguos sin token emparejando el teléfono', () => {
    const b = booking({ id: 'book-A' });
    const legacy = { id: 'p3', sessionToken: '', clientWhatsApp: '3001112233', amount: 20000, status: 'verified' };
    expect(paymentBelongsToBooking(legacy, b)).toBe(true);
    expect(computeBookingPaymentStatus(b, [legacy]).totalPaid).toBe(20000);
  });

  it('calcula saldo restante, porcentaje y estado de abono', () => {
    const b = booking();
    const res = computeBookingPaymentStatus(b, [
      { id: 'p1', sessionToken: b.id, amount: 40000, status: 'verified' }
    ]);

    expect(res.totalPrice).toBe(100000);
    expect(res.totalPaid).toBe(40000);
    expect(res.remaining).toBe(60000);
    expect(res.paidPercent).toBe(40);
    expect(res.hasDeposit).toBe(true);
    expect(res.isPendingAbono).toBe(false);
    expect(res.isFullyPaid).toBe(false);
  });

  it('marca como pendiente de abono una reserva sin ningún pago', () => {
    const res = computeBookingPaymentStatus(booking(), []);
    expect(res.totalPaid).toBe(0);
    expect(res.isPendingAbono).toBe(true);
    expect(res.hasDeposit).toBe(false);
    expect(res.isFullyPaid).toBe(false);
  });

  it('una reserva completada se considera pagada', () => {
    const res = computeBookingPaymentStatus(booking({ status: 'completed' }), []);
    expect(res.isFullyPaid).toBe(true);
    expect(res.isPendingAbono).toBe(false);
  });

  it('PREVIENE EL DOBLE COBRO: el abono sugerido nunca supera el saldo restante', () => {
    const b = booking({ totalPrice: 100000 });

    // Sin pagos: sugiere el 50% (50.000)
    expect(computeBookingPaymentStatus(b, []).suggestedPaymentAmount).toBe(50000);

    // Con 50.000 ya abonados: el 50% coincidía con el saldo → 50.000
    const primerAbono = [{ id: 'p1', sessionToken: b.id, amount: 50000, status: 'verified' }];
    expect(computeBookingPaymentStatus(b, primerAbono).suggestedPaymentAmount).toBe(50000);

    // Con 80.000 abonados el bug original precargaba 50.000 otra vez (doble cobro).
    // Ahora sugiere solo los 20.000 que faltan.
    const segundoAbono = [
      { id: 'p1', sessionToken: b.id, amount: 50000, status: 'verified' },
      { id: 'p2', sessionToken: b.id, amount: 30000, status: 'verified' }
    ];
    const res = computeBookingPaymentStatus(b, segundoAbono);
    expect(res.remaining).toBe(20000);
    expect(res.suggestedPaymentAmount).toBe(20000);

    // Pagada por completo: no sugiere cobrar nada más.
    const pagada = [
      { id: 'p1', sessionToken: b.id, amount: 50000, status: 'verified' },
      { id: 'p2', sessionToken: b.id, amount: 50000, status: 'verified' }
    ];
    expect(computeBookingPaymentStatus(b, pagada).suggestedPaymentAmount).toBe(0);
  });

  it('getBookingPayments ignora entradas inválidas sin romperse', () => {
    const b = booking();
    expect(getBookingPayments(b, null)).toEqual([]);
    expect(getBookingPayments(null, [])).toEqual([]);
    // Un pago sin token, sin teléfono y sin nombre no puede atribuirse a esta reserva.
    expect(getBookingPayments(b, [null, undefined, { amount: 5000 }])).toHaveLength(0);
  });
});

describe('Saldos de billeteras (AP6)', () => {
  const payments = [
    { id: 'p1', method: 'nequi', amount: 50000, status: 'verified' },
    { id: 'p2', method: 'nequi', amount: 30000, status: 'pending' },
    { id: 'p3', method: 'nequi', amount: 20000, status: 'rejected' },
    { id: 'p4', method: 'daviplata', amount: 15000, status: 'verified' }
  ];

  it('solo suma pagos verificados', () => {
    const totals = computeWalletTotals(payments);
    expect(totals.nequi).toBe(50000);      // el pending y el rejected no inflan el saldo
    expect(totals.daviplata).toBe(15000);
  });

  it('puede sumar todos los no-rechazados si se pide explícitamente', () => {
    const totals = computeWalletTotals(payments, { onlyVerified: false });
    expect(totals.nequi).toBe(80000);
  });

  it('suma el total cobrado y por cobrar de un portafolio', () => {
    const bookings = [
      { id: 'book-1', totalPrice: 100000, status: 'pending' },
      { id: 'book-2', totalPrice: 50000, status: 'pending' }
    ];
    const pays = [{ id: 'p1', sessionToken: 'book-1', amount: 100000, status: 'verified' }];
    const res = computePortfolioBalance(bookings, pays);

    expect(res.total).toBe(150000);
    expect(res.cobrado).toBe(100000);
    expect(res.porCobrar).toBe(50000);
  });
});
