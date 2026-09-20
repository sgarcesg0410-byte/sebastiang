import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  Check, 
  Sparkles, 
  Send, 
  HelpCircle,
  Camera,
  Heart,
  Share2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getGalleryByToken, submitGallerySelection } from '../services/api';
import SecurityOverlay from './SecurityOverlay';

export default function ClientGallery({ token = "demo-cliente-2026", onBackToHome }) {
  const [galleryData, setGalleryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selecciones locales del usuario: Map de { [photoId]: { selected: boolean, comment: string } }
  const [selections, setSelections] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Contador de tiempo restante
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    fetchGallery();
  }, [token]);

  const fetchGallery = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGalleryByToken(token);
      setGalleryData(data);

      // Inicializar selecciones
      const initialMap = {};
      (data.photos || []).forEach(p => {
        initialMap[p.id] = {
          selected: Boolean(p.selected),
          comment: p.clientComment || ''
        };
      });
      setSelections(initialMap);
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo cargar la galería.');
    } finally {
      setLoading(false);
    }
  };

  // Temporizador de 3 días en vivo
  useEffect(() => {
    if (!galleryData || !galleryData.expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(galleryData.expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setGalleryData(prev => ({ ...prev, isExpired: true }));
        clearInterval(interval);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [galleryData]);

  // Manejar selección de foto
  const togglePhotoSelection = (photoId) => {
    if (galleryData?.isExpired || galleryData?.isSubmitted || submissionResult) return;

    setSelections(prev => {
      const current = prev[photoId] || { selected: false, comment: '' };
      return {
        ...prev,
        [photoId]: {
          ...current,
          selected: !current.selected
        }
      };
    });
  };

  // Manejar comentario por foto
  const handleCommentChange = (photoId, commentText) => {
    if (galleryData?.isExpired || galleryData?.isSubmitted || submissionResult) return;

    setSelections(prev => {
      const current = prev[photoId] || { selected: false, comment: '' };
      return {
        ...prev,
        [photoId]: {
          ...current,
          comment: commentText
        }
      };
    });
  };

  // Enviar selección final
  const handleConfirmSubmit = async () => {
    try {
      setIsSubmitting(true);
      const payload = Object.entries(selections).map(([id, val]) => ({
        id,
        selected: val.selected,
        clientComment: val.comment
      }));

      const res = await submitGallerySelection(token, payload);

      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 }
        });
      } catch (e) {}

      setSubmissionResult(res);
      setConfirmModalOpen(false);
      setGalleryData(prev => ({ ...prev, isSubmitted: true }));

      // Abrir WhatsApp automáticamente con el listado detallado
      if (res.directWhatsAppUrl) {
        window.open(res.directWhatsAppUrl, '_blank');
      }
    } catch (err) {
      alert(err.message || 'Error al enviar selección.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-stone-300 font-medium text-sm">Cargando tu sesión protegida de fotos...</p>
      </div>
    );
  }

  if (error || !galleryData) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-red-500/20 text-red-400 border border-red-500/40 rounded-2xl flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-serif font-bold text-white mb-2">Enlace no disponible</h3>
        <p className="text-stone-400 text-sm mb-6">{error || 'Esta galería no existe o fue eliminada.'}</p>
        <button
          onClick={onBackToHome}
          className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-6 py-2.5 rounded-xl text-sm font-semibold"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  const selectedCount = Object.values(selections).filter(s => s.selected).length;
  const isLocked = galleryData.isExpired || galleryData.isSubmitted || Boolean(submissionResult);
  const watermarkSubtext = galleryData.watermarkSettings?.watermarkSubtext || "MUESTRA EXCLUSIVA • PROHIBIDA SU DESCARGA";

  return (
    <SecurityOverlay enabled={true}>
      <div className="min-h-screen pb-36 pt-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        {/* BARRA DE AVISO DE SEGURIDAD Y EXPIRACIÓN */}
        <div className="mb-8 space-y-4">
          
          {/* Tarjeta de Cuenta Regresiva de 3 días */}
          {!isLocked && (
            <div className="bg-gradient-to-r from-amber-950/70 via-stone-900 to-amber-950/70 border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                    Vigencia del Enlace (3 Días)
                  </span>
                  <p className="text-xs text-stone-300">
                    Solo podrás enviar tu selección una única vez antes de que el enlace expire.
                  </p>
                </div>
              </div>

              {/* Reloj Digital */}
              <div className="flex items-center gap-2 text-center bg-stone-950/80 px-4 py-2 rounded-xl border border-stone-800">
                <div>
                  <span className="text-xl font-black text-amber-400 font-mono block">{timeRemaining.days}</span>
                  <span className="text-[10px] text-stone-400 uppercase">Días</span>
                </div>
                <span className="text-stone-600 font-bold">:</span>
                <div>
                  <span className="text-xl font-black text-amber-400 font-mono block">{String(timeRemaining.hours).padStart(2, '0')}</span>
                  <span className="text-[10px] text-stone-400 uppercase">Horas</span>
                </div>
                <span className="text-stone-600 font-bold">:</span>
                <div>
                  <span className="text-xl font-black text-amber-400 font-mono block">{String(timeRemaining.minutes).padStart(2, '0')}</span>
                  <span className="text-[10px] text-stone-400 uppercase">Min</span>
                </div>
                <span className="text-stone-600 font-bold">:</span>
                <div>
                  <span className="text-xl font-black text-amber-400 font-mono block">{String(timeRemaining.seconds).padStart(2, '0')}</span>
                  <span className="text-[10px] text-stone-400 uppercase">Seg</span>
                </div>
              </div>
            </div>
          )}

          {/* MENSAJES DE ESTADO DE BLOQUEO */}
          {galleryData.isExpired && !galleryData.isSubmitted && (
            <div className="bg-red-950/80 border-2 border-red-500/60 rounded-2xl p-5 flex items-center gap-4 text-left">
              <Lock className="w-8 h-8 text-red-400 shrink-0" />
              <div>
                <h4 className="text-base font-bold text-red-200">Enlace de selección expirado</h4>
                <p className="text-xs text-red-100/80 mt-1">
                  Han transcurrido los 3 días de vigencia acordados. Por favor contacta a Sebastian G para reactivar tu sesión si aún no has elegido tus fotos.
                </p>
              </div>
            </div>
          )}

          {(galleryData.isSubmitted || submissionResult) && (() => {
            const selectedList = (galleryData.photos || []).filter(p => selections[p.id]?.selected || p.selected);
            let autoSummary = `📸 *¡Hola Sebastian G! Ya elegí las fotos de mi sesión:*\n\n`;
            autoSummary += `👤 *Cliente:* ${galleryData.clientName}\n`;
            autoSummary += `📦 *Sesión:* ${galleryData.packageTitle}\n`;
            autoSummary += `🔢 *Total Elegidas:* ${selectedList.length} fotos\n\n`;
            autoSummary += `*Lista de fotos seleccionadas:*\n`;
            selectedList.forEach((p, idx) => {
              const note = selections[p.id]?.comment || p.clientComment;
              autoSummary += `\n${idx + 1}. *${p.title}*`;
              if (note) autoSummary += `\n   💬 _Nota:_ "${note}"`;
            });
            autoSummary += `\n\n_Quedo atento(a) a la entrega final en alta calidad. ¡Muchas gracias!_`;

            const primaryWaUrl = submissionResult?.directWhatsAppUrl || `https://wa.me/573244725167?text=${encodeURIComponent(autoSummary)}`;
            const secondaryWaUrl = submissionResult?.secondaryWhatsAppUrl || `https://wa.me/573023696513?text=${encodeURIComponent(autoSummary)}`;

            return (
              <div className="bg-emerald-950/90 border-2 border-emerald-500/70 rounded-3xl p-6 flex flex-col gap-4 text-left shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">¡Selección enviada y protegida con éxito!</h4>
                    <p className="text-xs text-emerald-200/90 mt-0.5">
                      Tus elecciones y notas quedaron registradas. Puedes enviar el detalle a Sebastian G por cualquiera de sus dos líneas de WhatsApp:
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <a
                    href={primaryWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs sm:text-sm py-3.5 px-5 rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all text-center"
                  >
                    <Share2 className="w-4 h-4 fill-white shrink-0" />
                    <span>Enviar a Sebastian (Línea 1: 324 472 5167) 📲</span>
                  </a>

                  <a
                    href={secondaryWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-stone-900 border border-emerald-500/40 hover:bg-stone-800 text-emerald-300 font-bold text-xs sm:text-sm py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-center"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>Enviar a Línea 2 (302 369 6513)</span>
                  </a>
                </div>
              </div>
            );
          })()}

          {/* CABECERA DE LA SESIÓN DEL CLIENTE */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Galería Privada de Revisión
                </span>
                <span className="text-xs text-stone-400">
                  • {galleryData.photos?.length || 0} fotos tomadas
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white">
                Sesión de {galleryData.clientName}
              </h1>
              <p className="text-xs sm:text-sm text-stone-300 mt-1">
                {galleryData.packageTitle} • Toca las fotos que más te gusten y déjanos tus notas debajo de cada una.
              </p>
            </div>

            {/* Contador de fotos elegidas */}
            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 text-center shrink-0">
              <span className="text-[11px] text-stone-400 uppercase tracking-wider block">
                Fotos Seleccionadas
              </span>
              <div className="flex items-baseline justify-center gap-1 mt-1">
                <span className="text-3xl font-extrabold text-amber-400">{selectedCount}</span>
                <span className="text-xs text-stone-400">/ {galleryData.maxPhotosAllowed} incluidas</span>
              </div>
            </div>
          </div>
        </div>

        {/* GRID DE FOTOS CON PROTECCIÓN Y MARCA DE AGUA GIGANTE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(galleryData.photos || []).map((photo, index) => {
            const isSelected = Boolean(selections[photo.id]?.selected);
            const clientComment = selections[photo.id]?.comment || '';

            return (
              <div
                key={photo.id}
                className={`relative rounded-3xl overflow-hidden bg-stone-900 border transition-all duration-300 ${
                  isSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-2xl shadow-amber-500/10'
                    : 'border-stone-800'
                }`}
              >
                {/* CONTENEDOR DE IMAGEN CON PROTECCIÓN */}
                <div 
                  className="relative aspect-[4/5] w-full overflow-hidden bg-black select-none cursor-pointer"
                  onClick={() => togglePhotoSelection(photo.id)}
                >
                  {/* FOTO */}
                  <img
                    src={photo.url}
                    alt={photo.title}
                    className="w-full h-full object-cover pointer-events-none select-none"
                    loading="lazy"
                    draggable={false}
                  />

                  {/* CAPA TRANSPARENTE ANTI-DESCARGA */}
                  <div className="absolute inset-0 z-10 bg-transparent select-none" />

                  {/* MALLA DE MARCA DE AGUA REPETIDA EN TODA LA FOTO */}
                  <div className="absolute inset-0 z-15 pointer-events-none overflow-hidden opacity-30 select-none flex flex-wrap gap-6 items-center justify-around -rotate-12 scale-125">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <span key={i} className="text-[10px] font-black tracking-wider text-white/50 uppercase whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                        SEBASTIAN G • PROHIBIDA SU DESCARGA
                      </span>
                    ))}
                  </div>

                  {/* MARCA DE AGUA GIGANTE CENTRAL CON EL LOGOTIPO OFICIAL DE SEBASTIAN G */}
                  <div className="watermark-overlay z-20">
                    <div className="watermark-content animate-watermark flex flex-col items-center justify-center text-center">
                      <img
                        src="/logo-white.png"
                        alt="Sebastian G"
                        className="h-16 sm:h-24 w-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] opacity-95 mb-1"
                      />
                      <p className="text-[10px] sm:text-[11px] font-black tracking-widest text-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] uppercase">
                        {watermarkSubtext}
                      </p>
                    </div>
                  </div>

                  {/* INDICADOR DE FOTO SELECCIONADA EN LA ESQUINA */}
                  <div className="absolute top-4 right-4 z-30">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center backdrop-blur-md border transition-transform ${
                        isSelected
                          ? 'bg-amber-500 border-amber-400 text-stone-950 scale-110 shadow-lg shadow-amber-500/40'
                          : 'bg-stone-950/70 border-white/20 text-stone-400'
                      }`}
                    >
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                  </div>

                  {/* NÚMERO DE FOTO */}
                  <div className="absolute top-4 left-4 z-30">
                    <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-stone-950/80 backdrop-blur-md text-stone-300 border border-white/10">
                      #{index + 1}
                    </span>
                  </div>

                  {/* BADGE INFERIOR DE ESTADO */}
                  <div className="absolute bottom-3 inset-x-3 z-30">
                    <div
                      className={`py-2 px-3 rounded-xl text-xs font-bold text-center backdrop-blur-md transition-colors ${
                        isSelected
                          ? 'bg-amber-500/90 text-stone-950 border border-amber-400'
                          : 'bg-stone-950/80 text-stone-300 border border-stone-800'
                      }`}
                    >
                      {isSelected ? '✓ Foto Elegida para tu Paquete' : 'Toca para elegir esta foto'}
                    </div>
                  </div>
                </div>

                {/* ÁREA DE COMENTARIOS Y OPINIÓN POR FOTO */}
                <div className="p-4 bg-stone-900 border-t border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white truncate">
                      {photo.title}
                    </span>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => togglePhotoSelection(photo.id)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                      }`}
                    >
                      {isSelected ? 'Quitar selección' : 'Seleccionar'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-stone-400 mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-amber-400" />
                      <span>Observaciones o retoques para esta foto:</span>
                    </label>
                    <textarea
                      value={clientComment}
                      disabled={isLocked}
                      onChange={(e) => handleCommentChange(photo.id, e.target.value)}
                      placeholder="Ej: Aclarar un poco la sombra, me encanta para cuadro, etc."
                      rows={2}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 disabled:opacity-50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* BARRA FLOTANTE INFERIOR PARA ENVIAR SELECCIÓN FINAL */}
        <div className="fixed bottom-0 inset-x-0 z-40 bg-stone-950/95 backdrop-blur-md border-t border-stone-800 p-4 shadow-2xl">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Tu Selección:
                </span>
                <span className="text-sm font-extrabold text-white">
                  {selectedCount} fotos elegidas
                </span>
                <span className="text-xs text-stone-400">
                  (Paquete incluye {galleryData.maxPhotosAllowed})
                </span>
              </div>
              <p className="text-[11px] text-stone-400 hidden sm:block">
                Solo puedes enviar una única vez. Al confirmar, el enlace se bloqueará.
              </p>
            </div>

            <div className="w-full sm:w-auto flex items-center gap-3">
              <button
                type="button"
                disabled={isLocked || selectedCount === 0}
                onClick={() => setConfirmModalOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-extrabold text-sm px-7 py-3.5 rounded-xl shadow-lg shadow-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <CheckCircle2 className="w-5 h-5 fill-stone-950" />
                <span>Enviar Mi Selección Definitiva</span>
              </button>
            </div>
          </div>
        </div>

        {/* MODAL DE CONFIRMACIÓN DE ENVÍO ÚNICO */}
        {confirmModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl">
              <div className="w-14 h-14 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <h4 className="text-xl font-serif font-bold text-white mb-2">
                ¿Confirmar selección final?
              </h4>

              <p className="text-xs text-stone-300 leading-relaxed mb-4">
                Has seleccionado <strong>{selectedCount} fotos</strong>.
              </p>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-200 text-left mb-6 leading-tight">
                ⚠️ <strong>Aviso Importante:</strong> Solo puedes enviar tu selección <strong>una única vez</strong>. Una vez confirmada, las fotos quedarán bloqueadas y se enviará la notificación a Sebastian.
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmSubmit}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm py-3 rounded-xl shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Enviando y bloqueando...' : 'Sí, Enviar Mi Selección Definitiva'}
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setConfirmModalOpen(false)}
                  className="w-full py-2.5 text-xs text-stone-400 hover:text-stone-200"
                >
                  Volver a revisar mis fotos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SecurityOverlay>
  );
}
