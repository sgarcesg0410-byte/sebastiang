package app.sebastiang.studio.security

import android.net.Uri

/**
 * Validador estricto de orígenes y URLs permitidas.
 * Previene ataques de confusión de prefijos (p. ej. https://sebastiang.app.attacker.com
 * o https://sebastiang.app-phishing.com que burlan validaciones con startsWith).
 */
object DomainValidator {

    private val ALLOWED_HOSTS = setOf(
        "sebastiang.app",
        "www.sebastiang.app"
    )

    fun isAllowedUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        return try {
            val uri = Uri.parse(url.trim())

            // 1. Debe ser HTTPS estricto
            val scheme = uri.scheme
            if (!"https".equals(scheme, ignoreCase = true)) {
                return false
            }

            // 2. Prevenir credenciales embebidas (ej. user:pass@host)
            if (!uri.userInfo.isNullOrBlank()) {
                return false
            }

            // 3. Puerto estándar HTTPS (443) o sin puerto explícito
            val port = uri.port
            if (port != -1 && port != 443) {
                return false
            }

            // 4. Host coincidencia exacta (en minúsculas) contra lista blanca
            val host = uri.host?.lowercase() ?: return false
            ALLOWED_HOSTS.contains(host)
        } catch (_: Exception) {
            false
        }
    }
}
