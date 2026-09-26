import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  Calendar, 
  Image as ImageIcon, 
  Settings, 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  Plus, 
  RefreshCw, 
  Copy, 
  ExternalLink, 
  Shield, 
  AlertCircle,
  Eye,
  Trash2,
  Share2,
  Upload,
  UploadCloud,
  FileImage,
  ChevronRight,
  Sparkles,
  Link as LinkIcon,
  Check,
  Key,
  Camera,
  HelpCircle,
  FolderPlus,
  Compass,
  DollarSign,
  LogOut,
  Tag,
  Delete,
  CreditCard,
  TrendingUp,
  BarChart2,
  Crown,
  Bell,
  Volume2,
  Users,
  Edit3,
  PackageCheck,
  DownloadCloud,
  Send,
  X,
  Star,
  Mail,
  FileText,
  Printer,
  ChevronLeft,
  List
} from 'lucide-react';
import { 
  verifyAdminPin, 
  verifyTwoFactorCode,
  generateTwoFactorCode,
  isTrustedDevice,
  saveTrustedDevice,
  forgetTrustedDevice,
  getAdminBookings, 
  updateBookingStatus, 
  updateAdminBooking,
  deleteAdminBooking,
  getAdminSessions, 
  createAdminSession, 
  reopenAdminSession, 
  deleteAdminSession,
  deliverSession,
  updateAdminSettings,
  getSettings,
  getPackages,
  updatePackages,
  getCatalog,
  addCatalogPhoto,
  deleteCatalogPhoto,
  deleteAllSampleCatalogPhotos,
  isSampleItem,
  changeAdminPin,
  recoverAdminPin,
  getAdminPayments,
  updatePaymentStatus,
  formatDateTime12Hour,
  formatPhotoUrl,
  getReviews,
  getWalletBaseBalances,
  fetchCloudWalletBaseBalances,
  saveWalletBaseBalances,
  REAL_DEFAULT_BOOKINGS,
  DEFAULT_PACKAGES,
  DEFAULT_REAL_CATALOG,
  sendEmailNotification
} from '../services/api';
import { supabase } from '../services/supabase';
import { getLocalAnalytics } from '../services/analytics';
import { NequiLogo, DaviPlataLogo, DaleLogo, WalletAccountCard } from './PaymentLogos';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import {
  sendSystemPushNotification,
  requestPushPermission,
  getPushPermissionState,
  playPushNotificationChime,
  flashDocumentTitle
} from '../services/notifications';

// Función para procesar y optimizar fotos de manera ultraligera y segura (ideal para celulares, APK y web)
async function compressImageFile(file, maxWidth = 1280, quality = 0.78) {
  // 1. Intentar con createImageBitmap (Nativo de Android/Chrome: redimensiona en hardware sin saturar RAM)
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      let bitmap;
      try {
        bitmap = await createImageBitmap(file, {
          resizeWidth: maxWidth,
          resizeQuality: 'medium',
          imageOrientation: 'from-image'
        });
      } catch (e) {
        bitmap = await createImageBitmap(file);
      }

      const canvas = document.createElement('canvas');
      let { width, height } = bitmap;
      if (width > maxWidth || height > maxWidth) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(bitmap, 0, 0, width, height);
        if (bitmap.close) bitmap.close();
        return canvas.toDataURL('image/jpeg', quality);
      }
    } catch (errBitmap) {
      console.warn('createImageBitmap no disponible o falló:', errBitmap);
    }
  }

  // 2. Fallback usando URL.createObjectURL (mucho más eficiente que FileReader en móviles)
  return new Promise((resolve, reject) => {
    let blobUrl = null;
    try {
      blobUrl = URL.createObjectURL(file);
    } catch (e) {
      const reader = new FileReader();
      reader.onload = (re) => {
        processImg(re.target.result, null);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const processImg = (src, urlToRevoke) => {
      const img = new Image();
      img.onload = () => {
        if (urlToRevoke) {
          try { URL.revokeObjectURL(urlToRevoke); } catch (e) {}
        }
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          if (src && src.startsWith('data:')) resolve(src);
          else reject(e);
        }
      };
      img.onerror = (err) => {
        if (urlToRevoke) {
          try { URL.revokeObjectURL(urlToRevoke); } catch (e) {}
        }
        if (urlToRevoke) {
          const reader = new FileReader();
          reader.onload = (re) => resolve(re.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        } else {
          reject(err);
        }
      };
      img.src = src;
    };

    processImg(blobUrl, blobUrl);
  });
}

// Chime de audio sintetizado Web Audio API para notificaciones en tiempo real
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.48);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

export default function AdminPanel({ onOpenGalleryToken, onCatalogUpdated, onBackToHome, onLogout, onPackagesUpdated }) {
  // SEGURIDAD ESTRICTA: El panel SIEMPRE inicia 100% bloqueado.
  // Nadie puede entrar sin ingresar la contraseña / PIN correcta (0493).
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Autenticación de Doble Factor (2FA)
  const [isTwoFactorStep, setIsTwoFactorStep] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState(null);
  const [twoFactorInput, setTwoFactorInput] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);

  // Recuperación de PIN
  const [isRecoveringPin, setIsRecoveringPin] = useState(false);
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: ingresar teléfono, 2: ingresar nuevo PIN
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmPin, setRecoveryConfirmPin] = useState('');
  const [recoveryMsg, setRecoveryMsg] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveredPinDisplay, setRecoveredPinDisplay] = useState('');

  // Pestañas
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'payments' | 'reviews' | 'analytics' | 'loyalty' | 'create-session' | 'sessions' | 'catalog-manager' | 'pricing-manager' | 'settings'

  // Saldos base reales de cuentas y filtro de pagos por pasarela
  const [walletBaseBalances, setWalletBaseBalances] = useState(getWalletBaseBalances);
  const [selectedPaymentGateway, setSelectedPaymentGateway] = useState('all'); // 'all' | 'nequi' | 'daviplata' | 'dale'
  const [isAdjustingBalances, setIsAdjustingBalances] = useState(false);
  const [tempBalances, setTempBalances] = useState({ nequi: 0, daviplata: 0, dale: 0 });
  const [reviewsList, setReviewsList] = useState([]);

  // Gestión de Precios
  const [editablePackages, setEditablePackages] = useState(DEFAULT_PACKAGES);
  const [editableSurcharge, setEditableSurcharge] = useState(10000);
  const [editablePrintedPhotoPrice, setEditablePrintedPhotoPrice] = useState(7000);
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [priceSaveSuccess, setPriceSaveSuccess] = useState('');

  // Datos del sistema inicializados con respaldo real para carga instantánea
  const [bookings, setBookings] = useState(REAL_DEFAULT_BOOKINGS);
  const [editingBooking, setEditingBooking] = useState(null);
  const [isSavingBooking, setIsSavingBooking] = useState(false);

  // Modo de visualización de Reservas: Lista tradicional o Calendario Mensual
  const [bookingViewMode, setBookingViewMode] = useState('list'); // 'list' | 'calendar'
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  // Modal de Recibo Digital / Comprobante de Pago
  const [receiptBooking, setReceiptBooking] = useState(null);
  const [receiptType, setReceiptType] = useState('deposit'); // 'deposit' | 'total' | 'custom'
  const [receiptPaidAmount, setReceiptPaidAmount] = useState('');
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState('Nequi');
  const [receiptNotes, setReceiptNotes] = useState('Abono para reserva de fecha y cupo garantizado.');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [receiptWhatsAppLine, setReceiptWhatsAppLine] = useState('line1'); // 'line1' (+57 324 472 5167) | 'line2' (+57 302 369 6513)
  const [payments, setPayments] = useState([]);
  const [copiedWalletKey, setCopiedWalletKey] = useState(null);
  const handleCopyWalletKey = (val, keyName) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(val);
    }
    setCopiedWalletKey(keyName);
    setTimeout(() => setCopiedWalletKey(null), 2500);
  };
  const [analyticsStats, setAnalyticsStats] = useState(getLocalAnalytics());
  const [realtimeAlert, setRealtimeAlert] = useState(null);
  const [viewingVoucherModal, setViewingVoucherModal] = useState(null);
  const [pushPermission, setPushPermission] = useState(() => getPushPermissionState());
  const knownBookingIdsRef = useRef(null);
  const knownPaymentIdsRef = useRef(null);
  const knownSubmittedSessionTokensRef = useRef(null);
  const knownReviewIdsRef = useRef(null);

  useEffect(() => {
    const handlePushChange = () => {
      setPushPermission(getPushPermissionState());
    };
    window.addEventListener('push-permission-changed', handlePushChange);
    window.addEventListener('focus', handlePushChange);
    return () => {
      window.removeEventListener('push-permission-changed', handlePushChange);
      window.removeEventListener('focus', handlePushChange);
    };
  }, []);

  const handleEnablePush = async () => {
    // Desbloquear contexto de audio con interacción del usuario
    playPushNotificationChime('booking');
    const res = await requestPushPermission();
    setPushPermission(res);
    if (res === 'granted' || (typeof window !== 'undefined' && window.AndroidNotificationBridge)) {
      setPushPermission('granted');
      await sendSystemPushNotification({
        title: '🔔 ¡Notificaciones Push Activas!',
        body: 'Listo Sebastian G. Las alertas de reservas y pagos sonarán al instante como en WhatsApp.',
        tag: 'test-push-granted',
        data: { type: 'booking' }
      });
    }
  };

  const handleTestPush = async () => {
    const testWhatsApp = 'https://wa.me/573244725167';
    await sendSystemPushNotification({
      title: '📸 ¡Prueba de Reserva en Tiempo Real!',
      body: 'Camila acaba de reservar: 8 Fotos Digitales (+ 2 Fotos Gratis) para el 28 de Septiembre.\n📍 Playa Blanca, San Antero ($75.000 COP)',
      tag: 'test-push-sample',
      data: { type: 'booking' },
      whatsappUrl: testWhatsApp
    });
    setRealtimeAlert({
      type: 'booking',
      bookingId: 'test-sample-id',
      clientName: 'Camila (Prueba en Vivo)',
      packageName: '8 Fotos Digitales (+ 2 Fotos Gratis)',
      dateTime: '28 de Septiembre a las 4:00 p. m.',
      location: 'Playa Blanca, San Antero',
      totalPrice: 75000,
      whatsappUrl: testWhatsApp,
      targetTab: 'bookings'
    });
    setTimeout(() => setRealtimeAlert(null), 12000);
  };
  const [sessions, setSessions] = useState([]);
  const [catalog, setCatalog] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('sebastian_g_catalog_v1');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {}
    return DEFAULT_REAL_CATALOG;
  });
  const [settings, setSettings] = useState({
    photographerName: 'Sebastian G',
    photographerWhatsApp: '+573244725167',
    photographerWhatsApp2: '+573023696513',
    outOfSanAnteroSurcharge: 10000,
    watermarkText: 'SEBASTIAN G',
    watermarkSubtext: 'MUESTRA EXCLUSIVA • PROHIBIDA SU DESCARGA'
  });
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [loadingData, setLoadingData] = useState(false);

  // Formulario Crear Sesión
  const [newSessionForm, setNewSessionForm] = useState({
    clientName: '',
    clientWhatsApp: '',
    packageId: '',
    packageTitle: '8 Fotos Digitales (+ 2 Fotos Gratis)',
    maxPhotosAllowed: 10,
    photoUrlsText: ''
  });

  // Fotos cargadas para cliente
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [createdSessionResult, setCreatedSessionResult] = useState(null);
  const [useUrlMode, setUseUrlMode] = useState(false);

  const fileInputRef = useRef(null);

  // Formulario Agregar Foto al Catálogo Público (Soporte Dual: Archivo local y Enlace URL)
  const [catalogUploadMode, setCatalogUploadMode] = useState('file'); // 'file' | 'link'
  const [catalogLinkInput, setCatalogLinkInput] = useState('');
  const [newCatalogForm, setNewCatalogForm] = useState({
    title: '',
    category: 'Playas San Antero',
    customCategory: '',
    location: 'Playa Blanca, San Antero',
    url: ''
  });
  const [isUploadingCatalogPhoto, setIsUploadingCatalogPhoto] = useState(false);
  const [catalogUploadSuccess, setCatalogUploadSuccess] = useState('');
  const [purgeSamplesLoading, setPurgeSamplesLoading] = useState(false);
  const [purgeSamplesSuccess, setPurgeSamplesSuccess] = useState('');
  const catalogFileInputRef = useRef(null);

  // Cambio de PIN dentro del Panel
  const [pinChangeForm, setPinChangeForm] = useState({
    currentPin: '',
    newPin: '',
    confirmPin: ''
  });
  const [pinChangeMsg, setPinChangeMsg] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');

  // Modal ver selecciones de cliente
  const [viewingSession, setViewingSession] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modal y formulario de Entrega de Fotos Finales en Calidad Original (Full HD / WeTransfer)
  const [deliveringSession, setDeliveringSession] = useState(null);
  const [deliveryForm, setDeliveryForm] = useState({
    finalDeliveryUrl: '',
    deliveryService: 'wetransfer',
    deliveryNotes: ''
  });
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [deliverySuccessMsg, setDeliverySuccessMsg] = useState('');
  const [deliveryWhatsAppLine, setDeliveryWhatsAppLine] = useState('line1'); // 'line1' (+57 324 472 5167) | 'line2' (+57 302 369 6513)

  // Modal y confirmación de reserva por WhatsApp al cliente
  const [confirmingBooking, setConfirmingBooking] = useState(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [confirmSuccessMsg, setConfirmSuccessMsg] = useState('');
  const [isConfirmingBookingStatus, setIsConfirmingBookingStatus] = useState(false);

  // Instalación nativa PWA en Android exclusiva para el fotógrafo
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && window.deferredInstallPrompt) {
      setCanInstallPwa(true);
    }
    const handleInstallable = () => setCanInstallPwa(true);
    window.addEventListener('pwa-installable', handleInstallable);
    return () => window.removeEventListener('pwa-installable', handleInstallable);
  }, []);

  const handleInstallClick = async () => {
    if (typeof window !== 'undefined' && window.deferredInstallPrompt) {
      window.deferredInstallPrompt.prompt();
      const choice = await window.deferredInstallPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        window.deferredInstallPrompt = null;
        setCanInstallPwa(false);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const detectDeliveryService = (url) => {
    if (!url) return 'wetransfer';
    const lower = url.toLowerCase();
    if (lower.includes('we.tl') || lower.includes('wetransfer.com')) return 'wetransfer';
    if (lower.includes('drive.google.com')) return 'drive';
    if (lower.includes('dropbox.com')) return 'dropbox';
    if (lower.includes('1drv.ms') || lower.includes('onedrive')) return 'onedrive';
    return 'direct';
  };

  const handleOpenDelivery = (session) => {
    setDeliveringSession(session);
    const existingUrl = session.finalDeliveryUrl || '';
    setDeliveryForm({
      finalDeliveryUrl: existingUrl,
      deliveryService: session.deliveryService || detectDeliveryService(existingUrl),
      deliveryNotes: session.deliveryNotes || 'Todas tus fotografías seleccionadas han sido editadas y preparadas en máxima resolución Full HD original.'
    });
    setDeliverySuccessMsg(session.status === 'delivered' ? 'Esta sesión ya tiene una entrega registrada. Puedes actualizarla o re-enviar el enlace por WhatsApp.' : '');
  };

  const handleSubmitDelivery = async (e) => {
    e.preventDefault();
    if (!deliveringSession || !deliveryForm.finalDeliveryUrl) return;
    setIsSubmittingDelivery(true);
    setDeliverySuccessMsg('');
    try {
      if (String(deliveringSession.id).startsWith('book-')) {
        const bookingId = String(deliveringSession.id).replace('book-', '');
        await updateAdminBooking(bookingId, {
          finalDeliveryUrl: deliveryForm.finalDeliveryUrl,
          deliveryService: deliveryForm.deliveryService,
          deliveryNotes: deliveryForm.deliveryNotes,
          status: 'completed'
        });
      } else {
        await deliverSession(deliveringSession.id || deliveringSession.token, {
          finalDeliveryUrl: deliveryForm.finalDeliveryUrl,
          deliveryService: deliveryForm.deliveryService,
          deliveryNotes: deliveryForm.deliveryNotes
        });
      }
      setDeliveringSession(prev => ({
        ...prev,
        status: 'delivered',
        finalDeliveryUrl: deliveryForm.finalDeliveryUrl,
        deliveryService: deliveryForm.deliveryService,
        deliveryNotes: deliveryForm.deliveryNotes,
        deliveredAt: new Date().toISOString()
      }));
      setDeliverySuccessMsg('✓ ¡Entrega guardada con éxito! Ahora puedes enviarle el enlace por WhatsApp al cliente.');
      loadAllAdminData();
    } catch (err) {
      console.error(err);
      alert('Error al guardar la entrega.');
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  const getDeliveryWhatsAppUrl = (session, customUrl, customNotes, customService, chosenLine = 'line1') => {
    if (!session) return '#';
    let cleanPhone = (session.clientWhatsApp || '').replace(/\D/g, '');
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('57')) {
      cleanPhone = '57' + cleanPhone;
    }
    const url = customUrl || session.finalDeliveryUrl || '';
    const serviceNames = {
      wetransfer: 'WeTransfer (Archivos Originales Sin Compresión)',
      drive: 'Google Drive (Máxima Resolución Full HD)',
      dropbox: 'Dropbox (Alta Definición)',
      onedrive: 'OneDrive (Alta Calidad)',
      direct: 'Enlace de Descarga Directa Full HD'
    };
    const sType = customService || session.deliveryService || detectDeliveryService(url);
    const serviceName = serviceNames[sType] || 'WeTransfer (Archivos Originales Sin Compresión)';

    // Extraer el primer nombre limpio con inicial en mayúscula para trato personal (ej: "Jennifer")
    const rawName = (session.clientName || 'Cliente').trim();
    const firstName = rawName.split(' ')[0] || rawName;
    const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

    const activeNote = (customNotes !== undefined ? customNotes : session.deliveryNotes) ||
      'Todas tus fotografías seleccionadas han sido editadas y preparadas en máxima resolución Full HD original.';

    const lineDisplay = chosenLine === 'line2'
      ? '+57 302 369 6513 (Línea 2)'
      : '+57 324 472 5167 (Línea 1)';

    const text = encodeURIComponent(
      `📸 *¡Hola ${formattedFirstName}! Tus fotos profesionales con Sebastian G están listas en Calidad Original Full HD.* ✨\n\n` +
      `Hemos finalizado la edición y retoque profesional de tus fotografías seleccionadas. Para que no pierdan resolución ni calidad (evitando la compresión de WhatsApp), puedes descargarlas en su tamaño original aquí:\n\n` +
      `📥 *Enlace de Descarga Original:* ${url}\n` +
      `📦 *Servicio de Descarga:* ${serviceName}\n\n` +
      `📝 *Nota del Fotógrafo:* ${activeNote}\n\n` +
      `💡 *Consejo:* Te recomiendo descargarlas y guardarlas en tu computador o celular antes de que venza el enlace para conservarlas siempre en su máxima nitidez.\n\n` +
      `📞 *Contacto Fotógrafo:* Sebastian G • ${lineDisplay}\n\n` +
      `¡Fue un placer capturar tus mejores momentos! Cualquier duda estoy a tu entera disposición. ♡`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  const handleVerifyPinSubmit = async (pinToVerify) => {
    setAuthError('');
    try {
      const res = await verifyAdminPin(pinToVerify);
      if (res.requires2FA) {
        setTwoFactorData(res);
        setIsTwoFactorStep(true);
        setTwoFactorInput('');
        setTwoFactorError('');
      } else {
        setIsAuthenticated(true);
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          try {
            Notification.requestPermission();
          } catch (err) {}
        }
        loadAllAdminData();
      }
    } catch (err) {
      setAuthError('PIN incorrecto. Si lo olvidaste, usa la opción de recuperación abajo.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    handleVerifyPinSubmit(pinInput);
  };

  const handleVerify2FASubmit = (e) => {
    if (e) e.preventDefault();
    setTwoFactorError('');
    const cleanCode = String(twoFactorInput || '').trim();
    if (cleanCode.length !== 6) {
      setTwoFactorError('Por favor ingresa el código completo de 6 dígitos.');
      return;
    }
    setIsVerifying2FA(true);
    try {
      verifyTwoFactorCode(cleanCode, rememberDevice);
      setIsAuthenticated(true);
      setIsTwoFactorStep(false);
      setPinInput('');
      setTwoFactorInput('');
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        try {
          Notification.requestPermission();
        } catch (err) {}
      }
      loadAllAdminData();
    } catch (err) {
      setTwoFactorError(err.message || 'Código de seguridad incorrecto.');
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleResend2FACode = () => {
    try {
      const fresh = generateTwoFactorCode();
      setTwoFactorData(fresh);
      setTwoFactorInput('');
      setTwoFactorError('✓ Se ha generado y enviado un nuevo código de 6 dígitos.');
    } catch (err) {
      setTwoFactorError('Error al reenviar código.');
    }
  };

  const handleBackToPin = () => {
    setIsTwoFactorStep(false);
    setPinInput('');
    setTwoFactorInput('');
    setTwoFactorError('');
    setAuthError('');
  };

  const handleStartRecovery = (e) => {
    e.preventDefault();
    setIsRecoveringPin(true);
    setRecoveryStep(1);
    setRecoveryError('');
    setRecoveryMsg('');
    setRecoveryPhone('');
    setRecoveryNewPin('');
    setRecoveryConfirmPin('');
  };

  const handleVerifyPhoneForRecovery = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryMsg('');
    try {
      const res = await recoverAdminPin(recoveryPhone);
      setRecoveryStep(2);
      setRecoveredPinDisplay(res.currentPin || '');
      setRecoveryMsg('✓ Número verificado exitosamente. Ahora escribe tu nuevo PIN de acceso.');
    } catch (err) {
      setRecoveryError(err.message || 'El número ingresado no coincide con las líneas registradas (324 4725167 o 302 369 6513).');
    }
  };

  const handleResetPinSubmit = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryMsg('');

    if (recoveryNewPin.length < 4) {
      setRecoveryError('El nuevo PIN debe tener al menos 4 números.');
      return;
    }

    if (recoveryNewPin !== recoveryConfirmPin) {
      setRecoveryError('Los dos PIN ingresados no coinciden.');
      return;
    }

    try {
      await recoverAdminPin(recoveryPhone, recoveryNewPin);
      setRecoveryMsg('¡PIN actualizado con éxito! Ya puedes iniciar sesión con tu nuevo PIN.');
      setTimeout(() => {
        setIsRecoveringPin(false);
        setPinInput(recoveryNewPin);
      }, 2000);
    } catch (err) {
      setRecoveryError(err.message || 'Error al actualizar PIN');
    }
  };

  const loadAllAdminData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingData(true);
      const [bRes, sRes, setRes, pRes, cRes, payRes, revRes, cloudBalRes] = await Promise.allSettled([
        getAdminBookings(),
        getAdminSessions(),
        getSettings(),
        getPackages(),
        getCatalog(),
        getAdminPayments(),
        getReviews(),
        fetchCloudWalletBaseBalances()
      ]);

      const areArraysEqual = (a, b) => {
        if (a === b) return true;
        if (!a || !b || a.length !== b.length) return false;
        try {
          return JSON.stringify(a) === JSON.stringify(b);
        } catch (e) {
          return false;
        }
      };

      const bData = bRes.status === 'fulfilled' && Array.isArray(bRes.value) && bRes.value.length > 0 
        ? bRes.value 
        : REAL_DEFAULT_BOOKINGS;
      setBookings(prev => areArraysEqual(prev, bData) ? prev : bData);

      const rawSessions = sRes.status === 'fulfilled' && Array.isArray(sRes.value) ? sRes.value : [];
      const cleanSessions = rawSessions.filter(
        s => s && s.id !== 'sess-demo' && s.token !== 'demo-cliente-2026'
      );
      setSessions(prev => areArraysEqual(prev, cleanSessions) ? prev : cleanSessions);

      const setData = setRes.status === 'fulfilled' && setRes.value ? setRes.value : null;
      if (setData) {
        setSettings(setData);
        setEditablePrintedPhotoPrice(setData.printedPhotoPrice || 7000);
        setEditableSurcharge(setData.outOfSanAnteroSurcharge || 10000);
      }

      const pData = pRes.status === 'fulfilled' && Array.isArray(pRes.value) && pRes.value.length > 0 
        ? pRes.value 
        : DEFAULT_PACKAGES;
      setPackages(prev => areArraysEqual(prev, pData) ? prev : pData);
      setEditablePackages(prev => areArraysEqual(prev, pData) ? prev : pData);
      if (!newSessionForm.packageId) {
        const defaultPkg = pData.find(p => p.photoCount === 8) || pData[0];
        setNewSessionForm(prev => ({
          ...prev,
          packageId: defaultPkg.id,
          packageTitle: `${defaultPkg.name} (+ 2 Fotos Gratis)`,
          maxPhotosAllowed: defaultPkg.totalPhotos || 10
        }));
      }

      const cData = cRes.status === 'fulfilled' && Array.isArray(cRes.value) && cRes.value.length > 0
        ? cRes.value
        : DEFAULT_REAL_CATALOG;
      setCatalog(prev => areArraysEqual(prev, cData) ? prev : cData);

      const payData = payRes.status === 'fulfilled' && Array.isArray(payRes.value) ? payRes.value : [];
      setPayments(prev => areArraysEqual(prev, payData) ? prev : payData);

      const revData = revRes.status === 'fulfilled' && Array.isArray(revRes.value) ? revRes.value : [];
      setReviewsList(prev => areArraysEqual(prev, revData) ? prev : revData);

      const cloudBal = cloudBalRes && cloudBalRes.status === 'fulfilled' && cloudBalRes.value ? cloudBalRes.value : getWalletBaseBalances();
      setWalletBaseBalances(prev => areArraysEqual(prev, cloudBal) ? prev : cloudBal);

      setAnalyticsStats(getLocalAnalytics());

      // Detección exacta de nuevas reservas en tiempo real (por ID único para evitar falsos positivos)
      if (knownBookingIdsRef.current !== null) {
        const freshBookings = bData.filter(b => b?.id && !knownBookingIdsRef.current.has(b.id));
        if (freshBookings.length > 0) {
          const latest = freshBookings[0];
          let cleanPhone = (latest.clientWhatsApp || '').replace(/\D/g, '');
          if (cleanPhone.length === 10 && !cleanPhone.startsWith('57')) cleanPhone = '57' + cleanPhone;
          const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

          sendSystemPushNotification({
            title: `📸 ¡Nueva Reserva: ${latest.clientName || 'Cliente'}!`,
            body: `${latest.packageName || 'Sesión Fotográfica'} para el ${formatDateTime12Hour(latest.dateTime) || 'próximamente'}.\n📍 ${latest.specificLocation || 'San Antero'} ($${Number(latest.totalPrice || 0).toLocaleString('es-CO')} COP)`,
            tag: `booking-${latest.id}`,
            data: { type: 'booking', targetTab: 'bookings', bookingId: latest.id },
            whatsappUrl: waUrl
          });

          setRealtimeAlert({
            type: 'booking',
            clientName: latest.clientName || 'Un cliente',
            packageName: latest.packageName || 'Sesión Fotográfica',
            dateTime: formatDateTime12Hour(latest.dateTime) || 'Próximamente',
            location: latest.specificLocation || 'San Antero',
            totalPrice: latest.totalPrice,
            whatsappUrl: waUrl,
            targetTab: 'bookings'
          });
          setTimeout(() => setRealtimeAlert(null), 14000);
        }
      }
      knownBookingIdsRef.current = new Set(bData.map(b => b?.id).filter(Boolean));

      // Detección exacta de nuevos pagos en tiempo real (por ID)
      if (knownPaymentIdsRef.current !== null && Array.isArray(payData)) {
        const freshPayments = payData.filter(p => p?.id && !knownPaymentIdsRef.current.has(p.id));
        if (freshPayments.length > 0) {
          const latestPay = freshPayments[0];
          let cleanPhone = (latestPay.clientWhatsApp || '').replace(/\D/g, '');
          if (cleanPhone.length === 10 && !cleanPhone.startsWith('57')) cleanPhone = '57' + cleanPhone;
          const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

          sendSystemPushNotification({
            title: `💰 ¡Nuevo Pago: ${latestPay.clientName || 'Cliente'}!`,
            body: `Pagó $${Number(latestPay.amount || 0).toLocaleString('es-CO')} COP vía ${latestPay.method?.toUpperCase() || 'transferencia'}. Comprobante disponible para verificar.`,
            tag: `payment-${latestPay.id}`,
            data: { type: 'payment', targetTab: 'payments', paymentId: latestPay.id },
            whatsappUrl: waUrl
          });

          setRealtimeAlert({
            type: 'payment',
            clientName: latestPay.clientName || 'Un cliente',
            amount: latestPay.amount,
            method: latestPay.method,
            whatsappUrl: waUrl,
            targetTab: 'payments'
          });
          setTimeout(() => setRealtimeAlert(null), 14000);
        }
      }
      knownPaymentIdsRef.current = new Set((payData || []).map(p => p?.id).filter(Boolean));

      // Detección exacta de selección de fotos lista por parte del cliente
      if (knownSubmittedSessionTokensRef.current !== null && Array.isArray(cleanSessions)) {
        const freshSubmitted = cleanSessions.filter(
          s => s?.token && s.status === 'submitted' && !knownSubmittedSessionTokensRef.current.has(s.token)
        );
        if (freshSubmitted.length > 0) {
          const latestSess = freshSubmitted[0];
          const count = latestSess.selectedCount || (latestSess.photos ? latestSess.photos.filter(p => p.selected).length : 0);
          let cleanPhone = (latestSess.clientWhatsApp || '').replace(/\D/g, '');
          if (cleanPhone.length === 10 && !cleanPhone.startsWith('57')) cleanPhone = '57' + cleanPhone;
          const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

          sendSystemPushNotification({
            title: `🖼️ ¡Selección Lista: ${latestSess.clientName || 'Cliente'}!`,
            body: `El cliente eligió sus ${count} fotos para edición. ¡Lista para procesar!`,
            tag: `session-${latestSess.token}`,
            data: { type: 'session', targetTab: 'sessions', token: latestSess.token },
            whatsappUrl: waUrl
          });

          setRealtimeAlert({
            type: 'session',
            clientName: latestSess.clientName || 'Cliente',
            packageName: `${latestSess.packageTitle || 'Sesión'} (${count} fotos)`,
            whatsappUrl: waUrl,
            targetTab: 'sessions'
          });
          setTimeout(() => setRealtimeAlert(null), 14000);
        }
      }
      knownSubmittedSessionTokensRef.current = new Set(
        (cleanSessions || []).filter(s => s?.token && s.status === 'submitted').map(s => s.token)
      );

      // Detección exacta de nuevas calificaciones y reseñas en tiempo real
      if (knownReviewIdsRef.current !== null && Array.isArray(revData)) {
        const freshReviews = revData.filter(r => r?.id && !knownReviewIdsRef.current.has(r.id));
        if (freshReviews.length > 0) {
          const latestRev = freshReviews[0];
          sendSystemPushNotification({
            title: `⭐ ¡Nueva Calificación: ${latestRev.clientName || 'Cliente'}!`,
            body: `Calificó con ${latestRev.rating || 5} estrellas ★: "${latestRev.comment || 'Excelente servicio'}"`,
            tag: `review-${latestRev.id}`,
            data: { type: 'review', targetTab: 'reviews', reviewId: latestRev.id }
          });

          setRealtimeAlert({
            type: 'review',
            clientName: latestRev.clientName || 'Cliente',
            packageName: `Calificación: ${latestRev.rating || 5} Estrellas ★★★★★`,
            comment: latestRev.comment || '',
            targetTab: 'reviews'
          });
          setTimeout(() => setRealtimeAlert(null), 14000);
        }
      }
      knownReviewIdsRef.current = new Set((revData || []).map(r => r?.id).filter(Boolean));
    } catch (err) {
      console.error('Error cargando datos de administración:', err);
    } finally {
      if (!isSilent) setLoadingData(false);
    }
  };

  // Limpieza estricta de seguridad: nunca dejar credenciales persistidas que puedan abrir el panel automáticamente
  useEffect(() => {
    try {
      localStorage.removeItem('sebastian_g_admin_pin');
      sessionStorage.removeItem('sebastian_g_admin_session_token');
    } catch (e) {}
  }, []);

  // Sincronización continua en tiempo real (Web <-> APK Android, WebSocket + Heartbeat 2.5s + BroadcastChannel + Instant Wakeup)
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Carga inicial de datos
    loadAllAdminData();

    // 2. Exponer método global para que el WebView nativo de Android o eventos externos fuercen sincronización instantánea (0ms)
    window.forceRealtimeAdminSync = () => {
      loadAllAdminData(true);
    };

    let debounceTimer = null;
    const triggerSilentRefresh = (delay = 100) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadAllAdminData(true);
      }, delay);
    };

    // 3. Canal Supabase Realtime (WebSocket bidireccional permanente para reservas, pagos, catálogo, sesiones y saldos)
    const channel = supabase
      .channel('admin_all_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog' }, () => {
        triggerSilentRefresh(80);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadAllAdminData(true);
        }
      });

    // 4. Canales locales BroadcastChannel para sincronización 0ms entre pestañas y ventanas
    let bcCatalog, bcBookings, bcPayments, bcReviews, bcWallets;
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        bcCatalog = new BroadcastChannel('catalog_realtime_sync');
        bcCatalog.onmessage = () => triggerSilentRefresh(40);

        bcBookings = new BroadcastChannel('bookings_realtime_sync');
        bcBookings.onmessage = () => triggerSilentRefresh(40);

        bcPayments = new BroadcastChannel('payments_realtime_sync');
        bcPayments.onmessage = () => triggerSilentRefresh(40);

        bcReviews = new BroadcastChannel('reviews_realtime_sync');
        bcReviews.onmessage = () => triggerSilentRefresh(40);

        bcWallets = new BroadcastChannel('wallet_balances_sync');
        bcWallets.onmessage = () => {
          fetchCloudWalletBaseBalances().then(b => setWalletBaseBalances(b));
        };
      }
    } catch (e) {}

    const handleStorage = (e) => {
      if (e.key === 'sebastian_g_catalog_last_sync' || e.key === 'sebastian_g_catalog_v1' ||
          e.key === 'sebastian_g_bookings_last_sync' || e.key === 'sebastian_g_bookings_v1' ||
          e.key === 'sebastian_g_payments_last_sync' || e.key === 'sebastian_g_payments_v1' ||
          e.key === 'sebastian_g_reviews_last_sync' || e.key === 'sebastian_g_reviews_v1') {
        triggerSilentRefresh(40);
      }
      if (e.key === 'sebastian_g_wallet_base_balances_v1') {
        fetchCloudWalletBaseBalances().then(b => setWalletBaseBalances(b));
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleSwitchTab = (e) => {
      if (e.detail && e.detail.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener('admin-switch-tab', handleSwitchTab);

    let swMessageListener = null;
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      swMessageListener = (event) => {
        if (event.data?.type === 'NAVIGATE_TAB' && event.data.tab) {
          setActiveTab(event.data.tab);
        }
      };
      navigator.serviceWorker.addEventListener('message', swMessageListener);
    }

    // 5. Latido activo en tiempo real cada 2.5 segundos:
    // Garantiza que la APK en celular y el navegador en PC nunca queden desfasados,
    // incluso si la red móvil duerme WebSockets en segundo plano
    const heartbeatInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadAllAdminData(true);
      }
    }, 2500);

    // 6. Despertar instantáneo al volver a la APK o pestaña (0 milisegundos de retardo)
    const handleInstantWakeup = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadAllAdminData(true);
      }
    };
    document.addEventListener('visibilitychange', handleInstantWakeup);
    window.addEventListener('focus', handleInstantWakeup);
    window.addEventListener('online', handleInstantWakeup);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleInstantWakeup);
      window.removeEventListener('focus', handleInstantWakeup);
      window.removeEventListener('online', handleInstantWakeup);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('admin-switch-tab', handleSwitchTab);
      supabase.removeChannel(channel);
      if (bcCatalog) bcCatalog.close();
      if (bcBookings) bcBookings.close();
      if (bcPayments) bcPayments.close();
      if (bcReviews) bcReviews.close();
      if (bcWallets) bcWallets.close();
      if (swMessageListener && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', swMessageListener);
      }
      try {
        delete window.forceRealtimeAdminSync;
      } catch (e) {}
    };
  }, [isAuthenticated]);

  // Handlers para edición de precios y fotos
  const handlePackagePriceChange = (pkgId, newPrice) => {
    setEditablePackages(prev => prev.map(p => {
      if (p.id === pkgId) {
        return { ...p, price: Number(newPrice) || 0 };
      }
      return p;
    }));
  };

  const handlePackagePhotoCountChange = (pkgId, newCount) => {
    setEditablePackages(prev => prev.map(p => {
      if (p.id === pkgId) {
        const count = Number(newCount) || 1;
        return { ...p, photoCount: count, totalPhotos: count + 2 };
      }
      return p;
    }));
  };

  const handleSaveAllPrices = async (e) => {
    if (e) e.preventDefault();
    try {
      setIsSavingPrices(true);
      setPriceSaveSuccess('');

      // Guardar paquetes
      const updatedPkgs = await updatePackages(editablePackages);
      setPackages(updatedPkgs);
      if (onPackagesUpdated) onPackagesUpdated(updatedPkgs);

      // Guardar ajustes de recargo y fotos impresas
      const updatedSettings = await updateAdminSettings({
        ...settings,
        printedPhotoPrice: Number(editablePrintedPhotoPrice),
        outOfSanAnteroSurcharge: Number(editableSurcharge)
      });
      setSettings(updatedSettings);

      setPriceSaveSuccess('¡Precios actualizados exitosamente! Ya están activos en toda la web y reservas.');
      setTimeout(() => setPriceSaveSuccess(''), 4000);
    } catch (err) {
      alert('Error al guardar precios: ' + err.message);
    } finally {
      setIsSavingPrices(false);
    }
  };

  const handleLogout = () => {
    if (confirm('¿Deseas cerrar la sesión del panel?')) {
      setIsAuthenticated(false);
      setPinInput('');
      if (onLogout) onLogout();
    }
  };

  const getBookingConfirmationWhatsAppUrl = (b, customNotes = '') => {
    if (!b) return '#';
    let cleanPhone = (b.clientWhatsApp || '').replace(/\D/g, '');
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('57')) {
      cleanPhone = '57' + cleanPhone;
    }
    const rawName = (b.clientName || 'Cliente').trim();
    const firstName = rawName.split(' ')[0] || rawName;
    const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    const isOutside = b.locationType === 'outside_san_antero' || b.locationType === 'outside';
    const loc = b.specificLocation || (isOutside ? 'Locación Especial / Fuera' : 'San Antero');

    const text = encodeURIComponent(
      `📸 *¡Hola ${formattedFirstName}! Te saluda Sebastian G.* ✨\n\n` +
      `¡Excelente noticia! Te confirmo con mucho gusto tu *Sesión Fotográfica Profesional* para el día que reservaste:\n\n` +
      `🗓️ *Fecha y Hora:* ${formatDateTime12Hour(b.dateTime)}\n` +
      `📦 *Paquete Confirmado:* ${b.packageName || 'Sesión Fotográfica'}\n` +
      `💵 *Valor Total:* $${Number(b.totalPrice || 0).toLocaleString('es-CO')} COP\n` +
      `📍 *Locación:* ${loc}\n\n` +
      (customNotes && customNotes.trim() ? `📝 *Nota del Fotógrafo:* ${customNotes.trim()}\n\n` : '') +
      `Ya tengo agendado tu espacio de manera exclusiva en mi calendario de trabajo. ✨\n\n` +
      `💡 *Recomendaciones para el día de tu sesión:*\n` +
      `• Te sugiero llegar con 10 o 15 minutos de anticipación.\n` +
      `• Trae tus cambios de vestuario y la mejor energía para tus fotos.\n\n` +
      `¡Será un verdadero placer capturar tus mejores momentos frente al lente! Si tienes cualquier inquietud sobre vestuarios, poses o detalles, puedes responderme directamente por aquí. 📸`
    );

    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  const handleOpenConfirmBookingModal = (booking) => {
    setConfirmingBooking(booking);
    setConfirmNote('');
    setConfirmSuccessMsg('');
  };

  const handleSendBookingConfirmation = async (e) => {
    if (e) e.preventDefault();
    if (!confirmingBooking) return;
    setIsConfirmingBookingStatus(true);
    try {
      // 1. Asegurar que el estado quede como 'confirmed' en Supabase y localmente
      if (confirmingBooking.status !== 'confirmed') {
        await updateBookingStatus(confirmingBooking.id, 'confirmed');
        setBookings(prev => prev.map(b => b.id === confirmingBooking.id ? { ...b, status: 'confirmed' } : b));
      }
      // 2. Si el cliente suministró correo, enviar comprobante formal por email
      if (confirmingBooking.clientEmail && confirmingBooking.clientEmail.includes('@')) {
        sendEmailNotification({
          type: 'booking_confirmation',
          data: {
            booking: confirmingBooking,
            customNotes: confirmNote
          }
        }).catch(err => console.error('Error enviando correo de confirmación:', err));
      }

      // 3. Generar URL de WhatsApp y abrirla
      const url = getBookingConfirmationWhatsAppUrl(confirmingBooking, confirmNote);
      setConfirmSuccessMsg(
        confirmingBooking.clientEmail
          ? `✓ ¡Reserva confirmada! Correo enviado a ${confirmingBooking.clientEmail} y abriendo WhatsApp...`
          : `✓ ¡Reserva confirmada! Abriendo WhatsApp para enviar mensaje a ${confirmingBooking.clientName}...`
      );

      const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = url;
      } else {
        const win = window.open(url, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
          window.location.href = url;
        }
      }

      setTimeout(() => {
        setConfirmingBooking(null);
        setConfirmSuccessMsg('');
      }, 3500);
    } catch (err) {
      alert('Error al confirmar reserva: ' + err.message);
    } finally {
      setIsConfirmingBookingStatus(false);
    }
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await updateBookingStatus(bookingId, newStatus);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      if (newStatus === 'confirmed') {
        const b = bookings.find(item => item.id === bookingId);
        if (b) {
          handleOpenConfirmBookingModal(b);
        }
      }
    } catch (err) {
      alert('Error al actualizar estado');
    }
  };

  const handleSaveBookingEdit = async (e) => {
    if (e) e.preventDefault();
    if (!editingBooking) return;
    try {
      setIsSavingBooking(true);
      await updateAdminBooking(editingBooking.id, editingBooking);
      setBookings(prev => prev.map(b => b.id === editingBooking.id ? { ...editingBooking } : b));
      setEditingBooking(null);
    } catch (err) {
      alert('Error al guardar cambios de la reserva: ' + err.message);
    } finally {
      setIsSavingBooking(false);
    }
  };

  const handleDeleteBooking = async (bookingId, clientName) => {
    if (confirm(`¿Estás seguro de que deseas eliminar la reserva de "${clientName}"? Esta acción no se puede deshacer.`)) {
      try {
        await deleteAdminBooking(bookingId);
        setBookings(prev => prev.filter(b => b.id !== bookingId));
      } catch (err) {
        alert('Error al eliminar reserva: ' + err.message);
      }
    }
  };

  // 1. Parseo seguro de fechas de reservas para el Calendario
  const parseBookingDate = (dateTimeStr) => {
    if (!dateTimeStr) return null;
    const str = String(dateTimeStr).trim();
    // Formato DD/MM/YYYY (ej: "28/09/2026")
    const ddmmyyyyMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
      const year = parseInt(ddmmyyyyMatch[3], 10);
      return new Date(year, month, day);
    }
    // Formato YYYY-MM-DD
    const yyyymmddMatch = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (yyyymmddMatch) {
      const year = parseInt(yyyymmddMatch[1], 10);
      const month = parseInt(yyyymmddMatch[2], 10) - 1;
      const day = parseInt(yyyymmddMatch[3], 10);
      return new Date(year, month, day);
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;
    return null;
  };

  // 2. Generador de enlace directo a Google Calendar (1 clic en Android y Web)
  const getGoogleCalendarUrl = (booking) => {
    const d = parseBookingDate(booking.dateTime);
    if (!d) return '#';
    let hour = 16;
    let minute = 0;
    const timeMatch = (booking.dateTime || '').match(/(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const ampm = (timeMatch[3] || '').toLowerCase().replace(/\./g, '').trim();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      hour = h;
      minute = m;
    }
    const pad = (n) => String(n).padStart(2, '0');
    const startYear = d.getFullYear();
    const startMonth = pad(d.getMonth() + 1);
    const startDay = pad(d.getDate());
    const startHour = pad(hour);
    const startMin = pad(minute);

    let endHourNum = hour + 1;
    let endMinNum = minute + 30;
    if (endMinNum >= 60) {
      endHourNum += 1;
      endMinNum -= 60;
    }
    const endHour = pad(endHourNum % 24);
    const endMin = pad(endMinNum);

    const startIso = `${startYear}${startMonth}${startDay}T${startHour}${startMin}00`;
    const endIso = `${startYear}${startMonth}${startDay}T${endHour}${endMin}00`;

    const title = `📸 Sesión Fotográfica • ${booking.clientName}`;
    const details = `Cliente: ${booking.clientName}\nWhatsApp: ${booking.clientWhatsApp || 'N/A'}\nPaquete: ${booking.packageName}\nPrecio: $${Number(booking.totalPrice).toLocaleString('es-CO')} COP\nNotas: ${booking.description || 'Sin notas adicionales'}\n\nAgendado desde Sebastian G (sebastiang.app)`;
    const loc = booking.specificLocation || 'Playa Blanca, San Antero, Córdoba';

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(loc)}`;
  };

  // 3. Recordatorio inteligente a 24 Horas de la Sesión vía WhatsApp con locación dinámica
  const handleSendReminder = (booking) => {
    let clientPhone = (booking.clientWhatsApp || '').replace(/\D/g, '');
    if (clientPhone.length === 10 && !clientPhone.startsWith('57')) {
      clientPhone = '57' + clientPhone;
    }
    const dateFormatted = formatDateTime12Hour(booking.dateTime);
    const loc = booking.specificLocation || (booking.locationType === 'outside' ? 'tu locación seleccionada' : 'San Antero');
    const rawName = (booking.clientName || 'Cliente').trim();
    const firstName = rawName.split(' ')[0] || rawName;
    const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

    const text = 
      `¡Hola ${formattedFirstName}! 👋 Te saluda Sebastian G ✨\n\n` +
      `Te escribo para recordarte con mucho entusiasmo nuestra sesión fotográfica programada:\n\n` +
      `📅 *Fecha y Hora:* ${dateFormatted}\n` +
      `📍 *Punto de Encuentro:* ${loc}\n` +
      `📦 *Paquete Contratado:* ${booking.packageName}\n\n` +
      `💡 *Recomendaciones VIP para tu sesión:*\n` +
      `1. Llegar con 10 a 15 minutos de anticipación para aprovechar al máximo la luz natural (la "Golden Hour" del atardecer caribeño es mágica).\n` +
      `2. Traer los cambios de ropa planchados o listos para usar.\n` +
      `3. Hidratarte bien y llevar bloqueador solar o repelente según la locación.\n` +
      `⛅ *Garantía de Clima:* En caso de lluvia o clima adverso en ${loc}, reprogramamos tu sesión sin ningún costo adicional.\n\n` +
      `¿Tienes alguna duda previa o cambio de última hora? ¡Quedo muy atento! Nos vemos muy pronto para crear fotos inolvidables 📸✨`;

    const url = `https://wa.me/${clientPhone}?text=${encodeURIComponent(text)}`;
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  // 4. Modal de Recibo Digital Oficial y Voucher con Generación PDF Real
  const handleOpenReceipt = (booking) => {
    setReceiptBooking(booking);
    const total = Number(booking.totalPrice || 0);
    const defaultPaid = booking.status === 'completed' ? total : Math.round(total * 0.5);
    setReceiptPaidAmount(defaultPaid);
    setReceiptType(booking.status === 'completed' ? 'total' : 'deposit');
    setReceiptPaymentMethod('Nequi');
    setReceiptNotes('Abono para reserva de cupo y fecha garantizada en agenda oficial.');
  };

  const generateReceiptPdfBlob = async () => {
    const element = document.getElementById('sebastian-g-digital-receipt');
    if (!element) return null;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0c0a09',
      logging: false
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    return pdf;
  };

  const handleDownloadReceiptPdf = async () => {
    if (!receiptBooking) return;
    setIsGeneratingPdf(true);
    try {
      const pdf = await generateReceiptPdfBlob();
      if (pdf) {
        const voucherNum = `REC-${String(receiptBooking.id).replace(/\D/g, '').slice(-5).padStart(5, '0') || '001'}`;
        pdf.save(`Comprobante-SebastianG-${voucherNum}.pdf`);
      }
    } catch (err) {
      console.error('Error generando PDF:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleSendReceiptWhatsApp = async (chosenLine = receiptWhatsAppLine) => {
    if (!receiptBooking) return;
    setIsGeneratingPdf(true);

    let clientPhone = (receiptBooking.clientWhatsApp || '').replace(/\D/g, '');
    if (clientPhone.length === 10 && !clientPhone.startsWith('57')) {
      clientPhone = '57' + clientPhone;
    }
    const total = Number(receiptBooking.totalPrice || 0);
    const paid = Number(receiptPaidAmount || 0);
    const balance = Math.max(0, total - paid);
    const voucherNum = `REC-${String(receiptBooking.id).replace(/\D/g, '').slice(-5).padStart(5, '0') || '001'}`;
    const rawName = (receiptBooking.clientName || 'Cliente').trim();
    const firstName = rawName.split(' ')[0] || rawName;
    const loc = receiptBooking.specificLocation || (receiptBooking.locationType === 'outside' ? 'tu locación seleccionada' : 'San Antero');

    const voucherOnlineUrl = `https://sebastiang.app/#recibo=${receiptBooking.id}&paid=${paid}&method=${encodeURIComponent(receiptPaymentMethod)}`;

    const lineInfo = chosenLine === 'line2'
      ? '+57 302 369 6513 (Línea 2)'
      : '+57 324 472 5167 (Línea 1)';

    const text =
      `🧾 *COMPROBANTE DE PAGO OFICIAL • SEBASTIAN G* 📸✨\n\n` +
      `*N° de Comprobante:* ${voucherNum}\n` +
      `*Fecha de Emisión:* ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}\n` +
      `*Cliente:* ${receiptBooking.clientName}\n` +
      `*Sesión:* ${formatDateTime12Hour(receiptBooking.dateTime)}\n` +
      `*Locación:* ${loc}\n` +
      `*Paquete:* ${receiptBooking.packageName}\n\n` +
      `────────────────────────\n` +
      `💰 *Total del Paquete:* $${total.toLocaleString('es-CO')} COP\n` +
      `✅ *Valor Recibido / Abonado:* $${paid.toLocaleString('es-CO')} COP (${receiptPaymentMethod})\n` +
      `⏳ *Saldo Pendiente:* $${balance.toLocaleString('es-CO')} COP\n` +
      `────────────────────────\n` +
      `📌 *Estado:* ${balance === 0 ? 'PAGADO TOTALMENTE (100%)' : 'ABONO CONFIRMADO (Cupo Reservado)'}\n` +
      `📝 *Concepto:* ${receiptNotes}\n` +
      `⛅ *Garantía de Clima:* En caso de lluvia o clima adverso en ${loc}, tu sesión se reprograma sin ningún costo ni penalidad.\n\n` +
      `📞 *Contacto Oficial Fotógrafo:* Sebastian G • ${lineInfo}\n\n` +
      `📄 *DESCARGA O VISUALIZA TU RECIBO EN PDF AQUÍ:*\n${voucherOnlineUrl}\n\n` +
      `¡Muchas gracias por tu confianza ${firstName}! Tu sesión está agendada. Nos vemos muy pronto 📸`;

    try {
      const pdf = await generateReceiptPdfBlob();
      if (pdf) {
        const pdfBlob = pdf.output('blob');
        const pdfFile = new File([pdfBlob], `Comprobante-SebastianG-${voucherNum}.pdf`, { type: 'application/pdf' });

        // Intentar compartir el archivo PDF nativamente en Android/WhatsApp
        if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            files: [pdfFile],
            title: `Comprobante de Pago Oficial • ${receiptBooking.clientName}`,
            text: text
          });
          setIsGeneratingPdf(false);
          return;
        }

        // Descarga el archivo PDF y abre WhatsApp con el enlace de respaldo
        pdf.save(`Comprobante-SebastianG-${voucherNum}.pdf`);
      }
    } catch (e) {
      console.warn('Fallback a WhatsApp regular:', e);
    } finally {
      setIsGeneratingPdf(false);
    }

    const waUrl = `https://wa.me/${clientPhone}?text=${encodeURIComponent(text)}`;
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = waUrl;
    } else {
      window.open(waUrl, '_blank');
    }
  };

  // Manejador de subida de fotos para clientes (optimizado para Android, móviles y PC)
  const handleFilesChosen = async (e) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;
    const files = Array.from(rawFiles);

    setIsProcessingPhotos(true);
    setProcessProgress({ current: 0, total: files.length });

    const newItems = [];
    const startIndex = uploadedPhotos.length;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      setProcessProgress({ current: i + 1, total: files.length });
      const file = files[i];
      try {
        // Redimensionamiento a 1280px con 78% de calidad: nitidez HD, peso ligero (~90KB) y 0 fallos de memoria
        const compressedBase64 = await compressImageFile(file, 1280, 0.78);
        newItems.push({
          id: `upl-${Date.now()}-${startIndex + i + 1}-${Math.random().toString(36).substring(2, 6)}`,
          title: `Foto #${startIndex + i + 1}`,
          url: compressedBase64,
          fileName: file.name
        });
      } catch (err) {
        console.error('Error al procesar archivo:', file.name, err);
        errorCount++;
      }
    }

    if (newItems.length > 0) {
      setUploadedPhotos(prev => [...prev, ...newItems]);
    }
    setIsProcessingPhotos(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (errorCount > 0 && newItems.length === 0) {
      alert('No se pudieron procesar las fotos seleccionadas. Por favor verifica que sean imágenes JPG, PNG o WEBP.');
    }
  };

  const handleRemovePhoto = (photoId) => {
    setUploadedPhotos(prev => {
      const filtered = prev.filter(p => p.id !== photoId);
      return filtered.map((p, idx) => ({
        ...p,
        title: `Foto #${idx + 1}`
      }));
    });
  };

  const handleClearAllPhotos = () => {
    if (confirm('¿Deseas quitar todas las fotos seleccionadas?')) {
      setUploadedPhotos([]);
    }
  };

  const handlePackageSelectChange = (pkgId) => {
    const pkg = packages.find(p => p.id === pkgId);
    if (pkg) {
      setNewSessionForm(prev => ({
        ...prev,
        packageId: pkg.id,
        packageTitle: `${pkg.name} (+ 2 Fotos Gratis)`,
        maxPhotosAllowed: pkg.totalPhotos || (pkg.photoCount + 2)
      }));
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newSessionForm.clientName.trim()) {
      alert('Por favor escribe el nombre del cliente.');
      return;
    }
    if (!newSessionForm.clientWhatsApp.trim()) {
      alert('Por favor escribe el WhatsApp del cliente.');
      return;
    }

    try {
      setIsCreatingSession(true);
      let finalPhotos = [];

      if (useUrlMode) {
        const urls = newSessionForm.photoUrlsText
          .split('\n')
          .map(u => u.trim())
          .filter(u => u.length > 0);

        finalPhotos = urls.length > 0
          ? urls.map((url, i) => ({ title: `Foto #${i + 1}`, url }))
          : [];
      } else {
        finalPhotos = uploadedPhotos.map((p, i) => ({
          title: p.title || `Foto #${i + 1}`,
          url: p.url
        }));
      }

      if (finalPhotos.length === 0) {
        if (!confirm('No has subido fotos desde tu dispositivo. ¿Deseas generar el enlace con fotos de muestra para probarlo?')) {
          setIsCreatingSession(false);
          return;
        }
        finalPhotos = [
          { title: 'Foto 001 - Primer Plano', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80' },
          { title: 'Foto 002 - Luz de Atardecer', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80' },
          { title: 'Foto 003 - Sonrisa Frente al Mar', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80' },
          { title: 'Foto 004 - Movimiento y Brisa', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80' },
          { title: 'Foto 005 - Plano Entero en Playa', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
          { title: 'Foto 006 - Silueta al Ocaso', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80' }
        ];
      }

      const res = await createAdminSession({
        clientName: newSessionForm.clientName,
        clientWhatsApp: newSessionForm.clientWhatsApp,
        packageTitle: newSessionForm.packageTitle,
        maxPhotosAllowed: Number(newSessionForm.maxPhotosAllowed) || 10,
        photos: finalPhotos
      });

      setCreatedSessionResult(res);
      setUploadedPhotos([]);
      loadAllAdminData();
    } catch (err) {
      alert(err.message || 'Error al crear la sesión');
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Manejador de enlace directo / link de foto para el Catálogo Público
  const handleCatalogLinkChange = (e) => {
    const raw = e.target.value;
    setCatalogLinkInput(raw);

    if (!raw.trim()) {
      setNewCatalogForm(prev => ({ ...prev, url: '' }));
      return;
    }

    const cleanUrl = formatPhotoUrl(raw);
    setNewCatalogForm(prev => ({
      ...prev,
      url: cleanUrl,
      title: prev.title || 'Foto de Sesión'
    }));
  };

  // Manejador de subida para el Catálogo Público desde Celular / PC
  const handleCatalogPhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingCatalogPhoto(true);
      // Alta calidad para el catálogo promocional
      const base64 = await compressImageFile(file, 2000, 0.90);
      setNewCatalogForm(prev => ({
        ...prev,
        url: base64,
        title: prev.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      }));
    } catch (err) {
      alert('Error al procesar la foto para el catálogo.');
    } finally {
      setIsUploadingCatalogPhoto(false);
    }
  };

  const handleAddCatalogPhotoSubmit = async (e) => {
    e.preventDefault();
    if (!newCatalogForm.title.trim()) {
      alert('Por favor escribe un título para la foto del catálogo.');
      return;
    }
    if (!newCatalogForm.url) {
      alert(catalogUploadMode === 'link' 
        ? 'Por favor ingresa un enlace o link válido de la foto.' 
        : 'Por favor selecciona una foto para subir al catálogo.'
      );
      return;
    }

    try {
      setIsUploadingCatalogPhoto(true);
      const categoryFinal = newCatalogForm.category === 'custom'
        ? (newCatalogForm.customCategory.trim() || 'General')
        : newCatalogForm.category;

      const cleanUrl = formatPhotoUrl(newCatalogForm.url);

      const result = await addCatalogPhoto({
        title: newCatalogForm.title.trim(),
        category: categoryFinal,
        location: newCatalogForm.location.trim() || 'San Antero',
        url: cleanUrl
      });

      // Actualización optimista simultánea inmediata en el panel
      if (result && result.item) {
        setCatalog(prev => [result.item, ...prev.filter(p => p.id !== result.item.id)]);
      }

      setCatalogUploadSuccess('¡Foto publicada exitosamente y sincronizada en tiempo real!');
      setNewCatalogForm({
        title: '',
        category: 'Playas San Antero',
        customCategory: '',
        location: 'Playa Blanca, San Antero',
        url: ''
      });
      setCatalogLinkInput('');
      loadAllAdminData();
      if (onCatalogUpdated) onCatalogUpdated();
      setTimeout(() => setCatalogUploadSuccess(''), 5000);
    } catch (err) {
      alert(err.message || 'Error al agregar foto al catálogo.');
    } finally {
      setIsUploadingCatalogPhoto(false);
    }
  };

  const handleDeleteCatalogItem = async (item) => {
    const id = typeof item === 'object' && item ? item.id : item;
    const title = typeof item === 'object' && item ? item.title : null;
    if (!confirm('¿Seguro que deseas eliminar esta foto del catálogo público?')) return;
    
    // Eliminación optimista instantánea (por ID y por título)
    setCatalog(prev => prev.filter(c => {
      if (c.id === id) return false;
      if (title && c.title && c.title.trim().toLowerCase() === title.trim().toLowerCase()) return false;
      return true;
    }));

    try {
      await deleteCatalogPhoto(id, title);
      const updatedCatalog = await getCatalog();
      setCatalog(updatedCatalog);
      if (onCatalogUpdated) onCatalogUpdated();
    } catch (err) {
      console.error('Error al eliminar foto de catálogo:', err);
      alert('Error al eliminar foto');
      loadAllAdminData();
    }
  };

  const handleDeleteAllSamples = async () => {
    if (!confirm('¿Deseas quitar TODAS las fotos de muestra del catálogo para dejar únicamente tus fotos reales?')) return;
    setPurgeSamplesLoading(true);
    setPurgeSamplesSuccess('');
    // Filtrar de inmediato en pantalla
    setCatalog(prev => prev.filter(c => !isSampleItem(c)));
    try {
      await deleteAllSampleCatalogPhotos();
      const updatedCatalog = await getCatalog();
      setCatalog(updatedCatalog);
      if (onCatalogUpdated) onCatalogUpdated();
      setPurgeSamplesSuccess('¡Fotos de muestra eliminadas con éxito! Ahora solo se muestran tus fotos reales.');
      setTimeout(() => setPurgeSamplesSuccess(''), 5000);
    } catch (err) {
      console.error('Error al purgar muestras:', err);
      alert('Error al purgar fotos de muestra');
      loadAllAdminData();
    } finally {
      setPurgeSamplesLoading(false);
    }
  };

  // Manejador de Cambio de PIN dentro del Dashboard
  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    setPinChangeMsg('');
    setPinChangeError('');

    if (pinChangeForm.newPin.length < 4) {
      setPinChangeError('El nuevo PIN debe tener al menos 4 caracteres.');
      return;
    }

    if (pinChangeForm.newPin !== pinChangeForm.confirmPin) {
      setPinChangeError('El nuevo PIN y su confirmación no coinciden.');
      return;
    }

    try {
      await changeAdminPin(pinChangeForm.currentPin, pinChangeForm.newPin);
      setPinChangeMsg('¡PIN de acceso actualizado con éxito!');
      setPinChangeForm({ currentPin: '', newPin: '', confirmPin: '' });
      setTimeout(() => setPinChangeMsg(''), 4000);
    } catch (err) {
      setPinChangeError(err.message || 'El PIN actual no es correcto.');
    }
  };

  const handleReopenSession = async (sessionId) => {
    if (!confirm('¿Deseas reabrir esta sesión y darle 3 días adicionales al cliente para elegir?')) return;
    try {
      await reopenAdminSession(sessionId, 3);
      alert('Sesión reabierta por 3 días más con éxito.');
      loadAllAdminData();
    } catch (err) {
      alert('Error al reabrir sesión');
    }
  };

  const handleDeleteSession = async (sessionOrId, clientName, token) => {
    const sessionId = typeof sessionOrId === 'object' && sessionOrId !== null ? sessionOrId.id : sessionOrId;
    const sessionToken = typeof sessionOrId === 'object' && sessionOrId !== null ? sessionOrId.token : token;
    const name = typeof sessionOrId === 'object' && sessionOrId !== null ? sessionOrId.clientName : clientName;

    if (!confirm(`¿Estás seguro de eliminar permanentemente la galería de "${name || 'este cliente'}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteAdminSession(sessionId, sessionToken);
      setSessions(prev => prev.filter(s => 
        s.id !== sessionId && 
        s.token !== sessionId && 
        (!sessionToken || (s.id !== sessionToken && s.token !== sessionToken))
      ));
    } catch (err) {
      alert('Error al eliminar galería: ' + (err.message || 'Error desconocido'));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Manejo de teclado táctil y físico para el PIN VIP
  const handleKeypadPress = (val) => {
    if (navigator.vibrate) navigator.vibrate(25);
    setAuthError('');
    if (val === 'clear') {
      setPinInput('');
    } else if (val === 'backspace') {
      setPinInput(prev => prev.slice(0, -1));
    } else if (val === 'enter') {
      if (!pinInput) return;
      verifyAdminPin(pinInput)
        .then(() => {
          setIsAuthenticated(true);
          loadAllAdminData();
        })
        .catch(() => {
          setAuthError('PIN incorrecto. Si lo olvidaste, usa la opción de recuperación abajo.');
        });
    } else {
      if (pinInput.length < 8) {
        const nextPin = pinInput + val;
        setPinInput(nextPin);
        if (nextPin.length === 4) {
          setTimeout(() => {
            verifyAdminPin(nextPin)
              .then(() => {
                setIsAuthenticated(true);
                loadAllAdminData();
              })
              .catch(() => {
                setAuthError('PIN incorrecto. Si lo olvidaste, usa la opción de recuperación abajo.');
              });
          }, 150);
        }
      }
    }
  };

  // PANTALLA DE ACCESO CON PIN Y RECUPERACIÓN (DISEÑO VIP BÓVEDA)
  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="relative bg-gradient-to-b from-stone-900/95 via-stone-900 to-stone-950 border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-[0_20px_70px_rgba(245,158,11,0.15)] text-center backdrop-blur-2xl overflow-hidden">
          
          {/* Halo ambiental superior */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

          {/* Emblema con cerradura dorada */}
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 border border-amber-300/50 flex items-center justify-center text-stone-950 mx-auto mb-3 shadow-lg shadow-amber-500/30">
            <Lock className="w-8 h-8" />
          </div>

          <h3 className="text-2xl sm:text-3xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
            Sebastian G
          </h3>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400/90 mb-1">
            Bóveda de Administración
          </p>
          <p className="text-xs text-stone-400 mb-4">
            Ingreso privado para reservas, fotos y precios
          </p>

          {isTwoFactorStep ? (
            /* PASO 2: VERIFICACIÓN DE DOBLE FACTOR (2FA) */
            <div className="space-y-4 text-left">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Paso 2 • Doble Factor (2FA)</span>
                </div>
                <h4 className="text-xl font-serif font-bold text-white">
                  Verifica tu Identidad
                </h4>
                <p className="text-xs text-stone-300 mt-1">
                  Generamos un código de seguridad exclusivo de 6 dígitos.
                </p>
              </div>

              {/* Canales de entrega */}
              <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-stone-300">
                  <span className="flex items-center gap-1.5 text-stone-400">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp:</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-400">{twoFactorData?.phoneMasked || '+57 324 ••• ••67'}</span>
                </div>
                <div className="flex items-center justify-between text-stone-400 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>Correo:</span>
                  </span>
                  <span className="font-mono">{twoFactorData?.emailMasked || 'sga••••••0410@gmail.com'}</span>
                </div>
              </div>

              {/* Acciones directas para recibir código en WhatsApp */}
              <div className="space-y-2 pt-1">
                {twoFactorData?.directWhatsAppUrl && (
                  <a
                    href={twoFactorData.directWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>📲 Recibir en WhatsApp (Línea 1)</span>
                  </a>
                )}
                {twoFactorData?.secondaryWhatsAppUrl && (
                  <a
                    href={twoFactorData.secondaryWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-stone-800/90 hover:bg-stone-800 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px] transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>📲 Recibir en WhatsApp (Línea 2)</span>
                  </a>
                )}
              </div>

              {/* Mensajes de error o éxito */}
              {twoFactorError && (
                <div className={`p-2.5 rounded-xl text-xs text-center ${
                  twoFactorError.startsWith('✓') 
                    ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200' 
                    : 'bg-red-950/80 border border-red-500/40 text-red-200'
                }`}>
                  {twoFactorError}
                </div>
              )}

              {/* Formulario de Código de 6 dígitos */}
              <form onSubmit={handleVerify2FASubmit} className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5 text-center">
                    Escribe tu código de 6 dígitos:
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={twoFactorInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTwoFactorInput(val);
                      if (val.length === 6) {
                        setTimeout(() => {
                          try {
                            verifyTwoFactorCode(val, rememberDevice);
                            setIsAuthenticated(true);
                            setIsTwoFactorStep(false);
                            setPinInput('');
                            setTwoFactorInput('');
                            loadAllAdminData();
                          } catch (err) {
                            setTwoFactorError(err.message || 'Código incorrecto');
                          }
                        }, 120);
                      }
                    }}
                    placeholder="000000"
                    className="w-full text-center tracking-[0.35em] font-mono font-bold text-2xl py-2.5 px-4 rounded-2xl bg-stone-950 border border-amber-500/50 text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-700"
                    autoFocus
                  />
                </div>

                {/* Casilla: Recordar este dispositivo por 30 días */}
                <label className="flex items-center justify-center gap-2 text-xs text-stone-300 cursor-pointer pt-1 select-none">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-stone-950 border-stone-700 focus:ring-amber-400 cursor-pointer"
                  />
                  <span>Recordar este dispositivo por 30 días</span>
                </label>

                <button
                  type="submit"
                  disabled={isVerifying2FA || twoFactorInput.length < 6}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-40 text-stone-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isVerifying2FA ? 'Verificando...' : 'Confirmar & Entrar al Panel'}</span>
                </button>
              </form>

              {/* Botones de pie */}
              <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResend2FACode}
                  className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reenviar código</span>
                </button>
                <button
                  type="button"
                  onClick={handleBackToPin}
                  className="text-stone-400 hover:text-stone-200 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Volver al PIN</span>
                </button>
              </div>
            </div>
          ) : !isRecoveringPin ? (
            /* FORMULARIO DE LOGIN VIP CON KEYPAD */
            <div>
              {authError && (
                <div className="p-3 mb-3 bg-red-950/80 border border-red-500/40 rounded-xl text-red-200 text-xs">
                  {authError}
                </div>
              )}

              {/* Indicador de 4 Dots Luminosos */}
              <div className="flex items-center justify-center gap-3.5 my-4">
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pinInput.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full transition-all duration-200 ${
                        isFilled
                          ? 'bg-amber-400 scale-125 shadow-[0_0_15px_rgba(245,158,11,0.9)] ring-2 ring-amber-300'
                          : 'bg-stone-950 border border-stone-700'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Entrada oculta para soporte de teclado físico en laptops */}
              <input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setPinInput(val);
                  if (val.length === 4) {
                    handleVerifyPinSubmit(val);
                  }
                }}
                className="opacity-0 w-0 h-0 absolute -top-10"
                autoFocus
              />

              {/* Teclado Numérico Táctil de Lujo */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num.toString())}
                    className="w-16 h-13 rounded-2xl bg-stone-950 border border-stone-800/90 hover:border-amber-400/60 active:bg-amber-500 active:text-stone-950 text-white font-mono text-xl font-bold flex items-center justify-center transition-all shadow-md active:scale-95 touch-manipulation"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleKeypadPress('backspace')}
                  className="w-16 h-13 rounded-2xl bg-stone-950 border border-stone-800/90 hover:border-red-500/60 active:bg-red-500 active:text-white text-stone-400 font-mono text-sm font-bold flex items-center justify-center transition-all shadow-md active:scale-95 touch-manipulation"
                  title="Borrar dígito"
                >
                  <Delete className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="w-16 h-13 rounded-2xl bg-stone-950 border border-stone-800/90 hover:border-amber-400/60 active:bg-amber-500 active:text-stone-950 text-white font-mono text-xl font-bold flex items-center justify-center transition-all shadow-md active:scale-95 touch-manipulation"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('enter')}
                  className="w-16 h-13 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 border border-amber-300 hover:from-amber-400 hover:to-amber-300 active:scale-95 text-stone-950 font-bold flex items-center justify-center transition-all shadow-lg shadow-amber-500/25 touch-manipulation"
                  title="Entrar"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                </button>
              </div>

              <div className="pt-3 border-t border-stone-800/80 space-y-2">
                <button
                  type="button"
                  onClick={handleStartRecovery}
                  className="text-xs text-amber-400 hover:text-amber-300 hover:underline flex items-center justify-center gap-1 mx-auto font-medium"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>¿Olvidaste tu PIN? Recuperar aquí</span>
                </button>

                {onBackToHome && (
                  <button
                    type="button"
                    onClick={onBackToHome}
                    className="text-[11px] text-stone-500 hover:text-stone-300 flex items-center justify-center gap-1 mx-auto pt-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Volver a la página principal</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* FLUJO DE RECUPERACIÓN DE PIN */
            <div className="space-y-4 text-left">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
                🔐 <strong>Recuperación de Seguridad:</strong> Escribe el número de WhatsApp registrado para verificar tu identidad y crear un nuevo PIN.
              </div>

              {recoveryError && (
                <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-red-200 text-xs">
                  {recoveryError}
                </div>
              )}

              {recoveryMsg && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs">
                  {recoveryMsg}
                </div>
              )}

              {recoveryStep === 1 ? (
                <form onSubmit={handleVerifyPhoneForRecovery} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-300 uppercase mb-1">
                      Tu Número de WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={recoveryPhone}
                      onChange={(e) => setRecoveryPhone(e.target.value)}
                      placeholder="Ej. 3244725167 o 3023696513"
                      className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold py-3 rounded-xl text-xs"
                  >
                    Verificar Mi Identidad
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPinSubmit} className="space-y-3">
                  {recoveredPinDisplay && (
                    <div className="p-2.5 bg-stone-950 rounded-xl border border-stone-800 text-[11px] text-stone-300">
                      PIN anterior detectado: <strong className="text-amber-400 font-mono">{recoveredPinDisplay}</strong>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-stone-300 uppercase mb-1">
                      Escribe tu Nuevo PIN *
                    </label>
                    <input
                      type="password"
                      required
                      value={recoveryNewPin}
                      onChange={(e) => setRecoveryNewPin(e.target.value)}
                      placeholder="Mínimo 4 dígitos"
                      className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-300 uppercase mb-1">
                      Confirma tu Nuevo PIN *
                    </label>
                    <input
                      type="password"
                      required
                      value={recoveryConfirmPin}
                      onChange={(e) => setRecoveryConfirmPin(e.target.value)}
                      placeholder="Repite el nuevo PIN"
                      className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs"
                  >
                    Guardar Nuevo PIN y Entrar
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => setIsRecoveringPin(false)}
                className="w-full text-center text-xs text-stone-400 hover:text-white pt-1"
              >
                Volver a la pantalla de PIN
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const safeSessions = (sessions || []).filter(
    s => s && s.id !== 'sess-demo' && s.token !== 'demo-cliente-2026'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* BARRA SUPERIOR EXCLUSIVA DEL PANEL (SEPARA EL DASHBOARD DE LA WEB PÚBLICA) */}
      <div className="w-full bg-stone-900/90 border border-stone-800 rounded-3xl p-4 sm:p-5 mb-8 flex flex-wrap items-center justify-between gap-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <img
            src="/app-icon.png"
            alt="Sebastian G"
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl object-cover shadow-lg shadow-pink-500/25 border border-white/20"
          />
          <div className="border-l border-stone-800 pl-3">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 block">
              Panel de Fotógrafo
            </span>
            <span className="text-xs text-stone-400 font-medium block">
              Sebastian G • Fotografía & Edición Profesional
            </span>
          </div>
        </div>

        {/* Acciones Rápidas: Push, Instalar en Android, Ver Portafolio y Cerrar Sesión */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Control de Notificaciones Push estilo WhatsApp / Messenger */}
          {pushPermission !== 'granted' ? (
            <button
              type="button"
              onClick={handleEnablePush}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/30 active:scale-95 animate-pulse"
              title="Activar notificaciones Push para que suenen como en WhatsApp cuando un cliente reserve"
            >
              <Bell className="w-4 h-4" />
              <span>🔔 Activar Notificaciones Push</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-stone-950/90 border border-emerald-500/40 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-0.5" />
              <span className="text-[11px] font-bold text-emerald-300">Push Flotante Activo</span>
              <button
                type="button"
                onClick={handleTestPush}
                className="ml-1 text-[11px] text-stone-300 hover:text-amber-300 underline font-semibold"
                title="Hacer sonar y probar una notificación flotante de prueba"
              >
                (Probar Alerta)
              </button>
              {typeof window !== 'undefined' && window.AndroidNotificationBridge?.openNotificationSettings && (
                <button
                  type="button"
                  onClick={() => window.AndroidNotificationBridge.openNotificationSettings()}
                  className="ml-1 text-[11px] text-amber-400 hover:text-amber-200 underline font-bold"
                  title="Configurar permisos de notificaciones flotantes en los ajustes de Android"
                >
                  ⚙️ Ajustes Android
                </button>
              )}
            </div>
          )}

          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3.5 py-2.5 rounded-xl bg-purple-950/80 border border-purple-500/50 hover:bg-purple-900 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 shadow-purple-950/40"
              title="Instalar la aplicación nativa en tu teléfono Android"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-purple-400" />
              <span>📲 Instalar App en Android</span>
            </button>
          )}

          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 hover:border-amber-400 text-stone-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver Web Pública</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="px-4 py-2.5 rounded-xl bg-red-950/80 border border-red-500/50 hover:bg-red-900 text-red-200 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md active:scale-95 shadow-red-950/40"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* ALERTA FLOTANTE EN TIEMPO REAL ESTILO WHATSAPP / MESSENGER */}
      {realtimeAlert && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-bounce-in">
          <div className="bg-stone-950/95 border-2 border-amber-400 rounded-3xl p-4 sm:p-5 shadow-[0_20px_60px_rgba(245,158,11,0.4)] backdrop-blur-2xl text-left text-white ring-4 ring-amber-400/20">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shrink-0 text-stone-950 text-2xl shadow-lg shadow-amber-500/30">
                {realtimeAlert.type === 'payment' ? '💰' : realtimeAlert.type === 'session' ? '🖼️' : realtimeAlert.type === 'review' ? '⭐' : '📸'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    {realtimeAlert.type === 'payment'
                      ? '¡Nuevo Pago Recibido!'
                      : realtimeAlert.type === 'session'
                      ? '¡Selección de Fotos Lista!'
                      : realtimeAlert.type === 'review'
                      ? '¡Nueva Calificación de Cliente!'
                      : '¡Nueva Reserva en Vivo!'}
                  </span>
                  <button
                    onClick={() => setRealtimeAlert(null)}
                    className="text-stone-400 hover:text-white text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
                <h4 className="text-base font-extrabold text-white truncate mt-1">
                  {realtimeAlert.clientName}
                </h4>
                {realtimeAlert.type === 'booking' ? (
                  <p className="text-xs text-stone-300 mt-0.5 line-clamp-2">
                    {realtimeAlert.packageName} • {realtimeAlert.dateTime}
                    <br />
                    <span className="text-amber-300/90 font-medium">📍 {realtimeAlert.location} (${Number(realtimeAlert.totalPrice || 0).toLocaleString('es-CO')} COP)</span>
                  </p>
                ) : realtimeAlert.type === 'payment' ? (
                  <p className="text-xs text-stone-300 mt-0.5">
                    Monto: <strong className="text-emerald-400 font-bold">${Number(realtimeAlert.amount || 0).toLocaleString('es-CO')} COP</strong> ({realtimeAlert.method?.toUpperCase()})
                  </p>
                ) : realtimeAlert.type === 'session' ? (
                  <p className="text-xs text-stone-300 mt-0.5">
                    {realtimeAlert.packageName || 'Sesión Fotográfica'} elegida por el cliente. ¡Lista para descargar y editar!
                  </p>
                ) : (
                  <p className="text-xs text-stone-300 mt-0.5">
                    <span className="text-amber-400 font-bold">{realtimeAlert.packageName}</span>
                    {realtimeAlert.comment ? <><br /><span className="italic text-stone-300">"{realtimeAlert.comment}"</span></> : null}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setActiveTab(realtimeAlert.targetTab);
                      setRealtimeAlert(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ver {realtimeAlert.type === 'payment' ? 'Pago' : realtimeAlert.type === 'session' ? 'Fotos' : realtimeAlert.type === 'review' ? 'Reseñas' : 'Reserva'}</span>
                  </button>

                  {realtimeAlert.type === 'booking' && (
                    <button
                      onClick={() => {
                        const targetBooking = bookings.find(b => b.id === realtimeAlert.bookingId) || {
                          id: realtimeAlert.bookingId,
                          clientName: realtimeAlert.clientName,
                          clientWhatsApp: realtimeAlert.whatsappUrl ? realtimeAlert.whatsappUrl.replace('https://wa.me/', '') : '',
                          packageName: realtimeAlert.packageName,
                          dateTime: realtimeAlert.dateTime,
                          specificLocation: realtimeAlert.location,
                          totalPrice: realtimeAlert.totalPrice,
                          status: 'pending'
                        };
                        handleOpenConfirmBookingModal(targetBooking);
                        setRealtimeAlert(null);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmar por WhatsApp</span>
                    </button>
                  )}

                  {realtimeAlert.whatsappUrl && (
                    <a
                      href={realtimeAlert.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-stone-900 border border-emerald-500/40 hover:bg-stone-800 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                      <span>💬 Chat WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE MÉTRICAS EN VIVO Y ESTADÍSTICAS RÁPIDAS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <div 
          onClick={() => setActiveTab('analytics')}
          className="bg-stone-900/80 border border-stone-800 hover:border-amber-500/40 p-3.5 rounded-2xl cursor-pointer transition-all text-left shadow-lg"
        >
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span className="font-semibold">Visitas Totales</span>
            <Eye className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-black text-white font-mono">{analyticsStats.totalVisits}</span>
          <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">+{analyticsStats.todayVisits} hoy</span>
        </div>

        <div 
          onClick={() => setActiveTab('analytics')}
          className="bg-stone-900/80 border border-stone-800 hover:border-amber-500/40 p-3.5 rounded-2xl cursor-pointer transition-all text-left shadow-lg"
        >
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span className="font-semibold">Enlace Compartido</span>
            <Share2 className="w-4 h-4 text-pink-400" />
          </div>
          <span className="text-2xl font-black text-white font-mono">{analyticsStats.totalShares}</span>
          <span className="text-[10px] text-stone-400 block mt-0.5">Por WhatsApp / Web</span>
        </div>

        <div 
          onClick={() => setActiveTab('payments')}
          className="bg-stone-900/80 border border-stone-800 hover:border-emerald-500/40 p-3.5 rounded-2xl cursor-pointer transition-all text-left shadow-lg group"
        >
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span className="font-semibold">Pagos en Vivo</span>
            <div className="flex items-center gap-1.5 bg-stone-950 px-2 py-0.5 rounded-lg border border-stone-800">
              <NequiLogo className="w-3.5 h-3.5" showText={false} />
              <DaviPlataLogo className="w-3.5 h-3.5" showText={false} />
              <DaleLogo className="w-3.5 h-3.5" showText={false} />
            </div>
          </div>
          <span className="text-2xl font-black text-white font-mono">{payments.length}</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-purple-400 font-bold">Nequi</span>
            <span className="text-[10px] text-stone-600">•</span>
            <span className="text-[10px] text-red-400 font-bold">DaviPlata</span>
            <span className="text-[10px] text-stone-600">•</span>
            <span className="text-[10px] text-amber-400 font-bold">Dale!</span>
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('reviews')}
          className="bg-stone-900/80 border border-stone-800 hover:border-amber-500/40 p-3.5 rounded-2xl cursor-pointer transition-all text-left shadow-lg group"
        >
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span className="font-semibold">Opiniones</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <span className="text-2xl font-black text-white font-mono">
            {reviewsList.length > 0 ? '5.0 ⭐' : '0'}
          </span>
          <span className="text-[10px] text-amber-400 block mt-0.5 font-bold">
            {reviewsList.length > 0 ? `${reviewsList.length} reseñas web` : 'Sin reseñas aún'}
          </span>
        </div>

        <div 
          onClick={() => setActiveTab('loyalty')}
          className="bg-stone-900/80 border border-stone-800 hover:border-amber-500/40 p-3.5 rounded-2xl cursor-pointer transition-all text-left shadow-lg"
        >
          <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
            <span className="font-semibold">Fidelización VIP</span>
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-black text-white font-mono">15%</span>
          <span className="text-[10px] text-amber-400 block mt-0.5 font-bold">Clientes recurrentes</span>
        </div>
      </div>

      {/* CABECERA DEL PANEL DE CONTROL */}
      <div className="flex flex-col gap-4 pb-6 border-b border-stone-800 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Administración Oficial
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Sincronizado en Tiempo Real (PC ⇄ Celular)</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white">
              Panel de Control • Sebastian G
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              Línea 1: {settings.photographerWhatsApp || '+573244725167'} • Línea 2: {settings.photographerWhatsApp2 || '+573023696513'}
            </p>
          </div>
        </div>

        {/* Pestañas de navegación 100% responsive: Grid adaptable */}
        <div className="w-full bg-stone-900/95 p-1.5 sm:p-2 rounded-2xl border border-stone-800/90 shadow-xl no-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'bookings'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Reservas</span>
              {bookings.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === 'bookings' ? 'bg-stone-950 text-amber-400' : 'bg-stone-800 text-stone-300'}`}>
                  {bookings.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'payments'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-stone-950 shadow-lg shadow-emerald-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>Pagos</span>
              {payments.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === 'payments' ? 'bg-stone-950 text-emerald-400' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'}`}>
                  {payments.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'reviews'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <Star className="w-3.5 h-3.5 shrink-0 text-amber-400 fill-amber-400" />
              <span>Opiniones</span>
              {reviewsList.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === 'reviews' ? 'bg-stone-950 text-amber-400' : 'bg-amber-950 text-amber-300 border border-amber-500/40'}`}>
                  {reviewsList.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Tráfico</span>
            </button>

            <button
              onClick={() => setActiveTab('loyalty')}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'loyalty'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span>Fidelización</span>
            </button>

            <button
              onClick={() => setActiveTab('create-session')}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'create-session'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Subir Fotos</span>
            </button>

            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'sessions'
                  ? 'bg-gradient-to-r from-purple-600 via-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-purple-950/40 scale-[1.02] font-black'
                  : 'text-purple-300 hover:text-white bg-purple-950/30 hover:bg-purple-900/50 border border-purple-500/30 font-semibold'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5 shrink-0 text-purple-400" />
              <span>Galerías & Entrega</span>
              {safeSessions.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === 'sessions' ? 'bg-stone-950 text-amber-400' : 'bg-purple-900 text-purple-200 border border-purple-500/40'}`}>
                  {safeSessions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('catalog-manager')}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'catalog-manager'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Catálogo</span>
              {catalog.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === 'catalog-manager' ? 'bg-stone-950 text-amber-400' : 'bg-stone-800 text-stone-300'}`}>
                  {catalog.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('pricing-manager')}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'pricing-manager'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 shrink-0" />
              <span>Precios</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span>Ajustes</span>
            </button>
          </div>
        </div>
      </div>

      {/* PESTAÑA 1: RESERVAS DE CLIENTES (VISTA LISTA & CALENDARIO INTERACTIVO) */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-serif font-bold text-white flex items-center gap-2">
                <span>Reservas de Clientes</span>
                <span className="text-xs font-sans font-bold text-amber-400 bg-amber-400/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  {bookings.length} {bookings.length === 1 ? 'reserva' : 'reservas'}
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                Gestión de sesiones, sincronización a Google Calendar, recordatorios a 24h y recibos oficiales.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Selector de Vista: Lista vs Calendario */}
              <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800">
                <button
                  type="button"
                  onClick={() => setBookingViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    bookingViewMode === 'list'
                      ? 'bg-amber-400 text-stone-950 shadow-md shadow-amber-400/20'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBookingViewMode('calendar')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    bookingViewMode === 'calendar'
                      ? 'bg-amber-400 text-stone-950 shadow-md shadow-amber-400/20'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendario</span>
                </button>
              </div>

              <button
                onClick={loadAllAdminData}
                className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 border border-stone-800 flex items-center gap-1 text-xs transition-colors"
                title="Actualizar datos en tiempo real"
              >
                <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
            </div>
          </div>

          {bookings.length === 0 ? (
            <div className="p-12 text-center bg-stone-900 border border-stone-800 rounded-3xl text-stone-400">
              No hay reservas registradas todavía.
            </div>
          ) : bookingViewMode === 'calendar' ? (
            /* VISTA DE CALENDARIO MENSUAL INTERACTIVO */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cuadrícula del Calendario (2 Columnas) */}
              <div className="lg:col-span-2 bg-stone-900 border border-stone-800 rounded-3xl p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg sm:text-xl font-serif font-bold text-white capitalize">
                      {calendarDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setCalendarDate(now);
                        const dayBookings = bookings.filter(b => {
                          const d = parseBookingDate(b.dateTime);
                          if (!d) return false;
                          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
                        });
                        setSelectedCalendarDay({ year: now.getFullYear(), month: now.getMonth(), day: now.getDate(), bookings: dayBookings });
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 transition-colors"
                    >
                      Hoy
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                      className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
                      title="Mes anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                      className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
                      title="Mes siguiente"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Cabecera Días de la Semana */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[11px] font-bold text-stone-400 py-1 border-b border-stone-800">
                  <span>Lun</span>
                  <span>Mar</span>
                  <span>Mié</span>
                  <span>Jue</span>
                  <span>Vie</span>
                  <span>Sáb</span>
                  <span>Dom</span>
                </div>

                {/* Celdas del Calendario */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {(() => {
                    const year = calendarDate.getFullYear();
                    const month = calendarDate.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const startOffset = (firstDay.getDay() + 6) % 7;
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const prevMonthDays = new Date(year, month, 0).getDate();

                    const today = new Date();
                    const isCurrentMonthToday = today.getFullYear() === year && today.getMonth() === month;

                    const cells = [];

                    // Días previos de relleno
                    for (let i = startOffset - 1; i >= 0; i--) {
                      cells.push(
                        <div
                          key={`prev-${i}`}
                          className="min-h-[64px] sm:min-h-[85px] p-1.5 rounded-xl bg-stone-950/20 border border-stone-800/30 text-stone-700 text-xs select-none flex flex-col justify-between"
                        >
                          <span>{prevMonthDays - i}</span>
                        </div>
                      );
                    }

                    // Días activos del mes
                    for (let day = 1; day <= daysInMonth; day++) {
                      const dayBookings = bookings.filter(b => {
                        const d = parseBookingDate(b.dateTime);
                        if (!d) return false;
                        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
                      });

                      const isToday = isCurrentMonthToday && today.getDate() === day;
                      const isSelected = selectedCalendarDay && selectedCalendarDay.year === year && selectedCalendarDay.month === month && selectedCalendarDay.day === day;

                      cells.push(
                        <div
                          key={`day-${day}`}
                          onClick={() => setSelectedCalendarDay({ year, month, day, bookings: dayBookings })}
                          className={`min-h-[64px] sm:min-h-[85px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                            isSelected
                              ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/40'
                              : isToday
                              ? 'bg-stone-950 border-amber-500/50 shadow-sm'
                              : 'bg-stone-950/80 border-stone-800/80 hover:border-stone-700 hover:bg-stone-800/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isToday ? 'text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md' : 'text-stone-300'}`}>
                              {day}
                            </span>
                            {dayBookings.length > 0 && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-400 text-stone-950 shadow-sm">
                                {dayBookings.length}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1 mt-1 overflow-hidden">
                            {dayBookings.slice(0, 2).map((b, idx) => (
                              <div
                                key={idx}
                                className={`text-[9px] truncate px-1 py-0.5 rounded font-medium ${
                                  b.status === 'confirmed'
                                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-amber-950/90 text-amber-300 border border-amber-500/30'
                                }`}
                                title={`${b.clientName} (${formatDateTime12Hour(b.dateTime)})`}
                              >
                                {b.clientName.split(' ')[0]}
                              </div>
                            ))}
                            {dayBookings.length > 2 && (
                              <div className="text-[9px] text-stone-400 text-center font-bold">
                                +{dayBookings.length - 2} más
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Días posteriores de relleno
                    const totalRendered = cells.length;
                    const remaining = (7 - (totalRendered % 7)) % 7;
                    for (let i = 1; i <= remaining; i++) {
                      cells.push(
                        <div
                          key={`next-${i}`}
                          className="min-h-[64px] sm:min-h-[85px] p-1.5 rounded-xl bg-stone-950/20 border border-stone-800/30 text-stone-700 text-xs select-none flex flex-col justify-between"
                        >
                          <span>{i}</span>
                        </div>
                      );
                    }

                    return cells;
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-stone-800 text-[11px] text-stone-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <span>Sesión Confirmada</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    <span>Sesión Pendiente</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-md border border-amber-400"></span>
                    <span>Día de Hoy</span>
                  </div>
                </div>
              </div>

              {/* Columna Detalle del Día & Google Calendar */}
              <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 space-y-4">
                {(() => {
                  const sel = selectedCalendarDay || (() => {
                    const now = new Date();
                    const dayBookings = bookings.filter(b => {
                      const d = parseBookingDate(b.dateTime);
                      if (!d) return false;
                      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
                    });
                    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate(), bookings: dayBookings };
                  })();

                  const selDate = new Date(sel.year, sel.month, sel.day);
                  const dayBookings = bookings.filter(b => {
                    const d = parseBookingDate(b.dateTime);
                    if (!d) return false;
                    return d.getFullYear() === sel.year && d.getMonth() === sel.month && d.getDate() === sel.day;
                  });

                  return (
                    <>
                      <div className="border-b border-stone-800 pb-3">
                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
                          Agenda del Día Seleccionado
                        </span>
                        <h4 className="text-base sm:text-lg font-serif font-bold text-white capitalize mt-0.5">
                          {selDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </h4>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {dayBookings.length === 0 ? 'Sin citas para este día' : `${dayBookings.length} ${dayBookings.length === 1 ? 'sesión programada' : 'sesiones programadas'}`}
                        </p>
                      </div>

                      {dayBookings.length === 0 ? (
                        <div className="p-8 text-center bg-stone-950/60 rounded-2xl border border-stone-800/80 space-y-2">
                          <Calendar className="w-8 h-8 text-stone-600 mx-auto" />
                          <p className="text-xs text-stone-300 font-medium">No hay sesiones para esta fecha.</p>
                          <p className="text-[11px] text-stone-500">Toca cualquier otro día del calendario para revisar sus citas agendadas.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
                          {dayBookings.map((booking) => {
                            let clientPhoneClean = (booking.clientWhatsApp || '').replace(/\D/g, '');
                            if (clientPhoneClean.length === 10 && !clientPhoneClean.startsWith('57')) {
                              clientPhoneClean = '57' + clientPhoneClean;
                            }

                            return (
                              <div
                                key={booking.id}
                                className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3 hover:border-amber-500/40 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg ${
                                      booking.status === 'confirmed'
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    }`}
                                  >
                                    {booking.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                                  </span>
                                  <span className="text-xs font-mono font-bold text-amber-400">
                                    {formatDateTime12Hour(booking.dateTime).split(' a las ')[1] || formatDateTime12Hour(booking.dateTime)}
                                  </span>
                                </div>

                                <div>
                                  <h5 className="font-serif font-bold text-white text-base">
                                    {booking.clientName}
                                  </h5>
                                  <p className="text-xs text-stone-300 truncate mt-0.5">
                                    {booking.packageName}
                                  </p>
                                  <p className="text-[11px] text-stone-400 truncate">
                                    📍 {booking.specificLocation || 'San Antero'}
                                  </p>
                                </div>

                                {/* Botón 1-Clic: Sincronizar con Google Calendar */}
                                <a
                                  href={getGoogleCalendarUrl(booking)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-blue-950/80 hover:bg-blue-900 text-blue-200 border border-blue-500/40 transition-all shadow-sm active:scale-95"
                                  title="Guardar cita directamente en Google Calendar"
                                >
                                  <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <span>📅 Añadir a Google Calendar</span>
                                </a>

                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSendReminder(booking)}
                                    className="py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 bg-stone-900 hover:bg-stone-800 text-amber-300 border border-amber-500/30 transition-colors"
                                    title="Enviar recordatorio 24h por WhatsApp"
                                  >
                                    <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span className="truncate">Recordar 24h</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenReceipt(booking)}
                                    className="py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 transition-colors"
                                    title="Generar recibo de pago digital"
                                  >
                                    <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span className="truncate">Recibo PDF</span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-2 pt-1 border-t border-stone-800/80">
                                  <a
                                    href={`https://wa.me/${clientPhoneClean}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center justify-center gap-1"
                                  >
                                    <MessageCircle className="w-3 h-3 shrink-0" />
                                    <span>WhatsApp</span>
                                  </a>

                                  {booking.status !== 'confirmed' && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenConfirmBookingModal(booking)}
                                      className="py-1.5 px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 text-[11px] font-black flex items-center justify-center gap-1"
                                    >
                                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                                      <span>Confirmar</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* VISTA DE LISTA DE RESERVAS */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookings.map((booking) => {
                const isOutside = booking.locationType === 'outside_san_antero' || booking.locationType === 'outside';
                let clientPhoneClean = (booking.clientWhatsApp || '').replace(/\D/g, '');
                if (clientPhoneClean.length === 10 && !clientPhoneClean.startsWith('57')) {
                  clientPhoneClean = '57' + clientPhoneClean;
                }

                return (
                  <div
                    key={booking.id}
                    className="bg-stone-900 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                            booking.status === 'confirmed'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : booking.status === 'completed'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {booking.status === 'confirmed' ? 'Confirmada' : booking.status === 'completed' ? 'Sesión Realizada' : 'Pendiente'}
                        </span>
                        <span className="text-[11px] text-stone-500">
                          {new Date(booking.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="text-xl font-serif font-bold text-white">
                        {booking.clientName}
                      </h4>

                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <a
                          href={`https://wa.me/${clientPhoneClean}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{booking.clientWhatsApp} (Chatear)</span>
                        </a>

                        {booking.clientEmail && (
                          <a
                            href={`mailto:${booking.clientEmail}`}
                            className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 font-medium"
                            title="Enviar correo a cliente"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>{booking.clientEmail}</span>
                          </a>
                        )}
                      </div>

                      <div className="mt-4 p-3.5 rounded-2xl bg-stone-950 border border-stone-800/80 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-stone-400">Paquete:</span>
                          <span className="font-semibold text-white truncate max-w-[170px]">{booking.packageName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-stone-400">Valor Cobrado:</span>
                          <span className="text-base font-extrabold text-amber-400 font-mono">
                            ${Number(booking.totalPrice).toLocaleString('es-CO')} COP
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-stone-400">Ubicación:</span>
                          <span className={`font-semibold ${isOutside ? 'text-amber-300' : 'text-stone-200'}`}>
                            {booking.specificLocation || (isOutside ? 'Locación Especial / Fuera' : 'Sesión Local')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Fecha y Hora:</span>
                          <span className="font-semibold text-white">{formatDateTime12Hour(booking.dateTime)}</span>
                        </div>
                      </div>

                      {booking.description && (
                        <div className="mt-3 p-3 bg-stone-950/60 rounded-xl border border-stone-800 text-xs text-stone-300">
                          <span className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">Notas del cliente:</span>
                          "{booking.description}"
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5 pt-3 border-t border-stone-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={booking.status}
                            onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                            className="bg-stone-950 border border-stone-700 text-xs rounded-lg px-2 py-1.5 text-stone-300"
                          >
                            <option value="pending">Pendiente</option>
                            <option value="confirmed">Confirmar</option>
                            <option value="completed">Sesión Realizada</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => setEditingBooking({ ...booking })}
                            className="px-2 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Editar detalles de la reserva"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteBooking(booking.id, booking.clientName)}
                            className="p-1.5 bg-stone-800/80 hover:bg-red-950 text-stone-400 hover:text-red-400 rounded-lg text-xs transition-colors"
                            title="Eliminar reserva"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={getGoogleCalendarUrl(booking)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-stone-800 hover:bg-blue-950 text-stone-300 hover:text-blue-300 text-xs font-semibold px-2 py-1.5 rounded-lg border border-stone-700 transition-colors"
                            title="Añadir a Google Calendar"
                          >
                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                            <span className="hidden sm:inline">Google Cal</span>
                          </a>

                          <a
                            href={`https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(`¡Hola ${booking.clientName}! Te escribe Sebastian G respecto a tu reserva para el ${formatDateTime12Hour(booking.dateTime)}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-stone-700"
                            title="Abrir chat regular de WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Chat</span>
                          </a>
                        </div>
                      </div>

                      {/* BOTÓN PROMINENTE DE CONFIRMACIÓN OFICIAL POR WHATSAPP */}
                      <div>
                        <button
                          type="button"
                          onClick={() => handleOpenConfirmBookingModal(booking)}
                          className={`w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                            booking.status === 'confirmed'
                              ? 'bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300'
                              : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 shadow-amber-500/25 ring-2 ring-amber-400/40 animate-pulse'
                          }`}
                          title="Enviar mensaje oficial por WhatsApp confirmando la fecha y hora de la sesión"
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            {booking.status === 'confirmed'
                              ? '✓ Confirmada • Re-enviar WhatsApp'
                              : '⚡ Confirmar Sesión por WhatsApp'}
                          </span>
                        </button>
                      </div>

                      {/* BOTONES ADICIONALES: RECORDATORIO 24H Y RECIBO DIGITAL */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleSendReminder(booking)}
                          className="py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 bg-stone-950 hover:bg-stone-800 text-amber-300 border border-amber-500/30 hover:border-amber-400 transition-all shadow-sm"
                          title="Enviar recordatorio formal por WhatsApp a 24 horas de la cita"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">⏰ Recordar 24h</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(booking)}
                          className="py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 bg-stone-950 hover:bg-stone-800 text-stone-200 border border-stone-700 hover:border-stone-500 transition-all shadow-sm"
                          title="Generar comprobante de pago digital para imprimir o compartir"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">🧾 Recibo PDF</span>
                        </button>
                      </div>

                      {/* BOTÓN DIRECTO DE ENTREGA FULL HD PARA ESTA RESERVA */}
                      <div className="pt-2 border-t border-stone-800 space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            const matchingSession = safeSessions.find(
                              s => (s.clientWhatsApp && s.clientWhatsApp.replace(/\D/g, '') === clientPhoneClean) ||
                                  (s.clientName && s.clientName.toLowerCase().trim() === booking.clientName?.toLowerCase().trim())
                            );
                            handleOpenDelivery(matchingSession || {
                              id: `book-${booking.id}`,
                              token: booking.id,
                              clientName: booking.clientName,
                              clientWhatsApp: booking.clientWhatsApp,
                              packageType: booking.packageName,
                              status: booking.finalDeliveryUrl ? 'delivered' : 'pending',
                              finalDeliveryUrl: booking.finalDeliveryUrl || '',
                              deliveryService: booking.deliveryService || 'wetransfer',
                              deliveryNotes: booking.deliveryNotes || ''
                            });
                          }}
                          className={`w-full font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                            booking.finalDeliveryUrl
                              ? 'bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40'
                              : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white shadow-md shadow-purple-950/40 font-extrabold'
                          }`}
                        >
                          <PackageCheck className="w-4 h-4" />
                          <span>
                            {booking.finalDeliveryUrl
                              ? '✓ Editar / Re-enviar Entrega Full HD'
                              : '📦 Entregar Fotos en Calidad Original (Full HD)'}
                          </span>
                        </button>

                        {booking.finalDeliveryUrl && (
                          <a
                            href={getDeliveryWhatsAppUrl({
                              clientName: booking.clientName,
                              clientWhatsApp: booking.clientWhatsApp,
                              finalDeliveryUrl: booking.finalDeliveryUrl,
                              deliveryService: booking.deliveryService,
                              deliveryNotes: booking.deliveryNotes
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full font-bold text-xs py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shadow transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>📲 Enviar Enlace Full HD al WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL PARA EDITAR DETALLES DE CUALQUIER RESERVA EN TIEMPO REAL */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-4 flex items-center justify-center">
          <div className="relative w-full max-w-lg bg-stone-900 border border-stone-700 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-serif font-bold text-white">
                  Editar Reserva de {editingBooking.clientName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBookingEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-300 mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  value={editingBooking.clientName || ''}
                  onChange={(e) => setEditingBooking(prev => ({ ...prev, clientName: e.target.value }))}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">WhatsApp del Cliente</label>
                  <input
                    type="text"
                    value={editingBooking.clientWhatsApp || ''}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, clientWhatsApp: e.target.value }))}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Valor Cobrado ($ COP)</label>
                  <input
                    type="number"
                    value={editingBooking.totalPrice || 0}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, totalPrice: Number(e.target.value) }))}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Ubicación / Lugar de la Sesión</label>
                <input
                  type="text"
                  value={editingBooking.specificLocation || ''}
                  onChange={(e) => setEditingBooking(prev => ({ ...prev, specificLocation: e.target.value }))}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white"
                  placeholder="Ej: Playa Blanca, sector Las Cabañas"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Fecha y Hora (12 Horas)</label>
                  <input
                    type="text"
                    value={editingBooking.dateTime || ''}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, dateTime: e.target.value }))}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white"
                    placeholder="Ej: 30/09/2026 a las 3:00 p. m."
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">Estado de la Reserva</label>
                  <select
                    value={editingBooking.status || 'pending'}
                    onChange={(e) => setEditingBooking(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="confirmed">Confirmada</option>
                    <option value="completed">Sesión Realizada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-300 mb-1">Notas del Cliente / Descripción</label>
                <textarea
                  value={editingBooking.description || ''}
                  onChange={(e) => setEditingBooking(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white"
                  placeholder="Descripción de la sesión, ocasión, etc."
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="px-4 py-2 rounded-xl text-stone-400 hover:text-white bg-stone-800 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingBooking}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-bold text-xs hover:from-amber-400 hover:to-amber-300 disabled:opacity-50"
                >
                  {isSavingBooking ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PESTAÑA: PAGOS EN TIEMPO REAL (NEQUI, DAVIPLATA, DALE) */}
      {activeTab === 'payments' && (() => {
        const nequiPayments = payments.filter(p => p.method === 'nequi');
        const daviplataPayments = payments.filter(p => p.method === 'daviplata');
        const dalePayments = payments.filter(p => p.method === 'dale');

        const nequiSum = nequiPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const daviplataSum = daviplataPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const daleSum = dalePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const nequiBalance = (walletBaseBalances?.nequi || 0) + nequiSum;
        const daviplataBalance = (walletBaseBalances?.daviplata || 0) + daviplataSum;
        const daleBalance = (walletBaseBalances?.dale || 0) + daleSum;
        const totalSoftwareBalance = nequiBalance + daviplataBalance + daleBalance;

        const filteredPayments = selectedPaymentGateway === 'all'
          ? payments
          : payments.filter(p => p.method === selectedPaymentGateway);

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-serif font-bold text-white flex items-center gap-2.5">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  <span>Registro de Pagos y Saldos en Tiempo Real</span>
                </h3>
                <p className="text-xs text-stone-400">
                  Tus pasarelas oficiales de cobro digital (Nequi, DaviPlata, Dale!) sincronizadas con tu APK y WhatsApp en tiempo real.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setTempBalances({
                      nequi: walletBaseBalances?.nequi || 0,
                      daviplata: walletBaseBalances?.daviplata || 0,
                      dale: walletBaseBalances?.dale || 0
                    });
                    setIsAdjustingBalances(true);
                  }}
                  className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  title="Calibrar saldos base para que coincidan con tus cuentas bancarias reales"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Calibrar Saldos Reales</span>
                </button>
                <button
                  onClick={loadAllAdminData}
                  className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 flex items-center gap-1 text-xs self-start sm:self-auto"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {/* CONSOLIDADO DE SALDO TOTAL EN SOFTWARE */}
            <div className="bg-gradient-to-r from-stone-900 via-stone-900/90 to-stone-950 p-5 rounded-3xl border border-stone-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Saldo Total Consolidado en Software</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight flex items-baseline gap-2">
                    ${Number(totalSoftwareBalance).toLocaleString('es-CO')}
                    <span className="text-sm font-bold text-emerald-400">COP</span>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Suma en tiempo real de tus 3 billeteras (Saldos bancarios reales + {payments.length} transferencias registradas)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-black/60 px-3.5 py-2 rounded-2xl border border-purple-500/30">
                    <span className="text-[10px] text-stone-400 font-bold uppercase block">Nequi</span>
                    <span className="text-sm font-mono font-black text-purple-300">
                      ${Number(nequiBalance).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className="bg-black/60 px-3.5 py-2 rounded-2xl border border-red-500/30">
                    <span className="text-[10px] text-stone-400 font-bold uppercase block">DaviPlata</span>
                    <span className="text-sm font-mono font-black text-red-300">
                      ${Number(daviplataBalance).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className="bg-black/60 px-3.5 py-2 rounded-2xl border border-amber-500/30">
                    <span className="text-[10px] text-stone-400 font-bold uppercase block">Dale!</span>
                    <span className="text-sm font-mono font-black text-amber-300">
                      ${Number(daleBalance).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN OFICIAL DE BILLETERAS DIGITALES CON LOGOS VECTORIALES */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span>Tus Cuentas Oficiales para Recibir Pagos y Anticipos</span>
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Sincronizado en Tiempo Real</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <WalletAccountCard
                  walletType="nequi"
                  number="324 472 5167"
                  holderName="Sebastian Garcés"
                  copiedKey={copiedWalletKey}
                  onCopy={handleCopyWalletKey}
                  balance={nequiBalance}
                  transactionCount={nequiPayments.length}
                  isFiltered={selectedPaymentGateway === 'nequi'}
                  onFilterGateway={(gw) => setSelectedPaymentGateway(gw)}
                />
                <WalletAccountCard
                  walletType="daviplata"
                  number="@PLATA3244725167"
                  holderName="Sebastian Garcés"
                  copiedKey={copiedWalletKey}
                  onCopy={handleCopyWalletKey}
                  balance={daviplataBalance}
                  transactionCount={daviplataPayments.length}
                  isFiltered={selectedPaymentGateway === 'daviplata'}
                  onFilterGateway={(gw) => setSelectedPaymentGateway(gw)}
                />
                <WalletAccountCard
                  walletType="dale"
                  number="@SGG04"
                  holderName="Sebastian Garcés"
                  copiedKey={copiedWalletKey}
                  onCopy={handleCopyWalletKey}
                  balance={daleBalance}
                  transactionCount={dalePayments.length}
                  isFiltered={selectedPaymentGateway === 'dale'}
                  onFilterGateway={(gw) => setSelectedPaymentGateway(gw)}
                />
              </div>
            </div>

            {/* FILTROS POR PASARELA */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-stone-400 font-semibold">Filtrar historial:</span>
                <div className="flex items-center gap-1.5 bg-stone-900 p-1 rounded-xl border border-stone-800 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentGateway('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedPaymentGateway === 'all'
                        ? 'bg-amber-500 text-stone-950 shadow'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Todos ({payments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentGateway('nequi')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedPaymentGateway === 'nequi'
                        ? 'bg-[#ff007a] text-white shadow'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Nequi ({nequiPayments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentGateway('daviplata')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedPaymentGateway === 'daviplata'
                        ? 'bg-[#ed1c24] text-white shadow'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    DaviPlata ({daviplataPayments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentGateway('dale')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedPaymentGateway === 'dale'
                        ? 'bg-[#ffdd00] text-stone-950 shadow'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Dale! ({dalePayments.length})
                  </button>
                </div>
              </div>
              {selectedPaymentGateway !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedPaymentGateway('all')}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Limpiar filtro &times;
                </button>
              )}
            </div>

            {filteredPayments.length === 0 ? (
              <div className="p-8 sm:p-12 text-center bg-stone-900/60 border border-stone-800 rounded-3xl text-stone-400 space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <NequiLogo className="w-8 h-8" showText={false} />
                  <DaviPlataLogo className="w-8 h-8" showText={false} />
                  <DaleLogo className="w-8 h-8" showText={false} />
                </div>
                <h4 className="text-base font-bold text-stone-200">
                  {selectedPaymentGateway === 'all'
                    ? 'Billeteras Digitales Listas para Recibir Pagos'
                    : `No hay pagos registrados para ${selectedPaymentGateway.toUpperCase()}`}
                </h4>
                <p className="text-xs max-w-lg mx-auto text-stone-400 leading-relaxed">
                  Cuando tus clientes elijan fotos o impresiones en su galería y paguen por <strong>Nequi (324 472 5167)</strong>, <strong>DaviPlata (@PLATA3244725167)</strong> o <strong>Dale! (@SGG04)</strong>, sus transferencias aparecerán aquí en tiempo real con alerta y notificación instantánea a tu WhatsApp y APK.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPayments.map((payment) => {
                  const clientPhoneClean = (payment.clientWhatsApp || '').replace(/\D/g, '');
                  const methodBadge = {
                    nequi: { name: 'Nequi', key: '3244725167', color: 'bg-purple-900/60 text-purple-200 border-purple-500/40', logo: <NequiLogo className="w-4 h-4" showText={true} /> },
                    daviplata: { name: 'DaviPlata', key: '@PLATA3244725167', color: 'bg-red-900/60 text-red-200 border-red-500/40', logo: <DaviPlataLogo className="w-4 h-4" showText={true} /> },
                    dale: { name: 'Dale!', key: '@SGG04', color: 'bg-amber-900/60 text-amber-200 border-amber-500/40', logo: <DaleLogo className="w-4 h-4" showText={true} /> }
                  }[payment.method] || { name: payment.method, key: '', color: 'bg-stone-800 text-stone-300 border-stone-700', logo: null };

                  return (
                    <div
                      key={payment.id}
                      className="bg-stone-900 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors shadow-xl"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border bg-black/40 border-stone-800">
                            {methodBadge.logo || (
                              <span className="text-[10px] font-black uppercase text-stone-300">
                                {methodBadge.name}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-stone-400">
                              • {methodBadge.key}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${payment.status === 'verified' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                            {payment.status === 'verified' ? 'Verificado ✓' : 'Pendiente Verificación'}
                          </span>
                        </div>

                        <h4 className="text-xl font-serif font-bold text-white">
                          {payment.clientName}
                        </h4>

                        <div className="mt-1">
                          <a
                            href={`https://wa.me/${clientPhoneClean}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{payment.clientWhatsApp || 'Sin WhatsApp'} (Contactar)</span>
                          </a>
                        </div>

                        <div className="mt-4 p-3.5 rounded-2xl bg-stone-950 border border-stone-800/80 space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-stone-400">Monto Transferido:</span>
                            <span className="text-xl font-black text-emerald-400 font-mono">
                              ${Number(payment.amount || 0).toLocaleString('es-CO')} COP
                            </span>
                          </div>
                          <div className="flex justify-between text-stone-300">
                            <span className="text-stone-400">Referencia:</span>
                            <span className="font-mono font-bold text-white bg-stone-900 px-2 py-0.5 rounded border border-stone-800">
                              {payment.reference || 'Sin referencia'}
                            </span>
                          </div>
                          <div className="flex justify-between text-stone-300">
                            <span className="text-stone-400">Detalle Selección:</span>
                            <span className="font-medium text-amber-300">
                              {payment.extraPhotosCount || 0} fotos extra
                              {payment.printedPhotosCount > 0 ? ` + ${payment.printedPhotosCount} impresiones` : ''}
                            </span>
                          </div>
                          <div className="flex justify-between text-stone-400 text-[11px]">
                            <span>Fecha:</span>
                            <span>{new Date(payment.createdAt).toLocaleString('es-CO')}</span>
                          </div>
                        </div>

                        {payment.voucherUrl && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => setViewingVoucherModal(payment.voucherUrl)}
                              className="w-full bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded-xl p-2 flex items-center justify-between text-xs text-stone-300 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <img src={payment.voucherUrl} alt="Comprobante" className="w-8 h-8 rounded-lg object-cover" />
                                <span className="font-semibold text-emerald-400">Ver Comprobante Adjunto</span>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const newStatus = payment.status === 'verified' ? 'pending' : 'verified';
                            await updatePaymentStatus(payment.id, newStatus);
                            loadAllAdminData();
                          }}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                            payment.status === 'verified'
                              ? 'bg-stone-950 border-stone-700 text-stone-400 hover:text-white'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                          }`}
                        >
                          {payment.status === 'verified' ? 'Marcar Pendiente' : 'Aprobar Pago ✓'}
                        </button>

                        <a
                          href={`https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(`¡Hola ${payment.clientName}! Te escribe Sebastian G. Hemos recibido y verificado tu pago de $${Number(payment.amount || 0).toLocaleString('es-CO')} COP con éxito. ¡Muchas gracias!`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Confirmar</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MODAL PARA CALIBRAR SALDOS REALES */}
            {isAdjustingBalances && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-amber-400" />
                      <h4 className="text-lg font-serif font-bold text-white">
                        Calibrar Saldos Bancarios Reales
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAdjustingBalances(false)}
                      className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-stone-400 leading-relaxed">
                    Ingresa el saldo real que tienes actualmente en cada una de tus cuentas bancarias. El software sumará automáticamente los nuevos pagos que tus clientes realicen.
                  </p>

                  <div className="space-y-3.5">
                    <div>
                      <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5 mb-1">
                        <NequiLogo className="w-3.5 h-3.5" showText={false} />
                        <span>Saldo Base Nequi (COP):</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={tempBalances.nequi}
                        onChange={(e) => setTempBalances(prev => ({ ...prev, nequi: Number(e.target.value) || 0 }))}
                        className="w-full bg-stone-950 border border-purple-500/30 focus:border-[#ff007a] rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm outline-none transition-all"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5 mb-1">
                        <DaviPlataLogo className="w-3.5 h-3.5" showText={false} />
                        <span>Saldo Base DaviPlata (COP):</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={tempBalances.daviplata}
                        onChange={(e) => setTempBalances(prev => ({ ...prev, daviplata: Number(e.target.value) || 0 }))}
                        className="w-full bg-stone-950 border border-red-500/30 focus:border-[#ed1c24] rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm outline-none transition-all"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5 mb-1">
                        <DaleLogo className="w-3.5 h-3.5" showText={false} />
                        <span>Saldo Base Dale! (COP):</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={tempBalances.dale}
                        onChange={(e) => setTempBalances(prev => ({ ...prev, dale: Number(e.target.value) || 0 }))}
                        className="w-full bg-stone-950 border border-amber-500/30 focus:border-[#ffdd00] rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAdjustingBalances(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-stone-400 hover:text-white bg-stone-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await saveWalletBaseBalances(tempBalances);
                        setWalletBaseBalances(tempBalances);
                        setIsAdjustingBalances(false);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-stone-950 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 shadow-lg shadow-amber-500/20"
                    >
                      Guardar Saldos Reales
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* PESTAÑA: OPINIONES Y RESEÑAS DE CLIENTES */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-serif font-bold text-white flex items-center gap-2.5">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span>Opiniones & Satisfacción de Clientes</span>
              </h3>
              <p className="text-xs text-stone-400">
                Reseñas dejadas por clientes al recibir sus fotos finales en la galería digital. Se muestran públicamente en la página principal.
              </p>
            </div>
            <button
              onClick={loadAllAdminData}
              className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 flex items-center gap-1 text-xs self-start sm:self-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
              <span>Actualizar Opiniones</span>
            </button>
          </div>

          {/* TARJETAS RESUMEN DE SATISFACCIÓN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-stone-900/80 border border-stone-800 p-4 rounded-2xl">
              <span className="text-xs text-stone-400 font-semibold block mb-1">Calificación Promedio</span>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {reviewsList.length > 0 ? '5.0' : '0.0'}
                </span>
                <div className="flex items-center gap-0.5 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${reviewsList.length > 0 ? 'fill-amber-400' : 'text-stone-700'}`} />
                  ))}
                </div>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold block mt-1">
                {reviewsList.length > 0 ? '100% Calificaciones 5 estrellas' : 'Sin calificaciones aún'}
              </span>
            </div>

            <div className="bg-stone-900/80 border border-stone-800 p-4 rounded-2xl">
              <span className="text-xs text-stone-400 font-semibold block mb-1">Recomendación</span>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {reviewsList.length > 0 ? '100%' : '0%'}
                </span>
                <CheckCircle2 className={`w-5 h-5 ${reviewsList.length > 0 ? 'text-emerald-400' : 'text-stone-600'}`} />
              </div>
              <span className="text-[10px] text-stone-400 block mt-1">
                {reviewsList.length > 0 ? 'Todos los clientes recomiendan tu trabajo' : 'Pendiente de opiniones reales'}
              </span>
            </div>

            <div className="bg-stone-900/80 border border-stone-800 p-4 rounded-2xl">
              <span className="text-xs text-stone-400 font-semibold block mb-1">Total de Reseñas</span>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-white font-mono">{reviewsList.length}</span>
                <Users className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-[10px] text-amber-400 block mt-1">
                {reviewsList.length > 0 ? 'Visibles en la página central' : 'Se mostrarán en la portada al recibirlas'}
              </span>
            </div>
          </div>

          {/* LISTA DE OPINIONES */}
          {reviewsList.length === 0 ? (
            <div className="p-8 sm:p-12 text-center bg-stone-900/60 border border-stone-800 rounded-3xl text-stone-400 space-y-3">
              <Star className="w-10 h-10 text-amber-400/30 mx-auto stroke-[1.5]" />
              <h4 className="text-base font-bold text-stone-200">
                Aún no hay opiniones de clientes registradas
              </h4>
              <p className="text-xs max-w-lg mx-auto text-stone-400 leading-relaxed">
                Cuando tus clientes reciban la entrega de sus fotos en su galería digital, se les habilitará automáticamente la opción de calificar tu servicio con estrellas, comentario y recomendación, y aparecerán aquí y en la página central.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviewsList.map((review, idx) => (
                <div
                  key={review.id || idx}
                  className="bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 rounded-3xl p-5 flex flex-col justify-between shadow-xl transition-all space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[...Array(review.rating || 5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                        ))}
                      </div>
                      {review.recommends && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Recomienda</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-stone-200 italic leading-relaxed">
                      "{review.comment || review.comments || 'Excelente servicio y fotos de máxima calidad.'}"
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-white">
                        {review.clientName || 'Cliente Satisfecho'}
                      </h5>
                      <span className="text-[10px] text-amber-400/90 font-medium">
                        {review.sessionType || review.packageTitle || 'Sesión Fotográfica'}
                      </span>
                    </div>
                    {review.date && (
                      <span className="text-[10px] text-stone-400 font-mono">
                        {review.date}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA: ANALÍTICAS Y TRÁFICO EN VIVO */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-serif font-bold text-white">
                Métricas & Tráfico en Vivo
              </h3>
              <p className="text-xs text-stone-400">
                Monitoreo en tiempo real de visitantes, visitas de hoy y enlaces compartidos.
              </p>
            </div>
            <button
              onClick={() => setAnalyticsStats(getLocalAnalytics())}
              className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 flex items-center gap-1 text-xs self-start sm:self-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Actualizar Métricas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 text-left shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Visitas Totales</span>
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Eye className="w-5 h-5" />
                </div>
              </div>
              <span className="text-4xl font-black text-white font-mono block">
                {analyticsStats.totalVisits}
              </span>
              <p className="text-xs text-stone-400 mt-2">
                Personas que han ingresado a explorar tu portafolio y paquetes fotográficos.
              </p>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 text-left shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Visitas de Hoy</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <span className="text-4xl font-black text-emerald-400 font-mono block">
                {analyticsStats.todayVisits}
              </span>
              <p className="text-xs text-stone-400 mt-2">
                Tráfico registrado el día de hoy ({analyticsStats.todayDate}).
              </p>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 text-left shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-pink-400">Veces Compartido</span>
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                  <Share2 className="w-5 h-5" />
                </div>
              </div>
              <span className="text-4xl font-black text-white font-mono block">
                {analyticsStats.totalShares}
              </span>
              <p className="text-xs text-stone-400 mt-2">
                Veces que los clientes o visitantes han compartido el enlace de tu web a sus contactos.
              </p>
            </div>
          </div>

          {/* Desglose por canales */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 text-left">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Canales de Difusión del Enlace
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800">
                <span className="text-xs text-stone-400 block mb-1">Compartido por WhatsApp</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">{analyticsStats.sharesByChannel?.whatsapp || 0}</span>
              </div>
              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800">
                <span className="text-xs text-stone-400 block mb-1">Enlace Copiado al Portapapeles</span>
                <span className="text-2xl font-black text-blue-400 font-mono">{analyticsStats.sharesByChannel?.copy_link || 0}</span>
              </div>
              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800">
                <span className="text-xs text-stone-400 block mb-1">Compartido Nativo (Celular)</span>
                <span className="text-2xl font-black text-purple-400 font-mono">{analyticsStats.sharesByChannel?.native || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: PROGRAMA DE FIDELIZACIÓN VIP */}
      {activeTab === 'loyalty' && (
        <div className="space-y-6 text-left">
          <div>
            <h3 className="text-xl font-serif font-bold text-white">
              Programa de Fidelización & Clientes VIP
            </h3>
            <p className="text-xs text-stone-400">
              Detección automática por número de WhatsApp con aplicación automática de 15% de descuento en sesiones recurrentes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-amber-950/50 via-stone-900 to-stone-900 border border-amber-500/40 rounded-3xl p-6 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <Crown className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-serif font-bold text-white mb-2">
                Fidelización Automática (15% OFF)
              </h4>
              <p className="text-xs text-stone-300 leading-relaxed mb-4">
                Cuando un cliente que ya realizó una sesión contigo vuelve a ingresar su número de WhatsApp para reservar o seleccionar fotos, la plataforma lo reconoce al instante como <strong>Cliente VIP</strong> y le otorga un <strong>15% de descuento directo</strong>.
              </p>
              <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 space-y-1.5 text-xs text-stone-300">
                <div className="flex justify-between">
                  <span className="text-stone-400">Descuento aplicado:</span>
                  <span className="font-bold text-amber-400">15% de Descuento</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Activación:</span>
                  <span className="font-semibold text-emerald-400">Automática por WhatsApp</span>
                </div>
              </div>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                Clientes Recurrentes Registrados
              </h4>
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div key={b.id} className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">{b.clientName}</span>
                      <span className="text-[11px] text-stone-400">{b.clientWhatsApp}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Cliente VIP (15% OFF)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: SUBIR FOTOS PARA CLIENTE CON CALIDAD LIGHTROOM ULTRA HD */}
      {activeTab === 'create-session' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Calidad Lightroom Ultra HD • 3 Días de Vigencia
            </span>
            <h3 className="text-2xl font-serif font-bold text-white">
              Crear Galería Privada para Selección del Cliente
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Sube tus fotos editadas desde tu celular o PC. Conservan la nitidez, rango dinámico y colorimetría de Lightroom, protegidas con tu marca de agua central gigante de <strong>Sebastian G</strong>.
            </p>
          </div>

          {createdSessionResult && (
            <div className="bg-emerald-950/90 border-2 border-emerald-500 rounded-3xl p-6 text-emerald-200 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 font-bold text-base text-white">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">¡Enlace Protegido Creado con Éxito!</h4>
                  <p className="text-xs text-emerald-300">
                    Cliente: <strong>{createdSessionResult.session.clientName}</strong> • Vigencia exacta de 3 días
                  </p>
                </div>
              </div>
              
              {(() => {
                const sessionBaseUrl = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http'))
                  ? window.location.origin
                  : 'https://sebastiang.app';
                const galleryFullUrl = `${sessionBaseUrl}/galeria/${createdSessionResult.session.token}`;
                let clientPhoneDigits = (createdSessionResult.session.clientWhatsApp || '').replace(/\D/g, '');
                if (clientPhoneDigits.length === 10 && !clientPhoneDigits.startsWith('57')) {
                  clientPhoneDigits = '57' + clientPhoneDigits;
                }

                return (
                  <>
                    <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 text-xs font-mono break-all text-amber-300 flex items-center justify-between gap-2">
                      <span className="select-all">{galleryFullUrl}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(galleryFullUrl)}
                        className="p-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded-lg shrink-0 active:scale-95"
                        title="Copiar"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <a
                        href={`https://wa.me/${clientPhoneDigits}?text=${encodeURIComponent(
                          `📸 *¡Hola ${createdSessionResult.session.clientName}! Ya están listas las fotografías de tu sesión con Sebastian G para que elijas tus favoritas.*\n\n` +
                          `👉 *Ingresa a tu galería privada aquí:*\n${galleryFullUrl}\n\n` +
                          `⏰ *Importante:* Tienes exactamente *3 días* para hacer tu selección antes de que el enlace expire automáticamente.\n\n` +
                          `📞 *Contacto:* Sebastian G • +57 324 472 5167 (Línea 1)\n\n` +
                          `✨ Toca cualquier foto para elegirla. ¡Quedo muy atento a tus elecciones!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs py-3.5 px-3 rounded-xl shadow-lg shadow-emerald-600/30 active:scale-98 transition-all"
                      >
                        <Share2 className="w-4 h-4 shrink-0" />
                        <span>📲 Enviar vía Línea 1 (324...)</span>
                      </a>

                      <a
                        href={`https://wa.me/${clientPhoneDigits}?text=${encodeURIComponent(
                          `📸 *¡Hola ${createdSessionResult.session.clientName}! Ya están listas las fotografías de tu sesión con Sebastian G para que elijas tus favoritas.*\n\n` +
                          `👉 *Ingresa a tu galería privada aquí:*\n${galleryFullUrl}\n\n` +
                          `⏰ *Importante:* Tienes exactamente *3 días* para hacer tu selección antes de que el enlace expire automáticamente.\n\n` +
                          `📞 *Contacto:* Sebastian G • +57 302 369 6513 (Línea 2)\n\n` +
                          `✨ Toca cualquier foto para elegirla. ¡Quedo muy atento a tus elecciones!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white font-extrabold text-xs py-3.5 px-3 rounded-xl shadow-lg shadow-emerald-700/30 active:scale-98 transition-all"
                      >
                        <Share2 className="w-4 h-4 shrink-0" />
                        <span>📲 Enviar vía Línea 2 (302...)</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(galleryFullUrl)}
                        className="px-3.5 py-3.5 bg-stone-900 border border-stone-700 hover:bg-stone-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                        <span>{copiedLink ? '¡Copiado!' : 'Copiar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenGalleryToken(createdSessionResult.session.token)}
                        className="px-3.5 py-3.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-amber-500/20 shrink-0"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Ver Galería</span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <form onSubmit={handleCreateSession} className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={newSessionForm.clientName}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, clientName: e.target.value })}
                  placeholder="Ej. Jennifer Vásquez"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  WhatsApp del Cliente *
                </label>
                <input
                  type="tel"
                  required
                  value={newSessionForm.clientWhatsApp}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, clientWhatsApp: e.target.value })}
                  placeholder="Ej. 310 555 1234"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Paquete Contratado
                </label>
                <select
                  value={newSessionForm.packageId}
                  onChange={(e) => handlePackageSelectChange(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-3 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  {packages.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (+2 Gratis) — Total {p.totalPhotos || (p.photoCount + 2)} fotos
                    </option>
                  ))}
                  <option value="custom">Otro / Personalizado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Fotos que Puede Elegir el Cliente
                </label>
                <input
                  type="number"
                  min={1}
                  value={newSessionForm.maxPhotosAllowed}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, maxPhotosAllowed: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-stone-800">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-amber-400" />
                  <span>Subir Fotos de la Sesión *</span>
                </label>

                <button
                  type="button"
                  onClick={() => setUseUrlMode(!useUrlMode)}
                  className="text-[11px] text-stone-400 hover:text-amber-400 underline"
                >
                  {useUrlMode ? 'Cambiar a Selector de Celular/PC' : 'O pegar URLs de fotos'}
                </button>
              </div>

              {!useUrlMode ? (
                <div className="space-y-4">
                  <div
                    className="relative cursor-pointer border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-stone-950/80 hover:bg-stone-950 rounded-2xl p-6 sm:p-8 text-center transition-all group overflow-hidden"
                  >
                    {/* Input nativo que cubre el 100% del recuadro para que cualquier toque en la pantalla lo abra */}
                    <input
                      id="session-photo-file-input"
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFilesChosen}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />

                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3 group-hover:scale-110 transition-transform pointer-events-none">
                      <Upload className="w-8 h-8" />
                    </div>

                    <h5 className="text-base font-bold text-white mb-1 pointer-events-none">
                      Toca aquí para seleccionar las fotos desde tu Celular o PC
                    </h5>
                    <p className="text-xs text-stone-400 max-w-md mx-auto pointer-events-none">
                      Toca en cualquier parte de este recuadro para abrir la galería de tu celular. Puedes seleccionar varias fotos a la vez.
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 text-xs font-bold px-5 py-2.5 rounded-xl shadow-md pointer-events-none">
                      <FileImage className="w-4 h-4" />
                      <span>Abrir Galería de Fotos</span>
                    </div>
                  </div>

                  {isProcessingPhotos && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
                      <div className="text-xs text-stone-200 flex-1">
                        <span className="font-bold text-amber-400">Procesando fotos en alta calidad... </span>
                        <span>{processProgress.current} de {processProgress.total}</span>
                      </div>
                    </div>
                  )}

                  {uploadedPhotos.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>{uploadedPhotos.length} fotos preparadas para la sesión</span>
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-stone-950 px-2.5 py-1 rounded-lg border border-stone-800"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar más</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleClearAllPhotos}
                            className="text-[11px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 bg-stone-950 px-2.5 py-1 rounded-lg border border-stone-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Limpiar</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-80 overflow-y-auto p-2 bg-stone-950 rounded-2xl border border-stone-800">
                        {uploadedPhotos.map((photo, idx) => (
                          <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square bg-stone-900 border border-stone-800">
                            <img
                              src={photo.url}
                              alt={photo.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(photo.id)}
                                className="self-end p-1 bg-red-600 hover:bg-red-500 text-white rounded-md shadow-md"
                                title="Eliminar foto"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <span className="text-[10px] font-bold text-white text-center">
                                #{idx + 1}
                              </span>
                            </div>
                            <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded group-hover:opacity-0 transition-opacity">
                              #{idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    value={newSessionForm.photoUrlsText}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, photoUrlsText: e.target.value })}
                    placeholder="Pega las URLs de tus fotos (una por línea)..."
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <p className="text-[11px] text-stone-500">
                    Pega una dirección web de imagen por línea.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isCreatingSession || isProcessingPhotos}
              className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-extrabold text-sm py-4 rounded-xl shadow-xl shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCreatingSession ? (
                <span>Creando galería protegida...</span>
              ) : (
                <>
                  <Clock className="w-5 h-5 fill-stone-950" />
                  <span>
                    Generar Enlace Seguro (Vigencia 3 Días)
                    {uploadedPhotos.length > 0 && ` • Con ${uploadedPhotos.length} Fotos`}
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* PESTAÑA 3: SESIONES Y SELECCIONES */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-serif font-bold text-white">
                Galerías de Clientes y Fotos Seleccionadas
              </h3>
              <p className="text-xs text-stone-400">
                Visualiza qué fotos eligió cada cliente y qué retoques u observaciones solicitaron.
              </p>
            </div>
            <button
              onClick={loadAllAdminData}
              className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 flex items-center gap-1 text-xs"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {safeSessions.length === 0 ? (
            <div className="p-12 text-center bg-stone-900 border border-stone-800 rounded-3xl text-stone-400">
              No has creado sesiones de clientes todavía. Usa la pestaña "Subir Fotos" para generar un nuevo enlace seguro para tus clientes.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {safeSessions.map((session) => {
                const selectedPhotos = (session.photos || []).filter(p => p.selected);
                const isSubmitted = session.status === 'submitted';

                return (
                  <div
                    key={session.id || session.token}
                    className="bg-stone-900 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                            session.status === 'delivered'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5'
                              : isSubmitted
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : session.isExpired
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {session.status === 'delivered' ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                              <span>✓ Entregada en Full HD</span>
                            </>
                          ) : isSubmitted ? (
                            '✓ Selección Enviada por Cliente'
                          ) : session.isExpired ? (
                            'Expirada (3 días)'
                          ) : (
                            'Esperando Selección'
                          )}
                        </span>

                        <span className="text-xs text-stone-400 font-mono">
                          Token: {session.token}
                        </span>
                      </div>

                      <h4 className="text-xl font-serif font-bold text-white">
                        {session.clientName}
                      </h4>
                      <p className="text-xs text-stone-400">{session.clientWhatsApp} • {session.packageTitle}</p>

                      <div className="mt-4 p-3.5 bg-stone-950 rounded-2xl border border-stone-800 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-stone-400">Total fotos en sesión:</span>
                          <span className="font-semibold text-white">{session.totalPhotos || session.photos?.length || 0} fotos</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Fotos elegidas por cliente:</span>
                          <span className={`font-bold ${selectedPhotos.length > 0 ? 'text-amber-400 font-mono text-sm' : 'text-stone-400'}`}>
                            {selectedPhotos.length} fotos {isSubmitted && '✓'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Vencimiento del enlace:</span>
                          <span className="font-medium text-stone-300">
                            {new Date(session.expiresAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {session.status === 'delivered' && session.finalDeliveryUrl && (
                        <div className="mt-3 p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-purple-300 font-bold flex items-center gap-1.5">
                              <PackageCheck className="w-4 h-4 text-purple-400" />
                              <span>Fotos Entregadas en Full HD</span>
                            </span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-500/40">
                              {session.deliveryService || 'WeTransfer'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <a
                              href={session.finalDeliveryUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-400 hover:underline truncate max-w-[210px] text-[11px] font-mono flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <span className="truncate">{session.finalDeliveryUrl}</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(session.finalDeliveryUrl)}
                              className="text-[10px] bg-stone-900 hover:bg-stone-800 text-stone-300 px-2 py-1 rounded-md border border-stone-700 shrink-0"
                            >
                              Copiar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-stone-800">
                      {/* BOTÓN DE ENTREGA DE FOTOS EN MÁXIMA CALIDAD */}
                      <button
                        type="button"
                        onClick={() => handleOpenDelivery(session)}
                        className={`w-full font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                          session.status === 'delivered'
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-950/50'
                            : selectedPhotos.length > 0 || isSubmitted
                            ? 'bg-gradient-to-r from-emerald-600 via-amber-500 to-amber-400 hover:opacity-95 text-stone-950 shadow-md font-extrabold'
                            : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                        }`}
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>
                          {session.status === 'delivered'
                            ? '✓ Editar / Re-enviar Entrega Full HD (WeTransfer)'
                            : '📦 Entregar Fotos Finales en Calidad Original (Full HD)'}
                        </span>
                      </button>

                      {session.status === 'delivered' && session.finalDeliveryUrl && (
                        <a
                          href={getDeliveryWhatsAppUrl(session)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full font-bold text-xs py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-md transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>📲 Enviar Enlace Full HD al WhatsApp del Cliente</span>
                        </a>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingSession(session)}
                          className={`flex-1 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                            selectedPhotos.length > 0 
                              ? 'bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/30'
                              : 'bg-stone-800 hover:bg-stone-700 text-stone-400'
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                          <span>Ver Selección ({selectedPhotos.length})</span>
                        </button>

                        <button
                          onClick={() => onOpenGalleryToken(session.token)}
                          title="Ver enlace como cliente"
                          className="p-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-stone-400 pt-1">
                        <button
                          onClick={() => copyToClipboard(`${window.location.origin}/galeria/${session.token}`)}
                          className="hover:text-amber-400 flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar link</span>
                        </button>

                        <a
                          href={`https://wa.me/${session.clientWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `📸 *¡Hola ${session.clientName}! Aquí tienes nuevamente el enlace a tu galería para elegir tus fotos:*\n\n${window.location.origin}/galeria/${session.token}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-emerald-400 flex items-center gap-1 text-emerald-400 font-semibold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Enviar WhatsApp</span>
                        </a>

                        <button
                          onClick={() => handleReopenSession(session.id)}
                          className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reabrir</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSession(session, session.clientName, session.token)}
                          className="text-stone-500 hover:text-red-400 flex items-center gap-1 font-semibold transition-colors"
                          title="Eliminar esta galería de cliente"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400/80" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 4: GESTIONAR CATÁLOGO PÚBLICO (SUBIR FOTOS PROMOCIONALES) */}
      {activeTab === 'catalog-manager' && (
        <div className="space-y-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Portafolio & Promoción
            </span>
            <h3 className="text-2xl font-serif font-bold text-white">
              Gestionar Catálogo Público
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Sube tus mejores fotos para que aparezcan en la página principal, atraigan nuevos clientes y promocionen tus paquetes de fotos en San Antero.
            </p>
          </div>

          {/* FORMULARIO PARA SUBIR FOTO AL CATÁLOGO */}
          <form onSubmit={handleAddCatalogPhotoSubmit} className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-5">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Subir Nueva Foto al Catálogo</span>
            </h4>

            {catalogUploadSuccess && (
              <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{catalogUploadSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Título de la Foto *
                </label>
                <input
                  type="text"
                  required
                  value={newCatalogForm.title}
                  onChange={(e) => setNewCatalogForm({ ...newCatalogForm, title: e.target.value })}
                  placeholder="Ej. Atardecer en Playa Blanca"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Categoría *
                </label>
                <select
                  value={newCatalogForm.category}
                  onChange={(e) => setNewCatalogForm({ ...newCatalogForm, category: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Playas San Antero">Playas San Antero</option>
                  <option value="Retratos">Retratos</option>
                  <option value="Parejas & Bodas">Parejas & Bodas</option>
                  <option value="Quinceañeras">Quinceañeras</option>
                  <option value="custom">Otra categoría personalizada...</option>
                </select>
              </div>

              {newCatalogForm.category === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                    Nombre de Nueva Categoría *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCatalogForm.customCategory}
                    onChange={(e) => setNewCatalogForm({ ...newCatalogForm, customCategory: e.target.value })}
                    placeholder="Ej. Eventos Familiares"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Locación
                </label>
                <input
                  type="text"
                  value={newCatalogForm.location}
                  onChange={(e) => setNewCatalogForm({ ...newCatalogForm, location: e.target.value })}
                  placeholder="Ej. Playa Blanca, San Antero"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Selector de Método de Subida: Archivo vs Link */}
            <div className="pt-1 space-y-3">
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider">
                Método para Cargar la Foto *
              </label>
              <div className="flex flex-wrap items-center gap-2 p-1 bg-stone-950 rounded-2xl border border-stone-800 w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setCatalogUploadMode('file');
                    setNewCatalogForm(prev => ({ ...prev, url: '' }));
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    catalogUploadMode === 'file'
                      ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Subir Archivo (Celular / PC)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogUploadMode('link');
                    setNewCatalogForm(prev => ({ ...prev, url: '' }));
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    catalogUploadMode === 'link'
                      ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Pegar Enlace / Link de Foto</span>
                </button>
              </div>
            </div>

            {/* OPCIÓN 1: SUBIR DESDE DISPOSITIVO (CELULAR / PC) */}
            {catalogUploadMode === 'file' && (
              <div className="space-y-2">
                <div
                  onClick={() => catalogFileInputRef.current?.click()}
                  className="w-full cursor-pointer border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-stone-950/80 hover:bg-stone-950 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 transition-all group"
                >
                  <input
                    ref={catalogFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCatalogPhotoSelected}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-white">
                    {isUploadingCatalogPhoto ? 'Procesando foto en alta fidelidad...' : 'Toca para seleccionar foto desde tu galería o computador'}
                  </span>
                  <p className="text-[11px] text-stone-400">
                    JPG, PNG o WEBP • Mantiene el revelado y colores de Adobe Lightroom
                  </p>
                </div>
              </div>
            )}

            {/* OPCIÓN 2: PEGAR ENLACE DIRECTO O LINK DE NUBE */}
            {catalogUploadMode === 'link' && (
              <div className="space-y-2 bg-stone-950 p-4 rounded-2xl border border-stone-800">
                <label className="block text-xs font-semibold text-stone-200">
                  🔗 Enlace o Link de la Foto (Google Drive, Dropbox, Lightroom, Unsplash, Imgur, etc.)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={catalogLinkInput}
                    onChange={handleCatalogLinkChange}
                    placeholder="Pega aquí el link: https://drive.google.com/file/d/... o link directo"
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                  />
                  <LinkIcon className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    <strong>Autoconversión inteligente:</strong> Si pegas un enlace compartido de Google Drive o Dropbox, el sistema lo transforma automáticamente en enlace directo para que cargue al instante.
                  </span>
                </div>
              </div>
            )}

            {/* VISTA PREVIA Y BOTÓN DE PUBLICACIÓN SIMULTÁNEA */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-stone-800/80">
              {newCatalogForm.url ? (
                <div className="flex items-center gap-3 bg-stone-950 p-2.5 rounded-2xl border border-stone-800 w-full sm:w-auto">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-black shrink-0 border border-amber-500/30">
                    <img 
                      src={newCatalogForm.url} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Foto lista para publicar
                    </span>
                    <span className="text-[11px] text-stone-400 block truncate max-w-[220px]">
                      {catalogUploadMode === 'link' ? 'Cargada desde enlace web' : 'Archivo de dispositivo'}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-stone-500 italic">
                  * Selecciona un archivo o pega un enlace para habilitar la publicación
                </span>
              )}

              <button
                type="submit"
                disabled={!newCatalogForm.url || isUploadingCatalogPhoto}
                className="w-full sm:w-auto ml-auto bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-black text-xs py-3.5 px-8 rounded-xl shadow-lg shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 fill-stone-950" />
                <span>{isUploadingCatalogPhoto ? 'Publicando en tiempo real...' : '+ Publicar en Catálogo'}</span>
              </button>
            </div>
          </form>

          {/* LISTADO DE FOTOS ACTIVAS DEL CATÁLOGO */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900/60 p-4 rounded-2xl border border-stone-800">
              <div>
                <h4 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-400" />
                  <span>Fotos Publicadas en el Catálogo ({catalog.length})</span>
                </h4>
                <p className="text-xs text-stone-400 mt-0.5">
                  Estas fotos se exhiben en la página principal para que los clientes vean tu portafolio en San Antero.
                </p>
              </div>

              {catalog.some(item => isSampleItem(item)) && (
                <button
                  type="button"
                  onClick={handleDeleteAllSamples}
                  disabled={purgeSamplesLoading}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                  title="Eliminar todas las fotos de muestra predeterminadas (Unsplash)"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span>{purgeSamplesLoading ? 'Quitando...' : '🗑️ Quitar Fotos de Muestra'}</span>
                </button>
              )}
            </div>

            {purgeSamplesSuccess && (
              <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs flex items-center gap-2.5 shadow-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{purgeSamplesSuccess}</span>
              </div>
            )}

            {catalog.length === 0 ? (
              <div className="p-12 text-center bg-stone-900/40 border border-dashed border-stone-800 rounded-3xl">
                <Camera className="w-12 h-12 text-stone-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-stone-300">Aún no hay fotos en tu catálogo</p>
                <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                  Usa el botón "Seleccionar Foto de tu Galería" arriba para publicar tus fotos editadas de Lightroom. Solo aparecerán las fotos que tú subas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {catalog.map((item) => {
                  const isSample = isSampleItem(item);
                  return (
                    <div key={item.id} className="group relative bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-md flex flex-col justify-between">
                      <div className="aspect-[4/5] bg-stone-950 relative overflow-hidden">
                        <img 
                          src={item.url} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          loading="lazy"
                        />
                        {isSample ? (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-amber-500/90 text-stone-950 shadow-md">
                            Muestra Demo
                          </span>
                        ) : (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-emerald-600/90 text-white shadow-md">
                            Tu Foto
                          </span>
                        )}

                        {/* Botón eliminar de catálogo */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCatalogItem(item)}
                          className="absolute top-2 right-2 p-2 bg-red-600/90 hover:bg-red-500 text-white rounded-xl shadow-lg transition-transform active:scale-95"
                          title="Eliminar foto del catálogo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="p-3 bg-stone-900 border-t border-stone-800/80">
                        <span className="text-[10px] font-bold text-amber-400 uppercase block">{item.category}</span>
                        <h5 className="text-xs font-bold text-white truncate">{item.title}</h5>
                        <p className="text-[11px] text-stone-400 truncate">{item.location}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 5: ACTUALIZAR PRECIOS DE FOTOS Y PAQUETES */}
      {activeTab === 'pricing-manager' && (
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Tarifas Oficiales
            </span>
            <h3 className="text-2xl font-serif font-bold text-white">
              Actualizar Precios de Fotos & Paquetes
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Modifica los valores cobrados por cada paquete fotográfico y servicios adicionales. Los cambios se guardan y se sincronizan al instante en la página web.
            </p>
          </div>

          {priceSaveSuccess && (
            <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs flex items-center gap-2.5 shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">{priceSaveSuccess}</span>
            </div>
          )}

          {/* FORMULARIO DE EDICIÓN DE PRECIOS */}
          <form onSubmit={handleSaveAllPrices} className="space-y-6">
            
            {/* GRID DE PAQUETES */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-stone-300 flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <span>Precios de los Paquetes Digitales</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editablePackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-white text-base font-serif">
                          {pkg.name}
                        </h5>
                        <span className="text-[11px] text-amber-400 font-semibold">
                          {pkg.photoCount} Fotos (+2 Gratis = Total {pkg.totalPhotos || pkg.photoCount + 2})
                        </span>
                      </div>

                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-stone-300">
                        <input
                          type="checkbox"
                          checked={Boolean(pkg.popular)}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setEditablePackages(prev => prev.map(p => ({
                              ...p,
                              popular: p.id === pkg.id ? isChecked : (isChecked ? false : p.popular)
                            })));
                          }}
                          className="rounded border-stone-700 text-amber-500 focus:ring-amber-500 bg-stone-950"
                        />
                        <span>Más Popular</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-800/80">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-300 uppercase mb-1">
                          Precio en COP ($) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                          <input
                            type="number"
                            required
                            min={1000}
                            step={1000}
                            value={pkg.price}
                            onChange={(e) => handlePackagePriceChange(pkg.id, e.target.value)}
                            className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-stone-300 uppercase mb-1">
                          Cantidad de Fotos *
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={pkg.photoCount}
                          onChange={(e) => handlePackagePhotoCountChange(pkg.id, e.target.value)}
                          className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-sm font-mono font-semibold text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TARIFAS ADICIONALES */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-stone-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>Tarifas Adicionales de la Sesión</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-300 uppercase mb-1">
                    Precio por Foto Impresa 10x15 ($ COP)
                  </label>
                  <p className="text-[11px] text-stone-400 mb-2">
                    Cobrado cuando el cliente solicita fotos impresas adicionales en el formulario.
                  </p>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min={0}
                      step={500}
                      value={editablePrintedPhotoPrice}
                      onChange={(e) => setEditablePrintedPhotoPrice(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-300 uppercase mb-1">
                    Recargo por Sesión Fuera de San Antero ($ COP)
                  </label>
                  <p className="text-[11px] text-stone-400 mb-2">
                    Se añade de manera silenciosa al precio si la locación es fuera del municipio.
                  </p>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min={0}
                      step={1000}
                      value={editableSurcharge}
                      onChange={(e) => setEditableSurcharge(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-8 pr-3 py-2.5 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÓN GUARDAR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <p className="text-xs text-stone-400">
                Al guardar, los nuevos precios se aplican inmediatamente en el catálogo y formulario de reservas.
              </p>

              <button
                type="submit"
                disabled={isSavingPrices}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-extrabold text-sm py-3.5 px-8 rounded-xl shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className={`w-4 h-4 ${isSavingPrices ? 'animate-spin' : ''}`} />
                <span>{isSavingPrices ? 'Guardando Precios...' : 'Guardar Nuevos Precios'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PESTAÑA 6: CONFIGURACIÓN DE WHATSAPP Y SEGURIDAD / CAMBIO DE PIN */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* SECCIÓN 1: LÍNEAS DE WHATSAPP Y MARCA */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Canales de Atención
              </span>
              <h3 className="text-2xl font-serif font-bold text-white">
                Números de WhatsApp de Sebastian G
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                A estas líneas te llegarán las solicitudes de reserva y las elecciones de fotos de tus clientes.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Nombre de Marca
                </label>
                <input
                  type="text"
                  value={settings.photographerName || 'Sebastian G'}
                  onChange={(e) => setSettings({ ...settings, photographerName: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* LÍNEA 1 WHATSAPP */}
              <div className="p-4 rounded-2xl bg-stone-950 border border-emerald-500/30 space-y-2">
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>WhatsApp Principal (Línea 1: 324 472 5167) *</span>
                </label>
                <input
                  type="text"
                  value={settings.photographerWhatsApp || '+573244725167'}
                  onChange={(e) => setSettings({ ...settings, photographerWhatsApp: e.target.value })}
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* LÍNEA 2 WHATSAPP */}
              <div className="p-4 rounded-2xl bg-stone-950 border border-emerald-500/30 space-y-2">
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>WhatsApp Secundario (Línea 2: 302 369 6513) *</span>
                </label>
                <input
                  type="text"
                  value={settings.photographerWhatsApp2 || '+573023696513'}
                  onChange={(e) => setSettings({ ...settings, photographerWhatsApp2: e.target.value })}
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* RECARGO FUERA DE SAN ANTERO */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Recargo Fuera de San Antero (Silencioso)
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-amber-400">$</span>
                  <input
                    type="number"
                    value={settings.outOfSanAnteroSurcharge || 10000}
                    onChange={(e) => setSettings({ ...settings, outOfSanAnteroSurcharge: Number(e.target.value) })}
                    className="w-36 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-sm font-bold text-white text-center focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs text-stone-300">COP agregados automáticamente</span>
                </div>
              </div>

              {/* MARCA DE AGUA */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Texto de la Marca de Agua
                </label>
                <input
                  type="text"
                  value={settings.watermarkText || 'SEBASTIAN G'}
                  onChange={(e) => setSettings({ ...settings, watermarkText: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  await updateAdminSettings(settings, packages);
                  alert('Ajustes y números de WhatsApp actualizados con éxito.');
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold py-3.5 rounded-xl shadow-md transition-colors"
              >
                Guardar Ajustes de WhatsApp y Marca
              </button>
            </div>
          </div>

          {/* SECCIÓN 2: SEGURIDAD Y CAMBIO DE PIN */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Seguridad de Acceso
              </span>
              <h3 className="text-xl font-serif font-bold text-white">
                Cambiar Contraseña / PIN del Panel
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Modifica tu clave de acceso para mayor seguridad.
              </p>
            </div>

            {pinChangeMsg && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs">
                {pinChangeMsg}
              </div>
            )}

            {pinChangeError && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs">
                {pinChangeError}
              </div>
            )}

            <form onSubmit={handleChangePinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1">
                  PIN Actual *
                </label>
                <input
                  type="password"
                  required
                  value={pinChangeForm.currentPin}
                  onChange={(e) => setPinChangeForm({ ...pinChangeForm, currentPin: e.target.value })}
                  placeholder="Escribe tu PIN actual"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1">
                    Nuevo PIN (Mínimo 4 dígitos) *
                  </label>
                  <input
                    type="password"
                    required
                    value={pinChangeForm.newPin}
                    onChange={(e) => setPinChangeForm({ ...pinChangeForm, newPin: e.target.value })}
                    placeholder="Nuevo PIN"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1">
                    Confirma tu Nuevo PIN *
                  </label>
                  <input
                    type="password"
                    required
                    value={pinChangeForm.confirmPin}
                    onChange={(e) => setPinChangeForm({ ...pinChangeForm, confirmPin: e.target.value })}
                    placeholder="Repite el nuevo PIN"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-stone-800 hover:bg-stone-700 text-white font-bold py-3 rounded-xl text-xs transition-colors"
              >
                Actualizar PIN de Seguridad
              </button>
            </form>
          </div>

          {/* SECCIÓN 3: CERRAR SESIÓN DEL PANEL */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">
                Finalizar Sesión
              </span>
              <h3 className="text-xl font-serif font-bold text-white">
                Cerrar Sesión del Panel
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Bloquea el acceso al panel de fotógrafo y regresa de forma segura a la vista pública.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-red-950/80 border border-red-500/60 hover:bg-red-900 text-red-100 font-extrabold py-3.5 rounded-xl shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span>Cerrar Sesión Definitivamente</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE SELECCIÓN DEL CLIENTE */}
      {viewingSession && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-3xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Fotos Elegidas por el Cliente
                </span>
                <h4 className="text-2xl font-serif font-bold text-white">
                  {viewingSession.clientName}
                </h4>
                <p className="text-xs text-stone-400">
                  {viewingSession.clientWhatsApp} • {viewingSession.packageTitle}
                </p>
              </div>

              <button
                onClick={() => setViewingSession(null)}
                className="p-2 text-stone-400 hover:text-white rounded-xl bg-stone-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {viewingSession.photos.filter(p => p.selected).length === 0 ? (
                <div className="p-8 text-center bg-stone-950 rounded-2xl border border-stone-800 text-stone-400 text-xs">
                  El cliente aún no ha enviado su selección final.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {viewingSession.photos.filter(p => p.selected).map((photo) => (
                    <div key={photo.id} className="bg-stone-950 border border-stone-800 rounded-2xl overflow-hidden">
                      <div className="aspect-[4/5] bg-black">
                        <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3 text-xs space-y-1">
                        <span className="font-bold text-white block">{photo.title}</span>
                        {photo.clientComment ? (
                          <div className="bg-stone-900 p-2 rounded-lg border border-stone-800 text-amber-300 italic">
                            💬 "{photo.clientComment}"
                          </div>
                        ) : (
                          <span className="text-stone-500 italic">Sin comentarios</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  const s = viewingSession;
                  setViewingSession(null);
                  handleOpenDelivery(s);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-colors"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Entregar Fotos Full HD</span>
              </button>

              <a
                href={`https://wa.me/${viewingSession.clientWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `¡Hola ${viewingSession.clientName}! Ya recibí las fotos que seleccionaste de tu sesión. Procedo con la edición final en alta resolución.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[200px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Confirmar Recepción por WhatsApp</span>
              </a>

              <button
                onClick={() => setViewingSession(null)}
                className="px-6 bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENTREGA DE FOTOS EN CALIDAD ORIGINAL (FULL HD / WETRANSFER) */}
      {deliveringSession && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative max-w-xl w-full bg-stone-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-5 my-8">
            {/* Encabezado */}
            <div className="flex items-start justify-between border-b border-stone-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    <PackageCheck className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-bold text-white">Entrega de Fotos en Calidad Original (Full HD)</h3>
                </div>
                <p className="text-xs text-stone-400">
                  Cliente: <span className="font-bold text-amber-300">{deliveringSession.clientName}</span> • {deliveringSession.packageType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeliveringSession(null)}
                className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Banner explicativo de WeTransfer / Sin Compresión */}
            <div className="p-3.5 bg-gradient-to-r from-purple-950/60 via-stone-900 to-stone-950 border border-purple-500/30 rounded-2xl flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-purple-200">
                  ¡Cero compresión de WhatsApp! Máxima nitidez profesional.
                </p>
                <p className="text-stone-300 leading-relaxed">
                  Sube las fotos originales editadas en tu servicio preferido (<strong className="text-amber-300">WeTransfer</strong>, Google Drive, Dropbox u OneDrive) y pega el enlace aquí. El cliente podrá descargarlas al 100% de calidad Full HD.
                </p>
              </div>
            </div>

            {deliverySuccessMsg && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{deliverySuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitDelivery} className="space-y-4">
              {/* Selector de servicio */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-2 uppercase tracking-wider">
                  1. Servicio de Alojamiento / Nube:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'wetransfer', name: 'WeTransfer', desc: 'Recomendado' },
                    { id: 'drive', name: 'Google Drive', desc: 'Carpeta/ZIP' },
                    { id: 'dropbox', name: 'Dropbox', desc: 'Enlace directo' },
                    { id: 'onedrive', name: 'OneDrive', desc: 'Microsoft' }
                  ].map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setDeliveryForm(prev => ({ ...prev, deliveryService: srv.id }))}
                      className={`p-2.5 rounded-xl text-left border transition-all text-xs ${
                        deliveryForm.deliveryService === srv.id
                          ? 'bg-purple-600/30 border-purple-500 text-white font-bold shadow-md shadow-purple-950/50'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-300'
                      }`}
                    >
                      <div className="font-bold">{srv.name}</div>
                      <div className="text-[10px] text-stone-400">{srv.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Enlace de entrega */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5 uppercase tracking-wider">
                  2. Enlace de Descarga Original (Full HD):
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-500">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    required
                    placeholder="https://we.tl/t-xxxxxxx o https://drive.google.com/..."
                    value={deliveryForm.finalDeliveryUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      const detected = detectDeliveryService(val);
                      setDeliveryForm(prev => ({
                        ...prev,
                        finalDeliveryUrl: val,
                        deliveryService: detected !== 'direct' ? detected : prev.deliveryService
                      }));
                    }}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-white text-xs placeholder:text-stone-600 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-stone-500">
                  <span>Pega el link de WeTransfer, Drive o nube donde alojaste las fotos originales.</span>
                  {deliveryForm.finalDeliveryUrl && (
                    <a
                      href={deliveryForm.finalDeliveryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Probar enlace</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Notas de entrega */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5 uppercase tracking-wider">
                  3. Nota del Fotógrafo para el Cliente (Opcional):
                </label>
                <textarea
                  rows={3}
                  value={deliveryForm.deliveryNotes}
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, deliveryNotes: e.target.value }))}
                  placeholder="Ej: Te comparto las 25 fotos seleccionadas editadas con revelado digital en máxima calidad. ¡Fue un honor trabajar contigo!"
                  className="w-full px-3 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-white text-xs placeholder:text-stone-600 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {/* Acciones del formulario */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="submit"
                  disabled={isSubmittingDelivery || !deliveryForm.finalDeliveryUrl}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 transition-colors"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>{isSubmittingDelivery ? 'Guardando Entrega...' : 'Guardar y Marcar como Entregada'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveringSession(null)}
                  className="px-5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold py-3 rounded-xl transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </form>

            {/* Si ya está entregada o se acaba de guardar, mostrar opciones de envío por WhatsApp con selector de línea */}
            {(deliveringSession.status === 'delivered' || deliveryForm.finalDeliveryUrl) && (
              <div className="pt-4 border-t border-stone-800 space-y-3">
                <div className="text-[11px] text-stone-400 flex items-center justify-between">
                  <span>WhatsApp del cliente receptor:</span>
                  <span className="text-emerald-400 font-mono font-bold">{deliveringSession.clientWhatsApp}</span>
                </div>

                <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      Elige tu línea de WhatsApp para enviar:
                    </span>
                    <span className="text-[10px] text-stone-400 font-medium">
                      {deliveryWhatsAppLine === 'line1' ? 'Línea 1 Seleccionada' : 'Línea 2 Seleccionada'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryWhatsAppLine('line1')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                        deliveryWhatsAppLine === 'line1'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="text-[10px] text-stone-400">Línea 1 (Principal)</div>
                        <div className="font-mono text-xs text-white">324 472 5167</div>
                      </div>
                      {deliveryWhatsAppLine === 'line1' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryWhatsAppLine('line2')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                        deliveryWhatsAppLine === 'line2'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="text-[10px] text-stone-400">Línea 2 (Secundaria)</div>
                        <div className="font-mono text-xs text-white">302 369 6513</div>
                      </div>
                      {deliveryWhatsAppLine === 'line2' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <a
                    href={getDeliveryWhatsAppUrl(
                      deliveringSession,
                      deliveryForm.finalDeliveryUrl,
                      deliveryForm.deliveryNotes,
                      deliveryForm.deliveryService,
                      'line1'
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 px-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99]"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>📲 Enviar vía Línea 1 (324...)</span>
                  </a>

                  <a
                    href={getDeliveryWhatsAppUrl(
                      deliveringSession,
                      deliveryForm.finalDeliveryUrl,
                      deliveryForm.deliveryNotes,
                      deliveryForm.deliveryService,
                      'line2'
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs py-3 px-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99]"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>📲 Enviar vía Línea 2 (302...)</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PARA VER COMPROBANTE DE PAGO EN TAMAÑO COMPLETO */}
      {viewingVoucherModal && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-stone-900 border border-stone-700 rounded-3xl p-5 text-center shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-800">
              <span className="text-sm font-bold text-white">Comprobante de Transferencia Bancaria</span>
              <button
                type="button"
                onClick={() => setViewingVoucherModal(null)}
                className="px-3 py-1 rounded-xl bg-stone-950 text-stone-400 hover:text-white border border-stone-800 text-xs font-bold"
              >
                Cerrar ✕
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-2xl bg-black p-2 flex items-center justify-center">
              <img src={viewingVoucherModal} alt="Comprobante de Pago" className="max-w-full max-h-[70vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INSTRUCCIONES DE INSTALACIÓN NATIVA EN ANDROID */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative max-w-md w-full bg-stone-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-4 my-8 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <DownloadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Instalar App en tu Android</h3>
                  <p className="text-[11px] text-stone-400">Exclusiva para ti • Sin Play Store</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-300">
              <p className="leading-relaxed">
                Tus clientes seguirán usando la versión web normal en sus navegadores sin tener que instalar nada. Esta app es <strong className="text-amber-300">100% exclusiva para ti</strong> como fotógrafo.
              </p>

              <div className="p-3.5 bg-stone-950 rounded-2xl border border-stone-800 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                  <p>Abre <strong className="text-white">Google Chrome</strong> en tu teléfono Android y entra a tu panel.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                  <p>Toca los <strong className="text-white">tres puntos (⋮)</strong> en la esquina superior derecha del navegador.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                  <p>Selecciona <strong className="text-purple-300 font-bold">"Instalar aplicación"</strong> (o <em>"Agregar a la pantalla principal"</em>).</p>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-emerald-300 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>¡Y listo! Se creará el icono de Sebastian G en tu celular y se abrirá siempre en tu panel en pantalla completa.</span>
              </div>
            </div>

            <a
              href="/SebastianG-Admin.apk"
              download="SebastianG-Admin.apk"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>📥 Descargar Archivo APK Directo (v1.2.0)</span>
            </a>

            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-xl"
            >
              Entendido / Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE SESIÓN POR WHATSAPP */}
      {confirmingBooking && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative max-w-xl w-full bg-stone-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-5 my-8 text-left">
            {/* Encabezado */}
            <div className="flex items-start justify-between border-b border-stone-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-bold text-white">Confirmar Reserva de Sesión</h3>
                </div>
                <p className="text-xs text-stone-400">
                  Cliente: <span className="font-bold text-amber-300">{confirmingBooking.clientName}</span> ({confirmingBooking.clientWhatsApp})
                  {confirmingBooking.clientEmail && (
                    <span className="block text-emerald-400 font-semibold mt-1">
                      ✉️ Correo: {confirmingBooking.clientEmail} (Se enviará confirmación automática por email)
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingBooking(null)}
                className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen de la reserva */}
            <div className="p-3.5 bg-stone-950 rounded-2xl border border-stone-800/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-400">🗓️ Fecha y Hora Programada:</span>
                <span className="font-bold text-white">{formatDateTime12Hour(confirmingBooking.dateTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">📦 Paquete:</span>
                <span className="font-bold text-amber-300">{confirmingBooking.packageName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">📍 Locación:</span>
                <span className="font-semibold text-stone-200">
                  {confirmingBooking.specificLocation || (confirmingBooking.locationType === 'outside' ? 'Locación Fuera' : 'San Antero')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">💵 Total Cobrado:</span>
                <span className="font-black text-emerald-400 font-mono">
                  ${Number(confirmingBooking.totalPrice || 0).toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>

            {confirmSuccessMsg && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{confirmSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSendBookingConfirmation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5 uppercase tracking-wider">
                  Nota o indicación especial para el cliente (opcional):
                </label>
                <input
                  type="text"
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="Ej: Nos vemos frente al muelle / Llevar ropa fresca blanca"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Vista previa del mensaje oficial de WhatsApp */}
              <div>
                <label className="block text-[11px] font-bold text-stone-400 mb-1.5 uppercase tracking-wider">
                  Vista previa del mensaje que le llegará al WhatsApp del cliente:
                </label>
                <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl text-xs text-stone-200 font-sans space-y-2 whitespace-pre-line leading-relaxed">
                  <p>📸 <strong>¡Hola {(confirmingBooking.clientName || 'Cliente').split(' ')[0]}! Te saluda Sebastian G.</strong> ✨</p>
                  <p>¡Excelente noticia! Te confirmo con mucho gusto tu <strong>Sesión Fotográfica Profesional</strong> para el día que reservaste:</p>
                  <p className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800 text-[11px]">
                    🗓️ <strong>Fecha y Hora:</strong> {formatDateTime12Hour(confirmingBooking.dateTime)}<br />
                    📦 <strong>Paquete Confirmado:</strong> {confirmingBooking.packageName}<br />
                    💵 <strong>Valor Total:</strong> ${Number(confirmingBooking.totalPrice || 0).toLocaleString('es-CO')} COP<br />
                    📍 <strong>Locación:</strong> {confirmingBooking.specificLocation || 'San Antero'}
                    {confirmNote.trim() && (
                      <><br />📝 <strong>Nota del Fotógrafo:</strong> {confirmNote.trim()}</>
                    )}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    💡 <em>Recomendaciones: Llega con 10 o 15 minutos de anticipación y trae tus cambios de vestuario listos. ¡Será un verdadero placer capturar tus mejores momentos frente al lente!</em>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isConfirmingBookingStatus}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isConfirmingBookingStatus ? 'Confirmando...' : '🚀 Enviar Confirmación por WhatsApp'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingBooking(null)}
                  className="px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RECIBO DIGITAL & COMPROBANTE OFICIAL (IMPRIMIBLE / PDF / WHATSAPP) */}
      {receiptBooking && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative max-w-2xl w-full bg-stone-900 border border-amber-500/40 rounded-3xl shadow-2xl p-5 sm:p-7 space-y-5 my-6 text-left">
            {/* Cabecera del Modal (No se imprime) */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 no-print">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <FileText className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">Comprobante de Pago Digital • Sebastian G</h3>
                  <p className="text-xs text-stone-400">Genera recibos de abono o pago total para descargar en PDF o enviar por WhatsApp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceiptBooking(null)}
                className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Controles de Configuración del Comprobante (No se imprime) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-stone-950 rounded-2xl border border-stone-800 text-xs no-print">
              <div>
                <label className="block text-stone-400 font-semibold mb-1">Tipo de Comprobante:</label>
                <select
                  value={receiptType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setReceiptType(val);
                    const total = Number(receiptBooking.totalPrice || 0);
                    if (val === 'deposit') {
                      setReceiptPaidAmount(Math.round(total * 0.5));
                      setReceiptNotes('Abono para reserva de cupo y fecha garantizada en agenda oficial.');
                    } else if (val === 'total') {
                      setReceiptPaidAmount(total);
                      setReceiptNotes('Pago total del 100% de la sesión fotográfica.');
                    }
                  }}
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="deposit">Abono (50%)</option>
                  <option value="total">Pago Total (100%)</option>
                  <option value="custom">Monto Personalizado</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-400 font-semibold mb-1">Monto Recibido ($ COP):</label>
                <input
                  type="number"
                  value={receiptPaidAmount}
                  onChange={(e) => setReceiptPaidAmount(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-stone-400 font-semibold mb-1">Método de Pago:</label>
                <select
                  value={receiptPaymentMethod}
                  onChange={(e) => setReceiptPaymentMethod(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white font-semibold"
                >
                  <option value="Nequi">Nequi</option>
                  <option value="DaviPlata">DaviPlata</option>
                  <option value="Dale!">Dale!</option>
                  <option value="Bancolombia">Bancolombia</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                </select>
              </div>
            </div>

            {/* Recibo Oficial Imprimible y Compartible */}
            <div id="sebastian-g-digital-receipt" className="bg-stone-950 text-white border border-amber-500/30 rounded-2xl p-5 sm:p-7 space-y-4 shadow-inner">
              {/* Encabezado Corporativo */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-stone-800 pb-3.5 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-amber-400" />
                    <h2 className="text-xl font-serif font-black tracking-wide text-white">SEBASTIAN G</h2>
                  </div>
                  <p className="text-[11px] text-amber-400/90 font-medium tracking-widest uppercase">Fotografía & Retoque Profesional</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">San Antero, Córdoba, Colombia • Tel: +57 324 4725167 • sebastiang.app</p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="inline-block px-3 py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono text-xs font-black">
                    REC-{String(receiptBooking.id).replace(/\D/g, '').slice(-5).padStart(5, '0') || '001'}
                  </span>
                  <p className="text-[10px] text-stone-400 mt-1">
                    Fecha de Emisión: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Datos Cliente & Cita */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 bg-stone-900/60 p-3 rounded-xl border border-stone-800/80">
                  <span className="text-[10px] uppercase font-bold text-amber-400/80 block">Cliente Titular</span>
                  <p className="font-bold text-stone-100 text-sm">{receiptBooking.clientName}</p>
                  <p className="text-stone-300">WhatsApp: <span className="font-mono text-emerald-400">{receiptBooking.clientWhatsApp}</span></p>
                  {receiptBooking.clientEmail && (
                    <p className="text-stone-300 truncate">Correo: <span className="text-stone-200">{receiptBooking.clientEmail}</span></p>
                  )}
                </div>

                <div className="space-y-1 bg-stone-900/60 p-3 rounded-xl border border-stone-800/80">
                  <span className="text-[10px] uppercase font-bold text-amber-400/80 block">Detalles de la Cita</span>
                  <p className="font-bold text-stone-100">{formatDateTime12Hour(receiptBooking.dateTime)}</p>
                  <p className="text-stone-300 truncate">Locación: <span className="text-stone-200">{receiptBooking.specificLocation || 'San Antero'}</span></p>
                  <p className="text-stone-300 truncate">Paquete: <span className="text-amber-300">{receiptBooking.packageName}</span></p>
                </div>
              </div>

              {/* Desglose Financiero */}
              <div className="border border-stone-800 rounded-xl overflow-hidden text-xs">
                <div className="bg-stone-900/80 px-4 py-2 border-b border-stone-800 flex justify-between font-bold text-stone-300">
                  <span>Concepto</span>
                  <span>Importe</span>
                </div>
                <div className="p-3.5 space-y-2 bg-stone-950">
                  <div className="flex justify-between text-stone-300">
                    <span>Sesión Fotográfica ({receiptBooking.packageName})</span>
                    <span className="font-mono font-semibold">${Number(receiptBooking.totalPrice || 0).toLocaleString('es-CO')} COP</span>
                  </div>
                  {Number(receiptBooking.printedPhotosCount) > 0 && (
                    <div className="flex justify-between text-stone-400 text-[11px]">
                      <span>+ {receiptBooking.printedPhotosCount} Fotos impresas en papel fotográfico</span>
                      <span>Incluido</span>
                    </div>
                  )}
                  <div className="border-t border-stone-800 pt-2 flex justify-between text-stone-200">
                    <span className="font-bold">Total Pactado:</span>
                    <span className="font-mono font-bold">${Number(receiptBooking.totalPrice || 0).toLocaleString('es-CO')} COP</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                    <span>Monto Recibido ({receiptPaymentMethod}):</span>
                    <span className="font-mono">${Number(receiptPaidAmount || 0).toLocaleString('es-CO')} COP</span>
                  </div>
                  <div className="flex justify-between text-amber-400 font-bold px-2.5 py-1">
                    <span>Saldo Pendiente de Pago en la Sesión:</span>
                    <span className="font-mono">
                      ${Math.max(0, Number(receiptBooking.totalPrice || 0) - Number(receiptPaidAmount || 0)).toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </div>
              </div>

              {/* Cláusula de Garantía de Clima Adaptada a la Locación */}
              {(() => {
                const loc = receiptBooking.specificLocation || (receiptBooking.locationType === 'outside' ? 'tu locación seleccionada' : 'San Antero');
                return (
                  <div className="p-3 bg-stone-900/40 rounded-xl border border-stone-800/60 text-[11px] space-y-1 text-stone-400">
                    <p className="text-amber-300 font-semibold flex items-center gap-1.5">
                      <span>⛅ Garantía de Clima en {loc}:</span>
                    </p>
                    <p>En caso de lluvia o clima adverso en {loc}, tu sesión se reprograma para una nueva fecha sin ningún costo ni penalidad adicional.</p>
                    <p className="pt-0.5 text-stone-500">Documento electrónico emitido en sebastiang.app • Válido como soporte oficial de reserva.</p>
                  </div>
                );
              })()}

              {/* Firma del Fotógrafo */}
              <div className="flex justify-between items-end pt-3 border-t border-stone-800 text-[11px]">
                <div>
                  <p className="font-serif italic text-amber-400 text-sm font-bold">Sebastian G</p>
                  <p className="text-stone-400 text-[10px]">Fotógrafo Profesional Titular</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    Math.max(0, Number(receiptBooking.totalPrice || 0) - Number(receiptPaidAmount || 0)) === 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}>
                    {Math.max(0, Number(receiptBooking.totalPrice || 0) - Number(receiptPaidAmount || 0)) === 0
                      ? '✓ PAGADO TOTAL (100%)'
                      : '✓ ABONO CONFIRMADO (50%)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Selector de Línea de WhatsApp para Recibo */}
            <div className="p-3 bg-stone-950/80 border border-stone-800 rounded-2xl space-y-2 no-print">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Elige la línea de WhatsApp para enviar el comprobante:
                </span>
                <span className="text-[10px] text-stone-400 font-medium">
                  {receiptWhatsAppLine === 'line1' ? 'Línea 1 Seleccionada' : 'Línea 2 Seleccionada'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptWhatsAppLine('line1')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                    receiptWhatsAppLine === 'line1'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="text-[10px] text-stone-400">Línea 1 (Principal)</div>
                    <div className="font-mono text-xs text-white">324 472 5167</div>
                  </div>
                  {receiptWhatsAppLine === 'line1' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptWhatsAppLine('line2')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                    receiptWhatsAppLine === 'line2'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="text-[10px] text-stone-400">Línea 2 (Secundaria)</div>
                    <div className="font-mono text-xs text-white">302 369 6513</div>
                  </div>
                  {receiptWhatsAppLine === 'line2' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              </div>
            </div>

            {/* Botones de Acción (No se imprimen) */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1 no-print">
              <button
                type="button"
                onClick={handleDownloadReceiptPdf}
                disabled={isGeneratingPdf}
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendReceiptWhatsApp('line1')}
                disabled={isGeneratingPdf}
                className="w-full sm:flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>📲 Enviar vía Línea 1 (324...)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendReceiptWhatsApp('line2')}
                disabled={isGeneratingPdf}
                className="w-full sm:flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-700/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>📲 Enviar vía Línea 2 (302...)</span>
              </button>

              <button
                type="button"
                onClick={handlePrintReceipt}
                className="w-full sm:w-auto px-3.5 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center justify-center gap-1"
                title="Imprimir copia"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>

              <button
                type="button"
                onClick={() => setReceiptBooking(null)}
                className="w-full sm:w-auto px-3.5 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white text-xs font-semibold border border-stone-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
