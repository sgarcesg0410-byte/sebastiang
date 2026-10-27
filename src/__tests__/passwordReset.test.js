import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  handlePasswordResetRequest,
  handlePasswordResetConfirm,
  clearRateLimiters,
  getAdminEmail
} from '../../api/passwordReset.js';
import {
  createAdminToken,
  verifyAdminToken,
  requireAdminAuth,
  setCachedPasswordVersion,
  getCachedPasswordVersion,
  setPasswordVersionGetter
} from '../../api/security.js';

describe('Recuperación Segura de Contraseña de Administrador (Zoho SMTP)', () => {
  let mockRuntimeDB;

  beforeEach(() => {
    clearRateLimiters();
    setCachedPasswordVersion(1);
    setPasswordVersionGetter(null);
    mockRuntimeDB = {
      settings: {
        adminPinScrypt: 'scrypt$dummy$hash',
        adminPasswordVersion: 1
      }
    };
    process.env.ADMIN_EMAIL = 'sgarcesg0410@gmail.com';
    process.env.TRUST_PROXY = 'true';
  });

  // --------------------------------------------------------------------------
  // TEST 1: Inyección de Email (Invariante 1)
  // --------------------------------------------------------------------------
  it('1. Inyección de email: el endpoint debe ignorar req.body.email y enviar ÚNICAMENTE a ADMIN_EMAIL', async () => {
    let capturedRecipient = null;
    let capturedCode = null;

    const mockEmailSender = vi.fn(async (code, targetEmail) => {
      capturedCode = code;
      capturedRecipient = targetEmail;
      return true;
    });

    const req = {
      headers: { 'x-forwarded-for': '203.0.113.195' },
      body: {
        email: 'atacante@evil.com',
        target: 'hacker@malicious.org'
      }
    };

    let responseData = null;
    let responseStatus = 200;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; }
    };

    await handlePasswordResetRequest(req, res, {
      runtimeDB: mockRuntimeDB,
      emailSender: mockEmailSender
    });

    expect(responseStatus).toBe(200);
    expect(responseData.success).toBe(true);
    expect(mockEmailSender).toHaveBeenCalledTimes(1);

    // Verificación crítica: el destinatario es el ADMIN_EMAIL del servidor, NO el del atacante
    expect(capturedRecipient).toBe('sgarcesg0410@gmail.com');
    expect(capturedRecipient).not.toBe('atacante@evil.com');
    expect(capturedRecipient).not.toBe('hacker@malicious.org');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Expiración de código (10 minutos)
  // --------------------------------------------------------------------------
  it('2. Expiración: un código con fecha expirada en el pasado debe ser rechazado y no cambiar la clave', async () => {
    const expiredChallenge = {
      codeHash: crypto.createHash('sha256').update('123456').digest('hex'),
      expiresAt: new Date(Date.now() - 60 * 1000).toISOString(), // Expirado hace 1 minuto
      used: false,
      attempts: 0,
      requestedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString()
    };
    mockRuntimeDB.settings.adminResetChallenge = expiredChallenge;

    const req = {
      headers: { 'x-forwarded-for': '203.0.113.50' },
      body: {
        code: '123456',
        newPassword: 'NuevaClaveValida2026'
      }
    };

    let responseStatus = 200;
    let responseData = null;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; }
    };

    await handlePasswordResetConfirm(req, res, {
      runtimeDB: mockRuntimeDB
    });

    expect(responseStatus).toBe(400);
    expect(responseData.error).toBe('Código inválido o expirado.');
    // La clave no debió cambiar
    expect(mockRuntimeDB.settings.adminPinScrypt).toBe('scrypt$dummy$hash');
    expect(mockRuntimeDB.settings.adminPasswordVersion).toBe(1);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Reuso de código (Un solo uso)
  // --------------------------------------------------------------------------
  it('3. Reuso: intentar confirmar dos veces con el mismo código debe rechazar el segundo intento', async () => {
    let sentCode = null;
    const mockEmailSender = vi.fn(async (code) => {
      sentCode = code;
      return true;
    });

    // 1. Solicitud inicial
    const reqReq = {
      headers: { 'x-forwarded-for': '198.51.100.1' },
      body: {}
    };
    const resReq = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    await handlePasswordResetRequest(reqReq, resReq, {
      runtimeDB: mockRuntimeDB,
      emailSender: mockEmailSender
    });
    expect(sentCode).toBeDefined();

    // 2. Primera confirmación (debe ser exitosa)
    const reqConf1 = {
      headers: { 'x-forwarded-for': '198.51.100.1' },
      body: { code: sentCode, newPassword: 'MiClaveSegura123' }
    };
    let status1 = 200, data1 = null;
    const resConf1 = {
      status(c) { status1 = c; return this; },
      json(d) { data1 = d; return this; }
    };
    await handlePasswordResetConfirm(reqConf1, resConf1, {
      runtimeDB: mockRuntimeDB,
      alertSender: vi.fn()
    });
    expect(status1).toBe(200);
    expect(data1.success).toBe(true);

    // 3. Segunda confirmación con el mismo código (debe fallar)
    const reqConf2 = {
      headers: { 'x-forwarded-for': '198.51.100.1' },
      body: { code: sentCode, newPassword: 'OtraClaveSegura456' }
    };
    let status2 = 200, data2 = null;
    const resConf2 = {
      status(c) { status2 = c; return this; },
      json(d) { data2 = d; return this; }
    };
    await handlePasswordResetConfirm(reqConf2, resConf2, {
      runtimeDB: mockRuntimeDB,
      alertSender: vi.fn()
    });
    expect(status2).toBe(400);
    expect(data2.error).toBe('Código inválido o expirado.');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Anti-fuerza bruta y quema tras 5 intentos fallidos
  // --------------------------------------------------------------------------
  it('4. Fuerza bruta: tras 5 intentos erróneos el código queda quemado y el 6.º es rechazado aunque sea el correcto', async () => {
    let sentCode = null;
    const mockEmailSender = vi.fn(async (code) => {
      sentCode = code;
      return true;
    });

    await handlePasswordResetRequest(
      { headers: { 'x-forwarded-for': '10.0.0.1' }, body: {} },
      { status: vi.fn().mockReturnThis(), json: vi.fn() },
      { runtimeDB: mockRuntimeDB, emailSender: mockEmailSender }
    );

    // Realizar 5 intentos con código incorrecto desde diferentes IPs
    for (let i = 1; i <= 5; i++) {
      let status = 200;
      await handlePasswordResetConfirm(
        { headers: { 'x-forwarded-for': `10.0.0.${i + 10}` }, body: { code: '000000', newPassword: 'Password123' } },
        { status(c) { status = c; return this; }, json() { return this; } },
        { runtimeDB: mockRuntimeDB }
      );
      expect(status).toBe(400);
    }

    // El challenge debe estar marcado como used: true y attempts >= 5
    expect(mockRuntimeDB.settings.adminResetChallenge.attempts).toBe(5);
    expect(mockRuntimeDB.settings.adminResetChallenge.used).toBe(true);

    // 6.º intento: con el código EXACTO y correcto, debe ser rechazado
    let status6 = 200, data6 = null;
    await handlePasswordResetConfirm(
      { headers: { 'x-forwarded-for': '10.0.0.99' }, body: { code: sentCode, newPassword: 'Password123' } },
      { status(c) { status6 = c; return this; }, json(d) { data6 = d; return this; } },
      { runtimeDB: mockRuntimeDB }
    );
    expect(status6).toBe(400);
    expect(data6.error).toBe('Código inválido o expirado.');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Fuga cero (código NUNCA en respuesta HTTP ni en logs)
  // --------------------------------------------------------------------------
  it('5. Fuga cero: el código de 6 dígitos no debe aparecer en la respuesta HTTP ni en los logs', async () => {
    let sentCode = null;
    const mockEmailSender = vi.fn(async (code) => {
      sentCode = code;
      return true;
    });

    const consoleLogSpy = vi.spyOn(console, 'log');
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    const consoleErrorSpy = vi.spyOn(console, 'error');

    let responseData = null;
    await handlePasswordResetRequest(
      { headers: { 'x-forwarded-for': '192.168.1.1' }, body: {} },
      { status: vi.fn().mockReturnThis(), json(d) { responseData = d; return this; } },
      { runtimeDB: mockRuntimeDB, emailSender: mockEmailSender }
    );

    // 1. No debe figurar en la respuesta JSON
    const responseString = JSON.stringify(responseData);
    expect(responseString).not.toContain(sentCode);
    expect(responseData).toEqual({
      success: true,
      message: 'Si el correo corresponde al administrador, se envió un código.'
    });

    // 2. No debe aparecer en los logs
    const allLogs = [
      ...consoleLogSpy.mock.calls.flat(),
      ...consoleWarnSpy.mock.calls.flat(),
      ...consoleErrorSpy.mock.calls.flat()
    ].join(' ');
    expect(allLogs).not.toContain(sentCode);

    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // TEST 6: Contraseña corta (< 8 caracteres) rechazada sin quemar el código
  // --------------------------------------------------------------------------
  it('6. Contraseña corta: newPassword de 7 caracteres debe rechazarse sin consumir el código', async () => {
    let sentCode = null;
    await handlePasswordResetRequest(
      { headers: { 'x-forwarded-for': '10.10.10.1' }, body: {} },
      { status: vi.fn().mockReturnThis(), json: vi.fn() },
      { runtimeDB: mockRuntimeDB, emailSender: vi.fn(async (c) => { sentCode = c; return true; }) }
    );

    let status = 200, data = null;
    await handlePasswordResetConfirm(
      { headers: { 'x-forwarded-for': '10.10.10.1' }, body: { code: sentCode, newPassword: 'Corta12' } }, // 7 caracteres
      { status(c) { status = c; return this; }, json(d) { data = d; return this; } },
      { runtimeDB: mockRuntimeDB }
    );

    expect(status).toBe(400);
    expect(data.error).toContain('al menos 8 caracteres');
    // El challenge NO debe haber incrementado attempts ni haber sido quemado
    expect(mockRuntimeDB.settings.adminResetChallenge.attempts).toBe(0);
    expect(mockRuntimeDB.settings.adminResetChallenge.used).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Invalidación global de sesiones (passwordVersion)
  // --------------------------------------------------------------------------
  it('7. passwordVersion: un token emitido antes del reseteo debe quedar revocado tras el cambio de contraseña', async () => {
    process.env.ADMIN_AUTH_SECRET = 'super-secure-production-secret-min-32-chars-test';

    // 1. Emitir token en versión 1
    setCachedPasswordVersion(1);
    const tokenV1 = createAdminToken({ pwd: 1 });
    expect(verifyAdminToken(tokenV1)).not.toBeNull();

    // Simular middleware requireAdminAuth con getter de versión
    setPasswordVersionGetter(() => mockRuntimeDB.settings.adminPasswordVersion);

    let authPassed = false;
    let authErrorStatus = null;
    const req1 = { headers: { authorization: `Bearer ${tokenV1}` } };
    const res1 = {
      status(c) { authErrorStatus = c; return this; },
      json(d) { return this; }
    };
    await requireAdminAuth(req1, res1, () => { authPassed = true; });
    expect(authPassed).toBe(true);

    // 2. Realizar reseteo de contraseña exitoso (esto incrementa a versión 2)
    let sentCode = null;
    await handlePasswordResetRequest(
      { headers: { 'x-forwarded-for': '172.16.0.1' }, body: {} },
      { status: vi.fn().mockReturnThis(), json: vi.fn() },
      { runtimeDB: mockRuntimeDB, emailSender: vi.fn(async (c) => { sentCode = c; return true; }) }
    );

    await handlePasswordResetConfirm(
      { headers: { 'x-forwarded-for': '172.16.0.1' }, body: { code: sentCode, newPassword: 'SuperPasswordNueva2026' } },
      { status: vi.fn().mockReturnThis(), json: vi.fn() },
      { runtimeDB: mockRuntimeDB, alertSender: vi.fn() }
    );

    // La versión activa ahora es 2
    expect(mockRuntimeDB.settings.adminPasswordVersion).toBe(2);
    expect(getCachedPasswordVersion()).toBe(2);

    // 3. Probar el token antiguo (versión 1) en requireAdminAuth: DEBE SER RECHAZADO (401)
    authPassed = false;
    let authErrorResponse = null;
    const reqOld = { headers: { authorization: `Bearer ${tokenV1}` } };
    const resOld = {
      status(c) { authErrorStatus = c; return this; },
      json(d) { authErrorResponse = d; return this; }
    };
    await requireAdminAuth(reqOld, resOld, () => { authPassed = true; });

    expect(authPassed).toBe(false);
    expect(authErrorStatus).toBe(401);
    expect(authErrorResponse.error).toContain('Sesión revocada');

    // 4. Un nuevo token emitido con la versión 2 sí debe ser aceptado
    const tokenV2 = createAdminToken({ pwd: 2 });
    let authPassedV2 = false;
    await requireAdminAuth({ headers: { authorization: `Bearer ${tokenV2}` } }, resOld, () => { authPassedV2 = true; });
    expect(authPassedV2).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Anti-spam y Rate Limiter por IP
  // --------------------------------------------------------------------------
  it('8. Rate Limiting: máximo 3 solicitudes de reseteo cada 15 minutos por IP', async () => {
    const ip = '198.51.100.77';
    const mockEmailSender = vi.fn(async () => true);

    for (let i = 1; i <= 3; i++) {
      let status = 200;
      await handlePasswordResetRequest(
        { headers: { 'x-forwarded-for': ip }, body: {} },
        { status(c) { status = c; return this; }, json() { return this; } },
        { runtimeDB: mockRuntimeDB, emailSender: mockEmailSender }
      );
      expect(status).toBe(200);
    }

    // El 4.º intento en la misma ventana debe ser bloqueado con 429
    let status4 = 200, data4 = null;
    await handlePasswordResetRequest(
      { headers: { 'x-forwarded-for': ip }, body: {} },
      { status(c) { status4 = c; return this; }, json(d) { data4 = d; return this; } },
      { runtimeDB: mockRuntimeDB, emailSender: mockEmailSender }
    );

    expect(status4).toBe(429);
    expect(data4.error).toContain('Demasiadas solicitudes');
  });
});
