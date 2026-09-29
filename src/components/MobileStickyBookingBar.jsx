import React from 'react';
import { Calendar, Sparkles, ArrowRight } from 'lucide-react';

export default function MobileStickyBookingBar({ onOpenBooking, currentView }) {
  // Solo se muestra en las vistas públicas principales (Home y Paquetes) y no en Admin o Galería privada
  if (currentView !== 'home' && currentView !== 'packages') {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-stone-950/95 backdrop-blur-lg border-t border-amber-500/30 shadow-[0_-10px_25px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-bottom duration-300">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        
        {/* Info Rápida de la Sesión */}
        <div className="flex flex-col min-w-0 pl-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 truncate">
              Cupos Disponibles
            </span>
          </div>
          <span className="text-xs text-stone-300 font-medium truncate">
            Desde <strong className="text-white font-mono font-bold">$45.000 COP</strong>
          </span>
        </div>

        {/* Botón CTA Prominente e Imposible de Perder */}
        <button
          type="button"
          onClick={() => onOpenBooking(null)}
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-stone-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-amber-500/30 active:scale-95 transition-all touch-manipulation cursor-pointer border border-amber-300/40"
        >
          <Calendar className="w-4 h-4 text-stone-950" />
          <span>Agendar Sesión</span>
          <ArrowRight className="w-3.5 h-3.5 text-stone-950" />
        </button>
      </div>
    </div>
  );
}
