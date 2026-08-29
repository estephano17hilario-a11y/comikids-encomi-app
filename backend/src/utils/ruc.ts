/**
 * Algoritmo Oficial de SUNAT: Cálculo de RUC 10 a partir de DNI (8 dígitos)
 * Utiliza ponderación de Factores y Módulo 11 para obtener el Dígito Verificador.
 */
export function calcularRuc10(dni: string): string {
  const cleanDni = String(dni || '').replace(/\D/g, '');
  if (cleanDni.length !== 8) {
    throw new Error('DNI inválido: deben ser 8 dígitos numéricos.');
  }

  const base = '10' + cleanDni;
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

  let suma = 0;
  for (let i = 0; i < base.length; i++) {
    suma += parseInt(base[i], 10) * factores[i];
  }

  const residuo = suma % 11;
  const complemento = 11 - residuo;

  let digitoVerificador: number;
  if (complemento === 10) {
    digitoVerificador = 0;
  } else if (complemento === 11) {
    digitoVerificador = 1;
  } else {
    digitoVerificador = complemento;
  }

  return `${base}${digitoVerificador}`;
}
