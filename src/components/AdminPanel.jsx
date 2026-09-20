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
  Link,
  Check
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
  getPackages
} from '../services/api';

// Función para comprimir fotos en el navegador (mantiene calidad visual óptima pero liviana para subida y vista rápida)
function compressImageFile(file, maxWidth = 1400, quality = 0.8) {
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

export default function AdminPanel({ onOpenGalleryToken }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Pestañas
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'create-session' | 'sessions' | 'settings'

  // Datos
  const [bookings, setBookings] = useState([]);
  const [sessions, setSessions] = useState([]);
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

  // Fotos cargadas desde Celular / PC
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [createdSessionResult, setCreatedSessionResult] = useState(null);
  const [useUrlMode, setUseUrlMode] = useState(false);

  const fileInputRef = useRef(null);

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
      setAuthError('PIN incorrecto. El PIN por defecto es 1234.');
    }
  };

  const loadAllAdminData = async () => {
    try {
      setLoadingData(true);
      const [bData, sData, setData, pData] = await Promise.all([
        getAdminBookings(),
        getAdminSessions(),
        getSettings(),
        getPackages()
      ]);
      setBookings(bData);
      setSessions(sData);
      if (setData) setSettings(setData);
      if (pData && pData.length > 0) {
        setPackages(pData);
        // Preseleccionar paquete de 8 fotos si no se ha configurado
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

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await updateBookingStatus(bookingId, newStatus);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    } catch (err) {
      alert('Error al actualizar estado');
    }
  };

  // Manejador de subida de archivos desde celular o computador
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
        const compressedBase64 = await compressImageFile(file, 1400, 0.82);
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
      // Renumerar fotos consecutivamente
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

      // Si no seleccionó fotos, cargar 6 fotos profesionales de muestra
      if (finalPhotos.length === 0) {
        if (!confirm('No has subido fotos desde tu dispositivo. ¿Deseas generar el enlace con 6 fotos de prueba para revisar cómo se ve?')) {
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

  // PANTALLA DE ACCESO CON PIN
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-2xl font-serif font-bold text-white mb-1">
            Panel Sebastian G
          </h3>
          <p className="text-xs text-stone-400 mb-6">
            Ingresa tu PIN de seguridad para gestionar reservas y subir fotos para clientes
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {authError && (
              <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-red-200 text-xs">
                {authError}
              </div>
            )}

            <input
              type="password"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="PIN (Por defecto: 1234)"
              autoFocus
              className="w-full bg-stone-950 border border-stone-800 text-center tracking-widest text-lg font-mono rounded-xl py-3 text-white focus:outline-none focus:border-amber-500"
            />

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold py-3 rounded-xl shadow-lg transition-colors"
            >
              Ingresar al Panel
            </button>
            <p className="text-[11px] text-stone-500">
              PIN predeterminado: <strong>1234</strong>
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* CABECERA DEL PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-800 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Administración del Fotógrafo
          </span>
          <h1 className="text-3xl font-serif font-bold text-white">
            Sebastian G • Panel de Control
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">
            Línea 1: {settings.photographerWhatsApp || '+573244725167'} • Línea 2: {settings.photographerWhatsApp2 || '+573023696513'}
          </p>
        </div>

        {/* Pestañas de navegación */}
        <div className="flex items-center gap-1.5 bg-stone-900 p-1.5 rounded-2xl border border-stone-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'bookings' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Reservas ({bookings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('create-session')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'create-session' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Subir Fotos & Crear Enlace</span>
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'sessions' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Sesiones & Selecciones ({sessions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'settings' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>WhatsApp & Precios</span>
          </button>
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
                Llegan directamente con el lugar de la sesión, fecha, paquete y recargo si aplica.
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
                          <span>{booking.clientWhatsApp} (Chatear en WhatsApp)</span>
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
                          <span className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">Detalles del cliente:</span>
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
                        <span>Contactar</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: SUBIR FOTOS Y CREAR ENLACE PERSONALIZADO (3 DÍAS) */}
      {activeTab === 'create-session' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Uploader de Fotos para Clientes
            </span>
            <h3 className="text-2xl font-serif font-bold text-white">
              Crear Galería de Selección con Vigencia de 3 Días
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Sube las fotos directamente desde la galería de tu celular o computador. El sistema las optimiza, les añade tu marca de agua gigante <strong>"Sebastian G"</strong> y genera el enlace para que el cliente elija sus fotos.
            </p>
          </div>

          {/* MENSAJE DE ÉXITO AL GENERAR ENLACE */}
          {createdSessionResult && (
            <div className="bg-emerald-950/90 border-2 border-emerald-500 rounded-3xl p-6 text-emerald-200 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 font-bold text-base text-white">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">¡Enlace Seguro Generado con Éxito!</h4>
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

              {/* Botones de acción directa */}
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

          {/* FORMULARIO DE CARGA */}
          <form onSubmit={handleCreateSession} className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6">
            
            {/* DATOS DEL CLIENTE */}
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

            {/* PAQUETE DE LA SESIÓN */}
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

            {/* SELECCIÓN DE FOTOS (UPLOADER DESDE CELULAR / PC) */}
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
                  {/* CAJA DE CARGA / BOTÓN PRINCIPAL */}
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
                      Puedes seleccionar varias fotos a la vez. El sistema las optimizará automáticamente para que carguen rápido con tu marca de agua.
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 bg-amber-500 text-stone-950 text-xs font-bold px-4 py-2 rounded-xl shadow-md">
                      <FileImage className="w-4 h-4" />
                      <span>Abrir Galería de Fotos</span>
                    </div>
                  </div>

                  {/* PROGRESO DE COMPRESIÓN */}
                  {isProcessingPhotos && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
                      <div className="text-xs text-stone-200 flex-1">
                        <span className="font-bold text-amber-400">Preparando fotos... </span>
                        <span>Procesando {processProgress.current} de {processProgress.total}</span>
                      </div>
                    </div>
                  )}

                  {/* VISTA PREVIA DE LAS FOTOS SELECCIONADAS */}
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

                      {/* GRID DE MINIATURAS */}
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
                /* MODO TEXTAREA URLs */
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

            {/* BOTÓN GENERAR ENLACE */}
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
                Aquí ves en tiempo real qué fotos ha elegido cada cliente y sus comentarios.
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
              No has creado sesiones de clientes todavía. Usa la pestaña "Subir Fotos & Crear Enlace".
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

                    {/* Acciones */}
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

      {/* PESTAÑA 4: CONFIGURACIÓN DE WHATSAPP Y PRECIOS */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Configuración de Recepción
            </span>
            <h3 className="text-2xl font-serif font-bold text-white">
              Números de WhatsApp & Marca
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Aquí se configuran los números donde los clientes te envían las fotos elegidas y las solicitudes de reserva.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Nombre de Marca / Fotógrafo
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
                <span>WhatsApp Principal (Línea 1) *</span>
              </label>
              <input
                type="text"
                value={settings.photographerWhatsApp || '+573244725167'}
                onChange={(e) => setSettings({ ...settings, photographerWhatsApp: e.target.value })}
                className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-stone-400">
                Línea principal para notificaciones de reservas y elecciones de fotos.
              </p>
            </div>

            {/* LÍNEA 2 WHATSAPP */}
            <div className="p-4 rounded-2xl bg-stone-950 border border-emerald-500/30 space-y-2">
              <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp Secundario (Línea 2) *</span>
              </label>
              <input
                type="text"
                value={settings.photographerWhatsApp2 || '+573023696513'}
                onChange={(e) => setSettings({ ...settings, photographerWhatsApp2: e.target.value })}
                className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-stone-400">
                Línea de respaldo disponible para que los clientes también puedan enviarte sus mensajes.
              </p>
            </div>

            {/* RECARGO SILENCIOSO */}
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
              <p className="text-[11px] text-amber-200/80">
                El cliente nunca verá este recargo desglosado; el sistema ajusta el total automáticamente si eligen fuera de San Antero.
              </p>
            </div>

            {/* MARCA DE AGUA */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Texto de la Marca de Agua (Centro)
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
              Guardar Configuración
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

            {/* Lista de fotos elegidas con sus notas */}
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
                  `¡Hola ${viewingSession.clientName}! Ya recibí las fotos que seleccionaste de tu sesión. Están geniales, procedo con la edición final en alta resolución.`
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
