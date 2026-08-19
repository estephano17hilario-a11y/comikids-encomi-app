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
    
    # 1. Probar con Global Key
    cmd_global = """curl -s -X POST "http://127.0.0.1:8080/message/sendText/comikids_whatsapp" \\
  -H "Content-Type: application/json" \\
  -H "apikey: comikids_evolution_master_key_2026" \\
  -d '{"number":"159377847771173@lid","text":"Test Global Key"}'"""
    _, out_g, _ = ssh.exec_command(cmd_global)
    print("GLOBAL KEY RES:", out_g.read().decode('utf-8'))

    # 2. Probar con Instance Token
    cmd_inst = """curl -s -X POST "http://127.0.0.1:8080/message/sendText/comikids_whatsapp" \\
  -H "Content-Type: application/json" \\
  -H "apikey: A27C33E1-9A89-442F-96FE-EA1D9F252A5B" \\
  -d '{"number":"159377847771173@lid","text":"Test Instance Token"}'"""
    _, out_i, _ = ssh.exec_command(cmd_inst)
    print("INSTANCE TOKEN RES:", out_i.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    main()
