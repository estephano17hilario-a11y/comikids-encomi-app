# 📦 Reporte Diario de Sincronización de Agencias Shalom

- **Fecha (Hora Perú):** viernes, 20 de noviembre de 2026, 8:36:16 p. m.
- **Ejecución:** ✅ Producción (Base de datos actualizada)
- **Duración:** 6.1s
- **Estado:** ✨ **SIN CAMBIOS (Catálogo 100% al día)**
- **Verificación Cruzada Oficial (`shalomcontrol.com`):** ✅ Activa (570 registros verificados · exige `ter_habilitado_OS=1` y `destino=1` · 3 discrepancias del proxy atrapadas)

## 📊 Resumen Ejecutivo

| Métrica | Cantidad |
|---|---:|
| 📡 Total registros devueltos por API Shalom | **570** |
| ✅ Agencias activas válidas como destino (`OS=1` y `destino=1`) | **501** |
| 🚫 Agencias SOLO ENVÍOS / No reciben destino (visibles 30d bloqueadas) | **12** |
| 🛑 Agencias cerradas/deshabilitadas (visibles 30d con aviso `YA NO EXISTE`) | **22** |
| 🧹 Registros internos / aeropuertos / `SOLO ENVÍOS` / `(POR DEFINIR)` / QA ocultos | **38** |
| ✨ Nuevas agencias agregadas | **0** |
| 🌟 Agencias reactivadas / recién habilitadas | **0** |
| 🏷️ Cambios de nombre / sucursal / nomenclatura | **0** |
| 🔤 Cambios de código / abreviatura | **0** |
| 📍 Cambios de dirección / mudanzas / saneamiento de texto | **0** |
| 🗺️ Cambios de ubicación (Depto / Prov / Ubigeo / GPS) | **0** |
| 🕐 Cambios de horario o teléfono | **0** |
| 🛑 Bajas reales detectadas (deshabilitadas o eliminadas) | **0** |
| 🧹 Depuración de QA / internos / aeropuertos / `(POR DEFINIR)` | **0** |
| 📦 Pedidos activos actualizados / limpiados | **0** |
| ⚠️ Alertas en pedidos activos | **0** |

## 🛡️ Discrepancias Atrapadas por Verificación Cruzada Oficial (3)

> Estas agencias aparecían con `habilitado: true` en el proxy (`api.shalom-api-peru.com`), pero en el servidor oficial de Shalom (`shalomcontrol.com`) tienen `destino: 0` (no reciben encomiendas como destino). Fueron bloqueadas automáticamente para evitar rechazos en ventanilla.

| ID | Código | Agencia | Origen | Destino | Motivo |
|---:|---|---|---:|---:|---|
| 629 | `AVTPCMR` | LIMA / LIMA / COMAS / AV TUPAC AMARU CDRA. 57 | ✅ 1 | 🚫 0 | Discrepancia atrapada: SOLO ENVÍOS en Shalom oficial (origen=1, destino=0; NO recibe encomiendas como destino) |
| 365 | `HPACO` | LIMA / LIMA / LURIGANCHO / HUACHIPA CO | ❌ 0 | 🚫 0 | Discrepancia atrapada: deshabilitada en Shalom oficial (origen=0, destino=0 — no envía ni recibe) |
| 552 | `LCZ` | TUMBES / TUMBES / LA CRUZ / LA CRUZ TUMBES | ❌ 0 | 🚫 0 | Discrepancia atrapada: deshabilitada en Shalom oficial (origen=0, destino=0 — no envía ni recibe) |

## 👀 Próximas Sedes en Preparación en API Shalom (`habilitado=false`) (13)

> Estas sedes existen en la API de Shalom pero aún tienen `habilitado: false`. En cuanto Shalom las habilite, el cron diario de las **5:00 AM** las activará automáticamente.

| ID | Código | Nombre | Dirección |
|---:|---|---|---|
| 719 | `AVTRS` | LIMA / LIMA / LURIGANCHO / AV LAS TORRES | AV. LAS TORRES SUB. LT. 18A - 1D, FUNDO HUACHIPA, PARCELA MEDIA, LURIGANCHO - LIMA - LIMA, REF. AL FRENTE DEL CRUCE CON AV. MEDIA LUNA |
| 728 | `AVFRL` | LIMA / LIMA / SANTA ANITA / AV EL FERROCARRIL STA ANITA | AV. EL FERROCARRIL 530 COOPERATIVA. LOS CHANCAS DE ANDAHUAYLAS MZ. F1 LT. 06, REF. CRUCE CON AV. RUISEÑORES |
| 730 | `MNLAVLO` | LA LIBERTAD / TRUJILLO / LA ESPERANZA / URB MANUEL AREVALO | MZ. B21 LT. 05 URB MANUEL AREVALO III ETAPA B, REF. CRUCE CON AV. CAHUIDE A UNA CDRA. DEL COMPLEJO DEPORTIVO PAZ Y AMISTAD |
| 733 | `CPNG` | LIMA / LIMA / LURIGANCHO / CARAPONGO - LURIGANCHO (POR DEFINIR) | AV. 24 DE SETIEMBRE MZ. A SUB LT. 9-A2 ASOC. NUEVO HORIZONTE, REF. A MEDIA CDRA. DEL CENTRO COMERCIAL MANTARO, FRENTE AL GRIFO PETROAMERICA |
| 735 | `CSCANT` | LAMBAYEQUE / CHICLAYO / LA VICTORIA / CHOSICA DEL NORTE CO | MZ. 1 LOTE 1C-2 URB. LOTIZACION CHOSICA DEL NORTE, REF. A MEDIA CDRA. DE LA INTERSECCIÓN CON CALLE SAN MARTIN / A UNOS MTS. DE ALBORADA EVENTOS Y RECEPCIONES |
| 736 | `AVHRPT` | CUSCO / CUSCO / WANCHAQ / AV. HUAYRUROPATA | AV. TOMASA TITO CONDEMAYTA N1706, REF. AL COSTADO DEL TERMINAL DE SICUANI DE BUSES RÁPIDOS POR LA VIA DEL IPD |
| 737 | `HCSMT` | LIMA / HUAURA / HUACHO / HUACHO SAN MARTÍN CO (POR DEFINIR) | PROLONGACION SAN MARTIN 1087, REF. AL FRENTE DE LA PAZULEA VICTOR RAUL HAYA DE LA TORRE |
| 739 | `PBA` | LAMBAYEQUE / CHICLAYO / PIMENTEL / PIMENTEL (POR DEFINIR) | CALLE . JUAN VELASCO ALVARADO N° 472 , PIMENTEL - CHICLAYO - LAMBAYEQUE. REFERENCIAS: INTERSECCIÓN CON LA CALLE CIRO ALEGRIA. / A UNAS CUADRAS DEL CENTRO DE SALUD "PIMENTEL". |
| 741 | `CLSY` | CUSCO / CUSCO / CUSCO / COLLASUYO (POR DEFINIR) | URB. UCCHULLO O. 12 A, REF. POR DEFINIR |
| 743 | `PLH` | JUNIN / HUANCAYO / HUANCAYO / PALIAN HUANCAYO (POR DEFINIR) | AV. PALIÁN MZ. G - LT. 22, REF: A DOS CDRAS. DEL COLEGIO ASUNCIÓN DE PALIÁN |
| 745 | `MOCHMI` | LAMBAYEQUE / LAMBAYEQUE / MOCHUMI / MOCHUMI | CALLE SAN MARTIN N°448, REF. ALTURA DE LA COMISARIA DE MOCHUMI |
| 746 | `MCICA` | LA LIBERTAD / TRUJILLO / EL PORVENIR / AV MANCO INCA | CALLE MANCO INCA 0522 PP .JJ, REF. CRUCE CON AV. PUMACAHUA Y A 1 CDRA. DE SEDALIB |
| 747 | `HRZPRA` | ANCASH / HUARAZ / INDEPENDENCIA / HUARAZ PALMIRA (POR DEFINIR) | AV. CENTENARIO N°2371 – BARRIO PALMIRA, REF. AL COSTADO DE VENTA DE COMIDAS PLAZA NORTE |

---
_Generado automáticamente por `scripts/sync-shalom.mjs` (Cron Diario 05:00 AM Hora Perú)._
