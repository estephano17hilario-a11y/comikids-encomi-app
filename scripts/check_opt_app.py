import paramiko

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    
    stdin, stdout, stderr = ssh.exec_command("cat /opt/app/docker-compose.yml")
    print("=== /opt/app/docker-compose.yml ===")
    print(stdout.read().decode('utf-8', errors='replace'))

    stdin, stdout, stderr = ssh.exec_command("ls -la /opt/app && ls -la /opt/app/src")
    print("=== ls /opt/app ===")
    print(stdout.read().decode('utf-8', errors='replace'))

    ssh.close()

if __name__ == '__main__':
    main()
