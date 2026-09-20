import React, { useState } from 'react';
import { Sparkles, MapPin, Heart, ArrowRight, Eye, Calendar, Camera } from 'lucide-react';

export default function Catalog({ catalog = [], onOpenBooking, onNavigateToAdmin, packages = [] }) {
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [likes, setLikes] = useState({});
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const categories = ['Todas', 'Playas San Antero', 'Retratos', 'Parejas & Bodas', 'Quinceañeras'];

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

  return (
    <div className="pb-24">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 px-4 sm:px-6 lg:px-8 border-b border-stone-800/60 bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <MapPin className="w-3.5 h-3.5" />
            <span>Fotografía Profesional en San Antero, Córdoba</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white font-serif mb-6 leading-tight">
            Capturamos tus <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">mejores momentos</span> junto al mar
          </h1>

          <p className="text-lg sm:text-xl text-stone-300 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Sesiones de retratos, bodas, quinceañeras y parejas en Playa Blanca, Cispatá y locaciones privadas.
          </p>

          {/* BOTÓN RESERVAR SESIÓN PROMINENTE */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onOpenBooking}
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-extrabold text-lg px-8 py-4 rounded-2xl shadow-xl shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Calendar className="w-6 h-6 fill-stone-950" />
              <span>Reservar Mi Sesión Ahora</span>
              <ArrowRight className="w-5 h-5 ml-1" />
            </button>
            <p className="text-xs text-stone-400 sm:hidden">
              ⚡ Sin registro previo • Respuesta rápida por WhatsApp
            </p>
          </div>
        </div>
      </section>

      {/* CATÁLOGO Y PORTAFOLIO */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        
        {/* Cabecera de Catálogo y Filtros */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block">
                Portafolio de Trabajo
              </span>
              {onNavigateToAdmin && (
                <button
                  type="button"
                  onClick={onNavigateToAdmin}
                  className="text-[11px] font-bold text-amber-300 hover:text-amber-200 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 transition-all hover:scale-105"
                  title="Entra a tu panel para subir fotos al catálogo"
                >
                  + Subir Fotos
                </button>
              )}
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

        {/* Galería Grid */}
        {filteredPhotos.length === 0 ? (
          <div className="p-10 sm:p-14 text-center bg-stone-900/60 border border-dashed border-amber-500/30 rounded-3xl max-w-xl mx-auto my-8 shadow-xl">
            <Camera className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-serif font-bold text-white">Catálogo de Fotos Listo</h3>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Las fotos de muestra han sido retiradas. Sube tus fotos reales de sesiones de Lightroom para que tus clientes las vean aquí.
            </p>
            {onNavigateToAdmin && (
              <button
                type="button"
                onClick={onNavigateToAdmin}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
              >
                <Sparkles className="w-4 h-4 fill-stone-950" />
                <span>📸 Entrar al Panel para Subir Fotos</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setPreviewPhoto(photo)}
                className="group relative rounded-2xl overflow-hidden bg-stone-900 border border-stone-800/80 shadow-lg hover:border-amber-500/50 transition-all duration-300 cursor-pointer"
              >
              {/* Contenedor de Imagen */}
              <div className="aspect-[4/5] w-full overflow-hidden bg-stone-950">
                <img
                  src={photo.url}
                  alt={photo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>

              {/* Degradado oscuro inferior */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

              {/* Badge de Categoría */}
              <div className="absolute top-4 left-4">
                <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-md bg-stone-950/70 backdrop-blur-md text-amber-300 border border-amber-500/20">
                  {photo.category}
                </span>
              </div>

              {/* Botón de Like */}
              <button
                onClick={(e) => toggleLike(photo.id, e)}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-stone-950/60 backdrop-blur-md border border-white/10 text-stone-300 hover:text-red-400 hover:scale-110 active:scale-95 transition-all"
              >
                <Heart className={`w-4 h-4 ${likes[photo.id] ? 'fill-red-500 text-red-500' : ''}`} />
              </button>

              {/* Información de la Foto */}
              <div className="absolute bottom-0 inset-x-0 p-5">
                <h3 className="text-lg font-bold text-white font-serif mb-1 group-hover:text-amber-300 transition-colors">
                  {photo.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-stone-300">
                  <span className="flex items-center gap-1 text-stone-400">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    {photo.location}
                  </span>
                  <span className="text-amber-400 font-medium group-hover:underline flex items-center gap-1">
                    Ver detalle
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

        {/* Banner informativo de cierre */}
        <div className="mt-16 bg-gradient-to-r from-amber-950/30 via-stone-900 to-amber-950/30 border border-amber-500/20 rounded-3xl p-6 sm:p-10 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block mb-1">
            Sebastian G • San Antero
          </span>
          <p className="text-sm text-stone-300 font-light max-w-xl mx-auto mb-6">
            "Capturamos momentos, creamos recuerdos. ♡" • Explora nuestros paquetes para ver precios y agendar tu fecha.
          </p>

          <button
            onClick={onOpenBooking}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 fill-stone-950" />
            <span>Agendar Mi Sesión</span>
          </button>
        </div>
      </section>

      {/* MODAL DE VISTA PREVIA DE FOTO DEL CATÁLOGO */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-stone-700 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl cursor-default flex flex-col max-h-[90vh]"
          >
            <div className="relative w-full bg-black/90 flex items-center justify-center p-2 min-h-[300px] max-h-[70vh] overflow-hidden">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[68vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
            <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
                  {previewPhoto.category}
                </span>
                <h4 className="text-xl font-serif font-bold text-white">{previewPhoto.title}</h4>
                <p className="text-xs text-stone-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  {previewPhoto.location}
                </p>
              </div>
              <button
                onClick={() => { setPreviewPhoto(null); onOpenBooking(); }}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs px-5 py-2.5 rounded-xl shadow-md"
              >
                Reservar sesión similar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
