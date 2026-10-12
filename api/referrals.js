// ==============================================================================
// MÓDULO DE REFERIDOS ("Trae un amigo y ambos reciben 15%")
// ==============================================================================
// Reglas estrictas de privacidad y negocio:
// 1. Privacidad: NUNCA se devuelven nombres, correos ni datos del referente.
// 2. Anti-fraude: Un cliente NO puede auto-referirse con su propio número.
// 3. Primera sesión: El descuento de referido aplica solo a clientes nuevos.
//    Los clientes recurrentes ya tienen el 15% de fidelidad (no acumulables).
// ==============================================================================

import { phoneKey } from './pricingGuard.js';

export const REFERRAL_DISCOUNT_PERCENT = 15;

/**
 * Normaliza cualquier entrada de código a dígitos limpios.
 * Acepta formatos como: "3244725167", "+573244725167", "REF-3244725167".
 */
export function extractReferralDigits(code) {
  return String(code || '').replace(/\D/g, '');
}

/**
 * Valida un código de referido contra las reservas y sesiones existentes.
 * 
 * @param {object} params
 * @param {string} params.code Código o teléfono ingresado.
 * @param {string} params.clientPhone Teléfono del cliente que está reservando.
 * @param {Array}  params.bookings Lista de reservas.
 * @param {Array}  params.sessions Lista de sesiones.
 * @returns {{ valid: boolean, discountPercent: number, message: string }}
 */
export function validateReferralCode({ code, clientPhone, bookings = [], sessions = [] } = {}) {
  const refDigits = extractReferralDigits(code);
  const refKey = phoneKey(refDigits);

  if (!refKey || refDigits.length < 7) {
    return {
      valid: false,
      discountPercent: 0,
      message: 'Ingresa un número de WhatsApp válido de quien te recomendó.'
    };
  }

  const clientDigits = extractReferralDigits(clientPhone);
  const clientKey = phoneKey(clientDigits);

  // 1. Anti auto-referido
  if (clientKey && refKey && (clientKey === refKey || refDigits.endsWith(clientKey) || clientDigits.endsWith(refKey))) {
    return {
      valid: false,
      discountPercent: 0,
      message: 'No puedes usar tu propio número como referido.'
    };
  }

  // 2. Regla: cliente nuevo exclusivamente (los clientes recurrentes ya disfrutan de fidelidad)
  if (clientKey) {
    const isExistingClient = [...bookings, ...sessions].some(item => {
      const otherKey = phoneKey(item?.clientWhatsApp);
      return otherKey && (otherKey === clientKey || clientKey.endsWith(otherKey) || otherKey.endsWith(clientKey));
    });

    if (isExistingClient) {
      return {
        valid: false,
        discountPercent: 0,
        message: 'El descuento de referido aplica únicamente en tu primera sesión.'
      };
    }
  }

  // 3. Comprobar existencia del referente en la base de datos
  const referrerExists = [...bookings, ...sessions].some(item => {
    const otherKey = phoneKey(item?.clientWhatsApp);
    return otherKey && (otherKey === refKey || refDigits.endsWith(otherKey) || otherKey.endsWith(refDigits.slice(-8)));
  });

  if (!referrerExists) {
    return {
      valid: false,
      discountPercent: 0,
      message: 'Código o teléfono de referido no registrado.'
    };
  }

  // Retorno limpio y seguro: CERO nombres ni indicios de identidad
  return {
    valid: true,
    discountPercent: REFERRAL_DISCOUNT_PERCENT,
    message: 'Código de referido válido (15% de descuento).'
  };
}
