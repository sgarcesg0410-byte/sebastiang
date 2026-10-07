import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { getPublicSchedule, getSlotsForDate, minutesToLabel, DAY_LAST_START_MIN, SESSION_DURATION_MIN } from '../services/bookingAvailability';

const pad = (n) => String(n).padStart(2, '0');

export default function BookingCalendar({ onReserveDate }) {
  const [schedule, setSchedule] = useState([]);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    let active = true;
    const load = () => getPublicSchedule().then(s => { if (active) setSchedule(s); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(<div key={`e-${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${pad(month + 1)}-${pad(d)}`;
    const slots = getSlotsForDate(schedule, key);
    const isPast = key < todayKey;
    const isSelected = selectedKey === key;
    cells.push(
      <button
        key={key}
        type="button"
        disabled={isPast}
        onClick={() => setSelectedKey(key)}
        className={`relative aspect-square rounded-xl text-xs sm:text-sm font-bold flex flex-col items-center justify-center transition-all ${
          isPast
            ? 'text-stone-700 cursor-not-allowed'
            : isSelected
              ? 'bg-amber-400 text-stone-950 shadow-lg shadow-amber-500/30'
              : slots.length > 0
                ? 'bg-rose-500/15 border border-rose-500/50 text-rose-200 hover:bg-rose-500/25'
                : 'bg-stone-900 border border-stone-800 text-stone-200 hover:border-amber-500/50'
        } ${key === todayKey && !isSelected ? 'ring-1 ring-amber-400' : ''}`}
      >
        <span>{d}</span>
        {slots.length > 0 && (
          <span className={`text-[9px] font-black ${isSelected ? 'text-stone-900' : 'text-rose-300'}`}>
            {slots.length} {slots.length === 1 ? 'cupo' : 'cupos'}
          </span>
        )}
      </button>
    );
  }

  const selectedSlots = selectedKey ? getSlotsForDate(schedule, selectedKey) : [];
  const lastEnd = selectedSlots.length ? Math.max(...selectedSlots.map(s => s.endMin)) : null;
  const dayFull = lastEnd !== null && lastEnd > DAY_LAST_START_MIN;

  return (
    <section id="booking-calendar-section" className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-6">
        <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Agenda en vivo
        </span>
        <h3 className="text-2xl font-serif font-bold text-white mt-3">Fechas y horarios disponibles</h3>
        <p className="text-xs text-stone-400 mt-1">
          Los días marcados en rojo ya tienen sesiones reservadas. Cada sesión dura aprox. {SESSION_DURATION_MIN / 60} horas.
        </p>
      </div>

      <div className="bg-stone-900/80 border border-stone-800 rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-serif font-bold text-white capitalize">
            {viewDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
          </h4>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-stone-400 border-b border-stone-800 pb-1">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">{cells}</div>

        {selectedKey && (
          <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-3">
            <span className="text-xs font-bold text-white block">
              {new Date(selectedKey + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            {selectedSlots.length === 0 ? (
              <p className="text-xs text-emerald-400 font-semibold">✅ Día completamente libre: elige la hora que prefieras.</p>
            ) : (
              <div className="space-y-1.5">
                {selectedSlots.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-xs text-rose-300 font-mono font-bold">
                    <Clock className="w-3.5 h-3.5" /> {minutesToLabel(s.startMin)} – {minutesToLabel(s.endMin)} • Ocupado
                  </div>
                ))}
                <p className="text-xs text-amber-300 font-semibold pt-1">
                  {dayFull
                    ? '⚠️ Este día ya no tiene más cupos. Elige otra fecha.'
                    : `⏳ Disponible después de esa sesión (desde las ${minutesToLabel(lastEnd)}).`}
                </p>
              </div>
            )}
            {!dayFull && (
              <button
                type="button"
                onClick={() => onReserveDate && onReserveDate(selectedKey)}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-black text-sm py-3 rounded-xl active:scale-98 transition-all"
              >
                📸 Reservar este día
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
