import React, { useEffect, useRef } from 'react';

/**
 * SecurityOverlay - Escudo de Seguridad Silencioso e Invisible
 * Protege las fotografías contra capturas de pantalla (PrintScreen, atajos de recortes,
 * cambio de aplicación en Android/iOS, arrastre de imágenes e inspección DevTools)
 * sin mostrar alertas, letreros ni avisos que interrumpan o molesten al cliente.
 * Si alguien intenta capturar, la captura se guarda 100% en negro, pero al volver
 * a la pantalla el usuario continúa viendo la web de forma inmediata y fluida.
 */
export default function SecurityOverlay({ children, enabled = true }) {
  const releaseTimeoutRef = useRef(null);
  const isBlurredRef = useRef(false);
  const isBlackoutActiveRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // APAGÓN SÍNCRONO INMEDIATO (0ms de latencia: el SO solo captura negro absoluto)
    const triggerInstantBlackout = () => {
      isBlackoutActiveRef.current = true;
      document.documentElement.classList.add('security-blackout');
      const shield = document.getElementById('anti-screenshot-shield');
      if (shield) {
        shield.style.display = 'block';
      }

      // Vaciar portapapeles de manera silenciosa
      try {
        if (navigator.clipboard && navigator.clipboard.writeText && document.hasFocus()) {
          navigator.clipboard.writeText('').catch(() => {});
        }
      } catch (err) {}

      if (releaseTimeoutRef.current) {
        clearTimeout(releaseTimeoutRef.current);
        releaseTimeoutRef.current = null;
      }
    };

    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));

    const releaseInstantBlackout = () => {
      const hasFocusOrActive = isTouchDevice ? !document.hidden : (document.hasFocus() && !document.hidden);
      if (!hasFocusOrActive || isBlurredRef.current) {
        return;
      }
      isBlackoutActiveRef.current = false;
      document.documentElement.classList.remove('security-blackout');
      const shield = document.getElementById('anti-screenshot-shield');
      if (shield) {
        shield.style.display = 'none';
      }
      if (releaseTimeoutRef.current) {
        clearTimeout(releaseTimeoutRef.current);
        releaseTimeoutRef.current = null;
      }
    };

    // 1. BLOQUEO DE GESTOS MULTI-TÁCTILES Y DESPLIEGUE DE BARRA DE NOTIFICACIONES
    let touchStartY = 0;
    const handleTouchStart = (e) => {
      if (!e.touches || e.touches.length === 0) return;

      // Gestos de 3 o más dedos (gesto de captura en MIUI / Motorola / OnePlus / Oppo)
      // Se permite el gesto de 2 dedos para que el usuario pueda hacer zoom/pellizco normal en fotos
      if (e.touches.length >= 3) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (err) {}
        triggerInstantBlackout();
        return;
      }

      touchStartY = e.touches[0].clientY;
      if (touchStartY <= 15) {
        triggerInstantBlackout();
      }
    };

    const handleTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;

      // Gestos de 3 o más dedos
      if (e.touches.length >= 3) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (err) {}
        triggerInstantBlackout();
        return;
      }

      const currentY = e.touches[0].clientY;
      if (touchStartY <= 25 && currentY - touchStartY > 40) {
        if (!isBlackoutActiveRef.current) {
          triggerInstantBlackout();
        }
      }
    };

    // 2. APAGÓN POR PÉRDIDA DE FOCO (Panel de notificaciones, cambio de app, botones físicos)
    const handleBlur = () => {
      if (isTouchDevice && !document.hidden) {
        return;
      }
      isBlurredRef.current = true;
      triggerInstantBlackout();
    };

    // 3. RECUPERACIÓN DE FOCO INMEDIATA (Restauración fluida para el usuario en 50ms)
    const handleFocus = () => {
      isBlurredRef.current = false;
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = setTimeout(() => {
        const hasFocusOrActive = isTouchDevice ? !document.hidden : (document.hasFocus() && !document.hidden);
        if (hasFocusOrActive) {
          releaseInstantBlackout();
        }
      }, 50);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isBlurredRef.current = true;
        triggerInstantBlackout();
      } else {
        isBlurredRef.current = false;
        if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
        releaseTimeoutRef.current = setTimeout(() => {
          const hasFocusOrActive = isTouchDevice ? !document.hidden : (document.hasFocus() && !document.hidden);
          if (hasFocusOrActive) {
            releaseInstantBlackout();
          }
        }, 50);
      }
    };

    // 4. MONITOR DE SEGURIDAD (Silencioso)
    const focusCheckInterval = setInterval(() => {
      const shouldTrigger = isTouchDevice ? document.hidden : (!document.hasFocus() || document.hidden);
      if (shouldTrigger) {
        if (!isBlackoutActiveRef.current) {
          isBlurredRef.current = true;
          triggerInstantBlackout();
        }
      } else {
        if (isBlackoutActiveRef.current && !isBlurredRef.current) {
          releaseInstantBlackout();
        }
      }
    }, 200);

    // 5. BLOQUEO DE CLIC DERECHO SILENCIOSO
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 6. BLOQUEO DE TECLAS DE CAPTURA EN PC / TABLETS
    const handleKeyDown = (e) => {
      // PrintScreen
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        triggerInstantBlackout();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('').catch(() => {});
          }
        } catch (err) {}
        setTimeout(() => {
          releaseInstantBlackout();
        }, 180);
        return false;
      }

      // Windows + Shift + S / Command + Shift + 3/4/5
      if ((e.metaKey || e.ctrlKey || e.shiftKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
        if (e.shiftKey) {
          triggerInstantBlackout();
          setTimeout(() => {
            releaseInstantBlackout();
          }, 250);
        }
      }

      // F12 o Desarrollador
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'c' || e.key === 'C'))) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Guardar (Ctrl+S), Imprimir (Ctrl+P), Ver fuente (Ctrl+U)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        triggerInstantBlackout();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('').catch(() => {});
          }
        } catch (err) {}
        setTimeout(() => {
          releaseInstantBlackout();
        }, 180);
      }
    };

    // 7. BLOQUEO DE COPIA Y ARRASTRE DE IMÁGENES SILENCIOSO
    const handleDragStart = (e) => {
      if (e.target.tagName === 'IMG' || e.target.tagName === 'CANVAS') {
        e.preventDefault();
      }
    };

    const handleCopy = (e) => {
      e.preventDefault();
      try {
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', '');
        }
      } catch (err) {}
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('copy', handleCopy);

    return () => {
      clearInterval(focusCheckInterval);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('copy', handleCopy);
    };
  }, [enabled]);

  return (
    <div className="protected-photo-zone select-none relative min-h-screen">
      {/* ESCUDO DE APAGÓN NEGRO PURO 100% INVISIBLE Y SILENCIOSO (SIN TEXTO NI CANDADOS) */}
      <div
        id="anti-screenshot-shield"
        className="fixed inset-0 z-[2147483647] bg-black select-none pointer-events-none"
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
