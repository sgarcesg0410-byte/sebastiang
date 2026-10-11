#!/usr/bin/env node
// ==============================================================================
// Genera el hash scrypt del PIN de administrador para ADMIN_PIN_SCRYPT
// ==============================================================================
// Uso:  node scripts/hash-admin-pin.mjs "TU_PIN_NUEVO"
// Copia la salida a la variable de entorno ADMIN_PIN_SCRYPT (Vercel y .env).
// ==============================================================================

import crypto from 'crypto';

const pin = String(process.argv[2] || '').trim();
if (pin.length < 8) {
  console.error('Uso: node scripts/hash-admin-pin.mjs "PIN de 8 o mas caracteres"');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(pin, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
console.log('ADMIN_PIN_SCRYPT=scrypt$' + salt.toString('hex') + '$' + hash.toString('hex'));