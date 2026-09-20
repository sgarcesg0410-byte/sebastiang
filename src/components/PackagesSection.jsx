import React from 'react';
import { Check, Image, Star, ArrowRight, Sparkles, Printer, Heart, ShieldCheck, UserCheck } from 'lucide-react';

export default function PackagesSection({ packages = [], onSelectPackage }) {
  const formatPrice = (price) => {
    return Number(price).toLocaleString('es-CO');
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      
      {/* CABECERA CON ESTILO DEL FLYER */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-black uppercase tracking-widest mb-4 shadow-lg shadow-amber-500/10">
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
          Todas las sesiones incluyen entrega digital protegida en alta calidad para que elijas tus fotos favoritas desde tu celular.
        </p>
      </div>

      {/* GRID DE PAQUETES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 ${
              pkg.popular
                ? 'bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 border-2 border-amber-400 shadow-2xl shadow-amber-500/20 lg:-translate-y-2'
                : 'bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 shadow-xl'
            }`}
          >
            {/* Badge de Popular */}
            {pkg.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 text-[11px] font-black px-3.5 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-wider">
                  <Star className="w-3.5 h-3.5 fill-stone-950" />
                  MÁS POPULAR
                </span>
              </div>
            )}

            <div>
              {/* Contador de fotos con +2 GRATIS destacado */}
              <div className="mb-4 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Image className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xl font-bold text-white font-serif block leading-tight">
                        {pkg.photoCount} Fotos
                      </span>
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider">
                        Digitales
                      </span>
                    </div>
                  </div>

                  {/* Badge +2 Gratis */}
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black px-2.5 py-1 rounded-lg">
                    + 2 GRATIS
                  </span>
                </div>
              </div>

              {/* Total de fotos reales recibidas */}
              <div className="bg-stone-950/80 p-2.5 rounded-xl border border-stone-800 text-center mb-5">
                <span className="text-xs text-stone-300">
                  Recibes un total de <strong className="text-amber-400 text-sm">{pkg.totalPhotos || (pkg.photoCount + 2)} fotos</strong>
                </span>
              </div>

              {/* Precio en pesos colombianos */}
              <div className="mb-6 pb-5 border-b border-stone-800">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
                    ${formatPrice(pkg.price)}
                  </span>
                  <span className="text-[11px] text-stone-400 uppercase font-semibold">COP</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  En San Antero • Sin registros previos
                </p>
              </div>

              {/* Características del paquete */}
              <div className="space-y-2.5 mb-6 text-xs text-stone-300">
                {pkg.features && pkg.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botón Reservar */}
            <button
              onClick={() => onSelectPackage(pkg)}
              className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 ${
                pkg.popular
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 shadow-lg shadow-amber-500/30'
                  : 'bg-stone-800 hover:bg-stone-700 text-white border border-stone-700'
              }`}
            >
              <span>Elegir Paquete</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* SERVICIO ADICIONAL: FOTO IMPRESA 10x15 */}
      <div className="mt-10 bg-gradient-to-r from-stone-900 via-amber-950/30 to-stone-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4 text-left">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Printer className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 block">
              Servicio Adicional Opcional
            </span>
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
              Foto Impresa Tamaño 10x15
            </h3>
            <p className="text-xs text-stone-300 mt-1">
              Papel fotográfico profesional de laboratorio con acabado brillante o mate.
            </p>
          </div>
        </div>

        <div className="bg-stone-950 px-6 py-3.5 rounded-2xl border border-stone-800 text-center shrink-0">
          <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
            $7.000
          </span>
          <span className="text-xs text-stone-400 block font-medium">por unidad (COP)</span>
        </div>
      </div>

      {/* 4 PILARES DEL FLYER */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex flex-col items-center">
          <Sparkles className="w-6 h-6 text-amber-400 mb-2" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Entrega Digital</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">En alta calidad</p>
        </div>

        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex flex-col items-center">
          <ShieldCheck className="w-6 h-6 text-amber-400 mb-2" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Edición Profesional</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">Retoque de luz y color</p>
        </div>

        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex flex-col items-center">
          <UserCheck className="w-6 h-6 text-amber-400 mb-2" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Atención Personalizada</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">Guía de poses y locación</p>
        </div>

        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 flex flex-col items-center">
          <Heart className="w-6 h-6 text-amber-400 mb-2" />
          <h4 className="text-xs font-bold uppercase text-white tracking-wider">Tu Satisfacción</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">Es nuestra prioridad</p>
        </div>
      </div>
    </section>
  );
}
