// Sistema de Notificaciones Push y Alertas en Tiempo Real (Estilo WhatsApp / Messenger)
// Compatible con Android APK, Web PWA, Celulares y Computadores

let titleFlashTimer = null;
let originalTitle = typeof document !== 'undefined' ? document.title : 'Sebastian G • Fotografía';

// Chime de audio sintetizado con Web Audio API (No depende de archivos mp3 externos)
export function playPushNotificationChime(type = 'booking') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'payment') {
      // Tono triunfal de pago (Do5 -> Mi5 -> Sol5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.36);
      });
    } else {
      // Tono elegante de dos tonos estilo WhatsApp / Mensajería VIP (Re5 -> La5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.26);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5
      gain2.gain.setValueAtTime(0.32, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.56);
    }
  } catch (e) {
    console.warn('Web Audio chime no soportado o bloqueado:', e);
  }
}

// Parpadeo visual en el título de la pestaña para llamar la atención en segundo plano
export function flashDocumentTitle(alertText) {
  if (typeof document === 'undefined') return;
  if (titleFlashTimer) clearInterval(titleFlashTimer);
  
  originalTitle = 'Sebastian G • Fotografía Profesional';
  let isAlert = true;
  document.title = alertText;

  titleFlashTimer = setInterval(() => {
    document.title = isAlert ? alertText : originalTitle;
    isAlert = !isAlert;
  }, 1200);

  const stopFlashing = () => {
    if (titleFlashTimer) {
      clearInterval(titleFlashTimer);
      titleFlashTimer = null;
    }
    document.title = originalTitle;
    window.removeEventListener('focus', stopFlashing);
    window.removeEventListener('click', stopFlashing);
  };

  window.addEventListener('focus', stopFlashing);
  window.addEventListener('click', stopFlashing);
}

// Obtener estado actual del permiso de notificaciones
export function getPushPermissionState() {
  if (typeof window !== 'undefined' && window.AndroidNotificationBridge) {
    try {
      return window.AndroidNotificationBridge.areNotificationsEnabled() ? 'granted' : 'default';
    } catch (e) {
      return 'default';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

// Solicitar permiso de notificaciones Push al usuario
export async function requestPushPermission() {
  if (typeof window !== 'undefined' && window.AndroidNotificationBridge) {
    try {
      window.AndroidNotificationBridge.requestNotificationPermission();
      const enabled = window.AndroidNotificationBridge.areNotificationsEnabled();
      return enabled ? 'granted' : 'default';
    } catch (e) {
      return 'granted';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    return Notification.permission;
  }
}

// Disparar Notificación Push del Sistema (Android / Windows / Mac / PWA)
export async function sendSystemPushNotification({
  title,
  body,
  icon = '/app-icon.png',
  badge = '/app-icon.png',
  tag = 'sebastian-g-alert',
  data = {},
  vibrate = [0, 250, 150, 250],
  whatsappUrl = null
}) {
  // 1. Sonido y vibración táctil
  playPushNotificationChime(data.type || 'booking');
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(vibrate);
    }
  } catch (e) {}

  // 2. Parpadeo en pestaña si no está en foco
  flashDocumentTitle(`🔔 ${title}`);

  // 3. Puente Nativo Android APK (Prioridad Máxima si se ejecuta dentro de la App de Android)
  if (typeof window !== 'undefined' && window.AndroidNotificationBridge) {
    try {
      if (typeof window.AndroidNotificationBridge.showNotificationWithAction === 'function') {
        window.AndroidNotificationBridge.showNotificationWithAction(
          title,
          body,
          tag,
          data.type || 'booking',
          whatsappUrl || ''
        );
      } else {
        window.AndroidNotificationBridge.showNotification(
          title,
          body,
          tag,
          data.type || 'booking'
        );
      }
      return true;
    } catch (errBridge) {
      console.warn('Puente nativo Android falló:', errBridge);
    }
  }

  // 4. Si no tiene soporte o permiso de notificaciones de navegador, salir (la alerta in-app visual siempre se muestra)
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate,
    data: {
      url: '/?mode=admin',
      whatsappUrl,
      ...data
    },
    actions: [
      { action: 'open', title: '👀 Ver en Panel' },
      ...(whatsappUrl ? [{ action: 'whatsapp', title: '💬 Abrir WhatsApp' }] : [])
    ]
  };

  // 4. Enviar mediante Service Worker (Esencial para Android APK / Chrome Móvil)
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    }
  } catch (errSw) {
    console.warn('ServiceWorker showNotification falló:', errSw);
  }

  // 5. Fallback con new Notification() en navegadores de escritorio
  try {
    const notif = new Notification(title, {
      body,
      icon,
      badge,
      tag,
      data: notificationOptions.data
    });
    notif.onclick = () => {
      window.focus();
      if (data && data.targetTab) {
        window.dispatchEvent(new CustomEvent('admin-switch-tab', { detail: { tab: data.targetTab } }));
      }
    };
    return true;
  } catch (errConstructor) {
    console.warn('Notification constructor no permitido:', errConstructor);
  }

  return false;
}
