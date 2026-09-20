import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

export default function SecurityOverlay({ children, enabled = true }) {
  const [warningMessage, setWarningMessage] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    const triggerWarning = (msg) => {
      setWarningMessage(msg);
      setTimeout(() => setWarningMessage(null), 3500);
    };

    // Bloquear Clic Derecho y pulsación prolongada
    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerWarning('Las opciones de clic derecho y descarga están bloqueadas para proteger las fotos.');
    };

    // Bloquear atajos de teclado de inspección (F12, Ctrl+Shift+I, etc.)
    const handleKeyDown = (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        triggerWarning('La tecla F12 y el modo desarrollador están deshabilitados.');
        return false;
      }

      // Ctrl + Shift + I, Ctrl + Shift + J, Ctrl + Shift + C
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        triggerWarning('El inspector de código está deshabilitado.');
        return false;
      }

      // Ctrl + U (Ver código fuente)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        triggerWarning('Ver código fuente está deshabilitado.');
        return false;
      }

      // Ctrl + S (Guardar página)
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        triggerWarning('Guardar página o imágenes está bloqueado.');
        return false;
      }

      // PrintScreen
      if (e.key === 'PrintScreen') {
        if (navigator.clipboard) {
          navigator.clipboard.writeText('');
        }
        triggerWarning('Captura de pantalla no permitida.');
      }
    };

    // Bloquear arrastre de imágenes
    const handleDragStart = (e) => {
      if (e.target.tagName === 'IMG') {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, [enabled]);

  return (
    <div className="protected-photo-zone select-none relative min-h-screen">
      {/* Alerta flotante cuando intentan inspeccionar o descargar */}
      {warningMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] bg-red-950/95 border-2 border-red-500/80 text-white px-5 py-4 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce">
          <ShieldAlert className="w-8 h-8 text-red-400 shrink-0" />
          <div>
            <p className="font-bold text-sm text-red-200">Acción Bloqueada</p>
            <p className="text-xs text-red-100/90 leading-tight">{warningMessage}</p>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
