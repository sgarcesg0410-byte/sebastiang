package app.sebastiang.studio.bridge

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import app.sebastiang.studio.security.DomainValidator
import app.sebastiang.studio.security.SecureTokenStorage
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Puente seguro expurgado de métodos peligrosos.
 * Restringe todas las llamadas únicamente al marco principal verificando el origen real
 * directamente desde la instancia nativa del WebView en el hilo principal (nunca confiando
 * en un parámetro `origin` enviado por JavaScript) y jamás expone el `deviceToken` en claro al JS.
 */
class AndroidNotificationBridge(
    private val tokenStorage: SecureTokenStorage,
    private val mainFrameUrlProvider: () -> String?
) {

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

    @JavascriptInterface
    fun storeDeviceToken(token: String): Boolean {
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
    fun clearStoredDeviceToken(): Boolean {
        if (!isTrustedActiveOrigin()) {
            return false
        }
        tokenStorage.clearDeviceToken()
        return true
    }

    /**
     * Canal moderno para WebViewCompat.addWebMessageListener con origen e isMainFrame
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
                    val saved = storeDeviceToken(token)
                    JSONObject().put("ok", saved).put("hasToken", tokenStorage.hasDeviceToken()).toString()
                }
                "clearDeviceToken" -> {
                    val cleared = clearStoredDeviceToken()
                    JSONObject().put("ok", cleared).put("hasToken", false).toString()
                }
                "hasDeviceToken" -> {
                    JSONObject().put("ok", true).put("hasToken", tokenStorage.hasDeviceToken()).toString()
                }
                else -> JSONObject().put("ok", false).put("error", "UNKNOWN_ACTION").toString()
            }
        } catch (_: Exception) {
            JSONObject().put("ok", false).put("error", "INVALID_MESSAGE_FORMAT").toString()
        }
    }
}
