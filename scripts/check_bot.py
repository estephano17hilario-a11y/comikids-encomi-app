import paramiko, json, sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('89.117.73.97', username='root', password='estephano10FM20home')

def run(cmd):
    print(f"\n{'='*20} {cmd} {'='*20}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    if out: print(out)
    if err: print('ERR:', err)
    return out

API_KEY = 'comikids_evolution_master_key_2026'

# Let's check getQrCode endpoint through backend for comikids_whatsapp and tenant_Comikids
run('curl -s http://89.117.73.97:3000/tenant/comikids_whatsapp/status')
run('curl -s http://89.117.73.97:3000/tenant/tenant_Comikids/status')
run('curl -s http://89.117.73.97:3000/tenant/comikids_whatsapp/qr')
run('curl -s http://89.117.73.97:3000/tenant/tenant_Comikids/qr')
