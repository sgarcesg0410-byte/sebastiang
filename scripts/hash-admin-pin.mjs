#!/usr/bin/env node
// ==============================================================================
// Genera el hash scrypt de la contraseña de administrador para ADMIN_PIN_SCRYPT
// ==============================================================================
// Uso con argumento:  node scripts/hash-admin-pin.mjs "TU_CLAVE_NUEVA"
// Uso interactivo:    node scripts/hash-admin-pin.mjs
// ==============================================================================

import crypto from 'crypto';
import readline from 'readline';

function generateHash(password) {
  const cleanPass = String(password || '').trim();
  if (cleanPass.length < 8) {
    console.error('\n❌ Error: La contraseña debe tener al menos 8 caracteres para máxima seguridad.\n');
    process.exit(1);
  }

  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(cleanPass, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const scryptValue = 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');

  console.log('\n================================================================================');
  console.log('🔐 HASH CRIPTOGRÁFICO GENERADO CON ÉXITO (Algoritmo scrypt)');
  console.log('================================================================================');
  console.log('\n1. Para Vercel (Environment Variables):');
  console.log('   Nombre (Key):   ADMIN_PIN_SCRYPT');
  console.log('   Valor (Value):  ' + scryptValue);
  console.log('\n2. Para archivo .env local (opcional):');
  console.log('   ADMIN_PIN_SCRYPT=' + scryptValue);
  console.log('\n================================================================================');
  console.log('✅ Guarda tu contraseña en un lugar seguro (gestor de claves, notas privadas).');
  console.log('================================================================================\n');
}

const argPassword = process.argv[2];

if (argPassword) {
  generateHash(argPassword);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Escribe tu nueva contraseña de administrador (mínimo 8 caracteres): ', (answer) => {
    rl.close();
    generateHash(answer);
  });
}