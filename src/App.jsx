import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Catalog from './components/Catalog';
import PackagesSection from './components/PackagesSection';
import BookingModal from './components/BookingModal';
import ClientGallery from './components/ClientGallery';
import AdminPanel from './components/AdminPanel';
import InteractiveLogoIntro from './components/InteractiveLogoIntro';
import SecurityOverlay from './components/SecurityOverlay';
import { getSettings, getCatalog, getPackages, DEFAULT_PACKAGES, DEFAULT_REAL_CATALOG } from './services/api';
import { trackPageVisit } from './services/analytics';
import { supabase } from './services/supabase';
import { Camera, MapPin, MessageCircle, ShieldCheck, Heart } from 'lucide-react';
import { InstagramIcon, FacebookIcon, SOCIAL_LINKS } from './components/SocialIcons';

export default function App() {
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (urlParams.get('mode') === 'admin' || (isStandalone && !window.location.pathname.startsWith('/galeria/'))) {
        return 'admin';
      }
    }
    return 'home';
  }); // 'home' | 'packages' | 'gallery' | 'admin'

  const [activeGalleryToken, setActiveGalleryToken] = useState('demo-cliente-2026');
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedPackageForBooking, setSelectedPackageForBooking] = useState(null);

  // Bienvenida e intro con logo 3D interactivo (activo para visitantes web, apagado en app de admin)
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (window.location.pathname.startsWith('/galeria/') || isStandalone || urlParams.get('mode') === 'admin') {
        return false;
      }
    }
    return true;
  });

  // Datos globales con inicio instantáneo sin pantalla en blanco
  const [settings, setSettings] = useState({});
  const [catalog, setCatalog] = useState(DEFAULT_REAL_CATALOG);
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Registrar visita en analítica en tiempo real
    trackPageVisit();

    // Detectar si la URL contiene una ruta de galería tipo /galeria/token
    const path = window.location.pathname;
    if (path.startsWith('/galeria/')) {
      const urlToken = path.replace('/galeria/', '').trim();
      if (urlToken) {
        setActiveGalleryToken(urlToken);
        setCurrentView('gallery');
      }
    }

    loadInitialData();

    // 1. Sincronización en la nube en tiempo real (Celular <-> Computador)
    const channel = supabase
      .channel('catalog_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog' }, () => {
        getCatalog().then(data => {
          if (Array.isArray(data) && data.length > 0) setCatalog(data);
        });
      })
      .subscribe();

    // 2. Sincronización instantánea simultánea en 0ms entre pestañas / ventanas
    let bc;
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        bc = new BroadcastChannel('catalog_realtime_sync');
        bc.onmessage = () => {
          getCatalog().then(data => {
            if (Array.isArray(data) && data.length > 0) setCatalog(data);
          });
        };
      }
    } catch (e) {}

    const handleStorageSync = (e) => {
      if (e.key === 'sebastian_g_catalog_last_sync' || e.key === 'sebastian_g_catalog_v1') {
        getCatalog().then(data => {
          if (Array.isArray(data) && data.length > 0) setCatalog(data);
        });
      }
    };
    window.addEventListener('storage', handleStorageSync);

    return () => {
      supabase.removeChannel(channel);
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageSync);
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
        setCatalog(cRes.value);
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

  const handleOpenBooking = (pkg = null) => {
    setSelectedPackageForBooking(pkg);
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
      {currentView !== 'admin' && (
        <Navbar
          currentView={currentView}
          setCurrentView={(view) => {
            if (view === 'demo-gallery') {
              setActiveGalleryToken('demo-cliente-2026');
              setCurrentView('gallery');
            } else {
              setCurrentView(view);
            }
          }}
          onOpenBooking={() => handleOpenBooking(null)}
          onReplayIntro={() => setShowIntro(true)}
          photographerName={settings.photographerName}
        />
      )}

      {/* PROTECCIÓN GLOBAL DE SEGURIDAD ANTI-CAPTURAS Y ANTI-GESTOS */}
      <SecurityOverlay enabled={currentView !== 'admin'}>
        {/* CONTENIDO SEGÚN VISTA */}
        <main className="flex-1">
          {currentView === 'home' && (
            <>
              <Catalog
                catalog={catalog}
                packages={packages}
                onOpenBooking={() => handleOpenBooking(null)}
                onNavigateToAdmin={() => { setCurrentView('admin'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
              <div id="packages-section" className="border-t border-stone-800/80 bg-stone-900/40">
                <PackagesSection
                  packages={packages}
                  onSelectPackage={(pkg) => handleOpenBooking(pkg)}
                />
              </div>
            </>
          )}

          {currentView === 'packages' && (
            <div className="pt-8">
              <PackagesSection
                packages={packages}
                onSelectPackage={(pkg) => handleOpenBooking(pkg)}
              />
            </div>
          )}

          {currentView === 'gallery' && (
            <ClientGallery
              token={activeGalleryToken}
              onBackToHome={() => setCurrentView('home')}
            />
          )}

          {currentView === 'admin' && (
            <AdminPanel
              onOpenGalleryToken={handleOpenGalleryToken}
              onCatalogUpdated={loadInitialData}
              onBackToHome={() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onLogout={() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onPackagesUpdated={(newPkgs) => setPackages(newPkgs)}
            />
          )}
        </main>
      </SecurityOverlay>

      {/* MODAL DE RESERVA DIRECTA SIN REGISTRO */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        packages={packages}
        preselectedPackage={selectedPackageForBooking}
        settings={settings}
      />

      {/* FOOTER (SOLO EN VISTAS PÚBLICAS, AISLADO DEL DASHBOARD) */}
      {currentView !== 'admin' && (
        <footer className="border-t border-stone-800/80 bg-stone-950 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src="/app-icon.png"
                alt="Sebastian G"
                className="h-12 w-12 rounded-2xl object-cover shadow-lg shadow-pink-500/25 border border-white/20 cursor-pointer hover:scale-105 transition-all"
                onClick={() => setShowIntro(true)}
                title="Toca para ver el logo interactivo"
              />
              <div className="border-l border-stone-800 pl-3">
                <span className="text-sm font-bold text-white block font-serif">
                  {settings.photographerName || 'Sebastian G'}
                </span>
                <span className="text-[11px] font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-pink-400 to-purple-400 block uppercase">
                  Fotografía & Edición Profesional
                </span>
              </div>
            </div>

            {/* Redes Sociales Oficiales en Footer (Único Lugar de la App) */}
            <div className="flex items-center gap-3">
              <a
                href={SOCIAL_LINKS.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-pink-400 hover:border-pink-500/40 text-xs font-semibold transition-all hover:scale-105"
                title="Instagram: @sgarces01"
              >
                <InstagramIcon className="w-4 h-4 text-pink-400" />
                <span>Instagram</span>
              </a>
              <a
                href={SOCIAL_LINKS.facebook.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-blue-400 hover:border-blue-500/40 text-xs font-semibold transition-all hover:scale-105"
                title="Facebook: /Sgarces01"
              >
                <FacebookIcon className="w-4 h-4 text-blue-400" />
                <span>Facebook</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-stone-400">
              <button
                onClick={() => { setCurrentView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="hover:text-amber-400"
              >
                Inicio & Catálogo
              </button>
              <button
                onClick={() => { setCurrentView('packages'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="hover:text-amber-400"
              >
                Paquetes
              </button>
              <button
                onClick={() => { setActiveGalleryToken('demo-cliente-2026'); setCurrentView('gallery'); }}
                className="hover:text-amber-400 flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Demostración de Selección</span>
              </button>
              <button
                onClick={() => { setCurrentView('admin'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="hover:text-amber-400 font-semibold"
              >
                Panel Fotógrafo
              </button>
            </div>

            {/* Créditos del Desarrollador en Negrilla y Mayor Tamaño */}
            <div className="text-sm sm:text-base font-bold text-white tracking-wide">
              SG Software Solutions
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
