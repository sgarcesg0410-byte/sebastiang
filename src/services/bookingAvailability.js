// src/services/bookingAvailability.js
// Disponibilidad de cupos por fecha y hora para Sebastian G • Fotografía.
// Solo expone fecha + hora (nunca nombres, teléfonos ni precios) para uso público.

import { getAdminBookings, formatTo12Hour } from './api';

export const SESSION_DURATION_MIN = 120; // duración estimada de cada sesión
export const DAY_START_MIN = 6 * 60;      // 6:00 a. m.
export const DAY_LAST_START_MIN = 19 * 60 + 30; // última hora de inicio sugerida: 7:30 p. m.

const INACTIVE_STATUSES = ['cancelled', 'canceled', 'rejected', 'completed', 'delivered'];

// "28/09/2026 a las 4:00 p. m." -> { dateKey: '2026-09-28', startMin: 960 }
export function parseDateTimeString(str) {
  if (!str) return null;
  const s = String(str).trim();
  let dateKey = null;
  const dm = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dm) {
    dateKey = `${dm[3]}-${String(dm[2]).padStart(2, '0')}-${String(dm[1]).padStart(2, '0')}`;
  } else {
    const ym = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ym) dateKey = `${ym[1]}-${String(ym[2]).padStart(2, '0')}-${String(ym[3]).padStart(2, '0')}`;
  }
  if (!dateKey) return null;

  let startMin = 16 * 60;
  const tm = s.match(/(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/i);
  if (tm) {
    let h = parseInt(tm[1], 10);
    const m = parseInt(tm[2], 10);
    const ap = (tm[3] || '').toLowerCase().replace(/[.\s]/g, '');
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    startMin = h * 60 + m;
  }
  return { dateKey, startMin };
}

export function minutesToLabel(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return formatTo12Hour(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

export function minutesToInput(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeInputToMinutes(t) {
  if (!t || !t.includes(':')) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Lista pública de cupos ocupados: [{ id, dateKey, startMin, endMin }]
export async function getPublicSchedule() {
  let bookings = [];
  try {
    bookings = await getAdminBookings();
  } catch (e) {
    bookings = [];
  }
  return buildSchedule(bookings);
}

export function buildSchedule(bookings = []) {
  const out = [];
  const seen = new Set();
  for (const b of Array.isArray(bookings) ? bookings : []) {
    if (!b || INACTIVE_STATUSES.includes(String(b.status || '').toLowerCase())) continue;
    const p = parseDateTimeString(b.dateTime);
    if (!p) continue;
    const key = `${p.dateKey}-${p.startMin}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(b.id),
      dateKey: p.dateKey,
      startMin: p.startMin,
      endMin: p.startMin + SESSION_DURATION_MIN
    });
  }
  return out.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.startMin - b.startMin);
}

export function getSlotsForDate(schedule, dateKey) {
  return schedule.filter(s => s.dateKey === dateKey);
}

// Verifica si fecha/hora elegida choca con una sesión. Devuelve el siguiente horario libre.
export function checkSlotAvailability(schedule, dateKey, timeInput) {
  const reqStart = timeInputToMinutes(timeInput);
  if (!dateKey || reqStart === null) return { available: true };
  const daySlots = getSlotsForDate(schedule, dateKey);
  const overlaps = (start, s) => start < s.endMin && start + SESSION_DURATION_MIN > s.startMin;

  const conflicting = daySlots.filter(s => overlaps(reqStart, s));
  if (conflicting.length === 0) return { available: true, daySlots };

  let candidate = reqStart;
  let moved = true;
  let guard = 0;
  while (moved && guard++ < 30) {
    moved = false;
    for (const s of daySlots) {
      if (overlaps(candidate, s)) {
        candidate = s.endMin;
        moved = true;
      }
    }
  }

  const blocker = conflicting[0];
  return {
    available: false,
    daySlots,
    conflictLabel: `${minutesToLabel(blocker.startMin)} - ${minutesToLabel(blocker.endMin)}`,
    suggestedMin: candidate,
    suggestedLabel: minutesToLabel(candidate),
    suggestedInput: minutesToInput(candidate),
    noMoreToday: candidate > DAY_LAST_START_MIN
  };
}

// Admin: siguiente cliente del mismo día después de una reserva dada
export function findNextBookingSameDay(allBookings = [], finishedBooking) {
  const fin = parseDateTimeString(finishedBooking?.dateTime);
  if (!fin) return null;
  const candidates = (Array.isArray(allBookings) ? allBookings : [])
    .filter(b => b && String(b.id) !== String(finishedBooking.id))
    .filter(b => !INACTIVE_STATUSES.includes(String(b.status || '').toLowerCase()))
    .map(b => ({ b, p: parseDateTimeString(b.dateTime) }))
    .filter(x => x.p && x.p.dateKey === fin.dateKey && x.p.startMin >= fin.startMin)
    .sort((a, c) => a.p.startMin - c.p.startMin);
  return candidates.length ? candidates[0].b : null;
}
