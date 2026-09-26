import React from 'react';
import { Sparkles, Camera, MapPin, Heart, CheckCircle2, Flame, Award } from 'lucide-react';

export default function AboutSection({ onNavigateToPackages, onOpenBooking }) {
  return (
    <section id="about-section" className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto select-none">
      {/* TARJETA ESTILO EDITORIAL INSPIRADA EN TU REFERENCIA CON BORDE DORADO Y ESTÉTICA MODERNA */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#1a2536] via-[#101927] to-[#0c121d] border border-amber-500/30 shadow-2xl shadow-black/80 p-6 sm:p-10 lg:p-12">
        {/* Luces ambientales decorativas */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* COLUMNA IZQUIERDA (7 COLS): TEXTO COMERCIAL, JUVENIL Y ENÉRGICO */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Tag superior */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>MI HISTORIA • DETRÁS DEL LENTE</span>
            </div>

            {/* Título elegante y moderno */}
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight leading-tight">
              ¿Quién <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500">soy?</span>
            </h2>

            {/* Texto comercial y juvenil */}
            <div className="space-y-4 text-slate-300 font-light text-sm sm:text-base leading-relaxed">
              <p>
                ¡Ey, qué tal! Soy <strong className="text-amber-400 font-bold">Sebastian G</strong>. Para mí, la fotografía va mucho más allá de una pose forzada o acartonada: se trata de capturar tu <strong className="text-white font-semibold">auténtica vibra</strong>, esa risa espontánea, la complicidad con tu pareja o ese flow único que surge cuando disfrutas de verdad.
              </p>
              <p>
                En las playas de <span className="text-amber-300 font-medium">San Antero, Coveñas</span> o cualquier rincón especial, convertimos cada instante en fotografías con <strong className="text-white font-semibold">estética cinematográfica</strong>, iluminación de revista y listas para romperla en tu <strong className="text-pink-400 font-semibold">Instagram & TikTok</strong> con máxima nitidez 4K.
              </p>
              <p className="text-xs sm:text-sm text-slate-400 italic">
                "Cero estrés frente a la cámara: te guío con naturalidad, buena música y la mejor energía caribeña para que vivas una experiencia inolvidable. ¡Capturamos momentos, creamos recuerdos! ♡"
              </p>
            </div>

            {/* Píldoras de propuesta de valor para jóvenes y clientes modernos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-700/60 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-left">
                  <span className="text-[11px] font-bold text-white block">Flow & Estilo</span>
                  <span className="text-[10px] text-slate-400 block">Poses naturales</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-700/60 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-left">
                  <span className="text-[11px] font-bold text-white block">Nitidez 4K</span>
                  <span className="text-[10px] text-slate-400 block">Colorimetría cine</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-700/60 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-left">
                  <span className="text-[11px] font-bold text-white block">+2 Fotos Gratis</span>
                  <span className="text-[10px] text-slate-400 block">Obsequio en paquetes</span>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
              {onNavigateToPackages && (
                <button
                  type="button"
                  onClick={onNavigateToPackages}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 fill-stone-950 text-stone-950" />
                  <span>Conocer Paquetes & Sesiones</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('catalog-gallery-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 text-slate-200 hover:text-white font-bold text-xs sm:text-sm transition-all active:scale-95"
              >
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Explorar Mis Fotografías</span>
              </button>
            </div>
          </div>

          {/* COLUMNA DERECHA (5 COLS): FOTO DE SEBASTIAN G EN CÍRCULO CON BORDE DORADO */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center pt-4 lg:pt-0">
            <div className="relative group">
              {/* Resplandor dorado ambiental animado suave */}
              <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600 opacity-40 blur-2xl group-hover:opacity-75 transition-opacity duration-700 pointer-events-none" />

              {/* Borde dorado de lujo en gradiente */}
              <div className="relative p-2 sm:p-2.5 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-300 to-amber-500 shadow-2xl shadow-amber-500/30">
                {/* Contenedor circular con la fotografía real de Sebastian G */}
                <div className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-80 lg:h-80 rounded-full overflow-hidden border-4 border-stone-950 bg-stone-900 select-none">
                  <img
                    src="/sebastiang-perfil.jpg"
                    alt="Sebastian G - Fotógrafo Profesional"
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500 select-none"
                    draggable="false"
                  />
                </div>
              </div>

              {/* Badge flotante inferior con verificación */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-stone-950/95 border border-amber-500/60 backdrop-blur-md px-4 py-1.5 rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-serif font-bold text-white tracking-wide">
                  Sebastian G <span className="text-amber-400 font-sans font-normal">| Fotógrafo Titular</span>
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
              </div>
            </div>

            {/* Locación y firma */}
            <div className="mt-6 text-center space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-300/90 font-medium">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>San Antero & Coveñas, Colombia</span>
              </span>
              <p className="text-[11px] text-slate-400 font-light">
                Disponible para sesiones en la playa, parejas, urbanas y eventos.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
