import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Lock, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  Check, 
  Sparkles, 
  Send, 
  HelpCircle,
  Camera,
  Heart,
  Share2,
  CreditCard,
  Copy,
  Upload,
  Printer,
  ChevronRight,
  ExternalLink,
  PackageCheck,
  DownloadCloud
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getGalleryByToken, submitGallerySelection, createPayment } from '../services/api';
import ProtectedCanvasImage from './ProtectedCanvasImage';

export default function ClientGallery({ token = "demo-cliente-2026", onBackToHome }) {
  const [galleryData, setGalleryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selecciones locales del usuario: Map de { [photoId]: { selected: boolean, comment: string } }
  const [selections, setSelections] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Estados de Pasarela de Pago Directo (Nequi, DaviPlata, Dale)
  const [selectedWallet, setSelectedWallet] = useState('nequi'); // 'nequi' | 'daviplata' | 'dale'
  const [copiedKeyFeedback, setCopiedKeyFeedback] = useState(null);
  const [voucherImage, setVoucherImage] = useState(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [printedPhotosCount, setPrintedPhotosCount] = useState(0);
  const voucherInputRef = useRef(null);

  const copyToClipboard = (text, keyName) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKeyFeedback(keyName);
    setTimeout(() => setCopiedKeyFeedback(null), 2500);
  };

  const handleVoucherUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setVoucherImage(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Contador de tiempo restante
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    fetchGallery();
  }, [token]);

  const fetchGallery = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGalleryByToken(token);
      setGalleryData(data);

      // Inicializar selecciones
      const initialMap = {};
      (data.photos || []).forEach(p => {
        initialMap[p.id] = {
          selected: Boolean(p.selected),
          comment: p.clientComment || ''
        };
      });
      setSelections(initialMap);

      // Lanzar confeti si las fotos finales ya fueron entregadas
      if (data && (data.isDelivered || data.status === 'delivered' || data.finalDeliveryUrl)) {
        setTimeout(() => {
          try {
            confetti({
              particleCount: 70,
              spread: 60,
              origin: { y: 0.6 }
            });
          } catch (e) {}
        }, 400);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo cargar la galería.');
    } finally {
      setLoading(false);
    }
  };

  // Temporizador de 3 días en vivo
  useEffect(() => {
    if (!galleryData || !galleryData.expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(galleryData.expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setGalleryData(prev => ({ ...prev, isExpired: true }));
        clearInterval(interval);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [galleryData?.expiresAt]);

  // Manejar selección de foto
  const togglePhotoSelection = (photoId) => {
    if (galleryData?.isExpired || galleryData?.isSubmitted || submissionResult) return;

    setSelections(prev => {
      const current = prev[photoId] || { selected: false, comment: '' };
      return {
        ...prev,
        [photoId]: {
          ...current,
          selected: !current.selected
        }
      };
    });
  };

  // Manejar comentario por foto
  const handleCommentChange = (photoId, commentText) => {
    if (galleryData?.isExpired || galleryData?.isSubmitted || submissionResult) return;

    setSelections(prev => {
      const current = prev[photoId] || { selected: false, comment: '' };
      return {
        ...prev,
        [photoId]: {
          ...current,
          comment: commentText
        }
      };
    });
  };

  // Cálculos de selección y pasarela de pago directo
  const selectedCount = Object.values(selections).filter(s => s.selected).length;
  const maxAllowed = galleryData?.maxPhotosAllowed || 10;
  const extraPhotos = Math.max(0, selectedCount - maxAllowed);
  const extraPhotoPrice = 7000;
  const printedPrice = galleryData?.watermarkSettings?.printedPhotoPrice || 7000;
  const extraPhotosTotal = extraPhotos * extraPhotoPrice;
  const printedPhotosTotal = printedPhotosCount * printedPrice;
  const totalAmount = extraPhotosTotal + printedPhotosTotal;
  const formatPrice = (val) => Number(val).toLocaleString('es-CO');

  // Enviar selección final y pago directo
  const handleConfirmSubmit = async () => {
    try {
      setIsSubmitting(true);
      const payload = Object.entries(selections).map(([id, val]) => ({
        id,
        selected: val.selected,
        clientComment: val.comment
      }));

      // 1. Guardar selección de fotos en el sistema
      const res = await submitGallerySelection(token, payload);

      // 2. Si hay saldo de pago por fotos extra o impresiones, registrar el pago en tiempo real
      if (totalAmount > 0) {
        try {
          await createPayment({
            clientName: galleryData.clientName,
            clientWhatsApp: galleryData.clientWhatsApp,
            sessionToken: token,
            packageTitle: galleryData.packageTitle,
            amount: totalAmount,
            method: selectedWallet,
            reference: paymentReference,
            voucherUrl: voucherImage,
            extraPhotosCount: extraPhotos,
            printedPhotosCount: printedPhotosCount
          });
        } catch (payErr) {
          console.warn('Error al registrar pago en tiempo real:', payErr);
        }
      }

      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 }
        });
      } catch (e) {}

      setSubmissionResult(res);
      setConfirmModalOpen(false);
      setGalleryData(prev => ({ ...prev, isSubmitted: true }));

      // Abrir WhatsApp automáticamente con el listado detallado y los datos de pago
      if (res.directWhatsAppUrl) {
        let finalUrl = res.directWhatsAppUrl;
        if (totalAmount > 0) {
          const walletLabels = {
            nequi: 'Nequi (3244725167)',
            daviplata: 'DaviPlata (Llave @PLATA3244725167)',
            dale: 'Dale! (Llave @SGG04)'
          };
          const payText = `\n\n💳 *PAGO REGISTRADO:*` +
            `\n💰 *Monto:* $${formatPrice(totalAmount)} COP` +
            `\n🏦 *Medio:* ${walletLabels[selectedWallet] || selectedWallet}` +
            (paymentReference ? `\n🔢 *Referencia:* ${paymentReference}` : '') +
            (voucherImage ? `\n📸 *Comprobante:* Adjuntado en el sistema` : '');
          finalUrl += encodeURIComponent(payText);
        }
        window.open(finalUrl, '_blank');
      }
    } catch (err) {
      alert(err.message || 'Error al enviar selección.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-stone-300 font-medium text-sm">Cargando tu sesión protegida de fotos...</p>
      </div>
    );
  }

  if (error || !galleryData) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-red-500/20 text-red-400 border border-red-500/40 rounded-2xl flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-serif font-bold text-white mb-2">Enlace no disponible</h3>
        <p className="text-stone-400 text-sm mb-6">{error || 'Esta galería no existe o fue eliminada.'}</p>
        <button
          onClick={onBackToHome}
          className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-6 py-2.5 rounded-xl text-sm font-semibold"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  const isLocked = galleryData.isExpired || galleryData.isSubmitted || Boolean(submissionResult);
  const watermarkSubtext = galleryData.watermarkSettings?.watermarkSubtext || "MUESTRA EXCLUSIVA • PROHIBIDA SU DESCARGA";

  return (
    <>
      <div className="min-h-screen pb-36 pt-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        {/* BARRA DE AVISO DE SEGURIDAD Y EXPIRACIÓN */}
        <div className="mb-8 space-y-4">
          
          {/* BANNER VIP DE ENTREGA DE FOTOS EN CALIDAD ORIGINAL (FULL HD / WETRANSFER) */}
          {(galleryData.isDelivered || galleryData.status === 'delivered' || galleryData.finalDeliveryUrl) && (
            <div className="bg-gradient-to-r from-purple-950/90 via-stone-900 to-purple-950/90 border-2 border-purple-500/60 rounded-3xl p-6 sm:p-8 flex flex-col gap-5 text-left shadow-2xl shadow-purple-950/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                    <PackageCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        Entrega Final VIP
                      </span>
                      <span className="text-xs text-stone-400 font-mono">
                        {galleryData.deliveryService ? galleryData.deliveryService.toUpperCase() : 'CALIDAD ORIGINAL FULL HD'}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mt-1">
                      🎉 ¡Tus Fotos Editadas en Calidad Original (Full HD) están Listas!
                    </h2>
                  </div>
                </div>

                {galleryData.finalDeliveryUrl && (
                  <a
                    href={galleryData.finalDeliveryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-sm sm:text-base py-4 px-6 rounded-2xl shadow-xl shadow-amber-500/25 transition-all active:scale-[0.98] shrink-0"
                  >
                    <DownloadCloud className="w-5 h-5 text-stone-950" />
                    <span>Descargar Fotos en Full HD</span>
                    <ExternalLink className="w-4 h-4 text-stone-900" />
                  </a>
                )}
              </div>

              <div className="p-4 bg-stone-950/70 border border-purple-500/20 rounded-2xl text-xs sm:text-sm text-stone-300 space-y-2">
                <p className="flex items-center gap-2 font-semibold text-purple-200">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Archivos originales 100% nítidos sin la compresión destructiva de mensajerías ni redes.</span>
                </p>
                <p className="text-stone-400 text-xs leading-relaxed">
                  Sebastian G ha preparado tu paquete fotográfico con edición profesional y revelado digital en máxima definición para que las conserves e imprimas con la más alta fidelidad.
                </p>
                {galleryData.deliveryNotes && (
                  <div className="mt-2 p-3 bg-stone-900 border border-stone-800 rounded-xl text-amber-300 text-xs italic">
                    💬 <strong className="text-white not-italic">Mensaje de Sebastian:</strong> "{galleryData.deliveryNotes}"
                  </div>
                )}
              </div>

              {galleryData.finalDeliveryUrl && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-purple-500/20 text-xs">
                  <div className="flex items-center gap-2 text-stone-400">
                    <span className="font-mono text-[11px] truncate max-w-xs sm:max-w-md bg-black/50 px-2.5 py-1 rounded-lg border border-stone-800">
                      {galleryData.finalDeliveryUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(galleryData.finalDeliveryUrl, 'delivery-url')}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-bold border border-stone-700 flex items-center gap-1"
                    >
                      {copiedKeyFeedback === 'delivery-url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKeyFeedback === 'delivery-url' ? '¡Copiado!' : 'Copiar Enlace'}</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-stone-500">
                    💡 Recomendado descargar en tu PC o guardar en tu carrete en alta resolución.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Tarjeta de Cuenta Regresiva de 3 días (solo si aún no ha expirado y no se ha entregado) */}
          {!isLocked && !galleryData.isDelivered && (
            <div className="bg-gradient-to-r from-amber-950/70 via-stone-900 to-amber-950/70 border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                    Vigencia del Enlace (3 Días)
                  </span>
                  <p className="text-xs text-stone-300">
                    Solo podrás enviar tu selección una única vez antes de que el enlace expire.
                  </p>
                </div>
              </div>

              {/* Reloj Digital */}
              <div className="flex items-center gap-2 text-center bg-stone-950/80 px-4 py-2 rounded-xl border border-stone-800">
                <div>
                  <span className="text-xl font-black text-amber-400 font-mono block">{timeRemaining.days}</span>
                  <span className="text-[10px] text-stone-400 uppercase">Días</span>
                </div>
                <span className="text-stone-600 font-bold">:</span>
                <div>
                  <span className="text-xl font-black text-amber-400 font-mono block">{String(timeRemaining.hours).padStart(2, '0')}</span>
                  <span className="text-[10px] text-stone-400 uppercase">Horas</span>
                </div>
                <span className="text-stone-600 font-bold">:</span>
                <div>
                  <span className="text-xl font-black text-amber-400 font-mono block">{String(timeRemaining.minutes).padStart(2, '0')}</span>
                  <span className="text-[10px] text-stone-400 uppercase">Min</span>
                </div>
                <span className="text-stone-600 font-bold">:</span>
                <div>
                  <span className="text-xl font-black text-amber-400 font-mono block">{String(timeRemaining.seconds).padStart(2, '0')}</span>
                  <span className="text-[10px] text-stone-400 uppercase">Seg</span>
                </div>
              </div>
            </div>
          )}

          {/* MENSAJES DE ESTADO DE BLOQUEO */}
          {galleryData.isExpired && !galleryData.isSubmitted && (
            <div className="bg-red-950/80 border-2 border-red-500/60 rounded-2xl p-5 flex items-center gap-4 text-left">
              <Lock className="w-8 h-8 text-red-400 shrink-0" />
              <div>
                <h4 className="text-base font-bold text-red-200">Enlace de selección expirado</h4>
                <p className="text-xs text-red-100/80 mt-1">
                  Han transcurrido los 3 días de vigencia acordados. Por favor contacta a Sebastian G para reactivar tu sesión si aún no has elegido tus fotos.
                </p>
              </div>
            </div>
          )}

          {(galleryData.isSubmitted || submissionResult) && (() => {
            const selectedList = (galleryData.photos || []).filter(p => selections[p.id]?.selected || p.selected);
            let autoSummary = `📸 *¡Hola Sebastian G! Ya elegí las fotos de mi sesión:*\n\n`;
            autoSummary += `👤 *Cliente:* ${galleryData.clientName}\n`;
            autoSummary += `📦 *Sesión:* ${galleryData.packageTitle}\n`;
            autoSummary += `🔢 *Total Elegidas:* ${selectedList.length} fotos\n\n`;
            autoSummary += `*Lista de fotos seleccionadas:*\n`;
            selectedList.forEach((p, idx) => {
              const note = selections[p.id]?.comment || p.clientComment;
              autoSummary += `\n${idx + 1}. *${p.title}*`;
              if (note) autoSummary += `\n   💬 _Nota:_ "${note}"`;
            });
            autoSummary += `\n\n_Quedo atento(a) a la entrega final en alta calidad. ¡Muchas gracias!_`;

            const primaryWaUrl = submissionResult?.directWhatsAppUrl || `https://wa.me/573244725167?text=${encodeURIComponent(autoSummary)}`;
            const secondaryWaUrl = submissionResult?.secondaryWhatsAppUrl || `https://wa.me/573023696513?text=${encodeURIComponent(autoSummary)}`;

            return (
              <div className="bg-emerald-950/90 border-2 border-emerald-500/70 rounded-3xl p-6 flex flex-col gap-4 text-left shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">¡Selección enviada y protegida con éxito!</h4>
                    <p className="text-xs text-emerald-200/90 mt-0.5">
                      Tus elecciones y notas quedaron registradas. Puedes enviar el detalle a Sebastian G por cualquiera de sus dos líneas de WhatsApp:
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <a
                    href={primaryWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs sm:text-sm py-3.5 px-5 rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all text-center"
                  >
                    <Share2 className="w-4 h-4 fill-white shrink-0" />
                    <span>Enviar a Sebastian (Línea 1: 324 472 5167) 📲</span>
                  </a>

                  <a
                    href={secondaryWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-stone-900 border border-emerald-500/40 hover:bg-stone-800 text-emerald-300 font-bold text-xs sm:text-sm py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-center"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>Enviar a Línea 2 (302 369 6513)</span>
                  </a>
                </div>
              </div>
            );
          })()}

          {/* CABECERA DE LA SESIÓN DEL CLIENTE */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${
                  (galleryData.isDelivered || galleryData.status === 'delivered')
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {(galleryData.isDelivered || galleryData.status === 'delivered') ? (
                    <>
                      <PackageCheck className="w-3.5 h-3.5 text-purple-400" />
                      <span>✓ Fotos Entregadas en Full HD</span>
                    </>
                  ) : (
                    'Galería Privada de Revisión'
                  )}
                </span>
                <span className="text-xs text-stone-400">
                  • {galleryData.photos?.length || 0} fotos tomadas
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white">
                Sesión de {galleryData.clientName}
              </h1>
              <p className="text-xs sm:text-sm text-stone-300 mt-1">
                {galleryData.packageTitle} • Toca las fotos que más te gusten y déjanos tus notas debajo de cada una.
              </p>
            </div>

            {/* Contador de fotos elegidas */}
            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 text-center shrink-0">
              <span className="text-[11px] text-stone-400 uppercase tracking-wider block">
                Fotos Seleccionadas
              </span>
              <div className="flex items-baseline justify-center gap-1 mt-1">
                <span className="text-3xl font-extrabold text-amber-400">{selectedCount}</span>
                <span className="text-xs text-stone-400">/ {galleryData.maxPhotosAllowed} incluidas</span>
              </div>
            </div>
          </div>
        </div>

        {/* GRID DE FOTOS CON PROTECCIÓN Y MARCA DE AGUA GIGANTE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(galleryData.photos || []).map((photo, index) => {
            const isSelected = Boolean(selections[photo.id]?.selected);
            const clientComment = selections[photo.id]?.comment || '';

            return (
              <div
                key={photo.id}
                className={`relative rounded-3xl overflow-hidden bg-stone-900 border transition-all duration-300 ${
                  isSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-2xl shadow-amber-500/10'
                    : 'border-stone-800'
                }`}
              >
                {/* CONTENEDOR DE IMAGEN CON PROTECCIÓN */}
                <div 
                  className="relative aspect-[4/5] w-full overflow-hidden bg-black select-none cursor-pointer"
                  onClick={() => togglePhotoSelection(photo.id)}
                >
                  {/* FOTO RENDERIZADA EN CANVAS (INMUNE A INSPECCIÓN Y DESCARGA) */}
                  <ProtectedCanvasImage
                    src={photo.url}
                    alt={photo.title}
                    objectFit="cover"
                    watermark={true}
                    watermarkText="SEBASTIAN G • PROTEGIDO"
                  />

                  {/* MALLA DE MARCA DE AGUA REPETIDA EN TODA LA FOTO */}
                  <div className="absolute inset-0 z-15 pointer-events-none overflow-hidden opacity-30 select-none flex flex-wrap gap-6 items-center justify-around -rotate-12 scale-125">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <span key={i} className="text-[10px] font-black tracking-wider text-white/50 uppercase whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                        SEBASTIAN G • PROHIBIDA SU DESCARGA
                      </span>
                    ))}
                  </div>

                  {/* MARCA DE AGUA GIGANTE CENTRAL CON EL LOGOTIPO OFICIAL DE SEBASTIAN G */}
                  <div className="watermark-overlay z-20">
                    <div className="watermark-content animate-watermark flex flex-col items-center justify-center text-center">
                      <img
                        src={galleryData?.watermarkSettings?.watermarkLogoUrl || "/app-icon.png"}
                        alt="Sebastian G"
                        className="h-14 w-14 sm:h-20 sm:w-20 rounded-2xl object-cover shadow-2xl border border-white/30 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] opacity-95 mb-2"
                      />
                      <p className="text-[10px] sm:text-[11px] font-black tracking-widest text-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] uppercase">
                        {watermarkSubtext}
                      </p>
                    </div>
                  </div>

                  {/* INDICADOR DE FOTO SELECCIONADA EN LA ESQUINA */}
                  <div className="absolute top-4 right-4 z-30">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center backdrop-blur-md border transition-transform ${
                        isSelected
                          ? 'bg-amber-500 border-amber-400 text-stone-950 scale-110 shadow-lg shadow-amber-500/40'
                          : 'bg-stone-950/70 border-white/20 text-stone-400'
                      }`}
                    >
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                  </div>

                  {/* NÚMERO DE FOTO */}
                  <div className="absolute top-4 left-4 z-30">
                    <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-stone-950/80 backdrop-blur-md text-stone-300 border border-white/10">
                      #{index + 1}
                    </span>
                  </div>

                  {/* BADGE INFERIOR DE ESTADO */}
                  <div className="absolute bottom-3 inset-x-3 z-30">
                    <div
                      className={`py-2 px-3 rounded-xl text-xs font-bold text-center backdrop-blur-md transition-colors ${
                        isSelected
                          ? 'bg-amber-500/90 text-stone-950 border border-amber-400'
                          : 'bg-stone-950/80 text-stone-300 border border-stone-800'
                      }`}
                    >
                      {isSelected ? '✓ Foto Elegida para tu Paquete' : 'Toca para elegir esta foto'}
                    </div>
                  </div>
                </div>

                {/* ÁREA DE COMENTARIOS Y OPINIÓN POR FOTO */}
                <div className="p-4 bg-stone-900 border-t border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white truncate">
                      {photo.title}
                    </span>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => togglePhotoSelection(photo.id)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                      }`}
                    >
                      {isSelected ? 'Quitar selección' : 'Seleccionar'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-stone-400 mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-amber-400" />
                      <span>Observaciones o retoques para esta foto:</span>
                    </label>
                    <textarea
                      value={clientComment}
                      disabled={isLocked}
                      onChange={(e) => handleCommentChange(photo.id, e.target.value)}
                      placeholder="Ej: Aclarar un poco la sombra, me encanta para cuadro, etc."
                      rows={2}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 disabled:opacity-50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* BARRA FLOTANTE INFERIOR PARA ENVIAR SELECCIÓN FINAL */}
        <div className="fixed bottom-0 inset-x-0 z-40 bg-stone-950/95 backdrop-blur-md border-t border-stone-800 p-4 shadow-2xl">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Tu Selección:
                </span>
                <span className="text-sm font-extrabold text-white">
                  {selectedCount} fotos elegidas
                </span>
                <span className="text-xs text-stone-400">
                  (Paquete incluye {maxAllowed})
                </span>
                {extraPhotos > 0 && (
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                    +{extraPhotos} extra (${formatPrice(extraPhotosTotal)} COP)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400 hidden sm:block mt-0.5">
                {(galleryData.isDelivered || galleryData.status === 'delivered' || galleryData.finalDeliveryUrl)
                  ? 'Tus fotos finales han sido procesadas en máxima nitidez y sin compresión.'
                  : 'Solo puedes enviar una única vez. Al confirmar, el enlace se bloqueará.'}
              </p>
            </div>

            <div className="w-full sm:w-auto flex items-center gap-3">
              {(galleryData.isDelivered || galleryData.status === 'delivered' || galleryData.finalDeliveryUrl) ? (
                <a
                  href={galleryData.finalDeliveryUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-black text-sm px-7 py-3.5 rounded-xl shadow-lg shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <DownloadCloud className="w-5 h-5 text-stone-950" />
                  <span>Descargar Fotos en Full HD</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled={isLocked || selectedCount === 0}
                  onClick={() => setConfirmModalOpen(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-extrabold text-sm px-7 py-3.5 rounded-xl shadow-lg shadow-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <CheckCircle2 className="w-5 h-5 fill-stone-950" />
                  <span>
                    {extraPhotos > 0 ? `Pagar Fotos Extra y Enviar ($${formatPrice(extraPhotosTotal)} COP)` : 'Enviar Mi Selección Definitiva'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MODAL DE CONFIRMACIÓN Y PASARELA DE PAGO DIRECTO */}
        {confirmModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-lg w-full p-5 sm:p-7 text-center shadow-2xl my-auto max-h-[95vh] flex flex-col">
              
              <div className="overflow-y-auto space-y-4 pr-1 text-left">
                {/* Cabecera del Modal */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg sm:text-xl font-serif font-bold text-white leading-tight">
                      Confirmar Selección {totalAmount > 0 ? '& Pago Directo' : 'Definitiva'}
                    </h4>
                    <span className="text-[11px] text-amber-400 font-semibold block">
                      {galleryData.clientName} • {galleryData.packageTitle}
                    </span>
                  </div>
                </div>

                {/* Resumen de Fotos y Costos */}
                <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 space-y-2.5 text-xs">
                  <div className="flex justify-between text-stone-300">
                    <span className="text-stone-400">Fotos incluidas en tu paquete:</span>
                    <span className="font-bold text-emerald-400">{maxAllowed} fotos (Ya incluidas)</span>
                  </div>

                  <div className="flex justify-between text-stone-300">
                    <span className="text-stone-400">Total fotos elegidas:</span>
                    <span className="font-bold text-white">{selectedCount} fotos</span>
                  </div>

                  {extraPhotos > 0 && (
                    <div className="flex justify-between text-amber-300 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                      <span>Fotos adicionales (+{extraPhotos} fotos a $7.000 c/u):</span>
                      <span className="font-bold font-mono">+${formatPrice(extraPhotosTotal)} COP</span>
                    </div>
                  )}

                  {/* Selector opcional de fotos impresas */}
                  <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-stone-200 block">Fotos Impresas 10x15</span>
                      <span className="text-[10px] text-stone-400">Papel fotográfico profesional ($7.000 c/u)</span>
                    </div>
                    <div className="flex items-center gap-2 bg-stone-900 border border-stone-700 rounded-xl px-2 py-1">
                      <button
                        type="button"
                        onClick={() => setPrintedPhotosCount(Math.max(0, printedPhotosCount - 1))}
                        className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold flex items-center justify-center text-sm"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-bold text-white font-mono">{printedPhotosCount}</span>
                      <button
                        type="button"
                        onClick={() => setPrintedPhotosCount(printedPhotosCount + 1)}
                        className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold flex items-center justify-center text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {printedPhotosCount > 0 && (
                    <div className="flex justify-between text-stone-300">
                      <span className="text-stone-400">Total impresiones ({printedPhotosCount}):</span>
                      <span className="font-bold font-mono text-amber-400">+${formatPrice(printedPhotosTotal)} COP</span>
                    </div>
                  )}

                  {/* TOTAL GENERAL */}
                  <div className="pt-2.5 border-t border-stone-800 flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                      Total a Pagar:
                    </span>
                    <span className={`text-xl font-black font-mono ${totalAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {totalAmount > 0 ? `$${formatPrice(totalAmount)} COP` : '$0 COP (Cubierto)'}
                    </span>
                  </div>
                </div>

                {/* SI EL TOTAL ES > 0, SE ACTIVA LA PASARELA DE PAGO DIRECTO */}
                {totalAmount > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-amber-400" />
                        <span>Pasarela de Pago Directo</span>
                      </label>
                      <span className="text-[10px] text-stone-400 font-medium">Sin intermediarios</span>
                    </div>

                    {/* Selector de billeteras: Nequi, DaviPlata, Dale */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedWallet('nequi')}
                        className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                          selectedWallet === 'nequi'
                            ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-md shadow-purple-900/30 ring-1 ring-purple-500'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                        }`}
                      >
                        <span className="text-xs font-black">Nequi</span>
                        <span className="text-[10px] opacity-75">3244725167</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedWallet('daviplata')}
                        className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                          selectedWallet === 'daviplata'
                            ? 'bg-red-950/60 border-red-500 text-red-200 shadow-md shadow-red-900/30 ring-1 ring-red-500'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                        }`}
                      >
                        <span className="text-xs font-black">DaviPlata</span>
                        <span className="text-[10px] opacity-75">Por Llave</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedWallet('dale')}
                        className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                          selectedWallet === 'dale'
                            ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-md shadow-amber-900/30 ring-1 ring-amber-500'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                        }`}
                      >
                        <span className="text-xs font-black">Dale!</span>
                        <span className="text-[10px] opacity-75">Por Llave</span>
                      </button>
                    </div>

                    {/* Detalle de la cuenta seleccionada */}
                    {selectedWallet === 'nequi' && (
                      <div className="bg-purple-950/30 border border-purple-500/40 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-purple-200">
                            Número Nequi de Sebastian:
                          </span>
                          <span className="text-xs font-mono font-bold text-white bg-purple-900/60 px-2 py-0.5 rounded-md">
                            3244725167
                          </span>
                        </div>
                        <p className="text-[11px] text-purple-200/80 leading-relaxed">
                          Abre tu app Nequi y transfiere <strong>${formatPrice(totalAmount)} COP</strong> al número <strong>3244725167</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('3244725167', 'nequi')}
                          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2 px-3 rounded-xl transition-colors"
                        >
                          {copiedKeyFeedback === 'nequi' ? (
                            <>
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>¡Número 3244725167 Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copiar Número Nequi (3244725167)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {selectedWallet === 'daviplata' && (
                      <div className="bg-red-950/30 border border-red-500/40 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-red-200">
                            Llave DaviPlata de Sebastian:
                          </span>
                          <span className="text-xs font-mono font-bold text-white bg-red-900/60 px-2 py-0.5 rounded-md">
                            @PLATA3244725167
                          </span>
                        </div>
                        <p className="text-[11px] text-red-200/80 leading-relaxed">
                          Abre DaviPlata &gt; Pasa Plata &gt; Por Llave &gt; Ingresa <strong>@PLATA3244725167</strong> por valor de <strong>${formatPrice(totalAmount)} COP</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('@PLATA3244725167', 'daviplata')}
                          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2 px-3 rounded-xl transition-colors"
                        >
                          {copiedKeyFeedback === 'daviplata' ? (
                            <>
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>¡Llave @PLATA3244725167 Copiada!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copiar Llave (@PLATA3244725167)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {selectedWallet === 'dale' && (
                      <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-amber-200">
                            Llave Dale! de Sebastian:
                          </span>
                          <span className="text-xs font-mono font-bold text-white bg-amber-900/60 px-2 py-0.5 rounded-md">
                            @SGG04
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-200/80 leading-relaxed">
                          Abre Dale! &gt; Transfiere a la Llave <strong>@SGG04</strong> por valor de <strong>${formatPrice(totalAmount)} COP</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('@SGG04', 'dale')}
                          className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs py-2 px-3 rounded-xl transition-colors"
                        >
                          {copiedKeyFeedback === 'dale' ? (
                            <>
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>¡Llave @SGG04 Copiada!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copiar Llave (@SGG04)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Subida de comprobante y número de referencia */}
                    <div className="space-y-2 pt-1">
                      <label className="block text-[11px] font-semibold text-stone-300">
                        Comprobante de Transferencia (Captura o Foto):
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        ref={voucherInputRef}
                        onChange={handleVoucherUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => voucherInputRef.current?.click()}
                        className="w-full bg-stone-950 hover:bg-stone-800 border border-dashed border-stone-700 hover:border-amber-500/60 rounded-xl p-2.5 text-xs text-stone-300 flex items-center justify-center gap-2 transition-all"
                      >
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>{voucherImage ? '✓ Comprobante cargado (Toca para cambiar)' : 'Adjuntar foto o captura del comprobante'}</span>
                      </button>

                      {voucherImage && (
                        <div className="flex items-center gap-2 bg-stone-950 p-2 rounded-xl border border-emerald-500/40">
                          <img src={voucherImage} alt="Comprobante" className="w-8 h-8 rounded-lg object-cover" />
                          <span className="text-[11px] text-emerald-400 font-medium">✓ Comprobante listo para enviar a Sebastian</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                          Número de Referencia o Aprobación (Opcional):
                        </label>
                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Ej: M123456 o número de confirmación"
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* AVISO IMPORTANTE DE BLOQUEO ÚNICO */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200 leading-tight">
                  ⚠️ <strong>Recordatorio:</strong> Solo puedes enviar tu selección <strong>una única vez</strong>. Al confirmar, tus fotos quedarán bloqueadas y Sebastian recibirá la notificación inmediata con tus fotos y comprobante de pago.
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmSubmit}
                    className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-extrabold text-sm py-3.5 rounded-xl shadow-lg shadow-amber-500/25 disabled:opacity-50 active:scale-[0.98] transition-all"
                  >
                    {isSubmitting ? (
                      'Procesando y guardando...'
                    ) : totalAmount > 0 ? (
                      `✓ Registrar Pago de $${formatPrice(totalAmount)} COP y Enviar Fotos`
                    ) : (
                      '✓ Sí, Enviar Mi Selección Definitiva'
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setConfirmModalOpen(false)}
                    className="w-full py-2.5 text-xs text-stone-400 hover:text-stone-200"
                  >
                    Volver a revisar mis fotos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
