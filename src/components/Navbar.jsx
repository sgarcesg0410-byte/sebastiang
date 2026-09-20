import React, { useState } from 'react';
import { ShieldCheck, Menu, X, Sparkles } from 'lucide-react';
import { InstagramIcon, FacebookIcon, SOCIAL_LINKS } from './SocialIcons';

export default function Navbar({ onOpenBooking, onReplayIntro, currentView, setCurrentView, photographerName = "Sebastian G" }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (view) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
        
        {/* Logotipo / Firma Real en Blanco Brillante */}
        <div 
          onClick={() => navigateTo('home')}
          className="flex items-center gap-3 cursor-pointer group py-1"
        >
          <img 
            src="/logo-white.png" 
            alt="Sebastian G - Fotografía / Edición" 
            className="h-16 sm:h-20 w-auto object-contain filter drop-shadow-[0_2px_12px_rgba(255,255,255,0.4)] group-hover:scale-105 transition-all" 
          />
          <div className="hidden sm:block border-l border-stone-800 pl-3">
            <span className="text-[11px] font-bold tracking-widest uppercase text-amber-400 block">
              San Antero • Córdoba
            </span>
          </div>
        </div>

        {/* Menú Desktop */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => navigateTo('home')}
            className={`text-sm font-medium transition-colors ${
              currentView === 'home' ? 'text-amber-400' : 'text-stone-300 hover:text-stone-100'
            }`}
          >
            Catálogo & Portafolio
          </button>

          <button
            onClick={() => navigateTo('packages')}
            className={`text-sm font-medium transition-colors ${
              currentView === 'packages' ? 'text-amber-400' : 'text-stone-300 hover:text-stone-100'
            }`}
          >
            Paquetes & Precios
          </button>

          <button
            onClick={() => navigateTo('demo-gallery')}
            className={`text-sm font-medium flex items-center gap-1.5 transition-colors ${
              currentView === 'gallery' ? 'text-amber-400' : 'text-amber-200/80 hover:text-amber-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Probar Enlace de Fotos</span>
          </button>

          <button
            onClick={() => navigateTo('admin')}
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
              currentView === 'admin' 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm' 
                : 'text-stone-300 hover:text-white bg-stone-900/90 border-stone-800 hover:border-amber-500/40'
            }`}
            title="Panel de control para subir fotos al catálogo, actualizar precios y gestionar sesiones"
          >
            <span>🔐 Panel Fotógrafo</span>
          </button>

          {onReplayIntro && (
            <button
              onClick={onReplayIntro}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border text-amber-300/90 hover:text-amber-200 bg-amber-500/10 border-amber-500/30 hover:border-amber-400/50 transition-all flex items-center gap-1.5 active:scale-95"
              title="Ver animación de bienvenida con el logo 3D interactivo"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver Intro</span>
            </button>
          )}
        </nav>

        {/* Botón Acción Principal y Redes Sociales Desktop */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-1.5 border-r border-stone-800/80 pr-4">
            <a
              href={SOCIAL_LINKS.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-stone-400 hover:text-pink-400 hover:bg-stone-900 rounded-xl transition-all border border-transparent hover:border-pink-500/30 group"
              title="Sígueme en Instagram (@sgarces01)"
              aria-label="Instagram de Sebastian G"
            >
              <InstagramIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </a>
            <a
              href={SOCIAL_LINKS.facebook.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-stone-400 hover:text-blue-400 hover:bg-stone-900 rounded-xl transition-all border border-transparent hover:border-blue-500/30 group"
              title="Sígueme en Facebook (/Sgarces01)"
              aria-label="Facebook de Sebastian G"
            >
              <FacebookIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </a>
          </div>

          <button
            onClick={onOpenBooking}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-300 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4 fill-stone-950" />
            <span>Reservar Sesión</span>
          </button>
        </div>

        {/* Acciones Móviles: Redes Rápidas y Hamburguesa */}
        <div className="flex md:hidden items-center gap-2">
          <a
            href={SOCIAL_LINKS.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-pink-400 hover:text-pink-300 bg-stone-900/90 border border-stone-800 rounded-xl active:scale-95 transition-transform"
            aria-label="Instagram de Sebastian G"
            title="Instagram (@sgarces01)"
          >
            <InstagramIcon className="w-4 h-4" />
          </a>
          <a
            href={SOCIAL_LINKS.facebook.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-blue-400 hover:text-blue-300 bg-stone-900/90 border border-stone-800 rounded-xl active:scale-95 transition-transform"
            aria-label="Facebook de Sebastian G"
            title="Facebook (/Sgarces01)"
          >
            <FacebookIcon className="w-4 h-4" />
          </a>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 text-stone-300 hover:text-white rounded-xl bg-stone-900 border border-stone-800"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="w-6 h-6 text-amber-400" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Menú Desplegable Móvil */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-stone-900 border-b border-stone-800 px-5 py-6 space-y-4">
          <button
            onClick={() => navigateTo('home')}
            className="block w-full text-left py-2 text-stone-200 font-medium text-base hover:text-amber-400"
          >
            Catálogo & Portafolio
          </button>
          <button
            onClick={() => navigateTo('packages')}
            className="block w-full text-left py-2 text-stone-200 font-medium text-base hover:text-amber-400"
          >
            Paquetes & Precios
          </button>
          <button
            onClick={() => navigateTo('demo-gallery')}
            className="block w-full text-left py-2 text-amber-300 font-medium text-base flex items-center gap-2"
          >
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span>Probar Enlace de Fotos (Demo 3 días)</span>
          </button>
          <button
            onClick={() => navigateTo('admin')}
            className="block w-full text-left py-2.5 px-3 rounded-xl bg-stone-800/90 text-amber-300 text-sm font-semibold hover:bg-stone-800 flex items-center justify-between border border-amber-500/20"
          >
            <span>🔐 Panel del Fotógrafo</span>
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">Subir fotos</span>
          </button>

          {onReplayIntro && (
            <button
              onClick={() => { setMobileMenuOpen(false); onReplayIntro(); }}
              className="w-full text-left py-2.5 px-3 rounded-xl bg-stone-800/50 text-amber-300 text-xs font-semibold hover:bg-stone-800 flex items-center gap-2 border border-stone-700/50 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>✨ Ver Animación de Entrada del Logo</span>
            </button>
          )}

          {/* Redes Sociales en Menú Móvil */}
          <div className="pt-3 border-t border-stone-800">
            <span className="text-xs text-stone-400 font-medium block mb-2">Sígueme en redes sociales:</span>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={SOCIAL_LINKS.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-semibold transition-all"
              >
                <InstagramIcon className="w-4 h-4" />
                <span>Instagram</span>
              </a>
              <a
                href={SOCIAL_LINKS.facebook.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all"
              >
                <FacebookIcon className="w-4 h-4" />
                <span>Facebook</span>
              </a>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-800">
            <button
              onClick={() => { setMobileMenuOpen(false); onOpenBooking(); }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-bold text-base py-3 rounded-xl shadow-lg shadow-amber-500/20"
            >
              <Sparkles className="w-5 h-5" />
              <span>Reservar Sesión Ahora</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
