// src/services/systemAuditor.js
// Auditor Inteligente del Software para Sebastian G • Fotografía
// Monitorea errores en vivo, caídas de servicios, conflictos en pagos y mejoras del sistema.

import { supabase } from './supabase';

const LOCAL_ERROR_LOGS_KEY = 'sebastian_g_error_logs_v1';
const MAX_ERROR_LOGS = 50;

let isCapturingInitialized = false;

// 1. CAPTURADOR GLOBAL DE ERRORES Y CAÍDAS
export function initErrorCapture() {
  if (isCapturingInitialized || typeof window === 'undefined') return;
  isCapturingInitialized = true;

  // Captura de errores síncronos de JavaScript y WebView
  window.addEventListener('error', (event) => {
    try {
      const errorObj = {
        id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        message: event.message || 'Error de JavaScript no especificado',
        filename: event.filename ? event.filename.split('/').pop() : 'desconocido',
        lineno: event.lineno || 0,
        colno: event.colno || 0,
        type: 'runtime_error',
        severity: 'critical'
      };
      saveErrorLog(errorObj);
    } catch (e) {}
  });

  // Captura de promesas rechazadas no controladas (errores asíncronos y caídas de red)
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason;
      const message = typeof reason === 'string' 
        ? reason 
        : (reason && reason.message) ? reason.message : 'Promesa asíncrona rechazada sin captura';
      
      const errorObj = {
        id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        message: String(message).slice(0, 300),
        filename: 'Async/Promise',
        lineno: 0,
        colno: 0,
        type: 'unhandled_promise',
        severity: message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch') ? 'warning' : 'critical'
      };
      saveErrorLog(errorObj);
    } catch (e) {}
  });

  console.log('🛡️ [Auditor] Monitor de errores y caídas activado 24/7');
}

export function logSoftwareError(error, context = '', severity = 'error') {
  try {
    const errorObj = {
      id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      message: (error?.message || String(error)).slice(0, 300),
      filename: context || 'Módulo Interno',
      lineno: 0,
      colno: 0,
      type: 'manual_log',
      severity
    };
    saveErrorLog(errorObj);
  } catch (e) {}
}

function saveErrorLog(errorObj) {
  try {
    const raw = localStorage.getItem(LOCAL_ERROR_LOGS_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift(errorObj);
    if (logs.length > MAX_ERROR_LOGS) {
      logs.length = MAX_ERROR_LOGS;
    }
    localStorage.setItem(LOCAL_ERROR_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {}
}

export function getSoftwareErrors() {
  try {
    const raw = localStorage.getItem(LOCAL_ERROR_LOGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function clearSoftwareErrors() {
  try {
    localStorage.removeItem(LOCAL_ERROR_LOGS_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

// 2. AUDITOR DE CAÍDAS Y CONECTIVIDAD DE SERVICIOS EN TIEMPO REAL
export async function auditServicesHealth() {
  const results = {
    supabase: { name: 'Supabase Cloud (Base de Datos)', status: 'checking', latencyMs: 0, message: '' },
    apiServer: { name: 'Servidor API / Nube Vercel', status: 'checking', latencyMs: 0, message: '' },
    storage: { name: 'Almacenamiento Local & IndexedDB', status: 'checking', latencyMs: 0, message: '', usedKb: 0, percent: 0 },
    push: { name: 'Notificaciones Push (OneSignal / Android)', status: 'checking', latencyMs: 0, message: '' }
  };

  // Test 1: Supabase Cloud
  const supaStart = performance.now();
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout > 5s')), 5000));
    const supaPromise = supabase.from('catalog').select('id').limit(1);
    const { error } = await Promise.race([supaPromise, timeoutPromise]);
    const supaEnd = performance.now();
    results.supabase.latencyMs = Math.round(supaEnd - supaStart);
    if (error) {
      results.supabase.status = 'degraded';
      results.supabase.message = `Respondió con aviso: ${error.message}`;
    } else {
      results.supabase.status = 'ok';
      results.supabase.message = `Conectado y sincronizado (${results.supabase.latencyMs} ms)`;
    }
  } catch (err) {
    results.supabase.status = 'down';
    results.supabase.message = `Posible caída o sin internet: ${err.message}`;
  }

  // Test 2: Servidor API
  const apiStart = performance.now();
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout > 4s')), 4000));
    const res = await Promise.race([fetch('/api/settings'), timeoutPromise]);
    const apiEnd = performance.now();
    results.apiServer.latencyMs = Math.round(apiEnd - apiStart);
    if (res.ok) {
      results.apiServer.status = 'ok';
      results.apiServer.message = `Operativo (${results.apiServer.latencyMs} ms)`;
    } else {
      results.apiServer.status = 'degraded';
      results.apiServer.message = `Código HTTP ${res.status}`;
    }
  } catch (err) {
    results.apiServer.status = 'down';
    results.apiServer.message = 'Modo Offline / Servidor API no disponible';
  }

  // Test 3: Almacenamiento Local y Cuota
  try {
    let totalBytes = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalBytes += (localStorage[key].length + key.length) * 2;
      }
    }
    const usedKb = Math.round(totalBytes / 1024);
    const maxKb = 5120; // 5MB límite estándar
    const percent = Math.min(100, Math.round((usedKb / maxKb) * 100));

    results.storage.usedKb = usedKb;
    results.storage.percent = percent;
    results.storage.latencyMs = 1;

    if (percent > 90) {
      results.storage.status = 'degraded';
      results.storage.message = `Alerta: Memoria al ${percent}% (${usedKb} KB de 5 MB). Puede requerir limpieza.`;
    } else {
      results.storage.status = 'ok';
      results.storage.message = `Saludable: ${usedKb} KB utilizados (${percent}% del límite local).`;
    }
  } catch (e) {
    results.storage.status = 'degraded';
    results.storage.message = 'Acceso a memoria local restringido.';
  }

  // Test 4: Push / Notificaciones
  if (typeof window !== 'undefined' && window.AndroidNotificationBridge) {
    results.push.status = 'ok';
    results.push.message = 'Puente nativo Android APK activo y listo';
  } else if (typeof window !== 'undefined' && window.OneSignal) {
    results.push.status = 'ok';
    results.push.message = 'OneSignal Web Push inicializado';
  } else {
    results.push.status = 'degraded';
    results.push.message = 'Web Push en espera o bloqueado por navegador';
  }

  return results;
}

// 3. AUDITOR DE PAGOS Y CONFLICTOS FINANCIEROS
export function auditPaymentConflicts(bookings = [], payments = []) {
  const conflicts = [];

  const validPayments = Array.isArray(payments) ? payments : [];
  const validBookings = Array.isArray(bookings) ? bookings : [];

  // Mapa de pagos por referencia para detectar duplicados
  const refMap = new Map();
  for (const pay of validPayments) {
    const ref = (pay.reference || '').trim().toLowerCase();
    if (ref && ref !== 'comprobante adjunto' && ref !== 'efectivo' && ref !== 'pago directo') {
      if (!refMap.has(ref)) {
        refMap.set(ref, []);
      }
      refMap.get(ref).push(pay);
    }
  }

  // A. Detectar referencias duplicadas
  for (const [ref, list] of refMap.entries()) {
    if (list.length > 1) {
      conflicts.push({
        id: `conf-ref-${ref}`,
        type: 'duplicate_reference',
        severity: 'high',
        title: `Transferencia posiblemente duplicada (Ref: ${ref})`,
        description: `Se detectaron ${list.length} pagos registrados con la misma referencia bancaria "${ref}". Verifica que no se haya acreditado el mismo comprobante dos veces.`,
        relatedIds: list.map(p => p.id),
        clientNames: list.map(p => p.clientName).join(', ')
      });
    }
  }

  // B. Detectar reservas marcadas como completadas pero con pagos faltantes
  for (const b of validBookings) {
    const bId = String(b.id);
    const relatedPays = validPayments.filter(p => 
      String(p.sessionToken) === bId && p.status !== 'rejected'
    );
    const totalPaid = relatedPays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalPrice = Number(b.totalPrice) || 0;

    if (b.status === 'completed' && totalPrice > 0 && totalPaid < (totalPrice * 0.95)) {
      conflicts.push({
        id: `conf-underpaid-${b.id}`,
        type: 'underpaid_completed_booking',
        severity: 'medium',
        title: `Reserva completada con saldo faltante: ${b.clientName}`,
        description: `La reserva está marcada como "Pagada / Completada", pero solo registra $${totalPaid.toLocaleString('es-CO')} COP de un total pactado de $${totalPrice.toLocaleString('es-CO')} COP (Faltan $${(totalPrice - totalPaid).toLocaleString('es-CO')} COP).`,
        bookingId: b.id,
        missingAmount: totalPrice - totalPaid
      });
    }

    // C. Detectar reservas pendientes antiguas sin abono (> 5 días)
    if (b.status === 'pending' && totalPaid === 0 && b.createdAt) {
      const daysOld = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOld >= 5) {
        conflicts.push({
          id: `conf-stale-${b.id}`,
          type: 'stale_pending_booking',
          severity: 'low',
          title: `Reserva estancada sin abono: ${b.clientName} (${daysOld} días)`,
          description: `El cliente solicitó fecha para "${b.dateTime}" hace ${daysOld} días y aún no ha reportado su abono inicial del 50%.`,
          bookingId: b.id,
          clientPhone: b.clientWhatsApp,
          daysOld
        });
      }
    }
  }

  // D. Detectar pagos huérfanos (pagos en Supabase sin reserva asociada)
  const bookingIdSet = new Set(validBookings.map(b => String(b.id)));
  for (const p of validPayments) {
    if (p.sessionToken && !bookingIdSet.has(String(p.sessionToken)) && !String(p.sessionToken).startsWith('manual-')) {
      conflicts.push({
        id: `conf-orphan-${p.id}`,
        type: 'orphan_payment',
        severity: 'low',
        title: `Pago sin reserva vinculada: ${p.clientName} ($${Number(p.amount).toLocaleString('es-CO')} COP)`,
        description: `El pago tiene ID de sesión "${p.sessionToken}", pero no coincide con ninguna reserva en la agenda actual.`,
        paymentId: p.id
      });
    }
  }

  return {
    conflictsCount: conflicts.length,
    conflicts
  };
}

// 4. MOTOR DE DIAGNÓSTICO: ¿QUÉ TOCA MEJORAR? (INSIGHTS & OPTIMIZACIONES)
export function generateImprovementInsights(bookings = [], payments = [], catalog = [], servicesHealth = {}, paymentConflicts = {}) {
  const insights = [];

  // 1. Salud del catálogo fotográfico
  const rawCatalog = Array.isArray(catalog) ? catalog : [];
  const heavyPhotos = rawCatalog.filter(p => typeof p.url === 'string' && p.url.startsWith('data:image/') && p.url.length > 500000);
  if (heavyPhotos.length > 0) {
    insights.push({
      id: 'ins-heavy-photos',
      category: 'performance',
      level: 'warning',
      title: `${heavyPhotos.length} foto(s) pesadas en base64 en el catálogo`,
      description: 'Estas fotos ocupan memoria local y pueden ralentizar la carga en teléfonos móviles con señal débil. Se recomienda optimizarlas o cargarlas como archivos estáticos.',
      actionType: 'optimize_catalog'
    });
  } else {
    insights.push({
      id: 'ins-catalog-ok',
      category: 'performance',
      level: 'good',
      title: 'Catálogo fotográfico 100% optimizado',
      description: 'Todas las fotos públicas cargan desde archivos estáticos ultrarrápidos con protección anticopia.',
      actionType: 'none'
    });
  }

  // 2. Almacenamiento local
  if (servicesHealth?.storage?.percent > 80) {
    insights.push({
      id: 'ins-storage-high',
      category: 'storage',
      level: 'warning',
      title: `Memoria local al ${servicesHealth.storage.percent}% de su capacidad`,
      description: 'El almacenamiento del navegador está cerca de llenarse. Tu sistema IndexedDB de respaldo está activo, pero conviene purgar logs antiguos.',
      actionType: 'clear_logs'
    });
  }

  // 3. Eficiencia de cobro y reservas
  const pendingOld = (paymentConflicts?.conflicts || []).filter(c => c.type === 'stale_pending_booking');
  if (pendingOld.length > 0) {
    insights.push({
      id: 'ins-stale-bookings',
      category: 'revenue',
      level: 'opportunity',
      title: `${pendingOld.length} cliente(s) esperando confirmación de cupo`,
      description: 'Contacta a estos clientes por WhatsApp para recordarles el abono del 50% antes de liberar su fecha en la agenda.',
      actionType: 'followup_whatsapp',
      clients: pendingOld.map(c => ({ name: c.clientName, phone: c.clientPhone }))
    });
  }

  // 4. Supabase Cloud Uptime
  if (servicesHealth?.supabase?.status === 'ok') {
    insights.push({
      id: 'ins-supabase-ok',
      category: 'infrastructure',
      level: 'good',
      title: `Base de datos Supabase respondiendo a ${servicesHealth.supabase.latencyMs} ms`,
      description: 'Sincronización en la nube activa: los cambios en tu PC se reflejan al instante en la APK de tu celular.',
      actionType: 'none'
    });
  } else if (servicesHealth?.supabase?.status === 'down') {
    insights.push({
      id: 'ins-supabase-down',
      category: 'infrastructure',
      level: 'critical',
      title: 'Supabase Cloud no responde (Modo Offline activo)',
      description: 'La aplicación está funcionando con la memoria interna de tu dispositivo. Revisa tu conexión a internet.',
      actionType: 'check_internet'
    });
  }

  // Cálculo de Score General (0 a 100)
  let score = 100;
  if (servicesHealth?.supabase?.status === 'down') score -= 35;
  if (servicesHealth?.supabase?.status === 'degraded') score -= 15;
  if (paymentConflicts?.conflictsCount > 0) score -= Math.min(30, paymentConflicts.conflictsCount * 10);
  if (heavyPhotos.length > 0) score -= 10;
  if (getSoftwareErrors().length > 0) score -= Math.min(20, getSoftwareErrors().length * 4);

  score = Math.max(10, Math.min(100, score));

  let ratingLabel = 'Excelente • Sistema Estable';
  let ratingColor = 'emerald';
  if (score < 60) {
    ratingLabel = 'Crítico • Requiere Atención';
    ratingColor = 'rose';
  } else if (score < 85) {
    ratingLabel = 'Atención • Conflictos Detectados';
    ratingColor = 'amber';
  }

  return {
    score,
    ratingLabel,
    ratingColor,
    insights
  };
}
