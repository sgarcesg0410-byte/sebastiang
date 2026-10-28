import React, { useState } from 'react';
import {
  Eye,
  Share2,
  Star,
  Crown,
  ChevronDown,
  ChevronUp,
  BarChart2
} from 'lucide-react';
import { NequiLogo, DaviPlataLogo, DaleLogo } from '../PaymentLogos';

export default function AdminMetricsBar({
  analyticsStats = { totalVisits: 0, todayVisits: 0, totalShares: 0 },
  payments = [],
  reviewsList = [],
  setActiveTab
}) {
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return localStorage.getItem('admin_metrics_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const toggleMinimize = () => {
    setIsMinimized(prev => {
      const next = !prev;
      try {
        localStorage.setItem('admin_metrics_minimized', String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="select-none">
      {/* HEADER WITH TOGGLE */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-400">
            Rendimiento del Estudio en Vivo
          </span>
        </div>

        <button
          type="button"
          onClick={toggleMinimize}
          className="text-[10px] font-bold text-stone-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-stone-900 transition-colors cursor-pointer"
        >
          <span>{isMinimized ? 'Mostrar Métricas' : 'Ocultar'}</span>
          {isMinimized ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
      </div>

      {/* EXPANDED GRID */}
      {!isMinimized && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* VISITAS */}
          <div
            onClick={() => setActiveTab('analytics')}
            className="bg-stone-900/80 border border-stone-800 hover:border-amber-500/40 p-3.5 rounded-2xl cursor-pointer transition-all text-left shadow-lg hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
              <span className="font-semibold">Visitas Totales</span>
              <Eye className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-2xl font-black text-white font-mono">{analyticsStats.totalVisits}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">+{analyticsStats.todayVisits} hoy</span>
          </div>

          {/* COMPARTIDOS */}
          <div
            onClick={() => setActiveTab('analytics')}
            className="bg-stone-900/80 border border-stone-800 hover:border-amber-500/40 p-3.5 rounded-2xl cursor-pointer transition-all text-left shadow-lg hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
              <span className="font-semibold">Enlace Compartido</span>
              <Share2 className="w-4 h-4 text-pink-400" />
            </div>
            <span className="text-2xl font-black text-white font-mono">{analyticsStats.totalShares}</span>
            <span className="text-[10px] text-stone-400 block mt-0.5">Por WhatsApp / Web</span>
          </div>

          {/* PAGOS EN VIVO */}
          <div
            onClick={() => setActiveTab('payments')}
            className="bg-stone-900/80 border border-stone-800 hover:border-emerald-500/40 p-3.5 rounded-2xl cursor-pointer transition-all text-left shadow-lg hover:scale-[1.01] group"
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

          {/* OPINIONES */}
          <div
            onClick={() => setActiveTab('reviews')}
            className="bg-stone-900/80 border border-stone-800 hover:border-amber-500/40 p-3.5 rounded-2xl cursor-pointer transition-all text-left shadow-lg hover:scale-[1.01] group"
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

          {/* FIDELIZACIÓN */}
          <div
            onClick={() => setActiveTab('loyalty')}
            className="bg-stone-900/80 border border-stone-800 hover:border-amber-500/40 p-3.5 rounded-2xl cursor-pointer transition-all text-left shadow-lg hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between text-stone-400 text-xs mb-1">
              <span className="font-semibold">Fidelización VIP</span>
              <Crown className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-2xl font-black text-white font-mono">15%</span>
            <span className="text-[10px] text-amber-400 block mt-0.5 font-bold">Clientes recurrentes</span>
          </div>
        </div>
      )}

      {/* MINIMIZED SUMMARY STRIP */}
      {isMinimized && (
        <div className="flex items-center justify-between px-4 py-2 bg-stone-900/60 border border-stone-800/80 rounded-xl text-xs text-stone-300">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className="hover:text-amber-400 transition-colors"
            >
              <strong>{analyticsStats.totalVisits}</strong> <span className="text-stone-400">visitas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className="hover:text-emerald-400 transition-colors"
            >
              <strong>{payments.length}</strong> <span className="text-stone-400">pagos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className="hover:text-amber-400 transition-colors"
            >
              <strong>{reviewsList.length}</strong> <span className="text-stone-400">opiniones (5.0 ⭐)</span>
            </button>
          </div>
          <button
            type="button"
            onClick={toggleMinimize}
            className="text-amber-400 hover:underline text-[11px] font-bold"
          >
            Ver Detalle Completo
          </button>
        </div>
      )}
    </div>
  );
}
