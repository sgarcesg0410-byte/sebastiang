import { describe, it, expect } from 'vitest';
import { validateReferralCode, extractReferralDigits } from '../../api/referrals.js';
import { resolveBookingPrice } from '../../api/pricingGuard.js';

describe('Módulo de Referidos (api/referrals.js)', () => {
  const existingBookings = [
    { id: 'b1', clientName: 'Maria Perez', clientWhatsApp: '+57 320 555 1234', totalPrice: 75000 },
    { id: 'b2', clientName: 'Carlos Gomez', clientWhatsApp: '3009876543', totalPrice: 85000 }
  ];

  it('extrae dígitos limpios del código de referido', () => {
    expect(extractReferralDigits('REF-3205551234')).toBe('3205551234');
    expect(extractReferralDigits('+57 300 987 6543')).toBe('573009876543');
    expect(extractReferralDigits('')).toBe('');
  });

  it('valida un referido legítimo y devuelve CERO nombres personales (Privacidad)', () => {
    const res = validateReferralCode({
      code: '3205551234',
      clientPhone: '3114449988',
      bookings: existingBookings,
      sessions: []
    });

    expect(res.valid).toBe(true);
    expect(res.discountPercent).toBe(15);
    // Verificación crítica: NO expone el nombre "Maria Perez" ni indicios
    expect(res).not.toHaveProperty('referrerName');
    expect(res).not.toHaveProperty('referrerFirstName');
    expect(res).not.toHaveProperty('clientName');
  });

  it('rechaza el auto-referido (el cliente ingresa su propio teléfono)', () => {
    const res = validateReferralCode({
      code: '3205551234',
      clientPhone: '+57 320 555 1234',
      bookings: existingBookings,
      sessions: []
    });

    expect(res.valid).toBe(false);
    expect(res.discountPercent).toBe(0);
    expect(res.message).toContain('propio número');
  });

  it('rechaza el descuento si el cliente que reserva ya es cliente recurrente', () => {
    // Carlos ya tiene una reserva previa (b2)
    const res = validateReferralCode({
      code: '3205551234', // referido de Maria
      clientPhone: '3009876543', // Carlos
      bookings: existingBookings,
      sessions: []
    });

    expect(res.valid).toBe(false);
    expect(res.discountPercent).toBe(0);
    expect(res.message).toContain('primera sesión');
  });

  it('rechaza códigos que no existen en la base de datos', () => {
    const res = validateReferralCode({
      code: '3000000000',
      clientPhone: '3114449988',
      bookings: existingBookings,
      sessions: []
    });

    expect(res.valid).toBe(false);
    expect(res.discountPercent).toBe(0);
  });

  it('PREVENCIÓN DE ACUMULACIÓN: fidelidad 15% + referido 15% nunca suma 30% (Tope 15%)', () => {
    const db = {
      bookings: existingBookings,
      sessions: [],
      settings: { outOfSanAnteroSurcharge: 10000 }
    };
    const pkg = { id: 'pkg-8fotos', name: '8 Fotos', price: 75000 };

    // Cliente Carlos (ya es fiel = 15%) intenta pasar código de referido
    const priceResolution = resolveBookingPrice({
      db,
      pkg,
      body: {
        clientWhatsApp: '3009876543', // Carlos
        referralCode: '3205551234',
        totalPrice: 63750, // 75000 con 15%
        locationType: 'san_antero'
      }
    });

    // Descuento final debe ser 15% ($11.250), nunca 30% ($22.500)
    expect(priceResolution.discountPercent).toBe(15);
    expect(priceResolution.finalPrice).toBe(63750);
  });
});
