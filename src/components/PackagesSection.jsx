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
  Maximize2, 
  Clock, 
  Award
} from 'lucide-react';
import { getPaperPrintSizes, getRetabloSizes } from '../services/api';

export default function PackagesSection({ 
  packages = [], 
  onSelectPackage, 
  onBackToHome,
  settings = {} 
}) {
  const formatPrice = (price) => {
    return Number(price || 0).toLocaleString('es-CO');
  };

  const paperSizes = getPaperPrintSizes(settings);
  const retabloSizes = getRetabloSizes(settings);

  // Lectura de parámetro opcional de cliente para propuestas personalizadas
  const [clientName] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('cliente') || p.get('c') || '';
    }
    return '';
  });

  const [activeCategoryTab, setActiveCategoryTab] = useState('all'); // 'all' | 'packages' | 'retablos' | 'paper'

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative pb-16">
      
      {/* CABECERA PRINCIPAL CON ESTILO DE LUJO */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        {clientName ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm font-semibold mb-4 shadow-lg shadow-amber-500/5">
            <span>✨ Propuesta personalizada para:</span>
            <span className="font-bold text-white underline decoration-amber-400">{clientName}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-black uppercase tracking-widest mb-4 shadow-lg shadow-amber-500/10">
            <Sparkles className="w-4 h-4 fill-amber-400 animate-spin text-amber-400" />
            <span>PROMO 2026: TODOS LOS PAQUETES INCLUYEN +2 FOTOS GRATIS</span>
          </div>
        )}

        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white mb-3 tracking-tight">
          {clientName ? `Propuesta Fotográfica • ${clientName}` : 'Paquetes, Retablos e Impresiones • Sebastian G'}
        </h1>
        
        <p className="text-amber-400/90 font-serif italic text-lg sm:text-xl font-medium mb-3">
          "Capturamos momentos, creamos recuerdos. ♡"
        </p>

        <p className="text-stone-300 text-xs sm:text-sm font-light max-w-2xl mx-auto leading-relaxed">
          Encuentra nuestros <strong>paquetes de fotos digitales</strong>, <strong>cuadros en retablo de madera</strong> y <strong>fotos impresas de laboratorio químico</strong>. Elige el paquete que más te guste para agendar tu fecha en línea.
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
          <span>🖼️ Fotos Impresas ({paperSizes.length})</span>
        </button>
      </div>

      {/* 1. SECCIÓN: PAQUETES DIGITALES */}
      {(activeCategoryTab === 'all' || activeCategoryTab === 'packages') && (
        <div className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 pb-3 border-b border-stone-800">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-2">
                <Image className="w-3.5 h-3.5" />
                <span>Paso 1: Paquetes Digitales</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
                Elige tu Paquete de Fotos
              </h2>
            </div>
            <p className="text-xs text-stone-400 max-w-sm sm:text-right">
              Todos los paquetes incluyen galería privada online, descarga en alta resolución y retoque profesional.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {packages.map((pkg) => {
              const isPopular = pkg.id === 'pkg-12fotos' || pkg.photoCount === 12;

              return (
                <div
                  key={pkg.id}
                  onClick={() => onSelectPackage ? onSelectPackage(pkg) : null}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onSelectPackage) onSelectPackage(pkg); }}
                  className={`group relative rounded-3xl p-6 flex flex-col justify-between cursor-pointer select-none touch-manipulation transition-all duration-300 ease-out hover:-translate-y-2 ${
                    isPopular
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
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-amber-500/10 border border-amber-500/30 text-amber-400">
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
                    <div className="p-2.5 rounded-xl border text-center mb-5 transition-colors bg-stone-950/80 border-stone-800">
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

                  {/* Botón para reservar paquete */}
                  <div className="relative z-10 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectPackage) onSelectPackage(pkg);
                      }}
                      className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer ${
                        isPopular
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-300 hover:shadow-amber-500/40'
                          : 'bg-stone-800 text-white border border-stone-700 hover:border-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <span>Elegir Paquete</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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
                <span>Madera de Lujo • Listos para Colgar</span>
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
            {retabloSizes.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectPackage ? onSelectPackage(packages[0] || null) : null}
                className="group relative bg-stone-900/90 hover:bg-stone-900 border border-amber-500/20 hover:border-amber-400/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg hover:shadow-xl hover:shadow-amber-500/15 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 group-hover:bg-amber-400 group-hover:text-stone-950 transition-colors">
                      {item.tag}
                    </span>
                    <Maximize2 className="w-4 h-4 text-amber-500/60 group-hover:text-amber-400 transition-colors" />
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
                      <span className="text-2xl font-black font-mono text-amber-400 group-hover:text-amber-300 transition-colors">
                        ${formatPrice(item.price)}
                      </span>
                      <span className="text-[10px] text-stone-500 uppercase block font-medium">COP / Cuadro</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between">
                  <span className="text-xs text-stone-400 font-medium">Madera maciza + UV</span>
                  <span className="text-xs font-bold text-amber-400/90 group-hover:text-amber-300 flex items-center gap-1">
                    <span>Pedir Retablo</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Banner de Calidad de los Retablos */}
          <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-stone-900/60 border border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-300">
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
            <button
              type="button"
              onClick={() => onSelectPackage ? onSelectPackage(packages[0] || null) : null}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-black text-xs uppercase tracking-wider shrink-0 hover:from-amber-300 hover:to-amber-400 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Agendar con Retablos
            </button>
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
                <span>Laboratorio Químico Profesional</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
                Impresiones en Papel Fotográfico
              </h2>
            </div>
            <p className="text-xs text-stone-400 max-w-sm sm:text-right">
              Papel fotográfico profesional de 300 DPI. Colores nítidos ideales para álbumes o portarretratos de mesa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto gap-5">
            {paperSizes.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectPackage ? onSelectPackage(packages[0] || null) : null}
                className="group relative bg-stone-900/90 hover:bg-stone-900 border border-amber-500/20 hover:border-amber-400/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg hover:shadow-xl hover:shadow-amber-500/15 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 group-hover:bg-amber-400 group-hover:text-stone-950 transition-colors">
                      {item.tag}
                    </span>
                    <Printer className="w-4 h-4 text-amber-500/60 group-hover:text-amber-400 transition-colors" />
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
                      <span className="text-2xl font-black font-mono text-amber-400 group-hover:text-amber-300 transition-colors">
                        ${formatPrice(item.price)}
                      </span>
                      <span className="text-[10px] text-stone-500 uppercase block font-medium">COP / Foto en papel</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between">
                  <span className="text-xs text-stone-400 font-medium">Papel fotográfico 300 DPI</span>
                  <span className="text-xs font-bold text-amber-400/90 group-hover:text-amber-300 flex items-center gap-1">
                    <span>Pedir Foto Impresa</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. PILARES Y GARANTÍAS DE CALIDAD */}
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
    </section>
  );
}
