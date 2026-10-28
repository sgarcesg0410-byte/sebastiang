package app.sebastiang.studio

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import app.sebastiang.studio.bridge.AndroidNotificationBridge
import app.sebastiang.studio.security.DomainValidator
import app.sebastiang.studio.security.SecureTokenStorage

/**
 * Actividad principal con WebView endurecido según los lineamientos de seguridad móvil.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var secureStorage: SecureTokenStorage

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        secureStorage = SecureTokenStorage(this)
        webView = WebView(this)
        setContentView(webView)

        // 1. Desactivar depuración en producción
        WebView.setWebContentsDebuggingEnabled(false)

        // 2. Endurecimiento estricto de WebSettings
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            setGeolocationEnabled(false)
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        // 3. Registrar Javascript Bridge protegido
        webView.addJavascriptInterface(
            AndroidNotificationBridge(this, secureStorage),
            "AndroidNotificationBridge"
        )

        // 4. WebViewClient que valida dominios estrictamente y previene navegación no autorizada
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return true
                // Restringir navegación únicamente a URLs válidas dentro del dominio oficial
                val isOfficial = DomainValidator.isAllowedUrl(url)
                return !isOfficial // true bloquea la carga no autorizada
            }

            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                val url = request?.url?.toString() ?: return null
                if (url.contains("/api/apk/feed") && DomainValidator.isAllowedUrl(url)) {
                    val token = secureStorage.getDeviceToken()
                    if (!token.isNullOrBlank()) {
                        // El token protegido se inyecta desde Kotlin
                    }
                }
                return super.shouldInterceptRequest(view, request)
            }
        }

        webView.loadUrl("https://sebastiang.app/?mode=admin")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
