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
  Star
} from 'lucide-react';
import { 
  verifyAdminPin, 
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
  saveWalletBaseBalances,
  REAL_DEFAULT_BOOKINGS,
  DEFAULT_PACKAGES,
  DEFAULT_REAL_CATALOG
} from '../services/api';
import { supabase } from '../services/supabase';
import { getLocalAnalytics } from '../services/analytics';
import { NequiLogo, DaviPlataLogo, DaleLogo, WalletAccountCard } from './PaymentLogos';

// Función para enviar notificaciones de escritorio / móvil en segundo plano
function sendBrowserNotification(title, body) {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/app-icon.png'
      });
    }
  } catch (e) {}
}

// Función para procesar fotos conservando la fidelidad de revelado de Adobe Lightroom (Ultra HD 2.4K, 92% calidad)
function compressImageFile(file, maxWidth = 2400, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
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
  const previousCountsRef = useRef({ bookings: 1, payments: 0, initialized: true });
  const [sessions, setSessions] = useState([]);
  const [catalog, setCatalog] = useState(DEFAULT_REAL_CATALOG);
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

  const getDeliveryWhatsAppUrl = (session, customUrl, customNotes, customService) => {
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

    const text = encodeURIComponent(
      `📸 *¡Hola ${formattedFirstName}! Tus fotos profesionales con Sebastian G están listas en Calidad Original Full HD.* ✨\n\n` +
      `Hemos finalizado la edición y retoque profesional de tus fotografías seleccionadas. Para que no pierdan resolución ni calidad (evitando la compresión de WhatsApp), puedes descargarlas en su tamaño original aquí:\n\n` +
      `📥 *Enlace de Descarga Original:* ${url}\n` +
      `📦 *Servicio de Descarga:* ${serviceName}\n\n` +
      `📝 *Nota del Fotógrafo:* ${activeNote}\n\n` +
      `💡 *Consejo:* Te recomiendo descargarlas y guardarlas en tu computador o celular antes de que venza el enlace para conservarlas siempre en su máxima nitidez.\n\n` +
      `¡Fue un placer capturar tus mejores momentos! Cualquier duda estoy a tu entera disposición. ♡`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await verifyAdminPin(pinInput);
      setIsAuthenticated(true);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        try {
          Notification.requestPermission();
        } catch (err) {}
      }
      loadAllAdminData();
    } catch (err) {
      setAuthError('PIN incorrecto. Si lo olvidaste, usa la opción de recuperación abajo.');
    }
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

  const loadAllAdminData = async () => {
    try {
      setLoadingData(true);
      const [bRes, sRes, setRes, pRes, cRes, payRes, revRes] = await Promise.allSettled([
        getAdminBookings(),
        getAdminSessions(),
        getSettings(),
        getPackages(),
        getCatalog(),
        getAdminPayments(),
        getReviews()
      ]);

      const bData = bRes.status === 'fulfilled' && Array.isArray(bRes.value) && bRes.value.length > 0 
        ? bRes.value 
        : REAL_DEFAULT_BOOKINGS;
      setBookings(bData);

      const rawSessions = sRes.status === 'fulfilled' && Array.isArray(sRes.value) ? sRes.value : [];
      const cleanSessions = rawSessions.filter(
        s => s && s.clientName !== 'Camila Rodríguez' && s.id !== 'sess-demo' && s.token !== 'demo-cliente-2026'
      );
      setSessions(cleanSessions);

      const setData = setRes.status === 'fulfilled' && setRes.value ? setRes.value : null;
      if (setData) {
        setSettings(setData);
        setEditablePrintedPhotoPrice(setData.printedPhotoPrice || 7000);
        setEditableSurcharge(setData.outOfSanAnteroSurcharge || 10000);
      }

      const pData = pRes.status === 'fulfilled' && Array.isArray(pRes.value) && pRes.value.length > 0 
        ? pRes.value 
        : DEFAULT_PACKAGES;
      setPackages(pData);
      setEditablePackages(pData);
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
      setCatalog(cData);

      const payData = payRes.status === 'fulfilled' && Array.isArray(payRes.value) ? payRes.value : [];
      setPayments(payData);

      const revData = revRes.status === 'fulfilled' && Array.isArray(revRes.value) ? revRes.value : [];
      setReviewsList(revData);
      setWalletBaseBalances(getWalletBaseBalances());

      setAnalyticsStats(getLocalAnalytics());

      // Alerta sonora y visual si llega una nueva reserva o pago en tiempo real
      if (previousCountsRef.current.initialized) {
        const newBookings = bData.length > previousCountsRef.current.bookings;
        const newPayments = (payData ? payData.length : 0) > previousCountsRef.current.payments;
        if (newBookings) {
          playNotificationChime();
          const latest = bData[0];
          sendBrowserNotification(
            '📸 ¡Nueva Reserva Recibida!',
            `${latest?.clientName || 'Un cliente'} ha reservado (${latest?.packageName || 'Sesión'}) para el ${formatDateTime12Hour(latest?.dateTime) || 'próximamente'}`
          );
          setRealtimeAlert({
            type: 'booking',
            message: `🔔 ¡Nueva Reserva en Tiempo Real de ${latest?.clientName || 'un cliente'} (${formatDateTime12Hour(latest?.dateTime)})!`,
            targetTab: 'bookings'
          });
          setTimeout(() => setRealtimeAlert(null), 9000);
        } else if (newPayments) {
          playNotificationChime();
          const latestPay = payData?.[0];
          sendBrowserNotification(
            '💰 ¡Nuevo Pago Recibido!',
            `${latestPay?.clientName || 'Un cliente'} pagó $${Number(latestPay?.amount || 0).toLocaleString('es-CO')} COP vía ${latestPay?.method?.toUpperCase() || 'transferencia'}`
          );
          setRealtimeAlert({
            type: 'payment',
            message: `💰 ¡Nuevo Pago Recibido de ${latestPay?.clientName || 'un cliente'} ($${Number(latestPay?.amount || 0).toLocaleString('es-CO')} COP)!`,
            targetTab: 'payments'
          });
          setTimeout(() => setRealtimeAlert(null), 9000);
        }
      }

      previousCountsRef.current = {
        bookings: bData.length,
        payments: payData ? payData.length : 0,
        initialized: true
      };
    } catch (err) {
      console.error('Error cargando datos de administración:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Limpieza estricta de seguridad: nunca dejar credenciales persistidas que puedan abrir el panel automáticamente
  useEffect(() => {
    try {
      localStorage.removeItem('sebastian_g_admin_pin');
      sessionStorage.removeItem('sebastian_g_admin_session_token');
    } catch (e) {}
  }, []);

  // Monitoreo inteligente para avisar instantáneamente sobre reservas y pagos sin saturar el servidor
  useEffect(() => {
    if (!isAuthenticated) return;
    loadAllAdminData();

    const poll = () => {
      if (!document.hidden) {
        loadAllAdminData();
      }
    };

    const interval = setInterval(poll, 6000);
    const handleVisibility = () => {
      if (!document.hidden) loadAllAdminData();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated]);

  // Sincronización simultánea de catálogo, reservas y pagos en tiempo real (Celular <-> PC y entre pestañas)
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('admin_all_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog' }, () => {
        getCatalog().then(data => {
          if (Array.isArray(data)) setCatalog(data);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadAllAdminData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        loadAllAdminData();
      })
      .subscribe();

    let bcCatalog, bcBookings, bcPayments, bcReviews, bcWallets;
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        bcCatalog = new BroadcastChannel('catalog_realtime_sync');
        bcCatalog.onmessage = () => {
          getCatalog().then(data => {
            if (Array.isArray(data)) setCatalog(data);
          });
        };

        bcBookings = new BroadcastChannel('bookings_realtime_sync');
        bcBookings.onmessage = () => {
          loadAllAdminData();
        };

        bcPayments = new BroadcastChannel('payments_realtime_sync');
        bcPayments.onmessage = () => {
          loadAllAdminData();
        };

        bcReviews = new BroadcastChannel('reviews_realtime_sync');
        bcReviews.onmessage = () => {
          loadAllAdminData();
        };

        bcWallets = new BroadcastChannel('wallet_balances_sync');
        bcWallets.onmessage = () => {
          setWalletBaseBalances(getWalletBaseBalances());
        };
      }
    } catch (e) {}

    const handleStorage = (e) => {
      if (e.key === 'sebastian_g_catalog_last_sync' || e.key === 'sebastian_g_catalog_v1') {
        getCatalog().then(data => {
          if (Array.isArray(data)) setCatalog(data);
        });
      }
      if (e.key === 'sebastian_g_bookings_last_sync' || e.key === 'sebastian_g_bookings_v1') {
        loadAllAdminData();
      }
      if (e.key === 'sebastian_g_payments_last_sync' || e.key === 'sebastian_g_payments_v1') {
        loadAllAdminData();
      }
      if (e.key === 'sebastian_g_reviews_last_sync' || e.key === 'sebastian_g_reviews_v1') {
        loadAllAdminData();
      }
      if (e.key === 'sebastian_g_wallet_base_balances_v1') {
        setWalletBaseBalances(getWalletBaseBalances());
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      supabase.removeChannel(channel);
      if (bcCatalog) bcCatalog.close();
      if (bcBookings) bcBookings.close();
      if (bcPayments) bcPayments.close();
      if (bcReviews) bcReviews.close();
      if (bcWallets) bcWallets.close();
      window.removeEventListener('storage', handleStorage);
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

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await updateBookingStatus(bookingId, newStatus);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
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

  // Manejador de subida de fotos para clientes
  const handleFilesChosen = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessingPhotos(true);
    setProcessProgress({ current: 0, total: files.length });

    const newItems = [];
    const startIndex = uploadedPhotos.length;

    for (let i = 0; i < files.length; i++) {
      setProcessProgress({ current: i + 1, total: files.length });
      const file = files[i];
      try {
        // Ultra HD Lightroom Proofing (2400px, 92% calidad)
        const compressedBase64 = await compressImageFile(file, 2400, 0.92);
        newItems.push({
          id: `upl-${Date.now()}-${startIndex + i + 1}`,
          title: `Foto #${startIndex + i + 1}`,
          url: compressedBase64,
          fileName: file.name
        });
      } catch (err) {
        console.error('Error al procesar archivo:', file.name, err);
      }
    }

    setUploadedPhotos(prev => [...prev, ...newItems]);
    setIsProcessingPhotos(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const handleDeleteSession = async (sessionId, clientName) => {
    if (!confirm(`¿Estás seguro de eliminar permanentemente la galería de "${clientName || 'este cliente'}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteAdminSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId && s.token !== sessionId));
    } catch (err) {
      alert('Error al eliminar galería');
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

          {!isRecoveringPin ? (
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
                    verifyAdminPin(val).then(() => {
                      setIsAuthenticated(true);
                      loadAllAdminData();
                    }).catch(() => {
                      setAuthError('PIN incorrecto.');
                    });
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
    s => s && s.clientName !== 'Camila Rodríguez' && s.id !== 'sess-demo' && s.token !== 'demo-cliente-2026'
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

        {/* Acciones Rápidas: Instalar en Android, Ver Portafolio y Cerrar Sesión */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
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

      {/* ALERTA VISUAL Y SONORA EN TIEMPO REAL CUANDO ENTRA UNA RESERVA O PAGO */}
      {realtimeAlert && (
        <div 
          onClick={() => setActiveTab(realtimeAlert.targetTab)}
          className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-between shadow-2xl cursor-pointer ring-4 ring-amber-400/40 animate-pulse transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 fill-stone-950 shrink-0" />
            <span>{realtimeAlert.message}</span>
          </div>
          <span className="text-xs font-bold uppercase underline shrink-0 ml-2">Ver Ahora &rarr;</span>
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
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Administración Oficial
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white">
            Panel de Control • Sebastian G
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">
            Línea 1: {settings.photographerWhatsApp || '+573244725167'} • Línea 2: {settings.photographerWhatsApp2 || '+573023696513'}
          </p>
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

      {/* PESTAÑA 1: RESERVAS DE CLIENTES */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-serif font-bold text-white">
                Reservas Recibidas desde la Página Web
              </h3>
              <p className="text-xs text-stone-400">
                Notificaciones directas con locación, fecha, paquete e impresiones si aplica.
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

          {bookings.length === 0 ? (
            <div className="p-12 text-center bg-stone-900 border border-stone-800 rounded-3xl text-stone-400">
              No hay reservas registradas todavía.
            </div>
          ) : (
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

                      <div className="mt-1">
                        <a
                          href={`https://wa.me/${clientPhoneClean}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{booking.clientWhatsApp} (Chatear)</span>
                        </a>
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

                    <div className="pt-3 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2">
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

                      <a
                        href={`https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(`¡Hola ${booking.clientName}! Te escribe Sebastian G respecto a tu reserva para el ${formatDateTime12Hour(booking.dateTime)}.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>

                    {/* BOTÓN DIRECTO DE ENTREGA FULL HD PARA ESTA RESERVA */}
                    <div className="pt-2.5 border-t border-stone-800 space-y-2">
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
                      onClick={() => {
                        saveWalletBaseBalances(tempBalances);
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
                  : 'https://sebastiang.vercel.app';
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

                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      <a
                        href={`https://wa.me/${clientPhoneDigits}?text=${encodeURIComponent(
                          `📸 *¡Hola ${createdSessionResult.session.clientName}! Ya están listas las fotografías de tu sesión con Sebastian G para que elijas tus favoritas.*\n\n` +
                          `👉 *Ingresa a tu galería privada protegida aquí:*\n${galleryFullUrl}\n\n` +
                          `⏰ *Importante:* Tienes exactamente *3 días* para hacer tu selección antes de que el enlace expire automáticamente.\n\n` +
                          `🔒 *Nota de Seguridad:* Esta galería cuenta con protección digital anti-captura y marca de agua oficial. ¡Quedo atento a tus elecciones!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/30 active:scale-98 transition-all"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>📲 Enviar Enlace por WhatsApp al Cliente</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(galleryFullUrl)}
                        className="px-4 py-3.5 bg-stone-900 border border-stone-700 hover:bg-stone-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Copy className="w-4 h-4" />
                        <span>{copiedLink ? '¡Copiado!' : 'Copiar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenGalleryToken(createdSessionResult.session.token)}
                        className="px-4 py-3.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-amber-500/20"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Ver como Cliente</span>
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
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-stone-950/80 hover:bg-stone-950 rounded-2xl p-6 sm:p-8 text-center transition-all group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFilesChosen}
                      className="hidden"
                    />

                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8" />
                    </div>

                    <h5 className="text-base font-bold text-white mb-1">
                      Toca aquí para seleccionar las fotos desde tu Celular o PC
                    </h5>
                    <p className="text-xs text-stone-400 max-w-md mx-auto">
                      Puedes seleccionar varias fotos a la vez. No te ocupan espacio adicional en tu equipo y se procesan con alta fidelidad para el cliente.
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 text-xs font-bold px-5 py-2.5 rounded-xl shadow-md">
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
                          onClick={() => handleDeleteSession(session.id, session.clientName)}
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

            {/* Si ya está entregada o se acaba de guardar, mostrar botón directo de WhatsApp */}
            {(deliveringSession.status === 'delivered' || deliveryForm.finalDeliveryUrl) && (
              <div className="pt-3 border-t border-stone-800 space-y-2">
                <div className="text-[11px] text-stone-400 flex items-center justify-between">
                  <span>Notificación automática al WhatsApp del cliente:</span>
                  <span className="text-emerald-400 font-mono font-bold">{deliveringSession.clientWhatsApp}</span>
                </div>
                <a
                  href={getDeliveryWhatsAppUrl(
                    deliveringSession,
                    deliveryForm.finalDeliveryUrl,
                    deliveryForm.deliveryNotes,
                    deliveryForm.deliveryService
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>📲 Enviar Fotos Full HD por WhatsApp Ahora</span>
                </a>
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

            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-xl"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
