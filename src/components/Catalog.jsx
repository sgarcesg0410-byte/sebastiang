import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, MapPin, Heart, ArrowRight, Eye, Calendar, Camera, Shield, Lock, X, Share2, Check, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { trackLinkShare } from '../services/analytics';
import ProtectedCanvasImage from './ProtectedCanvasImage';

export default function Catalog({ catalog = [], onOpenBooking, onNavigateToAdmin, packages = [] }) {
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [likes, setLikes] = useState({});
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Cerrar vista previa exclusivamente cuando la pestaña se minimiza u oculta
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && previewPhoto) {
        setPreviewPhoto(null);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [previewPhoto]);

  const categories = ['Todas', 'Retratos', 'Playas & Atardeceres', 'Campo & Naturaleza', 'Parejas & Bodas', 'Quinceañeras & Eventos'];

  const safeCatalog = Array.isArray(catalog) ? catalog.filter(Boolean) : [];

  const filteredPhotos = selectedCategory === 'Todas'
    ? safeCatalog
    : safeCatalog.filter(photo => photo && photo.category === selectedCategory);

  const previewIndex = previewPhoto ? filteredPhotos.findIndex(p => p.id === previewPhoto.id) : -1;

  const handlePrevPhoto = useCallback((e) => {
    if (e) e.stopPropagation();
    if (filteredPhotos.length === 0) return;
    const newIdx = previewIndex > 0 ? previewIndex - 1 : filteredPhotos.length - 1;
    setPreviewPhoto(filteredPhotos[newIdx]);
  }, [previewIndex, filteredPhotos]);

  const handleNextPhoto = useCallback((e) => {
    if (e) e.stopPropagation();
    if (filteredPhotos.length === 0) return;
    const newIdx = previewIndex < filteredPhotos.length - 1 ? previewIndex + 1 : 0;
    setPreviewPhoto(filteredPhotos[newIdx]);
  }, [previewIndex, filteredPhotos]);

  // Soporte de navegación por teclado en el visor: Flechas y Escape
  useEffect(() => {
    if (!previewPhoto) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setPreviewPhoto(null);
      if (e.key === 'ArrowLeft') handlePrevPhoto();
      if (e.key === 'ArrowRight') handleNextPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewPhoto, handlePrevPhoto, handleNextPhoto]);

  const toggleLike = (id, e) => {
    e.stopPropagation();
    setLikes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Compartir portafolio oficial por WhatsApp (soporte para APK nativa Android y web)
  const handleShareApp = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sebastiang.app';
    const shareTitle = 'Sebastian G • Fotografía & Edición Profesional';
    const shareText = 
      `📸 *Sebastian G • Fotografía Profesional*\n` +
      `Capturamos tus mejores momentos en Coveñas, San Antero y playas privadas.\n\n` +
      `✨ Mira el portafolio oficial completo, fotos en alta resolución y paquetes aquí:\n` +
      `👉 ${shareUrl}\n\n` +
      `📞 WhatsApp de reservas: +57 324 472 5167`;

    // 1. Enlace nativo dentro de la APK de Android
    if (typeof window !== 'undefined' && window.AndroidNotificationBridge?.shareToWhatsApp) {
      window.AndroidNotificationBridge.shareToWhatsApp(shareText);
      trackLinkShare('apk_whatsapp');
      return;
    }

    // 2. Si el dispositivo tiene Web Share API nativo
    if (typeof navigator !== 'undefined' && navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        trackLinkShare('native');
        return;
      } catch (e) {}
    }

    // 3. Fallback directo a WhatsApp Web / app
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank');
    trackLinkShare('whatsapp_direct');
  };

  // Consultar directamente por una fotografía específica en WhatsApp
  const handleInquirePhotoWhatsApp = (photo) => {
    if (!photo) return;
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sebastiang.app';
    const text = 
      `📸 *Consulta sobre Sesión Fotográfica • Sebastian G*\n` +
      `¡Hola Sebastian! Me encantó esta fotografía de tu portafolio:\n` +
      `✨ *"${photo.title}"*\n` +
      `📍 *Locación:* ${photo.location || 'San Antero / Coveñas'}\n` +
      `📁 *Categoría:* ${photo.category}\n` +
      `🌐 *Portafolio:* ${shareUrl}\n\n` +
      `Me gustaría consultar disponibilidad y tarifas para una sesión similar. ¡Muchas gracias!`;

    if (typeof window !== 'undefined' && window.AndroidNotificationBridge?.shareToWhatsApp) {
      window.AndroidNotificationBridge.shareToWhatsApp(text);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
      navigator.share({
        title: photo.title,
        text: text,
        url: shareUrl
      }).catch(() => {});
      return;
    }

    const waUrl = `https://api.whatsapp.com/send?phone=573244725167&text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="pb-24">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 px-4 sm:px-6 lg:px-8 border-b border-stone-800/60 bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Camera className="w-3.5 h-3.5" />
            <span>Fotografía Profesional</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white font-serif mb-6 leading-tight">
            Capturamos tus <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">mejores momentos</span>
          </h1>

          <p className="text-lg sm:text-xl text-stone-300 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Sesiones de retratos, campo, eventos, bodas y parejas en cualquier locación o destino que elijas.
          </p>

          {/* BOTÓN DE ACCIÓN: COMPARTIR PORTAFOLIO */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleShareApp}
              className="inline-flex items-center justify-center gap-2.5 bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 hover:border-amber-500/50 text-stone-200 hover:text-white font-bold text-sm sm:text-base px-7 py-3.5 rounded-2xl transition-all shadow-lg active:scale-[0.98]"
              title="Compartir enlace del portafolio por WhatsApp o redes"
            >
              {shareCopied ? (
                <>
                  <Check className="w-5 h-5 text-emerald-400 stroke-[3]" />
                  <span className="text-emerald-300">¡Enlace Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-5 h-5 text-amber-400" />
                  <span>Compartir Portafolio</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-4">
            ✨ Toca cualquier fotografía del portafolio para verla en alta definición.
          </p>
        </div>
      </section>

      {/* CATÁLOGO Y PORTAFOLIO */}
      <section id="catalog-gallery-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        
        {/* Cabecera de Catálogo y Filtros */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block">
                Portafolio de Trabajo
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white">
              Catálogo de Fotos
            </h2>
            <p className="text-sm text-stone-400 mt-1">
              Explora las sesiones fotográficas realizadas recientemente
            </p>
          </div>

          {/* Filtros de Categoría */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs font-semibold px-4 py-2.5 rounded-full whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                    : 'bg-stone-800/80 text-stone-300 hover:bg-stone-700 hover:text-white border border-stone-700/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Galería Grid: 2 columnas en celular (compacto para no cansar al cliente), 3 en tablet y 4 en PC */}
        {filteredPhotos.length === 0 ? (
          <div className="p-8 sm:p-12 text-center bg-stone-900/60 border border-dashed border-amber-500/20 rounded-3xl max-w-md mx-auto my-8 shadow-xl">
            <Camera className="w-10 h-10 text-amber-400 mx-auto mb-3 opacity-80" />
            <h3 className="text-base sm:text-lg font-serif font-bold text-white">Catálogo en Actualización</h3>
            <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
              Pronto publicaremos nuevas fotos para esta categoría. Explora las demás secciones de nuestro portafolio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
            {filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setPreviewPhoto(photo)}
                className="group relative rounded-xl sm:rounded-2xl overflow-hidden bg-stone-900 border border-stone-800/80 shadow-md hover:border-amber-500/50 hover:shadow-xl transition-all duration-300 cursor-pointer"
              >
                {/* Contenedor de Imagen con Protección Canvas Anti-Descarga y Anti-Inspección */}
                <div className="relative aspect-[3/4] sm:aspect-[4/5] w-full overflow-hidden bg-stone-950 select-none">
                  <ProtectedCanvasImage
                    src={photo.url}
                    alt={photo.title}
                    objectFit="cover"
                    className="group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Degradado oscuro inferior */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent opacity-80 group-hover:opacity-95 transition-opacity pointer-events-none" />

                {/* Badge de Categoría */}
                <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20">
                  <span className="text-[9px] sm:text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-stone-950/80 backdrop-blur-md text-amber-300 border border-amber-500/20">
                    {photo.category}
                  </span>
                </div>

                {/* Botón de Like */}
                <button
                  type="button"
                  onClick={(e) => toggleLike(photo.id, e)}
                  className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2.5 rounded-full bg-stone-950/60 backdrop-blur-md border border-white/10 text-stone-300 hover:text-red-400 hover:scale-110 active:scale-95 transition-all z-20"
                >
                  <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${likes[photo.id] ? 'fill-red-500 text-red-500' : ''}`} />
                </button>

                {/* Información de la Foto (Optimizada para pantalla móvil) */}
                <div className="absolute bottom-0 inset-x-0 p-2.5 sm:p-4 z-20 pointer-events-none">
                  <h3 className="text-xs sm:text-base font-bold text-white font-serif line-clamp-1 group-hover:text-amber-300 transition-colors">
                    {photo.title}
                  </h3>
                  <div className="flex items-center justify-between text-[10px] sm:text-xs text-stone-300 mt-0.5 sm:mt-1">
                    <span className="flex items-center gap-1 text-stone-400 truncate max-w-[70%]">
                      <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{photo.location}</span>
                    </span>
                    <span className="text-amber-400 font-semibold group-hover:underline text-[10px] sm:text-xs shrink-0">
                      Ver foto
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Banner informativo de cierre */}
        <div className="mt-16 bg-gradient-to-r from-amber-950/20 via-stone-900 to-amber-950/20 border border-amber-500/20 rounded-3xl p-6 sm:p-10 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block mb-1">
            Sebastian G • Fotografía & Edición Profesional
          </span>
          <p className="text-sm text-stone-300 font-light max-w-xl mx-auto mb-3">
            "Capturamos momentos, creamos recuerdos. ♡"
          </p>
          <p className="text-xs text-stone-400 max-w-md mx-auto">
            💡 Toca cualquiera de las fotos de arriba para verla en alta definición.
          </p>
        </div>
      </section>

      {/* MODAL LIGHTBOX PROFESIONAL DE FOTOGRAFÍA (INMERSIVO, RESPONSIVE, ANTI-DISTORSIÓN) */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col justify-between p-3 sm:p-5 select-none animate-fadeIn cursor-pointer"
        >
          {/* 1. BARRA SUPERIOR: BRANDING, CONTADOR Y BOTÓN DE CERRAR */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3 text-white pb-3 border-b border-stone-800/80 cursor-default flex-shrink-0"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Camera className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-serif font-bold text-white tracking-wide block">
                  Sebastian G • Fotografía Profesional
                </span>
                <span className="text-[10px] text-amber-400/90 font-medium">
                  {previewPhoto.category}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {filteredPhotos.length > 0 && previewIndex >= 0 && (
                <span className="text-[11px] font-mono font-medium text-stone-400 bg-stone-900 border border-stone-800 px-2.5 py-1 rounded-full hidden sm:inline-block">
                  {previewIndex + 1} / {filteredPhotos.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700/80 text-stone-200 hover:text-white text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                title="Cerrar vista (Escape o toca afuera)"
              >
                <X className="w-4 h-4 text-stone-300" />
                <span className="hidden sm:inline">Cerrar</span>
              </button>
            </div>
          </div>

          {/* 2. ÁREA CENTRAL DE VISUALIZACIÓN DE FOTO CON BOTONES DE NAVEGACIÓN ANTERIOR / SIGUIENTE */}
          <div 
            className="relative w-full flex-1 flex items-center justify-center my-auto overflow-hidden py-2"
          >
            {/* Flecha Anterior */}
            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="absolute left-1 sm:left-4 z-30 p-2.5 sm:p-3.5 rounded-full bg-stone-950/70 hover:bg-stone-900 border border-stone-700/80 text-white hover:text-amber-400 hover:scale-110 active:scale-95 transition-all shadow-xl backdrop-blur-md cursor-pointer"
                title="Foto anterior (Flecha izquierda)"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            {/* Contenedor Protegido de la Foto en Proporción Original Perfecta */}
            <div 
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[72vh] sm:max-h-[78vh] max-w-[94vw] sm:max-w-[85vw] flex items-center justify-center cursor-default"
            >
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[72vh] sm:max-h-[78vh] max-w-[94vw] sm:max-w-[85vw] w-auto h-auto object-contain rounded-xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-stone-800/80 select-none pointer-events-none"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />

              {/* Escudo protector invisible anti-descarga */}
              <div 
                className="absolute inset-0 z-10 bg-transparent select-none"
                onContextMenu={(e) => e.preventDefault()}
              />

              {/* Marca de agua central transparente */}
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none opacity-20">
                <img 
                  src="/logo-white.png" 
                  alt="" 
                  className="w-20 sm:w-28 opacity-25 select-none pointer-events-none"
                />
              </div>
            </div>

            {/* Flecha Siguiente */}
            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={handleNextPhoto}
                className="absolute right-1 sm:right-4 z-30 p-2.5 sm:p-3.5 rounded-full bg-stone-950/70 hover:bg-stone-900 border border-stone-700/80 text-white hover:text-amber-400 hover:scale-110 active:scale-95 transition-all shadow-xl backdrop-blur-md cursor-pointer"
                title="Foto siguiente (Flecha derecha)"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </div>

          {/* 3. BARRA INFERIOR: TÍTULO, LOCACIÓN Y BOTÓN DIRECTO DE WHATSAPP */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-7xl mx-auto pt-3 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs flex-shrink-0 cursor-default"
          >
            <div className="text-center sm:text-left min-w-0">
              <h3 className="text-sm sm:text-base font-serif font-bold text-white truncate">
                {previewPhoto.title}
              </h3>
              <p className="text-[11px] text-stone-400 flex items-center justify-center sm:justify-start gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">{previewPhoto.location || 'San Antero & Coveñas'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => handleInquirePhotoWhatsApp(previewPhoto)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 active:scale-95 transition-all cursor-pointer"
                title="Preguntar o cotizar esta sesión por WhatsApp"
              >
                <MessageCircle className="w-4 h-4 fill-white text-white" />
                <span>Consultar por WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-3.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700/80 text-stone-300 hover:text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
