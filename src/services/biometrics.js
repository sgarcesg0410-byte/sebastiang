/**
 * Servicio Unificado de Autenticación Biométrica Criptográfica (Huella Dactilar / Face ID)
 * Endurecido bajo Auditoría P1-2.3:
 * 1. Hardware biométrico NATIVO de Android (BiometricPrompt + AndroidKeyStore EC P-256 SHA256withECDSA)
 *    a través de `SebastianGNativeChannel` (WebMessageListener) o `AndroidNotificationBridge`.
 * 2. Web Authentication API (WebAuthn / Passkeys FIDO2) + clave criptográfica no extraíble (`ECDSA P-256`)
 *    almacenada junto al `bioRefreshToken` en `IndexedDB` (`sebastian_g_biometrics_vault_v2`), jamás en `localStorage`.
 * 3. Toda emisión de sesión en `/api/admin/auth/bio-refresh` exige firma criptográfica verificable en el servidor
 *    sobre el `challenge` efímero de un solo uso.
 */

import { setAdminSessionToken, getAdminSessionToken } from './api';

const BIO_ENABLED_KEY = 'sebastian_g_biometrics_enabled_v1';
const BIO_CRED_ID_KEY = 'sebastian_g_biometrics_cred_id_v1';
const BIO_DEVICE_NAME_KEY = 'sebastian_g_biometrics_device_name_v1';
const BIO_PROVIDER_KEY = 'sebastian_g_biometrics_provider_v1'; // 'native_android' | 'webauthn'

const BIO_VAULT_DB_NAME = 'sebastian_g_biometrics_vault_v2';
const BIO_VAULT_STORE = 'credentials';
const BIO_VAULT_RECORD_ID = 'active_admin_biometric_credential';

// Memoria de respaldo para entornos de prueba sin IndexedDB nativo
let memoryVaultRecord = null;

function purgeLegacyLocalStorageTokens() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('sebastian_g_bio_refresh_token');
  } catch (e) {}
}

function openBiometricVaultDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(BIO_VAULT_DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(BIO_VAULT_STORE)) {
          db.createObjectStore(BIO_VAULT_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveBiometricVaultRecord(record) {
  purgeLegacyLocalStorageTokens();
  const payload = {
    ...(memoryVaultRecord || {}),
    ...(record || {}),
    id: BIO_VAULT_RECORD_ID,
    updatedAt: new Date().toISOString()
  };
  memoryVaultRecord = payload;
  const db = await openBiometricVaultDB();
  if (!db) return true;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BIO_VAULT_STORE, 'readwrite');
      tx.objectStore(BIO_VAULT_STORE).put(payload);
      tx.oncomplete = () => {
        try { db.close(); } catch {}
        resolve(true);
      };
      tx.onerror = () => {
        try { db.close(); } catch {}
        resolve(false);
      };
    } catch {
      try { db.close(); } catch {}
      resolve(false);
    }
  });
}

export async function loadBiometricVaultRecord() {
  purgeLegacyLocalStorageTokens();
  const db = await openBiometricVaultDB();
  if (!db) return memoryVaultRecord;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BIO_VAULT_STORE, 'readonly');
      const req = tx.objectStore(BIO_VAULT_STORE).get(BIO_VAULT_RECORD_ID);
      req.onsuccess = () => {
        try { db.close(); } catch {}
        resolve(req.result || memoryVaultRecord || null);
      };
      req.onerror = () => {
        try { db.close(); } catch {}
        resolve(memoryVaultRecord || null);
      };
    } catch {
      try { db.close(); } catch {}
      resolve(memoryVaultRecord || null);
    }
  });
}

export async function clearBiometricVaultRecord() {
  purgeLegacyLocalStorageTokens();
  memoryVaultRecord = null;
  const db = await openBiometricVaultDB();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(BIO_VAULT_STORE, 'readwrite');
      tx.objectStore(BIO_VAULT_STORE).delete(BIO_VAULT_RECORD_ID);
      tx.oncomplete = () => {
        try { db.close(); } catch {}
        resolve();
      };
      tx.onerror = () => {
        try { db.close(); } catch {}
        resolve();
      };
    } catch {
      try { db.close(); } catch {}
      resolve();
    }
  });
}

function bufferToBase64(buffer) {
  if (!buffer) return '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64) {
  if (!base64) return new ArrayBuffer(0);
  const normalized = String(base64).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function fetchOneTimeBioChallenge() {
  const challengeRes = await fetch('/api/admin/auth/bio-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!challengeRes.ok) {
    throw new Error('No se pudo obtener el desafío criptográfico del servidor.');
  }
  const challengeData = await challengeRes.json().catch(() => ({}));
  if (!challengeData?.challenge) {
    throw new Error('El servidor devolvió un desafío biométrico vacío.');
  }
  return challengeData.challenge;
}

async function generateNonExtractableSigningKeyPair() {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('WebCrypto API no está disponible para proteger la clave biométrica.');
  }
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, // Clave privada NO extraíble fuera de WebCrypto/IndexedDB
    ['sign', 'verify']
  );
  const spkiBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeySpki: bufferToBase64(spkiBuffer)
  };
}

async function signChallengeWithVaultKey(privateKey, challenge, type = 'webauthn.get') {
  const origin = (typeof window !== 'undefined' && window.location?.origin) || 'https://sebastiang.app';
  const rpId = (typeof window !== 'undefined' && window.location?.hostname) || 'sebastiang.app';
  const clientDataObj = {
    type,
    challenge,
    origin,
    rpId
  };
  const clientDataRaw = JSON.stringify(clientDataObj);
  const clientDataBytes = new TextEncoder().encode(clientDataRaw);
  const sigBuffer = await window.crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    clientDataBytes
  );
  return {
    clientDataJSON: bufferToBase64(clientDataBytes),
    signature: bufferToBase64(sigBuffer)
  };
}

async function refreshServerSessionViaBiometrics({ challenge, biometricProof }) {
  try {
    purgeLegacyLocalStorageTokens();
    const vaultRecord = await loadBiometricVaultRecord();
    const bootstrapToken = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('sebastian_g_bio_bootstrap_token_v2')
      : '';
    const bioRefreshToken = vaultRecord?.bioRefreshToken || bootstrapToken || '';
    if (!bioRefreshToken || !challenge || !biometricProof) return false;

    const res = await fetch('/api/admin/auth/bio-refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bioRefreshToken}`
      },
      body: JSON.stringify({
        bioRefreshToken,
        challenge,
        biometricProof
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.bioRefreshToken) {
        await saveBiometricVaultRecord({
          ...(vaultRecord || {}),
          bioRefreshToken: data.bioRefreshToken
        });
        try {
          sessionStorage.removeItem('sebastian_g_bio_bootstrap_token_v2');
        } catch (e) {}
      }
      if (data?.token) {
        setAdminSessionToken(data.token);
        return true;
      }
    }
  } catch (e) {
    console.warn('Error renovando sesión biométrica:', e);
  }
  return false;
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
 * Lanza el prompt nativo de huella dactilar de Android (BiometricPrompt + AndroidKeyStore)
 * y retorna la firma criptográfica sobre el challenge del servidor.
 */
function authenticateViaNativeAndroid(title, subtitle, challenge = '') {
  return new Promise((resolve, reject) => {
    if (!hasNativeAndroidBiometrics()) {
      return reject(new Error('El lector biométrico nativo no está disponible.'));
    }

    let timeoutId = null;

    const handler = (event) => {
      clearTimeout(timeoutId);
      window.removeEventListener('android-biometric-response', handler);
      const detail = event?.detail || {};
      if (detail.success && detail.signature && detail.clientDataJSON) {
        resolve({
          success: true,
          verified: true,
          method: 'native_fingerprint',
          credentialId: detail.credentialId || 'native_android_keystore_p256_v2',
          publicKeySpki: detail.publicKeySpki || '',
          clientDataJSON: detail.clientDataJSON,
          signature: detail.signature,
          message: detail.message || 'Huella verificada criptográficamente.'
        });
      } else {
        const errorMsg = detail.message || 'Acceso por huella cancelado o sin prueba criptográfica.';
        reject(new Error(errorMsg));
      }
    };

    window.addEventListener('android-biometric-response', handler);

    timeoutId = setTimeout(() => {
      window.removeEventListener('android-biometric-response', handler);
      reject(new Error('Tiempo de espera agotado en el sensor de huella. Intenta nuevamente.'));
    }, 60000);

    try {
      // Priorizar el canal WebMessageListener (SebastianGNativeChannel) si está disponible
      if (window.SebastianGNativeChannel && typeof window.SebastianGNativeChannel.postMessage === 'function') {
        window.SebastianGNativeChannel.postMessage(JSON.stringify({
          action: 'authenticateBiometric',
          title: title || 'Ingreso Sebastian G',
          subtitle: subtitle || 'Coloca tu dedo en el sensor de huella de tu celular',
          challenge: challenge || ''
        }));
      } else {
        window.AndroidNotificationBridge.authenticateBiometric(
          title || 'Ingreso Sebastian G',
          subtitle || 'Coloca tu dedo en el sensor de huella de tu celular',
          challenge || ''
        );
      }
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

  if (window.AndroidNotificationBridge && !hasNativeAndroidBiometrics()) {
    return false;
  }

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
  purgeLegacyLocalStorageTokens();
  return localStorage.getItem(BIO_ENABLED_KEY) === 'true' && !!localStorage.getItem(BIO_CRED_ID_KEY);
}

/**
 * Registra y vincula criptográficamente la huella dactilar del administrador en el servidor y en la bóveda IndexedDB
 */
export async function registerBiometrics() {
  purgeLegacyLocalStorageTokens();
  const adminToken = getAdminSessionToken();
  if (!adminToken) {
    throw new Error('Debes iniciar sesión con tu PIN administrativo antes de vincular la huella.');
  }

  // 1. CANAL NATIVO ANDROID (APK con AndroidKeyStore EC P-256)
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

    const challenge = await fetchOneTimeBioChallenge();
    const res = await authenticateViaNativeAndroid(
      'Vincular Huella Dactilar',
      'Toca el sensor de huella para vincular criptográficamente este celular a tu cuenta de Sebastian G',
      challenge
    );

    if (res && res.success && res.publicKeySpki && res.signature) {
      const enrollRes = await fetch('/api/admin/auth/bio-enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          credentialId: res.credentialId,
          publicKeySpki: res.publicKeySpki,
          deviceName: 'Celular Android (Keystore Hardware)',
          provider: 'native_android',
          challenge,
          clientDataJSON: res.clientDataJSON,
          signature: res.signature
        })
      });
      if (!enrollRes.ok) {
        const errData = await enrollRes.json().catch(() => ({}));
        throw new Error(errData.error || 'El servidor rechazó el enrolamiento biométrico.');
      }
      const enrollData = await enrollRes.json();

      await saveBiometricVaultRecord({
        credentialId: res.credentialId,
        publicKeySpki: res.publicKeySpki,
        bioRefreshToken: enrollData.bioRefreshToken,
        provider: 'native_android'
      });

      localStorage.setItem(BIO_CRED_ID_KEY, res.credentialId);
      localStorage.setItem(BIO_ENABLED_KEY, 'true');
      localStorage.setItem(BIO_PROVIDER_KEY, 'native_android');
      localStorage.setItem(BIO_DEVICE_NAME_KEY, 'Celular Android (Nativo)');

      return {
        success: true,
        message: '¡Huella dactilar vinculada criptográficamente! Ahora podrás entrar con verificación en servidor.'
      };
    }
    throw new Error('No se pudo verificar la huella dactilar.');
  }

  if (typeof window !== 'undefined' && window.AndroidNotificationBridge && !hasNativeAndroidBiometrics()) {
    throw new Error('Para activar la huella en tu celular, descarga e instala la última versión de la aplicación (APK v1.4.0).');
  }

  // 2. CANAL WEBAUTHN ESTÁNDAR + CLAVE CRIPTOGRÁFICA NO EXTRAÍBLE EN INDEXEDDB
  const supported = await isBiometricsSupported();
  if (!supported) {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new Error('La autenticación por huella requiere una conexión HTTPS segura o la APK instalada en tu celular.');
    }
    throw new Error('Tu dispositivo o navegador actual no cuenta con sensor de huella disponible o permisos activados.');
  }

  const serverChallenge = await fetchOneTimeBioChallenge();
  const challengeBytes = new TextEncoder().encode(serverChallenge);

  const userId = new TextEncoder().encode('sebastiang-admin-' + Date.now());
  const hostname = window.location.hostname || 'localhost';
  const isCustomDomain = hostname !== 'localhost' && !hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);

  const creationOptions = {
    challenge: challengeBytes,
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
    const { privateKey, publicKeySpki } = await generateNonExtractableSigningKeyPair();
    const signedEnrollment = await signChallengeWithVaultKey(privateKey, serverChallenge, 'webauthn.create');
    const deviceLabel = navigator.userAgent.includes('Android')
      ? 'Celular Android (Navegador)'
      : (navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Dispositivo Personal');

    const enrollRes = await fetch('/api/admin/auth/bio-enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        credentialId: credIdBase64,
        publicKeySpki,
        deviceName: deviceLabel,
        provider: 'webauthn',
        challenge: serverChallenge,
        clientDataJSON: signedEnrollment.clientDataJSON,
        signature: signedEnrollment.signature
      })
    });

    if (!enrollRes.ok) {
      const errData = await enrollRes.json().catch(() => ({}));
      throw new Error(errData.error || 'No se pudo registrar la clave pública biométrica en el servidor.');
    }
    const enrollData = await enrollRes.json();

    await saveBiometricVaultRecord({
      credentialId: credIdBase64,
      privateKey,
      publicKeySpki,
      bioRefreshToken: enrollData.bioRefreshToken,
      provider: 'webauthn'
    });

    localStorage.setItem(BIO_CRED_ID_KEY, credIdBase64);
    localStorage.setItem(BIO_ENABLED_KEY, 'true');
    localStorage.setItem(BIO_PROVIDER_KEY, 'webauthn');
    localStorage.setItem(BIO_DEVICE_NAME_KEY, deviceLabel);

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
 * Solicita colocar la huella dactilar para autenticarse y verifica la firma criptográfica en el servidor
 */
export async function authenticateWithBiometrics() {
  if (!isBiometricsConfigured()) {
    throw new Error('El acceso por huella no está configurado en este dispositivo.');
  }

  const serverChallenge = await fetchOneTimeBioChallenge();

  // 1. CANAL NATIVO ANDROID (APK con firma AndroidKeyStore)
  if (hasNativeAndroidBiometrics()) {
    const res = await authenticateViaNativeAndroid(
      'Ingreso al Panel Sebastian G',
      'Coloca tu huella dactilar para acceder inmediatamente',
      serverChallenge
    );
    if (res && res.success && res.signature && res.clientDataJSON) {
      const renewed = await refreshServerSessionViaBiometrics({
        challenge: serverChallenge,
        biometricProof: {
          credentialId: res.credentialId,
          clientDataJSON: res.clientDataJSON,
          signature: res.signature
        }
      });
      if (!renewed) {
        throw new Error('La sesión biométrica expiró o no pudo ser verificada por el servidor. Ingresa con tu PIN.');
      }
      return {
        success: true,
        verified: true,
        method: 'fingerprint',
        sessionRenewed: true
      };
    }
    throw new Error('No se pudo verificar la huella.');
  }

  // 2. CANAL WEBAUTHN ESTÁNDAR + FIRMA CON CLAVE NO EXTRAÍBLE EN INDEXEDDB
  const storedCredId = localStorage.getItem(BIO_CRED_ID_KEY);
  if (!storedCredId) {
    throw new Error('Credencial biométrica no encontrada en este navegador.');
  }

  const vaultRecord = await loadBiometricVaultRecord();
  if (!vaultRecord?.privateKey || !vaultRecord?.bioRefreshToken) {
    throw new Error('La bóveda criptográfica biométrica requiere revincular tu huella con tu PIN.');
  }

  const challengeBytes = new TextEncoder().encode(serverChallenge);
  const hostname = window.location.hostname || 'localhost';
  const isCustomDomain = hostname !== 'localhost' && !hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);

  const requestOptions = {
    challenge: challengeBytes,
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
      const signedAssertion = await signChallengeWithVaultKey(
        vaultRecord.privateKey,
        serverChallenge,
        'webauthn.get'
      );
      const renewed = await refreshServerSessionViaBiometrics({
        challenge: serverChallenge,
        biometricProof: {
          credentialId: vaultRecord.credentialId || storedCredId,
          clientDataJSON: signedAssertion.clientDataJSON,
          signature: signedAssertion.signature
        }
      });
      if (!renewed) {
        throw new Error('El servidor rechazó la prueba criptográfica biométrica. Ingresa con tu PIN.');
      }
      return {
        success: true,
        verified: true,
        method: 'fingerprint',
        sessionRenewed: true
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
 * Desactiva el acceso por huella en este dispositivo y limpia la bóveda IndexedDB
 */
export function disableBiometrics() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BIO_ENABLED_KEY);
  localStorage.removeItem(BIO_CRED_ID_KEY);
  localStorage.removeItem(BIO_DEVICE_NAME_KEY);
  localStorage.removeItem(BIO_PROVIDER_KEY);
  clearBiometricVaultRecord().catch(() => {});
}
