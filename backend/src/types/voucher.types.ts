import { z } from 'zod';

export const PaymentVoucherSchema = z.object({
  esComprobanteValido: z
    .boolean()
    .default(false)
    .describe('Indica si la imagen es un comprobante de pago legible y auténtico.'),
  es_comprobante_valido: z.boolean().optional(),
  banco: z
    .enum([
      'Yape',
      'Plin',
      'BCP',
      'BBVA',
      'Interbank',
      'Scotiabank',
      'Banco de la Nacion',
      'Otro',
      'Desconocido',
    ])
    .nullable()
    .optional()
    .default('Desconocido')
    .describe('Entidad financiera o billetera digital emisora del comprobante.'),
  monto: z
    .number()
    .nullable()
    .optional()
    .default(0)
    .describe('Monto numérico exacto de la transferencia o pago.'),
  moneda: z
    .enum(['PEN', 'USD'])
    .nullable()
    .optional()
    .default('PEN')
    .describe('Moneda de la transacción (PEN = Soles, USD = Dólares).'),
  numeroOperacion: z
    .string()
    .nullable()
    .optional()
    .default('')
    .describe('Número de operación, código de referencia o código de transacción.'),
  numero_operacion: z.string().nullable().optional(),
  fecha: z.string().nullable().optional(),
  fechaPago: z.string().nullable().optional(),
  titularOrigen: z.string().nullable().optional(),
  titularDestino: z.string().nullable().optional(),
  nivelConfianza: z
    .enum(['ALTA', 'MEDIA', 'BAJA'])
    .nullable()
    .optional()
    .default('BAJA')
    .describe('Nivel de certeza de la extracción.'),
  motivoRechazo: z.string().nullable().optional(),
  detalles: z.string().nullable().optional(),
});

export type PaymentVoucher = z.infer<typeof PaymentVoucherSchema>;
