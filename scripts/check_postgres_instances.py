import paramiko
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "89.117.73.97"
USER = "root"
PASSWORD = "estephano10FM20home"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)
    
    # 1. Ver tablas en Postgres
    cmd1 = 'docker exec evolution_postgres psql -U evolution_user -d evolution_db -c "\\dt"'
    _, out1, _ = ssh.exec_command(cmd1)
    print("TABLES:\n", out1.read().decode('utf-8'))

    # 2. Ver instancias
    cmd2 = 'docker exec evolution_postgres psql -U evolution_user -d evolution_db -c "SELECT id, name, \"connectionStatus\", \"clientName\" FROM \"Instance\";"'
    _, out2, _ = ssh.exec_command(cmd2)
    print("INSTANCES:\n", out2.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
