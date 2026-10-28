package app.sebastiang.studio.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.Toast
import app.sebastiang.studio.security.DomainValidator
import app.sebastiang.studio.security.SecureTokenStorage

/**
 * Bridge seguro entre el frontend web y el hardware del dispositivo Android.
 * Restringe la invocación exclusivamente a orígenes verificados mediante DomainValidator.
 */
class AndroidNotificationBridge(
    private val context: Context,
    private val secureStorage: SecureTokenStorage
) {

    fun isOriginAllowed(currentUrl: String?): Boolean {
        return DomainValidator.isAllowedUrl(currentUrl)
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
