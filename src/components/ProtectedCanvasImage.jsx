import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * ProtectedCanvasImage
 * - Cuando `watermark === false` (catálogo público): usa `<img>` nativo con `loading="lazy"` y `decoding="async"`,
 *   evitando crear decenas de `<canvas>`, `ResizeObserver` y listeners por tarjeta.
 * - Cuando `watermark === true` (galerías privadas de clientes): renderiza en `<canvas>` con marca de agua
 *   incrustada en píxeles, carga diferida por `IntersectionObserver` y caché LRU acotada en memoria.
 */
const MAX_IMAGE_CACHE_SIZE = 40;
const memoryImageCache = new Map();

export function getCachedImage(src) {
  if (!memoryImageCache.has(src)) return null;
  const img = memoryImageCache.get(src);
  // Refrescar posición LRU
  memoryImageCache.delete(src);
  memoryImageCache.set(src, img);
  return img;
}

export function setCachedImage(src, img) {
  if (!src || !img) return;
  if (memoryImageCache.has(src)) {
    memoryImageCache.delete(src);
  } else if (memoryImageCache.size >= MAX_IMAGE_CACHE_SIZE) {
    const oldestKey = memoryImageCache.keys().next().value;
    if (oldestKey !== undefined) {
      memoryImageCache.delete(oldestKey);
    }
  }
  memoryImageCache.set(src, img);
}

export default function ProtectedCanvasImage({
  src,
  alt = 'Fotografía protegida',
  className = '',
  objectFit = 'cover', // 'cover' | 'contain'
  watermark = false,
  watermarkText = 'Sebastian G • Fotografía Profesional'
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInViewport, setIsInViewport] = useState(() => !watermark);
  const imgRef = useRef(null);

  // Observar visibilidad únicamente cuando se usa modo canvas con marca de agua
  useEffect(() => {
    if (!watermark) return;
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsInViewport(true);
          io.disconnect();
        }
      },
      { rootMargin: '250px' }
    );
    io.observe(container);
    return () => io.disconnect();
  }, [watermark]);

  const drawToCanvas = useCallback(() => {
    if (!watermark) return;
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

    // Marca de agua protegida en pixeles del canvas (mosaico diagonal + sello central)
    ctx.save();

    ctx.save();
    ctx.rotate(-28 * Math.PI / 180);
    const stepX = Math.max(180, Math.floor(targetWidth * 0.45));
    const stepY = Math.max(80, Math.floor(targetHeight * 0.15));
    const diagSize = Math.max(targetWidth, targetHeight) * 2;
    const mosaicFontSize = Math.max(12, Math.floor(targetWidth * 0.035));
    ctx.font = `800 ${mosaicFontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const mosaicText = 'SEBASTIAN G • MUESTRA';
    for (let y = -diagSize; y < diagSize; y += stepY) {
      for (let x = -diagSize; x < diagSize; x += stepX) {
        ctx.strokeText(mosaicText, x, y);
        ctx.fillText(mosaicText, x, y);
      }
    }
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerTitleSize = Math.max(18, Math.floor(targetWidth * 0.065));
    ctx.font = `900 ${centerTitleSize}px sans-serif`;
    ctx.lineWidth = Math.max(3, centerTitleSize * 0.14);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 10;
    ctx.strokeText(watermarkText || 'SEBASTIAN G', targetWidth / 2, targetHeight / 2);
    ctx.fillText(watermarkText || 'SEBASTIAN G', targetWidth / 2, targetHeight / 2);

    const subSize = Math.max(10, Math.floor(targetWidth * 0.026));
    ctx.font = `700 ${subSize}px sans-serif`;
    ctx.lineWidth = 2;
    ctx.strokeText('MUESTRA EXCLUSIVA • PROHIBIDA SU DESCARGA', targetWidth / 2, (targetHeight / 2) + centerTitleSize * 1.1);
    ctx.fillText('MUESTRA EXCLUSIVA • PROHIBIDA SU DESCARGA', targetWidth / 2, (targetHeight / 2) + centerTitleSize * 1.1);

    ctx.restore();
  }, [objectFit, watermark, watermarkText]);

  useEffect(() => {
    if (!watermark || !isInViewport || !src) return;

    let isMounted = true;

    const cached = getCachedImage(src);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      imgRef.current = cached;
      setIsLoaded(true);
      setHasError(false);
      drawToCanvas();
      return;
    }

    setIsLoaded(false);
    setHasError(false);

    const img = new Image();
    if ('decoding' in img) {
      img.decoding = 'async';
    }

    img.onload = () => {
      if (!isMounted) return;
      setCachedImage(src, img);
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
  }, [watermark, isInViewport, src, drawToCanvas]);

  // Redibujar en resize del contenedor únicamente cuando usa canvas (watermark === true)
  useEffect(() => {
    if (!watermark || !isInViewport) return;
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(() => {
      drawToCanvas();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [watermark, isInViewport, drawToCanvas]);

  // Modo ligero y accesible para el catálogo público (sin marca de agua pesada en canvas)
  if (!watermark) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden bg-stone-950 ${className}`}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full block transition-transform duration-500 ${
            objectFit === 'contain' ? 'object-contain' : 'object-cover'
          }`}
        />
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-stone-900/80 flex items-center justify-center pointer-events-none">
            <div className="w-7 h-7 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none pointer-events-none bg-stone-950 ${className}`}
      onDragStart={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={alt}
        className="w-full h-full block select-none pointer-events-none transition-transform duration-500"
      />

      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-stone-900/80 flex items-center justify-center pointer-events-none">
          <div className="w-7 h-7 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
        </div>
      )}
    </div>
  );
}
