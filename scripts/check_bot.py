import paramiko, json, sys, time

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

for attempt in range(5):
    try:
        ssh.connect('89.117.73.97', username='root', password='estephano10FM20home', timeout=10)
        break
    except Exception as e:
        time.sleep(1)

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
    out = stdout.read().decode('utf-8', errors='ignore')
    return out

print("=== SEARCHING WA_VERSION OR VERSION CONFIG IN EVOLUTION API ===")
print(run('docker exec evolution_api grep -rn "CONFIG_SESSION_PHONE_VERSION" /evolution/dist/'))
print("=== SEARCHING fetchLatestBaileysVersion IN EVOLUTION API ===")
print(run('docker exec evolution_api grep -rn "fetchLatest" /evolution/dist/'))
