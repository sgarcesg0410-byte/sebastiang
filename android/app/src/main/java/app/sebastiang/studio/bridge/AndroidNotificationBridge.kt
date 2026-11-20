package app.sebastiang.studio.bridge

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.provider.MediaStore
import android.provider.Settings
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import app.sebastiang.studio.MainActivity
import app.sebastiang.studio.security.DomainValidator
import app.sebastiang.studio.security.SecureTokenStorage
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.nio.charset.StandardCharsets
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * Puente seguro endurecido:
 * 1. Las mutaciones sensibles de credenciales (`storeDeviceToken`, `clearDeviceToken`) NO están expuestas
 *    en `@JavascriptInterface`, sino exclusivamente a través de `WebViewCompat.addWebMessageListener`
 *    (`handleSecureWebMessage`), donde Android WebKit certifica nativamente `isMainFrame` y `sourceOrigin`.
 * 2. Implementa biometría nativa real con `BiometricPrompt` + `AndroidKeyStore` (`EC P-256`, `SHA256withECDSA`)
 *    con `setUserAuthenticationRequired(true)` para que la clave privada solo firme tras desbloqueo físico.
 * 3. Implementa notificaciones locales, WhatsApp y descarga/impresión segura de comprobantes PDF con
 *    verificación estricta de origen y magic bytes `%PDF-`.
 */
class AndroidNotificationBridge(
    private val activity: FragmentActivity,
    private val tokenStorage: SecureTokenStorage,
    private val mainFrameUrlProvider: () -> String?,
    private val evaluateJavascriptCallback: (String) -> Unit = {},
    private val requestNotificationPermissionCallback: () -> Unit = {}
) {

    companion object {
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val BIOMETRIC_KEY_ALIAS = "sebastian_g_admin_bio_ecdsa_p256_v2"
        private const val CREDENTIAL_ID = "native_android_keystore_p256_v2"
        private const val NOTIFICATION_CHANNEL_ID = "sebastiang_admin_alerts"
        private const val MAX_PDF_BYTES = 10 * 1024 * 1024 // 10 MB
        private val SAFE_PDF_NAME_REGEX = Regex("^[a-zA-Z0-9._-]{1,80}\\.pdf$", RegexOption.IGNORE_CASE)
        private val notificationCounter = AtomicInteger(1000)
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
     * Extrae el origen canónico verificado (esquema + host) del marco principal actual.
     */
    private fun resolveTrustedOriginPair(): Pair<String, String> {
        val currentUrl = resolveVerifiedMainFrameUrl()
        if (DomainValidator.isAllowedUrl(currentUrl)) {
            val host = Uri.parse(currentUrl).host?.lowercase() ?: "sebastiang.app"
            return Pair("https://$host", host)
        }
        return Pair("https://sebastiang.app", "sebastiang.app")
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

    // -------------------------------------------------------------------------
    // NOTIFICACIONES NATIVAS ANDROID
    // -------------------------------------------------------------------------

    private fun ensureNotificationChannel() {
        val manager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        if (manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Alertas de Sebastian G Studio",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Reservas, pagos Wompi y selecciones de galerías privadas."
            }
            manager.createNotificationChannel(channel)
        }
    }

    @JavascriptInterface
    fun areNotificationsEnabled(): Boolean {
        if (!isTrustedActiveOrigin()) return false
        return NotificationManagerCompat.from(activity).areNotificationsEnabled()
    }

    @JavascriptInterface
    fun requestNotificationPermission(): Boolean {
        if (!isTrustedActiveOrigin()) return false
        Handler(Looper.getMainLooper()).post {
            requestNotificationPermissionCallback()
        }
        return true
    }

    @JavascriptInterface
    fun showNotification(title: String, body: String) {
        showNotificationWithAction(title, body, "https://sebastiang.app/?mode=admin")
    }

    @JavascriptInterface
    fun showNotification(title: String, body: String, tag: String, type: String) {
        showNotificationWithAction(title, body, "https://sebastiang.app/?mode=admin")
    }

    @JavascriptInterface
    fun testNativeNotification() {
        if (!isTrustedActiveOrigin()) return
        showNotification(
            "🔔 Alerta de Prueba • Sebastian G",
            "Las notificaciones nativas de la app Android están activas y operando correctamente."
        )
    }

    @JavascriptInterface
    fun showNotificationWithAction(title: String, body: String, tag: String, type: String, targetUrl: String) {
        showNotificationWithAction(title, body, targetUrl)
    }

    @JavascriptInterface
    fun showNotificationWithAction(title: String, body: String, targetUrl: String) {
        if (!isTrustedActiveOrigin()) return
        if (!NotificationManagerCompat.from(activity).areNotificationsEnabled()) return
        ensureNotificationChannel()

        val safeTitle = title.trim().take(100).ifBlank { "Sebastian G Studio" }
        val safeBody = body.trim().take(300)
        val safeUrl = if (DomainValidator.isAllowedUrl(targetUrl)) {
            targetUrl
        } else {
            "https://sebastiang.app/?mode=admin"
        }

        val launchIntent = Intent(activity, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MainActivity.EXTRA_TARGET_URL, safeUrl)
        }
        val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getActivity(activity, 0, launchIntent, pendingFlags)

        val notification = NotificationCompat.Builder(activity, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(safeTitle)
            .setContentText(safeBody)
            .setStyle(NotificationCompat.BigTextStyle().bigText(safeBody))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(activity).notify(notificationCounter.incrementAndGet(), notification)
        } catch (_: SecurityException) {
            // El usuario aún no otorgó POST_NOTIFICATIONS en Android 13+
        }
    }

    // -------------------------------------------------------------------------
    // WHATSAPP SEGURO (Solo dígitos y URL oficial wa.me)
    // -------------------------------------------------------------------------

    @JavascriptInterface
    fun shareToWhatsApp(text: String): Boolean {
        return openWhatsAppWithLine("", text, "default")
    }

    @JavascriptInterface
    fun shareToWhatsApp(phone: String, text: String): Boolean {
        return openWhatsAppWithLine(phone, text, "default")
    }

    @JavascriptInterface
    fun openWhatsAppWithLine(phone: String, text: String, line: String): Boolean {
        if (!isTrustedActiveOrigin()) return false
        val digits = phone.replace(Regex("\\D"), "").take(15)
        val safeText = text.trim().take(2000)
        val uriBuilder = Uri.Builder()
            .scheme("https")
            .authority("wa.me")
        if (digits.isNotEmpty()) {
            uriBuilder.appendPath(digits)
        }
        if (safeText.isNotEmpty()) {
            uriBuilder.appendQueryParameter("text", safeText)
        }
        val waUri = uriBuilder.build()
        return try {
            val intent = Intent(Intent.ACTION_VIEW, waUri).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
                if (line.equals("business", ignoreCase = true)) {
                    setPackage("com.whatsapp.w4b")
                }
            }
            Handler(Looper.getMainLooper()).post {
                try {
                    activity.startActivity(intent)
                } catch (_: Exception) {
                    // Fallback al navegador o app WhatsApp por defecto si WA Business no está instalado
                    try {
                        activity.startActivity(Intent(Intent.ACTION_VIEW, waUri))
                    } catch (_: Exception) {}
                }
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    // -------------------------------------------------------------------------
    // DESCARGA E IMPRESIÓN SEGURA DE COMPROBANTES PDF (Magic Bytes %PDF-)
    // -------------------------------------------------------------------------

    private fun decodeValidatedPdfBase64(base64Data: String): ByteArray? {
        val clean = base64Data.substringAfter("base64,", base64Data).trim()
        if (clean.isEmpty() || clean.length > (MAX_PDF_BYTES * 4) / 3 + 64) return null
        val bytes = try {
            Base64.decode(clean, Base64.DEFAULT)
        } catch (_: Exception) {
            return null
        }
        if (bytes.size < 8 || bytes.size > MAX_PDF_BYTES) return null
        // Verificar firma mágica real de PDF: %PDF-
        if (bytes[0] != 0x25.toByte() || bytes[1] != 0x50.toByte() || bytes[2] != 0x44.toByte() || bytes[3] != 0x46.toByte() || bytes[4] != 0x2D.toByte()) {
            return null
        }
        return bytes
    }

    @JavascriptInterface
    fun downloadPdfFile(base64Data: String, fileName: String): Boolean {
        if (!isTrustedActiveOrigin()) return false
        val safeName = fileName.trim().let {
            if (SAFE_PDF_NAME_REGEX.matches(it)) it else "Comprobante-SebastianG.pdf"
        }
        val pdfBytes = decodeValidatedPdfBase64(base64Data) ?: return false

        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = activity.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: return false
                activity.contentResolver.openOutputStream(uri)?.use { out ->
                    out.write(pdfBytes)
                    out.flush()
                } ?: return false
                true
            } else {
                val dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: return false
                val target = File(dir, safeName)
                FileOutputStream(target).use { out ->
                    out.write(pdfBytes)
                    out.flush()
                }
                true
            }
        } catch (_: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun sharePdfFile(base64Data: String, fileName: String, phone: String, text: String, line: String): Boolean {
        if (!isTrustedActiveOrigin()) return false
        val saved = downloadPdfFile(base64Data, fileName)
        val waOpened = openWhatsAppWithLine(phone, text, line)
        return saved || waOpened
    }

    @JavascriptInterface
    fun printPdfDocument(base64Data: String, jobName: String): Boolean {
        if (!isTrustedActiveOrigin()) return false
        val pdfBytes = decodeValidatedPdfBase64(base64Data) ?: return false
        val safeJob = jobName.trim().take(60).ifBlank { "Comprobante-SebastianG" }

        Handler(Looper.getMainLooper()).post {
            try {
                val printManager = activity.getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return@post
                val adapter = object : PrintDocumentAdapter() {
                    override fun onLayout(
                        oldAttributes: PrintAttributes?,
                        newAttributes: PrintAttributes,
                        cancellationSignal: CancellationSignal?,
                        callback: LayoutResultCallback,
                        extras: Bundle?
                    ) {
                        if (cancellationSignal?.isCanceled == true) {
                            callback.onLayoutCancelled()
                            return
                        }
                        val info = PrintDocumentInfo.Builder("$safeJob.pdf")
                            .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                            .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                            .build()
                        callback.onLayoutFinished(info, true)
                    }

                    override fun onWrite(
                        pages: Array<out PageRange>?,
                        destination: ParcelFileDescriptor,
                        cancellationSignal: CancellationSignal?,
                        callback: WriteResultCallback
                    ) {
                        try {
                            FileOutputStream(destination.fileDescriptor).use { out ->
                                out.write(pdfBytes)
                                out.flush()
                            }
                            callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
                        } catch (e: Exception) {
                            callback.onWriteFailed(e.message)
                        }
                    }
                }
                printManager.print(safeJob, adapter, PrintAttributes.Builder().build())
            } catch (_: Exception) {}
        }
        return true
    }

    // -------------------------------------------------------------------------
    // BIOMETRÍA HARDWARE (AndroidKeyStore EC P-256 + BiometricPrompt)
    // -------------------------------------------------------------------------

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

    private fun openBiometricSettingsInternal(): Boolean {
        if (!isTrustedActiveOrigin()) return false
        return try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Intent(Settings.ACTION_BIOMETRIC_ENROLL)
            } else {
                Intent(Settings.ACTION_SECURITY_SETTINGS)
            }
            activity.startActivity(intent)
            true
        } catch (_: Exception) {
            try {
                activity.startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS))
                true
            } catch (_: Exception) {
                false
            }
        }
    }

    @JavascriptInterface
    fun openBiometricEnrollmentSettings(): Boolean {
        return openBiometricSettingsInternal()
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
        val quotedJson = JSONObject.quote(payload.toString())
        Handler(Looper.getMainLooper()).post {
            evaluateJavascriptCallback(
                "window.dispatchEvent(new CustomEvent('android-biometric-response', { detail: JSON.parse($quotedJson) }));"
            )
        }
    }

    private fun startBiometricPrompt(title: String, subtitle: String, challenge: String, isEnrollment: Boolean) {
        if (!isTrustedActiveOrigin()) {
            dispatchBiometricEvent(
                JSONObject().put("success", false).put("message", "Origen no autorizado para biometría.")
            )
            return
        }
        val (verifiedOrigin, verifiedRpId) = resolveTrustedOriginPair()
        Handler(Looper.getMainLooper()).post {
            try {
                val publicKey = ensureHardwareKeyPair(forceRecreate = isEnrollment)
                val publicKeySpkiB64 = Base64.encodeToString(publicKey.encoded, Base64.NO_WRAP)
                val signatureObj = try {
                    initKeystoreSignature()
                } catch (_: KeyPermanentlyInvalidatedException) {
                    if (isEnrollment) {
                        ensureHardwareKeyPair(forceRecreate = true)
                        initKeystoreSignature()
                    } else {
                        dispatchBiometricEvent(
                            JSONObject()
                                .put("success", false)
                                .put("code", "BIOMETRIC_KEY_INVALIDATED")
                                .put("message", "Las huellas del dispositivo cambiaron. Inicia sesión con tu contraseña y vincula tu huella de nuevo.")
                        )
                        return@post
                    }
                }
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
                                    .put("origin", verifiedOrigin)
                                    .put("rpId", verifiedRpId)
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
                            } catch (_: Exception) {
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
            } catch (_: Exception) {
                dispatchBiometricEvent(
                    JSONObject().put("success", false).put("message", "Error iniciando Keystore biométrico.")
                )
            }
        }
    }

    @JavascriptInterface
    fun authenticateBiometric(title: String, subtitle: String, challenge: String = "") {
        val isEnrollment = title.contains("Vincular", ignoreCase = true)
        startBiometricPrompt(title, subtitle, challenge, isEnrollment)
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
                "openBiometricEnrollmentSettings" -> {
                    val opened = openBiometricSettingsInternal()
                    JSONObject().put("ok", opened).toString()
                }
                "authenticateBiometric" -> {
                    val title = obj.optString("title", "Ingreso Sebastian G")
                    val subtitle = obj.optString("subtitle", "Confirma tu huella dactilar")
                    val challenge = obj.optString("challenge", "")
                    val isEnrollment = if (obj.has("isEnrollment")) {
                        obj.optBoolean("isEnrollment", false)
                    } else {
                        title.contains("Vincular", ignoreCase = true)
                    }
                    startBiometricPrompt(title, subtitle, challenge, isEnrollment)
                    JSONObject().put("ok", true).put("started", true).toString()
                }
                else -> JSONObject().put("ok", false).put("error", "UNKNOWN_ACTION").toString()
            }
        } catch (_: Exception) {
            JSONObject().put("ok", false).put("error", "INVALID_MESSAGE_FORMAT").toString()
        }
    }
}
