import paramiko, os, sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('89.117.73.97', username='root', password='estephano10FM20home')

sftp = ssh.open_sftp()

def run(cmd):
    print(f"\n{'='*20} {cmd} {'='*20}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    if out: print(out)
    if err: print('ERR:', err)
    return out

local_backend_dir = r"c:\Users\estep\.gemini\antigravity-ide\scratch\incomi-app\backend"
remote_backend_dir = "/opt/app/backend"

print("Subiendo archivos compilados y fuentes del backend al VPS...")
for root, dirs, files in os.walk(local_backend_dir):
    if "node_modules" in root or ".git" in root:
        continue
    rel_path = os.path.relpath(root, local_backend_dir)
    remote_path = os.path.join(remote_backend_dir, rel_path).replace("\\", "/")
    try:
        sftp.mkdir(remote_path)
    except Exception:
        pass
    for f in files:
        local_file = os.path.join(root, f)
        remote_file = os.path.join(remote_path, f).replace("\\", "/")
        sftp.put(local_file, remote_file)

sftp.close()
print("✓ Archivos subidos con éxito.")

# Reconstruir contenedor backend_api y reiniciar
run("cd /opt/app && docker compose build backend_api")
run("cd /opt/app && docker compose up -d backend_api")
run("sleep 3")
run("docker logs --tail 40 backend_api")
