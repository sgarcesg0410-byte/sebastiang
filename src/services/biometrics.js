/**
 * Servicio Unificado de Autenticación Biométrica (Huella Dactilar / Face ID)
 * Soporta de forma transparente:
 * 1. Hardware biométrico NATIVO de Android (BiometricPrompt) a través del puente APK (AndroidNotificationBridge).
 *    Idéntico al funcionamiento de apps bancarias (Nequi, Bancolombia, etc.).
 * 2. Web Authentication API (WebAuthn / Passkeys estándar FIDO2) para navegadores (Chrome Android, Safari iOS, Windows Hello).
 */

const BIO_ENABLED_KEY = 'sebastian_g_biometrics_enabled_v1';
const BIO_CRED_ID_KEY = 'sebastian_g_biometrics_cred_id_v1';
const BIO_DEVICE_NAME_KEY = 'sebastian_g_biometrics_device_name_v1';
const BIO_PROVIDER_KEY = 'sebastian_g_biometrics_provider_v1'; // 'native_android' | 'webauthn'

function bufferToBase64(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64) {
  if (!base64) return new ArrayBuffer(0);
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Detecta si el puente biométrico nativo de Android está activo en la APK
 */
function hasNativeAndroidBiometrics() {
  return typeof window !== 'undefined' && 
    !!window.AndroidNotificationBridge && 
    typeof window.AndroidNotificationBridge.isBiometricAvailable === 'function';
}

/**
 * Obtiene el estado detallado del sensor biométrico en Android nativo
 */
function getNativeAndroidBiometricStatus() {
  if (hasNativeAndroidBiometrics() && typeof window.AndroidNotificationBridge.getBiometricStatus === 'function') {
    return window.AndroidNotificationBridge.getBiometricStatus();
  }
  return null;
}

/**
 * Lanza el prompt nativo de huella dactilar de Android (BiometricPrompt)
 * y retorna una Promise que se resuelve con el resultado
 */
function authenticateViaNativeAndroid(title, subtitle) {
  return new Promise((resolve, reject) => {
    if (!hasNativeAndroidBiometrics()) {
      return reject(new Error('El lector biométrico nativo no está disponible.'));
    }

    let timeoutId = null;

    const handler = (event) => {
      clearTimeout(timeoutId);
      window.removeEventListener('android-biometric-response', handler);
      const detail = event?.detail || {};
      if (detail.success) {
        resolve({
          success: true,
          verified: true,
          method: 'native_fingerprint',
          message: detail.message || 'Huella verificada correctamente.'
        });
      } else {
        const errorMsg = detail.message || 'Acceso por huella cancelado o no reconocido.';
        reject(new Error(errorMsg));
      }
    };

    window.addEventListener('android-biometric-response', handler);

    // Timeout de seguridad en caso de que Android no emita evento
    timeoutId = setTimeout(() => {
      window.removeEventListener('android-biometric-response', handler);
      reject(new Error('Tiempo de espera agotado en el sensor de huella. Intenta nuevamente.'));
    }, 60000);

    try {
      window.AndroidNotificationBridge.authenticateBiometric(
        title || 'Ingreso Sebastian G',
        subtitle || 'Coloca tu dedo en el sensor de huella de tu celular'
      );
    } catch (err) {
      clearTimeout(timeoutId);
      window.removeEventListener('android-biometric-response', handler);
      reject(new Error('Error al iniciar el sensor de huella: ' + (err.message || err)));
    }
  });
}

/**
 * Comprueba si el dispositivo actual tiene hardware biométrico disponible (sensor de huella o Face ID)
 */
export async function isBiometricsSupported() {
  if (typeof window === 'undefined') return false;

  // 1. Prioridad: Lector Biométrico Nativo de la APK de Android (BiometricPrompt)
  if (hasNativeAndroidBiometrics()) {
    try {
      const isAvailable = window.AndroidNotificationBridge.isBiometricAvailable();
      if (isAvailable) return true;
      const status = getNativeAndroidBiometricStatus();
      if (status === 'NONE_ENROLLED' || status === 'AVAILABLE') {
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Error comprobando biometría nativa:', e);
    }
  }

  // 2. Si estamos dentro de la APK antigua (con puente de notificaciones pero sin biometría nativa)
  if (window.AndroidNotificationBridge && !hasNativeAndroidBiometrics()) {
    return false;
  }

  // 3. Web Estándar (WebAuthn / Passkeys en Chrome/Safari/Edge/Windows Hello)
  if (window.PublicKeyCredential) {
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return !!available;
      }
      return true;
    } catch (err) {
      console.warn('Error verificando WebAuthn:', err);
      return false;
    }
  }

  return false;
}

/**
 * Indica si el administrador ya configuró el acceso por huella en este dispositivo
 */
export function isBiometricsConfigured() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BIO_ENABLED_KEY) === 'true' && !!localStorage.getItem(BIO_CRED_ID_KEY);
}

/**
 * Registra y vincula la huella dactilar del administrador en el dispositivo actual
 */
export async function registerBiometrics() {
  // 1. CANAL NATIVO ANDROID (APK)
  if (hasNativeAndroidBiometrics()) {
    const status = getNativeAndroidBiometricStatus();
    if (status === 'NO_HARDWARE') {
      throw new Error('Este celular no cuenta con lector de huella dactilar integrado.');
    }
    if (status === 'HW_UNAVAILABLE') {
      throw new Error('El sensor de huella dactilar está temporalmente no disponible. Intenta reiniciar tu dispositivo.');
    }
    if (status === 'NONE_ENROLLED') {
      if (typeof window.AndroidNotificationBridge.openBiometricEnrollmentSettings === 'function') {
        window.AndroidNotificationBridge.openBiometricEnrollmentSettings();
      }
      throw new Error('Tu celular tiene sensor de huella pero aún no has registrado ninguna huella en los Ajustes del sistema. Abre Ajustes > Seguridad > Huella Digital para configurarla.');
    }

    // Solicitar toque de huella con el diálogo nativo de Android
    const res = await authenticateViaNativeAndroid(
      'Vincular Huella Dactilar',
      'Toca el sensor de huella para vincular este celular a tu cuenta de Sebastian G'
    );

    if (res && res.success) {
      localStorage.setItem(BIO_CRED_ID_KEY, 'native_android_' + Date.now());
      localStorage.setItem(BIO_ENABLED_KEY, 'true');
      localStorage.setItem(BIO_PROVIDER_KEY, 'native_android');
      localStorage.setItem(BIO_DEVICE_NAME_KEY, 'Celular Android (Nativo)');

      return {
        success: true,
        message: '¡Huella dactilar vinculada exitosamente! Ahora podrás entrar con un solo toque como en tus aplicaciones de banco.'
      };
    }
    throw new Error('No se pudo verificar la huella dactilar.');
  }

  // Si estamos en la APK antigua sin bridge de biometría
  if (typeof window !== 'undefined' && window.AndroidNotificationBridge && !hasNativeAndroidBiometrics()) {
    throw new Error('Para activar la huella en tu celular, descarga e instala la última versión de la aplicación (APK v1.4.0).');
  }

  // 2. CANAL WEBAUTHN ESTÁNDAR (Para navegadores web)
  const supported = await isBiometricsSupported();
  if (!supported) {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new Error('La autenticación por huella requiere una conexión HTTPS segura o la APK instalada en tu celular.');
    }
    throw new Error('Tu dispositivo o navegador actual no cuenta con sensor de huella disponible o permisos activados.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userId = new TextEncoder().encode('sebastiang-admin-' + Date.now());
  const hostname = window.location.hostname || 'localhost';
  const isCustomDomain = hostname !== 'localhost' && !hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);

  const creationOptions = {
    challenge,
    rp: {
      name: 'Sebastian G - Panel de Control',
      id: isCustomDomain ? hostname : undefined
    },
    user: {
      id: userId,
      name: 'sebastiang',
      displayName: 'Sebastian G'
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256
      { alg: -257, type: 'public-key' }  // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      requireResidentKey: false
    },
    timeout: 60000,
    attestation: 'none'
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: creationOptions
    });

    if (!credential || !credential.rawId) {
      throw new Error('No se recibió la confirmación del sensor de huella.');
    }

    const credIdBase64 = bufferToBase64(credential.rawId);
    localStorage.setItem(BIO_CRED_ID_KEY, credIdBase64);
    localStorage.setItem(BIO_ENABLED_KEY, 'true');
    localStorage.setItem(BIO_PROVIDER_KEY, 'webauthn');
    localStorage.setItem(BIO_DEVICE_NAME_KEY, navigator.userAgent.includes('Android') ? 'Celular Android (Navegador)' : (navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Dispositivo Personal'));

    return {
      success: true,
      message: '¡Huella dactilar registrada exitosamente! Ahora puedes entrar directamente con tu huella.'
    };
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Registro cancelado o no se reconoció la huella.');
    }
    throw new Error(err.message || 'Error registrando huella biométrica.');
  }
}

/**
 * Solicita colocar la huella dactilar para autenticarse e iniciar sesión directamente
 */
export async function authenticateWithBiometrics() {
  if (!isBiometricsConfigured()) {
    throw new Error('El acceso por huella no está configurado en este dispositivo.');
  }

  // 1. CANAL NATIVO ANDROID (APK)
  if (hasNativeAndroidBiometrics()) {
    const res = await authenticateViaNativeAndroid(
      'Ingreso al Panel Sebastian G',
      'Coloca tu huella dactilar para acceder inmediatamente'
    );
    if (res && res.success) {
      return {
        success: true,
        verified: true,
        method: 'fingerprint'
      };
    }
    throw new Error('No se pudo verificar la huella.');
  }

  // 2. CANAL WEBAUTHN ESTÁNDAR
  const storedCredId = localStorage.getItem(BIO_CRED_ID_KEY);
  if (!storedCredId) {
    throw new Error('Credencial biométrica no encontrada en este navegador.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const hostname = window.location.hostname || 'localhost';
  const isCustomDomain = hostname !== 'localhost' && !hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);

  const requestOptions = {
    challenge,
    timeout: 60000,
    userVerification: 'required',
    rpId: isCustomDomain ? hostname : undefined,
    allowCredentials: [
      {
        id: base64ToBuffer(storedCredId),
        type: 'public-key',
        transports: ['internal']
      }
    ]
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: requestOptions
    });

    if (assertion) {
      return {
        success: true,
        verified: true,
        method: 'fingerprint'
      };
    }
    throw new Error('No se pudo verificar la huella.');
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Acceso por huella cancelado o no reconocido.');
    }
    throw new Error(err.message || 'Error en la verificación biométrica.');
  }
}

/**
 * Desactiva el acceso por huella en este dispositivo
 */
export function disableBiometrics() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BIO_ENABLED_KEY);
  localStorage.removeItem(BIO_CRED_ID_KEY);
  localStorage.removeItem(BIO_DEVICE_NAME_KEY);
  localStorage.removeItem(BIO_PROVIDER_KEY);
}
