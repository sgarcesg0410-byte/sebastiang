// Servicio Oficial de OneSignal para Notificaciones Push en Tiempo Real 24/7
// Funciona en Android APK, PWA y Navegadores incluso con la App totalmente cerrada.

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || 'bc62cb00-9782-4a8e-a344-e8cf031a211a';

let oneSignalInitialized = false;

export async function initOneSignal() {
  if (typeof window === 'undefined') return;
  if (oneSignalInitialized) return;

  try {
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
      console.log('✓ OneSignal SDK inicializado con éxito');

      // Escuchar cambios de suscripción
      OneSignal.User.PushSubscription.addEventListener('change', (event) => {
        console.log('Estado de suscripción OneSignal:', event.current.optedIn);
      });
    });
  } catch (err) {
    console.warn('Error inicializando OneSignal:', err);
  }
}

export async function requestOneSignalPermission() {
  if (typeof window === 'undefined') return false;

  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.Notifications.requestPermission();
        const permission = OneSignal.Notifications.permission;
        resolve(permission);
      } catch (e) {
        resolve(false);
      }
    });
  });
}

export async function isOneSignalSubscribed() {
  if (typeof window === 'undefined') return false;

  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        const optedIn = OneSignal.User.PushSubscription.optedIn;
        resolve(!!optedIn);
      } catch (e) {
        resolve(false);
      }
    });
  });
}
