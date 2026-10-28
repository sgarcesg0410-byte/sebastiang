import React from 'react';
import {
  Calendar,
  CreditCard,
  PackageCheck,
  Plus,
  Star,
  Crown,
  FolderPlus,
  TrendingUp,
  DollarSign,
  Settings,
  ShieldCheck,
  Eye,
  LogOut,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export const ADMIN_NAVIGATION_SECTIONS = [
  {
    id: 'operations',
    title: 'Operaciones de Estudio',
    shortTitle: 'Operaciones',
    items: [
      {
        id: 'bookings',
        label: 'Reservas & Agenda',
        shortLabel: 'Reservas',
        icon: Calendar,
        color: 'text-amber-400',
        activeGradient: 'from-amber-500 to-amber-400 text-stone-950 font-black shadow-amber-500/25',
        getBadge: (props) => {
          const count = props.bookings?.length || 0;
          return count > 0 ? { text: String(count), tone: 'neutral' } : null;
        }
      },
      {
        id: 'payments',
        label: 'Pagos & Finanzas',
        shortLabel: 'Pagos',
        icon: CreditCard,
        color: 'text-emerald-400',
        activeGradient: 'from-emerald-500 to-emerald-400 text-stone-950 font-black shadow-emerald-500/25',
        getBadge: (props) => {
          const count = props.payments?.length || 0;
          return count > 0 ? { text: String(count), tone: 'emerald' } : null;
        }
      },
      {
        id: 'sessions',
        label: 'Galerías de Clientes',
        shortLabel: 'Galerías',
        icon: PackageCheck,
        color: 'text-purple-400',
        activeGradient: 'from-purple-600 via-amber-500 to-amber-400 text-stone-950 font-black shadow-purple-900/30',
        getBadge: (props) => {
          const sessions = props.safeSessions || [];
          const submittedCount = sessions.filter(s => s.status === 'submitted').length;
          if (submittedCount > 0) {
            return { text: `${submittedCount} lista${submittedCount > 1 ? 's' : ''}`, tone: 'highlight' };
          }
          return sessions.length > 0 ? { text: String(sessions.length), tone: 'purple' } : null;
        }
      },
      {
        id: 'create-session',
        label: 'Subir Fotos / Nueva Galería',
        shortLabel: 'Subir Fotos',
        icon: Plus,
        color: 'text-amber-300',
        activeGradient: 'from-amber-500 to-amber-400 text-stone-950 font-black shadow-amber-500/25',
        getBadge: () => null
      }
    ]
  },
  {
    id: 'marketing',
    title: 'Marketing & Clientes',
    shortTitle: 'Marketing',
    items: [
      {
        id: 'reviews',
        label: 'Opiniones & Reseñas',
        shortLabel: 'Opiniones',
        icon: Star,
        color: 'text-amber-400',
        activeGradient: 'from-amber-500 to-amber-400 text-stone-950 font-black shadow-amber-500/25',
        getBadge: (props) => {
          const count = props.reviewsList?.length || 0;
          return count > 0 ? { text: String(count), tone: 'amber' } : null;
        }
      },
      {
        id: 'loyalty',
        label: 'Club VIP & Fidelización',
        shortLabel: 'Club VIP',
        icon: Crown,
        color: 'text-amber-400',
        activeGradient: 'from-amber-500 to-amber-400 text-stone-950 font-black shadow-amber-500/25',
        getBadge: () => ({ text: 'VIP', tone: 'gold' })
      },
      {
        id: 'catalog-manager',
        label: 'Catálogo & Portafolio Web',
        shortLabel: 'Catálogo',
        icon: FolderPlus,
        color: 'text-amber-300',
        activeGradient: 'from-amber-500 to-amber-400 text-stone-950 font-black shadow-amber-500/25',
        getBadge: (props) => {
          const count = props.catalog?.length || 0;
          return count > 0 ? { text: String(count), tone: 'neutral' } : null;
        }
      }
    ]
  },
  {
    id: 'strategy',
    title: 'Estrategia & Tarifas',
    shortTitle: 'Estrategia',
    items: [
      {
        id: 'analytics',
        label: 'Métricas & Tráfico',
        shortLabel: 'Métricas',
        icon: TrendingUp,
        color: 'text-cyan-400',
        activeGradient: 'from-amber-500 to-amber-400 text-stone-950 font-black shadow-amber-500/25',
        getBadge: () => null
      },
      {
        id: 'pricing-manager',
        label: 'Tarifas & Cotizador',
        shortLabel: 'Tarifas',
        icon: DollarSign,
        color: 'text-emerald-300',
        activeGradient: 'from-amber-500 to-amber-400 text-stone-950 font-black shadow-amber-500/25',
        getBadge: () => null
      }
    ]
  },
  {
    id: 'system',
    title: 'Sistema & Control',
    shortTitle: 'Sistema',
    items: [
      {
        id: 'settings',
        label: 'Configuración & Respaldos',
        shortLabel: 'Ajustes',
        icon: Settings,
        color: 'text-stone-300',
        activeGradient: 'from-amber-500 to-amber-400 text-stone-950 font-black shadow-amber-500/25',
        getBadge: () => null
      },
      {
        id: 'auditor',
        label: 'Auditor Financiero & Diagnóstico',
        shortLabel: 'Auditor',
        icon: ShieldCheck,
        color: 'text-cyan-300',
        activeGradient: 'from-cyan-500 via-teal-400 to-blue-500 text-stone-950 font-black shadow-cyan-500/25',
        getBadge: (props) => {
          const totalAlerts = (props.auditConflicts?.conflictsCount || 0) + (props.auditErrors?.length || 0);
          if (totalAlerts > 0) {
            return { text: String(totalAlerts), tone: 'danger' };
          }
          return { text: '✓', tone: 'healthy' };
        }
      }
    ]
  }
];

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  bookings = [],
  payments = [],
  safeSessions = [],
  reviewsList = [],
  catalog = [],
  auditConflicts = null,
  auditErrors = [],
  isCollapsed = false,
  setIsCollapsed,
  mobileOpen = false,
  setMobileOpen,
  onBackToHome,
  handleLogout,
  handleSharePortfolioWhatsApp
}) {
  const badgeProps = {
    bookings,
    payments,
    safeSessions,
    reviewsList,
    catalog,
    auditConflicts,
    auditErrors
  };

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  const renderBadge = (badge) => {
    if (!badge) return null;
    let colorClasses = 'bg-stone-800 text-stone-300';
    if (badge.tone === 'danger') {
      colorClasses = 'bg-rose-500 text-white animate-pulse font-black shadow-sm shadow-rose-500/50';
    } else if (badge.tone === 'highlight') {
      colorClasses = 'bg-emerald-400 text-stone-950 font-black animate-pulse shadow-sm shadow-emerald-500/50';
    } else if (badge.tone === 'healthy') {
      colorClasses = 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40';
    } else if (badge.tone === 'emerald') {
      colorClasses = 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold';
    } else if (badge.tone === 'purple') {
      colorClasses = 'bg-purple-950 text-purple-200 border border-purple-500/40 font-bold';
    } else if (badge.tone === 'amber' || badge.tone === 'gold') {
      colorClasses = 'bg-amber-950 text-amber-300 border border-amber-500/40 font-bold';
    }

    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${colorClasses}`}>
        {badge.text}
      </span>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-stone-950 text-stone-200 select-none border-r border-stone-800/80">
      {/* BRANDING HEADER */}
      <div className="p-4 border-b border-stone-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/app-icon.png"
            alt="Sebastian G"
            className="h-10 w-10 rounded-2xl object-cover shadow-lg shadow-amber-500/20 border border-white/20 shrink-0"
          />
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  Estudio Oficial
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h2 className="text-sm font-serif font-bold text-white truncate">
                Sebastian G
              </h2>
              <span className="text-[10px] text-stone-400 block truncate">
                Fotografía & Edición
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button / Desktop collapse toggle */}
        <div className="flex items-center gap-1">
          {setMobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
              title="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {setIsCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800/80 transition-colors"
              title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* QUICK STATUS PILL (When not collapsed) */}
      {!isCollapsed && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between p-2 rounded-xl bg-stone-900/80 border border-stone-800 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-semibold text-stone-300">Atlas en Vivo</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
              PC ⇄ Móvil
            </span>
          </div>
        </div>
      )}

      {/* NAVIGATION SECTIONS */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 no-scrollbar">
        {ADMIN_NAVIGATION_SECTIONS.map((section) => (
          <div key={section.id} className="space-y-1">
            {!isCollapsed && (
              <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-stone-400 font-sans">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const badge = item.getBadge(badgeProps);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all touch-manipulation cursor-pointer ${
                      isActive
                        ? `bg-gradient-to-r ${item.activeGradient} shadow-lg scale-[1.01]`
                        : 'text-stone-300 hover:text-white hover:bg-stone-900/90'
                    } ${isCollapsed ? 'justify-center px-2' : 'justify-between'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-stone-950' : item.color
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="truncate text-left">
                          {item.label}
                        </span>
                      )}
                    </div>

                    {!isCollapsed && badge && (
                      <div className="shrink-0">
                        {renderBadge(badge)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="p-3 border-t border-stone-800/80 space-y-1.5 bg-stone-950/90">
        {handleSharePortfolioWhatsApp && (
          <button
            type="button"
            onClick={handleSharePortfolioWhatsApp}
            title={isCollapsed ? 'Compartir Web por WhatsApp' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 transition-all active:scale-95 cursor-pointer ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400 shrink-0" />
            {!isCollapsed && <span className="truncate">Compartir Web</span>}
          </button>
        )}

        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            title={isCollapsed ? 'Ver Web Pública' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-900 border border-stone-800/80 transition-all active:scale-95 cursor-pointer ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            {!isCollapsed && <span className="truncate">Ver Web Pública</span>}
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          title={isCollapsed ? 'Cerrar Sesión' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-300 hover:text-red-100 bg-red-950/30 hover:bg-red-950/60 border border-red-500/30 transition-all active:scale-95 cursor-pointer ${
            isCollapsed ? 'justify-center px-2' : ''
          }`}
        >
          <LogOut className="w-3.5 h-3.5 text-red-400 shrink-0" />
          {!isCollapsed && <span className="truncate">Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-300 sticky top-0 h-screen z-40 ${
          isCollapsed ? 'w-20' : 'w-64 lg:w-72'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* MOBILE DRAWER (SLIDE-OVER) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer Content */}
          <div className="relative w-72 sm:w-80 max-w-[85vw] h-full shadow-2xl z-10 animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
