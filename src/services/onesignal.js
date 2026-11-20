// Servicio Oficial de OneSignal para Notificaciones Push en Tiempo Real 24/7
// Funciona en Android APK, PWA y Navegadores incluso con la App totalmente cerrada.

import { API_BASE, getAdminSessionToken } from './api';

const ONESIGNAL_APP_ID = (import.meta.env?.VITE_ONESIGNAL_APP_ID || '').trim();
const ONESIGNAL_ADMIN_EXTERNAL_ID = (import.meta.env?.VITE_ONESIGNAL_ADMIN_EXTERNAL_ID || 'sebastiang_admin').trim();
const ONESIGNAL_SDK_SRC = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

let oneSignalInitialized = false;
let oneSignalScriptPromise = null;

async function tagAdminSubscription(OneSignal) {
  try {
    if (ONESIGNAL_ADMIN_EXTERNAL_ID && typeof OneSignal.login === 'function') {
      await OneSignal.login(ONESIGNAL_ADMIN_EXTERNAL_ID);
    }
  } catch (e) {}
  try {
    if (OneSignal.User && typeof OneSignal.User.addTag === 'function') {
      await OneSignal.User.addTag('role', 'admin');
    }
  } catch (e) {}
}

function ensureOneSignalSdkLoaded() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }
  if (window.OneSignal && typeof window.OneSignal.init === 'function') {
    return Promise.resolve(true);
  }
  if (oneSignalScriptPromise) return oneSignalScriptPromise;

  oneSignalScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${ONESIGNAL_SDK_SRC}"]`);
    if (existing) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = ONESIGNAL_SDK_SRC;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      oneSignalScriptPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return oneSignalScriptPromise;
}

export async function initOneSignal() {
  if (typeof window === 'undefined') return;
  if (oneSignalInitialized) return;
  if (!ONESIGNAL_APP_ID) return;

  try {
    await ensureOneSignalSdkLoaded();
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: false // Usamos nuestra propia UI integrada en el panel
        }
      });

      oneSignalInitialized = true;
      await tagAdminSubscription(OneSignal);

      // Escuchar cambios de suscripción
      OneSignal.User.PushSubscription.addEventListener('change', (event) => {
        if (event?.current?.optedIn) {
          tagAdminSubscription(OneSignal);
        }
      });
    });
  } catch (err) {
    console.warn('Error inicializando OneSignal:', err);
  }
}

export async function requestOneSignalPermission() {
  if (typeof window === 'undefined' || !ONESIGNAL_APP_ID) return false;
  await initOneSignal();

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 15000);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.Notifications.requestPermission();
        const permission = OneSignal.Notifications.permission;
        if (permission) {
          await tagAdminSubscription(OneSignal);
        }
        clearTimeout(timer);
        resolve(permission);
      } catch (e) {
        clearTimeout(timer);
        resolve(false);
      }
    });
  });
}

export async function isOneSignalSubscribed() {
  if (typeof window === 'undefined' || !ONESIGNAL_APP_ID) return false;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 5000);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        const optedIn = OneSignal.User.PushSubscription?.optedIn;
        clearTimeout(timer);
        resolve(!!optedIn);
      } catch (e) {
        clearTimeout(timer);
        resolve(false);
      }
    });
  });
}

export async function sendTestPushNotification() {
  try {
    const token = getAdminSessionToken() || '';
    const res = await fetch(`${API_BASE}/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        title: '🔔 ¡Prueba OneSignal Exitosa!',
        message: 'Las notificaciones push 24/7 en segundo plano están activas en Sebastián G.',
        url: 'https://sebastiang.app/?mode=admin',
        data: { type: 'test' }
      })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Error enviando push de prueba:', err);
    return { success: false, error: err.message };
  }
}
