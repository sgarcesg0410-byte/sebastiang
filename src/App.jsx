import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Catalog from './components/Catalog';
import TestimonialsSection from './components/TestimonialsSection';
import BookingModal from './components/BookingModal';
const ClientGallery = React.lazy(() => import('./components/ClientGallery'));
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const PublicReceiptView = React.lazy(() => import('./components/PublicReceiptView'));
const PublicReviewView = React.lazy(() => import('./components/PublicReviewView'));
const PackagesSection = React.lazy(() => import('./components/PackagesSection'));

function ModuleLoader({ message = "Cargando módulo..." }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="relative w-14 h-14 mb-4">
        <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping"></div>
        <div className="w-14 h-14 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
      </div>
      <p className="text-stone-300 font-serif font-medium text-sm tracking-wider">{message}</p>
      <span className="text-[11px] text-stone-500 mt-1 uppercase tracking-widest">Sebastian G • Fotografía</span>
    </div>
  );
}
import AboutSection from './components/AboutSection';
import HowItWorksSection from './components/HowItWorksSection';
import InteractiveLogoIntro, { INTRO_SEEN_STORAGE_KEY } from './components/InteractiveLogoIntro';
import SecurityOverlay from './components/SecurityOverlay';
import MobileStickyBookingBar from './components/MobileStickyBookingBar';
import { getSettings, getCatalog, getPackages, DEFAULT_PACKAGES, DEFAULT_REAL_CATALOG, getDeletedCatalogIds, syncLocalCatalogToCloud, sortCatalogDescending } from './services/api';
import { trackPageVisit } from './services/analytics';
import { initOneSignal } from './services/onesignal';
import { initErrorCapture } from './services/systemAuditor';
import { Camera, MapPin, MessageCircle, ShieldCheck, Heart, Lock, Mail } from 'lucide-react';
import { InstagramIcon, FacebookIcon, SOCIAL_LINKS } from './components/SocialIcons';

/**
 * Resuelve la vista y parámetros de ruta a partir de un objeto tipo window.location.
 * Centraliza toda la lógica de ruteo para evitar duplicación entre estado inicial,
 * useEffect y el evento popstate.
 */
export function resolveRouteFromLocation(loc) {
  if (!loc) {
    return { view: 'home', receiptId: null, galleryToken: null };
  }
  const path = String(loc.pathname || '/');
  const hash = String(loc.hash || '');
  const urlParams = new URLSearchParams(String(loc.search || ''));

  let receiptId = null;
  if (hash.startsWith('#recibo=')) {
    receiptId = hash.replace('#recibo=', '').split('&')[0] || null;
  } else if (urlParams.get('recibo')) {
    receiptId = urlParams.get('recibo');
  }
  if (receiptId) {
    return { view: 'receipt', receiptId, galleryToken: null };
  }

  if (path.startsWith('/galeria/')) {
    const tokenFromUrl = path.replace('/galeria/', '').trim();
    return {
      view: 'gallery',
      receiptId: null,
      galleryToken: tokenFromUrl || 'demo-cliente-2026',
    };
  }

  if (
    path === '/calificar' || path === '/calificar/' ||
    path === '/opiniones' || path === '/opiniones/' ||
    path === '/review' || hash === '#calificar' || urlParams.get('calificar')
  ) {
    return { view: 'review', receiptId: null, galleryToken: null };
  }

  if (urlParams.get('mode') === 'admin' || path === '/admin' || path === '/admin/' || hash === '#admin') {
    return { view: 'admin', receiptId: null, galleryToken: null };
  }

  if (
    path === '/tarifas' || path === '/tarifas/' ||
    path === '/precios' || path === '/precios/' ||
    path === '/paquetes' || path === '/paquetes/' ||
    path === '/propuesta' || path === '/propuesta/' || path.startsWith('/propuesta/') ||
    path === '/paquetes-cliente' || path === '/paquetes-cliente/' ||
    hash === '#tarifas' || hash === '#precios' || hash === '#paquetes' || hash === '#propuesta' ||
    urlParams.get('tarifas') || urlParams.get('precios') || urlParams.get('paquetes') || urlParams.get('propuesta')
  ) {
    return { view: 'packages', receiptId: null, galleryToken: null };
  }

  return { view: 'home', receiptId: null, galleryToken: null };
}

export default function App() {
  const initialRoute = typeof window !== 'undefined'
    ? resolveRouteFromLocation(window.location)
    : { view: 'home', receiptId: null, galleryToken: null };

  const [activeReceiptId, setActiveReceiptId] = useState(initialRoute.receiptId);
  const [currentView, setCurrentView] = useState(initialRoute.view); // 'home' | 'packages' | 'gallery' | 'admin' | 'receipt' | 'review'
  const [activeGalleryToken, setActiveGalleryToken] = useState(initialRoute.galleryToken || 'demo-cliente-2026');
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedPackageForBooking, setSelectedPackageForBooking] = useState(null);
  const [selectedComboForBooking, setSelectedComboForBooking] = useState(null);
  const [selectedPhotoForBooking, setSelectedPhotoForBooking] = useState(null);
  const [selectedDateForBooking, setSelectedDateForBooking] = useState('');

  // Bienvenida e intro con logo 3D interactivo: no bloquea visitas recurrentes, rutas directas ni usuarios con movimiento reducido
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (
        localStorage.getItem(INTRO_SEEN_STORAGE_KEY) === '1' ||
        sessionStorage.getItem(INTRO_SEEN_STORAGE_KEY) === '1'
      ) {
        return false;
      }
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return false;
      }
    } catch (e) {}

    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    if (isStandalone || initialRoute.view !== 'home') {
      return false;
    }
    return true;
  });

  // Datos globales con inicio instantáneo sin pantalla en blanco
  const isRealCatalogItem = (item) => {
    if (!item || !item.id) return false;
    if (item.category === 'vip_client' || item.id.startsWith('vip-') || item.category?.endsWith('_data')) return false;
    if (item.id.startsWith('system_') || item.id.startsWith('book-') || item.id.startsWith('pay-') || item.id.startsWith('sess-') || item.id.startsWith('rev-')) return false;
    if (typeof item.url !== 'string' || !item.url.trim()) return false;
    if (item.url.trim().startsWith('{') || item.url.trim().startsWith('[')) return false;
    if (item.url.includes('fbcdn.net')) return false;
    return true;
  };

  const [settings, setSettings] = useState({});
  const [catalog, setCatalog] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('sebastian_g_catalog_v1');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(isRealCatalogItem);
            if (clean.length > 0) return sortCatalogDescending(clean);
          }
        }
      }
    } catch (e) {}
    return sortCatalogDescending(DEFAULT_REAL_CATALOG);
  });
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [loading, setLoading] = useState(false);

  const updateCatalogSafely = (data) => {
    if (!Array.isArray(data) || data.length === 0) return;
    setCatalog(prev => {
      const rawDeleted = getDeletedCatalogIds();
      const deletedSet = new Set(Array.isArray(rawDeleted) ? rawDeleted : []);

      // Mapa para unir todas las fotos sin perder jamás fotos subidas por el fotógrafo
      const map = new Map();
      (prev || []).forEach(p => {
        if (isRealCatalogItem(p) && !deletedSet.has(p.id)) {
          map.set(p.id, p);
        }
      });
      (data || []).forEach(p => {
        if (isRealCatalogItem(p) && !deletedSet.has(p.id)) {
          const existing = map.get(p.id);
          if (existing && existing.url && (!p.url || p.isHeavyLocal)) {
            map.set(p.id, { ...p, url: existing.url });
          } else {
            map.set(p.id, p);
          }
        }
      });

      const merged = sortCatalogDescending(Array.from(map.values()));
      if (prev && prev.length === merged.length && prev[0]?.id === merged[0]?.id) {
        return prev;
      }
      return merged.length > 0 ? merged : sortCatalogDescending(prev || DEFAULT_REAL_CATALOG);
    });
  };

  useEffect(() => {
    // Inicializar capturador de errores y caídas del software
    initErrorCapture();

    // Inicializar OneSignal solo en modo administrativo o PWA instalada (bajo demanda)
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    if (initialRoute.view === 'admin' || isStandalone) {
      initOneSignal();
    }

    // Registrar visita en analítica en tiempo real
    trackPageVisit();

    const applyLocationRoute = () => {
      const resolved = resolveRouteFromLocation(window.location);
      if (resolved.receiptId) setActiveReceiptId(resolved.receiptId);
      if (resolved.galleryToken) setActiveGalleryToken(resolved.galleryToken);
      setCurrentView(resolved.view);
    };

    applyLocationRoute();
    window.addEventListener('popstate', applyLocationRoute);

    loadInitialData();

    // Sincronizar silenciosamente fotos locales pendientes hacia la nube
    syncLocalCatalogToCloud().catch(() => {});

    let syncDebounce = null;
    const triggerDebouncedCatalog = () => {
      if (syncDebounce) clearTimeout(syncDebounce);
      syncDebounce = setTimeout(() => {
        getCatalog().then(data => {
          updateCatalogSafely(data);
        });
      }, 500);
    };

    // 1. Sincronización instantánea simultánea en 0ms entre pestañas / ventanas
    let bc;
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        bc = new BroadcastChannel('catalog_realtime_sync');
        bc.onmessage = () => {
          triggerDebouncedCatalog();
        };
      }
    } catch (e) {}

    const handleStorageSync = (e) => {
      if (e.key === 'sebastian_g_catalog_last_sync' || e.key === 'sebastian_g_catalog_v1') {
        triggerDebouncedCatalog();
      }
    };
    window.addEventListener('storage', handleStorageSync);

    return () => {
      if (syncDebounce) clearTimeout(syncDebounce);
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageSync);
      window.removeEventListener('popstate', applyLocationRoute);
    };
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [sRes, cRes, pRes] = await Promise.allSettled([
        getSettings(),
        getCatalog(),
        getPackages()
      ]);
      if (sRes.status === 'fulfilled' && sRes.value) {
        setSettings(sRes.value);
      }
      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value) && cRes.value.length > 0) {
        updateCatalogSafely(cRes.value);
      }
      if (pRes.status === 'fulfilled' && Array.isArray(pRes.value) && pRes.value.length > 0) {
        setPackages(pRes.value);
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBooking = (pkgOrPhoto = null, preselectedCombo = null) => {
    setSelectedDateForBooking('');
    setSelectedComboForBooking(preselectedCombo || null);
    if (pkgOrPhoto && (pkgOrPhoto.url || pkgOrPhoto.category)) {
      setSelectedPhotoForBooking(pkgOrPhoto);
      setSelectedPackageForBooking(null);
    } else {
      setSelectedPackageForBooking(pkgOrPhoto);
      setSelectedPhotoForBooking(null);
    }
    setIsBookingOpen(true);
  };

  useEffect(() => {
    if (currentView === 'packages' || currentView === 'proposal') {
      document.title = "Tarifas y Paquetes • Sebastian G Fotografía";
    } else if (currentView === 'home') {
      document.title = "Sebastian G • Fotografía & Edición Profesional | Cobertura Nacional";
    } else if (currentView === 'admin') {
      document.title = "Panel Administrativo • Sebastian G";
    } else if (currentView === 'gallery') {
      document.title = "Galería Privada • Sebastian G";
    }
  }, [currentView]);

  const handleReserveDate = (dateKey) => {
    setSelectedPackageForBooking(null);
    setSelectedPhotoForBooking(null);
    setSelectedDateForBooking(dateKey);
    setIsBookingOpen(true);
  };

  const handleOpenGalleryToken = (token) => {
    setActiveGalleryToken(token);
    setCurrentView('gallery');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      
      {/* INTRO Y BIENVENIDA CON LOGO 3D INTERACTIVO */}
      {showIntro && (
        <InteractiveLogoIntro
          onComplete={() => {
            setShowIntro(false);
          }}
        />
      )}

      {/* BARRA SUPERIOR (SOLO SE MUESTRA EN VISTAS PÚBLICAS, NO EN EL DASHBOARD DEL FOTÓGRAFO) */}
      {currentView !== 'admin' && currentView !== 'receipt' && currentView !== 'review' && (
        <Navbar
          currentView={currentView}
          setCurrentView={(view) => {
            if (view === 'demo-gallery') {
              setActiveGalleryToken('demo-cliente-2026');
              setCurrentView('gallery');
            } else {
              setCurrentView(view);
              if (typeof window !== 'undefined') {
                if (view === 'packages') {
                  window.history.pushState(null, '', '/paquetes');
                } else if (view === 'home') {
                  window.history.pushState(null, '', '/');
                }
              }
            }
          }}
          onOpenBooking={() => handleOpenBooking(null)}
          onReplayIntro={() => setShowIntro(true)}
          photographerName={settings.photographerName}
        />
      )}

      {/* PROTECCIÓN DE SEGURIDAD EXCLUSIVA EN GALERÍA PRIVADA (no interfiere en portada) */}
      <SecurityOverlay enabled={currentView === 'gallery'}>
        {/* CONTENIDO SEGÚN VISTA */}
        <main className="flex-1">
          {currentView === 'home' && (
            <>
              <Catalog
                catalog={catalog}
                packages={packages}
                onOpenBooking={(photo) => handleOpenBooking(photo)}
                onNavigateToAdmin={() => { setCurrentView('admin'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
              <AboutSection
                onNavigateToPackages={() => {
                  setCurrentView('packages');
                  if (typeof window !== 'undefined') window.history.pushState(null, '', '/paquetes');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onOpenBooking={(photo) => handleOpenBooking(photo)}
              />
              <HowItWorksSection
                onOpenBooking={() => handleOpenBooking(null)}
                onNavigateToPackages={() => {
                  setCurrentView('packages');
                  if (typeof window !== 'undefined') window.history.pushState(null, '', '/paquetes');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
              <div id="testimonials-section">
                <TestimonialsSection />
              </div>
            </>
          )}

          {currentView === 'gallery' && (
            <React.Suspense fallback={<ModuleLoader message="Cargando galería privada del cliente..." />}>
              <ClientGallery
                token={activeGalleryToken}
                onBackToHome={() => setCurrentView('home')}
              />
            </React.Suspense>
          )}

          {currentView === 'receipt' && (
            <React.Suspense fallback={<ModuleLoader message="Cargando comprobante de reserva..." />}>
              <PublicReceiptView
                bookingId={activeReceiptId}
                onBack={() => {
                  setCurrentView('home');
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', '/');
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </React.Suspense>
          )}

          {currentView === 'review' && (
            <React.Suspense fallback={<ModuleLoader message="Cargando formulario de opiniones..." />}>
              <PublicReviewView
                onBackToHome={() => {
                  setCurrentView('home');
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', '/');
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setTimeout(() => {
                    const elem = document.getElementById('testimonials-section');
                    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                  }, 250);
                }}
              />
            </React.Suspense>
          )}

          {(currentView === 'packages' || currentView === 'proposal') && (
            <div className="pt-2 sm:pt-6">
              <React.Suspense fallback={<ModuleLoader message="Cargando tarifas y paquetes..." />}>
                <PackagesSection
                  packages={packages}
                  settings={settings}
                  onSelectPackage={(pkg, combo) => handleOpenBooking(pkg, combo)}
                  onBackToHome={() => {
                    setCurrentView('home');
                    if (typeof window !== 'undefined') {
                      window.history.pushState(null, '', '/');
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </React.Suspense>
            </div>
          )}

          {currentView === 'admin' && (
            <React.Suspense fallback={<ModuleLoader message="Iniciando entorno administrativo seguro..." />}>
              <AdminPanel
                onOpenGalleryToken={handleOpenGalleryToken}
                onCatalogUpdated={loadInitialData}
                onBackToHome={() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                onLogout={() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                onPackagesUpdated={(newPkgs) => setPackages(newPkgs)}
              />
            </React.Suspense>
          )}
        </main>
      </SecurityOverlay>

      {/* MODAL DE RESERVA DIRECTA SIN REGISTRO */}
      {/* Se monta solo al abrirse: evita la violación de las Reglas de Hooks
          (BookingModal devolvía null antes de declarar sus hooks). */}
      {isBookingOpen && (
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => {
          setIsBookingOpen(false);
          setSelectedPhotoForBooking(null);
          setSelectedPackageForBooking(null);
          setSelectedComboForBooking(null);
        }}
        packages={packages}
        preselectedPackage={selectedPackageForBooking}
        preselectedPhoto={selectedPhotoForBooking}
        preselectedDate={selectedDateForBooking}
        preselectedCombo={selectedComboForBooking}
        settings={settings}
      />
      )}

      {/* BARRA FLOTANTE FIJA DE RESERVA PARA CELULARES */}
      <MobileStickyBookingBar
        currentView={currentView}
        onOpenBooking={() => handleOpenBooking(null)}
      />

      {/* FOOTER (SOLO EN VISTAS PÚBLICAS, AISLADO DEL DASHBOARD, RECIBO Y CALIFICACIONES) */}
      {currentView !== 'admin' && currentView !== 'receipt' && currentView !== 'review' && (
        <footer className="relative bg-[#090807] border-t border-stone-800/80 text-stone-300 pt-16 pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
          {/* Luz ambiental decorativa superior */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 max-w-4xl h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent pointer-events-none" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-36 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />

          <div className="max-w-7xl mx-auto space-y-12 relative z-10">
            {/* 1. SECCIÓN DESTACADA: 3 TARJETAS DE GARANTÍA Y VALOR EXCLUSIVO */}
            <div>
              <div className="text-center max-w-xl mx-auto mb-8">
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full inline-block">
                  Compromiso & Excelencia Sebastian G
                </span>
                <h3 className="text-lg sm:text-xl font-serif font-bold text-white mt-2">
                  Tu tranquilidad y satisfacción garantizadas
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                {/* Tarjeta 1: Calidad */}
                <div className="group relative p-5 rounded-2xl bg-stone-900/40 border border-stone-800/80 hover:border-amber-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-xl group-hover:scale-110 transition-transform">
                      📸
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                          Máxima Calidad 4K / Full HD
                        </h4>
                      </div>
                      <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                        Edición profesional, colorimetría cinematográfica y entrega de fotos originales en máxima resolución sin compresión.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 2: Clima */}
                <div className="group relative p-5 rounded-2xl bg-stone-900/40 border border-stone-800/80 hover:border-sky-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/5 hover:-translate-y-0.5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 text-xl group-hover:scale-110 transition-transform">
                      ⛅
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                          Garantía Total de Clima
                        </h4>
                      </div>
                      <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                        Si llueve o el clima no favorece tu sesión en playa o locación, reprogramamos tu fecha sin costo ni penalidad.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tarjeta 3: Obsequio */}
                <div className="group relative p-5 rounded-2xl bg-stone-900/40 border border-stone-800/80 hover:border-emerald-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-xl group-hover:scale-110 transition-transform">
                      🎁
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                          +2 Fotos Profesionales de Regalo
                        </h4>
                      </div>
                      <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                        Obsequio exclusivo incluido en todos los paquetes para capturar tomas espontáneas que no olvidarás jamás.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. GRID PRINCIPAL: 4 COLUMNAS BALANCEADAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 pt-10 border-t border-stone-800/60">
              
              {/* COLUMNA 1 (5 cols): Marca, Identidad y Redes */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src="/app-icon.png"
                    alt="Sebastian G"
                    className="h-14 w-14 rounded-2xl object-cover shadow-xl shadow-amber-500/10 border border-amber-500/30 cursor-pointer hover:scale-105 transition-all"
                    onClick={() => setShowIntro(true)}
                    title="Toca para revivir el logo interactivo"
                  />
                  <div>
                    <span className="text-lg font-bold text-white block font-serif tracking-tight">
                      {settings.photographerName || 'Sebastian G'}
                    </span>
                    <span className="text-xs font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-300 to-amber-200 block uppercase">
                      Fotografía & Edición Profesional
                    </span>
                  </div>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed max-w-sm">
                  Capturando instantes únicos con estética cinematográfica en las playas más hermosas de Colombia. Sesiones individuales, parejas, familias y aniversarios.
                </p>

                {/* Redes Sociales Oficiales */}
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-2">
                    Conéctate en Redes Sociales
                  </span>
                  <div className="flex items-center gap-2.5">
                    <a
                      href={SOCIAL_LINKS.instagram.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-900/90 border border-stone-800 text-stone-300 hover:text-white hover:border-pink-500/50 hover:bg-pink-500/10 text-xs font-semibold transition-all duration-200 hover:scale-105"
                      title="Instagram: @sgarces01"
                    >
                      <InstagramIcon className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
                      <span>@sgarces01</span>
                    </a>
                    <a
                      href={SOCIAL_LINKS.facebook.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-900/90 border border-stone-800 text-stone-300 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/10 text-xs font-semibold transition-all duration-200 hover:scale-105"
                      title="Facebook: /Sgarces01"
                    >
                      <FacebookIcon className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                      <span>Facebook</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* COLUMNA 2 (2 cols): Explorar / Navegación */}
              <div className="lg:col-span-2 space-y-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">
                  Explorar
                </span>
                <ul className="space-y-2.5 text-xs text-stone-400">
                  <li>
                    <button
                      onClick={() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="hover:text-amber-300 transition-colors flex items-center gap-1.5"
                    >
                      <span>Catálogo & Galería</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        if (currentView !== 'home') {
                          setCurrentView('home');
                          setTimeout(() => {
                            const el = document.getElementById('about-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        } else {
                          const el = document.getElementById('about-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      className="hover:text-amber-300 transition-colors flex items-center gap-1.5"
                    >
                      <span>Sobre Mí (¿Quién soy?)</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        if (currentView !== 'home') {
                          setCurrentView('home');
                          setTimeout(() => {
                            const el = document.getElementById('how-it-works-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        } else {
                          const el = document.getElementById('how-it-works-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      className="hover:text-amber-300 transition-colors flex items-center gap-1.5"
                    >
                      <span>Cómo Funciona (4 Pasos)</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { setCurrentView('packages'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="hover:text-amber-300 transition-colors flex items-center gap-1.5"
                    >
                      <span>Paquetes & Tarifas</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        if (currentView !== 'home') {
                          setCurrentView('home');
                          setTimeout(() => {
                            const el = document.getElementById('testimonials-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        } else {
                          const el = document.getElementById('testimonials-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      className="hover:text-amber-300 transition-colors flex items-center gap-1.5"
                    >
                      <span>Opiniones de Clientes</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { setActiveGalleryToken('demo-cliente-2026'); setCurrentView('gallery'); }}
                      className="hover:text-amber-300 transition-colors flex items-center gap-1.5 text-amber-400/90 font-medium"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Demo Selección</span>
                    </button>
                  </li>
                </ul>
              </div>

              {/* COLUMNA 3 (2 cols): Locaciones */}
              <div className="lg:col-span-2 space-y-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">
                  Cobertura & Destinos
                </span>
                <ul className="space-y-2 text-xs text-stone-400">
                  <li className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                    <span>Playas & Atardeceres</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                    <span>Cabañas, Hoteles & Fincas</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                    <span>Sesiones Urbanas & Exteriores</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                    <span>Colombia • Cobertura Nacional</span>
                  </li>
                </ul>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Disponibilidad 2026
                  </span>
                </div>
              </div>

              {/* COLUMNA 4 (3 cols): Contacto Directo */}
              <div className="lg:col-span-3 space-y-3.5">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">
                  Contacto Directo
                </span>
                <p className="text-xs text-stone-400 leading-relaxed">
                  ¿Tienes alguna duda o locación personalizada? Escríbenos directamente a nuestro correo oficial de reservas:
                </p>

                <div className="pt-1">
                  <a
                    href="mailto:reservas@sebastiang.app"
                    className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-stone-900/90 border border-amber-500/30 hover:border-amber-400 text-stone-200 hover:text-white font-bold text-xs shadow-md shadow-black/40 transition-all hover:scale-[1.02] group"
                  >
                    <Mail className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="font-mono text-amber-300 group-hover:text-amber-200">reservas@sebastiang.app</span>
                  </a>
                </div>
              </div>
            </div>

            {/* 3. SUB-FOOTER INFERIOR: COPYRIGHT & ACCESO ADMINISTRATIVO DISCRETO */}
            <div className="pt-6 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
              <div className="text-center sm:text-left space-y-1">
                <span className="block">© {new Date().getFullYear()} {settings.photographerName || 'Sebastian G'}. Todos los derechos reservados. Colombia • Cobertura Nacional y Destinos.</span>
                <span className="block text-[11px] text-stone-600">Protección de Datos Personales (Ley 1581 de 2012 • Habeas Data Colombia) • Galerías privadas cifradas y garantía de clima oficial.</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-stone-400 font-semibold tracking-wide">
                  SG Software Solutions
                </span>
                {/* Candado de acceso administrativo discreto para Sebastian */}
                <button
                  onClick={() => {
                    setCurrentView('admin');
                    if (typeof window !== 'undefined') window.history.pushState(null, '', '/admin');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-stone-700 hover:text-amber-400 transition-colors p-1"
                  title="Acceso Administrativo"
                  aria-label="Panel Admin"
                >
                  <Lock className="w-3.5 h-3.5 opacity-30 hover:opacity-100" />
                </button>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
