package app.sebastiang.studio.bridge

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import app.sebastiang.studio.security.DomainValidator
import app.sebastiang.studio.security.SecureTokenStorage
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Puente seguro endurecido:
 * 1. Las mutaciones sensibles de credenciales (`storeDeviceToken`, `clearDeviceToken`) NO están expuestas
 *    en `@JavascriptInterface`, sino exclusivamente a través de `WebViewCompat.addWebMessageListener`
 *    (`handleSecureWebMessage`), donde Android WebKit certifica nativamente `isMainFrame` y `sourceOrigin`.
 * 2. Implementa biometría nativa real con `BiometricPrompt` + `AndroidKeyStore` (`EC P-256`, `SHA256withECDSA`)
 *    con `setUserAuthenticationRequired(true)` para que la clave privada solo firme tras desbloqueo físico.
 */
class AndroidNotificationBridge(
    private val activity: FragmentActivity,
    private val tokenStorage: SecureTokenStorage,
    private val mainFrameUrlProvider: () -> String?,
    private val evaluateJavascriptCallback: (String) -> Unit = {}
) {

    companion object {
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val BIOMETRIC_KEY_ALIAS = "sebastian_g_admin_bio_ecdsa_p256_v2"
        private const val CREDENTIAL_ID = "native_android_keystore_p256_v2"
    }

    /**
     * Obtiene la URL real cargada en el marco principal del WebView ejecutándose
     * de forma segura en el hilo principal (UI Thread) de Android.
     */
    private fun resolveVerifiedMainFrameUrl(): String? {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return mainFrameUrlProvider()
        }
        val ref = AtomicReference<String?>(null)
        val latch = CountDownLatch(1)
        Handler(Looper.getMainLooper()).post {
            try {
                ref.set(mainFrameUrlProvider())
            } finally {
                latch.countDown()
            }
        }
        latch.await(1500, TimeUnit.MILLISECONDS)
        return ref.get()
    }

    /**
     * Verifica que el documento activo en el WebView pertenezca exclusivamente
     * a https://sebastiang.app o https://www.sebastiang.app.
     */
    private fun isTrustedActiveOrigin(): Boolean {
        val currentUrl = resolveVerifiedMainFrameUrl() ?: return false
        return DomainValidator.isAllowedUrl(currentUrl)
    }

    /**
     * Uso interno exclusivo desde `handleSecureWebMessage` (nunca expuesto por @JavascriptInterface).
     */
    private fun storeDeviceTokenInternal(token: String): Boolean {
        if (!isTrustedActiveOrigin()) {
            return false
        }
        val clean = token.trim()
        if (clean.length < 24 || clean.length > 512) {
            return false
        }
        tokenStorage.saveDeviceToken(clean)
        return true
    }

    /**
     * Uso interno exclusivo desde `handleSecureWebMessage` (nunca expuesto por @JavascriptInterface).
     */
    private fun clearStoredDeviceTokenInternal(): Boolean {
        if (!isTrustedActiveOrigin()) {
            return false
        }
        tokenStorage.clearDeviceToken()
        return true
    }

    /**
     * Indica únicamente si existe un token provisionado en EncryptedSharedPreferences,
     * sin devolver jamás el valor secreto del token al contexto de JavaScript.
     */
    @JavascriptInterface
    fun hasStoredDeviceToken(): Boolean {
        if (!isTrustedActiveOrigin()) {
            return false
        }
        return tokenStorage.hasDeviceToken()
    }

    @JavascriptInterface
    fun isBiometricAvailable(): Boolean {
        if (!isTrustedActiveOrigin()) return false
        val manager = BiometricManager.from(activity)
        return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    @JavascriptInterface
    fun getBiometricStatus(): String {
        if (!isTrustedActiveOrigin()) return "UNTRUSTED_ORIGIN"
        val manager = BiometricManager.from(activity)
        return when (manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> "AVAILABLE"
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "NONE_ENROLLED"
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "NO_HARDWARE"
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "HW_UNAVAILABLE"
            else -> "UNAVAILABLE"
        }
    }

    @JavascriptInterface
    fun openBiometricEnrollmentSettings(): Boolean {
        if (!isTrustedActiveOrigin()) return false
        return try {
            val intent = Intent(Settings.ACTION_BIOMETRIC_ENROLL)
            activity.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun ensureHardwareKeyPair(forceRecreate: Boolean = false): java.security.PublicKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        if (forceRecreate && keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) {
            keyStore.deleteEntry(BIOMETRIC_KEY_ALIAS)
        }
        if (!keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) {
            val keyPairGenerator = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC,
                KEYSTORE_PROVIDER
            )
            val spec = KeyGenParameterSpec.Builder(
                BIOMETRIC_KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true)
                .build()
            keyPairGenerator.initialize(spec)
            return keyPairGenerator.generateKeyPair().public
        }
        return keyStore.getCertificate(BIOMETRIC_KEY_ALIAS).publicKey
    }

    private fun initKeystoreSignature(): Signature {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        val privateKey = keyStore.getKey(BIOMETRIC_KEY_ALIAS, null) as java.security.PrivateKey
        return Signature.getInstance("SHA256withECDSA").apply {
            initSign(privateKey)
        }
    }

    private fun dispatchBiometricEvent(payload: JSONObject) {
        val escaped = payload.toString()
        Handler(Looper.getMainLooper()).post {
            evaluateJavascriptCallback(
                "window.dispatchEvent(new CustomEvent('android-biometric-response', { detail: $escaped }));"
            )
        }
    }

    @JavascriptInterface
    fun authenticateBiometric(title: String, subtitle: String, challenge: String = "") {
        if (!isTrustedActiveOrigin()) {
            dispatchBiometricEvent(
                JSONObject().put("success", false).put("message", "Origen no autorizado para biometría.")
            )
            return
        }
        val isEnrollment = title.contains("Vincular", ignoreCase = true)
        Handler(Looper.getMainLooper()).post {
            try {
                val publicKey = ensureHardwareKeyPair(forceRecreate = isEnrollment)
                val publicKeySpkiB64 = Base64.encodeToString(publicKey.encoded, Base64.NO_WRAP)
                val signatureObj = initKeystoreSignature()
                val executor = ContextCompat.getMainExecutor(activity)

                val prompt = BiometricPrompt(
                    activity,
                    executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            try {
                                val unlockedSig = result.cryptoObject?.signature ?: signatureObj
                                val clientData = JSONObject()
                                    .put("type", if (isEnrollment) "webauthn.create" else "webauthn.get")
                                    .put("challenge", challenge)
                                    .put("origin", "https://sebastiang.app")
                                    .put("rpId", "sebastiang.app")
                                    .toString()
                                val clientDataBytes = clientData.toByteArray(StandardCharsets.UTF_8)
                                unlockedSig.update(clientDataBytes)
                                val sigBytes = unlockedSig.sign()

                                val detail = JSONObject()
                                    .put("success", true)
                                    .put("verified", true)
                                    .put("credentialId", CREDENTIAL_ID)
                                    .put("publicKeySpki", publicKeySpkiB64)
                                    .put("clientDataJSON", Base64.encodeToString(clientDataBytes, Base64.NO_WRAP))
                                    .put("signature", Base64.encodeToString(sigBytes, Base64.NO_WRAP))
                                    .put("message", "Huella verificada criptográficamente con Android Keystore.")
                                dispatchBiometricEvent(detail)
                            } catch (e: Exception) {
                                dispatchBiometricEvent(
                                    JSONObject().put("success", false).put("message", "Fallo al firmar desafío biométrico.")
                                )
                            }
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            dispatchBiometricEvent(
                                JSONObject().put("success", false).put("message", errString.toString())
                            )
                        }

                        override fun onAuthenticationFailed() {
                            // El usuario puede reintentar en el mismo BiometricPrompt
                        }
                    }
                )

                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title.ifBlank { "Ingreso Sebastian G" })
                    .setSubtitle(subtitle.ifBlank { "Confirma tu huella dactilar" })
                    .setNegativeButtonText("Cancelar")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    .build()

                prompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(signatureObj))
            } catch (e: Exception) {
                dispatchBiometricEvent(
                    JSONObject().put("success", false).put("message", "Error iniciando Keystore biométrico.")
                )
            }
        }
    }

    /**
     * Canal principal para WebViewCompat.addWebMessageListener con origen e isMainFrame
     * verificados directamente por el motor nativo de Android WebKit.
     */
    fun handleSecureWebMessage(
        payloadJson: String,
        sourceOrigin: String,
        isMainFrame: Boolean
    ): String {
        if (!isMainFrame || !DomainValidator.isAllowedUrl(sourceOrigin) || !isTrustedActiveOrigin()) {
            return JSONObject().put("ok", false).put("error", "UNTRUSTED_ORIGIN_OR_IFRAME").toString()
        }
        return try {
            val obj = JSONObject(payloadJson)
            when (obj.optString("action")) {
                "storeDeviceToken" -> {
                    val token = obj.optString("token", "")
                    val saved = storeDeviceTokenInternal(token)
                    JSONObject().put("ok", saved).put("hasToken", tokenStorage.hasDeviceToken()).toString()
                }
                "clearDeviceToken" -> {
                    val cleared = clearStoredDeviceTokenInternal()
                    JSONObject().put("ok", cleared).put("hasToken", false).toString()
                }
                "hasDeviceToken" -> {
                    JSONObject().put("ok", true).put("hasToken", tokenStorage.hasDeviceToken()).toString()
                }
                "authenticateBiometric" -> {
                    val title = obj.optString("title", "Ingreso Sebastian G")
                    val subtitle = obj.optString("subtitle", "Confirma tu huella dactilar")
                    val challenge = obj.optString("challenge", "")
                    authenticateBiometric(title, subtitle, challenge)
                    JSONObject().put("ok", true).put("started", true).toString()
                }
                else -> JSONObject().put("ok", false).put("error", "UNKNOWN_ACTION").toString()
            }
        } catch (_: Exception) {
            JSONObject().put("ok", false).put("error", "INVALID_MESSAGE_FORMAT").toString()
        }
    }
}
