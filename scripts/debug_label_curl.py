import paramiko
import sys

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    
    stdin, stdout, stderr = ssh.exec_command("curl -v http://127.0.0.1:3000/api/shalom/orders/47311650/label")
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print("=== CURL OUT ===")
    print(out)
    print("=== CURL ERR ===")
    print(err)

    stdin, stdout, stderr = ssh.exec_command("docker logs --tail 25 backend_api")
    raw = stdout.read().decode('utf-8', errors='replace')
    print("=== DOCKER LOGS ===")
    for l in raw.splitlines():
        print(l.encode('ascii', errors='replace').decode('ascii'))

    ssh.close()

if __name__ == '__main__':
    main()
