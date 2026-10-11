import React, { useEffect } from 'react';

/**
 * SecurityOverlay - Escudo Discreto de Galería
 * Protege contra copias casuales y clic derecho sin interrumpir
 * la experiencia de usuario (sin apagones de pantalla ni bloqueos de gestos).
 * La protección real reside en la marca de agua incrustada en los píxeles de cada foto.
 */
export default function SecurityOverlay({ children, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;

    // 1. Bloqueo de menú contextual (clic derecho / pulsación larga para guardar)
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 2. Bloqueo de arrastre de imágenes o canvas
    const handleDragStart = (e) => {
      if (e.target.tagName === 'IMG' || e.target.tagName === 'CANVAS') {
        e.preventDefault();
      }
    };

    // 3. Prevenir atajos de teclado para guardar o inspeccionar
    const handleKeyDown = (e) => {
      // F12 o DevTools
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'c' || e.key === 'C'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Guardar página (Ctrl+S / Cmd+S), Imprimir (Ctrl+P / Cmd+P), Ver código fuente (Ctrl+U)
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P' || e.key === 'u' || e.key === 'U')
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled]);

  return (
    <div className="protected-photo-zone select-none relative min-h-screen">
      {children}
    </div>
  );
}
