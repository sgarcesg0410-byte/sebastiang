import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Calendar, 
  Image, 
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
  Share2
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

export default function AdminPanel({ onOpenGalleryToken }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Pestañas del panel
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'create-session' | 'sessions' | 'settings'

  // Datos
  const [bookings, setBookings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState({});
  const [packages, setPackages] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Formulario Crear Sesión
  const [newSessionForm, setNewSessionForm] = useState({
    clientName: '',
    clientWhatsApp: '',
    packageTitle: 'Paquete Estándar (25 fotos)',
    maxPhotosAllowed: 25,
    photoUrlsText: ''
  });
  const [createdSessionResult, setCreatedSessionResult] = useState(null);

  // Modal para ver selecciones de un cliente
  const [viewingSession, setViewingSession] = useState(null);

  // Copiado al portapapeles
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
      setSettings(setData);
      setPackages(pData);
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

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      const urls = newSessionForm.photoUrlsText
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      // Si no pegó URLs, usar fotos de muestra de alta calidad
      const finalPhotos = urls.length > 0
        ? urls.map((url, i) => ({ title: `Foto #${i + 1}`, url }))
        : [
            { title: 'Foto 001 - En la Playa', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80' },
            { title: 'Foto 002 - Luz Dorada', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80' },
            { title: 'Foto 003 - Sonrisa en la Orilla', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80' },
            { title: 'Foto 004 - Viento en el Cabello', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80' },
            { title: 'Foto 005 - Mirada al Horizonte', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
            { title: 'Foto 006 - Silueta al Atardecer', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80' }
          ];

      const res = await createAdminSession({
        clientName: newSessionForm.clientName,
        clientWhatsApp: newSessionForm.clientWhatsApp,
        packageTitle: newSessionForm.packageTitle,
        maxPhotosAllowed: newSessionForm.maxPhotosAllowed,
        photos: finalPhotos
      });

      setCreatedSessionResult(res);
      loadAllAdminData();
    } catch (err) {
      alert(err.message || 'Error al crear la sesión');
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
            Panel del Fotógrafo
          </h3>
          <p className="text-xs text-stone-400 mb-6">
            Ingresa tu PIN de seguridad para gestionar reservas y sesiones
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
              placeholder="PIN de acceso (Por defecto: 1234)"
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
              PIN inicial predeterminado: <strong>1234</strong>
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* CABECERA DEL PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-800 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Administración del Estudio
          </span>
          <h1 className="text-3xl font-serif font-bold text-white">
            Panel de Control • San Antero
          </h1>
        </div>

        {/* Pestañas de navegación */}
        <div className="flex items-center gap-1.5 bg-stone-900 p-1.5 rounded-2xl border border-stone-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'bookings' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Reservas ({bookings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('create-session')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'create-session' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Crear Enlace (3 Días)</span>
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'sessions' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Image className="w-4 h-4" />
            <span>Sesiones & Selecciones ({sessions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'settings' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Precios & Marca</span>
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: RESERVAS DE CLIENTES */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-serif font-bold text-white">
              Reservas Recibidas desde el Catálogo
            </h3>
            <button
              onClick={loadAllAdminData}
              className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 flex items-center gap-1 text-xs"
            >
              <RefreshCw className="w-4 h-4" />
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
                const isOutside = booking.locationType === 'outside_san_antero';
                const clientPhoneClean = (booking.clientWhatsApp || '').replace(/\D/g, '');

                return (
                  <div
                    key={booking.id}
                    className="bg-stone-900 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-colors"
                  >
                    <div>
                      {/* Estado y Fecha de reserva */}
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

                      {/* Nombre del cliente */}
                      <h4 className="text-xl font-serif font-bold text-white">
                        {booking.clientName}
                      </h4>

                      {/* Teléfono WhatsApp con enlace directo */}
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

                      {/* Detalles del paquete y precio */}
                      <div className="mt-4 p-3.5 rounded-2xl bg-stone-950 border border-stone-800/80 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-stone-400">Paquete:</span>
                          <span className="font-semibold text-white truncate max-w-[170px]">{booking.packageName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-stone-400">Valor Cobrado:</span>
                          <span className="text-base font-extrabold text-amber-400">
                            ${booking.totalPrice}
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

                      {/* Descripción / Notas del cliente */}
                      {booking.description && (
                        <div className="mt-3 p-3 bg-stone-850 rounded-xl border border-stone-800 text-xs text-stone-300">
                          <span className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">Idea o Destinatario:</span>
                          "{booking.description}"
                        </div>
                      )}
                    </div>

                    {/* Botones de acción del fotógrafo */}
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
                        href={`https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(`¡Hola ${booking.clientName}! Te escribo de Estudio San Antero respecto a tu reserva del ${booking.dateTime}.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Abrir WhatsApp</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: CREAR ENLACE DE FOTOS PARA CLIENTE (3 DÍAS) */}
      {activeTab === 'create-session' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-2xl font-serif font-bold text-white">
              Crear Galería Privada para Cliente
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              El sistema generará un enlace protegido con <strong>3 días de vigencia</strong> y marca de agua gigante para que el cliente elija sus fotos por WhatsApp.
            </p>
          </div>

          {createdSessionResult && (
            <div className="bg-emerald-950/90 border border-emerald-500 rounded-3xl p-6 text-emerald-200 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 font-bold text-base text-white">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <span>¡Enlace de 3 días generado con éxito!</span>
              </div>
              
              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 text-xs font-mono break-all text-amber-300">
                {window.location.origin}/galeria/{createdSessionResult.session.token}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${window.location.origin}/galeria/${createdSessionResult.session.token}`)}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
                </button>

                <a
                  href={`https://wa.me/${createdSessionResult.session.clientWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `📸 *¡Hola ${createdSessionResult.session.clientName}! Ya están listas las fotos de tu sesión para que elijas tus favoritas.*\n\n` +
                    `👉 Entra a tu galería privada protegida aquí:\n${window.location.origin}/galeria/${createdSessionResult.session.token}\n\n` +
                    `⏰ *Nota:* Tienes exactamente *3 días* para hacer tu selección antes de que el enlace expire.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-stone-900 border border-stone-700 hover:bg-stone-800 text-white font-bold text-xs py-3 rounded-xl"
                >
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span>Enviar por WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => onOpenGalleryToken(createdSessionResult.session.token)}
                  className="px-4 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl"
                >
                  Ver como Cliente
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateSession} className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                required
                value={newSessionForm.clientName}
                onChange={(e) => setNewSessionForm({ ...newSessionForm, clientName: e.target.value })}
                placeholder="Ej. Sofía Vergara"
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
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
                placeholder="Ej. +57 300 123 4567"
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Título de la Sesión
                </label>
                <input
                  type="text"
                  value={newSessionForm.packageTitle}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, packageTitle: e.target.value })}
                  placeholder="Ej. Sesión Playa Blanca (25 fotos)"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                  Cantidad Máxima de Fotos Incluidas
                </label>
                <input
                  type="number"
                  min={1}
                  value={newSessionForm.maxPhotosAllowed}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, maxPhotosAllowed: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                URLs de las Fotos de la Sesión (1 por línea)
              </label>
              <textarea
                rows={4}
                value={newSessionForm.photoUrlsText}
                onChange={(e) => setNewSessionForm({ ...newSessionForm, photoUrlsText: e.target.value })}
                placeholder="Pega las URLs de tus fotos aquí (una por línea). Si lo dejas vacío, cargará 6 fotos de muestra profesionales para probar."
                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                💡 Si lo dejas en blanco, usará fotos de prueba en alta definición para que puedas probar el enlace de inmediato.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-sm py-3.5 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              <span>Generar Enlace Seguro (Vigencia 3 Días)</span>
            </button>
          </form>
        </div>
      )}

      {/* PESTAÑA 3: SESIONES Y SELECCIONES */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-serif font-bold text-white">
              Galerías de Clientes y Fotos Seleccionadas
            </h3>
            <button
              onClick={loadAllAdminData}
              className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 flex items-center gap-1 text-xs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Actualizar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sessions.map((session) => {
              const selectedPhotos = (session.photos || []).filter(p => p.selected);

              return (
                <div
                  key={session.id}
                  className="bg-stone-900 border border-stone-800 rounded-3xl p-6 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                          session.status === 'submitted'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : session.isExpired
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {session.status === 'submitted' ? '✓ Selección Enviada' : session.isExpired ? 'Expirada (3 días)' : 'Esperando Selección'}
                      </span>

                      <span className="text-xs text-stone-400 font-mono">
                        Token: {session.token}
                      </span>
                    </div>

                    <h4 className="text-xl font-serif font-bold text-white">
                      {session.clientName}
                    </h4>
                    <p className="text-xs text-stone-400">{session.clientWhatsApp} • {session.packageTitle}</p>

                    <div className="mt-4 p-3 bg-stone-950 rounded-2xl border border-stone-800 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-stone-400">Total fotos en sesión:</span>
                        <span className="font-semibold text-white">{session.totalPhotos} fotos</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">Fotos elegidas por el cliente:</span>
                        <span className="font-bold text-amber-400">{selectedPhotos.length} fotos</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">Vence:</span>
                        <span className="font-medium text-stone-300">
                          {new Date(session.expiresAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="space-y-2 pt-2 border-t border-stone-800">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingSession(session)}
                        className="flex-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Ver Selección & Notas ({selectedPhotos.length})</span>
                      </button>

                      <button
                        onClick={() => onOpenGalleryToken(session.token)}
                        title="Ver enlace como cliente"
                        className="p-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Botón para extender / reactivar */}
                    <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/galeria/${session.token}`)}
                        className="hover:text-amber-400 flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar link de cliente</span>
                      </button>

                      <button
                        onClick={() => handleReopenSession(session.id)}
                        className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reabrir / Dar +3 días</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA 4: CONFIGURACIÓN DE PRECIOS Y MARCA */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-2xl font-serif font-bold text-white">
              Ajustes de Precios y Marca de Agua
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Personaliza el recargo automático por salir de San Antero y el texto de protección de tus fotos.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Nombre del Estudio / Fotógrafo
              </label>
              <input
                type="text"
                value={settings.photographerName || ''}
                onChange={(e) => setSettings({ ...settings, photographerName: e.target.value })}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                WhatsApp de Recepción de Notificaciones
              </label>
              <input
                type="text"
                value={settings.photographerWhatsApp || ''}
                onChange={(e) => setSettings({ ...settings, photographerWhatsApp: e.target.value })}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
                Recargo Automático Fuera de San Antero (Silencioso)
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-amber-400">$</span>
                <input
                  type="number"
                  value={settings.outOfSanAnteroSurcharge || 10}
                  onChange={(e) => setSettings({ ...settings, outOfSanAnteroSurcharge: Number(e.target.value) })}
                  className="w-32 bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-sm font-bold text-white text-center focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-stone-300">pesos agregados automáticamente al precio final</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                El cliente nunca verá este recargo desglosado; el sistema ajustará el total directamente.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Texto Principal de la Marca de Agua (Gigante en el centro)
              </label>
              <input
                type="text"
                value={settings.watermarkText || ''}
                onChange={(e) => setSettings({ ...settings, watermarkText: e.target.value })}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Subtexto de Protección de Marca de Agua
              </label>
              <input
                type="text"
                value={settings.watermarkSubtext || ''}
                onChange={(e) => setSettings({ ...settings, watermarkSubtext: e.target.value })}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={async () => {
                await updateAdminSettings(settings, packages);
                alert('Ajustes guardados con éxito.');
              }}
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold py-3 rounded-xl shadow-md transition-colors"
            >
              Guardar Cambios
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
                  Selección de Fotos
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
              <h5 className="text-sm font-bold uppercase tracking-wider text-stone-300">
                Fotos Seleccionadas por el Cliente:
              </h5>

              {viewingSession.photos.filter(p => p.selected).length === 0 ? (
                <div className="p-8 text-center bg-stone-950 rounded-2xl border border-stone-800 text-stone-400 text-xs">
                  El cliente aún no ha enviado ninguna selección.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {viewingSession.photos.filter(p => p.selected).map((photo, idx) => (
                    <div key={photo.id} className="bg-stone-950 border border-stone-800 rounded-2xl overflow-hidden">
                      <div className="aspect-[4/5] bg-black">
                        <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3 text-xs space-y-1">
                        <span className="font-bold text-white block">{photo.title}</span>
                        {photo.clientComment ? (
                          <div className="bg-stone-900 p-2 rounded-lg border border-stone-800 text-amber-300 italic">
                            "{photo.clientComment}"
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

            <button
              onClick={() => setViewingSession(null)}
              className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-xl"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
