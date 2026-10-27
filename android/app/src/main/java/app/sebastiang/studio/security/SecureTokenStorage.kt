package app.sebastiang.studio.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Custodia segura de tokens en hardware Android Keystore (AES-256-GCM / AES-256-SIV).
 * Cumple con el estándar de seguridad para evitar almacenamiento en texto plano o localStorage.
 */
class SecureTokenStorage(context: Context) {

    private val masterKey = MasterKey.Builder(context.applicationContext)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context.applicationContext,
        "sebastiang_secure_apk_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveDeviceToken(token: String) {
        prefs.edit().putString(KEY_DEVICE_TOKEN, token.trim()).apply()
    }

    fun getDeviceToken(): String? = prefs.getString(KEY_DEVICE_TOKEN, null)

    fun clearDeviceToken() {
        prefs.edit().remove(KEY_DEVICE_TOKEN).apply()
    }

    companion object {
        private const val KEY_DEVICE_TOKEN = "apk_scoped_device_token"
    }
}
