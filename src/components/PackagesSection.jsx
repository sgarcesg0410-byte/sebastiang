import React, { useState } from 'react';
import { 
  Check, 
  Image, 
  Star, 
  ArrowRight, 
  Sparkles, 
  Printer, 
  Heart, 
  ShieldCheck, 
  UserCheck, 
  Zap, 
  Maximize2, 
  MessageCircle, 
  Copy, 
  Share2, 
  Calendar, 
  Plus, 
  Minus, 
  RotateCcw, 
  HelpCircle, 
  ExternalLink, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Award
} from 'lucide-react';
import { getPaperPrintSizes, getRetabloSizes } from '../services/api';

export default function PackagesSection({ 
  packages = [], 
  onSelectPackage, 
  onBackToHome,
  settings = {} 
}) {
  const photographerPhone = settings.photographerWhatsApp || '+573244725167';
  const photographerName = settings.photographerName || 'Sebastian G';

  const formatPrice = (price) => {
    return Number(price || 0).toLocaleString('es-CO');
  };

  const paperSizes = getPaperPrintSizes(settings);
  const retabloSizes = getRetabloSizes(settings);

  // Estados interactivos para el cotizador / armador de combo
  const [selectedPackageId, setSelectedPackageId] = useState('pkg-8fotos');
  const [retabloCounts, setRetabloCounts] = useState({
    '20x30': 0,
    '30x45': 0,
    '40x50': 0,
    '50x70': 0,
    '70x50': 0,
    '70x100': 0
  });
  const [paperCounts, setPaperCounts] = useState({
    '10x15': 0,
    '15x20': 0
  });

  const [activeCategoryTab, setActiveCategoryTab] = useState('all'); // 'all' | 'packages' | 'retablos' | 'paper'
  const [copiedToast, setCopiedToast] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Cálculos en tiempo real
  const selectedPackage = packages.find(p => p.id === selectedPackageId);
  const packagePrice = selectedPackage ? Number(selectedPackage.price || 0) : 0;

  const retablosTotal = retabloSizes.reduce((acc, r) => {
    const q = Number(retabloCounts[r.id] || 0);
    return acc + (q * Number(r.price || 0));
  }, 0);
  const retablosCount = retabloSizes.reduce((acc, r) => acc + Number(retabloCounts[r.id] || 0), 0);

  const paperTotal = paperSizes.reduce((acc, p) => {
    const q = Number(paperCounts[p.id] || 0);
    return acc + (q * Number(p.price || 0));
  }, 0);
  const paperCount = paperSizes.reduce((acc, p) => acc + Number(paperCounts[p.id] || 0), 0);

  const grandTotal = packagePrice + retablosTotal + paperTotal;
  const hasAnySelection = Boolean(selectedPackage || retablosCount > 0 || paperCount > 0);
  const totalItemCount = (selectedPackage ? 1 : 0) + retablosCount + paperCount;

  // Manejo de cantidades de retablos
  const updateRetabloQty = (id, delta) => {
    setRetabloCounts(prev => ({
      ...prev,
      [id]: Math.max(0, (Number(prev[id] || 0) + delta))
    }));
  };

  // Manejo de cantidades de fotos en papel
  const updatePaperQty = (id, delta) => {
    setPaperCounts(prev => ({
      ...prev,
      [id]: Math.max(0, (Number(prev[id] || 0) + delta))
    }));
  };

  // Reiniciar combo
  const handleResetCombo = () => {
    setSelectedPackageId(null);
    setRetabloCounts({
      '20x30': 0,
      '30x45': 0,
      '40x50': 0,
      '50x70': 0,
      '70x50': 0,
      '70x100': 0
    });
    setPaperCounts({
      '10x15': 0,
      '15x20': 0
    });
  };

  // Generador de mensaje pre-armado para WhatsApp
  const generateWhatsAppUrl = () => {
    const cleanPhone = photographerPhone.replace(/\D/g, '');
    if (!hasAnySelection) {
      const defaultMsg = `¡Hola ${photographerName}! 👋 Estuve revisando tu página de tarifas y paquetes en sebastiang.app/tarifas.\n\nMe gustaría consultar disponibilidad para una sesión fotográfica y conocer más detalles. ¿Qué fechas tienes disponibles?`;
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultMsg)}`;
    }

    let msg = `¡Hola ${photographerName}! 👋 Estuve viendo tus tarifas en sebastiang.app/tarifas y me gustaría cotizar / apartar el siguiente combo:\n\n`;

    if (selectedPackage) {
      msg += `📸 *PAQUETE DIGITAL:*\n`;
      msg += `• ${selectedPackage.photoCount} Fotos Digitales (+${selectedPackage.freePhotos || 2} GRATIS - Total: ${selectedPackage.totalPhotos || (selectedPackage.photoCount + 2)} fotos)\n`;
      msg += `• Tarifa: $${formatPrice(selectedPackage.price)} COP\n`;
      msg += `• Duración: ${selectedPackage.duration || 'Flexible'}\n\n`;
    }

    const chosenRetablos = retabloSizes.filter(r => (retabloCounts[r.id] || 0) > 0);
    if (chosenRetablos.length > 0) {
      msg += `🪵 *CUADROS EN RETABLO (Madera + UV):*\n`;
      chosenRetablos.forEach(r => {
        const q = retabloCounts[r.id];
        const sub = q * r.price;
        msg += `• ${q}x Retablo ${r.dimensions} = $${formatPrice(sub)} COP ($${formatPrice(r.price)} c/u)\n`;
      });
      msg += `\n`;
    }

    const chosenPaper = paperSizes.filter(p => (paperCounts[p.id] || 0) > 0);
    if (chosenPaper.length > 0) {
      msg += `🖼️ *FOTOS IMPRESAS EN PAPEL DE LABORATORIO:*\n`;
      chosenPaper.forEach(p => {
        const q = paperCounts[p.id];
        const sub = q * p.price;
        msg += `• ${q}x Foto en papel ${p.dimensions} = $${formatPrice(sub)} COP ($${formatPrice(p.price)} c/u)\n`;
      });
      msg += `\n`;
    }

    msg += `💰 *TOTAL ESTIMADO:* $${formatPrice(grandTotal)} COP\n\n`;
    msg += `¿Tienes disponibilidad de fechas para apartar esta sesión? ¡Muchas gracias!`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  // Copiar enlace de tarifas para compartir
  const handleCopyLink = () => {
    const url = 'https://sebastiang.app/tarifas';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3500);
    }
  };

  // Compartir directamente por WhatsApp web / app
  const handleShareWhatsApp = () => {
    const shareText = `¡Hola! Aquí tienes la lista oficial de paquetes de fotos, cuadros en retablo y fotos impresas de ${photographerName}: https://sebastiang.app/tarifas`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  // Iniciar reserva en línea con el combo seleccionado
  const handleBookWithCombo = () => {
    if (onSelectPackage) {
      const combo = {
        packageId: selectedPackage?.id || packages[0]?.id,
        printedSizes: { ...retabloCounts },
        printedPhotosCount: paperCounts['10x15'] || 0,
        printedPhotos15x20Count: paperCounts['15x20'] || 0
      };
      onSelectPackage(selectedPackage || packages[0], combo);
    }
  };

  const faqList = [
    {
      q: '¿Cómo aparto mi fecha para la sesión?',
      a: 'Puedes apartar tu cupo con un anticipo de solo $20.000 COP a través de Nequi (324 472 5167), DaviPlata (@PLATA3244725167) o tarjeta en línea. El saldo restante se cancela el día de la sesión.'
    },
    {
      q: '¿Cómo y cuándo me entregan las fotos?',
      a: 'En un plazo de 2 a 3 días hábiles recibirás un enlace privado exclusivo a tu WhatsApp. Desde allí podrás ver tus fotos en alta calidad, elegir tus favoritas y descargarlas directamente en tu celular o computador.'
    },
    {
      q: '¿Qué características tienen los cuadros en retablo?',
      a: 'Están elaborados sobre bastidor de madera maciza de alta durabilidad con cantos biselados en color negro mate. La fotografía cuenta con laminado de protección UV antirreflejo y antipolvo, por lo que no se raya, no le entra humedad, no requiere vidrio y viene con soporte metálico listo para colgar.'
    },
    {
      q: '¿Qué tipo de papel utilizan para las fotos impresas?',
      a: 'Utilizamos papel fotográfico profesional de laboratorio químico de 300 DPI (no impresiones caseras de inyección). Garantiza colores reales, máxima nitidez y una preservación que no se decolora con los años.'
    },
    {
      q: '¿Puedo pedir retablos o fotos impresas después de la sesión?',
      a: '¡Sí! Al recibir tu enlace privado de selección por WhatsApp, podrás añadir retablos e impresiones con las fotos que más te hayan gustado.'
    },
    {
      q: '¿Realizas sesiones en otras playas o ciudades?',
      a: 'Sí, realizamos sesiones en exteriores, playas, cabañas o locaciones en San Antero, Coveñas, Tolú y cualquier rincón de Colombia. Si la locación requiere traslados especiales, se coordina el viático de forma transparente.'
    }
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative pb-32">
      
      {/* NOTIFICACIÓN TOAST FLOTANTE AL COPIAR EL LINK */}
      {copiedToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-stone-900 border-2 border-emerald-500 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs sm:text-sm font-medium">
            <strong className="text-emerald-400 block font-bold">¡Enlace copiado con éxito!</strong>
            Listo para enviar por WhatsApp: <span className="font-mono text-stone-300">sebastiang.app/tarifas</span>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR DE ACCIONES RÁPIDAS Y COMPARTIR */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8 pb-4 border-b border-stone-800/80">
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-400 hover:text-amber-400 transition-colors py-1.5 px-3 rounded-xl bg-stone-900/60 hover:bg-stone-900 border border-stone-800 cursor-pointer"
          >
            <span>← Ver Portafolio (Fotos Reales)</span>
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-300 hover:text-white py-1.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 hover:border-amber-400/50 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Copiar enlace para enviar por WhatsApp"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" />
            <span>Copiar Enlace</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-emerald-200 py-1.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 hover:border-emerald-400 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Compartir link por WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Compartir WhatsApp</span>
          </button>
        </div>
      </div>

      {/* CABECERA PRINCIPAL CON ESTILO DE LUJO */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-black uppercase tracking-widest mb-4 shadow-lg shadow-amber-500/10">
          <Sparkles className="w-4 h-4 fill-amber-400 animate-spin text-amber-400" />
          <span>PROMO 2026: TODOS LOS PAQUETES INCLUYEN +2 FOTOS GRATIS</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white mb-3 tracking-tight">
          Tarifas y Servicios • Sebastian G
        </h1>
        
        <p className="text-amber-400/90 font-serif italic text-lg sm:text-xl font-medium mb-3">
          "Capturamos momentos, creamos recuerdos. ♡"
        </p>

        <p className="text-stone-300 text-xs sm:text-sm font-light max-w-2xl mx-auto leading-relaxed">
          Encuentra en este único enlace nuestros <strong>paquetes de fotos digitales</strong>, <strong>cuadros en retablo de madera</strong> y <strong>fotos impresas de laboratorio</strong>. Puedes armar tu propio combo personalizado o cotizar directo a mi WhatsApp con un solo toque.
        </p>
      </div>

      {/* BARRA DE NAVEGACIÓN RÁPIDA POR CATEGORÍAS */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap mb-10">
        <button
          type="button"
          onClick={() => setActiveCategoryTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeCategoryTab === 'all'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/25 scale-105'
              : 'bg-stone-900 text-stone-300 hover:text-white border border-stone-800 hover:border-stone-700'
          }`}
        >
          ✨ Todo el Catálogo
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('packages')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeCategoryTab === 'packages'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/25 scale-105'
              : 'bg-stone-900 text-stone-300 hover:text-white border border-stone-800 hover:border-stone-700'
          }`}
        >
          <Image className="w-3.5 h-3.5" />
          <span>📸 Paquetes Digitales ({packages.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('retablos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeCategoryTab === 'retablos'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/25 scale-105'
              : 'bg-stone-900 text-stone-300 hover:text-white border border-stone-800 hover:border-stone-700'
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>🪵 Cuadros en Retablo ({retabloSizes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('paper')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeCategoryTab === 'paper'
              ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/25 scale-105'
              : 'bg-stone-900 text-stone-300 hover:text-white border border-stone-800 hover:border-stone-700'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>🖼️ Fotos en Papel ({paperSizes.length})</span>
        </button>
      </div>

      {/* 1. SECCIÓN: PAQUETES DE FOTOS DIGITALES */}
      {(activeCategoryTab === 'all' || activeCategoryTab === 'packages') && (
        <div className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 pb-3 border-b border-stone-800">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-2">
                <Image className="w-3.5 h-3.5" />
                <span>Paso 1: Selecciona tu Paquete de Fotos</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
                Paquetes de Fotografía Digital
              </h2>
            </div>
            <p className="text-xs text-stone-400 max-w-sm sm:text-right">
              Toca el paquete deseado para marcarlo en tu combo. Todos incluyen edición profesional y entrega en alta calidad.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {packages.map((pkg) => {
              const isSelected = selectedPackageId === pkg.id;
              const isPopular = Boolean(pkg.popular);

              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackageId(isSelected ? null : pkg.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPackageId(isSelected ? null : pkg.id); }}
                  className={`group relative rounded-3xl p-6 flex flex-col justify-between cursor-pointer select-none touch-manipulation transition-all duration-300 ease-out hover:-translate-y-2 ${
                    isSelected
                      ? 'bg-gradient-to-b from-stone-900 via-stone-900 to-amber-950/40 border-2 border-amber-400 ring-4 ring-amber-400/20 shadow-[0_12px_40px_rgba(245,158,11,0.3)]'
                      : isPopular
                        ? 'bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 border-2 border-amber-400/60 shadow-[0_8px_30px_rgba(245,158,11,0.15)] hover:border-amber-400'
                        : 'bg-stone-900/90 border border-stone-800 hover:border-stone-600 shadow-xl'
                  }`}
                >
                  {/* Badge de Popular */}
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                      <span className="bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 text-stone-950 text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 uppercase tracking-wider">
                        <Star className="w-3.5 h-3.5 fill-stone-950" />
                        MÁS POPULAR
                      </span>
                    </div>
                  )}

                  <div className="relative z-10">
                    {/* Encabezado del paquete */}
                    <div className="mb-4 pt-1 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          isSelected ? 'bg-amber-400 text-stone-950 shadow-md shadow-amber-400/30' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                        }`}>
                          <Image className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xl font-bold text-white font-serif block leading-tight">
                            {pkg.photoCount} Fotos
                          </span>
                          <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
                            Digitales
                          </span>
                        </div>
                      </div>

                      <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black px-2.5 py-1 rounded-lg">
                        + 2 GRATIS
                      </span>
                    </div>

                    {/* Total de fotos reales recibidas */}
                    <div className={`p-2.5 rounded-xl border text-center mb-5 transition-colors ${
                      isSelected ? 'bg-amber-500/15 border-amber-400/50' : 'bg-stone-950/80 border-stone-800'
                    }`}>
                      <span className="text-xs text-stone-300">
                        Recibes un total de <strong className="text-amber-400 text-sm font-extrabold">{pkg.totalPhotos || (pkg.photoCount + 2)} fotos</strong>
                      </span>
                    </div>

                    {/* Precio */}
                    <div className="mb-5 pb-4 border-b border-stone-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
                          ${formatPrice(pkg.price)}
                        </span>
                        <span className="text-[11px] text-stone-400 uppercase font-bold">
                          COP
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-stone-400 mt-2 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          {pkg.duration || '1 hora'}
                        </span>
                        <span>•</span>
                        <span>{pkg.outfits || 'Cambios incluidos'}</span>
                      </div>
                    </div>

                    {/* Características */}
                    <div className="space-y-2.5 mb-6 text-xs text-stone-300">
                      {pkg.features && pkg.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-amber-400 stroke-[3]" />
                          </div>
                          <span className="leading-snug">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botón de selección interactivo */}
                  <div className="relative z-10 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPackageId(isSelected ? null : pkg.id);
                      }}
                      className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-stone-950 shadow-lg shadow-amber-400/40 ring-2 ring-amber-300'
                          : isPopular
                            ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300'
                            : 'bg-stone-800 text-white border border-stone-700 hover:border-amber-400 hover:text-amber-300'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 fill-stone-950 text-amber-400" />
                          <span>✓ Paquete Seleccionado</span>
                        </>
                      ) : (
                        <>
                          <span>Seleccionar Paquete</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. SECCIÓN: CUADROS EN RETABLO (MADERA DE LUJO) */}
      {(activeCategoryTab === 'all' || activeCategoryTab === 'retablos') && (
        <div className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 pb-3 border-b border-stone-800">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-2">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Paso 2: Añade Cuadros en Retablo (Madera + UV)</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
                Cuadros en Retablo de Madera
              </h2>
            </div>
            <p className="text-xs text-stone-400 max-w-sm sm:text-right">
              Montados sobre madera MDF maciza con cantos pulidos y película protectora UV. Listos para colgar.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {retabloSizes.map((item) => {
              const count = Number(retabloCounts[item.id] || 0);
              const isAdded = count > 0;

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ${
                    isAdded
                      ? 'bg-stone-900 border-2 border-amber-400 ring-2 ring-amber-400/20 shadow-[0_8px_25px_rgba(245,158,11,0.2)]'
                      : 'bg-stone-900/80 hover:bg-stone-900 border border-amber-500/20 hover:border-amber-400/60 shadow-lg'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {item.tag}
                      </span>
                      <div className="flex items-center gap-1 text-stone-400 text-[11px] font-mono">
                        <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Madera UV</span>
                      </div>
                    </div>

                    <div className="space-y-1 mb-3">
                      <h3 className="text-2xl font-bold font-mono text-white group-hover:text-amber-300 transition-colors">
                        {item.dimensions}
                      </h3>
                      <p className="text-xs text-stone-400 leading-snug">
                        {item.desc}
                      </p>
                    </div>

                    <div className="py-2 flex items-baseline justify-between border-t border-stone-800">
                      <div>
                        <span className="text-2xl font-black font-mono text-amber-400">
                          ${formatPrice(item.price)}
                        </span>
                        <span className="text-[10px] text-stone-500 uppercase block font-medium">COP / Cuadro</span>
                      </div>
                      {isAdded && (
                        <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                          Subtotal: ${formatPrice(count * item.price)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Controles interactivos de cantidad */}
                  <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-stone-300">
                      Cantidad:
                    </span>
                    <div className="flex items-center gap-2 bg-stone-950 px-2 py-1 rounded-xl border border-stone-700">
                      <button
                        type="button"
                        onClick={() => updateRetabloQty(item.id, -1)}
                        disabled={count <= 0}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-colors cursor-pointer ${
                          count > 0 ? 'bg-stone-800 text-stone-200 hover:bg-stone-700' : 'text-stone-600 cursor-not-allowed'
                        }`}
                        aria-label={`Restar ${item.dimensions}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-mono font-bold text-sm text-white">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateRetabloQty(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-400 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer shadow-sm"
                        aria-label={`Sumar ${item.dimensions}`}
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Banner de Calidad de los Retablos */}
          <div className="mt-6 p-4 rounded-2xl bg-stone-900/60 border border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">
                  ¿Por qué nuestros cuadros en retablo son de máxima calidad?
                </p>
                <p className="text-stone-400 text-xs mt-0.5">
                  Laminado UV mate antirreflejo (no se raya, no le entra humedad ni polvo). Base en madera MDF gruesa con cantos biselados y pulidos en color negro, con herraje metálico listo para colgar de inmediato.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SECCIÓN: FOTOS IMPRESAS EN PAPEL FOTOGRÁFICO DE LABORATORIO */}
      {(activeCategoryTab === 'all' || activeCategoryTab === 'paper') && (
        <div className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 pb-3 border-b border-stone-800">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-2">
                <Printer className="w-3.5 h-3.5" />
                <span>Paso 3: Fotos Impresas en Papel Fotográfico</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
                Impresiones de Laboratorio Químico
              </h2>
            </div>
            <p className="text-xs text-stone-400 max-w-sm sm:text-right">
              Papel fotográfico profesional de 300 DPI. Colores nítidos ideales para álbumes o portarretratos de mesa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto gap-5">
            {paperSizes.map((item) => {
              const count = Number(paperCounts[item.id] || 0);
              const isAdded = count > 0;

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ${
                    isAdded
                      ? 'bg-stone-900 border-2 border-amber-400 ring-2 ring-amber-400/20 shadow-[0_8px_25px_rgba(245,158,11,0.2)]'
                      : 'bg-stone-900/80 hover:bg-stone-900 border border-stone-800 hover:border-amber-400/60 shadow-lg'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-stone-800 text-stone-200 border border-stone-700">
                        {item.tag}
                      </span>
                      <Printer className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
                    </div>

                    <div className="space-y-1 mb-3">
                      <h3 className="text-2xl font-bold font-mono text-white group-hover:text-amber-300 transition-colors">
                        {item.dimensions}
                      </h3>
                      <p className="text-xs text-stone-400 leading-snug">
                        {item.desc}
                      </p>
                    </div>

                    <div className="py-2 flex items-baseline justify-between border-t border-stone-800">
                      <div>
                        <span className="text-2xl font-black font-mono text-amber-400">
                          ${formatPrice(item.price)}
                        </span>
                        <span className="text-[10px] text-stone-500 uppercase block font-medium">COP / Foto en papel</span>
                      </div>
                      {isAdded && (
                        <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                          Subtotal: ${formatPrice(count * item.price)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Controles interactivos de cantidad */}
                  <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-stone-300">
                      Cantidad de copias:
                    </span>
                    <div className="flex items-center gap-2 bg-stone-950 px-2 py-1 rounded-xl border border-stone-700">
                      <button
                        type="button"
                        onClick={() => updatePaperQty(item.id, -1)}
                        disabled={count <= 0}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-colors cursor-pointer ${
                          count > 0 ? 'bg-stone-800 text-stone-200 hover:bg-stone-700' : 'text-stone-600 cursor-not-allowed'
                        }`}
                        aria-label={`Restar ${item.dimensions}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-mono font-bold text-sm text-white">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => updatePaperQty(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-400 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer shadow-sm"
                        aria-label={`Sumar ${item.dimensions}`}
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. PANEL RESUMEN DEL COMBO Y COTIZADOR DIRECTO */}
      <div className="mb-16 p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 border-2 border-amber-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Resumen de tu Cotización en Vivo</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white">
              ¿Listo para consultar disponibilidad o apartar?
            </h3>

            {/* Desglose de lo seleccionado */}
            <div className="space-y-1.5 text-xs sm:text-sm text-stone-300 bg-stone-950/70 p-4 rounded-2xl border border-stone-800">
              {selectedPackage ? (
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-1.5 text-stone-200">
                    <Image className="w-4 h-4 text-amber-400" />
                    Paquete: {selectedPackage.photoCount} Fotos (+2 Gratis = {selectedPackage.totalPhotos || (selectedPackage.photoCount + 2)})
                  </span>
                  <span className="font-mono font-bold text-white">${formatPrice(selectedPackage.price)} COP</span>
                </div>
              ) : (
                <div className="text-stone-500 italic">
                  • Sin paquete digital marcado (puedes cotizar solo retablos o impresiones).
                </div>
              )}

              {retablosCount > 0 && (
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-1.5 text-stone-200">
                    <Maximize2 className="w-4 h-4 text-amber-400" />
                    {retablosCount}x {retablosCount === 1 ? 'Cuadro en Retablo' : 'Cuadros en Retablo'}
                  </span>
                  <span className="font-mono font-bold text-white">${formatPrice(retablosTotal)} COP</span>
                </div>
              )}

              {paperCount > 0 && (
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-1.5 text-stone-200">
                    <Printer className="w-4 h-4 text-amber-400" />
                    {paperCount}x {paperCount === 1 ? 'Foto Impresa en Papel' : 'Fotos Impresas en Papel'}
                  </span>
                  <span className="font-mono font-bold text-white">${formatPrice(paperTotal)} COP</span>
                </div>
              )}

              <div className="pt-2 mt-2 border-t border-stone-800 flex items-center justify-between text-base sm:text-lg font-bold">
                <span className="text-amber-400">Total Estimado del Combo:</span>
                <span className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
                  ${formatPrice(grandTotal)} <span className="text-xs text-stone-400 font-sans font-normal">COP</span>
                </span>
              </div>
            </div>

            {hasAnySelection && (
              <button
                type="button"
                onClick={handleResetCombo}
                className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reiniciar selección y empezar de nuevo</span>
              </button>
            )}
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col gap-3 min-w-[280px]">
            <a
              href={generateWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-stone-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/25 active:scale-98 transition-all cursor-pointer"
            >
              <MessageCircle className="w-5 h-5 fill-stone-950" />
              <span>Enviar Cotización a WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleBookWithCombo}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-stone-950" />
              <span>Agendar Fecha en Línea</span>
            </button>

            <p className="text-[11px] text-stone-400 text-center">
              Anticipo de solo $20.000 COP para apartar fecha. Saldo restante el día de la sesión.
            </p>
          </div>
        </div>
      </div>

      {/* 5. 4 PILARES Y GARANTÍAS DE CALIDAD */}
      <div className="mb-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-stone-900/60 hover:bg-stone-900 border border-stone-800 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col items-center transition-all cursor-default">
          <Sparkles className="w-6 h-6 text-amber-400 mb-2" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Entrega Digital</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">Enlace privado en alta calidad</p>
        </div>

        <div className="bg-stone-900/60 hover:bg-stone-900 border border-stone-800 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col items-center transition-all cursor-default">
          <ShieldCheck className="w-6 h-6 text-amber-400 mb-2" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Edición Profesional</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">Retoque de luz, color y piel</p>
        </div>

        <div className="bg-stone-900/60 hover:bg-stone-900 border border-stone-800 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col items-center transition-all cursor-default">
          <UserCheck className="w-6 h-6 text-amber-400 mb-2" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Atención Personalizada</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">Guía de poses y locación</p>
        </div>

        <div className="bg-stone-900/60 hover:bg-stone-900 border border-stone-800 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col items-center transition-all cursor-default">
          <Heart className="w-6 h-6 text-amber-400 mb-2" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Satisfacción Garantizada</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">Tus recuerdos en las mejores manos</p>
        </div>
      </div>

      {/* 6. SECCIÓN DE PREGUNTAS FRECUENTES (FAQ) */}
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900 border border-stone-800 text-stone-300 text-xs font-semibold mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Preguntas Frecuentes</span>
          </div>
          <h3 className="text-2xl font-serif font-bold text-white">
            Todo lo que necesitas saber
          </h3>
        </div>

        <div className="space-y-3">
          {faqList.map((item, idx) => {
            const isOpen = expandedFaq === idx;

            return (
              <div 
                key={idx}
                className="rounded-2xl bg-stone-900/80 border border-stone-800 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 text-sm font-semibold text-white hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs sm:text-sm text-stone-300 border-t border-stone-800/80 pt-3 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BARRA FLOTANTE STICKY INFERIOR PARA MÓVILES (PERMITE COTIZAR AL INSTANTE MIENTRAS SE HACE SCROLL) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur-md border-t border-stone-800/90 p-3 sm:p-4 shadow-2xl block lg:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
              {totalItemCount > 0 ? `${totalItemCount} ítems en tu combo` : 'Total Estimado'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black font-mono text-white">
                ${formatPrice(grandTotal)}
              </span>
              <span className="text-[10px] font-bold text-stone-400">COP</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={generateWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-stone-950" />
              <span>WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleBookWithCombo}
              className="py-2.5 px-3 rounded-xl bg-amber-500 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Agendar</span>
            </button>
          </div>
        </div>
      </div>

    </section>
  );
}
