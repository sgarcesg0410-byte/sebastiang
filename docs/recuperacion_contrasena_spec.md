# Recuperación de contraseña de administrador — Especificación de implementación

> Esta función fue la puerta trasera del proyecto: el antiguo `POST /api/admin/pin/recover`
> permitía fijar o leer el PIN con solo conocer un WhatsApp público. **Todo lo que se
> implemente aquí debe respetar las 6 reglas de este documento sin excepciones.**
>
> Estado: **especificación cerrada, implementada en MongoDB Atlas.**
> Requisito previo: `ADMIN_EMAIL` definida en Vercel (por defecto `reservas@sebastiang.app`).

---

## 1. Endpoints

### 1.1 `POST /api/admin/password/reset-request` (público)

| Aspecto | Definición |
|---|---|
| Autenticación | **Ninguna** (el usuario ha olvidado la clave). Fuera del middleware de admin. |
| Rate limit | **3 solicitudes / 15 min por IP** (reutilizar `getClientIp` + un limitador propio) |
| Body | `{}` — se **ignora por completo** cualquier campo, en especial `email` |
| Destinatario | **Solo del servidor**: `process.env.ADMIN_EMAIL \|\| 'reservas@sebastiang.app'` |
| Respuesta | **Siempre** `{ success: true, message: 'Si el correo corresponde al administrador, se envió un código.' }` |
| Prohibido | Devolver el código, registrarlo en logs, o incluir el destinatario en la respuesta |

Pasos, en este orden:
1. Generar el código: `crypto.randomInt(100000, 999999)` — **nunca `Math.random()`**.
2. Calcular `codeHash = sha256(code)`.
3. Guardar/actualizar en **MongoDB Atlas** dentro de la colección dedicada `security` el documento `id = 'admin_reset_challenge'`:

```json
{
  "id": "admin_reset_challenge",
  "key": "admin_reset_challenge",
  "codeHash": "<sha256 hex>",
  "expiresAt": "<ISO, ahora + 10 minutos>",
  "used": false,
  "attempts": 0,
  "requestedAt": "<ISO>"
}
```

La colección `security` está excluida de cualquier endpoint público y de `/api/admin/db` (`DB_ALLOWED_TABLES`), garantizando que ni el reto ni el hash del PIN administrativo sean legibles ni modificables fuera de los módulos de seguridad del servidor.

4. Enviar el correo real con el transporte Zoho ya existente (`sendPasswordResetCodeEmail` en `api/emailService.js`).
5. Responder el mensaje genérico.

### 1.2 `POST /api/admin/password/reset-confirm` (público)

| Aspecto | Definición |
|---|---|
| Rate limit | **5 intentos / 15 min por IP** (respaldado en la colección `rate_limits` de MongoDB Atlas) |
| Body | `{ code, newPassword }` — `newPassword` mínimo **8 caracteres** |
| Mensaje de error | Genérico siempre: `'Código inválido o expirado.'` |

Validaciones, **en este orden**, todas antes de tocar la contraseña:
1. El documento existe en `security` y `used === false`.
2. `Date.now() < new Date(expiresAt).getTime()`.
3. `attempts < 5`.
4. `secureCompare(sha256(code), codeHash)` — **comparación en tiempo constante** (`api/security.js` exporta `secureCompare` y `hashSHA256`).

Comportamiento ante fallo:
- Incrementar `attempts`. Si llega a **5**, marcar `used: true` (el código queda quemado: 6 dígitos = 10⁶ combinaciones, con 5 intentos es inalcanzable).

Comportamiento ante éxito (todo o nada):
1. Marcar `used: true`.
2. Escribir la nueva clave en la colección `security` de MongoDB Atlas (`id = 'system_admin_pin_hash'`):
   ```json
   {
     "id": "system_admin_pin_hash",
     "key": "admin_pin_hash",
     "scryptHash": "scrypt$<sal>$<hash>",
     "passwordVersion": "<actual + 1>",
     "updatedAt": "<ISO>"
   }
   ```
3. Enviar correo de aviso a `ADMIN_EMAIL`: *"Tu contraseña de administrador fue cambiada."*
4. Responder `{ success: true }`.

### 1.3 Ajuste en `POST /api/admin/auth`

- Lee `passwordVersion` del documento `system_admin_pin_hash` en la colección `security` de MongoDB Atlas (por defecto `1` si no existe).
- Incluye `pwd: <passwordVersion>` en el payload del token (`createAdminToken({ pwd })`).

---

## 2. ⚠️ `passwordVersion`: revocación global inmediata de sesiones

Revocar sesiones activas al cambiar la clave **exige consultar la versión en cada petición autenticada**.

| Opción | Cómo | Coste | Seguridad |
|---|---|---|---|
| **A (implementada)** | `requireAdminAuth` lee `passwordVersion` de la colección `security` en MongoDB Atlas y la compara con el `pwd` del token | Una lectura ligera por petición admin | Revocación global inmediata en todos los dispositivos |
| **B** | No validar versión en servidor | Cero | Un token robado seguiría vivo hasta su expiración |
| **C** | Guardar `revokedBefore` y comparar con `iat` | Misma lectura en MongoDB Atlas | Equivalente a A |

**Implementación activa: Opción A**, porque garantiza que al cambiar la contraseña todas las sesiones previas (`admin_access`, `bio_refresh` y `apk_device`) queden invalidadas de forma instantánea.

> Regla de seguridad en producción: si la lectura en MongoDB Atlas falla, **fallar cerrado** (401), con un mensaje claro (`Error de verificación de sesión (servicio de autenticación no disponible)`) que distingue una caída de red de una sesión revocada.

---

## 3. Tests exigidos (definen el contrato)

Archivo: `src/__tests__/passwordReset.test.js`.

| # | Caso | Aserción |
|---|---|---|
| 1 | **Inyección de email** ← *el test más importante* | `reset-request` con `{ email: 'atacante@evil.com' }` → el transporte recibe **`ADMIN_EMAIL`**, no el correo del atacante |
| 2 | Expiración | Código correcto con `expiresAt` en el pasado → rechazado y no cambia la clave |
| 3 | Reuso | Confirmar dos veces con el mismo código → la segunda rechazada |
| 4 | Fuerza bruta | 5 intentos fallidos → el 6.º rechazado **aunque el código sea correcto** |
| 5 | Fuga cero | La respuesta HTTP y los logs **no contienen** el código de 6 dígitos |
| 6 | Contraseña corta | `newPassword` de 7 caracteres → rechazado sin consumir el código |

---

## 4. Frontend (`AdminPanel.jsx`, pantalla de acceso)

Estados del flujo, sin revelar nunca si el correo existe:
1. Enlace **"¿Olvidaste tu contraseña?"** bajo el campo de acceso.
2. Estado 1: texto genérico + botón *"Enviar código a mi correo"*.
3. Estado 2: input de **6 dígitos** + nueva contraseña + confirmación → *"Cambiar contraseña"*.
4. Éxito: mensaje *"Contraseña actualizada. Inicia sesión con la nueva."* y volver al login.

---

## 5. Verificación antes de dar por buena la función

```bash
npm run check:syntax     # los 11 módulos del backend
npm test                 # 62 actuales + los 6 nuevos
npm run build
```

Y en vivo, una vez desplegado:
1. Pedir el código y **recibir el correo real** en `ADMIN_EMAIL`.
2. Código caducado → rechazado.
3. Código reusado → rechazado.
4. Sexto intento → bloqueado.
5. **Con `{ email: "otro@correo.com" }` en la petición → el correo sale igualmente a `ADMIN_EMAIL`.**
6. Si se eligió la opción A: iniciar sesión en dos dispositivos, cambiar la clave en uno y comprobar que **el otro queda fuera**.

---

## 6. Red de seguridad de emergencia (Break-Glass)

Si se olvida la contraseña y no se tiene acceso temporal al correo, la recuperación raíz (no depende de recordar nada) es:

> Vercel → `node scripts/hash-admin-pin.mjs "NuevaClaveSegura"` → reemplazar `ADMIN_PIN_SCRYPT` → eliminar o actualizar el documento `system_admin_pin_hash` en la colección `security` de MongoDB Atlas → redesplegar.
