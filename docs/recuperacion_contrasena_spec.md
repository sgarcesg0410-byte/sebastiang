# Recuperación de contraseña de administrador — Especificación de implementación

> Esta función fue la puerta trasera del proyecto: el antiguo `POST /api/admin/pin/recover`
> permitía fijar o leer el PIN con solo conocer un WhatsApp público. **Todo lo que se
> implemente aquí debe respetar las 6 reglas de este documento sin excepciones.**
>
> Estado: **especificación cerrada, pendiente de implementar.**
> Requisito previo: `ADMIN_EMAIL` definida en Vercel (por defecto `sgarcesg0410@gmail.com`).

---

## 1. Endpoints

### 1.1 `POST /api/admin/password/reset-request` (público)

| Aspecto | Definición |
|---|---|
| Autenticación | **Ninguna** (el usuario ha olvidado la clave). Fuera del middleware de admin. |
| Rate limit | **3 solicitudes / 15 min por IP** (reutilizar `getClientIp` + un limitador propio) |
| Body | `{}` — se **ignora por completo** cualquier campo, en especial `email` |
| Destinatario | **Solo del servidor**: `process.env.ADMIN_EMAIL \|\| 'sgarcesg0410@gmail.com'` |
| Respuesta | **Siempre** `{ success: true, message: 'Si el correo corresponde al administrador, se envió un código.' }` |
| Prohibido | Devolver el código, registrarlo en logs, o incluir el destinatario en la respuesta |

Pasos, en este orden:
1. Generar el código: `crypto.randomInt(100000, 999999)` — **nunca `Math.random()`**.
2. Calcular `codeHash = sha256(code)`.
3. Guardar/actualizar en Supabase (con `service_role`) la fila `catalog` `id = 'system_admin_reset_challenge'`:

```json
{
  "codeHash": "<sha256 hex>",
  "expiresAt": "<ISO, ahora + 10 minutos>",
  "used": false,
  "attempts": 0,
  "requestedAt": "<ISO>"
}
```

La fila debe quedar en `category: 'security_data'` para que la política RLS la oculte al público (misma protección que `system_admin_pin_hash`, ya verificada: **ni legible ni escribible con la clave anónima**).

4. Enviar el correo real con el transporte Zoho ya existente (`sendTwoFactorCodeEmail` en `api/emailService.js`, o una plantilla nueva `sendPasswordResetEmail`).
5. Responder el mensaje genérico.

### 1.2 `POST /api/admin/password/reset-confirm` (público)

| Aspecto | Definición |
|---|---|
| Rate limit | **5 intentos / 15 min por IP** |
| Body | `{ code, newPassword }` — `newPassword` mínimo **8 caracteres** |
| Mensaje de error | Genérico siempre: `'Código inválido o expirado.'` |

Validaciones, **en este orden**, todas antes de tocar la contraseña:
1. La fila existe y `used === false`.
2. `Date.now() < new Date(expiresAt).getTime()`.
3. `attempts < 5`.
4. `secureCompare(sha256(code), codeHash)` — **comparación en tiempo constante** (`api/security.js` ya exporta `secureCompare` y `hashSHA256`).

Comportamiento ante fallo:
- Incrementar `attempts`. Si llega a **5**, marcar `used: true` (el código queda quemado: 6 dígitos = 10⁶ combinaciones, con 5 intentos es inalcanzable).

Comportamiento ante éxito (todo o nada):
1. Marcar `used: true`.
2. Escribir la nueva clave en `catalog` `id = 'system_admin_pin_hash'`:
   ```json
   { "hash": "scrypt$<sal>$<hash>", "passwordVersion": <actual + 1>, "updatedAt": "<ISO>" }
   ```
3. Enviar correo de aviso a `ADMIN_EMAIL`: *"Tu contraseña de administrador fue cambiada."*
4. Responder `{ success: true }`.

### 1.3 Ajuste en `POST /api/admin/auth`

- Lee `passwordVersion` de la fila del hash (por defecto `1` si no existe).
- Incluye `pwd: <passwordVersion>` en el payload del token (`createAdminToken({ pwd })`).

---

## 2. ⚠️ `passwordVersion`: la decisión que hay que tomar conscientemente

Revocar sesiones activas al cambiar la clave **exige consultar la versión en cada petición autenticada**. Hay tres opciones y ninguna es gratis:

| Opción | Cómo | Coste | Riesgo |
|---|---|---|---|
| **A** (recomendada) | `requireAdminAuth` lee `passwordVersion` de Supabase y la compara con el `pwd` del token | **Una lectura a Supabase por cada petición admin** | Modo de fallo nuevo: si Supabase no responde, el panel deja de funcionar |
| **B** | No implementar nada | Cero | Un token robado sigue vivo **hasta 12 h**; cambiar la clave no expulsa a nadie |
| **C** | Guardar `revokedBefore` y comparar con el `iat` del token | Misma lectura (o caché en memoria, no fiable en serverless) | Igual que A |

**Recomendación: A**, porque el objetivo declarado es *"si me roban la sesión, al cambiar la clave los echo"*. Pero hay que aceptar explícitamente el coste: **una consulta por petición** y que el panel dependa de que Supabase responda. Si se elige B, debe quedar escrito que cambiar la contraseña **no** cierra sesiones activas.

> Regla de seguridad al elegir A: si la lectura falla, **fallar cerrado** (401), pero con un mensaje que permita distinguir "sesión revocada" de "servicio no disponible", para no confundir un corte de Supabase con un token robado.

---

## 3. Tests exigidos (definen el contrato)

Archivo: `src/__tests__/passwordReset.test.js` (mockear el transporte de correo y Supabase).

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

## 6. Red de seguridad mientras esto no exista

Si se olvida la contraseña **hoy**, la recuperación raíz (no depende de recordar nada) es:

> Vercel → `node scripts/hash-admin-pin.mjs "NuevaClave"` → reemplazar `ADMIN_PIN_SCRYPT` → guardar y redesplegar.

Borrar la fila `system_admin_pin_hash` en Supabase activa el respaldo del entorno, pero **solo sirve si se conoce ese valor**. Por eso la vía de Vercel es la buena: siempre se puede sobrescribir con uno nuevo.
