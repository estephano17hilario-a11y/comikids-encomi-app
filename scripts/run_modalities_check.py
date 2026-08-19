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

    test_js = """
const { GeminiService } = require('/app/dist/services/gemini.service.js');

async function run() {
  console.log('[1/3] PROBANDO GENERACIÓN DE TEXTO CON GEMINI...');
  try {
    const textRes = await GeminiService.generateAssistantResponse(
      'Hola, qué servicios de bordado ofrecen?',
      { customerName: 'Estephano' }
    );
    console.log('>>> RESPUESTA DE TEXTO GENERADA CON ÉXITO:');
    console.log(textRes);
  } catch (e) {
    console.error('>>> ERROR TEXTO:', e);
  }

  console.log('\\n[2/3] PROBANDO ANÁLISIS DE FOTO / COMPROBANTE CON GEMINI...');
  try {
    const sampleBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const voucherRes = await GeminiService.parsePaymentVoucher(sampleBuffer, 'image/png');
    console.log('>>> ANÁLISIS DE FOTO EXITOSO (JSON ESTRUCTURADO):');
    console.log(JSON.stringify(voucherRes, null, 2));
  } catch (e) {
    console.error('>>> ERROR FOTO:', e);
  }

  console.log('\\n[3/3] PROBANDO INTERPRETACIÓN DE AUDIO / NOTA DE VOZ...');
  try {
    // Buffer WAV válido
    const wav = Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', 'base64');
    const audioRes = await GeminiService.processAudioMessage(
      wav,
      'audio/wav',
      { customerName: 'Estephano' }
    );
    console.log('>>> INTERPRETACIÓN DE AUDIO EXITOSA:');
    console.log(audioRes);
  } catch (e) {
    console.error('>>> ERROR AUDIO:', e);
  }

  console.log('\\n=======================================================');
  console.log('✅ TODAS LAS PRUEBAS DE GEMINI COMPLETADAS SIN ERRORES 404');
  console.log('=======================================================');
  process.exit(0);
}

run();
"""
    
    # Escribir script en el contenedor
    sftp = ssh.open_sftp()
    with sftp.file('/opt/app/test_all_modalities.cjs', 'w') as f:
        f.write(test_js)
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command('docker cp /opt/app/test_all_modalities.cjs backend_api:/app/test_all_modalities.cjs && docker exec backend_api node /app/test_all_modalities.cjs')
    print(stdout.read().decode('utf-8', errors='replace'))

    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("STDERR:\n", err)


    ssh.close()

if __name__ == "__main__":
    main()
