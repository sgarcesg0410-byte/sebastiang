import React, { useState } from 'react';
import { ShieldCheck, Menu, X, Sparkles, Lock, MessageCircle } from 'lucide-react';

export default function Navbar({ onOpenBooking, onReplayIntro, currentView, setCurrentView, photographerName = "Sebastian G" }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (view) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 sm:h-24 flex items-center justify-between">
        
        {/* Logotipo Oficial SG */}
        <div 
          onClick={() => navigateTo('home')}
          className="flex items-center gap-3 cursor-pointer group py-1"
        >
          <img 
            src="/app-icon.png" 
            alt="Sebastian G" 
            className="h-11 w-11 sm:h-14 sm:w-14 rounded-2xl object-cover shadow-lg shadow-pink-500/25 border border-white/20 group-hover:scale-105 transition-all" 
          />
          <div className="flex flex-col">
            <span className="text-lg sm:text-xl font-serif font-bold text-white tracking-wide leading-tight group-hover:text-amber-300 transition-colors">
              {photographerName}
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 block">
              Fotografía & Edición Profesional
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

        {/* Contacto Directo WhatsApp Desktop */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="https://wa.me/573244725167?text=Hola%20Sebastian,%20estoy%20viendo%20tu%20sitio%20web%20y%20me%20gustar%C3%ADa%20hacerte%20una%20consulta."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-stone-900 border border-stone-800 hover:border-emerald-500/50 text-stone-300 hover:text-emerald-400 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>WhatsApp Directo</span>
          </a>
        </div>

        {/* Acciones Móviles: Menú Limpio sin saturación de botones */}
        <div className="flex md:hidden items-center gap-2">
          <a
            href="https://wa.me/573244725167?text=Hola%20Sebastian,%20estoy%20viendo%20tu%20sitio%20web%20y%20me%20gustar%C3%ADa%20hacerte%20una%20consulta."
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-stone-300 hover:text-emerald-400 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center"
            title="WhatsApp Directo"
          >
            <MessageCircle className="w-5 h-5 text-emerald-400" />
          </a>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-stone-300 hover:text-white rounded-xl bg-stone-900 border border-stone-800"
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

          {onReplayIntro && (
            <button
              onClick={() => { setMobileMenuOpen(false); onReplayIntro(); }}
              className="w-full text-left py-2.5 px-3 rounded-xl bg-stone-800/50 text-amber-300 text-xs font-semibold hover:bg-stone-800 flex items-center gap-2 border border-stone-700/50 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>✨ Ver Animación de Entrada del Logo</span>
            </button>
          )}

          <div className="pt-3 border-t border-stone-800">
            <a
              href="https://wa.me/573244725167?text=Hola%20Sebastian,%20estoy%20viendo%20tu%20sitio%20web%20y%20me%20gustar%C3%ADa%20hacerte%20una%20consulta."
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 bg-stone-950 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 font-bold text-sm py-3 rounded-xl shadow-lg"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>Escribir por WhatsApp</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
