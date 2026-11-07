package app.sebastiang.studio

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import app.sebastiang.studio.bridge.AndroidNotificationBridge
import app.sebastiang.studio.security.DomainValidator
import app.sebastiang.studio.security.SecureTokenStorage
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var tokenStorage: SecureTokenStorage
    private lateinit var notificationBridge: AndroidNotificationBridge

    @SuppressLint("SetJavaScriptEnabled", "RequiresFeature")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Prohibido habilitar WebContentsDebugging en producción
        WebView.setWebContentsDebuggingEnabled(false)

        tokenStorage = SecureTokenStorage(applicationContext)
        webView = WebView(this)
        notificationBridge = AndroidNotificationBridge(
            activity = this,
            tokenStorage = tokenStorage,
            mainFrameUrlProvider = { webView.url },
            evaluateJavascriptCallback = { script -> webView.evaluateJavascript(script, null) }
        )
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportMultipleWindows(false)
        }

        // Canal preferente basado en WebViewCompat.addWebMessageListener restringido por reglas de origen nativas
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(
                webView,
                "SebastianGNativeChannel",
                ALLOWED_ORIGIN_RULES
            ) { _: WebView, message: WebMessageCompat, sourceOrigin: Uri, isMainFrame: Boolean, replyProxy: JavaScriptReplyProxy ->
                val response = notificationBridge.handleSecureWebMessage(
                    payloadJson = message.data ?: "{}",
                    sourceOrigin = sourceOrigin.toString(),
                    isMainFrame = isMainFrame
                )
                replyProxy.postMessage(response)
            }
        }

        // Puente auxiliar endurecido: valida el origen real del marco principal en el UI thread y nunca expone el token en claro
        webView.addJavascriptInterface(notificationBridge, "AndroidNotificationBridge")

        webView.webViewClient = object : WebViewClient() {

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url?.toString() ?: return true
                // Bloquea cualquier navegación fuera de sebastiang.app (incluyendo subdominios engañosos)
                return !DomainValidator.isAllowedUrl(url)
            }

            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url?.toString() ?: return null

                // Inyecta el token de alcance reducido (apk_feed:read) desde EncryptedSharedPreferences
                // exclusivamente cuando el destino validado es https://sebastiang.app/api/apk/feed
                if (DomainValidator.isAllowedUrl(url) && request.url.path == "/api/apk/feed") {
                    val deviceToken = tokenStorage.getDeviceToken()
                    if (!deviceToken.isNullOrBlank()) {
                        return try {
                            val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                                requestMethod = request.method
                                // Deshabilitar redirecciones automáticas para que x-apk-device-token
                                // jamás se reenvíe hacia un host distinto ante un HTTP 301/302 (Hallazgo B9)
                                instanceFollowRedirects = false
                                connectTimeout = 10_000
                                readTimeout = 10_000
                                setRequestProperty("Accept", "application/json")
                                setRequestProperty("x-apk-device-token", deviceToken)
                            }
                            val status = connection.responseCode
                            val stream = if (status in 200..299) {
                                connection.inputStream
                            } else {
                                connection.errorStream ?: ByteArrayInputStream(ByteArray(0))
                            }
                            WebResourceResponse(
                                "application/json",
                                "utf-8",
                                status,
                                connection.responseMessage ?: "OK",
                                mapOf("Cache-Control" to "no-store"),
                                stream
                            )
                        } catch (_: Exception) {
                            null
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request)
            }
        }

        webView.loadUrl(INITIAL_URL)
    }

    companion object {
        private const val INITIAL_URL = "https://sebastiang.app/?mode=admin"
        private val ALLOWED_ORIGIN_RULES = setOf(
            "https://sebastiang.app",
            "https://www.sebastiang.app"
        )
    }
}
