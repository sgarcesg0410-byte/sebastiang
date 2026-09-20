import React from 'react';
import { Check, Image, Star, ArrowRight, Sparkles, Printer, Heart, ShieldCheck, UserCheck, Zap } from 'lucide-react';

export default function PackagesSection({ packages = [], onSelectPackage }) {
  const formatPrice = (price) => {
    return Number(price).toLocaleString('es-CO');
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      
      {/* CABECERA CON ESTILO DEL FLYER */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-black uppercase tracking-widest mb-4 shadow-lg shadow-amber-500/10 animate-pulse">
          <Sparkles className="w-4 h-4 fill-amber-400" />
          <span>PROMO ESPECIAL: INCLUYE + 2 FOTOS GRATIS</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-serif font-bold text-white mb-3">
          Listado de Precios • Fotografía Digital
        </h2>
        
        <p className="text-amber-400/90 font-serif italic text-lg sm:text-xl font-medium">
          "Capturamos momentos, creamos recuerdos. ♡"
        </p>

        <p className="text-stone-400 text-xs sm:text-sm font-light mt-2 max-w-xl mx-auto">
          Toca o pasa el cursor sobre cualquier paquete para ver los detalles y agendar tu fecha al instante.
        </p>
      </div>

      {/* GRID DE PAQUETES CON INTERACTIVIDAD ULTRA RESPONSIVA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {packages.map((pkg) => {
          const isPopular = Boolean(pkg.popular);

          return (
            <div
              key={pkg.id}
              onClick={() => onSelectPackage(pkg)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectPackage(pkg); }}
              className={`group relative rounded-3xl p-6 flex flex-col justify-between cursor-pointer select-none touch-manipulation transition-all duration-300 ease-out hover:-translate-y-3 hover:scale-[1.02] active:scale-[0.98] ${
                isPopular
                  ? 'bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 border-2 border-amber-400 shadow-[0_12px_40px_rgba(245,158,11,0.22)] hover:shadow-[0_22px_60px_rgba(245,158,11,0.38)] lg:-translate-y-2'
                  : 'bg-stone-900/90 border border-stone-800 hover:border-amber-400 hover:shadow-[0_18px_50px_rgba(245,158,11,0.22)] shadow-xl'
              }`}
            >
              {/* DESTELLO DE LUZ DIAGONAL QUE RECORRE LA TARJETA AL PASAR EL MOUSE O TOCAR */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
              </div>

              {/* RESPLANDOR AMBIENTAL SUPERIOR EN HOVER */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              {/* Badge de Popular con destello */}
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                  <span className="bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 text-stone-950 text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 uppercase tracking-wider group-hover:scale-105 group-hover:shadow-amber-500/40 transition-all duration-300">
                    <Star className="w-3.5 h-3.5 fill-stone-950" />
                    MÁS POPULAR
                  </span>
                </div>
              )}

              <div className="relative z-10">
                {/* Cabecera de la tarjeta con icono y badge interactivo */}
                <div className="mb-4 pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-stone-950 group-hover:rotate-6 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-amber-500/30 transition-all duration-300">
                        <Image className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xl font-bold text-white font-serif block leading-tight group-hover:text-amber-300 transition-colors">
                          {pkg.photoCount} Fotos
                        </span>
                        <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
                          Digitales
                        </span>
                      </div>
                    </div>

                    {/* Badge +2 Gratis interactivo */}
                    <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black px-2.5 py-1 rounded-lg group-hover:bg-amber-400 group-hover:text-stone-950 group-hover:scale-110 group-hover:shadow-md group-hover:shadow-amber-500/30 transition-all duration-300">
                      + 2 GRATIS
                    </span>
                  </div>
                </div>

                {/* Total de fotos reales recibidas */}
                <div className="bg-stone-950/80 group-hover:bg-stone-950 p-2.5 rounded-xl border border-stone-800 group-hover:border-amber-500/40 text-center mb-5 transition-colors">
                  <span className="text-xs text-stone-300">
                    Recibes un total de <strong className="text-amber-400 text-sm font-extrabold">{pkg.totalPhotos || (pkg.photoCount + 2)} fotos</strong>
                  </span>
                </div>

                {/* Precio con animación y resplandor al pasar mouse o dedo */}
                <div className="mb-6 pb-5 border-b border-stone-800 group-hover:border-stone-700 transition-colors">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight group-hover:text-amber-300 group-hover:scale-105 inline-block transition-transform duration-300 origin-left">
                      ${formatPrice(pkg.price)}
                    </span>
                    <span className="text-[11px] text-stone-400 uppercase font-bold group-hover:text-amber-400 transition-colors">
                      COP
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1 flex items-center gap-1 font-medium">
                    <span>En San Antero • Sin registros previos</span>
                  </p>
                </div>

                {/* Características del paquete con interacción en cada item */}
                <div className="space-y-3 mb-6 text-xs text-stone-300">
                  {pkg.features && pkg.features.map((feat, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-start gap-2.5 group-hover:translate-x-1 transition-transform duration-200"
                      style={{ transitionDelay: `${idx * 25}ms` }}
                    >
                      <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-500/40 transition-colors">
                        <Check className="w-3 h-3 text-amber-400 stroke-[3] group-hover:text-amber-300" />
                      </div>
                      <span className="leading-snug group-hover:text-stone-100 transition-colors">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botón Reservar con transformación visual al interactuar */}
              <div className="relative z-10 pt-2">
                <div
                  className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 ${
                    isPopular
                      ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/30 group-hover:from-amber-400 group-hover:to-amber-300 group-hover:shadow-xl group-hover:shadow-amber-500/50 group-hover:scale-[1.02]'
                      : 'bg-stone-800 text-white border border-stone-700 group-hover:bg-gradient-to-r group-hover:from-amber-500 group-hover:to-amber-400 group-hover:text-stone-950 group-hover:border-amber-400 group-hover:shadow-lg group-hover:shadow-amber-500/30 group-hover:scale-[1.02]'
                  }`}
                >
                  <span>Elegir Paquete</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SERVICIO ADICIONAL: FOTO IMPRESA 10x15 INTERACTIVO */}
      <div 
        onClick={() => onSelectPackage(packages[0] || null)}
        className="mt-10 group bg-gradient-to-r from-stone-900 via-amber-950/30 to-stone-900 border border-amber-500/40 hover:border-amber-400 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
      >
        <div className="flex items-center gap-4 text-left">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-amber-500 group-hover:text-stone-950 transition-all duration-300">
            <Printer className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 block group-hover:text-amber-300 transition-colors">
              Servicio Adicional Opcional
            </span>
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white group-hover:text-amber-200 transition-colors">
              Foto Impresa Tamaño 10x15
            </h3>
            <p className="text-xs text-stone-300 mt-1">
              Papel fotográfico profesional de laboratorio con acabado brillante o mate. Puedes agregarlas al reservar cualquier paquete.
            </p>
          </div>
        </div>

        <div className="bg-stone-950 px-6 py-3.5 rounded-2xl border border-stone-800 group-hover:border-amber-500/50 text-center shrink-0 transition-colors">
          <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono group-hover:scale-105 inline-block transition-transform">
            $7.000
          </span>
          <span className="text-xs text-stone-400 block font-medium">por unidad (COP)</span>
        </div>
      </div>

      {/* 4 PILARES DEL FLYER CON HOVER SUAVE */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-stone-900/60 hover:bg-stone-900 border border-stone-800/80 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col items-center hover:-translate-y-1 transition-all duration-300 cursor-default group">
          <Sparkles className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Entrega Digital</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">En alta calidad</p>
        </div>

        <div className="bg-stone-900/60 hover:bg-stone-900 border border-stone-800/80 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col items-center hover:-translate-y-1 transition-all duration-300 cursor-default group">
          <ShieldCheck className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Edición Profesional</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">Retoque de luz y color</p>
        </div>

        <div className="bg-stone-900/60 hover:bg-stone-900 border border-stone-800/80 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col items-center hover:-translate-y-1 transition-all duration-300 cursor-default group">
          <UserCheck className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Atención Personalizada</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">Guía de poses y locación</p>
        </div>

        <div className="bg-stone-900/60 hover:bg-stone-900 border border-stone-800/80 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col items-center hover:-translate-y-1 transition-all duration-300 cursor-default group">
          <Heart className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Tu Satisfacción</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">Es nuestra prioridad</p>
        </div>
      </div>
    </section>
  );
}
