import React, { useState, useEffect } from 'react';
import { Star, ShieldCheck, Heart, Sparkles, MessageCircle, Quote, Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { getReviews, REAL_DEFAULT_REVIEWS } from '../services/api';

const INITIAL_VISIBLE_REVIEWS = 3;

export default function TestimonialsSection({ onOpenBooking }) {
  const [reviews, setReviews] = useState(REAL_DEFAULT_REVIEWS);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    getReviews().then(data => {
      if (Array.isArray(data)) {
        setReviews(data);
      }
    });

    // Escuchar nuevas reseñas verificadas o moderaciones en tiempo real
    let bc;
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        bc = new BroadcastChannel('reviews_realtime_sync');
        bc.onmessage = (e) => {
          if (e.data?.type === 'DELETE_REVIEW' && e.data?.id) {
            setReviews(prev => prev.filter(r => r.id !== e.data.id));
            return;
          }
          if (e.data?.review) {
            const incoming = e.data.review;
            if (incoming.verified === true && incoming.status !== 'pending' && incoming.status !== 'rejected') {
              setReviews(prev => [incoming, ...prev.filter(r => r.id !== incoming.id)]);
            } else {
              setReviews(prev => prev.filter(r => r.id !== incoming.id));
            }
          }
        };
      }
    } catch (e) {}

    const handleStorage = (e) => {
      if (e.key === 'sebastian_g_reviews_last_sync' || e.key === 'sebastian_g_reviews_v1') {
        getReviews().then(data => {
          if (Array.isArray(data)) setReviews(data);
        });
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Filtrar estrictamente reseñas verificadas y aprobadas, ordenadas de más reciente a más antigua
  const sourceReviews = Array.isArray(reviews) && reviews.length > 0 ? reviews : REAL_DEFAULT_REVIEWS;
  const validReviews = sourceReviews
    .filter(
      r =>
        r &&
        r.verified === true &&
        r.status !== 'pending' &&
        r.status !== 'rejected' &&
        (r.comment?.trim() || r.rating)
    )
    .sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0));

  const visibleReviews = showAllReviews
    ? validReviews
    : validReviews.slice(0, INITIAL_VISIBLE_REVIEWS);

  // Métricas transparentes calculadas exclusivamente desde reseñas verificadas
  const totalReviews = validReviews.length;
  const ratings = validReviews.map(r => Math.max(1, Math.min(5, Number(r.rating) || 5)));
  const avgRating = totalReviews > 0
    ? (ratings.reduce((acc, curr) => acc + curr, 0) / totalReviews).toFixed(1)
    : null;
  const recommendedCount = validReviews.filter(r => r.recommend !== false).length;
  const recommendPercent = totalReviews > 0
    ? Math.round((recommendedCount / totalReviews) * 100)
    : null;

  return (
    <section id="testimonials-section" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-stone-800/60">
      
      {/* CABECERA DE TESTIMONIOS */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-widest mb-4 shadow-sm">
          <Star className="w-3.5 h-3.5 fill-amber-400" />
          <span>Opiniones Recientes & Calificaciones Verificadas</span>
        </div>
        
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white tracking-tight">
          Lo que Dicen <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">Nuestros Clientes</span>
        </h2>
        
        <p className="mt-3 text-sm sm:text-base text-stone-400 font-light max-w-2xl mx-auto leading-relaxed">
          La confianza de quienes ya vivieron su sesión con Sebastian G. Cada fotografía es un recuerdo capturado con amor, técnica y entrega en máxima resolución original.
        </p>

        {/* INSIGNIAS DE CONFIANZA CALCULADAS EN VIVO CON TRANSPARENCIA TOTAL */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-8 max-w-xl mx-auto">
          <div className="bg-stone-900/80 border border-stone-800/80 p-3.5 rounded-2xl text-center shadow-lg">
            <div className="flex items-center justify-center gap-1 text-amber-400 text-sm sm:text-lg font-black font-mono">
              <span>{totalReviews > 0 ? avgRating : 'Sin calificaciones'}</span>
              {totalReviews > 0 && <Star className="w-4 h-4 fill-amber-400" />}
            </div>
            <span className="text-[10px] sm:text-xs text-stone-400 block mt-0.5">
              {totalReviews > 0 ? `${totalReviews} ${totalReviews === 1 ? 'opinión verificada' : 'opiniones verificadas'}` : '0 opiniones'}
            </span>
          </div>

          <div className="bg-stone-900/80 border border-stone-800/80 p-3.5 rounded-2xl text-center shadow-lg">
            <span className="text-sm sm:text-lg font-black text-emerald-400 font-mono block">
              {totalReviews > 0 ? `${recommendPercent}%` : 'Sin datos'}
            </span>
            <span className="text-[10px] sm:text-xs text-stone-400 block mt-0.5">
              {totalReviews > 0 ? 'Recomendación Real' : 'Pendiente de evaluaciones'}
            </span>
          </div>

          <div className="bg-stone-900/80 border border-stone-800/80 p-3.5 rounded-2xl text-center shadow-lg">
            <span className="text-base sm:text-lg font-black text-purple-400 font-mono">Full HD</span>
            <span className="text-[10px] sm:text-xs text-stone-400 block mt-0.5">Resolución Original</span>
          </div>
        </div>

        {/* BOTÓN PARA DEJAR OPINIÓN DIRECTA */}
        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState(null, '', '/calificar');
                window.dispatchEvent(new PopStateEvent('popstate'));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>¿Viviste una sesión con Sebastian G? Deja tu opinión aquí</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN DE RESEÑAS O INVITACIÓN A CALIFICAR */}
      {validReviews.length === 0 ? (
        <div className="max-w-2xl mx-auto bg-gradient-to-b from-stone-900/95 to-stone-950 border border-stone-800 rounded-3xl p-8 sm:p-10 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
            <Quote className="w-8 h-8 text-amber-400" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
              ¿Viviste una sesión fotográfica con Sebastián G?
            </h3>
            <p className="text-xs sm:text-sm text-stone-300 max-w-lg mx-auto leading-relaxed">
              Tu opinión es muy importante para nosotros y ayuda a que futuros clientes conozcan la experiencia real. En esta sección solo mostramos calificaciones <strong className="text-white">100% verdaderas y verificadas</strong>.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.history.pushState(null, '', '/calificar');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-bold text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-stone-950" />
              <span>⭐ Calificar Mi Experiencia (1 minuto)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-stone-800/80 text-stone-400 text-xs">
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Solo Opiniones Verificadas</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Heart className="w-4 h-4 text-red-400 shrink-0" />
              <span>Sin Reseñas Falsas</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Camera className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Clientes Reales</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {visibleReviews.map((rev) => (
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
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {rev.verified === true && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verificado</span>
                      </span>
                    )}
                    <span className="text-[10px] text-stone-500 block mt-0.5">
                      {rev.date || 'Reciente'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {validReviews.length > INITIAL_VISIBLE_REVIEWS && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllReviews(prev => !prev)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 border border-stone-700 hover:border-amber-500/40 text-amber-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-lg"
              >
                {showAllReviews ? (
                  <>
                    <ChevronUp className="w-4 h-4 text-amber-400" />
                    <span>Mostrar solo las 3 opiniones más recientes</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 text-amber-400" />
                    <span>Ver todas las opiniones verificadas ({validReviews.length})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* LLAMADO A LA ACCIÓN INFERIOR */}
      <div className="mt-14 p-8 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-900/90 to-stone-900 border border-stone-800 text-center flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="text-left">
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 block mb-1">
            Explora Nuestro Portafolio
          </span>
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
            Tú también puedes vivir una experiencia inolvidable frente al lente
          </h3>
          <p className="text-xs text-stone-400 mt-1 max-w-xl">
            Toca cualquiera de las fotos de nuestro catálogo para conocer las locaciones y agendar tu fecha con esa temática.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('catalog-gallery-section') || document.querySelector('main');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-stone-900 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white font-bold text-sm shadow-xl active:scale-[0.98] transition-all shrink-0 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Camera className="w-4 h-4 text-amber-400" />
          <span>Ver Fotos del Catálogo</span>
        </button>
      </div>
    </section>
  );
}
