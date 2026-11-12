#!/usr/bin/env node
/**
 * Generador de Token de Emergencia para Reseteo de Contraseña Administrativa
 * Genera un token criptográficamente seguro de 256 bits (32 bytes en formato hex).
 * 
 * Uso:
 *   node scripts/generate-emergency-token.mjs
 */

import crypto from 'crypto';

const token = crypto.randomBytes(32).toString('hex');

console.log('='.repeat(70));
console.log('🔑 TOKEN CRIPTOGRÁFICO DE EMERGENCIA (ONE-SHOT BREAK-GLASS)');
console.log('='.repeat(70));
console.log(`\nToken generado (256 bits / 64 caracteres):\n\n  ${token}\n`);
console.log('Instrucciones de activación:');
console.log('1. Entra a tu dashboard de Vercel → Settings → Environment Variables.');
console.log('2. Registra o actualiza la variable de entorno:');
console.log('   Nombre:      ADMIN_EMERGENCY_RESET_TOKEN');
console.log(`   Valor:       ${token}`);
console.log('   Ambiente:    Production only');
console.log('3. Redeploya tu aplicación en Vercel.');
console.log('4. Ejecuta el reseteo de emergencia vía cURL o Postman:');
console.log('   curl -X POST https://sebastiang.app/api/admin/password/emergency-reset \\');
console.log('     -H "Content-Type: application/json" \\');
console.log(`     -d '{"token":"${token}","newPassword":"TuNuevaContraseñaSegura2026"}'`);
console.log('='.repeat(70));
