# 📦 Reporte Diario de Sincronización de Agencias Shalom

- **Fecha (Hora Perú):** viernes, 27 de noviembre de 2026, 2:18:31 p. m.
- **Ejecución:** ✅ Producción (Base de datos actualizada)
- **Duración:** 6.8s
- **Estado:** 🔔 **CAMBIOS DETECTADOS Y APLICADOS**
- **Verificación Cruzada Oficial (`shalomcontrol.com`):** ✅ Activa (571 registros verificados · exige `ter_habilitado_OS=1` y `destino=1` · 1 discrepancias del proxy atrapadas)

## 📊 Resumen Ejecutivo

| Métrica | Cantidad |
|---|---:|
| 📡 Total registros devueltos por API Shalom | **571** |
| ✅ Agencias activas válidas como destino (`OS=1` y `destino=1`) | **503** |
| 🚫 Agencias SOLO ENVÍOS / No reciben destino (visibles 30d bloqueadas) | **11** |
| 🛑 Agencias cerradas/deshabilitadas (visibles 30d con aviso `YA NO EXISTE`) | **19** |
| 🧹 Registros internos / aeropuertos / `SOLO ENVÍOS` / `(POR DEFINIR)` / QA ocultos | **41** |
| ✨ Nuevas agencias agregadas | **0** |
| 🌟 Agencias reactivadas / recién habilitadas | **0** |
| 🏷️ Cambios de nombre / sucursal / nomenclatura | **0** |
| 🔤 Cambios de código / abreviatura | **0** |
| 📍 Cambios de dirección / mudanzas / saneamiento de texto | **0** |
| 🗺️ Cambios de ubicación (Depto / Prov / Ubigeo / GPS) | **0** |
| 🕐 Cambios de horario o teléfono | **0** |
| 🛑 Bajas reales detectadas (deshabilitadas o eliminadas) | **1** |
| 🧹 Depuración de QA / internos / aeropuertos / `(POR DEFINIR)` | **0** |
| 📦 Pedidos activos actualizados / limpiados | **0** |
| ⚠️ Alertas en pedidos activos | **0** |

## 🛡️ Discrepancias Atrapadas por Verificación Cruzada Oficial (1)

> Estas agencias aparecían con `habilitado: true` en el proxy (`api.shalom-api-peru.com`), pero en el servidor oficial de Shalom (`shalomcontrol.com`) tienen `destino: 0` (no reciben encomiendas como destino). Fueron bloqueadas automáticamente para evitar rechazos en ventanilla.

| ID | Código | Agencia | Origen | Destino | Motivo |
|---:|---|---|---:|---:|---|
| 365 | `HPACO` | LIMA / LIMA / LURIGANCHO / HUACHIPA CO | ❌ 0 | 🚫 0 | Discrepancia atrapada: deshabilitada en Shalom oficial (origen=0, destino=0 — no envía ni recibe) |

## 🛑 8. Agencias Cerradas / Deshabilitadas (Bajas con vigencia informativa de 30 días) (1)

| ID | Código | Agencia | Motivo |
|---:|---|---|---|
| 240 | `PRO.SJL` | LIMA / LIMA / SAN JUAN DE LURIGANCHO / SJL-AV.PROCERES | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |

## 👀 Próximas Sedes en Preparación en API Shalom (`habilitado=false`) (11)

> Estas sedes existen en la API de Shalom pero aún tienen `habilitado: false`. En cuanto Shalom las habilite, el cron diario de las **5:00 AM** las activará automáticamente.

| ID | Código | Nombre | Dirección |
|---:|---|---|---|
| 728 | `AVFRL` | LIMA / LIMA / SANTA ANITA / AV EL FERROCARRIL STA ANITA | AV. EL FERROCARRIL 530 COOPERATIVA. LOS CHANCAS DE ANDAHUAYLAS MZ. F1 LT. 06, REF. CRUCE CON AV. RUISEÑORES |
| 733 | `CPNG` | LIMA / LIMA / LURIGANCHO / CARAPONGO - LURIGANCHO (POR DEFINIR) | AV. 24 DE SETIEMBRE MZ. A SUB LT. 9-A2 ASOC. NUEVO HORIZONTE, REF. A MEDIA CDRA. DEL CENTRO COMERCIAL MANTARO, FRENTE AL GRIFO PETROAMERICA |
| 735 | `CSCANT` | LAMBAYEQUE / CHICLAYO / LA VICTORIA / CHOSICA DEL NORTE CO | MZ. 1 LOTE 1C-2 URB. LOTIZACION CHOSICA DEL NORTE, REF. A MEDIA CDRA. DE LA INTERSECCIÓN CON CALLE SAN MARTIN / A UNOS MTS. DE ALBORADA EVENTOS Y RECEPCIONES |
| 737 | `HCSMT` | LIMA / HUAURA / HUACHO / HUACHO SAN MARTÍN CO (POR DEFINIR) | PROLONGACION SAN MARTIN 1087, REF. AL FRENTE DE LA PAZULEA VICTOR RAUL HAYA DE LA TORRE |
| 739 | `PBA` | LAMBAYEQUE / CHICLAYO / PIMENTEL / PIMENTEL (POR DEFINIR) | CALLE . JUAN VELASCO ALVARADO N° 472 , PIMENTEL - CHICLAYO - LAMBAYEQUE. REFERENCIAS: INTERSECCIÓN CON LA CALLE CIRO ALEGRIA. / A UNAS CUADRAS DEL CENTRO DE SALUD "PIMENTEL". |
| 741 | `CLSY` | CUSCO / CUSCO / CUSCO / COLLASUYO (POR DEFINIR) | URB. UCCHULLO O. 12 A, REF. POR DEFINIR |
| 743 | `PLH` | JUNIN / HUANCAYO / HUANCAYO / PALIAN HUANCAYO (POR DEFINIR) | AV. PALIÁN MZ. G - LT. 22, REF: A DOS CDRAS. DEL COLEGIO ASUNCIÓN DE PALIÁN |
| 745 | `MOCHMI` | LAMBAYEQUE / LAMBAYEQUE / MOCHUMI / MOCHUMI | CALLE SAN MARTIN N°448, REF. ALTURA DE LA COMISARIA DE MOCHUMI |
| 746 | `MCICA` | LA LIBERTAD / TRUJILLO / EL PORVENIR / AV MANCO INCA | CALLE MANCO INCA 0522 PP .JJ, REF. CRUCE CON AV. PUMACAHUA Y A 1 CDRA. DE SEDALIB |
| 747 | `HRZPRA` | ANCASH / HUARAZ / INDEPENDENCIA / HUARAZ PALMIRA (POR DEFINIR) | AV. CENTENARIO N°2371 – BARRIO PALMIRA, REF. AL COSTADO DE VENTA DE COMIDAS PLAZA NORTE |
| 751 | `AVJSGZ` | CALLAO / CALLAO / BELLAVISTA / AV. JOSÉ GALVEZ BELLAVISTA (POR DEFINIR) | AV. JOSE GALVEZ 1383 - BELLAVISTA, CALLAO - CALLAO, REF. A 2 CDRS. DE FARENET DEL ÓVALO LA PERLA |

---
_Generado automáticamente por `scripts/sync-shalom.mjs` (Cron Diario 05:00 AM Hora Perú)._
