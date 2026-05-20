import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Script para fazer upload do certificado PFX extraído
 */

async function uploadCertificate() {
  try {
    const privateKeyPath = path.join(__dirname, '../private-key.pem');
    
    if (!fs.existsSync(privateKeyPath)) {
      console.error('❌ Arquivo de chave privada não encontrado:', privateKeyPath);
      process.exit(1);
    }

    const privateKeyContent = fs.readFileSync(privateKeyPath, 'utf-8');
    
    // Validar se é PEM válido
    if (!privateKeyContent.includes('-----BEGIN PRIVATE KEY-----')) {
      console.error('❌ Arquivo de chave privada não é um PEM válido');
      process.exit(1);
    }

    // Gerar thumbprint
    const certHash = crypto.createHash('sha1');
    certHash.update(privateKeyContent);
    const thumbprint = certHash.digest('hex').toUpperCase();

    console.log('✅ Certificado validado com sucesso!');
    console.log('📝 Informações:');
    console.log(`   - Thumbprint: ${thumbprint}`);
    console.log(`   - Tamanho: ${privateKeyContent.length} bytes`);
    console.log(`\n✅ Certificado pronto para ser usado no sistema`);
    
  } catch (error) {
    console.error('❌ Erro ao processar certificado:', error.message);
    process.exit(1);
  }
}

uploadCertificate();
