# 📦 Reporte Diario de Sincronización de Agencias Shalom

- **Fecha (Hora Perú):** viernes, 20 de noviembre de 2026, 6:01:22 p. m.
- **Ejecución:** ✅ Producción (Base de datos actualizada)
- **Duración:** 14.5s
- **Estado:** 🔔 **CAMBIOS DETECTADOS Y APLICADOS**

## 📊 Resumen Ejecutivo

| Métrica | Cantidad |
|---|---:|
| 📡 Total registros devueltos por API Shalom | **570** |
| ✅ Agencias activas válidas en BD (habilitadas para clientes) | **504** |
| 🛑 Agencias cerradas/deshabilitadas (visibles 30d con aviso `YA NO EXISTE`) | **31** |
| 🧹 Registros internos / aeropuertos / `SOLO ENVÍOS` / `(POR DEFINIR)` / QA ocultos | **38** |
| ✨ Nuevas agencias agregadas | **0** |
| 🌟 Agencias reactivadas / recién habilitadas | **0** |
| 🏷️ Cambios de nombre / sucursal / nomenclatura | **0** |
| 🔤 Cambios de código / abreviatura | **0** |
| 📍 Cambios de dirección / mudanzas / saneamiento de texto | **0** |
| 🗺️ Cambios de ubicación (Depto / Prov / Ubigeo / GPS) | **0** |
| 🕐 Cambios de horario o teléfono | **0** |
| 🛑 Bajas reales detectadas (deshabilitadas o eliminadas) | **31** |
| 🧹 Depuración de QA / internos / aeropuertos / `(POR DEFINIR)` | **35** |
| 📦 Pedidos activos actualizados / limpiados | **3** |
| ⚠️ Alertas en pedidos activos | **0** |

## 🛑 8. Agencias Cerradas / Deshabilitadas (Bajas con vigencia informativa de 30 días) (31)

| ID | Código | Agencia | Motivo |
|---:|---|---|---|
| 294 | `CERMOLL` | AREQUIPA / ISLAY / MOLLENDO / CERCADO MOLLENDO | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 540 | `OTART` | CALLAO / CALLAO / CALLAO / OUTLET ARAUCO FAUCETT | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 736 | `AVHRPT` | CUSCO / CUSCO / WANCHAQ / AV. HUAYRUROPATA | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 518 | `INGCA` | ICA / NAZCA / EL INGENIO / EL INGENIO | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 182 | `TERM, BUS` | JUNIN / HUANCAYO / HUANCAYO / TERMINAL DE BUS | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 746 | `MCICA` | LA LIBERTAD / TRUJILLO / EL PORVENIR / AV MANCO INCA | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 730 | `MNLAVLO` | LA LIBERTAD / TRUJILLO / LA ESPERANZA / URB MANUEL AREVALO | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 735 | `CSCANT` | LAMBAYEQUE / CHICLAYO / LA VICTORIA / CHOSICA DEL NORTE CO | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 745 | `MOCHMI` | LAMBAYEQUE / LAMBAYEQUE / MOCHUMI / MOCHUMI | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 244 | `PNSE` | LIMA / LIMA / INDEPENDENCIA / PLAZA NORTE S. EXPRESS | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 276 | `AV.ARE` | LIMA / LIMA / JESUS MARIA / AV. ARENALES | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 180 | `AV.SANFEL` | LIMA / LIMA / JESUS MARIA / AV. SAN FELIPE | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 719 | `AVTRS` | LIMA / LIMA / LURIGANCHO / AV LAS TORRES | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 700 | `HPACO2` | LIMA / LIMA / LURIGANCHO / HUACHIPA CO 2 | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 434 | `ALFRBV` | LIMA / LIMA / MIRAFLORES / AV. ALFREDO BENAVIDES | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 435 | `COMESP` | LIMA / LIMA / MIRAFLORES / AV. COMANDANTE ESPINAR | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 190 | `AV.JP` | LIMA / LIMA / MIRAFLORES / AV. JOSE PARDO | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 286 | `AG2` | LIMA / LIMA / MIRAFLORES / AV. ROOSEVELT | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 226 | `CABER` | LIMA / LIMA / MIRAFLORES / CALLE BERLIN | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 179 | `JAV.PRA` | LIMA / LIMA / SAN BORJA / AV. JAVIER PRADO | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 273 | `AVI.299` | LIMA / LIMA / SAN BORJA / AVIACION 2999 | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 287 | `AG3` | LIMA / LIMA / SAN ISIDRO / CALLE LAS BEGONIAS | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 436 | `CLLMDS` | LIMA / LIMA / SAN ISIDRO / CALLE MIGUEL DASSO | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 275 | `CORPAC` | LIMA / LIMA / SAN ISIDRO / CORPAC | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 274 | `RIB.NAV` | LIMA / LIMA / SAN ISIDRO / RIV. NAVARRETE | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 728 | `AVFRL` | LIMA / LIMA / SANTA ANITA / AV EL FERROCARRIL STA ANITA | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 191 | `SANT.SURC` | LIMA / LIMA / SANTIAGO DE SURCO / AV. PRIMAVERA 120 | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 261 | `AV.PRIM` | LIMA / LIMA / SANTIAGO DE SURCO / AV. PRIMAVERA 1314 | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 283 | `AG1` | LIMA / LIMA / SANTIAGO DE SURCO / AV. PRIMAVERA 264 | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 437 | `AVTOMARS` | LIMA / LIMA / SANTIAGO DE SURCO / AV. TOMÁS MARSANO | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |
| 278 | `ARAMBU` | LIMA / LIMA / SURQUILLO / AV. ARAMBURU | Sede cerrada o temporalmente deshabilitada en Shalom (habilitado=false) |

## 🧹 9. Depuración: Pruebas QA, Aeropuertos, Solo Envíos, Cajas Internas y (POR DEFINIR) (35)

<details><summary>Ver listado completo depurado (35 registros ocultados del catálogo público)</summary>

| ID | Código | Nombre | Motivo |
|---:|---|---|---|
| 747 | `HRZPRA` | ANCASH / HUARAZ / INDEPENDENCIA / HUARAZ PALMIRA (POR DEFINIR) | Sede por definir / aún no inaugurada (habilitado=false) |
| 484 | `AQPA` | AREQUIPA / AREQUIPA / AREQUIPA / AEROPUERTO AREQUIPA | Terminal aeroportuaria interna (habilitado=false) |
| 720 | `AYP` | AYACUCHO / HUAMANGA / AYACUCHO / AEROPUERTO AYACUCHO | Terminal aeroportuaria interna (habilitado=false) |
| 482 | `cja` | CAJAMARCA / CAJAMARCA / CAJAMARCA / AEROPUERTO CAJAMARCA | Terminal aeroportuaria interna (habilitado=false) |
| 480 | `CLLO` | CALLAO / CALLAO / CALLAO / AEROPUERTO CALLAO | Terminal aeroportuaria interna (habilitado=false) |
| 481 | `CCO` | CUSCO / CUSCO / CUSCO / AEROPUERTO CUSCO | Terminal aeroportuaria interna (habilitado=false) |
| 741 | `CLSY` | CUSCO / CUSCO / CUSCO / COLLASUYO (POR DEFINIR) | Sede por definir / aún no inaugurada (habilitado=false) |
| 743 | `PLH` | JUNIN / HUANCAYO / HUANCAYO / PALIAN HUANCAYO (POR DEFINIR) | Sede por definir / aún no inaugurada (habilitado=false) |
| 483 | `TRJLO` | LA LIBERTAD / TRUJILLO / TRUJILLO / aperopuerto TRUJILLO | Terminal aeroportuaria interna (habilitado=false) |
| 486 | `CYO` | LAMBAYEQUE / CHICLAYO / CHICLAYO / AEROPUERTOCHICLAYO | Terminal aeroportuaria interna (habilitado=false) |
| 739 | `PBA` | LAMBAYEQUE / CHICLAYO / PIMENTEL / PIMENTEL (POR DEFINIR) | Sede por definir / aún no inaugurada (habilitado=false) |
| 433 | `JRSTA` | LIMA / CAÑETE / SAN VICENTE DE CANET / JR. SANTA RITA - CAÑETE (POR DEFINIR) | Sede por definir / aún no inaugurada (habilitado=false) |
| 737 | `HCSMT` | LIMA / HUAURA / HUACHO / HUACHO SAN MARTÍN CO (POR DEFINIR) | Sede por definir / aún no inaugurada (habilitado=false) |
| 209 | `DISTR` | LIMA / LIMA / CERCADO LIMA / CAJA DISTRIBUCION LIMA | Instalación interna / caja / almacén (habilitado=false) |
| 523 | `RSL` | LIMA / LIMA / CIENEGUILLA / REPARTO SAN LUIS | Instalación interna / caja / almacén (habilitado=false) |
| 236 | `CF` | LIMA / LIMA / LA VICTORIA / AREA SHALOM EMPRESAS | Instalación interna / caja / almacén (habilitado=false) |
| 557 | `CTM` | LIMA / LIMA / LA VICTORIA / CAJA TRANSPORTE MEXICO | Instalación interna / caja / almacén (habilitado=false) |
| 5 | `LIM.L` | LIMA / LIMA / LA VICTORIA / JR. LUNA PIZARRO | Agencia SOLO ENVÍOS (no habilitada para recojo destino) |
| 749 | `ZZQ` | LIMA / LIMA / LA VICTORIA / ZZ QA PRUEBA 06078 | Terminal de prueba / QA de Shalom |
| 733 | `CPNG` | LIMA / LIMA / LURIGANCHO / CARAPONGO - LURIGANCHO (POR DEFINIR) | Sede por definir / aún no inaugurada (habilitado=false) |
| 147 | `T.HUAC` | LIMA / LIMA / LURIGANCHO / CD. TALLERES-HUACHIPA | Instalación interna / caja / almacén (habilitado=false) |
| 744 | `PDA` | LIMA / LIMA / LURIN / cambio_de_nombre_prueba | Terminal de prueba / QA de Shalom |
| 458 | `PTSA` | LIMA / LIMA / PUNTA HERMOSA / ALMACENES BSF | Instalación interna / caja / almacén (habilitado=false) |
| 546 | `HRISTA` | LIMA / LIMA / SANTA ANITA / AV HUAROCHIRI ENVIOS | Agencia SOLO ENVÍOS (no habilitada para recojo destino) |
| 673 | `PSIS` | LIMA / LIMA / VILLA EL SALVADOR / Prueba sistemas | Terminal de prueba / QA de Shalom |
| 252 | `PTOYI` | LORETO / ALTO AMAZONAS / YURIMAGUAS / PUERTO YURIMAGUAS | Instalación interna / caja / almacén (habilitado=false) |
| 493 | `IQTS` | LORETO / MAYNAS / IQUITOS / AEROPUERTO IQUITOS | Terminal aeroportuaria interna (habilitado=false) |
| 364 | `IQUIT` | LORETO / MAYNAS / IQUITOS / PUERTO IQUITOS | Instalación interna / caja / almacén (habilitado=false) |
| 487 | `PTDO` | MADRE DE DIOS / TAMBOPATA / TAMBOPATA / AEROPUERTO PUERTO MALDONADO | Terminal aeroportuaria interna (habilitado=false) |
| 491 | `PRA` | PIURA / PIURA / PIURA / AEROPUERTO PIURA | Terminal aeroportuaria interna (habilitado=false) |
| 485 | `JCA` | PUNO / SAN ROMAN / JULIACA / AEROPUERTO JULIACA | Terminal aeroportuaria interna (habilitado=false) |
| 488 | `TPTO` | SAN MARTIN / SAN MARTIN / TARAPOTO / AEROPUERTO TARAPOTO | Terminal aeroportuaria interna (habilitado=false) |
| 490 | `TCA` | TACNA / TACNA / TACNA / AEROPUERTO TACNA | Terminal aeroportuaria interna (habilitado=false) |
| 492 | `TBS` | TUMBES / TUMBES / TUMBES / AEROPUERTO TUMBES | Terminal aeroportuaria interna (habilitado=false) |
| 489 | `PPA` | UCAYALI / CORONEL PORTILLO / PUCALLPA CALLERIA / AEROPUERTO PUCALLPA | Terminal aeroportuaria interna (habilitado=false) |

</details>

## ✨ 9b. Saneamiento de Encoding y Espacios (194 textos normalizados, 5 correcciones de caracteres)

| ID | Código | Agencia | Corrección Aplicada |
|---:|---|---|---|
| 669 | `VSTLGRCO` | ICA / NAZCA / VISTA ALEGRE / VISTA ALEGRE CO | Encoding corregido: "CARRETERA PANAMERICANA SUR N\u00b0 906, VISTA ALEGRE - NAZCA -\u00a0ICA, REF. FRENTE AL AEROPUERTO DE VISTA ALEGRE" → "CARRETERA PANAMERICANA SUR N° 906, VISTA ALEGRE - NAZCA - ICA, REF. FRENTE AL AEROPUERTO DE VISTA ALEGRE" |
| 108 | `CRB` | LIMA / LIMA / CARABAYLLO / CARABAYLLO ESTABLO | Encoding corregido: "AV. TUPAC AMARU N? 441 - 443, MZ. O2 LT. 35, REFERENCIA: PARADERO ESTABLO, A UNA CUADRA DE LA URB. SANTA ISABEL" → "AV. TUPAC AMARU N° 441 - 443, MZ. O2 LT. 35, REFERENCIA: PARADERO ESTABLO, A UNA CUADRA DE LA URB. SANTA ISABEL" |
| 466 | `AVLPLA` | LIMA / LIMA / LOS OLIVOS / AV. LOS PLATINOS | Código recortado: "AVLPLA " → "AVLPLA" |
| 576 | `ovlpdra` | LIMA / LIMA / PUENTE PIEDRA / OVALO PUENTE PIEDRA | Encoding corregido: "AV. MIGUEL GRAUÂ MZ. A LT. 07 Y 08 URB. SAN MARTIN DE PORRES, CERCADO PUENTE PIEDRA - LIMA, REF. ESPALDAS DE TOTTUS DE PUENTE PIEDRA" → "AV. MIGUEL GRAU MZ. A LT. 07 Y 08 URB. SAN MARTIN DE PORRES, CERCADO PUENTE PIEDRA - LIMA, REF. ESPALDAS DE TOTTUS DE PUENTE PIEDRA" |
| 383 | `smpuma` | LIMA / LIMA / SANTIAGO DE SURCO / SURCO MATEO PUMACAHUA | Código recortado: "smpuma " → "smpuma" |

## 📦 10. Pedidos Activos Actualizados / Saneados (3)

| Código Seguimiento | Destino Anterior | Destino Actualizado |
|---|---|---|
| `COM-2026-7029` | Agencia Shalom: ICA / NAZCA / SAN JUAN DE MARCONA (CÓDIGO: MCN) – A. H. SAN MARTÍN DE PORRES E-28 SAN JUAN DE MARCONA - NAZCA - ICA, REF. ENTRE EL HOTEL SAN MARTIN Y EL MINIMARKET LANA (DNI/CE Recojo: 45440183 • Tel: 994744067) | Agencia Shalom: ICA / NAZCA / SAN JUAN DE MARCONA (CÓDIGO: MCN) – A. H. SAN MARTÍN DE PORRES E-28 SAN JUAN DE MARCONA - NAZCA - ICA, REF. ENTRE EL HOTEL SAN MARTIN Y EL MINIMARKET LANA (DNI/CE Recojo: 45440183 • Tel: 994744067) |
| `COM-2026-9074` | Agencia Shalom: CALLAO / CALLAO / OVALO LA PERLA (CÓDIGO: OVLA) – AV. LA MARINA 530, URB. BENJAMIN DOIGG LOSSIO, LA PERLA, CALLAO, REF. A 3 CUADRAS DEL ÓVALO DE LA PERLA (DNI/CE Recojo: 10177456 • Tel: 949172108) | Agencia Shalom: CALLAO / CALLAO / OVALO LA PERLA (CÓDIGO: OVLA) – AV. LA MARINA 530, URB. BENJAMIN DOIGG LOSSIO, LA PERLA, CALLAO, REF. A 3 CUADRAS DEL ÓVALO DE LA PERLA (DNI/CE Recojo: 10177456 • Tel: 949172108) |
| `ZVX-2026-3670` | Agencia Shalom: LIMA / LIMA / OVALO PUENTE PIEDRA (CÓDIGO: OVLPDRA) – AV. MIGUEL GRAUÂ MZ. A LT. 07 Y 08 URB. SAN MARTIN DE PORRES, CERCADO PUENTE PIEDRA - LIMA, REF. ESPALDAS DE TOTTUS DE PUENTE PIEDRA (DNI/CE Recojo: 71696931) | Agencia Shalom: LIMA / LIMA / OVALO PUENTE PIEDRA (CÓDIGO: OVLPDRA) – AV. MIGUEL GRAU MZ. A LT. 07 Y 08 URB. SAN MARTIN DE PORRES, CERCADO PUENTE PIEDRA - LIMA, REF. ESPALDAS DE TOTTUS DE PUENTE PIEDRA (DNI/CE Recojo: 71696931) |

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
