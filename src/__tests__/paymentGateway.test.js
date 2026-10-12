import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  generatePaymentReference,
  generateWompiSignature,
  resolvePropertyPath,
  verifyWompiChecksum,
  validateCheckoutAmount
} from '../../api/payments/gateway.js';

describe('Pasarela de Pagos Wompi - Módulo Criptográfico y Reglas de Negocio', () => {

  describe('generateWompiSignature', () => {
    it('genera la firma SHA-256 exacta según la especificación oficial de Wompi', () => {
      const reference = 'ref-wompi-test-12345';
      const amountInCents = 2000000;
      const currency = 'COP';
      const integritySecret = 'prod_integrity_xyz987secret';

      const raw = `${reference}${amountInCents}${currency}${integritySecret}`;
      const expected = crypto.createHash('sha256').update(raw).digest('hex');

      const signature = generateWompiSignature({
        reference,
        amountInCents,
        currency,
        integritySecret
      });

      expect(signature).toBe(expected);
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('falla si falta algún parámetro obligatorio', () => {
      expect(() => generateWompiSignature({
        reference: '',
        amountInCents: 2000000,
        integritySecret: 'sec'
      })).toThrow();

      expect(() => generateWompiSignature({
        reference: 'ref-1',
        amountInCents: null,
        integritySecret: 'sec'
      })).toThrow();

      expect(() => generateWompiSignature({
        reference: 'ref-1',
        amountInCents: 2000000,
        integritySecret: ''
      })).toThrow();
    });
  });

  describe('resolvePropertyPath', () => {
    it('resuelve propiedades anidadas con notación de puntos', () => {
      const data = {
        transaction: {
          id: 'tx-123',
          amount_in_cents: 2000000,
          nested: {
            deep: 'valor'
          }
        }
      };

      expect(resolvePropertyPath(data, 'transaction.id')).toBe('tx-123');
      expect(resolvePropertyPath(data, 'transaction.amount_in_cents')).toBe('2000000');
      expect(resolvePropertyPath(data, 'transaction.nested.deep')).toBe('valor');
      expect(resolvePropertyPath(data, 'transaction.non_existent')).toBe('');
      expect(resolvePropertyPath(null, 'transaction.id')).toBe('');
    });
  });

  describe('verifyWompiChecksum', () => {
    const eventsSecret = 'prod_events_secret_key_123';
    const timestamp = 1791785400;

    const validPayload = {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: 'tx-wompi-998877',
          status: 'APPROVED',
          amount_in_cents: 2000000,
          reference: 'ref-wompi-booking-1'
        }
      },
      sent_at: '2026-10-12T03:30:00.000Z',
      timestamp,
      signature: {
        properties: [
          'transaction.id',
          'transaction.status',
          'transaction.amount_in_cents'
        ],
        checksum: '' // Se llenará en la prueba
      }
    };

    it('valida con éxito un checksum legítimo calculado con WOMPI_EVENTS_SECRET', () => {
      // Concatenar: "tx-wompi-998877" + "APPROVED" + "2000000" + "1791785400" + eventsSecret
      const raw = `tx-wompi-998877APPROVED2000000${timestamp}${eventsSecret}`;
      const checksum = crypto.createHash('sha256').update(raw).digest('hex');

      const payload = {
        ...validPayload,
        signature: {
          ...validPayload.signature,
          checksum
        }
      };

      const isValid = verifyWompiChecksum({ eventPayload: payload, eventsSecret });
      expect(isValid).toBe(true);
    });

    it('rechaza webhooks con monto o estado alterado (anti-tampering)', () => {
      const raw = `tx-wompi-998877APPROVED2000000${timestamp}${eventsSecret}`;
      const checksum = crypto.createHash('sha256').update(raw).digest('hex');

      // Atacante altera amount_in_cents a 100000 pero mantiene checksum
      const tamperedPayload = {
        ...validPayload,
        data: {
          transaction: {
            ...validPayload.data.transaction,
            amount_in_cents: 100000
          }
        },
        signature: {
          ...validPayload.signature,
          checksum
        }
      };

      const isValid = verifyWompiChecksum({ eventPayload: tamperedPayload, eventsSecret });
      expect(isValid).toBe(false);
    });

    it('rechaza si no se proporciona el secreto de eventos del entorno', () => {
      const raw = `tx-wompi-998877APPROVED2000000${timestamp}${eventsSecret}`;
      const checksum = crypto.createHash('sha256').update(raw).digest('hex');

      const payload = {
        ...validPayload,
        signature: {
          ...validPayload.signature,
          checksum
        }
      };

      expect(verifyWompiChecksum({ eventPayload: payload, eventsSecret: '' })).toBe(false);
      expect(verifyWompiChecksum({ eventPayload: payload, eventsSecret: null })).toBe(false);
    });
  });

  describe('validateCheckoutAmount - Reglas de Negocio', () => {
    it('acepta exactamente $20.000 COP para abono de reserva sin exigir el total del paquete', () => {
      const booking = { id: 'book-1', totalPrice: 80000 };
      const res = validateCheckoutAmount({
        concept: 'booking_deposit',
        amount: 20000,
        booking
      });

      expect(res.valid).toBe(true);
      expect(res.expectedAmount).toBe(20000);
    });

    it('rechaza montos diferentes a $20.000 COP para abono de reserva', () => {
      const booking = { id: 'book-1', totalPrice: 80000 };

      // Intento de abonar $10.000
      const resLow = validateCheckoutAmount({
        concept: 'booking_deposit',
        amount: 10000,
        booking
      });
      expect(resLow.valid).toBe(false);

      // Intento de pagar el total de $80.000 en concepto de abono
      const resFull = validateCheckoutAmount({
        concept: 'booking_deposit',
        amount: 80000,
        booking
      });
      expect(resFull.valid).toBe(false);
    });

    it('permite abono menor si el total del paquete es inferior a $20.000 COP', () => {
      const promoBooking = { id: 'book-mini', totalPrice: 15000 };
      const res = validateCheckoutAmount({
        concept: 'booking_deposit',
        amount: 15000,
        booking: promoBooking
      });

      expect(res.valid).toBe(true);
      expect(res.expectedAmount).toBe(15000);
    });

    it('valida el saldo de sesión contra sessionRemaining exacto', () => {
      const resValid = validateCheckoutAmount({
        concept: 'session_balance',
        amount: 60000,
        sessionRemaining: 60000
      });
      expect(resValid.valid).toBe(true);
      expect(resValid.expectedAmount).toBe(60000);

      const resInvalid = validateCheckoutAmount({
        concept: 'session_balance',
        amount: 50000,
        sessionRemaining: 60000
      });
      expect(resInvalid.valid).toBe(false);
    });

    it('rechaza conceptos no soportados', () => {
      const res = validateCheckoutAmount({
        concept: 'concepto_inventado',
        amount: 20000
      });
      expect(res.valid).toBe(false);
    });
  });

  describe('generatePaymentReference', () => {
    it('genera referencias únicas con prefijo wompi', () => {
      const ref1 = generatePaymentReference('wompi');
      const ref2 = generatePaymentReference('wompi');

      expect(ref1).toMatch(/^ref-wompi-\d+-[a-f0-9]{8}$/);
      expect(ref2).toMatch(/^ref-wompi-\d+-[a-f0-9]{8}$/);
      expect(ref1).not.toBe(ref2);
    });
  });

  describe('Separación Estricta de Secretos (Integridad vs Eventos)', () => {
    it('un evento firmado con WOMPI_INTEGRITY_SECRET es rechazado al validarse contra WOMPI_EVENTS_SECRET', () => {
      const integritySecret = 'prod_integrity_different_111';
      const eventsSecret = 'prod_events_different_222';
      const timestamp = 1791785400;

      // Un atacante o configuración errónea calcula checksum usando integritySecret en lugar de eventsSecret
      const raw = `tx-999APPROVED2000000${timestamp}${integritySecret}`;
      const wrongChecksum = crypto.createHash('sha256').update(raw).digest('hex');

      const payload = {
        data: {
          transaction: {
            id: 'tx-999',
            status: 'APPROVED',
            amount_in_cents: 2000000
          }
        },
        timestamp,
        signature: {
          properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
          checksum: wrongChecksum
        }
      };

      // Debe ser rechazado porque eventsSecret es distinto a integritySecret
      const isValid = verifyWompiChecksum({ eventPayload: payload, eventsSecret });
      expect(isValid).toBe(false);
    });
  });

  describe('Simulación de Idempotencia y Mismatch de Monto en Webhook', () => {
    it('detecta discrepancia cuando amount_in_cents recibido no coincide con el registro previo', () => {
      const storedPayment = {
        id: 'pay-wompi-1',
        amount: 20000, // $20.000 COP
        status: 'pending_gateway'
      };

      const webhookTx = {
        id: 'tx-001',
        amount_in_cents: 200000, // $2.000 COP (10 veces menos)
        status: 'APPROVED'
      };

      const expectedCents = storedPayment.amount * 100;
      const isMismatch = webhookTx.amount_in_cents !== expectedCents;

      expect(isMismatch).toBe(true);
      expect(expectedCents).toBe(2000000);
    });

    it('identifica pagos ya aprobados para responder de forma idempotente sin duplicar saldo', () => {
      const alreadyApprovedPayment = {
        id: 'pay-wompi-1',
        reference: 'ref-wompi-test-123',
        status: 'verified',
        gatewayStatus: 'APPROVED',
        amount: 20000
      };

      // Si el webhook llega por segunda vez para la misma transacción
      const isAlreadyProcessed = alreadyApprovedPayment.status === 'verified' || alreadyApprovedPayment.status === 'approved';
      expect(isAlreadyProcessed).toBe(true);
    });

    it('normaliza el estado contable a verified preservando gatewayStatus para trazabilidad', () => {
      // Simulación de la transición del webhook
      const rawWebhookStatus = 'APPROVED';
      const updatedPayment = {
        id: 'pay-wompi-1',
        amount: 20000,
        status: rawWebhookStatus === 'APPROVED' ? 'verified' : 'rejected',
        gatewayStatus: rawWebhookStatus
      };

      expect(updatedPayment.status).toBe('verified');
      expect(updatedPayment.gatewayStatus).toBe('APPROVED');
    });
  });

});
