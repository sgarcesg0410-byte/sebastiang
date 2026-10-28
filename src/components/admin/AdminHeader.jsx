import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Bell,
  Sparkles,
  ChevronDown,
  Plus,
  MessageCircle,
  Copy,
  Star,
  LogOut,
  Eye,
  Calendar,
  PackageCheck,
  Tag,
  Check
} from 'lucide-react';
import { ADMIN_NAVIGATION_SECTIONS } from './AdminSidebar';

export default function AdminHeader({
  activeTab,
  setActiveTab,
  setMobileOpen,
  searchQuery = '',
  setSearchQuery,
  pushPermission = 'default',
  handleEnablePush,
  handleTestPush,
  onBackToHome,
  handleLogout,
  handleSharePortfolioWhatsApp,
  handleCopyStandalonePackagesLink,
  onOpenNewBookingModal
}) {
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const quickMenuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target)) {
        setQuickMenuOpen(false);
      }
    };
    if (quickMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [quickMenuOpen]);

  // Find breadcrumb info
  let activeSectionTitle = 'Panel de Control';
  let activeItemLabel = 'Dashboard';
  for (const sec of ADMIN_NAVIGATION_SECTIONS) {
    const found = sec.items.find(i => i.id === activeTab);
    if (found) {
      activeSectionTitle = sec.title;
      activeItemLabel = found.label;
      break;
    }
  }

  return (
    <header className="sticky top-0 z-30 w-full bg-stone-950/90 backdrop-blur-xl border-b border-stone-800/80 px-4 sm:px-6 py-3 select-none">
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        {/* LEFT: Mobile hamburger & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 rounded-xl text-stone-300 hover:text-white bg-stone-900 border border-stone-800 shrink-0"
            title="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <span className="hidden sm:inline font-semibold">{activeSectionTitle}</span>
              <span className="hidden sm:inline text-stone-600">/</span>
              <span className="text-amber-400 font-bold uppercase tracking-wider truncate">
                {activeItemLabel}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-serif font-bold text-white truncate leading-tight">
              {activeItemLabel}
            </h1>
          </div>
        </div>

        {/* CENTER: Global Search Bar */}
        <div className="hidden lg:flex flex-1 max-w-md mx-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente, teléfono, cita..."
              className="w-full pl-10 pr-8 py-2 bg-stone-900/90 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white text-xs px-1"
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: Live Status, Push, Quick Actions, Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live Sync Status (Atlas) */}
          <div
            className="hidden xl:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold"
            title="Conectado duraderamente a MongoDB Atlas en tiempo real"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Atlas en Vivo</span>
          </div>

          {/* Push Status / Button */}
          {pushPermission !== 'granted' ? (
            <button
              type="button"
              onClick={handleEnablePush}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all animate-pulse cursor-pointer"
              title="Activar notificaciones Push sonoras 24/7"
            >
              <Bell className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Activar Push</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTestPush}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-900/90 border border-emerald-500/40 hover:bg-stone-850 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Push activo. Haz clic para probar alerta sonora"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Push 24/7</span>
            </button>
          )}

          {/* Quick Action Dropdown */}
          <div className="relative" ref={quickMenuRef}>
            <button
              type="button"
              onClick={() => setQuickMenuOpen(!quickMenuOpen)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Acción Rápida</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${quickMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {quickMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl p-2 z-50 animate-fade-in text-left">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-stone-400 border-b border-stone-800/80 mb-1">
                  Acciones Rápidas del Estudio
                </div>

                {onOpenNewBookingModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenNewBookingModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 hover:text-white hover:bg-stone-800/80 transition-all text-left"
                  >
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Nueva Reserva de Cliente</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setQuickMenuOpen(false);
                    setActiveTab('create-session');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-stone-200 hover:text-white hover:bg-stone-800/80 transition-all text-left"
                >
                  <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Subir Fotos a Galería</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setQuickMenuOpen(false);
                    setActiveTab('pricing-manager');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-stone-200 hover:text-white hover:bg-stone-800/80 transition-all text-left"
                >
                  <Tag className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Cotizador de Paquetes WhatsApp</span>
                </button>

                {handleCopyStandalonePackagesLink && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      handleCopyStandalonePackagesLink();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-stone-200 hover:text-white hover:bg-stone-800/80 transition-all text-left"
                  >
                    <Copy className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Copiar Link de Paquetes</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setQuickMenuOpen(false);
                    setActiveTab('reviews');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-stone-200 hover:text-white hover:bg-stone-800/80 transition-all text-left"
                >
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                  <span>Link de Reseñas de Clientes</span>
                </button>

                {handleSharePortfolioWhatsApp && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      handleSharePortfolioWhatsApp();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-300 hover:text-white hover:bg-emerald-950/40 border-t border-stone-800/60 mt-1 pt-2 transition-all text-left"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Compartir Web WhatsApp</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Exit / Public Web button */}
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="hidden sm:flex p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-900 border border-stone-800 transition-colors"
              title="Ver Web Pública"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}

          {/* Logout button */}
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-xl text-red-400 hover:text-red-200 hover:bg-red-950/40 border border-red-500/20 transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MOBILE SEARCH BAR */}
      <div className="mt-2.5 lg:hidden">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cliente, teléfono o cita..."
            className="w-full pl-9 pr-8 py-2 bg-stone-900/90 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-400/60 transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
