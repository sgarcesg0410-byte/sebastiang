import React from 'react';
import {
  Calendar,
  CreditCard,
  PackageCheck,
  Menu
} from 'lucide-react';

export default function AdminBottomNav({
  activeTab,
  setActiveTab,
  setMobileOpen,
  bookings = [],
  payments = [],
  safeSessions = []
}) {
  const submittedCount = safeSessions.filter(s => s.status === 'submitted').length;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur-xl border-t border-stone-800/90 px-2 py-1.5 select-none shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">
      <div className="grid grid-cols-4 gap-1">
        {/* RESERVAS */}
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all relative ${
            activeTab === 'bookings'
              ? 'text-amber-400 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <div className="relative">
            <Calendar className="w-5 h-5" />
            {bookings.length > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[9px] px-1 py-0.2 rounded-full bg-stone-800 text-stone-200 font-bold border border-stone-700">
                {bookings.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Reservas</span>
        </button>

        {/* PAGOS */}
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all relative ${
            activeTab === 'payments'
              ? 'text-emerald-400 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <div className="relative">
            <CreditCard className="w-5 h-5" />
            {payments.length > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[9px] px-1 py-0.2 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40">
                {payments.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Pagos</span>
        </button>

        {/* GALERÍAS */}
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all relative ${
            activeTab === 'sessions'
              ? 'text-purple-400 font-black'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <div className="relative">
            <PackageCheck className="w-5 h-5" />
            {submittedCount > 0 ? (
              <span className="absolute -top-1.5 -right-2 text-[9px] px-1 py-0.2 rounded-full bg-emerald-400 text-stone-950 font-black animate-pulse">
                {submittedCount}
              </span>
            ) : safeSessions.length > 0 ? (
              <span className="absolute -top-1.5 -right-2 text-[9px] px-1 py-0.2 rounded-full bg-purple-950 text-purple-200 font-bold border border-purple-500/40">
                {safeSessions.length}
              </span>
            ) : null}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Galerías</span>
        </button>

        {/* MENÚ MÁS */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center py-1.5 rounded-xl text-stone-400 hover:text-white transition-all"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Menú</span>
        </button>
      </div>
    </nav>
  );
}
