import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashStringSHA256,
  secureCompare,
  generateSessionToken,
  validateSessionToken,
  DEFAULT_PIN_HASH
} from '../services/auth/adminSecurity';

describe('Seguridad y Criptografía de Administrador', () => {
  it('debe calcular hash SHA-256 consistente para el PIN por defecto (0493)', async () => {
    const hash = await hashStringSHA256('0493');
    expect(hash).toBe('5eb11bf58cb9eb8ad63d3dcac1e264ecda98bd97d56b4d16ea19b73d0d7584c3');
    expect(hash).toBe(DEFAULT_PIN_HASH);
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
});
