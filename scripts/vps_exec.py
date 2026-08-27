import paramiko
import sys

def run_remote(cmd):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('89.117.73.97', 22, 'root', 'estephano10FM20home', timeout=20)
    print(f"--- EXECUTING: {cmd} ---")
    full_cmd = f"export PAGER=cat DEBIAN_FRONTEND=noninteractive; {cmd}"
    stdin, stdout, stderr = ssh.exec_command(full_cmd, get_pty=False)
    for line in iter(stdout.readline, ""):
        sys.stdout.buffer.write(line.encode('utf-8', errors='replace'))
        sys.stdout.buffer.flush()
    for err in iter(stderr.readline, ""):
        sys.stderr.buffer.write(err.encode('utf-8', errors='replace'))
        sys.stderr.buffer.flush()
    ssh.close()

if __name__ == '__main__':
    cmd = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "docker ps -a"
    run_remote(cmd)
