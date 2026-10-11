import { describe, it, expect } from 'vitest';
import {
  calculateBookingPriceBand,
  validateOrEnforcePrice,
  normalizePrintedSizes,
  resolveLoyaltyDiscountPercent,
  getPaperPrintSizes,
  getRetabloSizes,
  DEFAULT_PAPER_PRINT_SIZES,
  DEFAULT_RETABLO_SIZES,
  LOYALTY_DISCOUNT_PERCENT
} from '../../shared/pricing.js';

import {
  getPaperPrintSizes as frontPaper,
  getRetabloSizes as frontRetablos
} from '../services/api';

describe('Coherencia entre las tarifas del frontend y shared/pricing.js', () => {
  it('el frontend y el servidor calculan exactamente los mismos precios', () => {
    expect(frontPaper()).toEqual(getPaperPrintSizes());
    expect(frontRetablos()).toEqual(getRetabloSizes());

    const custom = { printedPhotoPrice: 9000, printedPhoto20x30Price: 35000, retabloCost20x30: 18000 };
    expect(frontPaper(custom)).toEqual(getPaperPrintSizes(custom));
    expect(frontRetablos(custom)).toEqual(getRetabloSizes(custom));
  });
});

describe('Banda de precios de una reserva (shared/pricing.js)', () => {
  it('sin extras, sin recargo y sin descuento: mínimo = máximo = precio del paquete', () => {
    const band = calculateBookingPriceBand({ packagePrice: 45000 });
    expect(band.listPrice).toBe(45000);
    expect(band.minPrice).toBe(45000);
    expect(band.extrasTotal).toBe(0);
    expect(band.surchargeApplied).toBe(0);
  });

  it('cobra el recargo por locación con "outside" Y con "outside_san_antero"', () => {
    const dentro = calculateBookingPriceBand({ packagePrice: 45000, locationType: 'san_antero' });
    const fueraCliente = calculateBookingPriceBand({ packagePrice: 45000, locationType: 'outside' });
    const fueraServidor = calculateBookingPriceBand({ packagePrice: 45000, locationType: 'outside_san_antero' });

    expect(dentro.listPrice).toBe(45000);
    expect(fueraCliente.listPrice).toBe(55000);
    // Regresión: el backend solo reconocía 'outside' y dejaba de cobrar el recargo.
    expect(fueraServidor.listPrice).toBe(55000);
  });

  it('aplica el 15% de fidelidad SOLO sobre el paquete y su recargo, nunca sobre los extras', () => {
    const band = calculateBookingPriceBand({
      packagePrice: 100000,
      locationType: 'outside',
      surcharge: 10000,
      printedSizes: { '10x15': 2 }, // 2 * 7.000 = 14.000
      loyaltyDiscountPercent: LOYALTY_DISCOUNT_PERCENT
    });

    expect(band.priceBeforeDiscount).toBe(110000);
    expect(band.discountAmount).toBe(16500); // 15% de 110.000
    expect(band.extrasTotal).toBe(14000);
    expect(band.listPrice).toBe(124000); // 110.000 + 14.000
    expect(band.minPrice).toBe(107500);  // (110.000 - 16.500) + 14.000
  });

  it('suma fotos de papel y retablos por tamaño', () => {
    const band = calculateBookingPriceBand({
      packagePrice: 75000,
      printedSizes: { '10x15': 3, '15x20': 2, '20x30': 1, '70x100': 1 }
    });

    // papel: 3*7.000 + 2*8.000 = 37.000 | retablos: 30.000 + 200.000 = 230.000
    expect(band.paperTotal).toBe(37000);
    expect(band.retabloTotal).toBe(230000);
    expect(band.listPrice).toBe(75000 + 267000);
    expect(band.paperItems).toHaveLength(2);
    expect(band.retabloItems).toHaveLength(2);
  });

  it('respeta precios personalizados de los ajustes', () => {
    const band = calculateBookingPriceBand({
      packagePrice: 45000,
      printedSizes: { '10x15': 1, '20x30': 1 },
      settings: { printedPhotoPrice: 9000, printedPhoto20x30Price: 35000 }
    });
    expect(band.paperTotal).toBe(9000);
    expect(band.retabloTotal).toBe(35000);
  });

  it('normaliza los campos heredados de fotos impresas', () => {
    const q = normalizePrintedSizes({ printedPhotosCount: 4, printedPhotos15x20Count: 2 });
    expect(q['10x15']).toBe(4);
    expect(q['15x20']).toBe(2);
    // Un retablo nunca se deriva de los campos heredados de papel.
    expect(q['20x30']).toBeUndefined();
  });

  it('los catálogos por defecto conservan las tarifas acordadas', () => {
    expect(DEFAULT_PAPER_PRINT_SIZES).toHaveLength(2);
    expect(DEFAULT_RETABLO_SIZES).toHaveLength(6);
    expect(getPaperPrintSizes().find(i => i.id === '10x15').price).toBe(7000);
    expect(getRetabloSizes().find(i => i.id === '70x100').price).toBe(200000);
  });

  it('resolveLoyaltyDiscountPercent solo descuenta a clientes recurrentes', () => {
    expect(resolveLoyaltyDiscountPercent(false)).toBe(0);
    expect(resolveLoyaltyDiscountPercent(true)).toBe(15);
  });
});

describe('Validación del precio enviado por el cliente', () => {
  const band = calculateBookingPriceBand({
    packagePrice: 85000,
    locationType: 'outside',
    printedSizes: { '10x15': 2 },
    loyaltyDiscountPercent: 15
  });

  it('acepta un precio dentro de la banda (combinación legítima)', () => {
    const res = validateOrEnforcePrice(band.listPrice, band);
    expect(res.accepted).toBe(true);
    expect(res.adjusted).toBe(false);
    expect(res.finalPrice).toBe(band.listPrice);
  });

  it('acepta el precio con descuento de fidelidad legítimo', () => {
    const res = validateOrEnforcePrice(band.minPrice, band);
    expect(res.accepted).toBe(true);
    expect(res.finalPrice).toBe(band.minPrice);
  });

  it('bloquea el intento de reservar por $1 y sube al mínimo de la banda', () => {
    const res = validateOrEnforcePrice(1, band);
    expect(res.accepted).toBe(false);
    expect(res.adjusted).toBe(true);
    expect(res.finalPrice).toBe(band.minPrice);
    expect(res.reason).toBe('below-band');
  });

  it('bloquea valores inválidos (texto, null, negativo) y usa el precio de lista', () => {
    for (const bad of [null, undefined, 'gratis', -500, 0, NaN]) {
      const res = validateOrEnforcePrice(bad, band);
      expect(res.adjusted).toBe(true);
      expect(res.finalPrice).toBe(band.listPrice);
      expect(res.reason).toBe('invalid');
    }
  });

  it('no permite sobrecobrar por encima del precio de lista', () => {
    const res = validateOrEnforcePrice(99999999, band);
    expect(res.finalPrice).toBe(band.listPrice);
    expect(res.reason).toBe('above-band');
  });

  it('nunca cobra menos que el mínimo, sea cual sea la combinación del cliente', () => {
    for (const attempt of [1, 100, band.minPrice - 1, 0.5]) {
      const res = validateOrEnforcePrice(attempt, band);
      expect(res.finalPrice).toBeGreaterThanOrEqual(band.minPrice);
    }
  });
});
