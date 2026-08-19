#!/bin/bash
# ==============================================================================
# SCRIPT DE DESPLIEGUE COMPLETO: EVOLUTION API + REDIS + BACKEND FASTIFY
# CONTABO CLOUD VPS (89.117.73.97)
# ==============================================================================
set -euo pipefail

echo "========================================================="
echo "   [1/4] DESPLEGANDO EVOLUTION API v2, POSTGRES & REDIS"
echo "========================================================="
cd /opt/evolution
docker compose up -d

echo "Esperando 10 segundos a que los servicios inicialicen..."
sleep 10
docker compose ps

echo "========================================================="
echo "   [2/4] CREANDO INSTANCIA DE WHATSAPP EN EVOLUTION API"
echo "========================================================="
EVOLUTION_KEY=$(grep AUTHENTICATION_API_KEY /opt/evolution/.env | cut -d '=' -f2)

curl -s -X POST "http://127.0.0.1:8080/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -d '{
    "instanceName": "comikids_whatsapp",
    "token": "",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS",
    "webhook": "http://backend_api:3000/webhook/evolution",
    "webhook_by_events": true,
    "events": [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONNECTION_UPDATE"
    ]
  }' || echo "La instancia ya existe o está inicializada."

echo "========================================================="
echo "   [3/4] CONSTRUYENDO Y DESPLEGANDO BACKEND FASTIFY + BULLMQ"
echo "========================================================="
cd /opt/app
docker compose build --no-cache
docker compose up -d

echo "========================================================="
echo "   [4/4] CONFIGURANDO Y REINICIANDO NGINX REVERSE PROXY"
echo "========================================================="
cp /opt/nginx/conf.d/app.conf /etc/nginx/conf.d/app.conf 2>/dev/null || true
nginx -t && systemctl reload nginx || systemctl restart nginx

echo "========================================================="
echo "   🎉 ¡DESPLIEGUE COMPLETADO CON ÉXITO!"
echo "========================================================="
echo "Para ver el QR de conexión de WhatsApp ejecuta:"
echo "curl -s -X GET 'http://127.0.0.1:8080/instance/connect/comikids_whatsapp' -H 'apikey: ${EVOLUTION_KEY}' | jq"
