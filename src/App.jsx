import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Catalog from './components/Catalog';
import PackagesSection from './components/PackagesSection';
import BookingModal from './components/BookingModal';
import ClientGallery from './components/ClientGallery';
import AdminPanel from './components/AdminPanel';
import InteractiveLogoIntro from './components/InteractiveLogoIntro';
import { getSettings, getCatalog, getPackages } from './services/api';
import { Camera, MapPin, MessageCircle, ShieldCheck, Heart } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'packages' | 'gallery' | 'admin'
  const [activeGalleryToken, setActiveGalleryToken] = useState('demo-cliente-2026');
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedPackageForBooking, setSelectedPackageForBooking] = useState(null);

  // Bienvenida e intro con logo 3D interactivo (activo al entrar)
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/galeria/')) return false;
    }
    return true;
  });

  // Datos globales
  const [settings, setSettings] = useState({});
  const [catalog, setCatalog] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [sData, cData, pData] = await Promise.all([
        getSettings(),
        getCatalog(),
        getPackages()
      ]);
      setSettings(sData || {});
      setCatalog(Array.isArray(cData) ? cData : []);
      setPackages(Array.isArray(pData) ? pData : []);
    } catch (err) {
      console.error(err);
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
                src="/logo-white.png"
                alt="Sebastian G"
                className="h-12 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)] cursor-pointer"
                onClick={() => setShowIntro(true)}
                title="Toca para ver el logo interactivo"
              />
              <div className="border-l border-stone-800 pl-3">
                <span className="text-xs font-bold text-white block font-serif">
                  {settings.photographerName || 'Sebastian G'}
                </span>
                <span className="text-[11px] text-amber-400 block">
                  San Antero • Córdoba
                </span>
              </div>
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

            <div className="text-xs text-stone-500 font-medium tracking-wide">
              SG Software Solutions
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
