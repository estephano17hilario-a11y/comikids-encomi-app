import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { calcularRuc10 } from '../utils/ruc.js';
import { supabaseAdmin } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: any = null;
let queryStmt: any = null;

function getDbInstance() {
  if (dbInstance && queryStmt) return { db: dbInstance, queryStmt };

  try {
    const possiblePaths = [
      '/opt/app/data/padron.db',
      '/app/data/padron.db',
      path.resolve(process.cwd(), 'data/padron.db'),
      path.resolve(process.cwd(), 'backend/data/padron.db'),
      path.resolve(__dirname, '../../data/padron.db'),
      path.resolve(__dirname, '../../../data/padron.db'),
    ];

    let foundPath = possiblePaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

    if (foundPath) {
      dbInstance = new DatabaseSync(foundPath, { readOnly: true });
      queryStmt = dbInstance.prepare(
        'SELECT razon_social, estado, condicion, ubigeo FROM padron WHERE ruc = ? LIMIT 1'
      );
      console.log(`[DNI RESOLVER] ✓ Base de datos SQLite indexada cargada en memoria desde: ${foundPath}`);
      return { db: dbInstance, queryStmt };
    } else {
      console.warn('[DNI RESOLVER] No se encontró el archivo padron.db en las rutas especificadas. Se utilizará fallback a Supabase.');
    }
  } catch (err: any) {
    console.error('[DNI RESOLVER INIT ERROR]', err.message);
  }

  return { db: null, queryStmt: null };
}

export function formatSunatNameToGivenFirst(rawName: string): string {
  if (!rawName) return '';
  const parts = rawName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return rawName.trim();

  // En el padrón oficial de SUNAT para personas naturales, el formato es [APELLIDO1] [APELLIDO2] [NOMBRES...]
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }

  // 3 palabras: APE1 APE2 NOM1 (ej: HILARIO FUENTES JUNIOR -> JUNIOR HILARIO FUENTES)
  if (parts.length === 3) {
    if (['DE', 'DEL', 'SAN', 'SANTA'].includes(parts[0].toUpperCase())) {
      return `${parts[2]} ${parts[0]} ${parts[1]}`;
    }
    return `${parts[2]} ${parts[0]} ${parts[1]}`;
  }

  // 4 palabras: APE1 APE2 NOM1 NOM2 (ej: AMPUERO SANTIAGO MILAGROS JANET -> MILAGROS JANET AMPUERO SANTIAGO)
  if (parts.length === 4) {
    if (['DE', 'DEL', 'SAN', 'SANTA'].includes(parts[0].toUpperCase())) {
      return `${parts[3]} ${parts[0]} ${parts[1]} ${parts[2]}`;
    }
    return `${parts[2]} ${parts[3]} ${parts[0]} ${parts[1]}`;
  }

  // 5 o más palabras: normalmente los primeros 2 tokens son los apellidos y el resto nombres
  const surnames = parts.slice(0, 2);
  const givenNames = parts.slice(2);
  return `${givenNames.join(' ')} ${surnames.join(' ')}`;
}

export class DniController {
  /**
   * Resuelve el nombre legal del cliente en < 1ms mediante DNI (8 dígitos) -> RUC 10 -> SQLite
   * GET /api/dni/:dni
   */
  public static async resolveDni(
    request: FastifyRequest<{
      Params: { dni: string };
    }>,
    reply: FastifyReply
  ) {
    const startTime = process.hrtime.bigint();
    const { dni } = request.params;
    const cleanDni = String(dni || '').replace(/\D/g, '').trim();

    if (cleanDni.length !== 8) {
      return reply.code(400).send({
        success: false,
        message: 'DNI inválido: debe contener exactamente 8 dígitos numéricos.',
      });
    }

    try {
      // 1. Calcular RUC 10 con algoritmo determinista Módulo 11 (0.001 ms)
      const ruc = calcularRuc10(cleanDni);

      // 2. Consultar SQLite indexado (< 0.5 ms)
      const { queryStmt: stmt } = getDbInstance();

      if (stmt) {
        const row = stmt.get(ruc) as {
          razon_social: string;
          estado?: string;
          condicion?: string;
          ubigeo?: string;
        } | undefined;

        console.log(`[DNI RESOLVER] RUC ${ruc} para DNI ${cleanDni} -> Resultado SQLite:`, row?.razon_social || 'NO ENCONTRADO');

        if (row && row.razon_social) {
          const endTime = process.hrtime.bigint();
          const latencyMs = Number(endTime - startTime) / 1_000_000;
          const formattedName = formatSunatNameToGivenFirst(row.razon_social);

          return reply.code(200).send({
            success: true,
            source: 'sunat_padron_local',
            latencyMs: Number(latencyMs.toFixed(3)),
            data: {
              dni: cleanDni,
              ruc,
              nombreCompleto: formattedName,
              nombreOriginal: row.razon_social.trim(),
              estado: row.estado || 'ACTIVO',
              condicion: row.condicion || 'HABIDO',
              ubigeo: row.ubigeo || '',
            },
          });
        }
      } else {
        console.warn(`[DNI RESOLVER] queryStmt es NULL! No se pudo abrir SQLite.`);
      }

      // 3. Fallback inteligente: Buscar en el historial de pedidos y usuarios de Supabase
      try {
        const { data: userRow } = await supabaseAdmin
          .from('usuarios')
          .select('nombre_completo, numero_documento')
          .or(`numero_documento.eq.${cleanDni},numero_documento.eq.${ruc}`)
          .limit(1)
          .maybeSingle();

        if (userRow && userRow.nombre_completo) {
          const endTime = process.hrtime.bigint();
          const latencyMs = Number(endTime - startTime) / 1_000_000;

          return reply.code(200).send({
            success: true,
            source: 'database_history',
            latencyMs: Number(latencyMs.toFixed(3)),
            data: {
              dni: cleanDni,
              ruc,
              nombreCompleto: userRow.nombre_completo.trim(),
              estado: 'ACTIVO',
              condicion: 'HABIDO',
            },
          });
        }
      } catch {}

      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1_000_000;

      return reply.code(404).send({
        success: false,
        latencyMs: Number(latencyMs.toFixed(3)),
        message: 'DNI no encontrado en el padrón oficial de SUNAT.',
        data: {
          dni: cleanDni,
          ruc,
        },
      });
    } catch (error: any) {
      console.error('[DNI RESOLVER ERROR]', error.message);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Error interno al consultar el DNI.',
      });
    }
  }
}
