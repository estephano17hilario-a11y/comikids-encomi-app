import paramiko
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"
LOCAL_SRC_DIR = os.path.abspath("backend/src")

def sftp_upload_dir(sftp, local_dir, remote_dir):
    print(f"[*] Subiendo {local_dir} -> {remote_dir}...")
    for root, dirs, files in os.walk(local_dir):
        rel_path = os.path.relpath(root, local_dir)
        target_remote_dir = os.path.normpath(os.path.join(remote_dir, rel_path)).replace("\\", "/")
        try:
            sftp.mkdir(target_remote_dir)
        except IOError:
            pass
        for file in files:
            local_file = os.path.join(root, file)
            remote_file = os.path.normpath(os.path.join(target_remote_dir, file)).replace("\\", "/")
            try:
                sftp.put(local_file, remote_file)
                print(f"  [+] Subido: {rel_path}/{file}")
            except Exception as e:
                print(f"[-] Error subiendo {file}: {e}")

def main():
    print(f"[*] Conectando a VPS {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=20)
    print("[+] Conexión SSH establecida.")

    sftp = ssh.open_sftp()
    sftp_upload_dir(sftp, LOCAL_SRC_DIR, "/opt/app/src")
    sftp.close()

    # Reconstruir sin cache y forzar recreación
    cmds = [
        "cd /opt/app && docker compose build --no-cache backend_api",
        "cd /opt/app && docker compose up -d --force-recreate backend_api",
        "sleep 4",
        "docker ps | grep backend_api",
        "curl -i http://127.0.0.1:3000/api/shalom/orders/47311650/label | head -n 15",
        "curl -i http://127.0.0.1:3000/api/shalom/orders/92644270/label | head -n 15",
        "curl -i http://127.0.0.1:3000/api/shalom/orders/Rosario/label | head -n 15"
    ]

    for c in cmds:
        print(f"\n=======================================================")
        print(f"[EXEC] {c}")
        print("=======================================================")
        stdin, stdout, stderr = ssh.exec_command(c)
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()
        if out:
            print(f"[STDOUT]\n{out}")
        if err and exit_status != 0:
            print(f"[STDERR]\n{err}")

    ssh.close()

if __name__ == '__main__':
    main()
