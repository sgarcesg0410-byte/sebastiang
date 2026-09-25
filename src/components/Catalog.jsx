import React, { useState, useEffect } from 'react';
import { Sparkles, MapPin, Heart, ArrowRight, Eye, Calendar, Camera, Shield, Lock, X, Share2, Check } from 'lucide-react';
import { trackLinkShare } from '../services/analytics';
import ProtectedCanvasImage from './ProtectedCanvasImage';

export default function Catalog({ catalog = [], onOpenBooking, onNavigateToAdmin, packages = [] }) {
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [likes, setLikes] = useState({});
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Si la ventana pierde foco, se minimiza o detecta captura/DevTools, cerrar vista previa de inmediato
  useEffect(() => {
    const handleBlackoutOrBlur = () => {
      if (previewPhoto) {
        setPreviewPhoto(null);
      }
    };
    window.addEventListener('blur', handleBlackoutOrBlur);
    document.addEventListener('visibilitychange', handleBlackoutOrBlur);
    return () => {
      window.removeEventListener('blur', handleBlackoutOrBlur);
      document.removeEventListener('visibilitychange', handleBlackoutOrBlur);
    };
  }, [previewPhoto]);

  const categories = ['Todas', 'Retratos', 'Playas & Atardeceres', 'Campo & Naturaleza', 'Parejas & Bodas', 'Quinceañeras & Eventos'];

  const safeCatalog = Array.isArray(catalog) ? catalog.filter(Boolean) : [];

  const filteredPhotos = selectedCategory === 'Todas'
    ? safeCatalog
    : safeCatalog.filter(photo => photo && photo.category === selectedCategory);

  const toggleLike = (id, e) => {
    e.stopPropagation();
    setLikes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleShareApp = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const shareTitle = 'Sebastian G • Fotografía & Edición Profesional';

    if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: shareTitle,
          text: 'Capturamos tus mejores momentos. Mira el portafolio de Sebastian G:',
          url: shareUrl
        });
        trackLinkShare('native');
        return;
      } catch (e) {}
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      trackLinkShare('copy_link');
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
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

          {/* BOTONES DE ACCIÓN: EXPLORAR CATÁLOGO Y COMPARTIR PORTAFOLIO */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => {
                const el = document.getElementById('catalog-gallery-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-extrabold text-base sm:text-lg px-8 py-4 rounded-2xl shadow-xl shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                <Camera className="w-5 h-5 text-stone-950 stroke-[2.5]" />
              </div>
              <span className="text-stone-950 font-black">Explorar Catálogo de Fotos</span>
              <ArrowRight className="w-5 h-5 ml-1 text-stone-950 stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={handleShareApp}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 hover:border-amber-500/50 text-stone-200 hover:text-white font-bold text-base px-6 py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98]"
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
          <p className="text-xs text-stone-400 mt-3">
            ✨ Toca cualquier fotografía del portafolio para verla en detalle y agendar tu sesión.
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
                      Ver foto & reservar
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
            💡 Toca cualquiera de las fotos de arriba para verla en pantalla completa y reservar tu sesión con esa temática o locación.
          </p>
        </div>
      </section>

      {/* MODAL DE VISTA PREVIA DE FOTO DEL CATÁLOGO (PROTEGIDO) */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 cursor-pointer select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-stone-700 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl cursor-default flex flex-col max-h-[92vh]"
          >
            {/* Cabecera de Seguridad */}
            <div className="px-4 py-2.5 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  Vista Protegida contra Capturas • Sebastian G
                </span>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1 text-stone-400 hover:text-white rounded-lg transition-colors"
                title="Cerrar vista previa"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenedor de Imagen Protegida con Canvas Anti-Inspección */}
            <div className="relative w-full bg-black flex items-center justify-center min-h-[320px] max-h-[66vh] overflow-hidden select-none">
              <ProtectedCanvasImage
                src={previewPhoto.url}
                alt={previewPhoto.title}
                objectFit="contain"
                className="max-h-[64vh]"
              />
            </div>

            <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-stone-900 border-t border-stone-800">
              <div>
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                  {previewPhoto.category}
                </span>
                <h4 className="text-lg font-serif font-bold text-white">{previewPhoto.title}</h4>
                <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  {previewPhoto.location}
                </p>
              </div>
              <button
                onClick={() => {
                  const chosenPhoto = previewPhoto;
                  setPreviewPhoto(null);
                  if (onOpenBooking) onOpenBooking(chosenPhoto);
                }}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs sm:text-sm px-6 py-3 rounded-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-stone-950 text-stone-950" />
                <span>Reservar sesión con esta foto</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
