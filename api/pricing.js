// api/pricing.js
// ==============================================================================
// MÓDULO DE TARIFAS Y CÁLCULO DE PRECIOS PARA EL BACKEND SERVERLESS
// ==============================================================================
// Ubicado dentro de api/ para garantizar resolución nativa en Vercel Serverless.
// ==============================================================================

export const DEFAULT_PAPER_PRINT_SIZES = [
  {
    id: '10x15',
    dimensions: '10x15 cm',
    label: '10x15 cm',
    price: 7000,
    category: 'foto_papel',
    type: 'Foto Impresa en Papel',
    desc: 'Papel fotográfico profesional de laboratorio • Formato estándar para álbum o bolsillo',
    tag: 'Estándar'
  },
  {
    id: '15x20',
    dimensions: '15x20 cm',
    label: '15x20 cm',
    price: 8000,
    category: 'foto_papel',
    type: 'Foto Impresa en Papel',
    desc: 'Papel fotográfico profesional de laboratorio • Formato ideal para portarretratos de mesa',
    tag: 'Portarretrato'
  }
];

export const DEFAULT_RETABLO_SIZES = [
  {
    id: '20x30',
    dimensions: '20x30 cm',
    label: '20x30 cm',
    cost: 15000,
    price: 30000,
    category: 'retablo',
    type: 'Cuadro en Retablo',
    desc: 'Cuadro en retablo de madera • Acabado laminado y bordes pulidos',
    tag: 'Retablo HD'
  },
  {
    id: '30x45',
    dimensions: '30x45 cm',
    label: '30x45 cm',
    cost: 30000,
    price: 60000,
    category: 'retablo',
    type: 'Cuadro en Retablo',
    desc: 'Cuadro en retablo de madera • Medida ideal para salas o dormitorios',
    tag: 'Retablo Mediano'
  },
  {
    id: '40x50',
    dimensions: '40x50 cm',
    label: '40x50 cm',
    cost: 55000,
    price: 85000,
    category: 'retablo',
    type: 'Cuadro en Retablo',
    desc: 'Cuadro en retablo de madera • Formato de galería con alta presencia decorativa',
    tag: 'Retablo Galería'
  },
  {
    id: '50x70',
    dimensions: '50x70 cm',
    label: '50x70 cm',
    cost: 80000,
    price: 110000,
    category: 'retablo',
    type: 'Cuadro en Retablo',
    desc: 'Cuadro en retablo de gran formato vertical • Alto impacto visual',
    tag: 'Retablo Gran Formato'
  },
  {
    id: '70x50',
    dimensions: '70x50 cm',
    label: '70x50 cm',
    cost: 80000,
    price: 120000,
    category: 'retablo',
    type: 'Cuadro en Retablo Panorámico',
    desc: 'Cuadro en retablo horizontal panorámico de lujo para sala principal',
    tag: 'Retablo Panorámico'
  },
  {
    id: '70x100',
    dimensions: '70x100 cm',
    label: '70x100 cm',
    cost: 150000,
    price: 200000,
    category: 'retablo',
    type: 'Cuadro en Retablo Gigante (1m)',
    desc: 'Cuadro en retablo gigante de 1 metro • Máximo lujo fotográfico',
    tag: 'Retablo Gigante (1m)'
  }
];

export function getPaperPrintSizes(settings = {}) {
  return DEFAULT_PAPER_PRINT_SIZES.map(item => {
    let p = item.price;
    if (item.id === '10x15' && settings.printedPhotoPrice) p = Number(settings.printedPhotoPrice);
    if (item.id === '15x20' && settings.printedPhoto15x20Price) p = Number(settings.printedPhoto15x20Price);
    return { ...item, price: p };
  });
}

export function getRetabloSizes(settings = {}) {
  return DEFAULT_RETABLO_SIZES.map(item => {
    let p = item.price;
    let c = item.cost;
    if (item.id === '20x30') {
      if (settings.printedPhoto20x30Price) p = Number(settings.printedPhoto20x30Price);
      if (settings.retabloCost20x30 !== undefined && settings.retabloCost20x30 !== null) c = Number(settings.retabloCost20x30);
    }
    if (item.id === '30x45') {
      if (settings.printedPhoto30x45Price) p = Number(settings.printedPhoto30x45Price);
      if (settings.retabloCost30x45 !== undefined && settings.retabloCost30x45 !== null) c = Number(settings.retabloCost30x45);
    }
    if (item.id === '40x50') {
      if (settings.printedPhoto40x50Price) p = Number(settings.printedPhoto40x50Price);
      if (settings.retabloCost40x50 !== undefined && settings.retabloCost40x50 !== null) c = Number(settings.retabloCost40x50);
    }
    if (item.id === '50x70') {
      if (settings.printedPhoto50x70Price) p = Number(settings.printedPhoto50x70Price);
      if (settings.retabloCost50x70 !== undefined && settings.retabloCost50x70 !== null) c = Number(settings.retabloCost50x70);
    }
    if (item.id === '70x50') {
      if (settings.printedPhoto70x50Price) p = Number(settings.printedPhoto70x50Price);
      if (settings.retabloCost70x50 !== undefined && settings.retabloCost70x50 !== null) c = Number(settings.retabloCost70x50);
    }
    if (item.id === '70x100') {
      if (settings.printedPhoto70x100Price) p = Number(settings.printedPhoto70x100Price);
      if (settings.retabloCost70x100 !== undefined && settings.retabloCost70x100 !== null) c = Number(settings.retabloCost70x100);
    }
    const profit = Math.max(0, p - c);
    const marginPercent = p > 0 ? Math.round((profit / p) * 100) : 0;
    return { ...item, price: p, cost: c, profit, marginPercent };
  });
}

export const LOYALTY_DISCOUNT_PERCENT = 15;

export function resolveLoyaltyDiscountPercent(isLoyal, percent = LOYALTY_DISCOUNT_PERCENT) {
  return isLoyal ? (Number(percent) || LOYALTY_DISCOUNT_PERCENT) : 0;
}

export function normalizePrintedSizes({
  printedSizes,
  printedPhotosCount,
  printedPhotos10x15Count,
  printedPhotos15x20Count
} = {}) {
  const result = { ...(printedSizes || {}) };
  const p10 = Number(printedPhotos10x15Count || printedPhotosCount || 0);
  const p15 = Number(printedPhotos15x20Count || 0);
  if (p10 > 0 && result['10x15'] === undefined) result['10x15'] = p10;
  if (p15 > 0 && result['15x20'] === undefined) result['15x20'] = p15;
  return result;
}

export function calculateBookingPriceBand({
  packagePrice = 0,
  locationType = 'san_antero',
  surcharge = 10000,
  printedSizes = {},
  printedPhotosCount = 0,
  printedPhotos15x20Count = 0,
  settings = {},
  loyaltyDiscountPercent = 0
} = {}) {
  const isOutside = locationType === 'outside' || locationType === 'outside_san_antero';
  const surchargeApplied = isOutside ? (Number(surcharge) || 10000) : 0;
  const priceBeforeDiscount = Number(packagePrice) + surchargeApplied;
  const basePrice = priceBeforeDiscount;

  const paperCatalog = getPaperPrintSizes(settings);
  const retabloCatalog = getRetabloSizes(settings);

  let paperTotal = 0;
  let retabloTotal = 0;
  const paperItems = [];
  const retabloItems = [];

  const mergedSizes = normalizePrintedSizes({
    printedSizes,
    printedPhotosCount,
    printedPhotos15x20Count
  });

  for (const item of paperCatalog) {
    const qty = Number(mergedSizes[item.id] || 0);
    if (qty > 0) {
      const subtotal = qty * item.price;
      paperTotal += subtotal;
      paperItems.push({ ...item, quantity: qty, subtotal });
    }
  }

  for (const item of retabloCatalog) {
    const qty = Number(mergedSizes[item.id] || 0);
    if (qty > 0) {
      const subtotal = qty * item.price;
      retabloTotal += subtotal;
      retabloItems.push({ ...item, quantity: qty, subtotal });
    }
  }

  const extrasTotal = paperTotal + retabloTotal;
  const listPrice = priceBeforeDiscount + extrasTotal;
  const maxPrice = listPrice;

  const discountRate = Math.max(0, Number(loyaltyDiscountPercent) || 0) / 100;
  const discountAmount = Math.round(priceBeforeDiscount * discountRate);
  const minPrice = Math.max(0, (priceBeforeDiscount - discountAmount) + extrasTotal);

  return {
    basePrice,
    priceBeforeDiscount,
    surchargeApplied,
    effectiveSurcharge: surchargeApplied,
    extrasPapel: paperTotal,
    extrasRetablos: retabloTotal,
    paperTotal,
    retabloTotal,
    paperItems,
    retabloItems,
    extrasTotal,
    listPrice,
    maxPrice,
    minPrice,
    discountAmount
  };
}

export function validateOrEnforcePrice(clientPrice, band, { fallbackPrice } = {}) {
  const parsedClient = Number(clientPrice);
  const min = band?.minPrice ?? 0;
  const max = band?.listPrice ?? band?.maxPrice ?? 0;

  if (Number.isFinite(parsedClient) && parsedClient > 0 && parsedClient >= min && parsedClient <= max) {
    return {
      accepted: true,
      adjusted: false,
      finalPrice: parsedClient,
      reason: null
    };
  }

  if (!Number.isFinite(parsedClient) || parsedClient <= 0) {
    return {
      accepted: false,
      adjusted: true,
      finalPrice: max,
      reason: 'invalid'
    };
  }

  if (parsedClient < min) {
    return {
      accepted: false,
      adjusted: true,
      finalPrice: min,
      reason: 'below-band'
    };
  }

  return {
    accepted: false,
    adjusted: true,
    finalPrice: max,
    reason: 'above-band'
  };
}
