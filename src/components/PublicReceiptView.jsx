import React, { useState, useEffect } from 'react';
import { Camera, Download, MessageCircle, ArrowLeft, CheckCircle2, ShieldCheck, Printer } from 'lucide-react';
import { getAdminBookings, formatDateTime12Hour } from '../services/api';
import { LOGO_WATERMARK_WHITE, LOGO_WATERMARK_FAINT } from '../assets/logoWatermark';
import { generateLuxuryReceiptPdf } from '../services/receiptPdfGenerator';

export default function PublicReceiptView({ bookingId, onBack }) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Extraer parámetros de pago de la URL (si vienen dados)
  const [paidAmount, setPaidAmount] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Nequi');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : (hash.includes('&') ? hash.replace('#recibo=', 'id=').replace('&', '&') : ''));
      const urlParams = new URLSearchParams(window.location.search);
      
      const paidParam = params.get('paid') || urlParams.get('paid');
      if (paidParam) setPaidAmount(Number(paidParam));
      
      const methodParam = params.get('method') || urlParams.get('method');
      if (methodParam) setPaymentMethod(decodeURIComponent(methodParam));
    }

    const fetchBooking = async () => {
      try {
        setLoading(true);
        const list = await getAdminBookings();
        const found = list.find(b => String(b.id) === String(bookingId));
        if (found) {
          setBooking(found);
          if (paidAmount === null) {
            const total = Number(found.totalPrice || 0);
            setPaidAmount(found.status === 'completed' ? total : Math.round(total * 0.5));
          }
        }
      } catch (err) {
        console.error('Error buscando comprobante:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  const handleDownloadPdf = async () => {
    if (!booking) return;
    setIsGeneratingPdf(true);
    try {
      const receiptRes = await generateLuxuryReceiptPdf({
        booking,
        paidAmount,
        paymentMethod,
        notes: `Comprobante oficial de reserva y pago para ${booking.packageName || 'Sesión Fotográfica'}.`
      });

      if (receiptRes) {
        const safeName = `Comprobante-SebastianG-${receiptRes.voucherNum}.pdf`;
        // Soporte nativo para APK Android (guarda en Descargas y abre el visor del sistema)
        if (typeof window !== 'undefined' && window.AndroidNotificationBridge?.downloadPdfFile) {
          window.AndroidNotificationBridge.downloadPdfFile(receiptRes.getBase64(), safeName);
        } else {
          receiptRes.save(safeName);
        }
      }
    } catch (err) {
      console.error('Error generando PDF de comprobante:', err);
      handlePrintPdf();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!booking) return;

    // 1. Soporte nativo en APK Android para impresión de documentos (abre PrintManager)
    if (typeof window !== 'undefined' && window.AndroidNotificationBridge?.printPdfDocument) {
      setIsGeneratingPdf(true);
      try {
        const receiptRes = await generateLuxuryReceiptPdf({
          booking,
          paidAmount,
          paymentMethod,
          notes: `Comprobante oficial de reserva y pago para ${booking.packageName || 'Sesión Fotográfica'}.`
        });
        if (receiptRes) {
          window.AndroidNotificationBridge.printPdfDocument(
            receiptRes.getBase64(),
            `Comprobante-SebastianG-${receiptRes.voucherNum}`
          );
          return;
        }
      } catch (e) {
        console.warn('Error imprimiendo vía puente nativo APK:', e);
      } finally {
        setIsGeneratingPdf(false);
      }
    }

    // 2. Fallback estándar para navegadores de PC y móviles
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-stone-300 font-serif text-lg">Cargando comprobante oficial...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-center text-stone-300">
        <p className="text-lg font-serif mb-4">No pudimos encontrar el comprobante solicitado.</p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs"
        >
          Volver a sebastiang.app
        </button>
      </div>
    );
  }

  const total = Number(booking.totalPrice || 0);
  const actualPaid = paidAmount !== null ? paidAmount : (booking.status === 'completed' ? total : Math.round(total * 0.5));
  const balance = Math.max(0, total - actualPaid);
  const voucherNum = `REC-${String(booking.id).replace(/\D/g, '').slice(-5).padStart(5, '0') || '001'}`;
  const loc = booking.specificLocation || (booking.locationType === 'outside' ? 'tu locación seleccionada' : 'San Antero');

  return (
    <div className="min-h-screen bg-stone-950 text-white py-8 px-4 sm:px-6 flex flex-col items-center">
      <div className="max-w-2xl w-full space-y-4">
        {/* Barra superior de navegación */}
        <div className="flex items-center justify-between no-print">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Inicio</span>
          </button>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Comprobante Verificado Oficial</span>
          </span>
        </div>

        {/* Tarjeta del Recibo para Visualización y Exportación PDF */}
        <div
          id="public-receipt-card"
          className="relative overflow-hidden bg-stone-950 text-white border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl"
        >
          {/* Marca de Agua con Logo Oficial del Sistema */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
            <img 
              src={LOGO_WATERMARK_WHITE} 
              alt="Logo del Sistema" 
              className="w-52 h-52 sm:w-64 sm:h-64 object-contain opacity-[0.10] filter drop-shadow-2xl"
            />
          </div>

          <div className="relative z-10 space-y-5">
            {/* Encabezado Corporativo */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-stone-800 pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-400" />
                <h1 className="text-xl sm:text-2xl font-serif font-black tracking-wide text-white">
                  SEBASTIAN G
                </h1>
              </div>
              <p className="text-[11px] text-amber-400/90 font-medium tracking-widest uppercase mt-0.5">
                Fotografía & Retoque Profesional
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                San Antero, Córdoba, Colombia • Tel: +57 324 4725167 • sebastiang.app
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono text-xs font-black">
                {voucherNum}
              </span>
              <p className="text-[10px] text-stone-400 mt-1">
                Fecha de Emisión: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Datos del Cliente & Sesión */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1 bg-stone-900/60 p-3.5 rounded-2xl border border-stone-800/80">
              <span className="text-[10px] uppercase font-bold text-amber-400/80 block">Cliente Titular</span>
              <p className="font-bold text-stone-100 text-sm">{booking.clientName}</p>
              <p className="text-stone-300">WhatsApp: <span className="font-mono text-emerald-400">{booking.clientWhatsApp}</span></p>
              {booking.clientEmail && (
                <p className="text-stone-300 truncate">Correo: <span className="text-stone-200">{booking.clientEmail}</span></p>
              )}
            </div>

            <div className="space-y-1 bg-stone-900/60 p-3.5 rounded-2xl border border-stone-800/80">
              <span className="text-[10px] uppercase font-bold text-amber-400/80 block">Detalles de la Sesión</span>
              <p className="font-bold text-stone-100">{formatDateTime12Hour(booking.dateTime)}</p>
              <p className="text-stone-300 truncate">Locación: <span className="text-stone-200">{loc}</span></p>
              <p className="text-stone-300 truncate">Paquete: <span className="text-amber-300">{booking.packageName}</span></p>
            </div>
          </div>

          {/* Tabla Financiera */}
          <div className="border border-stone-800 rounded-2xl overflow-hidden text-xs">
            <div className="bg-stone-900/80 px-4 py-2.5 border-b border-stone-800 flex justify-between font-bold text-stone-300">
              <span>Concepto Contratado</span>
              <span>Importe</span>
            </div>
            <div className="p-4 space-y-2.5 bg-stone-950">
              <div className="flex justify-between text-stone-300">
                <span>Sesión Fotográfica ({booking.packageName})</span>
                <span className="font-mono font-semibold">${total.toLocaleString('es-CO')} COP</span>
              </div>
              {(() => {
                const c10 = Number(booking.printedPhotos10x15Count || (booking.printedPhotosCount && !booking.printedPhotos15x20Count ? booking.printedPhotosCount : 0));
                const c15 = Number(booking.printedPhotos15x20Count || 0);
                const txt = (c10 > 0 && c15 > 0)
                  ? `+ ${c10} Fotos impresas 10x15 y + ${c15} Fotos impresas 15x20`
                  : c15 > 0
                    ? `+ ${c15} Fotos impresas 15x20`
                    : c10 > 0
                      ? `+ ${c10} Fotos impresas 10x15`
                      : Number(booking.printedPhotosCount) > 0
                        ? `+ ${booking.printedPhotosCount} Fotos impresas en papel fotográfico`
                        : '';
                if (!txt) return null;
                return (
                  <div className="flex justify-between text-stone-400 text-[11px]">
                    <span>{txt}</span>
                    <span>Incluido</span>
                  </div>
                );
              })()}
              <div className="border-t border-stone-800 pt-2 flex justify-between text-stone-200">
                <span className="font-bold">Total Pactado:</span>
                <span className="font-mono font-bold">${total.toLocaleString('es-CO')} COP</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                <span>Monto Abonado / Recibido ({paymentMethod}):</span>
                <span className="font-mono">${actualPaid.toLocaleString('es-CO')} COP</span>
              </div>
              <div className="flex justify-between text-amber-400 font-bold px-2.5 py-1">
                <span>Saldo Pendiente de Pago en la Sesión:</span>
                <span className="font-mono">${balance.toLocaleString('es-CO')} COP</span>
              </div>
            </div>
          </div>

          {/* Respaldo y Garantía Dinámica de Clima */}
          <div className="p-3.5 bg-stone-900/40 rounded-2xl border border-stone-800/60 text-[11px] space-y-1 text-stone-400">
            <p className="text-amber-300 font-semibold flex items-center gap-1.5">
              <span>⛅ Garantía de Buen Clima en {loc}:</span>
            </p>
            <p>
              En caso de lluvia o clima adverso en {loc}, tu sesión se reprograma para una nueva fecha sin ningún costo ni penalidad adicional.
            </p>
            <p className="pt-0.5 text-stone-500">
              Comprobante digital válido emitido desde sebastiang.app. Tu cupo y fecha están garantizados.
            </p>
          </div>

          {/* Firma */}
          <div className="flex justify-between items-end pt-3 border-t border-stone-800 text-[11px]">
            <div>
              <p className="font-serif italic text-amber-400 text-sm font-bold">Sebastian G</p>
              <p className="text-stone-400 text-[10px]">Fotógrafo Profesional Titular</p>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  balance === 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}
              >
                {balance === 0 ? '✓ PAGADO TOTAL (100%)' : '✓ ABONO REGISTRADO (50%)'}
              </span>
            </div>
          </div>
          </div>
        </div>

        {/* Botones de Acción para el Cliente */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 no-print">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="w-full sm:flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingPdf ? 'Generando PDF...' : '📥 Descargar Comprobante en PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            disabled={isGeneratingPdf}
            className="w-full sm:w-auto py-3.5 px-5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
            title="Imprimir Comprobante"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Imprimir</span>
          </button>

          <a
            href="https://wa.me/573244725167"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
            <span>💬 Escribir a Sebastian G</span>
          </a>
        </div>
      </div>
    </div>
  );
}
