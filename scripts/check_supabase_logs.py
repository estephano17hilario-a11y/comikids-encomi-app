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
url = 'https://uwmdjsxwetjvsxsdngko.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bWRqc3h3ZXRqdnN4c2RuZ2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk0Mzg4NCwiZXhwIjoyMDg2NTE5ODg0fQ.z-U_G-2r3K8_uM9N1t2kQfO4W5R6S7T8U9V0W1X2Y3Z' # service role
# Or query via curl to supabase REST
"""

# Usar curl directo a Supabase
cmd = """curl -s 'https://uwmdjsxwetjvsxsdngko.supabase.co/rest/v1/whatsapp_mensajes_log?select=*&order=created_at.desc&limit=10' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bWRqc3h3ZXRqdnN4c2RuZ2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDM4ODQsImV4cCI6MjA4NjUxOTg4NH0.Z9R_y0pU7d7Cg-4sWlh0K5L-d2E4Qx1zY2b5e3X2Y3Z"
"""
# Or with service role from docker container
cmd_docker = "docker exec -i backend_api node -e 'import(\"./dist/config/supabase.js\").then(async ({supabaseAdmin}) => { const {data} = await supabaseAdmin.from(\"whatsapp_mensajes_log\").select(\"*\").order(\"created_at\", {ascending:false}).limit(10); console.log(JSON.stringify(data, null, 2)); })'"

_, out, _ = ssh.exec_command(cmd_docker)
print(out.read().decode('utf-8', errors='replace'))

ssh.close()
