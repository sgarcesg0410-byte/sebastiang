import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * ProtectedCanvasImage
 * Renderiza fotografías exclusivamente sobre un elemento <canvas> de HTML5.
 * Elimina las etiquetas <img> del DOM para que las fotos no puedan ser inspeccionadas,
 * descargadas, extraídas del árbol de elementos ni capturadas mediante DevTools.
 */
// Caché en memoria para carga ultrarrápida (0ms) en móviles y APK
const memoryImageCache = new Map();

export default function ProtectedCanvasImage({
  src,
  alt = 'Fotografía protegida',
  className = '',
  objectFit = 'cover', // 'cover' | 'contain'
  watermark = false,
  watermarkText = 'Sebastian G • San Antero'
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  const drawToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;

    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.floor(rect.width * dpr);
    const targetHeight = Math.floor(rect.height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
    const isLosingFocus = isTouchDevice ? document.hidden : (!document.hasFocus() || document.hidden);

    // Si el escudo de seguridad está activo o se perdió el foco, pintar negro absoluto
    if (
      document.documentElement.classList.contains('security-blackout') ||
      isLosingFocus
    ) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      return;
    }

    if (!img || !img.complete || img.naturalWidth === 0) {
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      return;
    }

    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = targetWidth / targetHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (objectFit === 'contain') {
      if (imgRatio > canvasRatio) {
        drawWidth = targetWidth;
        drawHeight = targetWidth / imgRatio;
        offsetX = 0;
        offsetY = (targetHeight - drawHeight) / 2;
      } else {
        drawHeight = targetHeight;
        drawWidth = targetHeight * imgRatio;
        offsetX = (targetWidth - drawWidth) / 2;
        offsetY = 0;
      }
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    } else {
      // cover
      if (imgRatio > canvasRatio) {
        drawHeight = targetHeight;
        drawWidth = targetHeight * imgRatio;
        offsetX = (targetWidth - drawWidth) / 2;
        offsetY = 0;
      } else {
        drawWidth = targetWidth;
        drawHeight = targetWidth / imgRatio;
        offsetX = 0;
        offsetY = (targetHeight - drawHeight) / 2;
      }
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    // Marca de agua digital en pixeles horneada en el Canvas (imposible de retirar o burlar)
    if (watermark) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 1. Trama diagonal repetitiva a 45 grados en todo el lienzo
      ctx.save();
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.rotate(-Math.PI / 4);

      const diagStep = Math.max(70, Math.floor(targetHeight * 0.22));
      const diagFontSize = Math.max(12, Math.floor(targetWidth * 0.04));
      ctx.font = `800 ${diagFontSize}px sans-serif`;
      ctx.lineWidth = Math.max(2, diagFontSize * 0.12);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 6;

      const repeatText = (watermarkText || 'SEBASTIAN G • MUESTRA EXCLUSIVA').toUpperCase();
      const bound = Math.max(targetWidth, targetHeight) * 1.5;
      for (let y = -bound; y <= bound; y += diagStep) {
        ctx.strokeText(repeatText, 0, y);
        ctx.fillText(repeatText, 0, y);
      }
      ctx.restore();

      // 2. Distintivo central prominente con relieve y máxima visibilidad
      const centerTitleSize = Math.max(18, Math.floor(targetWidth * 0.08));
      ctx.font = `900 ${centerTitleSize}px sans-serif`;
      ctx.lineWidth = Math.max(3, centerTitleSize * 0.14);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 10;
      ctx.strokeText('SEBASTIAN G', targetWidth / 2, targetHeight / 2 - 14);
      ctx.fillText('SEBASTIAN G', targetWidth / 2, targetHeight / 2 - 14);

      const centerSubSize = Math.max(10, Math.floor(targetWidth * 0.034));
      ctx.font = `700 ${centerSubSize}px sans-serif`;
      ctx.lineWidth = Math.max(2, centerSubSize * 0.12);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillStyle = '#fbbf24'; // Color ámbar
      ctx.strokeText('MUESTRA OFICIAL • PROHIBIDA SU DESCARGA O CAPTURA', targetWidth / 2, targetHeight / 2 + 18);
      ctx.fillText('MUESTRA OFICIAL • PROHIBIDA SU DESCARGA O CAPTURA', targetWidth / 2, targetHeight / 2 + 18);

      ctx.restore();
    }
  }, [objectFit, watermark, watermarkText]);

  useEffect(() => {
    if (!src) return;

    let isMounted = true;

    // 1. Revisar si la imagen ya está en caché en memoria (0ms)
    if (memoryImageCache.has(src)) {
      const cached = memoryImageCache.get(src);
      if (cached && cached.complete && cached.naturalWidth > 0) {
        imgRef.current = cached;
        setIsLoaded(true);
        setHasError(false);
        drawToCanvas();
        return;
      }
    }

    setIsLoaded(false);
    setHasError(false);

    const img = new Image();
    if ('decoding' in img) {
      img.decoding = 'async';
    }

    img.onload = () => {
      if (!isMounted) return;
      memoryImageCache.set(src, img);
      imgRef.current = img;
      setIsLoaded(true);
      drawToCanvas();
    };

    img.onerror = () => {
      if (!isMounted) return;
      setHasError(true);
    };

    img.src = src;

    return () => {
      isMounted = false;
    };
  }, [src, drawToCanvas]);

  // Redibujar en resize del contenedor o ventana
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        drawToCanvas();
      });
      resizeObserver.observe(container);
    }

    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));

    const handleWindowEvents = () => {
      drawToCanvas();
    };

    const handleWindowBlur = () => {
      if (isTouchDevice && !document.hidden) return;
      drawToCanvas();
    };

    window.addEventListener('resize', handleWindowEvents);
    window.addEventListener('focus', handleWindowEvents);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleWindowEvents);

    // Observar cambios de clase en html (como security-blackout)
    const mutationObserver = new MutationObserver(() => {
      drawToCanvas();
    });
    mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', handleWindowEvents);
      window.removeEventListener('focus', handleWindowEvents);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleWindowEvents);
    };
  }, [drawToCanvas]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none pointer-events-none bg-stone-950 ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        aria-label={alt}
        className="w-full h-full block select-none pointer-events-none transition-transform duration-500"
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Spinner de carga inicial */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-stone-900/80 flex items-center justify-center pointer-events-none">
          <div className="w-7 h-7 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
        </div>
      )}

      {/* Capa de protección física transparente */}
      <div 
        className="absolute inset-0 z-10 bg-transparent select-none pointer-events-none" 
        onContextMenu={(e) => e.preventDefault()} 
      />
    </div>
  );
}
