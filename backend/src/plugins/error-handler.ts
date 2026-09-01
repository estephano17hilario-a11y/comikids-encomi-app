import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface StandardErrorResponse {
  success: false;
  code: 'AUTH_REQUIRED' | 'TIMEOUT' | 'AGENCY_INVALID' | 'SHALOM_UNAVAILABLE' | 'VALIDATION_ERROR' | 'SERVER_ERROR';
  message: string;
  details?: any;
}

export function unifiedErrorHandler(error: FastifyError | any, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);

  const errMessage = error?.message || 'Error interno del servidor';
  const errCode = error?.code || '';
  const axiosStatus = error?.response?.status;
  const upstreamData = error?.response?.data;

  // 1. Errores de Autenticación de Shalom
  if (
    axiosStatus === 401 ||
    axiosStatus === 403 ||
    errMessage.includes('shalom_login_unavailable') ||
    upstreamData?.error?.code === 'shalom_login_unavailable'
  ) {
    return reply.code(200).send({
      success: false,
      code: 'SHALOM_UNAVAILABLE',
      message: 'El servicio de inicio de sesión de Shalom Pro no está disponible temporalmente. Reintente en unos minutos o utilice exportación a Excel.',
      details: upstreamData?.error || errMessage,
    } as StandardErrorResponse);
  }

  // 2. Errores de Timeout / Conectividad
  if (
    errCode === 'ECONNABORTED' ||
    errCode === 'ETIMEDOUT' ||
    errCode === 'ECONNRESET' ||
    errMessage.includes('timeout')
  ) {
    return reply.code(200).send({
      success: false,
      code: 'TIMEOUT',
      message: 'Tiempo de espera agotado al conectar con el servidor de Shalom.',
    } as StandardErrorResponse);
  }

  // 3. Errores de Validación de Agencia
  if (errMessage.includes('agency') || errMessage.includes('agencia') || upstreamData?.error?.includes?.('terminal')) {
    return reply.code(200).send({
      success: false,
      code: 'AGENCY_INVALID',
      message: 'La agencia de destino especificada no es válida o no fue reconocida por Shalom.',
      details: upstreamData,
    } as StandardErrorResponse);
  }

  // 4. Errores de Validación de Payload (Fastify schema / Zod)
  if (error.validation) {
    return reply.code(400).send({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Los datos enviados en la solicitud no cumplen con el formato requerido.',
      details: error.validation,
    } as StandardErrorResponse);
  }

  // 5. Fallback general
  return reply.code(axiosStatus || 500).send({
    success: false,
    code: 'SERVER_ERROR',
    message: errMessage,
    details: upstreamData,
  } as StandardErrorResponse);
}
