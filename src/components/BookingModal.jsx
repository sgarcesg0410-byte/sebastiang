import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, MapPin, Sparkles, MessageCircle, AlertCircle, CheckCircle2, User, FileText, Printer, Crown, Mail } from 'lucide-react';
import confetti from 'canvas-confetti';
import { createBooking, checkClientLoyalty, formatTo12Hour } from '../services/api';

export default function BookingModal({ isOpen, onClose, packages = [], preselectedPackage, settings = {} }) {
  if (!isOpen) return null;

  const scrollRef = useRef(null);
  const surchargeAmount = settings.outOfSanAnteroSurcharge || 10000;
  const printedPhotoPrice = settings.printedPhotoPrice || 7000;

  // Form State
  const [formData, setFormData] = useState({
    clientName: '',
    clientWhatsApp: '',
    clientEmail: '',
    packageId: preselectedPackage ? preselectedPackage.id : (packages[2]?.id || packages[0]?.id || ''),
    locationType: 'san_antero',
    specificLocation: '',
    date: '',
    time: '16:00',
    description: '',
    printedPhotosCount: 0
  });

  const [loyalInfo, setLoyalInfo] = useState({ isLoyal: false, discountPercent: 0, clientName: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedBooking, setSubmittedBooking] = useState(null);

  // Detección automática de cliente frecuente para fidelización
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.clientWhatsApp && formData.clientWhatsApp.replace(/\D/g, '').length >= 7) {
        const res = await checkClientLoyalty(formData.clientWhatsApp);
        setLoyalInfo(res);
        if (res.isLoyal && !formData.clientName && res.clientName && res.clientName !== 'Cliente VIP') {
          setFormData(prev => ({ ...prev, clientName: res.clientName }));
        }
      } else {
        setLoyalInfo({ isLoyal: false, discountPercent: 0, clientName: '' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.clientWhatsApp]);

  // Asegurar que al abrir siempre comience scrolleado arriba de todo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    if (preselectedPackage) {
      setFormData(prev => ({ ...prev, packageId: preselectedPackage.id }));
    }
  }, [preselectedPackage]);

  const currentPackage = packages.find(p => p.id === formData.packageId) || packages[0];

  // Cálculo con recargo por locación especial (+ $10.000 COP)
  const baseOrSurchargedPrice = currentPackage
    ? (formData.locationType === 'outside' ? currentPackage.price + surchargeAmount : currentPackage.price)
    : 0;

  // Descuento de fidelización del 15% para clientes recurrentes
  const loyaltyDiscount = loyalInfo.isLoyal ? Math.round(baseOrSurchargedPrice * 0.15) : 0;
  const printedPhotosTotal = Number(formData.printedPhotosCount || 0) * printedPhotoPrice;
  const calculatedPrice = (baseOrSurchargedPrice - loyaltyDiscount) + printedPhotosTotal;

  const formatPrice = (val) => Number(val).toLocaleString('es-CO');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      locationType: type,
      specificLocation: type === 'san_antero' ? '' : prev.specificLocation
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.clientName.trim()) {
      setErrorMessage('Por favor escribe tu Nombre y Apellido.');
      return;
    }

    if (!formData.clientWhatsApp.trim()) {
      setErrorMessage('Ingresa tu número de WhatsApp para poder enviarte el enlace con tus fotos.');
      return;
    }

    if (!formData.date) {
      setErrorMessage('Por favor selecciona la fecha deseada para tu sesión.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Formatear fecha a DD/MM/YYYY y hora estrictamente a formato 12 horas (h:mm a. m. / p. m.)
      let formattedDate = formData.date;
      if (formattedDate && formattedDate.includes('-')) {
        const parts = formattedDate.split('-');
        if (parts.length === 3) {
          formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      const formattedTime12 = formatTo12Hour(formData.time);
      const formattedDateTime = `${formattedDate} a las ${formattedTime12}`;

      const bookingPayload = {
        clientName: formData.clientName.trim(),
        clientWhatsApp: formData.clientWhatsApp.trim(),
        clientEmail: (formData.clientEmail || '').trim(),
        packageId: formData.packageId,
        packageName: currentPackage ? `${currentPackage.name} (+ 2 Fotos Gratis)` : 'Sesión Fotográfica',
        totalPrice: calculatedPrice,
        loyaltyDiscount: loyaltyDiscount,
        isVipClient: loyalInfo.isLoyal,
        locationType: formData.locationType,
        specificLocation: formData.specificLocation || (formData.locationType === 'san_antero' ? 'San Antero (Playa / Sector)' : 'Locación Especial / Fuera'),
        dateTime: formattedDateTime,
        description: formData.description.trim(),
        printedPhotosCount: Number(formData.printedPhotosCount || 0)
      };

      const result = await createBooking(bookingPayload);

      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      // Sincronización en tiempo real con el panel de administración
      try {
        if (typeof window !== 'undefined' && window.BroadcastChannel) {
          const bc = new BroadcastChannel('bookings_realtime_sync');
          bc.postMessage({ type: 'new_booking', booking: result.booking });
          setTimeout(() => bc.close(), 300);
        }
        localStorage.setItem('sebastian_g_bookings_last_sync', Date.now().toString());
      } catch (e) {}

      // Abrir inmediatamente WhatsApp Línea 1 para notificar al fotógrafo sin bloqueo de ventanas emergentes
      if (result.directWhatsAppUrl) {
        try {
          const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
          if (isMobile) {
            window.location.href = result.directWhatsAppUrl;
          } else {
            const win = window.open(result.directWhatsAppUrl, '_blank');
            if (!win || win.closed || typeof win.closed === 'undefined') {
              window.location.href = result.directWhatsAppUrl;
            }
          }
        } catch (e) {}
      }

      setSubmittedBooking({
        ...result.booking,
        directWhatsAppUrl: result.directWhatsAppUrl,
        secondaryWhatsAppUrl: result.secondaryWhatsAppUrl
      });
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Ocurrió un error al procesar tu reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md p-2 sm:p-6 flex flex-col items-center justify-start sm:justify-center">
      
      {/* CONTENEDOR DEL MODAL CON SCROLL INTERNO Y CABECERA VISIBLE */}
      <div className="relative w-full max-w-xl bg-stone-900 border border-stone-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* CABECERA FIJA CON LOGO BLANCO */}
        <div className="sticky top-0 z-30 px-5 py-3.5 bg-stone-950/98 backdrop-blur-md border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-serif font-bold text-white leading-tight">
                Reservar Sesión Fotográfica
              </h3>
              <span className="text-[10px] text-amber-400 font-semibold block">
                Fotografía & Edición Profesional
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CUERPO DEL MODAL CON SCROLL AUTOMÁTICO HACIA ARRIBA */}
        <div ref={scrollRef} className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1 overscroll-contain">
          {submittedBooking ? (
            /* PANTALLA DE CONFIRMACIÓN */
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 block mb-1">
                  ¡Reserva Recibida con Éxito!
                </span>
                <h4 className="text-2xl font-serif font-bold text-white">
                  Gracias, {submittedBooking.clientName}
                </h4>
                <p className="text-xs sm:text-sm text-stone-300 mt-2 max-w-md mx-auto leading-relaxed">
                  Hemos agendado tu solicitud para el <strong>{submittedBooking.dateTime}</strong> en <strong>{submittedBooking.specificLocation}</strong>.
                </p>
              </div>

              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 text-left space-y-2 text-xs">
                <div className="flex justify-between text-stone-300">
                  <span className="text-stone-400">Paquete:</span>
                  <span className="font-semibold text-white">{submittedBooking.packageName}</span>
                </div>
                <div className="flex justify-between text-stone-300 items-center">
                  <span className="text-stone-400">Total de la sesión:</span>
                  <span className="font-bold text-amber-400 text-lg font-mono">${formatPrice(submittedBooking.totalPrice)} COP</span>
                </div>
                <div className="flex justify-between text-stone-300">
                  <span className="text-stone-400">WhatsApp de contacto:</span>
                  <span className="font-semibold text-white">{submittedBooking.clientWhatsApp}</span>
                </div>
                {submittedBooking.clientEmail && (
                  <div className="flex justify-between text-stone-300">
                    <span className="text-stone-400">Comprobante enviado a:</span>
                    <span className="font-semibold text-amber-300">{submittedBooking.clientEmail}</span>
                  </div>
                )}
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-left text-xs text-amber-200">
                📸 <strong>Paso siguiente:</strong> Te contactaremos por WhatsApp para coordinar los detalles. Una vez hecha la sesión, recibirás tu enlace personal para elegir tus fotos con 2 fotos gratis incluidas.
              </div>

              <div className="space-y-3 pt-2">
                {submittedBooking.directWhatsAppUrl && (
                  <a
                    href={submittedBooking.directWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
                        e.preventDefault();
                        window.location.href = submittedBooking.directWhatsAppUrl;
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-98 transition-all"
                  >
                    <MessageCircle className="w-5 h-5 fill-white" />
                    <span>Notificar a WhatsApp Línea 1 (324 472 5167) 📲</span>
                  </a>
                )}

                {submittedBooking.secondaryWhatsAppUrl && (
                  <a
                    href={submittedBooking.secondaryWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
                        e.preventDefault();
                        window.location.href = submittedBooking.secondaryWhatsAppUrl;
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-950/80 border border-emerald-500/50 hover:bg-emerald-900/80 text-emerald-200 font-extrabold py-3 px-6 rounded-xl text-xs active:scale-98 transition-all shadow-md"
                  >
                    <MessageCircle className="w-4 h-4 fill-emerald-400" />
                    <span>Notificar también a WhatsApp Línea 2 (302 369 6513) 📲</span>
                  </a>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-2.5 text-xs text-stone-400 hover:text-stone-200"
                >
                  Cerrar esta ventana
                </button>
              </div>
            </div>
          ) : (
            /* FORMULARIO DE RESERVA */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {errorMessage && (
                <div className="p-3.5 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. CAMPO NOMBRE Y APELLIDO (ARRIBA DE TODO EN GRANDE) */}
              <div className="bg-stone-950 p-4 rounded-2xl border-2 border-amber-500/60 shadow-lg">
                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>Nombre y Apellido *</span>
                </label>
                <input
                  type="text"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleInputChange}
                  placeholder="Escribe tu Nombre y Apellido aquí"
                  required
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-sm font-semibold text-white placeholder-stone-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {/* 2. WHATSAPP (AVISO OBLIGATORIO) */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Número de WhatsApp *</span>
                </label>
                <input
                  type="tel"
                  name="clientWhatsApp"
                  value={formData.clientWhatsApp}
                  onChange={handleInputChange}
                  placeholder="Ej. 300 123 4567"
                  required
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
                
                {loyalInfo.isLoyal ? (
                  <div className="mt-2 bg-gradient-to-r from-amber-950/80 via-stone-900 to-amber-950/80 border-2 border-amber-400/60 rounded-xl p-3 flex items-center gap-2.5 shadow-lg">
                    <Crown className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-xs font-black text-amber-300 block">
                        👑 ¡Cliente Preferencial VIP Detectado! ({loyalInfo.clientName})
                      </span>
                      <p className="text-[11px] text-amber-100/90 leading-tight mt-0.5">
                        Tienes un <strong>15% de Descuento Especial</strong> aplicado automáticamente en el valor total de tu sesión.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-start gap-1.5 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg leading-tight">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                    <span>
                      <strong>Importante:</strong> Por este WhatsApp recibirás el enlace privado para elegir tus fotos protegidas.
                    </span>
                  </div>
                )}
              </div>

              {/* CORREO ELECTRÓNICO (OPCIONAL VIP) */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>Correo Electrónico (Opcional)</span>
                </label>
                <input
                  type="email"
                  name="clientEmail"
                  value={formData.clientEmail}
                  onChange={handleInputChange}
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  ✉️ Te enviaremos un comprobante formal y recordatorios de tu sesión.
                </p>
              </div>

              {/* 3. LUGAR DE LA SESIÓN (ESCENARIOS LIBRES Y ABIERTOS) */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Lugar de la Sesión *</span>
                </label>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => handleLocationTypeChange('san_antero')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 text-center ${
                      formData.locationType === 'san_antero'
                        ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-md shadow-amber-500/15'
                        : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <span>📍 Sesión Local / En Locación</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLocationTypeChange('outside')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 text-center ${
                      formData.locationType === 'outside'
                        ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-md shadow-amber-500/15'
                        : 'bg-stone-950 text-stone-400 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <span>🚗 Locación Especial / Fuera (+ $10k)</span>
                  </button>
                </div>

                {formData.locationType === 'san_antero' ? (
                  <input
                    type="text"
                    name="specificLocation"
                    value={formData.specificLocation}
                    onChange={handleInputChange}
                    placeholder="Ej: Playa, Parque, Casa, Hacienda, Casco Urbano, etc."
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                  />
                ) : (
                  <input
                    type="text"
                    name="specificLocation"
                    value={formData.specificLocation}
                    onChange={handleInputChange}
                    placeholder="Ej: Finca, Hotel campestre, A domicilio, Municipio vecino o Viaje"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                  />
                )}

                <div className="mt-2.5 bg-gradient-to-r from-sky-950/50 via-stone-900 to-sky-950/50 border border-sky-500/30 rounded-xl p-2.5 flex items-center gap-2">
                  <span className="text-base shrink-0">⛅</span>
                  <p className="text-[11px] text-sky-200/90 leading-tight">
                    <strong>Garantía de Clima en San Antero:</strong> Si el clima (lluvia o tormenta) impide realizar la sesión frente al mar, se reprograma para una nueva fecha sin ningún costo adicional.
                  </p>
                </div>
              </div>

              {/* 4. FECHA Y HORA */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-400" />
                    <span>Fecha *</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Hora *</span>
                  </label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* 5. PAQUETE DE FOTOS & VALOR (AJUSTADO INVISIBLEMENTE) */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1">
                  Paquete de Fotos
                </label>

                <select
                  name="packageId"
                  value={formData.packageId}
                  onChange={handleInputChange}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  {packages.map(p => {
                    const displayPrice = formData.locationType === 'outside' ? p.price + surchargeAmount : p.price;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} (+2 Gratis) — ${formatPrice(displayPrice)} COP
                      </option>
                    );
                  })}
                </select>

                {/* OPCIONAL: IMPRESIONES 10x15 */}
                <div className="mt-2.5 p-2.5 rounded-xl bg-stone-950 border border-stone-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs text-stone-200 font-semibold block">
                        Fotos Impresas 10x15 ($7.000 c/u)
                      </span>
                      <span className="text-[10px] text-stone-400">Opcional en físico</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, printedPhotosCount: Math.max(0, p.printedPhotosCount - 1) }))}
                      className="w-7 h-7 bg-stone-800 rounded-lg text-white font-bold hover:bg-stone-700"
                    >
                      -
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-amber-400">
                      {formData.printedPhotosCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, printedPhotosCount: p.printedPhotosCount + 1 }))}
                      className="w-7 h-7 bg-stone-800 rounded-lg text-white font-bold hover:bg-stone-700"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* TARJETA DE PRECIO TOTAL (Limpio y transparente) */}
                <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">
                      Total de la Sesión:
                    </span>
                    <span className="text-xs text-stone-200 font-medium">
                      {currentPackage?.name} (+2 Gratis)
                    </span>
                    {loyaltyDiscount > 0 && (
                      <span className="text-[11px] text-emerald-400 font-semibold block mt-0.5">
                        👑 Descuento VIP Aplicado (-15%)
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-amber-400 font-mono">
                      ${formatPrice(calculatedPrice)}
                    </span>
                    <span className="text-[10px] text-stone-400 block">COP</span>
                  </div>
                </div>
              </div>

              {/* 6. ¿PARA QUIÉN ES LA FOTO O DESCRIPCIÓN? */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>¿Para quién es la sesión o descripción de la foto?</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Ej: Es para un cumpleaños, sesión en la playa con vestido blanco, fotos de pareja, etc."
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* BOTÓN SUBMIT */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-extrabold text-sm py-3.5 rounded-xl shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-300 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Procesando reserva...</span>
                  ) : (
                    <>
                      <Calendar className="w-5 h-5 fill-stone-950" />
                      <span>Confirmar Mi Reserva (${formatPrice(calculatedPrice)} COP)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
