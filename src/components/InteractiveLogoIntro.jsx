import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, Camera, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function InteractiveLogoIntro({ onComplete }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [particlesCount, setParticlesCount] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const containerRef = useRef(null);

  // Manejador de movimiento 3D (para ratón y dedos táctiles)
  const handlePointerMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || rect.width / 2;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || rect.height / 2;

    const x = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const y = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);

    // Limitamos la rotación 3D a un ángulo elegante de 15 grados
    setTilt({
      x: -y * 14,
      y: x * 14
    });
    setIsInteracting(true);
  };

  const handlePointerLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsInteracting(false);
  };

  // Efecto interactivo al tocar el logo
  const handleLogoTouch = (e) => {
    e.stopPropagation();
    setParticlesCount(prev => prev + 1);

    // Vibración háptica en celulares
    if (navigator.vibrate) {
      navigator.vibrate([35, 20, 45]);
    }

    // Ráfaga de confeti con los colores oficiales de Instagram y destellos blancos
    try {
      confetti({
        particleCount: 45,
        spread: 75,
        origin: { y: 0.5 },
        colors: ['#EE0979', '#FF6A00', '#FFD600', '#9B51E0', '#405DE6', '#FFFFFF'],
        disableForReducedMotion: true
      });
    } catch (err) {
      // Ignorar si confetti falla
    }
  };

  const handleEnter = () => {
    setFadeOut(true);
    setTimeout(() => {
      onComplete();
    }, 450);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handlePointerMove}
      onTouchMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      onClick={handleEnter}
      className={`fixed inset-0 z-[100] bg-stone-950 flex flex-col items-center justify-between p-6 cursor-pointer select-none transition-opacity duration-500 overflow-hidden ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* FONDO AMBIENTAL CON DESTELLOS Y MALLA */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Halo dinámico con gradiente atardecer que sigue la inclinación */}
        <div 
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(225,48,108,0.22)_0%,rgba(64,93,230,0.12)_45%,transparent_70%)] transition-transform duration-300 ease-out"
          style={{
            transform: `translate(${tilt.y * 3}px, ${-tilt.x * 3}px) scale(1.1)`
          }}
        />
        {/* Grano sutil */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      {/* BOTÓN SUPERIOR SALTAR */}
      <div className="w-full flex justify-end relative z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEnter();
          }}
          className="text-stone-400 hover:text-white text-xs px-3 py-1.5 rounded-full bg-stone-900/80 border border-stone-800 flex items-center gap-1.5 transition-colors"
        >
          <span>Saltar</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* LOGO CENTRAL 3D INTERACTIVO */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-6">
        
        {/* Contenedor con perspectiva 3D */}
        <div 
          style={{ perspective: '1000px' }}
          className="relative touch-manipulation"
        >
          <div
            onClick={handleLogoTouch}
            style={{
              transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isInteracting ? 1.05 : 1})`,
              transition: isInteracting ? 'transform 0.1s ease-out' : 'transform 0.5s ease-out'
            }}
            className="relative group p-8 sm:p-10 rounded-3xl bg-gradient-to-b from-stone-900/95 via-stone-900/85 to-stone-950/95 border border-pink-500/30 shadow-[0_20px_60px_rgba(225,48,108,0.25)] backdrop-blur-xl flex flex-col items-center cursor-pointer hover:border-pink-400/60 transition-colors"
          >
            {/* Destello de luz diagonal automático y en interacción */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute -inset-full bg-gradient-to-r from-transparent via-pink-400/20 to-transparent -translate-x-full animate-[shimmer_3.5s_infinite]" />
            </div>

            {/* Aura atardecer flotante detrás del logo */}
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 via-pink-500/25 to-purple-600/25 rounded-3xl blur-2xl -z-10 group-hover:opacity-100 transition-all duration-300" />

            {/* Imagen del nuevo logo SG estilo Instagram */}
            <img
              src="/app-icon.png"
              alt="Sebastian G"
              className="h-32 w-32 sm:h-40 sm:w-40 md:h-44 md:w-44 rounded-3xl object-contain shadow-2xl shadow-pink-500/40 transform transition-transform duration-300 group-hover:scale-105 active:scale-95 border border-white/20"
            />

            <span className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wide mt-4">
              Sebastian G
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-purple-400 mt-1">
              Fotografía • Edición
            </span>

            {/* Subtítulo dinámico con indicación táctil */}
            <div className="mt-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-500/15 via-pink-500/20 to-amber-500/15 border border-pink-500/35 text-pink-200 text-[11px] font-bold uppercase tracking-widest shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
              <span>{isInteracting ? '✨ ¡Toca para destellos de color!' : 'Toca el logo con tu dedo'}</span>
            </div>

            {particlesCount > 0 && (
              <span className="text-[10px] text-pink-300/80 mt-2 font-medium">
                Efectos interactivos activados: {particlesCount}
              </span>
            )}
          </div>
        </div>

        {/* Leyenda de ubicación y marca */}
        <div className="text-center mt-6 space-y-1">
          <p className="text-xs uppercase tracking-[0.25em] text-pink-400/90 font-bold">
            San Antero • Córdoba
          </p>
          <p className="text-stone-300 font-serif italic text-base sm:text-lg font-light">
            "Capturamos momentos, creamos recuerdos. ♡"
          </p>
        </div>
      </div>

      {/* BOTÓN INFERIOR DE ENTRADA */}
      <div className="w-full max-w-sm relative z-10 pb-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEnter();
          }}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-extrabold text-sm py-4 px-6 rounded-2xl shadow-xl shadow-amber-500/25 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] transition-all"
        >
          <Camera className="w-5 h-5 fill-stone-950" />
          <span>Entrar al Portafolio & Precios</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-center text-[11px] text-stone-500 mt-2">
          Toca en cualquier parte de la pantalla para ingresar
        </p>
      </div>
    </div>
  );
}
