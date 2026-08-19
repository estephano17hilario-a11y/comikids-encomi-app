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

    print(">>> 1. Probando Generación de Texto con Gemini...")
    _, out1, _ = ssh.exec_command('docker exec backend_api node -e "const { GeminiService } = require(\'./dist/services/gemini.service.js\'); GeminiService.generateAssistantResponse(\'Hola, qué servicios ofrecen?\', { customerName: \'Estephano\' }).then(r => console.log(\'[RESPUESTA TEXTO]:\', r)).catch(e => console.error(\'[ERROR]:\', e.message));"')
    print(out1.read().decode('utf-8', errors='replace'))

    print(">>> 2. Probando Análisis de Fotos y Comprobantes con Gemini...")
    _, out2, _ = ssh.exec_command('docker exec backend_api node -e "const { GeminiService } = require(\'./dist/services/gemini.service.js\'); const buf = Buffer.from(\'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==\', \'base64\'); GeminiService.parsePaymentVoucher(buf, \'image/png\').then(v => console.log(\'[VOUCHER PARSED]:\', JSON.stringify(v))).catch(e => console.error(\'[ERROR]:\', e.message));"')
    print(out2.read().decode('utf-8', errors='replace'))

    print(">>> 3. Probando Interpretación de Audios/Notas de Voz de WhatsApp...")
    _, out3, _ = ssh.exec_command('docker exec backend_api node -e "const { GeminiService } = require(\'./dist/services/gemini.service.js\'); const buf = Buffer.from(\'T2dnUwACAAAAAAAAAAAAAAAAPgAAAAAAAAB2dGVzdA==\', \'base64\'); GeminiService.processAudioMessage(buf, \'audio/ogg; codecs=opus\', { customerName: \'Estephano\' }).then(r => console.log(\'[RESPUESTA AUDIO]:\', r)).catch(e => console.error(\'[ERROR]:\', e.message));"')
    print(out3.read().decode('utf-8', errors='replace'))

    ssh.close()

if __name__ == "__main__":
    main()
