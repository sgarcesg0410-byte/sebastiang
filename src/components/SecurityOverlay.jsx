import React, { useEffect, useState, useRef } from 'react';
import { ShieldAlert, Lock } from 'lucide-react';

export default function SecurityOverlay({ children, enabled = true }) {
  const [warningMessage, setWarningMessage] = useState(null);
  const releaseTimeoutRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const triggerWarningToast = (msg, duration = 3000) => {
      setWarningMessage(msg);
      if (navigator.vibrate) {
        try {
          navigator.vibrate([60, 40, 60]);
        } catch (e) {}
      }
      setTimeout(() => setWarningMessage(null), duration);
    };

    // APAGÓN SÍNCRONO INMEDIATO (0ms de latencia antes de que el SO tome la foto)
    const triggerInstantBlackout = (reason) => {
      document.documentElement.classList.add('security-blackout');
      const shield = document.getElementById('anti-screenshot-shield');
      if (shield) {
        shield.style.display = 'flex';
      }
      const reasonEl = document.getElementById('anti-screenshot-reason');
      if (reasonEl && reason) {
        reasonEl.textContent = reason;
      }

      // Vaciar portapapeles en cualquier intento de captura
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('Fotografía protegida - Sebastian G • San Antero');
        }
      } catch (err) {}

      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = setTimeout(() => {
        releaseInstantBlackout();
      }, 2200);
    };

    const releaseInstantBlackout = () => {
      document.documentElement.classList.remove('security-blackout');
      const shield = document.getElementById('anti-screenshot-shield');
      if (shield) {
        shield.style.display = 'none';
      }
    };

    // 1. BLOQUEO DE GESTOS MULTI-TÁCTILES (3 dedos Xiaomi/OnePlus/Realme/Motorola, palma Samsung)
    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length >= 2) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (err) {}
        triggerInstantBlackout('Gesto multi-táctil detectado. Las capturas están bloqueadas.');
        triggerWarningToast('🚫 Gesto de captura bloqueado por seguridad.');
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches.length >= 2) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (err) {}
        triggerInstantBlackout('Gesto de captura bloqueado.');
      }
    };

    // 2. APAGÓN POR PÉRDIDA DE FOCO (Botones físicos de captura Vol+Power / Barra de notificaciones)
    const handleBlur = () => {
      triggerInstantBlackout('Captura de pantalla o cambio de ventana bloqueado.');
    };

    const handleFocus = () => {
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = setTimeout(() => {
        releaseInstantBlackout();
      }, 350);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerInstantBlackout('Pantalla oculta.');
      } else {
        if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
        releaseTimeoutRef.current = setTimeout(() => {
          releaseInstantBlackout();
        }, 350);
      }
    };

    // 3. BLOQUEO DE CLIC DERECHO Y PULSACIÓN PROLONGADA
    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerWarningToast('Las opciones de descarga y clic derecho están deshabilitadas.');
    };

    // 4. BLOQUEO DE TECLAS DE CAPTURA EN PC / TABLETS
    const handleKeyDown = (e) => {
      // Tecla PrintScreen
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        e.stopPropagation();
        triggerInstantBlackout('Captura con PrintScreen bloqueada.');
        triggerWarningToast('🚫 Captura de pantalla bloqueada.');
        return false;
      }

      // Windows + Shift + S / Command + Shift + 3/4
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        triggerInstantBlackout('Herramienta de recortes bloqueada.');
        return false;
      }

      // F12 o Desarrollador
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'c' || e.key === 'C'))) {
        e.preventDefault();
        e.stopPropagation();
        triggerWarningToast('El modo inspección está deshabilitado.');
        return false;
      }

      // Guardar (Ctrl+S), Imprimir (Ctrl+P), Ver fuente (Ctrl+U)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        triggerWarningToast('Guardar o imprimir fotos está restringido.');
        return false;
      }
    };

    // 5. BLOQUEO DE ARRASTRE DE IMÁGENES
    const handleDragStart = (e) => {
      if (e.target.tagName === 'IMG') {
        e.preventDefault();
      }
    };

    // Registrar escuchadores
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, [enabled]);

  return (
    <div className="protected-photo-zone select-none relative min-h-screen">
      
      {/* ESCUDO DOM INSTANTÁNEO DE APAGÓN NEGRO (0MS) */}
      <div
        id="anti-screenshot-shield"
        onClick={() => {
          document.documentElement.classList.remove('security-blackout');
          const shield = document.getElementById('anti-screenshot-shield');
          if (shield) shield.style.display = 'none';
        }}
        className="fixed inset-0 z-[99999999] bg-black flex-col items-center justify-center p-6 text-center select-none cursor-pointer"
      >
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 mb-6 shadow-[0_0_50px_rgba(245,158,11,0.3)] animate-pulse">
          <Lock className="w-10 h-10" />
        </div>

        <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-2">
          Vista Protegida contra Capturas
        </h3>
        <p className="text-sm text-amber-300 font-semibold max-w-md mx-auto mb-2">
          Sebastian G • Propiedad Intelectual Protegida
        </p>
        <p id="anti-screenshot-reason" className="text-xs text-amber-400/80 font-mono mb-4">
          Captura de pantalla no autorizada
        </p>
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 max-w-sm text-xs text-stone-300 leading-relaxed">
          Las fotografías están protegidas contra capturas de pantalla, gestos y descargas no autorizadas.
        </div>
        <p className="text-[11px] text-amber-400/70 mt-6 font-medium">
          Toca en cualquier parte de la pantalla para desbloquear
        </p>
      </div>

      {/* ALERTA FLOTANTE EN CASO DE INTENTO BLOQUEADO */}
      {warningMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999999] max-w-md w-[92%] bg-stone-900/95 border-2 border-amber-500/80 text-white px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce">
          <ShieldAlert className="w-7 h-7 text-amber-400 shrink-0" />
          <div>
            <p className="font-bold text-xs uppercase tracking-wider text-amber-300">Protección Activa</p>
            <p className="text-xs text-stone-200 leading-tight">{warningMessage}</p>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
