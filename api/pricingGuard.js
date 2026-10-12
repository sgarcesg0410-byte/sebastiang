// ==============================================================================
// GUARDA DE PRECIOS DEL SERVIDOR
// ==============================================================================
// El navegador NUNCA decide cuánto se cobra. Este módulo recalcula en el servidor
// la banda de precios válida (paquete + recargo + fotos de papel + retablos
// − descuento de fidelidad) y corrige cualquier valor fuera de rango.
//
// Así se cierra el agujero de "reservar el paquete de $85.000 por $1" sin romper
// las combinaciones legítimas (impresiones, retablos y descuentos reales).
// ==============================================================================

import {
  calculateBookingPriceBand,
  validateOrEnforcePrice,
  resolveLoyaltyDiscountPercent,
  LOYALTY_DISCOUNT_PERCENT
} from './pricing.js';
import { validateReferralCode } from './referrals.js';

/** Últimos 8 dígitos de un teléfono ('' si no hay suficientes). */
export function phoneKey(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : '';
}

/**
 * ¿Es un cliente recurrente? (mismo criterio que ya usaba el sitio)
 * Coincide si el teléfono aparece en una reserva o en una sesión anterior.
 * Se evalúa SIEMPRE en el servidor: el descuento no se acepta del navegador.
 */
export function isReturningClient({ bookings = [], sessions = [], phone } = {}) {
  const key = phoneKey(phone);
  if (!key) return false;

  const match = (list, field) => (Array.isArray(list) ? list : []).some(item => {
    const other = phoneKey(item?.[field]);
    return other && (other.endsWith(key) || key.endsWith(other));
  });

  return match(bookings, 'clientWhatsApp') || match(sessions, 'clientWhatsApp');
}

/**
 * Calcula el precio oficial de una reserva y valida lo que envió el cliente.
 *
 * @param {object} params
 * @param {object} params.db   Base de datos en memoria (bookings, sessions, settings).
 * @param {object} params.pkg  Paquete elegido (ya resuelto por el llamador).
 * @param {object} params.body Cuerpo de la petición.
 * @returns {{ finalPrice: number, band: object, priceCheck: object, isLoyal: boolean }}
 */
export function resolveBookingPrice({ db = {}, pkg = {}, body = {} } = {}) {
  const isLoyal = isReturningClient({
    bookings: db.bookings,
    sessions: db.sessions,
    phone: body.clientWhatsApp
  });

  let referralDiscountPercent = 0;
  const referralInput = body.referralCode || body.referredBy;
  if (referralInput) {
    const refCheck = validateReferralCode({
      code: referralInput,
      clientPhone: body.clientWhatsApp,
      bookings: db.bookings,
      sessions: db.sessions
    });
    if (refCheck.valid) {
      referralDiscountPercent = refCheck.discountPercent;
    }
  }

  // Regla de no acumulación: el descuento total jamás excede el 15%
  const loyaltyPercent = resolveLoyaltyDiscountPercent(isLoyal, LOYALTY_DISCOUNT_PERCENT);
  const effectiveDiscountPercent = Math.min(15, Math.max(loyaltyPercent, referralDiscountPercent));

  const band = calculateBookingPriceBand({
    packagePrice: pkg?.price || 0,
    locationType: body.locationType,
    surcharge: db?.settings?.outOfSanAnteroSurcharge,
    printedSizes: body.printedSizes,
    printedPhotosCount: body.printedPhotosCount,
    printedPhotos15x20Count: body.printedPhotos15x20Count,
    settings: db?.settings,
    loyaltyDiscountPercent: effectiveDiscountPercent
  });

  const hasDiscount = effectiveDiscountPercent > 0;
  const priceCheck = validateOrEnforcePrice(body.totalPrice, band, {
    fallbackPrice: hasDiscount ? band.minPrice : band.listPrice
  });

  if (priceCheck.adjusted) {
    console.warn(
      `⚠️ [Precios] Precio del cliente corregido (${priceCheck.reason}): ` +
      `enviado=${body.totalPrice} → cobrado=${priceCheck.finalPrice} ` +
      `(banda ${band.minPrice}-${band.listPrice})`
    );
  }

  return {
    finalPrice: priceCheck.finalPrice,
    band,
    priceCheck,
    isLoyal,
    referralApplied: referralDiscountPercent > 0 && !isLoyal,
    discountPercent: effectiveDiscountPercent
  };
}
