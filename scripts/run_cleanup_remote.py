import paramiko
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('89.117.73.97', 22, 'root', 'estephano10FM20home')

sftp = ssh.open_sftp()
sftp.put('scripts/cleanup_supabase.js', '/opt/app/cleanup_supabase.js')
sftp.close()

# Copiar al contenedor y ejecutar
ssh.exec_command('docker cp /opt/app/cleanup_supabase.js backend_api:/app/cleanup_supabase.js')
_, out, _ = ssh.exec_command('docker exec backend_api node /app/cleanup_supabase.js')
print("CLEANUP OUTPUT:", out.read().decode('utf-8', errors='replace'))

ssh.close()
