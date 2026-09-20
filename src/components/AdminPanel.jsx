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
  Delete
} from 'lucide-react';
import { 
  verifyAdminPin, 
  getAdminBookings, 
  updateBookingStatus, 
  getAdminSessions, 
  createAdminSession, 
  reopenAdminSession, 
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
  recoverAdminPin
} from '../services/api';

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

export default function AdminPanel({ onOpenGalleryToken, onCatalogUpdated, onBackToHome, onLogout, onPackagesUpdated }) {
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
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'create-session' | 'sessions' | 'catalog-manager' | 'pricing-manager' | 'settings'

  // Gestión de Precios
  const [editablePackages, setEditablePackages] = useState([]);
  const [editableSurcharge, setEditableSurcharge] = useState(10000);
  const [editablePrintedPhotoPrice, setEditablePrintedPhotoPrice] = useState(7000);
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [priceSaveSuccess, setPriceSaveSuccess] = useState('');

  // Datos del sistema
  const [bookings, setBookings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [settings, setSettings] = useState({
    photographerName: 'Sebastian G',
    photographerWhatsApp: '+573244725167',
    photographerWhatsApp2: '+573023696513',
    outOfSanAnteroSurcharge: 10000,
    watermarkText: 'SEBASTIAN G',
    watermarkSubtext: 'MUESTRA EXCLUSIVA • PROHIBIDA SU DESCARGA'
  });
  const [packages, setPackages] = useState([]);
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

  // Formulario Agregar Foto al Catálogo Público
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await verifyAdminPin(pinInput);
      setIsAuthenticated(true);
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
      const [bData, sData, setData, pData, cData] = await Promise.all([
        getAdminBookings(),
        getAdminSessions(),
        getSettings(),
        getPackages(),
        getCatalog()
      ]);
      setBookings(bData);
      setSessions(sData);
      if (cData) setCatalog(cData);
      if (setData) {
        setSettings(setData);
        setEditablePrintedPhotoPrice(setData.printedPhotoPrice || 7000);
        setEditableSurcharge(setData.outOfSanAnteroSurcharge || 10000);
      }
      if (pData && pData.length > 0) {
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

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

  // Manejador de subida para el Catálogo Público
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
      alert('Por favor selecciona una foto para subir al catálogo.');
      return;
    }

    try {
      const categoryFinal = newCatalogForm.category === 'custom'
        ? (newCatalogForm.customCategory.trim() || 'General')
        : newCatalogForm.category;

      const result = await addCatalogPhoto({
        title: newCatalogForm.title.trim(),
        category: categoryFinal,
        location: newCatalogForm.location.trim() || 'San Antero',
        url: newCatalogForm.url
      });

      setCatalogUploadSuccess('¡Foto publicada exitosamente en el catálogo público!');
      setNewCatalogForm({
        title: '',
        category: 'Playas San Antero',
        customCategory: '',
        location: 'Playa Blanca, San Antero',
        url: ''
      });
      loadAllAdminData();
      if (onCatalogUpdated) onCatalogUpdated();
      setTimeout(() => setCatalogUploadSuccess(''), 4000);
    } catch (err) {
      alert(err.message || 'Error al agregar foto al catálogo.');
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

              {/* Botón de Ayuda Rápida sin textos cortados */}
              <button
                type="button"
                onClick={() => {
                  setPinInput('1234');
                  verifyAdminPin('1234').then(() => {
                    setIsAuthenticated(true);
                    loadAllAdminData();
                  }).catch(() => {
                    setAuthError('PIN 1234 no reconocido');
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/20 active:scale-95 transition-all mb-4"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>PIN inicial: 1234 (Toca para probar)</span>
              </button>

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* BARRA SUPERIOR EXCLUSIVA DEL PANEL (SEPARA EL DASHBOARD DE LA WEB PÚBLICA) */}
      <div className="w-full bg-stone-900/90 border border-stone-800 rounded-3xl p-4 sm:p-5 mb-8 flex flex-wrap items-center justify-between gap-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <img
            src="/logo-white.png"
            alt="Sebastian G"
            className="h-10 sm:h-12 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]"
          />
          <div className="border-l border-stone-800 pl-3">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 block">
              Panel de Fotógrafo
            </span>
            <span className="text-xs text-stone-400 font-medium block">
              Sebastian G • San Antero, Córdoba
            </span>
          </div>
        </div>

        {/* Acciones Rápidas: Ver Portafolio y Cerrar Sesión */}
        <div className="flex items-center gap-2.5 sm:gap-3">
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

        {/* Pestañas de navegación 100% responsive: Grid de 6 columnas adaptables, sin scrollbars */}
        <div className="w-full bg-stone-900/95 p-1.5 sm:p-2 rounded-2xl border border-stone-800/90 shadow-xl no-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 touch-manipulation ${
                activeTab === 'bookings'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>Reservas</span>
              {bookings.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${activeTab === 'bookings' ? 'bg-stone-950 text-amber-400' : 'bg-stone-800 text-stone-300'}`}>
                  {bookings.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('create-session')}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 touch-manipulation ${
                activeTab === 'create-session'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Subir Fotos</span>
            </button>

            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 touch-manipulation ${
                activeTab === 'sessions'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span>Selecciones</span>
              {sessions.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${activeTab === 'sessions' ? 'bg-stone-950 text-amber-400' : 'bg-stone-800 text-stone-300'}`}>
                  {sessions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('catalog-manager')}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 touch-manipulation ${
                activeTab === 'catalog-manager'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <FolderPlus className="w-4 h-4 shrink-0" />
              <span>Catálogo</span>
              {catalog.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${activeTab === 'catalog-manager' ? 'bg-stone-950 text-amber-400' : 'bg-stone-800 text-stone-300'}`}>
                  {catalog.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('pricing-manager')}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 touch-manipulation ${
                activeTab === 'pricing-manager'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <DollarSign className="w-4 h-4 shrink-0" />
              <span>Precios</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 touch-manipulation ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Ajustes & PIN</span>
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
                const clientPhoneClean = (booking.clientWhatsApp || '').replace(/\D/g, '');

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
                            {booking.specificLocation || (isOutside ? 'Fuera de San Antero' : 'San Antero')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Fecha y Hora:</span>
                          <span className="font-semibold text-white">{booking.dateTime}</span>
                        </div>
                      </div>

                      {booking.description && (
                        <div className="mt-3 p-3 bg-stone-950/60 rounded-xl border border-stone-800 text-xs text-stone-300">
                          <span className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">Notas del cliente:</span>
                          "{booking.description}"
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
                      <select
                        value={booking.status}
                        onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                        className="bg-stone-950 border border-stone-700 text-xs rounded-lg px-2.5 py-1.5 text-stone-300"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="confirmed">Confirmar</option>
                        <option value="completed">Sesión Realizada</option>
                      </select>

                      <a
                        href={`https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(`¡Hola ${booking.clientName}! Te escribe Sebastian G respecto a tu reserva para el ${booking.dateTime}.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              
              <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 text-xs font-mono break-all text-amber-300 flex items-center justify-between gap-2">
                <span>{window.location.origin}/galeria/{createdSessionResult.session.token}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${window.location.origin}/galeria/${createdSessionResult.session.token}`)}
                  className="p-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded-lg shrink-0"
                  title="Copiar"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <a
                  href={`https://wa.me/${createdSessionResult.session.clientWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `📸 *¡Hola ${createdSessionResult.session.clientName}! Ya están listas las fotos de tu sesión para que elijas tus favoritas.*\n\n` +
                    `👉 Entra a tu galería privada protegida aquí:\n${window.location.origin}/galeria/${createdSessionResult.session.token}\n\n` +
                    `⏰ *Nota:* Tienes exactamente *3 días* para hacer tu selección antes de que el enlace expire.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/30"
                >
                  <Share2 className="w-4 h-4" />
                  <span>📲 Enviar Enlace por WhatsApp al Cliente</span>
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(`${window.location.origin}/galeria/${createdSessionResult.session.token}`)}
                  className="px-4 py-3.5 bg-stone-900 border border-stone-700 hover:bg-stone-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedLink ? '¡Copiado!' : 'Copiar'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenGalleryToken(createdSessionResult.session.token)}
                  className="px-4 py-3.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-4 h-4" />
                  <span>Ver como Cliente</span>
                </button>
              </div>
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
                  placeholder="Ej. Camila Rodríguez"
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

          {sessions.length === 0 ? (
            <div className="p-12 text-center bg-stone-900 border border-stone-800 rounded-3xl text-stone-400">
              No has creado sesiones de clientes todavía. Usa la pestaña "Subir Fotos Cliente".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sessions.map((session) => {
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
                            isSubmitted
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : session.isExpired
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isSubmitted ? '✓ Selección Enviada por Cliente' : session.isExpired ? 'Expirada (3 días)' : 'Esperando Selección'}
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
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-stone-800">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingSession(session)}
                          className={`flex-1 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                            selectedPhotos.length > 0 
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                              : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                          <span>Ver Fotos Elegidas & Notas ({selectedPhotos.length})</span>
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
                          <span>Reabrir (+3 Días)</span>
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

            {/* Selector de foto para catálogo */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <div
                onClick={() => catalogFileInputRef.current?.click()}
                className="w-full sm:w-auto cursor-pointer border border-dashed border-amber-500/50 hover:border-amber-400 bg-stone-950 rounded-xl p-4 flex items-center justify-center gap-3 transition-colors"
              >
                <input
                  ref={catalogFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCatalogPhotoSelected}
                  className="hidden"
                />
                <Upload className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold text-white">
                  {isUploadingCatalogPhoto ? 'Cargando foto...' : 'Seleccionar Foto desde Celular / PC'}
                </span>
              </div>

              {newCatalogForm.url && (
                <div className="flex items-center gap-3 bg-stone-950 p-2 rounded-xl border border-stone-800">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-black shrink-0">
                    <img src={newCatalogForm.url} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold">✓ Foto lista para publicar</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!newCatalogForm.url}
                className="w-full sm:w-auto ml-auto bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-extrabold text-xs py-3 px-6 rounded-xl shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 fill-stone-950" />
                <span>Publicar en Catálogo</span>
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

            <div className="flex gap-3 pt-2">
              <a
                href={`https://wa.me/${viewingSession.clientWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `¡Hola ${viewingSession.clientName}! Ya recibí las fotos que seleccionaste de tu sesión. Procedo con la edición final en alta resolución.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5"
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
    </div>
  );
}
