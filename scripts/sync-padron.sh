#!/usr/bin/env bash
set -e

DATA_DIR="./data"
TEMP_DIR="./data/temp"
mkdir -p "$TEMP_DIR"
mkdir -p "$DATA_DIR"

echo "[SYNC PADRON] 1. Descargando Padron Reducido oficial de SUNAT..."
curl -L -o "$TEMP_DIR/padron.zip" "http://www2.sunat.gob.pe/padron_reducido_ruc.zip"

echo "[SYNC PADRON] 2. Descomprimiendo archivo..."
unzip -o "$TEMP_DIR/padron.zip" -d "$TEMP_DIR"
TXT_FILE=$(ls "$TEMP_DIR"/*.txt | head -n 1)

echo "[SYNC PADRON] 3. Creando Base de Datos SQLite temporal..."
TEMP_DB="$TEMP_DIR/temp_padron.db"
rm -f "$TEMP_DB"

# Crear esquema optimizado
sqlite3 "$TEMP_DB" <<EOF
PRAGMA page_size = 4096;
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;
CREATE TABLE padron (
  ruc TEXT PRIMARY KEY,
  razon_social TEXT NOT NULL,
  estado TEXT,
  condicion TEXT,
  ubigeo TEXT
) WITHOUT ROWID;
EOF

echo "[SYNC PADRON] 4. Importando datos masivos..."
python3 -c "
import sqlite3, time, sys

conn = sqlite3.connect('$TEMP_DB')
cursor = conn.cursor()
cursor.execute('PRAGMA synchronous = OFF')
cursor.execute('PRAGMA journal_mode = OFF')

BATCH = []
with open('$TXT_FILE', 'r', encoding='latin-1') as f:
    _ = f.readline()
    for line in f:
        p = line.strip().split('|')
        if len(p) >= 5 and p[0] and p[1]:
            BATCH.append((p[0].strip(), p[1].strip(), p[2].strip(), p[3].strip(), p[4].strip()))
            if len(BATCH) >= 100000:
                cursor.executemany('INSERT OR REPLACE INTO padron VALUES (?, ?, ?, ?, ?)', BATCH)
                conn.commit()
                BATCH = []
if BATCH:
    cursor.executemany('INSERT OR REPLACE INTO padron VALUES (?, ?, ?, ?, ?)', BATCH)
    conn.commit()
cursor.execute('PRAGMA optimize')
conn.close()
"

echo "[SYNC PADRON] 5. Reemplazando base de datos en produccion..."
mv "$TEMP_DB" "$DATA_DIR/padron.db"

echo "[SYNC PADRON] 6. Limpiando temporales..."
rm -rf "$TEMP_DIR"

echo "[SYNC PADRON] Padron sincronizado con exito!"
