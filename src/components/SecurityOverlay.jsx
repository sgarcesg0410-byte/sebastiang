import React, { useEffect, useState, useRef } from 'react';
import { ShieldAlert, Lock, ShieldCheck } from 'lucide-react';

export default function SecurityOverlay({ children, enabled = true }) {
  const [warningMessage, setWarningMessage] = useState(null);
  const releaseTimeoutRef = useRef(null);
  const isBlurredRef = useRef(false);
  const isBlackoutActiveRef = useRef(false);
  const lastFocusTimeRef = useRef(Date.now());
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const triggerWarningToast = (msg, duration = 3000) => {
      setWarningMessage(msg);
      if (navigator.vibrate) {
        try {
          navigator.vibrate([60, 40, 60]);
        } catch (e) {}
      }
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setWarningMessage(null), duration);
    };

    // APAGÓN SÍNCRONO INMEDIATO (0ms de latencia antes de que el SO tome la foto)
    const triggerInstantBlackout = (reason) => {
      isBlackoutActiveRef.current = true;
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
          navigator.clipboard.writeText('⚠️ FOTOGRAFÍA PROTEGIDA - Prohibida su captura. Sebastian G • San Antero, Córdoba');
        }
      } catch (err) {}

      // CRÍTICO: NUNCA colocar un temporizador de auto-desbloqueo mientras la ventana no tenga foco.
      // Cuando el usuario baja la cortina de notificaciones de Xiaomi/Android o cambia de ventana,
      // la ventana está desenfocada. Si se pone un timer que expira en 2s, el escudo se apagaría
      // mientras la cortina sigue abierta, permitiendo la captura!
      if (releaseTimeoutRef.current) {
        clearTimeout(releaseTimeoutRef.current);
        releaseTimeoutRef.current = null;
      }
    };

    const releaseInstantBlackout = () => {
      // Protección: NUNCA desbloquear si la ventana sigue desenfocada, oculta o en blur
      if (!document.hasFocus() || document.hidden || isBlurredRef.current) {
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
    const handleTouchStart = (e) => {
      if (!e.touches || e.touches.length === 0) return;

      // Gesto de 2 o 3 dedos (Xiaomi MIUI captura con 3 dedos, Samsung con palma/2 dedos)
      if (e.touches.length >= 2) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (err) {}
        triggerInstantBlackout('Gesto multi-táctil detectado. Capturas bloqueadas.');
        triggerWarningToast('🚫 Gesto de captura bloqueado por seguridad.');
        return;
      }

      // Detección de arrastre desde el borde superior (Barra de notificaciones / Quick Settings)
      const touch = e.touches[0];
      if (touch.clientY <= 65 || touch.screenY <= 75) {
        // El dedo inició en el borde superior: está por bajar la barra de notificaciones
        triggerInstantBlackout('Panel de notificaciones del sistema detectado');
      }
    };

    const handleTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;

      if (e.touches.length >= 2) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (err) {}
        triggerInstantBlackout('Gesto multi-táctil bloqueado');
        return;
      }

      const touch = e.touches[0];
      // Si el movimiento táctil está cerca del borde superior
      if (touch.clientY <= 75 || touch.screenY <= 85) {
        if (!isBlackoutActiveRef.current) {
          triggerInstantBlackout('Panel de notificaciones del sistema detectado');
        }
      }
    };

    // 2. APAGÓN POR PÉRDIDA DE FOCO (Panel de notificaciones, cambio de app, botones físicos)
    const handleBlur = () => {
      isBlurredRef.current = true;
      triggerInstantBlackout('Captura de pantalla o panel del sistema detectado');
    };

    // 3. RECUPERACIÓN DE FOCO (Cuando Android retrae la cortina antes de disparar el screenshot)
    const handleFocus = () => {
      isBlurredRef.current = false;
      lastFocusTimeRef.current = Date.now();

      // Cuando Android presiona "Captura", retrae la barra de notificaciones y le devuelve foco a la web
      // unos 150ms ANTES de tomar la foto. Por eso el escudo DEBE mantenerse activo al menos 3.5 segundos
      // para que el snapshot del sistema capture la pantalla 100% NEGRA.
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = setTimeout(() => {
        if (document.hasFocus() && !document.hidden && !isBlurredRef.current) {
          releaseInstantBlackout();
        }
      }, 3500);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isBlurredRef.current = true;
        triggerInstantBlackout('Pantalla oculta o cambio de aplicación');
      } else {
        isBlurredRef.current = false;
        lastFocusTimeRef.current = Date.now();
        if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
        releaseTimeoutRef.current = setTimeout(() => {
          if (document.hasFocus() && !document.hidden && !isBlurredRef.current) {
            releaseInstantBlackout();
          }
        }, 3500);
      }
    };

    // 4. BUCLE DE ALTA FRECUENCIA (RAF: 60-120fps)
    // Monitorea continuamente si el sistema o alguna herramienta en segundo plano tomó el foco
    let animationFrameId;
    const continuousFocusCheck = () => {
      if (!document.hasFocus() || document.hidden) {
        if (!isBlackoutActiveRef.current) {
          isBlurredRef.current = true;
          triggerInstantBlackout('Captura de pantalla o panel del sistema detectado');
        }
      }
      animationFrameId = requestAnimationFrame(continuousFocusCheck);
    };
    animationFrameId = requestAnimationFrame(continuousFocusCheck);

    // 5. BLOQUEO DE CLIC DERECHO Y PULSACIÓN PROLONGADA
    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerWarningToast('Las opciones de descarga y clic derecho están deshabilitadas.');
    };

    // 6. BLOQUEO DE TECLAS DE CAPTURA EN PC / TABLETS
    const handleKeyDown = (e) => {
      // Tecla PrintScreen (keydown en algunos navegadores)
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        triggerInstantBlackout('Captura con PrintScreen bloqueada.');
        triggerWarningToast('🚫 Captura de pantalla bloqueada.');
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('⚠️ FOTOGRAFÍA PROTEGIDA - Prohibida su captura. Sebastian G • San Antero, Córdoba');
          }
        } catch (err) {}
        return false;
      }

      // Windows + Shift + S / Command + Shift + 3/4/5
      if ((e.metaKey || e.ctrlKey || e.shiftKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
        if (e.shiftKey) {
          triggerInstantBlackout('Herramienta de recortes de Windows bloqueada.');
        }
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

    // En Windows Chromium / Edge, PrintScreen dispara 'keyup'
    const handleKeyUp = (e) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        triggerInstantBlackout('Captura con Impr Pant bloqueada.');
        triggerWarningToast('🚫 Captura con Impr Pant bloqueada.');
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('⚠️ FOTOGRAFÍA PROTEGIDA - Prohibida su captura. Sebastian G • San Antero, Córdoba');
          }
        } catch (err) {}
      }

      if (e.shiftKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
        triggerInstantBlackout('Herramienta de recortes de Windows bloqueada.');
      }
    };

    // 7. BLOQUEO DE COPIA Y ARRASTRE DE IMÁGENES
    const handleDragStart = (e) => {
      if (e.target.tagName === 'IMG') {
        e.preventDefault();
      }
    };

    const handleCopy = (e) => {
      e.preventDefault();
      try {
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', '⚠️ FOTOGRAFÍA PROTEGIDA - Sebastian G • San Antero, Córdoba');
        }
      } catch (err) {}
      triggerWarningToast('Copiar fotos está restringido.');
    };

    // Registrar escuchadores globales
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
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
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

  // Manejador del toque en el escudo para desbloquear manualmente
  const handleShieldUnlock = (e) => {
    e.stopPropagation();
    // Prevenir desbloqueo si la ventana aún no tiene foco o está oculta
    if (!document.hasFocus() || document.hidden || isBlurredRef.current) {
      return;
    }
    // Si el foco acaba de regresar hace menos de 1000ms, esperar (la captura del SO aún se está ejecutando)
    if (Date.now() - lastFocusTimeRef.current < 1000) {
      return;
    }
    isBlackoutActiveRef.current = false;
    document.documentElement.classList.remove('security-blackout');
    const shield = document.getElementById('anti-screenshot-shield');
    if (shield) shield.style.display = 'none';
    if (releaseTimeoutRef.current) {
      clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = null;
    }
  };

  return (
    <div className="protected-photo-zone select-none relative min-h-screen">
      {/* ESCUDO DOM INSTANTÁNEO DE APAGÓN NEGRO (0MS) */}
      <div
        id="anti-screenshot-shield"
        onClick={handleShieldUnlock}
        onTouchEnd={handleShieldUnlock}
        className="fixed inset-0 z-[2147483647] bg-black flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer"
        style={{ display: 'none' }}
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
          Captura de pantalla o panel del sistema detectado
        </p>
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 max-w-sm text-xs text-stone-300 leading-relaxed">
          Las fotografías están blindadas contra capturas de pantalla, paneles de notificaciones, herramientas de recorte y descargas.
        </div>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900 border border-amber-500/40 text-amber-300 text-xs font-semibold animate-pulse">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>Toca aquí para continuar viendo las fotos</span>
        </div>
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
