import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  hashStringSHA256,
  secureCompare,
  generateSessionToken,
  validateSessionToken,
  DEFAULT_PIN_HASH
} from '../services/auth/adminSecurity';
import {
  getTrustedClientIp,
  normalizeAndValidateIp,
  resolveAdminAuthKeyring
} from '../../api/security.js';

describe('Seguridad y Criptografía de Administrador', () => {
  it('debe calcular hash SHA-256 consistente y mantener DEFAULT_PIN_HASH vacío (sin PIN 0493 por defecto)', async () => {
    const hash = await hashStringSHA256('0493');
    expect(hash).toBe('5eb11bf58cb9eb8ad63d3dcac1e264ecda98bd97d56b4d16ea19b73d0d7584c3');
    expect(DEFAULT_PIN_HASH).toBe('');
  });

  it('debe generar hashes de 64 caracteres hexadecimales únicos para diferentes entradas', async () => {
    const hash1 = await hashStringSHA256('clave123');
    const hash2 = await hashStringSHA256('clave456');

    expect(hash1).toHaveLength(64);
    expect(hash2).toHaveLength(64);
    expect(hash1).not.toBe(hash2);
  });

  it('debe manejar entradas vacías de forma segura', async () => {
    const emptyHash = await hashStringSHA256('');
    expect(emptyHash).toBe('');

    const nullHash = await hashStringSHA256(null);
    expect(nullHash).toBe('');
  });

  it('debe comparar cadenas en tiempo constante con secureCompare', () => {
    expect(secureCompare('secreto', 'secreto')).toBe(true);
    expect(secureCompare('secreto', 'invalido')).toBe(false);
    expect(secureCompare('secreto', 'secreto1')).toBe(false);
    expect(secureCompare(null, 'secreto')).toBe(false);
    expect(secureCompare('', '')).toBe(true);
  });

  it('debe generar y validar tokens de sesión correctamente', () => {
    const token = generateSessionToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);

    const validation = validateSessionToken(token);
    expect(validation.valid).toBe(true);
    expect(validation.payload).toHaveProperty('exp');
    expect(validation.payload.exp).toBeGreaterThan(Date.now());
  });

  it('debe rechazar tokens corruptos o inválidos', () => {
    const invalid = validateSessionToken('token-invalido-o-corrupto');
    expect(invalid.valid).toBe(false);
  });

  it('SAST Gate Automatizado: ningún archivo de api/, onesignal.js ni db.json contiene PII, UUID de OneSignal o hashes débiles hardcodeados, y CI integra CodeQL', () => {
    const forbiddenLiterals = [
      'sgarcesg0410',
      '3244725167',
      '3023696513',
      'bc62cb00-9782-4a8e-a344-e8cf031a211a',
      '5eb11bf58cb9eb8ad63d3dcac1e264ecda98bd97d56b4d16ea19b73d0d7584c3',
      '0493',
      'DEV_EPHEMERAL_SECRET'
    ];

    function collectJsFiles(dir) {
      const results = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...collectJsFiles(fullPath));
        } else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const filesToScan = [
      ...collectJsFiles(path.join(process.cwd(), 'api')),
      path.join(process.cwd(), 'src/services/onesignal.js'),
      path.join(process.cwd(), 'server/data/db.json')
    ];

    for (const filePath of filesToScan) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const literal of forbiddenLiterals) {
        expect(content, `Regresión SAST en ${path.relative(process.cwd(), filePath)}: contiene "${literal}"`).not.toContain(literal);
      }
    }

    const ciWorkflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    expect(ciWorkflow).toContain('github/codeql-action/init@f1f6e5f6af878fb37dc8fa8febc4bd5f4ed0b7a7');
    expect(ciWorkflow).toContain('github/codeql-action/analyze@f1f6e5f6af878fb37dc8fa8febc4bd5f4ed0b7a7');

    const envExample = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');
    expect(envExample).toContain('node scripts/hash-admin-pin.mjs');
  });

  it('getTrustedClientIp y normalizeAndValidateIp validan formato IPv4/IPv6 con net.isIP() y descartan cabeceras con basura', () => {
    expect(normalizeAndValidateIp('203.0.113.45')).toBe('203.0.113.45');
    expect(normalizeAndValidateIp('::ffff:198.51.100.12')).toBe('198.51.100.12');
    expect(normalizeAndValidateIp('192.0.2.88:54321')).toBe('192.0.2.88');
    expect(normalizeAndValidateIp('2001:db8::1')).toBe('2001:db8::1');
    expect(normalizeAndValidateIp('[2001:db8::1]:443')).toBe('2001:db8::1');
    expect(normalizeAndValidateIp('<script>alert(1)</script>')).toBeNull();
    expect(normalizeAndValidateIp('basura-maliciosa-log-injection\nFAKE')).toBeNull();
    expect(normalizeAndValidateIp('999.999.999.999')).toBeNull();

    const prevVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = '1';
      const poisonedReq = {
        headers: { 'x-vercel-forwarded-for': '<basura-inyectada-en-header>' },
        socket: { remoteAddress: '::ffff:127.0.0.1' }
      };
      expect(getTrustedClientIp(poisonedReq)).toBe('127.0.0.1');

      const validVercelReq = {
        headers: { 'x-vercel-forwarded-for': '181.50.100.25, 10.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' }
      };
      expect(getTrustedClientIp(validVercelReq)).toBe('181.50.100.25');
    } finally {
      if (prevVercel !== undefined) process.env.VERCEL = prevVercel;
      else delete process.env.VERCEL;
    }
  });

  it('resolveAdminAuthKeyring bloquea el fallback de test si VERCEL o CI_PRODUCTION están activos', () => {
    const prevSecret = process.env.ADMIN_AUTH_SECRET;
    const prevVercel = process.env.VERCEL;
    try {
      delete process.env.ADMIN_AUTH_SECRET;
      process.env.VERCEL = '1';
      const { ring } = resolveAdminAuthKeyring();
      expect(Object.keys(ring)).toHaveLength(0);
    } finally {
      if (prevSecret !== undefined) process.env.ADMIN_AUTH_SECRET = prevSecret;
      if (prevVercel !== undefined) process.env.VERCEL = prevVercel;
      else delete process.env.VERCEL;
    }
  });
});
