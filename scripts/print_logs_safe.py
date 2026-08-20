import paramiko
import sys

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    stdin, stdout, stderr = ssh.exec_command("docker logs --tail 25 backend_api")
    raw = stdout.read().decode('utf-8', errors='replace')
    for line in raw.splitlines():
        try:
            print(line.encode('ascii', errors='replace').decode('ascii'))
        except Exception:
            pass
    ssh.close()

if __name__ == '__main__':
    main()
