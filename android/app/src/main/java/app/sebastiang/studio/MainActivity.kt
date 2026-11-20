package app.sebastiang.studio

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
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
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileUploadCallback
        fileUploadCallback = null
        if (callback == null) return@registerForActivityResult

        val uris: Array<Uri>? = if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            val clipData = data?.clipData
            when {
                clipData != null && clipData.itemCount > 0 -> {
                    Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
                }
                data?.data != null -> arrayOf(data.data!!)
                else -> WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
            }
        } else {
            null
        }
        callback.onReceiveValue(uris)
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

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
            evaluateJavascriptCallback = { script -> webView.evaluateJavascript(script, null) },
            requestNotificationPermissionCallback = { requestPostNotificationsPermission() }
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

        // Soporte seguro para carga de fotografías desde galería (<input type="file">)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                if (filePathCallback == null) return false
                val currentUrl = webView?.url ?: return false
                if (!DomainValidator.isAllowedUrl(currentUrl)) {
                    filePathCallback.onReceiveValue(null)
                    return false
                }
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                return try {
                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "image/*"
                    }
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    fileChooserLauncher.launch(intent)
                    true
                } catch (_: Exception) {
                    fileUploadCallback = null
                    filePathCallback.onReceiveValue(null)
                    false
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?
            ) {
                // Fallar cerrado ante cualquier error TLS/SSL (nunca invocar handler.proceed())
                handler?.cancel()
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val uri = request.url ?: return true
                val url = uri.toString()
                if (DomainValidator.isAllowedUrl(url)) {
                    return false
                }
                if (isSafeExternalAppUrl(uri)) {
                    openSafeExternalIntent(uri)
                    return true
                }
                // Bloquea cualquier navegación fuera de sebastiang.app o lista blanca externa
                return true
            }

            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url?.toString() ?: return null

                // Inyecta el token de alcance reducido (apk_feed:read) desde EncryptedSharedPreferences
                // exclusivamente en peticiones GET hacia https://sebastiang.app/api/apk/feed
                if (
                    request.method.equals("GET", ignoreCase = true) &&
                    DomainValidator.isAllowedUrl(url) &&
                    request.url.path == "/api/apk/feed"
                ) {
                    val deviceToken = tokenStorage.getDeviceToken()
                    if (!deviceToken.isNullOrBlank()) {
                        var connection: HttpURLConnection? = null
                        return try {
                            connection = (URL(url).openConnection() as HttpURLConnection).apply {
                                requestMethod = "GET"
                                // Deshabilitar redirecciones automáticas para que x-apk-device-token
                                // jamás se reenvíe hacia un host distinto ante un HTTP 301/302 (Hallazgo B9)
                                instanceFollowRedirects = false
                                connectTimeout = 10_000
                                readTimeout = 10_000
                                setRequestProperty("Accept", "application/json")
                                setRequestProperty("x-apk-device-token", deviceToken)
                            }
                            val status = connection.responseCode
                            val rawStream = if (status in 200..299) {
                                connection.inputStream
                            } else {
                                connection.errorStream
                            }
                            val bodyBytes = rawStream?.use { it.readBytes() } ?: ByteArray(0)
                            val reasonPhrase = connection.responseMessage?.takeIf { it.isNotBlank() } ?: "OK"
                            WebResourceResponse(
                                "application/json",
                                "utf-8",
                                status,
                                reasonPhrase,
                                mapOf("Cache-Control" to "no-store"),
                                ByteArrayInputStream(bodyBytes)
                            )
                        } catch (_: Exception) {
                            null
                        } finally {
                            connection?.disconnect()
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request)
            }
        }

        // Navegación atrás nativa dentro del WebView antes de cerrar la app
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (this@MainActivity::webView.isInitialized && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        val targetFromNotification = intent?.getStringExtra(EXTRA_TARGET_URL)
        val initialTarget = if (DomainValidator.isAllowedUrl(targetFromNotification)) {
            targetFromNotification!!
        } else {
            INITIAL_URL
        }
        webView.loadUrl(initialTarget)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val targetFromNotification = intent.getStringExtra(EXTRA_TARGET_URL)
        if (DomainValidator.isAllowedUrl(targetFromNotification) && this::webView.isInitialized) {
            webView.loadUrl(targetFromNotification!!)
        }
    }

    override fun onDestroy() {
        fileUploadCallback?.onReceiveValue(null)
        fileUploadCallback = null
        if (this::webView.isInitialized) {
            webView.stopLoading()
            webView.removeJavascriptInterface("AndroidNotificationBridge")
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun requestPostNotificationsPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun isSafeExternalAppUrl(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme == "mailto" || scheme == "tel") return true
        if (scheme != "https") return false
        if (!uri.userInfo.isNullOrEmpty()) return false
        val host = uri.host?.lowercase() ?: return false
        return SAFE_EXTERNAL_HOSTS.contains(host)
    }

    private fun openSafeExternalIntent(uri: Uri) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
            }
            startActivity(intent)
        } catch (_: Exception) {
            // Sin app instalada para el esquema externo
        }
    }

    companion object {
        const val EXTRA_TARGET_URL = "extra_target_url"
        private const val INITIAL_URL = "https://sebastiang.app/?mode=admin"
        private val ALLOWED_ORIGIN_RULES = setOf(
            "https://sebastiang.app",
            "https://www.sebastiang.app"
        )
        private val SAFE_EXTERNAL_HOSTS = setOf(
            "wa.me",
            "api.whatsapp.com",
            "checkout.wompi.co",
            "instagram.com",
            "www.instagram.com",
            "facebook.com",
            "www.facebook.com",
            "maps.google.com",
            "drive.google.com",
            "wetransfer.com",
            "we.tl"
        )
    }
}
