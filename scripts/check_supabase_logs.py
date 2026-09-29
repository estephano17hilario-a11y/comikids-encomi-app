import paramiko
import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('89.117.73.97', 22, 'root', 'estephano10FM20home')

# Ver últimos mensajes guardados en Supabase
py_code = """
import os, json
from supabase import create_client
url = 'https://api.89.117.73.97.sslip.io'
key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Nzg0OTc2MCwiZXhwIjo0OTQzNTIzMzYwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.5eQ25r3hmhs9RhYwExb4oeSLbxsvRYeWBEEvXvSyypA' # service role
# Or query via curl to supabase REST
"""

# Usar curl directo a Supabase
cmd = """curl -s 'https://api.89.117.73.97.sslip.io/rest/v1/whatsapp_mensajes_log?select=*&order=created_at.desc&limit=10' \
  -H "apikey: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4Nzg0OTc2MCwiZXhwIjo0OTQzNTIzMzYwLCJyb2xlIjoiYW5vbiJ9._DvifLx6sViDd5UePak7xswzmT6dQp9FoQZqPnyxeRU"
"""
# Or with service role from docker container
cmd_docker = "docker exec -i backend_api node -e 'import(\"./dist/config/supabase.js\").then(async ({supabaseAdmin}) => { const {data} = await supabaseAdmin.from(\"whatsapp_mensajes_log\").select(\"*\").order(\"created_at\", {ascending:false}).limit(10); console.log(JSON.stringify(data, null, 2)); })'"

_, out, _ = ssh.exec_command(cmd_docker)
print(out.read().decode('utf-8', errors='replace'))

ssh.close()
