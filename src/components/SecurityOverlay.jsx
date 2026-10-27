import React from 'react';

/**
 * SecurityOverlay - Contenedor de Galería Privada
 * Evita arrastre accidental de miniaturas en galerías privadas sin bloquear
 * atajos del navegador, accesibilidad ni el menú contextual del usuario.
 * La protección real reside en tokens criptográficos, expiración/revocación y marca de agua.
 */
export default function SecurityOverlay({ children, enabled = true }) {
  const handleDragStart = (e) => {
    if (!enabled) return;
    const tag = e.target?.tagName;
    if (tag === 'IMG' || tag === 'CANVAS') {
      e.preventDefault();
    }
  };

  return (
    <div
      onDragStart={handleDragStart}
      className={enabled ? 'protected-photo-zone relative min-h-screen' : 'relative min-h-screen'}
    >
      {children}
    </div>
  );
}
