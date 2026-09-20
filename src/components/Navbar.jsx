import React, { useState } from 'react';
import { ShieldCheck, Menu, X, Sparkles } from 'lucide-react';

export default function Navbar({ onOpenBooking, currentView, setCurrentView, photographerName = "Sebastian G" }) {
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
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-700 transition-colors ${
              currentView === 'admin' ? 'bg-stone-800 text-amber-400 border-amber-500/50' : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            Panel Fotógrafo
          </button>
        </nav>

        {/* Botón Acción Principal */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={onOpenBooking}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-300 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4 fill-stone-950" />
            <span>Reservar Sesión</span>
          </button>
        </div>

        {/* Botón Hamburguesa Móvil Limpio */}
        <div className="flex md:hidden items-center">
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
            className="block w-full text-left py-2 text-stone-400 text-sm hover:text-stone-200"
          >
            🔐 Panel del Fotógrafo
          </button>

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
