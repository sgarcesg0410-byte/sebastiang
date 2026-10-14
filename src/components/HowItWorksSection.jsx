import React from 'react';
import { CalendarCheck2, Camera, Eye, Sparkles, CloudSun, ShieldCheck, ArrowRight, HeartHandshake } from 'lucide-react';

export default function HowItWorksSection({ onOpenBooking, onNavigateToPackages }) {
  const steps = [
    {
      step: '01',
      title: 'Reserva con solo $20.000 COP',
      subtitle: 'Abono inicial flexible',
      description: 'Eliges tu fecha, temática y locación preferida. Separas tu cupo exclusivo con solo $20.000 COP de anticipo. El saldo restante lo cancelas con calma el día de la sesión.',
      icon: CalendarCheck2,
      accent: 'amber',
      tag: 'Abono Mínimo $20.000',
    },
    {
      step: '02',
      title: 'Sesión Guiada en la Playa',
      subtitle: 'Disfruta sin poses forzadas',
      description: 'Vivimos una experiencia divertida de 1 a 2 horas frente al mar. Te guiamos con poses naturales, buena música y la mejor iluminación dorada del atardecer caribeño. Cero timidez.',
      icon: Camera,
      accent: 'sky',
      tag: '100% Guiada & Divertida',
    },
    {
      step: '03',
      title: 'Selección en Galería Privada',
      subtitle: 'Tu portal exclusivo con PIN',
      description: 'En un plazo de hasta 3 días recibes un enlace personalizado para abrir tu galería en el celular o PC. Con tu PIN privado revisas todas las tomas y marcas tus fotos favoritas.',
      icon: Eye,
      accent: 'purple',
      tag: 'Revisión en 3 días',
    },
    {
      step: '04',
      title: 'Entrega Final en Alta Calidad',
      subtitle: 'Full HD sin compresión en 24-48h',
      description: 'Tras elegir tus favoritas, realizamos la edición profesional con colorimetría cinematográfica. Recibes tus fotografías finales en resolución original en solo 24 a 48 horas.',
      icon: Sparkles,
      accent: 'emerald',
      tag: 'Entrega Rápida 24-48h',
    },
  ];

  return (
    <section id="how-it-works-section" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-stone-800/60 select-none">
      
      {/* CABECERA */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-widest mb-4 shadow-sm">
          <HeartHandshake className="w-3.5 h-3.5 text-amber-400" />
          <span>Experiencia Simple & Transparente</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white tracking-tight">
          Cómo Funciona Tu Sesión <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">en 4 Pasos</span>
        </h2>

        <p className="mt-3 text-sm sm:text-base text-stone-400 font-light max-w-2xl mx-auto leading-relaxed">
          Diseñado para que disfrutes tus vacaciones o tu evento especial con absoluta tranquilidad, sabiendo con total claridad cada etapa de tu sesión.
        </p>
      </div>

      {/* GRID DE LOS 4 PASOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((st) => {
          const Icon = st.icon;
          return (
            <div
              key={st.step}
              className="relative rounded-3xl bg-gradient-to-b from-stone-900/90 via-stone-900/60 to-stone-950 border border-stone-800/80 hover:border-amber-500/40 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/5 hover:-translate-y-1 group"
            >
              {/* Número grande decorativo de fondo */}
              <span className="absolute top-4 right-5 text-4xl sm:text-5xl font-black font-mono text-stone-800/50 group-hover:text-amber-500/10 transition-colors pointer-events-none">
                {st.step}
              </span>

              <div>
                {/* Ícono de paso */}
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 group-hover:bg-amber-500/20 transition-all shadow-md">
                  <Icon className="w-6 h-6" />
                </div>

                <div className="mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 block mb-1">
                    Paso {st.step} • {st.subtitle}
                  </span>
                  <h3 className="text-lg font-serif font-bold text-white group-hover:text-amber-200 transition-colors">
                    {st.title}
                  </h3>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed mt-2 mb-4">
                  {st.description}
                </p>
              </div>

              {/* Tag inferior */}
              <div className="pt-4 border-t border-stone-800/60">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-800/80 text-[10px] font-bold text-stone-300 border border-stone-700/60 group-hover:border-amber-500/30 group-hover:text-amber-300 transition-colors">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>{st.tag}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* BANNER ESPECIAL: GARANTÍA TOTAL DE CLIMA */}
      <div className="mt-10 rounded-3xl bg-gradient-to-r from-sky-950/40 via-stone-900 to-sky-950/40 border border-sky-500/30 p-6 sm:p-8 lg:p-10 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
          
          <div className="flex items-start gap-4 sm:gap-6 text-left max-w-3xl">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0 shadow-lg text-sky-400">
              <CloudSun className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] font-extrabold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Tranquilidad 100% Protegida</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
                Garantía Total de Buen Clima
              </h3>
              <p className="text-xs sm:text-sm text-stone-300 font-light leading-relaxed">
                Sabemos que en sesiones al aire libre el clima puede variar de repente. Si el día de tu sesión llueve o el cielo no favorece las tomas, <strong className="text-white font-semibold">reprogramamos tu fecha u horario sin ningún costo ni penalidad</strong>. ¡Tus recuerdos merecen la luz perfecta!
              </p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
            {onOpenBooking && (
              <button
                type="button"
                onClick={onOpenBooking}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <span>Reservar con $20.000 COP</span>
                <ArrowRight className="w-4 h-4 text-stone-950" />
              </button>
            )}

            {onNavigateToPackages && (
              <button
                type="button"
                onClick={onNavigateToPackages}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 hover:text-white text-xs sm:text-sm font-semibold transition-all active:scale-95"
              >
                Ver Paquetes & Tarifas
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
