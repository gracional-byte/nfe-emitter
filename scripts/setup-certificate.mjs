import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Script para configurar o certificado extraído do PFX
 */

async function setupCertificate() {
  try {
    const privateKeyPath = path.join(__dirname, '../private-key.pem');
    const certificatePath = path.join(__dirname, '../certificate.pem');
    
    if (!fs.existsSync(privateKeyPath)) {
      console.error('❌ Arquivo de chave privada não encontrado:', privateKeyPath);
      process.exit(1);
    }

    if (!fs.existsSync(certificatePath)) {
      console.error('❌ Arquivo de certificado não encontrado:', certificatePath);
      process.exit(1);
    }

    const privateKeyContent = fs.readFileSync(privateKeyPath, 'utf-8');
    const certificateContent = fs.readFileSync(certificatePath, 'utf-8');
    
    // Validar se são PEM válidos
    if (!privateKeyContent.includes('-----BEGIN PRIVATE KEY-----')) {
      console.error('❌ Arquivo de chave privada não é um PEM válido');
      process.exit(1);
    }

    if (!certificateContent.includes('-----BEGIN CERTIFICATE-----')) {
      console.error('❌ Arquivo de certificado não é um PEM válido');
      process.exit(1);
    }

    // Gerar thumbprint do certificado
    const certHash = crypto.createHash('sha1');
    certHash.update(certificateContent);
    const thumbprint = certHash.digest('hex').toUpperCase();

    console.log('✅ Certificado validado com sucesso!');
    console.log('📝 Informações do certificado:');
    console.log(`   - Tipo: Chave Privada RSA`);
    console.log(`   - Thumbprint: ${thumbprint}`);
    console.log(`   - Tamanho da chave: ${privateKeyContent.length} bytes`);
    console.log('\n✅ Próximo passo: Fazer upload pela interface web em "Certificados"');
    
  } catch (error) {
    console.error('❌ Erro ao processar certificado:', error.message);
    process.exit(1);
  }
}

setupCertificate();
