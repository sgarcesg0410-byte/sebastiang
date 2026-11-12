// api/pricing.js
// ==============================================================================
// MÓDULO DE TARIFAS Y CÁLCULO DE PRECIOS PARA EL BACKEND SERVERLESS
// ==============================================================================
// Re-exporta íntegramente desde ../shared/pricing.js (Fuente Única de Tarifas)
// evitando cualquier duplicación entre frontend y backend (Hallazgo #25 / P2-19).
// ==============================================================================

export {
  DEFAULT_PAPER_PRINT_SIZES,
  DEFAULT_RETABLO_SIZES,
  REQUIRED_BOOKING_DEPOSIT,
  LOYALTY_DISCOUNT_PERCENT,
  REFERRAL_DISCOUNT_PERCENT,
  getPaperPrintSizes,
  getRetabloSizes,
  resolveLoyaltyDiscountPercent,
  normalizePrintedSizes,
  calculateBookingPriceBand,
  validateOrEnforcePrice
} from '../shared/pricing.js';
