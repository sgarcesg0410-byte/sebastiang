package app.sebastiang.studio.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.Toast
import app.sebastiang.studio.security.SecureTokenStorage

/**
 * Bridge seguro entre el frontend web y el hardware del dispositivo Android.
 * Restringe la invocación exclusivamente a orígenes verificados (sebastiang.app).
 */
class AndroidNotificationBridge(
    private val context: Context,
    private val secureStorage: SecureTokenStorage
) {

    private val allowedOrigins = setOf(
        "https://sebastiang.app",
        "https://www.sebastiang.app"
    )

    fun isOriginAllowed(currentUrl: String?): Boolean {
        if (currentUrl == null) return false
        return allowedOrigins.any { currentUrl.startsWith(it) }
    }

    @JavascriptInterface
    fun storeDeviceToken(token: String, origin: String) {
        if (!isOriginAllowed(origin)) return
        secureStorage.saveDeviceToken(token)
    }

    @JavascriptInterface
    fun getStoredDeviceToken(origin: String): String {
        if (!isOriginAllowed(origin)) return ""
        return secureStorage.getDeviceToken() ?: ""
    }

    @JavascriptInterface
    fun clearStoredDeviceToken(origin: String) {
        if (!isOriginAllowed(origin)) return
        secureStorage.clearDeviceToken()
    }

    @JavascriptInterface
    fun showToast(message: String) {
        val safeMessage = message.take(120)
        Toast.makeText(context, safeMessage, Toast.LENGTH_SHORT).show()
    }
}
