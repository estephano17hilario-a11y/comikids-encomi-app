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

    test_cmd = """docker exec backend_api node -e "
const { GeminiService } = require('./dist/services/gemini.service.js');

async function testAll() {
  console.log('--- 1. TEST TEXTO ---');
  try {
    const textRes = await GeminiService.generateAssistantResponse(
      'Hola, quisiera saber los precios de poleras con bordado',
      { customerName: 'Estephano' }
    );
    console.log('[OK TEXTO]: ' + textRes.replace(/\\n/g, ' '));
  } catch (e) {
    console.log('[FAIL TEXTO]: ' + e.message);
  }

  console.log('--- 2. TEST FOTO / COMPROBANTE ---');
  try {
    const sampleBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const voucherRes = await GeminiService.parsePaymentVoucher(sampleBuffer, 'image/png');
    console.log('[OK FOTO]: Banco=' + voucherRes.banco + ', Monto=' + voucherRes.monto + ', Valido=' + voucherRes.esComprobanteValido);
  } catch (e) {
    console.log('[FAIL FOTO]: ' + e.message);
  }

  console.log('--- 3. TEST AUDIO / NOTA DE VOZ ---');
  try {
    // Generar un pequeño WAV header dummy
    const wavHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
      0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
      0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61,
      0x00, 0x00, 0x00, 0x00
    ]);
    const audioRes = await GeminiService.processAudioMessage(
      wavHeader,
      'audio/wav',
      { customerName: 'Estephano' }
    );
    console.log('[OK AUDIO]: ' + audioRes.replace(/\\n/g, ' '));
  } catch (e) {
    console.log('[FAIL AUDIO]: ' + e.message);
  }
}

testAll();
" """

    stdin, stdout, stderr = ssh.exec_command(test_cmd, timeout=30)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print("STDOUT:\n", out)
    if err:
        print("STDERR:\n", err)
    ssh.close()

if __name__ == "__main__":
    main()
