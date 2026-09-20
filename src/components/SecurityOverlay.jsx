import React, { useEffect, useState, useRef } from 'react';
import { ShieldAlert, Lock, AlertTriangle } from 'lucide-react';

export default function SecurityOverlay({ children, enabled = true }) {
  const [warningMessage, setWarningMessage] = useState(null);
  const [isShieldActive, setIsShieldActive] = useState(false);
  const shieldTimeoutRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const triggerWarning = (msg, duration = 3500) => {
      setWarningMessage(msg);
      if (navigator.vibrate) {
        navigator.vibrate([50, 40, 50]);
      }
      setTimeout(() => setWarningMessage(null), duration);
    };

    const activateShield = (reason) => {
      setIsShieldActive(true);
      triggerWarning(reason, 4000);
      if (shieldTimeoutRef.current) clearTimeout(shieldTimeoutRef.current);
      shieldTimeoutRef.current = setTimeout(() => {
        setIsShieldActive(false);
      }, 2500);
    };

    // 1. BLOQUEO DE GESTOS MULTI-TÁCTILES EN CELULARES (Xiaomi 3 dedos, Samsung palma, etc.)
    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length >= 2) {
        // Gesto multi-touch detectado
        e.preventDefault();
        e.stopPropagation();
        activateShield('⚠️ Gesto multi-táctil bloqueado: Las capturas de pantalla están protegidas.');
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
        activateShield('⚠️ Gesto de captura bloqueado por seguridad.');
      }
    };

    // 2. APAGÓN DE SEGURIDAD POR PÉRDIDA DE FOCO / CAMBIO DE VISIBILIDAD (Botones físicos de captura)
    const handleBlur = () => {
      setIsShieldActive(true);
      // Limpiar portapapeles en intento de captura
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('Contenido protegido por derechos de autor - Sebastian G');
        }
      } catch (err) {}
    };

    const handleFocus = () => {
      if (shieldTimeoutRef.current) clearTimeout(shieldTimeoutRef.current);
      shieldTimeoutRef.current = setTimeout(() => {
        setIsShieldActive(false);
      }, 600);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsShieldActive(true);
      } else {
        setTimeout(() => setIsShieldActive(false), 500);
      }
    };

    // 3. BLOQUEO DE CLIC DERECHO Y PULSACIÓN PROLONGADA
    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerWarning('Las opciones de descarga y clic derecho están bloqueadas.');
    };

    // 4. BLOQUEO DE TECLAS DE INSPECCIÓN Y CAPTURA EN PC / TABLET
    const handleKeyDown = (e) => {
      // PrintScreen
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        e.stopPropagation();
        activateShield('🚫 Captura de pantalla bloqueada.');
        try {
          if (navigator.clipboard) {
            navigator.clipboard.writeText('');
          }
        } catch (err) {}
        return false;
      }

      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        triggerWarning('El modo desarrollador está deshabilitado.');
        return false;
      }

      // Ctrl + Shift + I, Ctrl + Shift + J, Ctrl + Shift + C, Ctrl + Shift + S
      if (e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        triggerWarning('Acción deshabilitada por seguridad.');
        return false;
      }

      // Ctrl + U (Ver código fuente)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        triggerWarning('Ver código fuente está deshabilitado.');
        return false;
      }

      // Ctrl + S (Guardar página) o Ctrl + P (Imprimir)
      if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        triggerWarning('Guardar o imprimir fotos está restringido.');
        return false;
      }
    };

    // 5. BLOQUEO DE ARRASTRE DE IMÁGENES
    const handleDragStart = (e) => {
      if (e.target.tagName === 'IMG') {
        e.preventDefault();
      }
    };

    // Escuchadores pasivos false para poder interceptar gestos
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
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
      
      {/* ESCUDO DE APAGÓN TOTAL AL INTENTAR CAPTURA O GESTO MULTI-TOUCH */}
      {isShieldActive && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 mb-6 shadow-[0_0_50px_rgba(245,158,11,0.3)] animate-pulse">
            <Lock className="w-10 h-10" />
          </div>

          <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-2">
            Vista Protegida contra Capturas
          </h3>
          <p className="text-sm text-amber-300/90 font-medium max-w-md mx-auto mb-4">
            Sebastian G • Propiedad Intelectual Protegida
          </p>
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 max-w-sm text-xs text-stone-400 leading-relaxed">
            Las fotografías están protegidas contra capturas de pantalla, gestos y descargas no autorizadas para salvaguardar la privacidad de la sesión.
          </div>
        </div>
      )}

      {/* ALERTA FLOTANTE CUANDO SE INTERCEPTA UNA ACCIÓN */}
      {warningMessage && !isShieldActive && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999] max-w-md w-[92%] bg-stone-900/95 border-2 border-amber-500/80 text-white px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce">
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
