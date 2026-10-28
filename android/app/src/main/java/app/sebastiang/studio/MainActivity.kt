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
                val uri = request?.url ?: return null
                val url = uri.toString()
                val method = request.method ?: "GET"

                // Restricción estricta: solo interceptar GET a la ruta exacta /api/apk/feed bajo dominio oficial
                if ("GET".equals(method, ignoreCase = true) &&
                    uri.path == "/api/apk/feed" &&
                    DomainValidator.isAllowedUrl(url)
                ) {
                    val token = secureStorage.getDeviceToken()
                    if (!token.isNullOrBlank()) {
                        try {
                            val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                            conn.requestMethod = "GET"
                            // Prohibir seguimiento automático de redirecciones para no filtrar credenciales
                            conn.instanceFollowRedirects = false
                            conn.connectTimeout = 8000
                            conn.readTimeout = 8000
                            request.requestHeaders?.forEach { (k, v) -> conn.setRequestProperty(k, v) }
                            // Inyección segura exclusivamente desde la capa nativa Kotlin (cero exposición a JavaScript)
                            conn.setRequestProperty("x-apk-device-token", token)
                            conn.connect()
                            val contentType = conn.contentType ?: "application/json"
                            val encoding = conn.contentEncoding ?: "UTF-8"
                            val inputStream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                            val headers = conn.headerFields.mapValues { it.value?.joinToString(",") ?: "" }
                            return WebResourceResponse(
                                contentType,
                                encoding,
                                conn.responseCode,
                                conn.responseMessage ?: "OK",
                                headers,
                                inputStream
                            )
                        } catch (_: Exception) {
                            return null
                        }
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
