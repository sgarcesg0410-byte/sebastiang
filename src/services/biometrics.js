/**
 * Servicio de Autenticación Biométrica (Huella Dactilar / Face ID)
 * Utiliza Web Authentication API (WebAuthn / Passkeys estándar FIDO2)
 * Compatible con Android (Huella / Lector biométrico), iOS (Touch ID / Face ID)
 * y Windows Hello en navegadores modernos y aplicaciones empaquetadas (Capacitor/PWA).
 */

const BIO_ENABLED_KEY = 'sebastian_g_biometrics_enabled_v1';
const BIO_CRED_ID_KEY = 'sebastian_g_biometrics_cred_id_v1';
const BIO_DEVICE_NAME_KEY = 'sebastian_g_biometrics_device_name_v1';

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
 * Comprueba si el dispositivo actual tiene hardware biométrico disponible (sensor de huella o Face ID)
 */
export async function isBiometricsSupported() {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return !!available;
    }
    return false;
  } catch (err) {
    console.warn('Error verificando soporte biométrico:', err);
    return false;
  }
}

/**
 * Indica si el administrador ya configuró el acceso por huella en este dispositivo
 */
export function isBiometricsConfigured() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BIO_ENABLED_KEY) === 'true' && !!localStorage.getItem(BIO_CRED_ID_KEY);
}

/**
 * Registra la huella dactilar del administrador en el dispositivo
 */
export async function registerBiometrics() {
  const supported = await isBiometricsSupported();
  if (!supported) {
    throw new Error('Tu dispositivo no cuenta con sensor de huella disponible o el navegador no tiene permisos biométricos activados.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userId = new TextEncoder().encode('sebastiang-admin-' + Date.now());

  // Detectar hostname seguro para rpId (compatible con localhost y dominio en producción)
  const hostname = window.location.hostname || 'localhost';

  const creationOptions = {
    challenge,
    rp: {
      name: 'Sebastian G - Panel de Control',
      id: hostname === 'localhost' ? undefined : hostname
    },
    user: {
      id: userId,
      name: 'sebastiang',
      displayName: 'Sebastian G'
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256 (estándar Android/iOS)
      { alg: -257, type: 'public-key' }  // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Obliga al lector nativo del dispositivo (Huella dactilar)
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
    localStorage.setItem(BIO_DEVICE_NAME_KEY, navigator.userAgent.includes('Android') ? 'Celular Android' : (navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Dispositivo Personal'));

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

  const supported = await isBiometricsSupported();
  if (!supported) {
    throw new Error('El sensor de huella no está disponible en este momento.');
  }

  const storedCredId = localStorage.getItem(BIO_CRED_ID_KEY);
  if (!storedCredId) {
    throw new Error('Credencial biométrica no encontrada.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const hostname = window.location.hostname || 'localhost';

  const requestOptions = {
    challenge,
    timeout: 60000,
    userVerification: 'required',
    rpId: hostname === 'localhost' ? undefined : hostname,
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
}
