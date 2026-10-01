import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Send, 
  CheckCircle2, 
  MessageCircle, 
  Heart, 
  Sparkles, 
  ArrowLeft, 
  ThumbsUp, 
  Camera, 
  ShieldCheck, 
  ExternalLink,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { submitGalleryReview, getSettings, DEFAULT_SETTINGS } from '../services/api';

export default function PublicReviewView({ onBackToHome }) {
  const [clientName, setClientName] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [recommend, setRecommend] = useState(true);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReview, setSubmittedReview] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    getSettings().then(s => {
      if (s) setSettings(s);
    });

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const nameParam = urlParams.get('cliente') || urlParams.get('nombre') || urlParams.get('client');
      if (nameParam) setClientName(decodeURIComponent(nameParam));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientName.trim()) {
      alert('Por favor escribe tu nombre.');
      return;
    }
    if (!comment.trim()) {
      alert('Por favor cuéntanos brevemente tu experiencia con las fotografías.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await submitGalleryReview('public-review', {
        clientName: clientName.trim(),
        rating,
        recommend,
        comment: comment.trim()
      });

      // Disparar confeti de celebración
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {}

      setSubmittedReview(res?.review || {
        clientName,
        rating,
        recommend,
        comment
      });
    } catch (err) {
      alert('Ocurrió un error al enviar tu opinión: ' + (err.message || 'Intenta de nuevo'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingFeedback = (val) => {
    switch (val) {
      case 5:
        return '⭐⭐⭐⭐⭐ ¡Excelente! Totalmente encantado(a)';
      case 4:
        return '⭐⭐⭐⭐ Muy buena experiencia y calidad';
      case 3:
        return '⭐⭐⭐ Buena experiencia en general';
      case 2:
        return '⭐⭐ Regular, aspectos por mejorar';
      case 1:
        return '⭐ No cumplió mis expectativas';
      default:
        return '';
    }
  };

  const photogWhatsApp = (settings.photographerWhatsApp || '+573244725167').replace(/\D/g, '');
  const starsString = '⭐'.repeat(rating);
  const waShareMsg = encodeURIComponent(
    `🌟 *¡Hola Sebastian G! Acabo de calificar mi experiencia con tu servicio de fotografía:*\n\n` +
    `👤 *Cliente:* ${clientName}\n` +
    `⭐ *Calificación:* ${starsString} (${rating}/5 Estrellas)\n` +
    `👍 *¿Nos recomienda?:* ${recommend ? '¡Sí, 100% recomendado!' : 'Sí'}\n` +
    `💬 *Opinión:* "${comment}"\n\n` +
    `_¡Muchas gracias por las fotos y la atención!_ ✨`
  );
  const waUrl = `https://wa.me/${photogWhatsApp}?text=${waShareMsg}`;

  return (
    <div className="min-h-screen bg-stone-950 text-white selection:bg-amber-500 selection:text-black py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex flex-col justify-between">
      {/* Halos decorativos de fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER DE LA VISTA */}
      <div className="max-w-2xl mx-auto w-full mb-6 z-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-amber-400 transition-colors bg-stone-900/80 px-3.5 py-2 rounded-xl border border-stone-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a la Página Principal</span>
          </button>

          <div className="flex items-center gap-2">
            <img
              src="/app-icon.png"
              alt="Sebastian G"
              className="w-7 h-7 rounded-lg object-cover border border-white/20"
            />
            <span className="text-xs font-serif font-bold text-amber-200">Sebastian G</span>
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="max-w-xl mx-auto w-full bg-stone-900/90 border border-stone-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative z-10 my-auto">
        {!submittedReview ? (
          <div>
            {/* TÍTULO Y DESCRIPCIÓN */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Tu Opinión es Muy Valiosa</span>
              </div>
              
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
                ¿Cómo te pareció tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">Sesión de Fotos?</span>
              </h1>
              
              <p className="text-xs sm:text-sm text-stone-400 mt-2 leading-relaxed">
                Tu testimonio nos ayuda a seguir creando recuerdos inolvidables y aparecerá de inmediato en nuestra página web.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SELECTOR DE ESTRELLAS INTERACTIVO */}
              <div className="bg-stone-950 p-5 rounded-2xl border border-stone-800 text-center">
                <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-3">
                  Calificación General *
                </label>
                
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = (hoverRating || rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform hover:scale-125 active:scale-95 focus:outline-none"
                      >
                        <Star
                          className={`w-8 h-8 sm:w-10 sm:h-10 transition-colors ${
                            isFilled
                              ? 'text-amber-400 fill-amber-400 drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]'
                              : 'text-stone-700 hover:text-stone-500'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <span className="text-xs font-semibold text-amber-300 block min-h-[1.25rem]">
                  {getRatingFeedback(hoverRating || rating)}
                </span>
              </div>

              {/* NOMBRE DEL CLIENTE */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Tu Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej. Jennifer Vásquez"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 font-medium placeholder-stone-600"
                />
              </div>


              {/* COMENTARIO / OPINIÓN */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Tu Opinión o Reseña *</span>
                  <span className="text-[10px] text-stone-500">Visible en la web oficial</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="¿Cómo te sentiste durante la sesión? ¿Te gustaron los colores, la paciencia y el resultado de las fotos?"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 font-medium placeholder-stone-600 leading-relaxed"
                />
              </div>

              {/* ¿RECOMIENDAS A SEBASTIAN G? */}
              <div 
                onClick={() => setRecommend(!recommend)}
                className="flex items-center gap-3 p-3.5 bg-stone-950/70 border border-stone-800 rounded-2xl cursor-pointer hover:border-amber-500/30 transition-colors select-none"
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                  recommend ? 'bg-amber-500 border-amber-400 text-stone-950' : 'border-stone-700 bg-stone-900'
                }`}>
                  {recommend && <ThumbsUp className="w-3.5 h-3.5 fill-stone-950 stroke-[2.5]" />}
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-white block">
                    ¿Recomendarías a Sebastian G a tus amigos o familiares?
                  </span>
                  <span className="text-[11px] text-stone-400">
                    {recommend ? '¡Sí, 100% recomendado!' : 'No en este momento'}
                  </span>
                </div>
              </div>

              {/* BOTÓN ENVIAR */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 active:scale-[0.99] text-stone-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                    <span>Publicando tu opinión...</span>
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 fill-stone-950" />
                    <span>Publicar mi Opinión en la Web</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* PANTALLA DE CONFIRMACIÓN CON ÉXITO */
          <div className="text-center py-4 space-y-6 animate-fadeIn">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/30">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span>✓ Publicada en Tiempo Real</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
                ¡Muchísimas Gracias, {submittedReview.clientName}!
              </h2>
              <p className="text-xs sm:text-sm text-stone-400 mt-2 max-w-md mx-auto leading-relaxed">
                Tu opinión y calificación de <strong className="text-amber-400">{submittedReview.rating} estrellas</strong> ya están publicadas en nuestra página web oficial para que futuros clientes conozcan tu experiencia.
              </p>
            </div>

            {/* TARJETA VISTA PREVIA DE LA RESEÑA RECIÉN PUBLICADA */}
            <div className="p-4 sm:p-5 bg-stone-950 rounded-2xl border border-amber-500/30 text-left space-y-2 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < submittedReview.rating ? 'text-amber-400 fill-amber-400' : 'text-stone-700'
                      }`}
                    />
                  ))}
                  <span className="text-xs font-bold text-amber-400 ml-1 font-mono">
                    {submittedReview.rating}.0
                  </span>
                </div>
                <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono">
                  Ahora mismo
                </span>
              </div>

              <p className="text-xs text-stone-300 italic leading-relaxed">
                "{submittedReview.comment}"
              </p>

              <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
                <span className="font-semibold text-white">{submittedReview.clientName}</span>
                <span className="text-emerald-400 font-medium">✓ Opinión Verificada</span>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="space-y-3 pt-2">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-stone-950" />
                <span>Enviar también por WhatsApp a Sebastian G</span>
              </a>

              <button
                type="button"
                onClick={onBackToHome}
                className="w-full py-3 px-5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-stone-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ver mi opinión en la página principal</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="text-center text-[11px] text-stone-500 mt-6 z-10">
        <span>Sebastian G • Fotografía Profesional • San Antero & Coveñas</span>
      </div>
    </div>
  );
}
