import React, { useState, useEffect } from 'react';
import { Star, ShieldCheck, Heart, Sparkles, MessageCircle, Quote } from 'lucide-react';
import { getReviews, REAL_DEFAULT_REVIEWS } from '../services/api';

export default function TestimonialsSection({ onOpenBooking }) {
  const [reviews, setReviews] = useState(REAL_DEFAULT_REVIEWS);

  useEffect(() => {
    getReviews().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setReviews(data);
      }
    });

    // Escuchar nuevas reseñas en tiempo real
    let bc;
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        bc = new BroadcastChannel('reviews_realtime_sync');
        bc.onmessage = (e) => {
          if (e.data?.review) {
            setReviews(prev => [e.data.review, ...prev.filter(r => r.id !== e.data.review.id)]);
          }
        };
      }
    } catch (e) {}

    const handleStorage = (e) => {
      if (e.key === 'sebastian_g_reviews_last_sync' || e.key === 'sebastian_g_reviews_v1') {
        getReviews().then(data => {
          if (Array.isArray(data) && data.length > 0) setReviews(data);
        });
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-stone-800/60">
      
      {/* CABECERA DE TESTIMONIOS */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-widest mb-4 shadow-sm">
          <Star className="w-3.5 h-3.5 fill-amber-400" />
          <span>Experiencias & Calificaciones Reales</span>
        </div>
        
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white tracking-tight">
          Lo que Dicen <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">Nuestros Clientes</span>
        </h2>
        
        <p className="mt-3 text-sm sm:text-base text-stone-400 font-light max-w-2xl mx-auto leading-relaxed">
          La confianza de quienes ya vivieron su sesión con Sebastian G. Cada fotografía es un recuerdo capturado con amor, técnica y entrega en máxima resolución original.
        </p>

        {/* INSIGNIAS DE CONFIANZA */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-8 max-w-xl mx-auto">
          <div className="bg-stone-900/80 border border-stone-800/80 p-3.5 rounded-2xl text-center shadow-lg">
            <div className="flex items-center justify-center gap-1 text-amber-400 text-base sm:text-lg font-black font-mono">
              <span>5.0</span>
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
            <span className="text-[10px] sm:text-xs text-stone-400 block mt-0.5">Calificación Promedio</span>
          </div>

          <div className="bg-stone-900/80 border border-stone-800/80 p-3.5 rounded-2xl text-center shadow-lg">
            <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">100%</span>
            <span className="text-[10px] sm:text-xs text-stone-400 block mt-0.5">Nos Recomiendan</span>
          </div>

          <div className="bg-stone-900/80 border border-stone-800/80 p-3.5 rounded-2xl text-center shadow-lg">
            <span className="text-base sm:text-lg font-black text-purple-400 font-mono">Full HD</span>
            <span className="text-[10px] sm:text-xs text-stone-400 block mt-0.5">Calidad Original</span>
          </div>
        </div>
      </div>

      {/* GRID DE TESTIMONIOS REALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reviews.map((rev) => (
          <div
            key={rev.id}
            className="relative bg-gradient-to-b from-stone-900/90 to-stone-950 border border-stone-800/90 hover:border-amber-500/40 rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-amber-500/5 group"
          >
            {/* Comilla sutil en el fondo */}
            <div className="absolute top-6 right-6 text-stone-800 group-hover:text-amber-500/10 transition-colors pointer-events-none">
              <Quote className="w-10 h-10" />
            </div>

            <div>
              {/* Estrellas Doradas */}
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < (rev.rating || 5)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-stone-700'
                    }`}
                  />
                ))}
                <span className="text-xs font-bold text-amber-300 ml-1.5 font-mono">
                  {rev.rating ? `${rev.rating}.0` : '5.0'}
                </span>
              </div>

              {/* Texto de la Reseña */}
              <p className="text-stone-300 text-xs sm:text-sm leading-relaxed italic relative z-10 mb-6">
                "{rev.comment}"
              </p>
            </div>

            {/* Datos del Cliente y Validación */}
            <div className="pt-4 border-t border-stone-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 border border-amber-400/50 flex items-center justify-center text-stone-950 font-black text-sm shadow-md shrink-0">
                  {rev.clientName ? rev.clientName.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                  <h4 className="text-sm font-serif font-bold text-white leading-tight">
                    {rev.clientName}
                  </h4>
                  <span className="text-[10px] text-amber-400 font-medium block">
                    {rev.sessionTitle || 'Sesión Fotográfica'}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Verificado</span>
                </span>
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  {rev.date || 'Reciente'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* LLAMADO A LA ACCIÓN INFERIOR */}
      <div className="mt-14 p-8 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-900/90 to-stone-900 border border-stone-800 text-center flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="text-left">
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 block mb-1">
            ¿Listo para tu sesión?
          </span>
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
            Tú también puedes vivir una experiencia inolvidable frente al lente
          </h3>
          <p className="text-xs text-stone-400 mt-1 max-w-xl">
            Reserva hoy tu fecha con 2 fotos gratis incluidas en todos nuestros paquetes. Sin registros molestos, directo a WhatsApp.
          </p>
        </div>

        {onOpenBooking && (
          <button
            type="button"
            onClick={onOpenBooking}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-extrabold text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-white fill-white" />
            <span>Reservar Mi Sesión Ahora</span>
          </button>
        )}
      </div>
    </section>
  );
}
