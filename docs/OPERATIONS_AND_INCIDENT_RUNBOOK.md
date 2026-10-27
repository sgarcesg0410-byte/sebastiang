# Manual de Operación Segura, Respuesta a Incidentes y Arquitectura Android Nativa

**Proyecto:** Sebastian G • Estudio Fotográfico (`sebastiang.app`)  
**Fuente Única de Verdad:** MongoDB Atlas (`sebastiang`)  
**Retención de Bitácora (`audit_logs`):** 90 días (con enmascaramiento automático de PII y redacción de secretos)

---

## 1. Procedimiento de Respuesta a Incidentes (Runbook)

### Escenario A: Pérdida o robo de teléfono / Filtración de Token APK
1. **Revocación inmediata por dispositivo (< 30 segundos):**
   - Ingresa al Panel de Administración desde tu PC (`https://sebastiang.app/?mode=admin`) o ejecuta:
     ```bash
     curl -X POST https://sebastiang.app/api/admin/apk-devices/revoke \
       -H "Authorization: Bearer <TU_ADMIN_TOKEN>" \
       -H "Content-Type: application/json" \
       -d '{"deviceId":"<ID_DEL_DISPOSITIVO>"}'
     ```
   - Como `/api/apk/feed` consulta `revokedApkDeviceIds` y `passwordVersion` en cada petición contra MongoDB Atlas, el dispositivo queda bloqueado instantáneamente en todas las instancias serverless.
2. **Revocación global de emergencia (rotación de contraseña):**
   - Si desconoces el `deviceId` o sospechas que también había sesión abierta en el navegador del teléfono, cambia la contraseña administrativa en **Panel Admin → Seguridad → Cambiar Contraseña** (`POST /api/admin/pin/change`).
   - Esto incrementa `passwordVersion` en MongoDB Atlas e invalida en el acto **todos** los tokens de sesión admin, tokens biométricos y tokens de dispositivos APK emitidos con la versión anterior.

---

### Escenario B: Pago duplicado o discrepancia financiera
1. **Verificación en Bitácora de Auditoría:**
   - Consulta `GET /api/admin/audit-logs` para inspeccionar los eventos `wompi_payment_approved`, `payment_registered` o `payment_status_updated` asociados al `entityId` o referencia bancaria.
2. **Detección automática de referencias repetidas:**
   - El módulo [`auditPaymentConflicts`](../src/services/systemAuditor.js) señala en el panel cualquier referencia bancaria duplicada (`duplicate_reference`).
3. **Corrección contable:**
   - Si un cliente subió dos veces el mismo comprobante manual, marca el registro duplicado como `rejected` (`PATCH /api/admin/payments/:id`) o elimínalo (`DELETE /api/admin/payments/:id`).
   - Los webhooks de Wompi son **idempotentes** en [`api/index.js`](../api/index.js): si Wompi reintenta un evento `APPROVED` ya procesado, el servidor responde `200 OK` con `idempotent: true` sin duplicar el abono.

---

### Escenario C: Caída de MongoDB Atlas / Restauración desde Backup Cifrado
1. **Detección:**
   - Verifica el estado en `GET /api/health` y `GET /api/admin/monitoring/status` (alerta `MONGO_DISCONNECTED` o `MONGO_ERRORS`).
2. **Exportación preventiva de Backup Cifrado (`AES-256-GCM`):**
   - Descarga periódicamente el snapshot cifrado (sin secretos, sin hashes scrypt ni retos de recuperación, con `Content-Disposition: attachment` y `Cache-Control: no-store`):
     ```bash
     curl -X GET "https://sebastiang.app/api/admin/backup?encrypt=1" \
       -H "Authorization: Bearer <TU_ADMIN_TOKEN>" \
       -o backup-sebastiang-encrypted.json
     ```
3. **Restauración verificada y medición de RTO (`recoveryTimeMs`):**
   - Para restaurar un backup cifrado en una base temporal o de producción:
     ```bash
     curl -X POST "https://sebastiang.app/api/admin/backup/restore" \
       -H "Authorization: Bearer <TU_ADMIN_TOKEN>" \
       -H "Content-Type: application/json" \
       -d @backup-sebastiang-encrypted.json
     ```
   - La respuesta devuelve `recoveryTimeMs` y `restoredCounts` (`bookings`, `payments`, `sessions`, `catalog`, `reviews`).

---

### Escenario D: Recuperación de Acceso Admin
1. **Vía código efímero a correo oficial (Zoho SMTP):**
   - Solicita el código en la pantalla de login (`POST /api/admin/password/reset-request`). El servidor ignora cualquier correo enviado desde el navegador y envía el código de 6 dígitos exclusivamente a `ADMIN_EMAIL`.
   - El código expira en 10 minutos y se quema automáticamente tras el primer uso o tras 5 intentos fallidos.
2. **Vía consola de Vercel (si el servidor SMTP no estuviera disponible):**
   - Genera un nuevo hash scrypt localmente con `node scripts/hash-admin-pin.mjs "<NUEVA_CLAVE_SEGURA>"`, actualiza `ADMIN_PIN_SCRYPT` en Vercel Environment Variables y redespliega.

---

## 2. Arquitectura de Seguridad para el Proyecto Fuente Android Nativo (Kotlin)

Para cumplir con las mejores prácticas de seguridad móvil en el proyecto Android (`android/`):
- **Nunca** almacenar `deviceToken` en `localStorage`, `sessionStorage` ni hardcodeado en `strings.xml` o `BuildConfig`.
- Guardar el token exclusivamente en **`EncryptedSharedPreferences`** respaldado por **`AndroidKeyStore` (`MasterKey.KeyScheme.AES256_GCM`)**.
- Inyectar el token hacia el endpoint `/api/apk/feed` desde la capa nativa de Kotlin usando la cabecera `x-apk-device-token`.

### Implementación de referencia: `SecureTokenStorage.kt`
```kotlin
package app.sebastiang.studio.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

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
```

### Checklist de Auditoría del Proyecto Android (`AndroidManifest.xml` y `WebView`)
1. `android:usesCleartextTraffic="false"` y `android:allowBackup="false"` en `<application>` dentro de `AndroidManifest.xml`.
2. Desactivar depuración de WebView en producción (`WebView.setWebContentsDebuggingEnabled(false)` cuando `!BuildConfig.DEBUG`).
3. Restringir `@JavascriptInterface` (`AndroidNotificationBridge`) únicamente a orígenes verificados (`https://sebastiang.app` y `https://www.sebastiang.app`), bloqueando `file://` (`settings.allowFileAccess = false`, `settings.allowContentAccess = false`).
